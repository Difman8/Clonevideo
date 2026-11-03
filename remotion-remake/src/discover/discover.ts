// "Tìm video hot": finds the most-engaging YouTube videos of a period with the
// free YouTube Data API, then filters by language (country) and format.
// No AI is involved: every step uses YouTube data or local code.
import fs from "node:fs";
import path from "node:path";
import { OUT_DIR, readJsonSafe, writeFileAtomic, writeJsonAtomic } from "../pipeline/tools";
import { extractHashtags, guessShorts, isShortsPage, mapLimit, SHORTS_MAX_SEC, topicLabels } from "./classify";
import { languageName, videoLanguage } from "./language";
import {
  categoryName,
  COUNTRIES,
  countryName,
  FORMAT_LABEL,
  parseDiscoverOptions,
  PERIODS,
  sharedLangs,
  SORTS,
  timeRange,
  type DiscoverOptions,
  type SortKey,
} from "./options";
import { parseDuration, YoutubeApi, type ApiVideo } from "./youtube-api";

export const DISCOVER_DIR = path.join(OUT_DIR, "_discover");
/** Checkpoints of searches that have not finished (power cut, app closed, quota ran out). */
const PENDING_DIR = path.join(DISCOVER_DIR, "pending");

/**
 * Everything a search has already paid for, saved after each page, after the
 * details call and every few Shorts checks. A continued search starts from here.
 */
type Checkpoint = {
  id: string;
  options: DiscoverOptions;
  /** Kept as first computed: "7 ngày qua" must not move when the search is continued later. */
  range: { after: string; before: string };
  label: string;
  status: "running" | "error";
  error: string;
  createdAt: string;
  updatedAt: string;
  search: { ids: string[]; pagesDone: number; nextPageToken: string | null; finished: boolean };
  details: ApiVideo[] | null;
  shorts: Record<string, boolean | null>;
  quotaUsed: number;
};

const pendingFile = (id: string) => path.join(PENDING_DIR, `${id}.json`);
const saveCheckpoint = (cp: Checkpoint) => writeJsonAtomic(pendingFile(cp.id), { ...cp, updatedAt: new Date().toISOString() });
export const newDiscoverId = () => `d${Date.now()}`;

export const DISCOVER_STEPS = [
  { id: "search", label: "Tìm video nhiều lượt xem trên YouTube" },
  { id: "details", label: "Lấy lượt xem, lượt thích, bình luận" },
  { id: "language", label: "Lọc theo ngôn ngữ tiêu đề & mô tả" },
  { id: "format", label: "Phân loại Shorts / video dài" },
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
  /** Full description, used by "Soạn thông tin đăng YouTube". */
  description: string;
  channel: string;
  channelUrl: string;
  thumbnail: string;
  publishedAt: string;
  durationSec: number;
  format: "shorts" | "long";
  views: number;
  likes: number | null;
  comments: number | null;
  /** (likes + comments) / views, in percent. */
  engagementRate: number;
  /** 0–100: average percentile of views, likes and comments among the videos found. */
  score: number;
  /** YouTube's topic labels and category, in Vietnamese. */
  topic: string;
  category: string;
  youtubeTopics: string[];
  /** Tags the creator declared. */
  keywords: string[];
  hashtags: string[];
  /** ISO 639-1 code, "" when unknown. */
  language: string;
  /** What the language was read from. */
  languageSource: "title" | "description" | "declared" | "";
};

export type DiscoverResult = {
  id: string;
  createdAt: string;
  label: string;
  options: DiscoverOptions;
  range: { from: string; to: string };
  videos: DiscoveredVideo[];
  stats: { scanned: number; matchedLanguage: number; matchedFormat: number; quotaUsed: number };
  notes: string[];
};

const num = (s?: string) => (s === undefined ? null : Number(s) || 0);

