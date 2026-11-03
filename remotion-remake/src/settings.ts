// Every configurable API parameter of the app (besides the keys themselves).
// Values live in .env; they are read when used, so a change saved from the
// "⚙️ Cài đặt" tab applies at once without restarting the app.
import { setEnvValue } from "./env";

export type SettingType = "secret" | "text" | "number" | "select" | "boolean";

export type Setting = {
  /** Name of the line in .env. */
  key: string;
  group: string;
  label: string;
  help: string;
  type: SettingType;
  default: string;
  /** select: allowed values. text: suggestions shown in a list. */
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  /** Takes effect only after the app is restarted. */
  restart?: boolean;
};

export const SETTING_GROUPS: { id: string; title: string; help: string; link?: string }[] = [
  { id: "claude", title: "Claude (Anthropic)", help: "Phân tích video và soạn thông tin đăng khi công tắc AI ở Claude.", link: "https://platform.claude.com" },
  { id: "openai", title: "OpenAI", help: "Phân tích video và soạn thông tin đăng khi công tắc AI ở OpenAI.", link: "https://platform.openai.com" },
  { id: "elevenlabs", title: "ElevenLabs (lồng tiếng)", help: "Đọc lời thoại của video dựng lại. Bấm \"Tải giọng & model từ tài khoản\" để chọn giọng.", link: "https://elevenlabs.io/app/settings/api-keys" },
  { id: "youtube", title: "YouTube Data API v3", help: "Tab Tìm video hot (miễn phí 10.000 đơn vị quota mỗi ngày).", link: "https://console.cloud.google.com/apis/library/youtube.googleapis.com" },
  { id: "channel", title: "Kênh của bạn", help: "Dùng khi AI soạn thông tin đăng." },
  { id: "app", title: "Ứng dụng", help: "" },
];

