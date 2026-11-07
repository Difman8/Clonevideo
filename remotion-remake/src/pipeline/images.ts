// "Hoạt hình Fedtoon" pictures: backgrounds and props in the Fedtoon style, drawn by the
// tool chosen in the settings (OpenAI, Google Nano Banana for backgrounds, Recraft for
// props). Every image is cached by (style, prompt): a resumed job, a re-render or a later
// video reusing the same place never pays again.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { ApiError } from "@google/genai";
import { mapLimit } from "../discover/classify";
import { boolSetting, setting } from "../settings";
import { PALETTE, STYLE_REFERENCE_NOTE, type ColorName } from "../fedtoon/brand";
import { bgRef, imageFileKey, imageRef, type Shot, type Storyboard } from "../spec/storyboard";
import { drawGemini, drawInBatch, explainGemini, GeminiRefusal, hasGeminiKey, hasSavedBatch, type GeminiRequest } from "./images-gemini";
import { drawRecraft, hasRecraftKey, RecraftError } from "./images-recraft";
import { ffmpegPath, OUT_DIR, readJsonSafe, ROOT, run, writeFileAtomic, writeJsonAtomic } from "./tools";

export const imageDir = (id: string) => path.join(OUT_DIR, id, "img");

type Kind = "bg" | "prop";
export type ImageTool = "openai" | "gemini" | "recraft";

/** The tool chosen in the settings: backgrounds can use Google, props Recraft. */
export function toolFor(kind: Kind): ImageTool {
  const tool = setting(kind === "bg" ? "IMAGE_BG_PROVIDER" : "IMAGE_PROP_PROVIDER");
  if (kind === "bg" && tool === "gemini") return "gemini";
  if (kind === "prop" && tool === "recraft") return "recraft";
  return "openai";
}

const KEYS: Record<ImageTool, { env: string; ready: () => boolean }> = {
  openai: { env: "OPENAI_API_KEY", ready: () => !!process.env.OPENAI_API_KEY?.trim() },
  gemini: { env: "GEMINI_API_KEY", ready: hasGeminiKey },
  recraft: { env: "RECRAFT_API_KEY", ready: hasRecraftKey },
};

/** API keys the chosen tools still need; empty when pictures can be drawn. */
export function missingImageKeys(kinds: Kind[] = ["bg", "prop"]): string[] {
  return [...new Set(kinds.map(toolFor))].filter((t) => !KEYS[t].ready()).map((t) => KEYS[t].env);
}

/** Folder of the style reference images (the channel's character sheet, plus any image the owner adds). */
export const STYLE_DIR = path.join(ROOT, "assets", "style");
const MAX_STYLE_REFS = 8;

/** Style reference images sent with every drawing, when enabled in the settings. */
export function styleRefs(): string[] {
  if (!boolSetting("OPENAI_IMAGE_STYLE_REFS")) return [];
  try {
    return fs
      .readdirSync(STYLE_DIR)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort()
      .slice(0, MAX_STYLE_REFS)
      .map((f) => path.join(STYLE_DIR, f))
      .filter((f) => fs.statSync(f).size < 40 * 1024 * 1024);
  } catch {
    return [];
  }
}

/** Changes whenever the reference images change, so pictures drawn with other references are redrawn. */
const refsSignature = (refs: string[]) => refs.map((f) => `${path.basename(f)}:${fs.statSync(f).size}`).join(",");

const mimeOf = (file: string) => (/\.png$/i.test(file) ? "image/png" : /\.webp$/i.test(file) ? "image/webp" : "image/jpeg");
/**
 * Background size from the settings for gpt-image-2+ (any size whose sides divide by 16), the
 * closest standard size otherwise. Props stay square: they are shown at most 454 px wide.
 */
function sizeFor(model: string, kind: Kind, meta: Storyboard["meta"]): string {
  if (kind === "prop") return "1024x1024";
  const portrait = meta.height >= meta.width;
  if (!/^gpt-image-[2-9]/.test(model)) return portrait ? "1024x1536" : "1536x1024";
  const [long, short] = setting("OPENAI_IMAGE_BG_SIZE").split("x");
  return portrait ? `${short}x${long}` : `${long}x${short}`;
}

/** For the job log: what pictures drawn now will look like. */
export function imageSettingsText(meta: Storyboard["meta"]) {
  const openai = setting("OPENAI_IMAGE_MODEL");
  const bg =
    toolFor("bg") === "gemini"
      ? `Google ${setting("GEMINI_IMAGE_MODEL")} ${setting("GEMINI_IMAGE_SIZE")}, thu về ${meta.width}x${meta.height}${boolSetting("GEMINI_BATCH") ? ", vẽ theo lô (Batch)" : ""}`
      : `OpenAI ${openai} ${sizeFor(openai, "bg", meta)}, chất lượng ${setting("OPENAI_IMAGE_QUALITY")}`;
  const prop = toolFor("prop") === "recraft" ? `Recraft ${setting("RECRAFT_MODEL")} + tách nền` : `OpenAI ${openai}, chất lượng ${setting("OPENAI_IMAGE_QUALITY")}`;
  return `Ảnh vẽ mới: nền bằng ${bg}; đồ vật bằng ${prop}.`;
}