/** Case-insensitive dedupe that keeps the first spelling. */
const uniqueCaseless = (list: string[]) => list.filter((x, i) => list.findIndex((y) => y.toLocaleLowerCase() === x.toLocaleLowerCase()) === i);

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
  return [FORMAT_LABEL[o.format], o.country ? countryName(o.country) : "Toàn cầu", period, o.category ? categoryName(o.category) : "", o.query ? `"${o.query}"` : ""]
    .filter(Boolean)
    .join(" · ");
}

function toVideo(v: ApiVideo): DiscoveredVideo {
  const s = v.snippet;
  const views = num(v.statistics.viewCount) ?? 0;
  const likes = num(v.statistics.likeCount);
  const comments = num(v.statistics.commentCount);
  const category = categoryName(s.categoryId);
  const youtubeTopics = topicLabels(v.topicDetails?.topicCategories);
  const language = videoLanguage(s.title, s.description, s.defaultAudioLanguage ?? s.defaultLanguage ?? "");
  return {
    rank: 0,
    id: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: s.title,
    description: s.description,
    channel: s.channelTitle,
    channelUrl: `https://www.youtube.com/channel/${s.channelId}`,
    thumbnail: (s.thumbnails.medium ?? s.thumbnails.high ?? s.thumbnails.default)?.url ?? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
    publishedAt: s.publishedAt,
    durationSec: parseDuration(v.contentDetails.duration),
    format: "long",
    views,
    likes,
    comments,
    engagementRate: views ? Math.round((((likes ?? 0) + (comments ?? 0)) / views) * 10000) / 100 : 0,
    score: 0,
    topic: [...new Set([...youtubeTopics, category].filter(Boolean))].join(", "),
    category,
    youtubeTopics,
    keywords: uniqueCaseless(s.tags ?? []),
    hashtags: extractHashtags(s.title, s.description),
    language: language.lang,
    languageSource: language.source,
  };
}

/**
 * Runs a new search (`raw` = form options) or, with `resume`, continues the
 * saved checkpoint `id` without paying again for the pages already fetched.
 */
export async function runDiscover(raw: unknown, emit: Emit, { id = newDiscoverId(), resume = false } = {}): Promise<DiscoverResult> {
  let cp: Checkpoint;
  if (resume) {
    const saved = readJsonSafe<Checkpoint>(pendingFile(id));
    if (!saved) throw new Error("Không còn tiến trình đã lưu của lần tìm này.");
    cp = { ...saved, status: "running", error: "" };
  } else {
    const options = parseDiscoverOptions(raw);
    const r = timeRange(options);
    const now = new Date().toISOString();
    cp = {
      id,
      options,
      range: { after: r.after.toISOString(), before: r.before.toISOString() },
      label: describeOptions(options),
      status: "running",
      error: "",
      createdAt: now,
      updatedAt: now,
      search: { ids: [], pagesDone: 0, nextPageToken: null, finished: false },
      details: null,
      shorts: {},
      quotaUsed: 0,
    };
  }
  saveCheckpoint(cp);
  const api = new YoutubeApi();
  const quotaBefore = cp.quotaUsed;
  const checkpoint = () => saveCheckpoint({ ...cp, quotaUsed: quotaBefore + api.quotaUsed });
  try {
    const result = await discoverFrom(cp, api, emit, checkpoint);
    fs.rmSync(pendingFile(cp.id), { force: true });
    return result;
  } catch (e) {
    cp.status = "error";
    cp.error = (e as Error).message.split("\n")[0];
    checkpoint();
    throw e;
  }
}

