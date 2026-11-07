// Every configurable API parameter of the app (besides the keys themselves).
// Values live in .env; they are read when used, so a change saved from the
// "⚙️ Cài đặt" tab applies at once without restarting the app.
import { commentedEnvValues, refreshEnv, setEnvValue } from "./env";
import { DEFAULT_IMAGE_STYLE } from "./fedtoon/brand";

export type SettingType = "secret" | "text" | "textarea" | "number" | "select" | "boolean";

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
  /** Longest accepted value (default 300 characters). */
  maxLength?: number;
  /** Takes effect only after the app is restarted. */
  restart?: boolean;
};

export const SETTING_GROUPS: { id: string; title: string; help: string; link?: string }[] = [
  { id: "claude", title: "Claude (Anthropic)", help: "Phân tích video và soạn thông tin đăng khi công tắc AI ở Claude.", link: "https://platform.claude.com" },
  { id: "openai", title: "OpenAI", help: "Phân tích video và soạn thông tin đăng khi công tắc AI ở OpenAI.", link: "https://platform.openai.com" },
  { id: "images", title: "Hình ảnh Fedtoon", help: "Chọn công cụ vẽ nền và đồ vật bên dưới (mặc định OpenAI, dùng khóa OpenAI ở trên). Vẽ nền và đồ vật cho kiểu video Hoạt hình Fedtoon, dùng khóa OpenAI ở trên. Mỗi ảnh tạo một lần rồi được lưu lại.", link: "https://platform.openai.com/usage" },
  { id: "gemini", title: "Google Gemini (Nano Banana)", help: "Vẽ ảnh nền khi chọn Google ở mục Hình ảnh Fedtoon. Model ảnh của Google không có gói miễn phí: cần bật thanh toán cho dự án của khóa.", link: "https://aistudio.google.com/apikey" },
  { id: "recraft", title: "Recraft", help: "Vẽ đồ vật khi chọn Recraft ở mục Hình ảnh Fedtoon. Trả trước bằng API units ($1 = 1.000 units).", link: "https://www.recraft.ai/profile/api" },
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
  { key: "CLAUDE_ANALYZE_EFFORT", group: "claude", label: "Mức suy nghĩ khi phân tích video", help: "Càng cao càng kỹ nhưng chậm và tốn token hơn.", type: "select", default: "high", options: EFFORTS_CLAUDE },
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

  // Images
  {
    key: "IMAGE_BG_PROVIDER",
    group: "images",
    label: "Công cụ vẽ ảnh nền",
    help: "Google Nano Banana vẽ ảnh nền rẻ hơn nhiều và bật được chế độ vẽ theo lô (Batch) giảm thêm 50%. Cần khóa ở mục Google Gemini.",
    type: "select",
    default: "openai",
    options: [
      { value: "openai", label: "OpenAI (gpt-image)" },
      { value: "gemini", label: "Google Nano Banana" },
    ],
  },
  {
    key: "IMAGE_PROP_PROVIDER",
    group: "images",
    label: "Công cụ vẽ đồ vật",
    help: "Recraft vẽ đồ vật rồi tách nền thành ảnh trong suốt (2 lần gọi cho mỗi đồ vật). Cần khóa ở mục Recraft.",
    type: "select",
    default: "openai",
    options: [
      { value: "openai", label: "OpenAI (gpt-image)" },
      { value: "recraft", label: "Recraft" },
    ],
  },
  {
    key: "OPENAI_IMAGE_MODEL",
    group: "images",
    label: "Model tạo ảnh",
    help: "gpt-image-1 đã ngừng từ 23/10/2026. Các model gpt-image-2 trở lên tạo được ảnh đúng tỉ lệ 9:16.",
    type: "text",
    default: "gpt-image-2.5-sunburst",
    options: opts("gpt-image-2.5-sunburst", "gpt-image-2.5-flare", "gpt-image-2", "gpt-image-1.5", "gpt-image-1-mini", "chatgpt-image-latest"),
  },
  { key: "OPENAI_IMAGE_QUALITY", group: "images", label: "Chất lượng ảnh (quality)", help: "Càng cao càng đẹp và càng tốn tiền. xhigh/max chỉ có ở gpt-image-2.5.", type: "select", default: "medium", options: opts("low", "medium", "high", "xhigh", "max", "auto") },
  {
    key: "OPENAI_IMAGE_BG_SIZE",
    group: "images",
    label: "Kích thước ảnh nền",
    help: "Cạnh dài x cạnh ngắn, tự xoay theo video dọc hoặc ngang. Ảnh càng lớn càng nét và càng tốn tiền. Mỗi cạnh phải chia hết cho 16 nên Full HD là 1920x1088 (dư 8px được cắt khi dựng). Chỉ áp dụng cho model gpt-image-2 trở lên và cho ảnh vẽ mới.",
    type: "select",
    default: "1920x1088",
    options: [
      { value: "1536x864", label: "1536×864 (nhỏ, rẻ nhất, hơi mờ ở video 1080p)" },
      { value: "1920x1088", label: "1920×1088 (Full HD)" },
      { value: "2560x1440", label: "2560×1440 (2K, nét cả khi máy quay zoom)" },
    ],
  },
  {
    key: "OPENAI_IMAGE_STYLE_REFS",
    group: "images",
    label: "Vẽ theo ảnh mẫu phong cách (mọi công cụ)",
    help: "Gửi kèm ảnh trong thư mục remotion-remake/assets/style/ (mặc định: bảng nhân vật Fedtoon) để nền và đồ vật cùng nét vẽ với nhân vật. Mỗi lần vẽ tốn thêm một ít tiền cho ảnh đầu vào. Có thể thêm ảnh của bạn vào thư mục đó (tối đa 8 ảnh).",
    type: "boolean",
    default: "true",
  },
  { key: "OPENAI_IMAGE_MODERATION", group: "images", label: "Mức kiểm duyệt (moderation)", help: "auto: mặc định của OpenAI; low: ít chặn hơn. Chỉ áp dụng khi tắt \"Vẽ theo ảnh mẫu phong cách\" (cách vẽ có ảnh mẫu không có tuỳ chọn này).", type: "select", default: "auto", options: opts("auto", "low") },
  {
    key: "FEDTOON_IMAGE_STYLE",
    group: "images",
    label: "Mô tả phong cách hình ảnh",
    help: "Được thêm vào đầu mọi yêu cầu vẽ (tiếng Anh cho kết quả tốt nhất). Đổi ở đây để chỉnh \"chất\" Fedtoon; ảnh đã tạo theo phong cách cũ vẫn được giữ.",
    type: "textarea",
    default: DEFAULT_IMAGE_STYLE,
    maxLength: 2000,
  },

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
  { key: "GEMINI_API_KEY", group: "gemini", label: "API key", help: "Khóa Gemini API (AIza…), tạo ở Google AI Studio.", type: "secret", default: "" },
  {
    key: "GEMINI_IMAGE_MODEL",
    group: "gemini",
    label: "Model vẽ ảnh",
    help: "Nano Banana 2.1 là model ảnh nhanh và rẻ nhất có ảnh 2K của Google.",
    type: "text",
    default: "gemini-nano-banana-2.1",
    options: opts("gemini-nano-banana-2.1", "gemini-3.1-flash-image", "gemini-3-pro-image"),
  },
  {
    key: "GEMINI_IMAGE_SIZE",
    group: "gemini",
    label: "Cỡ ảnh nền",
    help: "Google vẽ ở cỡ này rồi app thu về đúng khung video (1080x1920). 2K đủ nét cho video Full HD.",
    type: "select",
    default: "2K",
    options: [
      { value: "1K", label: "1K (rẻ nhất, hơi mờ ở video 1080p)" },
      { value: "2K", label: "2K (nét cho video Full HD)" },
      { value: "4K", label: "4K (đắt nhất)" },
    ],
  },
  {
    key: "GEMINI_BATCH",
    group: "gemini",
    label: "Vẽ ảnh nền theo lô (Batch API, rẻ hơn 50%)",
    help: "Gửi cả loạt ảnh nền của video trong một lần. Google trả kết quả trong tối đa 24 giờ, thường vài phút. Có thể đóng app rồi bấm Tiếp tục sau để lấy ảnh, không bị tính tiền lần nữa.",
    type: "boolean",
    default: "false",
  },
  { key: "RECRAFT_API_KEY", group: "recraft", label: "API key", help: "Khóa Recraft API, tạo ở recraft.ai (mục API).", type: "secret", default: "" },
  {
    key: "RECRAFT_MODEL",
    group: "recraft",
    label: "Model vẽ đồ vật",
    help: "recraftv4_1: $0.035 mỗi ảnh, cộng $0.01 tách nền. Model Flash rẻ hơn nhưng không vẽ được theo phong cách của kênh nên không dùng ở đây.",
    type: "text",
    default: "recraftv4_1",
    options: opts("recraftv4_1", "recraftv4_1_utility"),
  },
  { key: "YOUTUBE_API_KEY", group: "youtube", label: "API key", help: "Khóa YouTube Data API v3 (AIza…).", type: "secret", default: "" },

  // Channel
  { key: "CHANNEL_NAME", group: "channel", label: "Tên kênh", help: "Thêm vào tiêu đề/mô tả, hashtag và keywords khi soạn thông tin đăng.", type: "text", default: "Fedtoon" },

  // App
  { key: "PORT", group: "app", label: "Cổng giao diện web", help: "Cần khởi động lại app.", type: "number", default: "3210", min: 1024, max: 65535, step: 1, restart: true },
];

