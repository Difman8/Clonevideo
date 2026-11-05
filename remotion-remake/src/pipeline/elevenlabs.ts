// ElevenLabs text-to-speech (REST API v1, header xi-api-key). Every parameter
// comes from the "⚙️ Cài đặt" tab / .env (see src/settings.ts).
import fs from "node:fs";
import { boolSetting, numberSetting, optionalNumberSetting, setting } from "../settings";
import { ffmpegPath, run } from "./tools";

const API = "https://api.elevenlabs.io";

export const elevenLabsKey = () => process.env.ELEVENLABS_API_KEY?.trim() ?? "";
export const hasElevenLabsKey = () => !!elevenLabsKey();

export type TtsOptions = {
  voiceId: string;
  modelId: string;
  /** ISO 639-1, "" = let the model decide. */
  languageCode: string;
  outputFormat: string;
  voiceSettings: { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean; speed: number };
  textNormalization: "auto" | "on" | "off";
  seed?: number;
};

/** Options from the settings; the video's language is used when no language code is set. */
export function ttsOptions(videoLanguage = ""): TtsOptions {
  return {
    voiceId: setting("ELEVENLABS_VOICE_ID"),
    modelId: setting("ELEVENLABS_MODEL_ID"),
    languageCode: setting("ELEVENLABS_LANGUAGE_CODE") || videoLanguage.split("-")[0].toLowerCase(),
    outputFormat: setting("ELEVENLABS_OUTPUT_FORMAT"),
    voiceSettings: {
      stability: numberSetting("ELEVENLABS_STABILITY"),
      similarity_boost: numberSetting("ELEVENLABS_SIMILARITY_BOOST"),
      style: numberSetting("ELEVENLABS_STYLE"),
      use_speaker_boost: boolSetting("ELEVENLABS_SPEAKER_BOOST"),
      speed: numberSetting("ELEVENLABS_SPEED"),
    },
    textNormalization: setting("ELEVENLABS_TEXT_NORMALIZATION") as TtsOptions["textNormalization"],
    seed: optionalNumberSetting("ELEVENLABS_SEED"),
  };
}

type ErrorBody = { detail?: { status?: string; code?: string; message?: string } | { msg?: string; loc?: unknown[] }[] | string };

/** Turns an API error into a message the user can act on. */
function explain(status: number, body: ErrorBody): string {
  const d = body.detail;
  const code = d && !Array.isArray(d) && typeof d === "object" ? (d.status ?? d.code ?? "") : "";
  const message = Array.isArray(d) ? d.map((x) => x.msg).join("; ") : typeof d === "string" ? d : (d?.message ?? "");
  if (status === 401 || code.includes("invalid_api_key")) return "ELEVENLABS_API_KEY không hợp lệ hoặc thiếu quyền Text to Speech.";
  if (code.includes("quota_exceeded") || code.includes("insufficient")) return `Tài khoản ElevenLabs đã hết ký tự (credits) của gói hiện tại. ${message}`.trim();
  if (code.includes("voice_not_found") || (status === 404 && /voice/i.test(message))) return "Không tìm thấy Voice ID này trong tài khoản ElevenLabs. Chọn lại giọng ở tab Cài đặt.";
  if (status === 429) return "ElevenLabs đang giới hạn số yêu cầu cùng lúc; thử lại sau ít phút.";
  return `ElevenLabs báo lỗi ${status}${message ? `: ${message}` : ""}`;
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const key = elevenLabsKey();
  if (!key) throw new Error("Chưa có ELEVENLABS_API_KEY. Dán khóa ở tab ⚙️ Cài đặt.");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { "xi-api-key": key, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw new Error(`Không kết nối được tới ElevenLabs: ${(e as Error).message}`);
  }
  if (!res.ok) throw Object.assign(new Error(explain(res.status, (await res.json().catch(() => ({}))) as ErrorBody)), { status: res.status });
  return res;
}

export type Alignment = { characters: string[]; starts: number[]; ends: number[] };
export type Speech = { audio: Buffer; ext: "mp3" | "wav" | "opus"; alignment: Alignment | null };

const extOf = (format: string): Speech["ext"] => (format.startsWith("wav") ? "wav" : format.startsWith("opus") ? "opus" : "mp3");

/** Models that reject previous_text / next_text ("not yet supported with the 'eleven_v3' model"). */
const noContextModel = (modelId: string) => /^eleven_v3/i.test(modelId);

/** Optional fields that can be dropped when a model rejects them, in the order they are dropped. */
const OPTIONAL_FIELDS = ["previous_text", "next_text", "language_code", "seed", "apply_text_normalization"] as const;

/** The optional fields an API error is about ("Providing previous_text or next_text is not yet supported…"). */
const rejectedFields = (message: string, body: Record<string, unknown>) => OPTIONAL_FIELDS.filter((f) => f in body && message.includes(f));

/**
 * Text to speech. Uses the /with-timestamps endpoint (character timings, for
 * syncing captions); if the chosen model rejects it, falls back to the plain endpoint.
 * Context (previous/next sentence) is only sent to models that accept it, and an
 * optional field the model rejects is dropped and the request sent again.
 */