async function discoverFrom(cp: Checkpoint, api: YoutubeApi, emit: Emit, checkpoint: () => void): Promise<DiscoverResult> {
  const opts = cp.options;
  const range = { after: new Date(cp.range.after), before: new Date(cp.range.before) };
  const notes: string[] = [];
  const country = COUNTRIES.find((c) => c.code === opts.country);
  const resumedPages = cp.search.pagesDone;

  // 1. search.list ordered by view count (100 quota units per page of 50).
  emit({ type: "step", step: "search", status: "start" });
  const found = new Set<string>(cp.search.ids);
  let pageToken: string | undefined = cp.search.nextPageToken ?? undefined;
  for (let page = cp.search.pagesDone; page < opts.pages && !cp.search.finished; page++) {
    const r = await api.search({
      publishedAfter: range.after,
      publishedBefore: range.before,
      regionCode: opts.country || undefined,
      relevanceLanguage: country?.searchLang || undefined,
      q: opts.query || undefined,
      videoCategoryId: opts.category || undefined,
      // "short" = under 4 minutes on YouTube's side; Shorts are confirmed later.
      videoDuration: opts.format === "shorts" ? "short" : "any",
      pageToken,
    });
    r.ids.forEach((id) => found.add(id));
    emit({ type: "progress", step: "search", progress: (page + 1) / opts.pages });
    pageToken = r.nextPageToken;
    cp.search = { ids: [...found], pagesDone: page + 1, nextPageToken: pageToken ?? null, finished: !pageToken };
    checkpoint();
  }
  cp.search.finished = true;
  const ids = [...found];
  emit({ type: "step", step: "search", status: "done", message: `${ids.length} video${resumedPages ? ` (${resumedPages} trang đã có từ lần trước)` : ""}` });
  if (!ids.length) throw new Error("YouTube không trả về video nào cho bộ lọc này. Thử khoảng thời gian dài hơn, bỏ từ khoá hoặc đổi quốc gia.");

  // 2. Statistics, tags, duration, title and description (1 quota unit per 50 videos).
  emit({ type: "step", step: "details", status: "start" });
  const reusedDetails = !!cp.details;
  if (!cp.details) {
    cp.details = (await api.videos(ids)).filter((v) => v.snippet.liveBroadcastContent === "none");
    checkpoint();
  }
  const details = cp.details;
  let candidates = details.map(toVideo);
  emit({ type: "step", step: "details", status: "done", message: `${details.length} video${reusedDetails ? " (đã có từ lần trước)" : ""}` });

  // 3. Country = language of the title, else the description, else the language the creator declared.
  emit({ type: "step", step: "language", status: "start" });
  if (country?.langs.length) {
    const names = country.langs.map(languageName).join(", ");
    const unknown = candidates.filter((v) => !v.language).length;
    candidates = candidates.filter((v) => country.langs.includes(v.language));
    notes.push(
      `Quốc gia ${country.name}: chỉ giữ video có tiêu đề (hoặc mô tả, hoặc ngôn ngữ kênh khai báo) bằng ${names}. Ngôn ngữ được nhận diện ngay trên máy, không dùng AI.` +
        (unknown ? ` ${unknown} video không xác định được ngôn ngữ (tiêu đề chỉ có emoji, quá ngắn…) đã bị loại.` : ""),
    );
    const shared = sharedLangs(country.code);
    if (shared.length) notes.push(`${shared.map(languageName).join(", ")} cũng được dùng ở nước khác, nên kết quả có thể gồm video của các nước đó.`);
    emit({ type: "step", step: "language", status: "done", message: `${candidates.length}/${details.length} video bằng ${names}` });
  } else {
    emit({ type: "step", step: "language", status: "skip", message: "Toàn cầu: không lọc ngôn ngữ" });
  }
  const matchedLanguage = candidates.length;

  // 4. Shorts or regular video: youtube.com/shorts/<id> answers 200 only for a Short.
  emit({ type: "step", step: "format", status: "start" });
  const descriptions = new Map(details.map((d) => [d.id, d.snippet.description]));
  const toCheck = candidates.filter((v) => v.durationSec <= SHORTS_MAX_SEC);
  let checked = 0;
  let unknownFormat = 0;
  await mapLimit(toCheck, 8, async (v) => {
    if (!(v.id in cp.shorts)) {
      cp.shorts[v.id] = await isShortsPage(v.id);
      if (++checked % 10 === 0) checkpoint();
    } else checked++;
    const page = cp.shorts[v.id];
    if (page === null) unknownFormat++;
    if (page ?? guessShorts(v.durationSec, `${v.title} ${descriptions.get(v.id) ?? ""} ${v.keywords.join(" ")}`)) {
      v.format = "shorts";
      v.url = `https://www.youtube.com/shorts/${v.id}`;
    }
    emit({ type: "progress", step: "format", progress: checked / toCheck.length });
  });
  if (unknownFormat) notes.push(`Không mở được trang /shorts/ của ${unknownFormat} video nên đoán Shorts theo thời lượng (≤ 60 giây hoặc có #shorts).`);
  const shortsCount = candidates.filter((v) => v.format === "shorts").length;
  if (opts.format !== "all") candidates = candidates.filter((v) => v.format === opts.format);
  const matchedFormat = candidates.length;
  emit({ type: "step", step: "format", status: "done", message: `${shortsCount} Shorts · ${matchedLanguage - shortsCount} video dài` });

  // 5. Rank, save and return.
  emit({ type: "step", step: "save", status: "start" });
  const pv = percentiles(candidates.map((v) => v.views));
  const pl = percentiles(candidates.map((v) => v.likes ?? 0));
  const pc = percentiles(candidates.map((v) => v.comments ?? 0));
  candidates.forEach((v, i) => (v.score = Math.round(((pv[i] + pl[i] + pc[i]) / 3) * 100)));
  candidates.sort((a, b) => sortValue[opts.sort](b) - sortValue[opts.sort](a) || b.views - a.views);
  const videos = candidates.slice(0, opts.limit).map((v, i) => ({ ...v, rank: i + 1 }));
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
    videos,
    stats: { scanned: ids.length, matchedLanguage, matchedFormat, quotaUsed: cp.quotaUsed + api.quotaUsed },
    notes,
  };
  fs.mkdirSync(DISCOVER_DIR, { recursive: true });
  writeJsonAtomic(path.join(DISCOVER_DIR, `${id}.json`), result);
  writeFileAtomic(path.join(DISCOVER_DIR, `${id}.csv`), toCsv(result));
  emit({ type: "step", step: "save", status: "done", message: `${videos.length} video · đã dùng ${result.stats.quotaUsed} đơn vị quota` });
  return result;
}

