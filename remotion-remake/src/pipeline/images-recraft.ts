// Props drawn by Recraft and cut out by its background remover (Recraft cannot paint a
// transparent background itself). Recraft has no batch API: every call is synchronous.
import fs from "node:fs";
import path from "node:path";
import { setting } from "../settings";
import { OUT_DIR, readJsonSafe, writeJsonAtomic } from "./tools";

const API = "https://external.api.recraft.ai/v1";
/** Style ids Recraft made from the style references, per model and set of references. */
const STYLES_FILE = path.join(OUT_DIR, "_images", "recraft-styles.json");

export const hasRecraftKey = () => !!process.env.RECRAFT_API_KEY?.trim();

export class RecraftError extends Error {
  constructor(
    message: string,
    readonly refused = false,
  ) {
    super(message);
  }
}

type Item = { b64_json?: string; url?: string };

async function call(endpoint: string, body: FormData | Record<string, unknown>): Promise<Record<string, unknown>> {
  const json = !(body instanceof FormData);
  const res = await fetch(`${API}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RECRAFT_API_KEY?.trim()}`, ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(body) : body,
    signal: AbortSignal.timeout(180_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return data;
  const detail = String(data.message ?? data.detail ?? (data.error as { message?: string })?.message ?? data.code ?? "");
  if (res.status === 401 || res.status === 403) throw new RecraftError("RECRAFT_API_KEY không hợp lệ.");
  if (res.status === 402 || /credit|balance|units/i.test(detail)) throw new RecraftError("Tài khoản Recraft đã hết API units: nạp thêm ở recraft.ai (mục API).");
  if (res.status === 429) throw new RecraftError("Recraft đang giới hạn số yêu cầu; thử lại sau ít phút.");
  if (res.status === 400 && /nsfw|moderat|inappropriate|safety|prohibited|policy/i.test(detail)) throw new RecraftError(`Recraft từ chối vẽ ảnh này: ${detail}`, true);
  throw new RecraftError(`Recraft báo lỗi ${res.status}${detail ? `: ${detail}` : ""}`);
}

async function bytesOf(item: Item | undefined): Promise<Buffer> {
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return Buffer.from(await (await fetch(item.url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer());
  throw new RecraftError("Recraft không trả về ảnh.");
}

const fileBlob = (file: string) => new Blob([new Uint8Array(fs.readFileSync(file))], { type: /\.png$/i.test(file) ? "image/png" : /\.webp$/i.test(file) ? "image/webp" : "image/jpeg" });

/** Style requests in flight, so props drawn in parallel share one new style instead of each making one. */
const pendingStyles = new Map<string, Promise<{ data: Buffer; styleId?: string }>>();

async function generate(text: string, refs: string[], signature: string): Promise<Buffer> {
  const model = setting("RECRAFT_MODEL");
  const base = { prompt: text, model, size: "1:1", response_format: "b64_json", image_format: "png" };
  const styles = readJsonSafe<Record<string, string>>(STYLES_FILE) ?? {};
  const known = styles[signature] ?? (await pendingStyles.get(signature)?.then((r) => r.styleId).catch(() => undefined));
  if (known || !refs.length) return bytesOf(((await call("/images/generations", known ? { ...base, style_id: known } : base)).data as Item[])?.[0]);

  // First prop of this style: the references go along once, Recraft makes a style from them and returns its id.
  const first = (async () => {
    const form = new FormData();
    for (const [k, v] of Object.entries(base)) form.append(k, v);
    for (const f of refs) form.append("style_references", fileBlob(f), path.basename(f));
    const out = await call("/images/generations", form);
    const styleId = typeof out.style_id === "string" ? out.style_id : undefined;
    if (styleId) {
      fs.mkdirSync(path.dirname(STYLES_FILE), { recursive: true });
      writeJsonAtomic(STYLES_FILE, { ...(readJsonSafe<Record<string, string>>(STYLES_FILE) ?? {}), [signature]: styleId });
    }
    return { data: await bytesOf((out.data as Item[])?.[0]), styleId };
  })();
  pendingStyles.set(signature, first);
  try {
    return (await first).data;
  } finally {
    pendingStyles.delete(signature);
  }
}

/** One prop: drawn on a plain background, then cut out to a transparent PNG. */
export async function drawRecraft(text: string, refs: string[], signature: string): Promise<Buffer> {
  const drawn = await generate(text, refs, signature);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(drawn)], { type: "image/png" }), "prop.png");
  form.append("response_format", "b64_json");
  form.append("image_format", "png");
  const out = await call("/images/removeBackground", form);
  return bytesOf((out.image as Item) ?? (out.data as Item[])?.[0]);
}
