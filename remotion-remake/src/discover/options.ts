// Filters of the "Tìm video hot" tool and the fixed lists shown in the UI.

export type VideoFormat = "shorts" | "long" | "all";
export type VisualStyle = "live" | "animation" | "other";
export type StyleFilter = "all" | "live" | "animation";
export type SortKey = "engagement" | "views" | "likes" | "comments" | "rate";
export type AiChoice = "claude" | "openai" | "none";

export type DiscoverOptions = {
  /** ISO 3166-1 alpha-2, or "" for every country. */
  country: string;
  /** Keep only channels whose declared country is `country`. */
  strictCountry: boolean;
  /** Key of PERIODS, or "custom" with `from`/`to`. */
  period: string;
  /** YYYY-MM-DD, used when period is "custom". */
  from: string;
  to: string;
  format: VideoFormat;
  style: StyleFilter;
  query: string;
  /** YouTube category id, or "" for every category. */
  category: string;
  sort: SortKey;
  limit: number;
  /** search.list pages (50 videos, 100 quota units each). */
  pages: number;
  ai: AiChoice;
};

/** Countries offered in the UI, with the language search results are biased to. */
export const COUNTRIES: { code: string; name: string; lang: string }[] = [
  { code: "", name: "Toàn cầu (mọi quốc gia)", lang: "" },
  { code: "VN", name: "Việt Nam", lang: "vi" },
  { code: "US", name: "Hoa Kỳ", lang: "en" },
  { code: "GB", name: "Anh", lang: "en" },
  { code: "CA", name: "Canada", lang: "en" },
  { code: "AU", name: "Úc", lang: "en" },
  { code: "IN", name: "Ấn Độ", lang: "hi" },
  { code: "ID", name: "Indonesia", lang: "id" },
  { code: "TH", name: "Thái Lan", lang: "th" },
  { code: "PH", name: "Philippines", lang: "" },
  { code: "MY", name: "Malaysia", lang: "ms" },
  { code: "SG", name: "Singapore", lang: "en" },
  { code: "JP", name: "Nhật Bản", lang: "ja" },
  { code: "KR", name: "Hàn Quốc", lang: "ko" },
  { code: "TW", name: "Đài Loan", lang: "zh-Hant" },
  { code: "HK", name: "Hồng Kông", lang: "zh-Hant" },
  { code: "BR", name: "Brazil", lang: "pt" },
  { code: "MX", name: "Mexico", lang: "es" },
  { code: "AR", name: "Argentina", lang: "es" },
  { code: "ES", name: "Tây Ban Nha", lang: "es" },
  { code: "FR", name: "Pháp", lang: "fr" },
  { code: "DE", name: "Đức", lang: "de" },
  { code: "IT", name: "Ý", lang: "it" },
  { code: "RU", name: "Nga", lang: "ru" },
  { code: "TR", name: "Thổ Nhĩ Kỳ", lang: "tr" },
  { code: "SA", name: "Ả Rập Xê Út", lang: "ar" },
  { code: "EG", name: "Ai Cập", lang: "ar" },
  { code: "PK", name: "Pakistan", lang: "ur" },
  { code: "BD", name: "Bangladesh", lang: "bn" },
  { code: "NG", name: "Nigeria", lang: "en" },
];

export const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

/** YouTube video categories that can be searched (ids are the same in every region). */
export const CATEGORIES: Record<string, string> = {
  "1": "Phim & hoạt hình",
  "2": "Ô tô & xe cộ",
  "10": "Âm nhạc",
  "15": "Thú cưng & động vật",
  "17": "Thể thao",
  "19": "Du lịch & sự kiện",
  "20": "Trò chơi",
  "22": "Mọi người & blog",
  "23": "Hài kịch",
  "24": "Giải trí",
  "25": "Tin tức & chính trị",
  "26": "Hướng dẫn & phong cách",
  "27": "Giáo dục",
  "28": "Khoa học & công nghệ",
  "29": "Phi lợi nhuận & hoạt động xã hội",
};
const OTHER_CATEGORIES: Record<string, string> = { "18": "Phim ngắn", "21": "Videoblog", "30": "Phim", "43": "Chương trình", "44": "Trailer" };
export const categoryName = (id: string) => CATEGORIES[id] ?? OTHER_CATEGORIES[id] ?? "";

