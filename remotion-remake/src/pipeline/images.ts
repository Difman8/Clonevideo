// "Hoạt hình Fedtoon" pictures: backgrounds and props drawn by the OpenAI Images
// API in the Fedtoon style. Every image is cached by (style, prompt): a resumed
// job, a re-render or a later video reusing the same place never pays again.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { mapLimit } from "../discover/classify";
import { setting } from "../settings";
import { PALETTE, type ColorName } from "../fedtoon/brand";
import { deltaE } from "../fedtoon/contrast";
import { bgRef, imageFileKey, imageRef, type Shot, type Storyboard } from "../spec/storyboard";
import { ffmpegPath, OUT_DIR, readJsonSafe, writeFileAtomic, writeJsonAtomic } from "./tools";

export const imageDir = (id: string) => path.join(OUT_DIR, id, "img");
export const hasImageKey = () => !!process.env.OPENAI_API_KEY?.trim();

type Kind = "bg" | "prop";

/** Exact 9:16 / 16:9 frames for gpt-image-2+, the closest standard size otherwise. */
function sizeFor(model: string, kind: Kind, meta: Storyboard["meta"]): string {
  if (kind === "prop") return "1024x1024";
  const portrait = meta.height >= meta.width;
  if (/^gpt-image-[2-9]/.test(model)) return portrait ? "864x1536" : "1536x864";
  return portrait ? "1024x1536" : "1536x1024";
}

const named = (names: readonly ColorName[]) => names.map((n) => `${n} (${PALETTE[n]})`).join(", ");

/** What the image model is asked to draw. Backgrounds carry their colors and the colors to avoid. */
function fullPrompt(kind: Kind, prompt: string, style: string, portrait: boolean, colors: ColorName[] = [], avoid: ColorName[] = []): string {
  if (kind === "prop") return `${style}\n\nA single isolated object, centered and filling most of the frame, on a fully transparent background, with no ground, no shadow and no text: ${prompt}`;
  return [
    style,
    "",
    `Scene (${portrait ? "vertical 9:16" : "horizontal 16:9"} frame): ${prompt}`,
    colors.length ? `Color palette: the background is dominated by large flat areas of ${named(colors)}.` : "",
    avoid.length ? `Characters colored ${named(avoid)} will stand in front of it: keep those colors out of the background so they stand out.` : "",
    "Keep the lower middle third simple and uncluttered: characters will be placed there. No people, no characters, no animals unless asked, no text.",
  ]
    .filter((l, i) => l || i === 1)
    .join("\n");
}

