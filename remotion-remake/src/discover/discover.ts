// "Tìm video hot": finds the most-engaging YouTube videos of a period with the
// free YouTube Data API, then filters by format, country and visual style.
import fs from "node:fs";
import path from "node:path";
import { PROVIDERS } from "../pipeline/ai";
import { OUT_DIR } from "../pipeline/tools";
import { extractHashtags, guessShorts, guessStyle, isShortsPage, mapLimit, SHORTS_MAX_SEC, topicLabels } from "./classify";
import { videoInsights, type Insight } from "./insights-ai";
import {
  categoryName,
  COUNTRIES,
  countryName,
  FORMAT_LABEL,
  parseDiscoverOptions,
  PERIODS,
  SORTS,
  STYLE_LABEL,
  timeRange,
  type DiscoverOptions,
  type SortKey,
  type VisualStyle,
} from "./options";
import { parseDuration, YoutubeApi, type ApiChannel, type ApiVideo } from "./youtube-api";

export const DISCOVER_DIR = path.join(OUT_DIR, "_discover");

export const DISCOVER_STEPS = [
  { id: "search", label: "Tìm video nhiều lượt xem trên YouTube" },
  { id: "details", label: "Lấy lượt xem, lượt thích, bình luận" },
  { id: "format", label: "Phân loại Shorts / video dài" },
  { id: "classify", label: "Phân tích chủ đề, keyword & hình ảnh" },
  { id: "save", label: "Xếp hạng & lưu kết quả" },
] as const;
export type DiscoverStepId = (typeof DISCOVER_STEPS)[number]["id"];

export type DiscoverEvent =
  | { type: "step"; step: DiscoverStepId; status: "start" | "done" | "skip"; message?: string }
  | { type: "progress"; step: DiscoverStepId; progress: number }
  | { type: "log"; message: string };
type Emit = (e: DiscoverEvent) => void;

export type DiscoveredVideo = {
  rank: number;
  id: string;
  url: string;
  title: string;
  channel: string;
  channelUrl: string;
  channelCountry: string;
  thumbnail: string;
  publishedAt: string;
  durationSec: number;
  format: "shorts" | "long";
  style: VisualStyle;
  /** "ai" when the style/topic/keywords come from the AI, "guess" for the keyword heuristic. */
  styleSource: "ai" | "guess";
  views: number;
  likes: number | null;
  comments: number | null;
  /** (likes + comments) / views, in percent. */
  engagementRate: number;
  /** 0–100: average percentile of views, likes and comments among the videos found. */
  score: number;
  topic: string;
  category: string;
  youtubeTopics: string[];
  /** Tags the creator declared. */
  keywords: string[];
  /** Keywords suggested by the AI. */
  suggestedKeywords: string[];
  hashtags: string[];
  language: string;
};

export type DiscoverResult = {
  id: string;
  createdAt: string;
  label: string;
  options: DiscoverOptions;
  range: { from: string; to: string };
  ai: string;
  videos: DiscoveredVideo[];
  stats: { scanned: number; matchedFormat: number; matchedCountry: number; aiClassified: number; matchedStyle: number; quotaUsed: number };
  notes: string[];
};

/** Added to the search when looking for animation without a keyword, so more animated videos show up. */
const ANIMATION_QUERY = "animation|animated|cartoon|anime|hoạt hình";
const AI_BATCH = 20;
/** Most videos the AI looks at per search (keeps the cost low). */
const AI_MAX = 100;

const num = (s?: string) => (s === undefined ? null : Number(s) || 0);

/** Case-insensitive dedupe that keeps the first spelling. */
const uniqueCaseless = (list: string[]) => list.filter((x, i) => list.findIndex((y) => y.toLocaleLowerCase() === x.toLocaleLowerCase()) === i);

/** Short reason for an AI SDK error (Anthropic and OpenAI both expose status + a nested message). */
function aiErrorMessage(e: unknown): string {
  const err = e as { status?: number; message?: string; error?: { message?: string; error?: { message?: string } } };
  if (err.status === 401) return "khóa API không hợp lệ";
  if (err.status === 429) return "vượt giới hạn gọi hoặc hết credit";
  return (err.error?.error?.message ?? err.error?.message ?? err.message ?? String(e)).split("\n")[0];
}

/** Fraction of `values` below each value (ties share the middle), 0 for the lowest and 1 for the highest. */
function percentiles(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  return values.map((v) => {
    if (n < 2) return 1;
    const first = sorted.indexOf(v);
    const last = sorted.lastIndexOf(v);
    return (first + last) / 2 / (n - 1);
  });
}