const cell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Spreadsheet export (UTF-8 with BOM so Excel shows Vietnamese correctly). */
export function toCsv(r: DiscoverResult): string {
  const head = ["Hạng", "Link", "Tiêu đề", "Chủ đề", "Keywords (tags)", "Hashtag", "Định dạng", "Ngôn ngữ", "Kênh", "Ngày đăng", "Thời lượng (giây)", "Lượt xem", "Lượt thích", "Bình luận", "Tỉ lệ tương tác (%)", "Điểm tương tác", "Danh mục"];
  const rows = r.videos.map((v) => [
    v.rank,
    v.url,
    v.title,
    v.topic,
    v.keywords,
    v.hashtags.join(" "),
    v.format === "shorts" ? "Shorts" : "Video dài",
    v.language ? languageName(v.language) : "",
    v.channel,
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

/** Searches that stopped before the end, oldest first. */
export function unfinishedDiscoveries(isRunningNow: (id: string) => boolean) {
  if (!fs.existsSync(PENDING_DIR)) return [];
  return fs
    .readdirSync(PENDING_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJsonSafe<Checkpoint>(path.join(PENDING_DIR, f)))
    .filter((cp): cp is Checkpoint => !!cp && !isRunningNow(cp.id))
    .map((cp) => ({
      id: cp.id,
      label: cp.label,
      interrupted: cp.status === "running",
      progress: cp.details ? "đã lấy xong số liệu, đang phân loại Shorts" : `đã tìm ${cp.search.pagesDone}/${cp.options.pages} trang`,
      error: cp.error,
      quotaUsed: cp.quotaUsed,
      updatedAt: cp.updatedAt,
    }));
}

/** "Bỏ qua": forget the checkpoint (the quota already spent is not refunded). */
export function dismissDiscovery(id: string) {
  if (/^[\w-]+$/.test(id)) fs.rmSync(pendingFile(id), { force: true });
}