export async function synthesize(text: string, o: TtsOptions, context: { previousText?: string; nextText?: string } = {}): Promise<Speech> {
  if (!o.voiceId) throw new Error("Chưa chọn giọng đọc (ELEVENLABS_VOICE_ID). Chọn ở tab ⚙️ Cài đặt.");
  const withContext = !noContextModel(o.modelId);
  const body: Record<string, unknown> = {
    text,
    model_id: o.modelId,
    ...(o.languageCode ? { language_code: o.languageCode } : {}),
    voice_settings: o.voiceSettings,
    apply_text_normalization: o.textNormalization,
    ...(o.seed !== undefined ? { seed: o.seed } : {}),
    ...(withContext && context.previousText ? { previous_text: context.previousText } : {}),
    ...(withContext && context.nextText ? { next_text: context.nextText } : {}),
  };
  const query = `?output_format=${encodeURIComponent(o.outputFormat)}`;
  const voice = encodeURIComponent(o.voiceId);
  for (let attempt = 0; ; attempt++) {
    try {
      return await request(voice, query, JSON.stringify(body), o);
    } catch (e) {
      const status = (e as { status?: number }).status;
      const drop = status === 400 || status === 422 ? rejectedFields((e as Error).message, body) : [];
      if (!drop.length || attempt >= OPTIONAL_FIELDS.length) throw e;
      for (const f of drop) delete body[f];
    }
  }
}

async function request(voice: string, query: string, body: string, o: TtsOptions): Promise<Speech> {
  try {
    const res = await api(`/v1/text-to-speech/${voice}/with-timestamps${query}`, { method: "POST", body });
    const json = (await res.json()) as {
      audio_base64: string;
      alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null;
    };
    const a = json.alignment;
    return {
      audio: Buffer.from(json.audio_base64, "base64"),
      ext: extOf(o.outputFormat),
      alignment: a ? { characters: a.characters, starts: a.character_start_times_seconds, ends: a.character_end_times_seconds } : null,
    };
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== 400 && status !== 404 && status !== 422) throw e;
    // A rejected parameter is not a reason to switch endpoints: let synthesize() drop it.
    if (OPTIONAL_FIELDS.some((f) => (e as Error).message.includes(f))) throw e;
    const res = await api(`/v1/text-to-speech/${voice}${query}`, { method: "POST", body, headers: { Accept: "audio/*" } });
    return { audio: Buffer.from(await res.arrayBuffer()), ext: extOf(o.outputFormat), alignment: null };
  }
}

/** Real length of an audio file, read by ffmpeg. */
export async function audioDuration(file: string): Promise<number> {
  const { stderr } = await run(ffmpegPath(), ["-hide_banner", "-i", file, "-f", "null", "-"]);
  const times = [...stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const m = times.at(-1) ?? stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`Không đọc được thời lượng của ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export type VoiceInfo = { id: string; name: string; category: string; labels: Record<string, string>; previewUrl: string };
export type ModelInfo = { id: string; name: string; languages: string[]; maxChars: number | null };

/** Voices, text-to-speech models and remaining characters of the account (for the settings tab). */
export async function catalog(): Promise<{ voices: VoiceInfo[]; models: ModelInfo[]; characters: { used: number; limit: number; tier: string; resetsAt: string } | null }> {
  const [voices, models, sub] = await Promise.all([
    api("/v1/voices").then((r) => r.json() as Promise<{ voices: { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string }[] }>),
    api("/v1/models").then(
      (r) =>
        r.json() as Promise<{ model_id: string; name: string; can_do_text_to_speech?: boolean; languages?: { language_id: string }[]; max_characters_request_subscribed_user?: number }[]>,
    ),
    api("/v1/user/subscription")
      .then((r) => r.json() as Promise<{ character_count: number; character_limit: number; tier: string; next_character_count_reset_unix?: number }>)
      .catch(() => null),
  ]);
  return {
    voices: voices.voices.map((v) => ({ id: v.voice_id, name: v.name, category: v.category ?? "", labels: v.labels ?? {}, previewUrl: v.preview_url ?? "" })),
    models: models
      .filter((m) => m.can_do_text_to_speech !== false)
      .map((m) => ({ id: m.model_id, name: m.name, languages: (m.languages ?? []).map((l) => l.language_id), maxChars: m.max_characters_request_subscribed_user ?? null })),
    characters: sub
      ? {
          used: sub.character_count,
          limit: sub.character_limit,
          tier: sub.tier,
          resetsAt: sub.next_character_count_reset_unix ? new Date(sub.next_character_count_reset_unix * 1000).toISOString() : "",
        }
      : null,
  };
}

/** A short sample with the current settings, for the "Nghe thử" button. */
export async function previewVoice(text: string): Promise<Speech> {
  return synthesize(text.slice(0, 300), ttsOptions());
}

export const writeSpeech = (file: string, s: Speech) => fs.writeFileSync(file, s.audio);
