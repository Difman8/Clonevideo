// "Kênh theo dõi": the channels the owner follows, and a ranking of their recent
// videos. No AI, and very little quota: a saved channel keeps its uploads playlist,
// and playlist pages and video details cost 1 unit per 50 videos.
import fs from "node:fs";
import path from "node:path";
import { readJsonSafe, writeJsonAtomic } from "../pipeline/tools";
import { parseVideoId } from "../pipeline/youtube";
import { guessShorts, isShortsPage, mapLimit, SHORTS_MAX_SEC } from "./classify";
import { describePeriod, DISCOVER_DIR, percentiles, saveDiscovery, toVideo, type DiscoveredVideo, type DiscoverResult } from "./discover";
import { FORMAT_LABEL, parseDiscoverOptions, timeRange } from "./options";
import { YoutubeApi, type ApiChannel, type ChannelLookup } from "./youtube-api";

// A folder of its own: listDiscoveries reads every .json directly in DISCOVER_DIR as a past search.
const FOLLOW_DIR = path.join(DISCOVER_DIR, "followed");
const CHANNELS_FILE = path.join(FOLLOW_DIR, "channels.json");
const SNAPSHOTS_FILE = path.join(FOLLOW_DIR, "snapshots.json");

/** A very active channel over a long period stops here rather than spending quota on old videos. */
const MAX_PAGES_PER_CHANNEL = 10;
/** Two scans closer than this say nothing about growth. */
const MIN_SNAPSHOT_HOURS = 1;
const SNAPSHOT_KEEP_DAYS = 90;

/** How the overall score is made: the shares of each signal, adding up to 100. */
const SCORE_WEIGHTS = { views: 20, likes: 10, comments: 10, engagement: 20, speed: 20, vsChannel: 20 };

export const CHANNEL_STEPS = [
  { id: "list", label: "Lấy danh sách video của các kênh" },
  { id: "details", label: "Lấy lượt xem, lượt thích, bình luận" },
  { id: "format", label: "Phân loại Shorts / video dài" },
  { id: "save", label: "Tính điểm & xếp hạng" },
] as const;
type StepId = (typeof CHANNEL_STEPS)[number]["id"];

export type ChannelEvent =
  | { type: "step"; step: StepId; status: "start" | "done"; message?: string }
  | { type: "progress"; step: StepId; progress: number }
  | { type: "log"; message: string };

export type SavedChannel = {
  id: string;
  title: string;
  /** "@handle", "" when the channel has none. */
  handle: string;
  url: string;
  thumbnail: string;
  /** Playlist of all its uploads. Saved, so a scan does not pay to look it up again. */
  uploads: string;
  subscribers: number | null;
  addedAt: string;
};

type Snapshot = { views: number; at: string };

export const listChannels = () => readJsonSafe<SavedChannel[]>(CHANNELS_FILE) ?? [];

function saveChannels(channels: SavedChannel[]) {
  fs.mkdirSync(FOLLOW_DIR, { recursive: true });
  writeJsonAtomic(CHANNELS_FILE, channels);
}