const sortValue: Record<SortKey, (v: DiscoveredVideo) => number> = {
  engagement: (v) => v.score,
  views: (v) => v.views,
  likes: (v) => v.likes ?? 0,
  comments: (v) => v.comments ?? 0,
  rate: (v) => v.engagementRate,
};

export function describeOptions(o: DiscoverOptions): string {
  const period = o.period === "custom" ? `${o.from} → ${o.to || "nay"}` : (PERIODS.find((p) => p.id === o.period)?.label ?? o.period);
  return [
    FORMAT_LABEL[o.format],
    o.country ? `${countryName(o.country)}${o.strictCountry ? " (chỉ kênh trong nước)" : ""}` : "Toàn cầu",
    period,
    o.style === "all" ? "" : STYLE_LABEL[o.style],
    o.category ? categoryName(o.category) : "",
    o.query ? `"${o.query}"` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function toVideo(v: ApiVideo, channel: ApiChannel | undefined, format: "shorts" | "long"): DiscoveredVideo {
  const s = v.snippet;
  const views = num(v.statistics.viewCount) ?? 0;
  const likes = num(v.statistics.likeCount);
  const comments = num(v.statistics.commentCount);
  const handle = channel?.snippet.customUrl;
  return {
    rank: 0,
    id: v.id,
    url: format === "shorts" ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
    title: s.title,
    channel: s.channelTitle,
    channelUrl: handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${s.channelId}`,
    channelCountry: channel?.snippet.country ?? "",
    thumbnail: (s.thumbnails.medium ?? s.thumbnails.high ?? s.thumbnails.default)?.url ?? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
    publishedAt: s.publishedAt,
    durationSec: parseDuration(v.contentDetails.duration),
    format,
    style: "live",
    styleSource: "guess",
    views,
    likes,
    comments,
    engagementRate: views ? Math.round((((likes ?? 0) + (comments ?? 0)) / views) * 10000) / 100 : 0,
    score: 0,
    topic: "",
    category: categoryName(s.categoryId),
    youtubeTopics: topicLabels(v.topicDetails?.topicCategories),
    keywords: uniqueCaseless(s.tags ?? []),
    suggestedKeywords: [],
    hashtags: extractHashtags(s.title, s.description),
    language: s.defaultAudioLanguage ?? s.defaultLanguage ?? "",
  };
}

export async function runDiscover(raw: unknown, emit: Emit): Promise<DiscoverResult> {
  const opts = parseDiscoverOptions(raw);
  const range = timeRange(opts);
  const api = new YoutubeApi();
  const notes: string[] = [];
  const country = COUNTRIES.find((c) => c.code === opts.country);

  // 1. search.list ordered by view count (100 quota units per page of 50).
  emit({ type: "step", step: "search", status: "start" });
  const query = opts.query || (opts.style === "animation" ? ANIMATION_QUERY : "");
  if (!opts.query && opts.style === "animation") notes.push(`Đã thêm từ khoá "${ANIMATION_QUERY}" vào tìm kiếm để gặp nhiều video animation hơn.`);
  const found = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < opts.pages; page++) {
    const r = await api.search({
      publishedAfter: range.after,
      publishedBefore: range.before,
      regionCode: opts.country || undefined,
      relevanceLanguage: country?.lang || undefined,
      q: query || undefined,
      videoCategoryId: opts.category || undefined,
      // "short" = under 4 minutes on YouTube's side; Shorts are confirmed later.
      videoDuration: opts.format === "shorts" ? "short" : "any",
      pageToken,
    });
    r.ids.forEach((id) => found.add(id));
    emit({ type: "progress", step: "search", progress: (page + 1) / opts.pages });
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  const ids = [...found];
  emit({ type: "step", step: "search", status: "done", message: `${ids.length} video` });
  if (!ids.length) throw new Error("YouTube không trả về video nào cho bộ lọc này. Thử khoảng thời gian dài hơn, bỏ từ khoá hoặc đổi quốc gia.");

  // 2. Statistics, tags, duration and the channels' countries.
  emit({ type: "step", step: "details", status: "start" });
  const details = (await api.videos(ids)).filter((v) => v.snippet.liveBroadcastContent === "none");
  const byId = new Map(details.map((v) => [v.id, v]));
  const channels = await api.channels(details.map((v) => v.snippet.channelId));
  emit({ type: "step", step: "details", status: "done", message: `${details.length} video · ${channels.size} kênh` });

  // 3. Shorts or regular video.
  emit({ type: "step", step: "format", status: "start" });
  const toCheck = details.filter((v) => parseDuration(v.contentDetails.duration) <= SHORTS_MAX_SEC);
  let checked = 0;
  const shortsPage = new Map<string, boolean | null>();
  await mapLimit(toCheck, 8, async (v) => {
    shortsPage.set(v.id, await isShortsPage(v.id));
    emit({ type: "progress", step: "format", progress: ++checked / toCheck.length });
  });
  const unknown = [...shortsPage.values()].filter((x) => x === null).length;
  if (unknown) notes.push(`Không mở được trang /shorts/ của ${unknown} video nên đoán Shorts theo thời lượng (≤ 60 giây hoặc có #shorts).`);
  let candidates = details.map((v) => {
    const sec = parseDuration(v.contentDetails.duration);
    const page = shortsPage.get(v.id);
    const isShort = sec <= SHORTS_MAX_SEC && (page ?? guessShorts(sec, `${v.snippet.title} ${v.snippet.description} ${(v.snippet.tags ?? []).join(" ")}`));
    return toVideo(v, channels.get(v.snippet.channelId), isShort ? "shorts" : "long");
  });
  const shortsCount = candidates.filter((v) => v.format === "shorts").length;
  if (opts.format !== "all") candidates = candidates.filter((v) => v.format === opts.format);
  const matchedFormat = candidates.length;
  emit({ type: "step", step: "format", status: "done", message: `${shortsCount} Shorts · ${details.length - shortsCount} video dài` });

  if (opts.country && opts.strictCountry) {
    candidates = candidates.filter((v) => v.channelCountry === opts.country);
    notes.push(`Chỉ giữ kênh khai báo quốc gia ${countryName(opts.country)} (kênh không khai báo quốc gia bị loại).`);
  } else if (opts.country) {
    notes.push(
      `YouTube chỉ lọc video xem được ở ${countryName(opts.country)}${country?.lang ? ` và ưu tiên ngôn ngữ "${country.lang}"` : ""}, nên vẫn có thể có video của kênh nước khác. Bật "Chỉ kênh của quốc gia này" để lọc chặt hơn.`,
    );
  }
  const matchedCountry = candidates.length;

  // Rank among every candidate, so the score means the same whatever the style filter.
  const pv = percentiles(candidates.map((v) => v.views));
  const pl = percentiles(candidates.map((v) => v.likes ?? 0));
  const pc = percentiles(candidates.map((v) => v.comments ?? 0));
  candidates.forEach((v, i) => (v.score = Math.round(((pv[i] + pl[i] + pc[i]) / 3) * 100)));
  candidates.sort((a, b) => sortValue[opts.sort](b) - sortValue[opts.sort](a) || b.views - a.views);

  // 4. Visual style, topic and keywords: AI if available, otherwise a keyword guess.
  emit({ type: "step", step: "classify", status: "start" });
  const provider = opts.ai === "none" ? null : PROVIDERS[opts.ai];
  const useAi = !!provider?.ready();
  let aiLabel = "không dùng (hình ảnh đoán theo từ khoá, chủ đề lấy từ danh mục YouTube)";
  if (provider && !useAi) notes.push(`Chưa có ${provider.envKey} nên không dùng ${provider.label}: phân loại hình ảnh chỉ đoán theo từ khoá.`);

  const insights = new Map<string, Insight>();
  let aiFailed = false;
  if (useAi && provider && candidates.length) {
    aiLabel = `${provider.label} · ${provider.model}`;
    const passing = () => candidates.filter((v) => insights.get(v.id)?.style === opts.style).length;
    const pool = opts.style === "all" ? candidates.slice(0, opts.limit) : candidates.slice(0, AI_MAX);
    for (let i = 0; i < pool.length; i += AI_BATCH) {
      if (opts.style !== "all" && passing() >= opts.limit) break;
      const batch = pool.slice(i, i + AI_BATCH);
      emit({ type: "log", message: `${provider.label} đang xem ${batch.length} video (${i + 1}–${i + batch.length})…` });
      try {
        const got = await videoInsights(
          opts.ai as "claude" | "openai",
          batch.map((v) => ({
            id: v.id,
            title: v.title,
            channel: v.channel,
            category: v.category,
            tags: v.keywords,
            description: byId.get(v.id)?.snippet.description ?? "",
            durationSec: v.durationSec,
            thumbnailUrl: v.thumbnail,
          })),
        );
        for (const v of batch) {
          const r = got.get(v.id);
          if (r) insights.set(v.id, r);
        }
      } catch (e) {
        aiFailed = true;
        notes.push(`${provider.label} lỗi (${aiErrorMessage(e)}), các video còn lại được phân loại bằng cách đoán theo từ khoá.`);
        break;
      }
      emit({ type: "progress", step: "classify", progress: Math.min(1, (i + batch.length) / pool.length) });
    }
  }

  for (const v of candidates) {
    const ai = insights.get(v.id);
    if (ai) {
      v.style = ai.style;
      v.styleSource = "ai";
      v.topic = ai.topic;
      v.suggestedKeywords = uniqueCaseless(ai.keywords).filter((k) => !v.keywords.some((t) => t.toLocaleLowerCase() === k.toLocaleLowerCase()));
    } else {
      v.style = guessStyle(`${v.title} ${v.keywords.join(" ")} ${v.hashtags.join(" ")}`, byId.get(v.id)?.snippet.categoryId ?? "");
      v.topic = [...new Set([...v.youtubeTopics, v.category].filter(Boolean))].join(", ");
    }
  }
  // With a working AI and a style filter, videos the AI did not look at are left out rather than guessed.
  const eligible = useAi && !aiFailed && opts.style !== "all" ? candidates.filter((v) => v.styleSource === "ai") : candidates;
  const matched = opts.style === "all" ? eligible : eligible.filter((v) => v.style === opts.style);
  emit({
    type: "step",
    step: "classify",
    status: "done",
    message: insights.size ? `${insights.size} video được AI phân tích` : aiFailed ? "AI lỗi → đoán theo từ khoá" : "Đoán theo từ khoá (không AI)",
  });

  // 5. Rank, save and return.
  emit({ type: "step", step: "save", status: "start" });
  const videos = matched.slice(0, opts.limit).map((v, i) => ({ ...v, rank: i + 1 }));
  if (videos.length < opts.limit)
    notes.push(`Chỉ tìm được ${videos.length}/${opts.limit} video khớp bộ lọc. Tăng "Độ sâu tìm kiếm", chọn khoảng thời gian dài hơn hoặc nới bộ lọc để có thêm.`);
  if (opts.sort !== "views") notes.push(`Video ứng viên là những video nhiều lượt xem nhất mà YouTube trả về, sau đó được xếp lại theo "${SORTS.find((s) => s.id === opts.sort)?.label}".`);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const id = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const result: DiscoverResult = {
    id,
    createdAt: now.toISOString(),
    label: describeOptions(opts),
    options: opts,
    range: { from: range.after.toISOString(), to: range.before.toISOString() },
    ai: insights.size ? aiLabel : useAi ? `${aiLabel} (lỗi, dùng cách đoán)` : aiLabel,
    videos,
    stats: { scanned: ids.length, matchedFormat, matchedCountry, aiClassified: insights.size, matchedStyle: matched.length, quotaUsed: api.quotaUsed },
    notes,
  };
  fs.mkdirSync(DISCOVER_DIR, { recursive: true });
  fs.writeFileSync(path.join(DISCOVER_DIR, `${id}.json`), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(DISCOVER_DIR, `${id}.csv`), toCsv(result));
  emit({ type: "step", step: "save", status: "done", message: `${videos.length} video · đã dùng ${api.quotaUsed} đơn vị quota` });
  return result;
}

const cell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Spreadsheet export (UTF-8 with BOM so Excel shows Vietnamese correctly). */
export function toCsv(r: DiscoverResult): string {
  const head = ["Hạng", "Link", "Tiêu đề", "Chủ đề", "Keywords (tags)", "Keywords gợi ý (AI)", "Hashtag", "Định dạng", "Hình ảnh", "Kênh", "Quốc gia kênh", "Ngày đăng", "Thời lượng (giây)", "Lượt xem", "Lượt thích", "Bình luận", "Tỉ lệ tương tác (%)", "Điểm tương tác", "Danh mục"];
  const rows = r.videos.map((v) => [
    v.rank,
    v.url,
    v.title,
    v.topic,
    v.keywords,
    v.suggestedKeywords,
    v.hashtags.join(" "),
    v.format === "shorts" ? "Shorts" : "Video dài",
    STYLE_LABEL[v.style] + (v.styleSource === "guess" ? " (đoán)" : ""),
    v.channel,
    v.channelCountry,
    v.publishedAt.slice(0, 10),
    Math.round(v.durationSec),
    v.views,
    v.likes ?? "",
    v.comments ?? "",
    v.engagementRate,
    v.score,
    v.category,
  ]);
  return "﻿" + [head, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function loadDiscovery(id: string): DiscoverResult | null {
  if (!/^[\w-]+$/.test(id)) return null;
  const file = path.join(DISCOVER_DIR, `${id}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as DiscoverResult) : null;
}

/** Past searches, newest first. */
export function listDiscoveries(limit = 20) {
  if (!fs.existsSync(DISCOVER_DIR)) return [];
  return fs
    .readdirSync(DISCOVER_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limit)
    .map((f) => loadDiscovery(f.slice(0, -5)))
    .filter((r): r is DiscoverResult => !!r)
    .map((r) => ({ id: r.id, createdAt: r.createdAt, label: r.label, count: r.videos.length }));
}