/** Brand color closest to the most common color where characters stand (lower middle of the picture). */
async function groundColor(file: string): Promise<string> {
  const raw = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-i", file, "-vf", "crop=iw*0.6:ih*0.3:iw*0.2:ih*0.5,scale=12:8", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.on("error", reject);
    child.on("close", () => resolve(Buffer.concat(chunks)));
  });
  const counts = new Map<string, number>();
  for (let i = 0; i + 2 < raw.length; i += 3) {
    const px = `#${[raw[i], raw[i + 1], raw[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    let best = "";
    let bestD = Infinity;
    for (const c of Object.values(PALETTE)) {
      const d = deltaE(px, c);
      if (d < bestD) [best, bestD] = [c, d];
    }
    counts.set(best, (counts.get(best) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

/** OpenAI rejected this one picture (content policy): skip it instead of failing the whole video. */
const isPerImageRefusal = (e: unknown) => {
  const err = e as { status?: number; code?: string; message?: string };
  return err.status === 400 && (err.code === "moderation_blocked" || /safety|moderation|content policy/i.test(err.message ?? ""));
};

function explain(e: unknown): string {
  const err = e as { status?: number; code?: string; message?: string };
  if (err.status === 401) return "OPENAI_API_KEY không hợp lệ (tạo ảnh).";
  if (err.code === "insufficient_quota" || err.code === "billing_hard_limit_reached") return "Tài khoản OpenAI đã hết tiền hoặc chạm giới hạn chi tiêu (tạo ảnh).";
  if (err.status === 429) return "OpenAI đang giới hạn số yêu cầu tạo ảnh; thử lại sau ít phút.";
  if (err.status === 404 || err.code === "model_not_found") return `Không dùng được model ảnh "${setting("OPENAI_IMAGE_MODEL")}": đổi model ở tab ⚙️ Cài đặt.`;
  return `OpenAI báo lỗi khi tạo ảnh: ${(err.message ?? String(e)).split("\n")[0]}`;
}

export async function generateImage(
  kind: Kind,
  prompt: string,
  meta: Storyboard["meta"],
  colors: ColorName[] = [],
  avoid: ColorName[] = [],
): Promise<{ data: Buffer; ext: "jpg" | "png" }> {
  const model = setting("OPENAI_IMAGE_MODEL");
  const res = await new OpenAI().images.generate({
    model,
    prompt: fullPrompt(kind, prompt, setting("FEDTOON_IMAGE_STYLE"), meta.height >= meta.width, colors, avoid),
    size: sizeFor(model, kind, meta),
    quality: setting("OPENAI_IMAGE_QUALITY") as OpenAI.Images.ImageGenerateParams["quality"],
    moderation: setting("OPENAI_IMAGE_MODERATION") as OpenAI.Images.ImageGenerateParams["moderation"],
    background: kind === "prop" ? "transparent" : "opaque",
    output_format: kind === "prop" ? "png" : "jpeg",
    ...(kind === "bg" ? { output_compression: 90 } : {}),
    n: 1,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI không trả về ảnh.");
  return { data: Buffer.from(b64, "base64"), ext: kind === "prop" ? "png" : "jpg" };
}

export type ImageReport = { generated: number; reused: number; skipped: string[] };

/**
 * Makes sure every background and prop of the storyboard has a picture and
 * returns the storyboard with `images` filled in. Pictures OpenAI refuses are
 * skipped (the renderer draws a backdrop / placeholder instead).
 */
export async function generateStoryboardImages(
  id: string,
  sb: Storyboard,
  onProgress: (done: number, total: number, message: string) => void,
): Promise<{ storyboard: Storyboard; report: ImageReport }> {
  const style = setting("FEDTOON_IMAGE_STYLE");
  type Want = { kind: Kind; prompt: string; colors: ColorName[]; avoid: ColorName[] };
  const wanted = new Map<string, Want>();
  const outfitsOf = (shot: Shot) => [...new Set(shot.characters.map((c) => sb.cast.find((m) => m.id === c.castId)?.outfit).filter((x): x is ColorName => !!x))];
  for (const shot of sb.shots) {
    const bg = shot.background;
    if (bg.prompt.trim() && !wanted.has(bgRef(bg))) wanted.set(bgRef(bg), { kind: "bg", prompt: bg.prompt.trim(), colors: bg.colors, avoid: outfitsOf(shot) });
    for (const p of shot.props) if (p.prompt.trim()) wanted.set(imageRef("prop", p.prompt), { kind: "prop", prompt: p.prompt.trim(), colors: [], avoid: [] });
  }
  const dir = imageDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const images: Record<string, string> = {};
  const imageColors: Record<string, string> = {};
  const report: ImageReport = { generated: 0, reused: 0, skipped: [] };
  // Prompts OpenAI refused are not sent again until their wording (or the style) changes.
  const refusedFile = path.join(dir, "refused.json");
  const refused = new Set(readJsonSafe<string[]>(refusedFile) ?? []);
  let done = 0;
  let fatal: Error | null = null;
  await mapLimit([...wanted], 3, async ([ref, { kind, prompt, colors, avoid }]) => {
    if (fatal) return;
    const key = imageFileKey(kind, colors.length ? `${prompt} | ${colors.join(", ")}` : prompt, style);
    const existing = ["jpg", "png"].map((ext) => `${key}.${ext}`).find((f) => fs.existsSync(path.join(dir, f)));
    let file = existing;
    if (!file && refused.has(key)) report.skipped.push(prompt);
    else if (!file) {
      try {
        const img = await generateImage(kind, prompt, sb.meta, colors, avoid);
        file = `${key}.${img.ext}`;
        writeFileAtomic(path.join(dir, file), img.data);
        report.generated++;
      } catch (e) {
        if (isPerImageRefusal(e)) {
          report.skipped.push(prompt);
          refused.add(key);
        } else fatal ??= new Error(explain(e));
      }
    } else report.reused++;
    if (file) {
      images[ref] = `img/${id}/${file}`;
      // Lets the renderer add a contrasting disc behind a character if the picture came out in its colors.
      if (kind === "bg") imageColors[ref] = await groundColor(path.join(dir, file)).catch(() => "");
    }
    onProgress(++done, wanted.size, `${kind === "bg" ? "Nền" : "Đồ vật"}: ${prompt.slice(0, 60)}${existing ? " (dùng lại)" : file ? "" : " (bị từ chối, dùng hình vẽ sẵn)"}`);
  });
  writeJsonAtomic(refusedFile, [...refused]);
  // Images already made are kept even when a later one fails: continuing the job won't pay for them again.
  if (fatal) throw fatal;
  return { storyboard: { ...sb, images, imageColors }, report };
}