const named = (names: readonly ColorName[]) => names.map((n) => `${n} (${PALETTE[n]})`).join(", ");

/**
 * What the image model is asked to draw. Backgrounds carry their colors and the colors to
 * avoid. A tool that cannot paint transparency gets a plain background that is cut out later.
 */
function fullPrompt(kind: Kind, prompt: string, style: string, portrait: boolean, colors: ColorName[] = [], avoid: ColorName[] = [], transparent = true): string {
  if (kind === "prop")
    return `${style}\n\nA single isolated object, centered and filling most of the frame, on ${transparent ? "a fully transparent background" : "a plain flat white background"}, with no ground, no shadow and no text. If it has a face, draw it in the same cute style as the characters' faces: ${prompt}`;
  return [
    style,
    "",
    `Scene (${portrait ? "vertical 9:16" : "horizontal 16:9"} frame): ${prompt}`,
    colors.length ? `Color palette: the background is dominated by large flat areas of ${named(colors)}.` : "",
    avoid.length ? `Characters colored ${named(avoid)} will stand in front of it: do not use exactly these colors in the background.` : "",
    "Keep the lower middle third simple and uncluttered: characters will be placed there. No people, no characters, no animals unless asked, no text.",
  ]
    .filter((l, i) => l || i === 1)
    .join("\n");
}

/** The image tool declined this one picture (content policy): skip it instead of failing the whole video. */
function isPerImageRefusal(e: unknown) {
  if (e instanceof GeminiRefusal) return true;
  if (e instanceof RecraftError) return e.refused;
  const err = e as { status?: number; code?: string; message?: string };
  return err.status === 400 && (err.code === "moderation_blocked" || /safety|moderation|content policy/i.test(err.message ?? ""));
}

function explain(e: unknown): string {
  if (e instanceof RecraftError || e instanceof GeminiRefusal) return e.message;
  if (e instanceof ApiError) return explainGemini(e);
  const err = e as { status?: number; code?: string; message?: string };
  if (err.status === 401) return "OPENAI_API_KEY không hợp lệ (tạo ảnh).";
  if (err.code === "insufficient_quota" || err.code === "billing_hard_limit_reached") return "Tài khoản OpenAI đã hết tiền hoặc chạm giới hạn chi tiêu (tạo ảnh).";
  if (err.status === 429) return "OpenAI đang giới hạn số yêu cầu tạo ảnh; thử lại sau ít phút.";
  if (err.status === 404 || err.code === "model_not_found") return `Không dùng được model ảnh "${setting("OPENAI_IMAGE_MODEL")}": đổi model ở tab ⚙️ Cài đặt.`;
  return `Lỗi khi tạo ảnh: ${(err.message ?? String(e)).split("\n")[0]}`;
}

/**
 * Scales a picture to cover exactly the video frame (centre crop) and saves it as a high
 * quality JPEG. Also says how big the original was: Google has been seen ignoring the size.
 */