const decoded = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** The lookups to try for one pasted line: channel link, @handle, channel id, or a video link. */
function lookupsFor(text: string): ChannelLookup[] {
  const handle = text.match(/(?:^|youtube\.com\/)@([^/?#\s]+)/i);
  if (handle) return [{ forHandle: `@${decoded(handle[1])}` }];
  const id = text.match(/\bUC[\w-]{22}\b/);
  if (id) return [{ id: id[0] }];
  const user = text.match(/youtube\.com\/user\/([^/?#\s]+)/i);
  if (user) return [{ forUsername: decoded(user[1]) }];
  // Old /c/ links and bare names have no lookup of their own: they usually match a handle.
  const name = text.match(/youtube\.com\/c\/([^/?#\s]+)/i)?.[1] ?? (/^[\p{L}\p{N}._-]+$/u.test(text) ? text : null);
  return name ? [{ forHandle: `@${decoded(name)}` }, { forUsername: decoded(name) }] : [];
}

async function findChannel(api: YoutubeApi, text: string): Promise<ApiChannel | null> {
  const videoId = /youtu\.?be/i.test(text) && !/youtube\.com\/(@|channel\/|user\/|c\/)/i.test(text) ? parseVideoId(text) : null;
  if (videoId) {
    const [video] = await api.videos([videoId]);
    return video ? api.channel({ id: video.snippet.channelId }) : null;
  }
  for (const lookup of lookupsFor(text)) {
    const channel = await api.channel(lookup);
    if (channel) return channel;
  }
  return null;
}

function toSavedChannel(c: ApiChannel): SavedChannel {
  const handle = c.snippet.customUrl?.startsWith("@") ? c.snippet.customUrl : "";
  return {
    id: c.id,
    title: c.snippet.title,
    handle,
    url: handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${c.id}`,
    thumbnail: (c.snippet.thumbnails.medium ?? c.snippet.thumbnails.default ?? c.snippet.thumbnails.high)?.url ?? "",
    uploads: c.contentDetails.relatedPlaylists.uploads,
    subscribers: c.statistics?.hiddenSubscriberCount ? null : Number(c.statistics?.subscriberCount ?? 0) || null,
    addedAt: new Date().toISOString(),
  };
}

/** Adds every channel of the pasted text (one per line, or separated by spaces or commas). */
export async function addChannels(text: string) {
  const inputs = [...new Set(text.split(/[\s,]+/).filter(Boolean))];
  if (!inputs.length) throw new Error("Hãy dán link hoặc @tên của ít nhất một kênh.");
  const api = new YoutubeApi();
  const channels = listChannels();
  const added: string[] = [];
  const failed: string[] = [];
  const already: string[] = [];
  for (const input of inputs) {
    const found = await findChannel(api, input);
    if (!found) failed.push(input);
    else if (channels.some((c) => c.id === found.id)) already.push(found.snippet.title);
    else {
      channels.push(toSavedChannel(found));
      added.push(found.snippet.title);
    }
  }
  if (added.length) saveChannels(channels);
  return { channels, added, failed, already, quotaUsed: api.quotaUsed };
}

export function removeChannel(id: string) {
  const channels = listChannels().filter((c) => c.id !== id);
  saveChannels(channels);
  return channels;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Fills in the growth figures and the overall score, then updates the saved view counts. */
function scoreVideos(videos: DiscoveredVideo[], now: Date) {
  const saved = readJsonSafe<Record<string, Snapshot>>(SNAPSHOTS_FILE) ?? {};
  const hoursSince = (iso: string) => (now.getTime() - new Date(iso).getTime()) / 3_600_000;
  const byChannel = new Map<string, number[]>();
  for (const v of videos) byChannel.set(v.channelUrl, [...(byChannel.get(v.channelUrl) ?? []), v.views]);

  for (const v of videos) {
    const past = saved[v.id];
    const gap = past ? hoursSince(past.at) : 0;
    const typical = median(byChannel.get(v.channelUrl)!);
    v.hot = {
      viewsPerHour: Math.round(v.views / Math.max(1, hoursSince(v.publishedAt))),
      vsChannel: typical ? Math.round((v.views / typical) * 10) / 10 : 1,
      recentPerHour: gap >= MIN_SNAPSHOT_HOURS ? Math.max(0, Math.round((v.views - past.views) / gap)) : null,
    };
    // Kept while it is recent: the next scan then still compares over at least an hour.
    if (!past || gap >= MIN_SNAPSHOT_HOURS) saved[v.id] = { views: v.views, at: now.toISOString() };
  }

  const signals = {
    views: videos.map((v) => v.views),
    likes: videos.map((v) => v.likes ?? 0),
    comments: videos.map((v) => v.comments ?? 0),
    engagement: videos.map((v) => v.engagementRate),
    // What the video did since the last scan says more than its average since publication.
    speed: videos.map((v) => v.hot!.recentPerHour ?? v.hot!.viewsPerHour),
    vsChannel: videos.map((v) => v.hot!.vsChannel),
  };
  const ranks = Object.entries(signals).map(([name, values]) => ({ weight: SCORE_WEIGHTS[name as keyof typeof SCORE_WEIGHTS], ranks: percentiles(values) }));
  videos.forEach((v, i) => (v.score = Math.round(ranks.reduce((sum, s) => sum + s.weight * s.ranks[i], 0))));

  const oldest = now.getTime() - SNAPSHOT_KEEP_DAYS * 86_400_000;
  fs.mkdirSync(FOLLOW_DIR, { recursive: true });
  writeJsonAtomic(SNAPSHOTS_FILE, Object.fromEntries(Object.entries(saved).filter(([, s]) => new Date(s.at).getTime() >= oldest)));
}

/** Ranks the videos the followed channels published in the chosen period, best overall score first. */
export async function runChannelScan(raw: unknown, emit: (e: ChannelEvent) => void): Promise<DiscoverResult> {
  const channels = listChannels();
  if (!channels.length) throw new Error("Chưa có kênh nào: dán link kênh rồi bấm Thêm kênh.");
  const opts = parseDiscoverOptions({ ...(raw as object), country: "", query: "", category: "", sort: "engagement" });
  const { after, before } = timeRange(opts);
  const api = new YoutubeApi();
  const notes = [
    `Đã quét ${channels.length} kênh: ${channels.map((c) => c.title).join(", ")}.`,
    `Điểm tổng hợp 0–100 so các video trong lần quét này với nhau: lượt xem ${SCORE_WEIGHTS.views}, lượt thích ${SCORE_WEIGHTS.likes}, bình luận ${SCORE_WEIGHTS.comments}, tỉ lệ tương tác ${SCORE_WEIGHTS.engagement}, tốc độ xem ${SCORE_WEIGHTS.speed}, mức vượt trung bình của chính kênh ${SCORE_WEIGHTS.vsChannel}.`,
  ];

  // 1. Uploads playlists, newest first: stop at the first page that reaches the start of the period.
  emit({ type: "step", step: "list", status: "start" });
  const ids = new Set<string>();
  const capped: string[] = [];
  let done = 0;
  await mapLimit(channels, 4, async (channel) => {
    let pageToken: string | undefined;
    for (let page = 1; ; page++) {
      const r = await api.uploads(channel.uploads, pageToken);
      for (const item of r.items) {
        const published = new Date(item.publishedAt);
        if (published >= after && published <= before) ids.add(item.id);
      }
      pageToken = r.nextPageToken;
      const last = r.items[r.items.length - 1];
      if (!pageToken || !last || new Date(last.publishedAt) < after) break;
      if (page === MAX_PAGES_PER_CHANNEL) {
        capped.push(channel.title);
        break;
      }
    }
    emit({ type: "progress", step: "list", progress: ++done / channels.length });
  });
  if (capped.length) notes.push(`${capped.join(", ")} đăng quá nhiều video trong khoảng này: chỉ xét ${MAX_PAGES_PER_CHANNEL * 50} video mới nhất của mỗi kênh.`);
  emit({ type: "step", step: "list", status: "done", message: `${ids.size} video` });

  // 2. Statistics, title, duration.
  emit({ type: "step", step: "details", status: "start" });
  const details = (await api.videos([...ids])).filter((v) => v.snippet.liveBroadcastContent === "none");
  let videos = details.map(toVideo);
  emit({ type: "step", step: "details", status: "done", message: `${videos.length} video` });

  // 3. Shorts or regular video: youtube.com/shorts/<id> answers 200 only for a Short.
  emit({ type: "step", step: "format", status: "start" });
  const toCheck = videos.filter((v) => v.durationSec <= SHORTS_MAX_SEC);
  let checked = 0;
  await mapLimit(toCheck, 8, async (v) => {
    if ((await isShortsPage(v.id)) ?? guessShorts(v.durationSec, `${v.title} ${v.description} ${v.keywords.join(" ")}`)) {
      v.format = "shorts";
      v.url = `https://www.youtube.com/shorts/${v.id}`;
    }
    emit({ type: "progress", step: "format", progress: ++checked / toCheck.length });
  });
  const shortsCount = videos.filter((v) => v.format === "shorts").length;
  emit({ type: "step", step: "format", status: "done", message: `${shortsCount} Shorts · ${videos.length - shortsCount} video dài` });
  if (opts.format !== "all") videos = videos.filter((v) => v.format === opts.format);

  // 4. Score, rank, save.
  emit({ type: "step", step: "save", status: "start" });
  scoreVideos(videos, new Date());
  if (videos.length && videos.every((v) => v.hot!.recentPerHour === null)) notes.push("Quét lại sau ít nhất 1 giờ để có thêm số 🚀: lượt xem mỗi giờ từ lần quét trước, cho thấy video nào đang tăng thật.");
  if (!videos.length) notes.push("Các kênh này không có video nào khớp trong khoảng thời gian đã chọn. Thử chọn khoảng dài hơn.");
  videos.sort((a, b) => b.score - a.score || b.views - a.views);
  const ranked = videos.slice(0, opts.limit).map((v, i) => ({ ...v, rank: i + 1 }));
  const result = saveDiscovery({
    label: `📌 ${channels.length} kênh theo dõi · ${FORMAT_LABEL[opts.format]} · ${describePeriod(opts)}`,
    options: opts,
    range: { from: after.toISOString(), to: before.toISOString() },
    videos: ranked,
    stats: { scanned: ids.size, matchedLanguage: details.length, matchedFormat: videos.length, quotaUsed: api.quotaUsed },
    notes,
  });
  emit({ type: "step", step: "save", status: "done", message: `${ranked.length} video · đã dùng ${api.quotaUsed} đơn vị quota` });
  return result;
}