const byKey = new Map(SETTINGS.map((s) => [s.key, s]));

/** Current value: .env / environment, else the default. A hand edit of .env applies at once. */
export function setting(key: string): string {
  const def = byKey.get(key);
  if (!def) throw new Error(`Unknown setting ${key}`);
  refreshEnv();
  return process.env[key]?.trim() || def.default;
}

/**
 * A value typed on a line of .env that still starts with # (so it has no effect),
 * when it differs from the value in use. Secrets are reported without their value.
 */
function commentedValue(s: Setting, commented: Record<string, string>): string {
  const v = commented[s.key]?.trim() ?? "";
  if (!v || v === s.default) return "";
  if (s.type === "secret") return process.env[s.key]?.trim() ? "" : "(khóa)";
  return v === setting(s.key) ? "" : v;
}

/** Warnings for .env lines that were edited but still start with # (one per setting). */
export function commentedSettingWarnings(keys?: string[]): string[] {
  const commented = commentedEnvValues();
  return SETTINGS.filter((s) => !keys || keys.includes(s.key)).flatMap((s) => {
    const v = commentedValue(s, commented);
    if (!v) return [];
    const shown = s.type === "secret" ? s.key : `${s.key}=${v}`;
    return [`⚠ Dòng "# ${shown}" trong file .env còn dấu # ở đầu nên chưa có tác dụng; app đang dùng ${s.type === "secret" ? "khóa trống" : setting(s.key)}. Xoá dấu # hoặc đặt lại ở tab ⚙️ Cài đặt.`];
  });
}
export const numberSetting = (key: string) => Number(setting(key));
export const boolSetting = (key: string) => setting(key) === "true";
export const optionalNumberSetting = (key: string) => (setting(key) === "" ? undefined : Number(setting(key)));

/** Settings for the page. Secrets are never sent back, only whether they are set and their last 4 characters. */
export function publicSettings() {
  refreshEnv();
  const commented = commentedEnvValues();
  return {
    groups: SETTING_GROUPS,
    settings: SETTINGS.map((s) => {
      const raw = process.env[s.key]?.trim() ?? "";
      const off = commentedValue(s, commented);
      return s.type === "secret"
        ? { ...s, value: "", isSet: !!raw, hint: raw ? `…${raw.slice(-4)}` : "", commented: off }
        : { ...s, value: setting(s.key), isSet: !!raw, hint: "", commented: off };
    }),
  };
}

function validate(s: Setting, value: string): string | null {
  if (/[\r\n]/.test(value)) return "không được xuống dòng";
  if (value.length > (s.maxLength ?? 300)) return `dài quá ${s.maxLength ?? 300} ký tự`;
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