async function fitToFrame(data: Buffer, width: number, height: number): Promise<{ data: Buffer; note: string }> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fedtoon-"));
  try {
    const src = path.join(tmp, "src.img");
    const out = path.join(tmp, "out.jpg");
    fs.writeFileSync(src, data);
    const { stderr } = await run(ffmpegPath(), ["-hide_banner", "-y", "-i", src, "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`, "-q:v", "2", out]);
    const [, w, h] = stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/) ?? [];
    const small = Number(w) && Math.min(Number(w), Number(h)) < Math.min(width, height);
    return { data: fs.readFileSync(out), note: w ? ` (ảnh gốc ${w}x${h}${small ? ", nhỏ hơn khung video nên đã phóng to" : ""})` : "" };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** The text sent with the style references: learn the look, do not copy the characters. */
const withRefsNote = (text: string, refs: string[]) => (refs.length ? `${STYLE_REFERENCE_NOTE}\n\n${text}` : text);

export async function generateImage(
  kind: Kind,
  prompt: string,
  meta: Storyboard["meta"],
  colors: ColorName[] = [],
  avoid: ColorName[] = [],
): Promise<{ data: Buffer; ext: "jpg" | "png"; note?: string }> {
  const tool = toolFor(kind);
  const portrait = meta.height >= meta.width;
  const refs = styleRefs();
  const style = setting("FEDTOON_IMAGE_STYLE");
  if (tool === "gemini") {
    const fitted = await fitToFrame(await drawGemini(withRefsNote(fullPrompt(kind, prompt, style, portrait, colors, avoid), refs), refs, portrait), meta.width, meta.height);
    return { data: fitted.data, ext: "jpg", note: fitted.note };
  }
  if (tool === "recraft") return { data: await drawRecraft(fullPrompt(kind, prompt, style, portrait, colors, avoid, false), refs, styleSignature(kind)), ext: "png" };

  const model = setting("OPENAI_IMAGE_MODEL");
  const text = fullPrompt(kind, prompt, style, portrait, colors, avoid);
  const common = {
    model,
    size: sizeFor(model, kind, meta),
    background: kind === "prop" ? ("transparent" as const) : ("opaque" as const),
    output_format: kind === "prop" ? ("png" as const) : ("jpeg" as const),
    n: 1,
  };
  const client = new OpenAI();
  // With style references the picture is drawn by the edits endpoint, which takes reference images.
  const res = refs.length
    ? await client.images.edit({
        ...common,
        image: await Promise.all(refs.map((f) => toFile(fs.readFileSync(f), path.basename(f), { type: mimeOf(f) }))),
        prompt: withRefsNote(text, refs),
        quality: setting("OPENAI_IMAGE_QUALITY") as OpenAI.Images.ImageEditParams["quality"],
      })
    : await client.images.generate({
        ...common,
        prompt: text,
        quality: setting("OPENAI_IMAGE_QUALITY") as OpenAI.Images.ImageGenerateParams["quality"],
        moderation: setting("OPENAI_IMAGE_MODERATION") as OpenAI.Images.ImageGenerateParams["moderation"],
      });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI không trả về ảnh.");
  return { data: Buffer.from(b64, "base64"), ext: kind === "prop" ? "png" : "jpg" };
}

export type ImageReport = { generated: number; reused: number; skipped: string[] };

/**
 * Cache key input: the style text and the reference images, so changing either draws new
 * pictures; for Google and Recraft also the tool and model (OpenAI keys stay as before).
 */
function styleSignature(kind: Kind) {
  const refs = styleRefs();
  const base = refs.length ? `${setting("FEDTOON_IMAGE_STYLE")}\nrefs:${refsSignature(refs)}` : setting("FEDTOON_IMAGE_STYLE");
  const tool = toolFor(kind);
  if (tool === "gemini") return `gemini:${setting("GEMINI_IMAGE_MODEL")}:${setting("GEMINI_IMAGE_SIZE")}\n${base}`;
  if (tool === "recraft") return `recraft:${setting("RECRAFT_MODEL")}\n${base}`;
  return base;
}

/**
 * Draws one new object for the scene editor (paid, only on an explicit click).
 * A description this video already has a picture for is reused instead.
 */
export async function drawProp(id: string, sb: Storyboard, prompt: string): Promise<{ ref: string; src: string; drawn: boolean }> {
  const ref = imageRef("prop", prompt);
  const dir = imageDir(id);
  const prior = sb.images[ref];
  if (prior && fs.existsSync(path.join(dir, path.basename(prior)))) return { ref, src: prior, drawn: false };
  const key = imageFileKey("prop", prompt, styleSignature("prop"));
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(path.join(dir, `${key}.png`))) return { ref, src: `img/${id}/${key}.png`, drawn: false };
  try {
    const img = await generateImage("prop", prompt.trim(), sb.meta);
    writeFileAtomic(path.join(dir, `${key}.png`), img.data);
    return { ref, src: `img/${id}/${key}.png`, drawn: true };
  } catch (e) {
    throw new Error(isPerImageRefusal(e) ? "Công cụ vẽ ảnh từ chối mô tả này, hãy thử viết khác đi." : explain(e));
  }
}

/**
 * Makes sure every background and prop of the storyboard has a picture and
 * returns the storyboard with `images` filled in. Pictures the tool refuses are
 * skipped (the renderer draws a backdrop / placeholder instead).
 */
export async function generateStoryboardImages(
  id: string,
  sb: Storyboard,
  onProgress: (done: number, total: number, message: string) => void,
): Promise<{ storyboard: Storyboard; report: ImageReport }> {
  type Want = { kind: Kind; prompt: string; colors: ColorName[]; avoid: ColorName[]; key: string };
  const signatures = { bg: styleSignature("bg"), prop: styleSignature("prop") };
  const wanted = new Map<string, Want>();
  const outfitsOf = (shot: Shot) => [...new Set(shot.characters.map((c) => sb.cast.find((m) => m.id === c.castId)?.outfit).filter((x): x is ColorName => !!x))];
  const keyOf = (kind: Kind, prompt: string, colors: ColorName[]) => imageFileKey(kind, colors.length ? `${prompt} | ${colors.join(", ")}` : prompt, signatures[kind]);
  for (const shot of sb.shots) {
    const bg = shot.background;
    if (bg.prompt.trim() && !wanted.has(bgRef(bg)))
      wanted.set(bgRef(bg), { kind: "bg", prompt: bg.prompt.trim(), colors: bg.colors, avoid: outfitsOf(shot), key: keyOf("bg", bg.prompt.trim(), bg.colors) });
    for (const p of shot.props) if (p.prompt.trim()) wanted.set(imageRef("prop", p.prompt), { kind: "prop", prompt: p.prompt.trim(), colors: [], avoid: [], key: keyOf("prop", p.prompt.trim(), []) });
  }
  const dir = imageDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const images: Record<string, string> = {};
  const report: ImageReport = { generated: 0, reused: 0, skipped: [] };
  // Prompts a tool refused are not sent again until their wording (or the style) changes.
  const refusedFile = path.join(dir, "refused.json");
  const refused = new Set(readJsonSafe<string[]>(refusedFile) ?? []);
  const fileFor = (key: string) => ["jpg", "png"].map((ext) => `${key}.${ext}`).find((f) => fs.existsSync(path.join(dir, f)));
  const hasPrior = (ref: string) => !!sb.images[ref] && fs.existsSync(path.join(dir, path.basename(sb.images[ref])));

  // Backgrounds through Google's Batch API: one job at half price, before the props are drawn one by one.
  const batched = new Set<string>();
  if (toolFor("bg") === "gemini" && boolSetting("GEMINI_BATCH")) {
    const refs = styleRefs();
    const portrait = sb.meta.height >= sb.meta.width;
    const style = setting("FEDTOON_IMAGE_STYLE");
    const save = async (key: string, image: Buffer | null) => {
      if (!image) return void refused.add(key);
      writeFileAtomic(path.join(dir, `${key}.jpg`), (await fitToFrame(image, sb.meta.width, sb.meta.height)).data);
      batched.add(key);
    };
    const wait = (message: string) => onProgress(0, wanted.size, message);
    // A batch an earlier run already paid for is collected first, then whatever is still missing goes in a new one.
    if (hasSavedBatch(dir)) await drawInBatch(dir, [], refs, save, wait);
    const left: GeminiRequest[] = [...wanted]
      .filter(([ref, w]) => w.kind === "bg" && !hasPrior(ref) && !fileFor(w.key) && !refused.has(w.key))
      .map(([, w]) => ({ key: w.key, portrait, text: withRefsNote(fullPrompt("bg", w.prompt, style, portrait, w.colors, w.avoid), refs) }));
    if (left.length) await drawInBatch(dir, left, refs, save, wait);
    writeJsonAtomic(refusedFile, [...refused]);
  }

  let done = 0;
  let fatal: Error | null = null;
  await mapLimit([...wanted], 3, async ([ref, { kind, prompt, colors, avoid, key }]) => {
    if (fatal) return;
    const label = kind === "bg" ? "Nền" : "Đồ vật";
    // A picture this video already has for the same description is kept, even if the style or the
    // reference images changed since (continuing a job never pays twice; new descriptions use the new style).
    if (hasPrior(ref)) {
      images[ref] = sb.images[ref];
      report.reused++;
      onProgress(++done, wanted.size, `${label}: ${prompt.slice(0, 60)} (dùng lại)`);
      return;
    }
    const existing = fileFor(key);
    let file = existing;
    let note = "";
    if (!file && refused.has(key)) report.skipped.push(prompt);
    else if (!file) {
      try {
        const img = await generateImage(kind, prompt, sb.meta, colors, avoid);
        file = `${key}.${img.ext}`;
        note = img.note ?? "";
        writeFileAtomic(path.join(dir, file), img.data);
        report.generated++;
      } catch (e) {
        if (isPerImageRefusal(e)) {
          report.skipped.push(prompt);
          refused.add(key);
        } else fatal ??= new Error(explain(e));
      }
    } else if (batched.has(key)) report.generated++;
    else report.reused++;
    if (file) images[ref] = `img/${id}/${file}`;
    const status = existing ? (batched.has(key) ? " (vẽ theo lô)" : " (dùng lại)") : file ? note : " (bị từ chối, dùng hình vẽ sẵn)";
    onProgress(++done, wanted.size, `${label}: ${prompt.slice(0, 60)}${status}`);
  });
  writeJsonAtomic(refusedFile, [...refused]);
  // Images already made are kept even when a later one fails: continuing the job won't pay for them again.
  if (fatal) throw fatal;
  // Pictures no shot uses right now stay listed: the scene editor can put them back for free.
  return { storyboard: { ...sb, images: { ...sb.images, ...images } }, report };
}