const EFFORTS_CLAUDE = [
  { value: "low", label: "low — nhanh, rẻ nhất" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high — kỹ" },
  { value: "xhigh", label: "xhigh — rất kỹ" },
  { value: "max", label: "max — kỹ nhất, tốn nhất" },
];
const EFFORTS_OPENAI = [
  { value: "none", label: "none — không suy luận" },
  { value: "minimal", label: "minimal" },
  { value: "low", label: "low — nhanh, rẻ" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high — kỹ" },
  { value: "xhigh", label: "xhigh — rất kỹ" },
];
const opts = (...values: string[]) => values.map((value) => ({ value, label: value }));

export const SETTINGS: Setting[] = [
  // Claude
  { key: "ANTHROPIC_API_KEY", group: "claude", label: "API key", help: "Khóa Claude API (sk-ant-…).", type: "secret", default: "" },
  {
    key: "CLAUDE_MODEL",
    group: "claude",
    label: "Model",
    help: "Model dùng cho mọi tác vụ Claude.",
    type: "text",
    default: "claude-opus-5-5",
    options: [
      { value: "claude-opus-5-5", label: "claude-opus-5-5 — Opus 5.5, tốt nhất" },
      { value: "claude-sonnet-5-5", label: "claude-sonnet-5-5 — Sonnet 5.5, rẻ hơn" },
      { value: "claude-haiku-5-5", label: "claude-haiku-5-5 — Haiku 5.5, nhanh và rẻ nhất" },
      { value: "claude-fable-5-1", label: "claude-fable-5-1 — Fable 5.1" },
    ],
  },
  { key: "CLAUDE_EFFORT", group: "claude", label: "Mức suy nghĩ khi phân tích video", help: "Càng cao càng kỹ nhưng chậm và tốn token hơn.", type: "select", default: "high", options: EFFORTS_CLAUDE },
  { key: "CLAUDE_POST_EFFORT", group: "claude", label: "Mức suy nghĩ khi soạn thông tin đăng", help: "Việc viết lại tiêu đề/mô tả đơn giản, low là đủ.", type: "select", default: "low", options: EFFORTS_CLAUDE },
  { key: "CLAUDE_MAX_TOKENS", group: "claude", label: "Số token trả lời tối đa (max_tokens)", help: "Gồm cả phần suy nghĩ. Kịch bản video dài cần nhiều hơn.", type: "number", default: "64000", min: 4000, max: 128000, step: 1000 },

  // OpenAI
  { key: "OPENAI_API_KEY", group: "openai", label: "API key", help: "Khóa OpenAI API (sk-…).", type: "secret", default: "" },
  {
    key: "OPENAI_MODEL",
    group: "openai",
    label: "Model",
    help: "Model dùng cho mọi tác vụ OpenAI. Danh sách model: platform.openai.com/docs/models.",
    type: "text",
    default: "gpt-5.5",
    options: opts("gpt-5.5"),
  },
  { key: "OPENAI_REASONING_EFFORT", group: "openai", label: "Mức suy luận khi phân tích video (reasoning.effort)", help: "", type: "select", default: "high", options: EFFORTS_OPENAI },
  { key: "OPENAI_POST_REASONING_EFFORT", group: "openai", label: "Mức suy luận khi soạn thông tin đăng", help: "", type: "select", default: "low", options: EFFORTS_OPENAI },
  { key: "OPENAI_MAX_OUTPUT_TOKENS", group: "openai", label: "Số token trả lời tối đa (max_output_tokens)", help: "", type: "number", default: "64000", min: 4000, max: 128000, step: 1000 },

  // ElevenLabs
  { key: "ELEVENLABS_API_KEY", group: "elevenlabs", label: "API key", help: "Khóa ElevenLabs (xi-api-key).", type: "secret", default: "" },
  { key: "ELEVENLABS_VOICE_ID", group: "elevenlabs", label: "Voice ID (giọng đọc)", help: "Mã giọng, ví dụ 21m00Tcm4TlvDq8ikWAM. Chọn từ danh sách sau khi bấm \"Tải giọng & model\".", type: "text", default: "" },
  {
    key: "ELEVENLABS_MODEL_ID",
    group: "elevenlabs",
    label: "Model (model_id)",
    help: "Tiếng Việt: dùng eleven_v3, eleven_flash_v2_5 hoặc eleven_turbo_v2_5 (eleven_multilingual_v2 không có tiếng Việt). Danh sách đầy đủ theo tài khoản: bấm \"Tải giọng & model\".",
    type: "text",
    default: "eleven_v3",
    options: [
      { value: "eleven_v3", label: "eleven_v3 — biểu cảm nhất, có tiếng Việt" },
      { value: "eleven_flash_v2_5", label: "eleven_flash_v2_5 — nhanh, rẻ hơn, có tiếng Việt" },
      { value: "eleven_turbo_v2_5", label: "eleven_turbo_v2_5 — nhanh, có tiếng Việt" },
      { value: "eleven_multilingual_v2", label: "eleven_multilingual_v2 — 29 ngôn ngữ, không có tiếng Việt" },
      { value: "eleven_v4", label: "eleven_v4" },
      { value: "eleven_v4_turbo", label: "eleven_v4_turbo" },
    ],
  },
  { key: "ELEVENLABS_LANGUAGE_CODE", group: "elevenlabs", label: "Ngôn ngữ (language_code)", help: "Mã ISO 639-1, ví dụ vi, en. Để trống = theo ngôn ngữ của video.", type: "text", default: "" },
  { key: "ELEVENLABS_STABILITY", group: "elevenlabs", label: "Độ ổn định (stability)", help: "0–1. Thấp = cảm xúc rộng hơn, cao = đều giọng. Với eleven_v3 nên chọn 0 (sáng tạo), 0.5 (tự nhiên) hoặc 1 (ổn định).", type: "number", default: "0.5", min: 0, max: 1, step: 0.05 },
  { key: "ELEVENLABS_SIMILARITY_BOOST", group: "elevenlabs", label: "Độ giống giọng gốc (similarity_boost)", help: "0–1.", type: "number", default: "0.75", min: 0, max: 1, step: 0.05 },
  { key: "ELEVENLABS_STYLE", group: "elevenlabs", label: "Phóng đại phong cách (style)", help: "0–1. Khác 0 thì chậm hơn một chút.", type: "number", default: "0", min: 0, max: 1, step: 0.05 },
  { key: "ELEVENLABS_SPEAKER_BOOST", group: "elevenlabs", label: "Tăng độ giống người nói (use_speaker_boost)", help: "", type: "boolean", default: "true" },
  { key: "ELEVENLABS_SPEED", group: "elevenlabs", label: "Tốc độ đọc (speed)", help: "0.7–1.2, 1 là bình thường.", type: "number", default: "1", min: 0.7, max: 1.2, step: 0.05 },
  {
    key: "ELEVENLABS_OUTPUT_FORMAT",
    group: "elevenlabs",
    label: "Định dạng âm thanh (output_format)",
    help: "mp3 192 kbps cần gói Creator trở lên; WAV 44.1 kHz cần gói Pro trở lên.",
    type: "select",
    default: "mp3_44100_128",
    options: [
      { value: "mp3_44100_128", label: "mp3_44100_128 (mặc định)" },
      { value: "mp3_44100_192", label: "mp3_44100_192 (Creator+)" },
      { value: "mp3_44100_96", label: "mp3_44100_96" },
      { value: "mp3_44100_64", label: "mp3_44100_64" },
      { value: "wav_44100", label: "wav_44100 (Pro+)" },
    ],
  },
  { key: "ELEVENLABS_TEXT_NORMALIZATION", group: "elevenlabs", label: "Chuẩn hoá chữ số, ngày tháng (apply_text_normalization)", help: "auto: tự quyết; on: luôn đọc số thành chữ; off: không.", type: "select", default: "auto", options: opts("auto", "on", "off") },
  { key: "ELEVENLABS_SEED", group: "elevenlabs", label: "Seed", help: "Số nguyên 0–4294967295 để các lần tạo giống nhau hơn. Để trống = ngẫu nhiên.", type: "number", default: "", min: 0, max: 4294967295, step: 1 },

  // YouTube
  { key: "YOUTUBE_API_KEY", group: "youtube", label: "API key", help: "Khóa YouTube Data API v3 (AIza…).", type: "secret", default: "" },

  // Channel
  { key: "CHANNEL_NAME", group: "channel", label: "Tên kênh", help: "Thêm vào tiêu đề/mô tả, hashtag và keywords khi soạn thông tin đăng.", type: "text", default: "Fedtoon" },

  // App
  { key: "PORT", group: "app", label: "Cổng giao diện web", help: "Cần khởi động lại app.", type: "number", default: "3210", min: 1024, max: 65535, step: 1, restart: true },
];

const byKey = new Map(SETTINGS.map((s) => [s.key, s]));

/** Current value: .env / environment, else the default. */
export function setting(key: string): string {
  const def = byKey.get(key);
  if (!def) throw new Error(`Unknown setting ${key}`);
  return process.env[key]?.trim() || def.default;
}
export const numberSetting = (key: string) => Number(setting(key));
export const boolSetting = (key: string) => setting(key) === "true";
export const optionalNumberSetting = (key: string) => (setting(key) === "" ? undefined : Number(setting(key)));

/** Settings for the page. Secrets are never sent back, only whether they are set and their last 4 characters. */
export function publicSettings() {
  return {
    groups: SETTING_GROUPS,
    settings: SETTINGS.map((s) => {
      const raw = process.env[s.key]?.trim() ?? "";
      return s.type === "secret"
        ? { ...s, value: "", isSet: !!raw, hint: raw ? `…${raw.slice(-4)}` : "" }
        : { ...s, value: setting(s.key), isSet: !!raw, hint: "" };
    }),
  };
}

function validate(s: Setting, value: string): string | null {
  if (/[\r\n]/.test(value) || value.length > 300) return "giá trị không hợp lệ";
  if (value === "") return null;
  if (s.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "phải là số";
    if (s.min !== undefined && n < s.min) return `nhỏ nhất là ${s.min}`;
    if (s.max !== undefined && n > s.max) return `lớn nhất là ${s.max}`;
  }
  if (s.type === "select" && !s.options?.some((o) => o.value === value)) return "giá trị không có trong danh sách";
  if (s.type === "boolean" && value !== "true" && value !== "false") return "phải là true hoặc false";
  return null;
}

/**
 * Saves the given values to .env. An empty secret keeps the current key; an
 * empty other value goes back to the default. Returns how many values changed.
 */
export function saveSettings(raw: unknown): number {
  const values = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const changes: [string, string][] = [];
  for (const [key, v] of Object.entries(values)) {
    const s = byKey.get(key);
    if (!s) continue;
    const value = typeof v === "boolean" ? String(v) : typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
    if (s.type === "secret" && value === "") continue;
    const error = validate(s, value);
    if (error) errors.push(`${s.label} (${SETTING_GROUPS.find((g) => g.id === s.group)?.title}): ${error}`);
    else {
      const current = process.env[key]?.trim() ?? "";
      // A field still showing its default is not a change (keeps .env free of default values).
      if (value !== current && !(current === "" && value === s.default)) changes.push([key, value]);
    }
  }
  if (errors.length) throw new Error(errors.join("; "));
  for (const [key, value] of changes) setEnvValue(key, value);
  return changes.length;
}
