// Backgrounds drawn by Google's Nano Banana (Gemini API). With the Batch API a whole
// video's backgrounds go out in one job at half price, back within 24 hours; the
// job name is saved, so a closed app picks the same job up instead of paying again.
import fs from "node:fs";
import path from "node:path";
import { ApiError, GoogleGenAI, JobState, type GenerateContentResponse, type Part } from "@google/genai";
import { setting } from "../settings";
import { readJsonSafe, writeJsonAtomic } from "./tools";

export const hasGeminiKey = () => !!process.env.GEMINI_API_KEY?.trim();
const client = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY?.trim() });

export type GeminiRequest = { key: string; text: string; portrait: boolean };

/** Google declined this picture (safety filters): it is skipped, like an OpenAI refusal. */
export class GeminiRefusal extends Error {}

const REFUSALS = new Set(["SAFETY", "IMAGE_SAFETY", "PROHIBITED_CONTENT", "IMAGE_PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION", "SPII", "MODEL_ARMOR"]);
const mimeOf = (file: string) => (/\.png$/i.test(file) ? "image/png" : /\.webp$/i.test(file) ? "image/webp" : "image/jpeg");
/** Backgrounds in the video's shape at the chosen size; props square at 1K (shown at most ~450 px wide). */
const imageConfig = (portrait: boolean, square = false) =>
  square ? { aspectRatio: "1:1", imageSize: "1K" } : { aspectRatio: portrait ? "9:16" : "16:9", imageSize: setting("GEMINI_IMAGE_SIZE") };

function imageFrom(response: GenerateContentResponse | undefined): Buffer {
  const data = response?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (data) return Buffer.from(data, "base64");
  const reason = response?.promptFeedback?.blockReason ?? response?.candidates?.[0]?.finishReason ?? "";
  if (REFUSALS.has(reason)) throw new GeminiRefusal(`Google không vẽ ảnh này (${reason}).`);
  throw new Error(`Google không trả về ảnh${reason ? ` (${reason})` : ""}.`);
}

export function explainGemini(e: unknown): string {
  const message = (e as Error).message ?? String(e);
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403 || /API key not valid/i.test(message)) return "GEMINI_API_KEY không hợp lệ hoặc chưa được phép dùng Gemini API.";
    if (/billing|free tier|FAILED_PRECONDITION/i.test(message)) return "Model vẽ ảnh của Google không có gói miễn phí: bật thanh toán (billing) cho dự án của khóa trong Google AI Studio.";
    if (e.status === 429) return "Google đang giới hạn số yêu cầu vẽ ảnh; thử lại sau ít phút, hoặc bật Vẽ theo lô (Batch).";
    if (e.status === 404) return `Không dùng được model ảnh "${setting("GEMINI_IMAGE_MODEL")}": đổi model ở tab ⚙️ Cài đặt.`;
  }
  return `Google báo lỗi khi vẽ ảnh: ${message.split("\n")[0]}`;
}

const inlineRef = (file: string): Part => ({ inlineData: { mimeType: mimeOf(file), data: fs.readFileSync(file).toString("base64") } });

/** One picture drawn right away (standard price): a background, or with `square` a prop. */
export async function drawGemini(text: string, refs: string[], portrait: boolean, square = false): Promise<Buffer> {
  const response = await client().models.generateContent({
    model: setting("GEMINI_IMAGE_MODEL"),
    contents: [{ role: "user", parts: [{ text }, ...refs.map(inlineRef)] }],
    config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: imageConfig(portrait, square) },
  });
  return imageFrom(response);
}

const BATCH_FILE = "gemini-batch.json";
const POLL_MS = 20_000;
type SavedBatch = { name: string; keys: string[]; createdAt: string };

export const hasSavedBatch = (dir: string) => fs.existsSync(path.join(dir, BATCH_FILE));

/**
 * Draws backgrounds through the Batch API, or, with no `requests`, waits for the batch
 * saved by an earlier run. `save(key, image)` receives each picture; `image` is null
 * when Google declined it, and an item that failed for another reason is not saved.
 */
export async function drawInBatch(
  dir: string,
  requests: GeminiRequest[],
  refs: string[],
  save: (key: string, image: Buffer | null) => Promise<void>,
  onWait: (message: string) => void,
): Promise<void> {
  const ai = client();
  const file = path.join(dir, BATCH_FILE);
  let saved = readJsonSafe<SavedBatch>(file);
  if (!saved) {
    if (!requests.length) return;
    // The references are uploaded once and shared, so the batch stays far below its 20 MB limit.
    const uploaded = await Promise.all(refs.map((f) => ai.files.upload({ file: f, config: { mimeType: mimeOf(f) } })));
    const refParts: Part[] = uploaded.map((u) => ({ fileData: { fileUri: u.uri, mimeType: u.mimeType } }));
    const job = await ai.batches.create({
      model: setting("GEMINI_IMAGE_MODEL"),
      src: requests.map((r) => ({
        contents: [{ role: "user", parts: [{ text: r.text }, ...refParts] }],
        config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: imageConfig(r.portrait) },
        metadata: { key: r.key },
      })),
      config: { displayName: `fedtoon-${path.basename(path.dirname(dir))}` },
    });
    if (!job.name) throw new Error("Google không trả về mã lô ảnh.");
    saved = { name: job.name, keys: requests.map((r) => r.key), createdAt: new Date().toISOString() };
    // Saved before waiting: from here on, continuing the job reads this batch and never submits it twice.
    writeJsonAtomic(file, saved);
  }
  for (;;) {
    const job = await ai.batches.get({ name: saved.name });
    if (job.state === JobState.JOB_STATE_SUCCEEDED) {
      for (const [i, item] of (job.dest?.inlinedResponses ?? []).entries()) {
        const key = item.metadata?.key ?? saved.keys[i];
        if (item.error || !key) continue;
        try {
          await save(key, imageFrom(item.response));
        } catch (e) {
          if (!(e instanceof GeminiRefusal)) continue;
          await save(key, null);
        }
      }
      fs.rmSync(file, { force: true });
      return;
    }
    if (job.state === JobState.JOB_STATE_FAILED || job.state === JobState.JOB_STATE_CANCELLED || job.state === JobState.JOB_STATE_EXPIRED) {
      fs.rmSync(file, { force: true });
      throw new Error(`Lô ảnh nền của Google không hoàn thành (${job.state}${job.error?.message ? `: ${job.error.message}` : ""}). Bấm Tiếp tục để gửi lại, hoặc tắt Vẽ theo lô trong tab ⚙️ Cài đặt.`);
    }
    const minutes = Math.round((Date.now() - Date.parse(saved.createdAt)) / 60_000);
    onWait(`Đang chờ Google vẽ lô ${saved.keys.length} ảnh nền (${job.state ?? "đang xử lý"}, đã ${minutes} phút). Thường xong sau vài phút, tối đa 24 giờ. Có thể đóng app, lần sau bấm Tiếp tục để lấy ảnh.`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