export const PERIODS: { id: string; label: string; days: number }[] = [
  { id: "1d", label: "24 giờ qua", days: 1 },
  { id: "3d", label: "3 ngày qua", days: 3 },
  { id: "7d", label: "7 ngày qua", days: 7 },
  { id: "30d", label: "30 ngày qua", days: 30 },
  { id: "90d", label: "3 tháng qua", days: 90 },
  { id: "365d", label: "12 tháng qua", days: 365 },
];

export const SORTS: { id: SortKey; label: string }[] = [
  { id: "engagement", label: "Điểm tương tác tổng hợp" },
  { id: "views", label: "Lượt xem" },
  { id: "likes", label: "Lượt thích" },
  { id: "comments", label: "Bình luận" },
  { id: "rate", label: "Tỉ lệ tương tác (%)" },
];

export const FORMAT_LABEL: Record<VideoFormat, string> = { shorts: "Shorts", long: "Video dài", all: "Shorts + video dài" };
export const STYLE_LABEL: Record<VisualStyle, string> = { live: "Người thật cảnh thật", animation: "Animation / đồ hoạ", other: "Khác (game, màn hình, ảnh tĩnh…)" };

export const DEFAULT_OPTIONS: DiscoverOptions = {
  country: "VN",
  strictCountry: false,
  period: "7d",
  from: "",
  to: "",
  format: "shorts",
  style: "all",
  query: "",
  category: "",
  sort: "engagement",
  limit: 20,
  pages: 2,
  ai: "claude",
};

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Turns untrusted input (web form, CLI flags) into valid options. */
export function parseDiscoverOptions(raw: unknown): DiscoverOptions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_OPTIONS;
  const country = typeof o.country === "string" ? o.country.toUpperCase() : d.country;
  return {
    country: COUNTRIES.some((c) => c.code === country) || /^[A-Z]{2}$/.test(country) ? country : d.country,
    strictCountry: o.strictCountry === true || o.strictCountry === "true",
    period: pick(o.period, [...PERIODS.map((p) => p.id), "custom"], d.period),
    from: isDate(o.from) ? o.from : "",
    to: isDate(o.to) ? o.to : "",
    format: pick(o.format, ["shorts", "long", "all"] as const, d.format),
    style: pick(o.style, ["all", "live", "animation"] as const, d.style),
    query: typeof o.query === "string" ? o.query.trim().slice(0, 200) : "",
    category: pick(o.category, ["", ...Object.keys(CATEGORIES)], ""),
    sort: pick(o.sort, SORTS.map((s) => s.id), d.sort),
    limit: clamp(o.limit, 1, 50, d.limit),
    pages: clamp(o.pages, 1, 5, d.pages),
    ai: pick(o.ai, ["claude", "openai", "none"] as const, d.ai),
  };
}

/** Publication window as Date objects. Custom dates are whole local days. */
export function timeRange(o: DiscoverOptions, now = new Date()): { after: Date; before: Date } {
  if (o.period === "custom") {
    if (!o.from) throw new Error("Chọn ngày bắt đầu cho khoảng thời gian tuỳ chọn.");
    const after = new Date(`${o.from}T00:00:00`);
    const before = o.to ? new Date(`${o.to}T23:59:59`) : now;
    if (after >= before) throw new Error("Ngày bắt đầu phải trước ngày kết thúc.");
    return { after, before: before > now ? now : before };
  }
  const days = PERIODS.find((p) => p.id === o.period)?.days ?? 7;
  return { after: new Date(now.getTime() - days * 86_400_000), before: now };
}

/** YouTube Data API v3 quota units one search costs (search.list = 100 per page). */
export const estimateQuota = (pages: number) => pages * 100 + 2 * pages;
