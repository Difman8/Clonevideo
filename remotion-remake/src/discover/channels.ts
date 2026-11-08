// "Top Shorts của kênh": every Short a channel has published, ranked by views. Only the free
// YouTube Data API and no AI: YouTube keeps a playlist of each channel's Shorts, and its pages
// and the video details cost 1 quota unit per 50 videos (a channel with 1,000 Shorts: ~40 units).
import fs from "node:fs";
import path from "node:path";
import { readJsonSafe, writeJsonAtomic } from "../pipeline/tools";
import { parseVideoId } from "../pipeline/youtube";
import { guessShorts, isShortsPage, mapLimit, SHORTS_MAX_SEC } from "./classify";
import { DISCOVER_DIR, saveDiscovery, scoreByEngagement, toVideo, type DiscoveredVideo, type DiscoverResult } from "./discover";
import { parseDiscoverOptions } from "./options";
import { YoutubeApi, YoutubeApiError, type ApiChannel, type ChannelLookup } from "./youtube-api";

// A folder of its own: listDiscoveries reads every .json directly in DISCOVER_DIR as a past search.
const FOLLOW_DIR = path.join(DISCOVER_DIR, "followed");
const CHANNELS_FILE = path.join(FOLLOW_DIR, "channels.json");

/** How many Shorts the ranking shows. */
export const TOP_SHORTS = 20;
/** YouTube pages a playlist up to 20,000 videos (400 pages of 50). */
const MAX_PAGES = 400;
/** Fallback when the Shorts playlist is unavailable: the newest uploads looked at (50 per page). */
const FALLBACK_MAX_PAGES = 40;

/**
 * Playlists YouTube keeps for every channel next to its uploads ("UU…"): only its Shorts ("UUSH…")
 * and only its regular videos ("UULF…"). Not in Google's documentation but served by the API;
 * if they ever stop working the scan falls back to the uploads playlist (see runChannelShorts).
 */
const shortsPlaylist = (channelId: string) => `UUSH${channelId.slice(2)}`;
const longPlaylist = (channelId: string) => `UULF${channelId.slice(2)}`;

export const CHANNEL_STEPS = [
  { id: "channel", label: "Tìm kênh" },
  { id: "list", label: "Lấy danh sách toàn bộ Shorts của kênh" },
  { id: "details", label: "Lấy lượt xem, lượt thích, bình luận" },
  { id: "save", label: `Xếp hạng ${TOP_SHORTS} Shorts nhiều lượt xem nhất` },
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
  /** Playlist of all its uploads (fallback when the Shorts playlist is unavailable). */
  uploads: string;
  subscribers: number | null;
  addedAt: string;
  /** Last scan: when, and how many Shorts the channel had. */
  scannedAt?: string;
  shorts?: number;
};

/** Channels scanned before, newest scan first: one click scans them again. */
export const listChannels = () => readJsonSafe<SavedChannel[]>(CHANNELS_FILE) ?? [];

function saveChannels(channels: SavedChannel[]) {
  fs.mkdirSync(FOLLOW_DIR, { recursive: true });
  writeJsonAtomic(CHANNELS_FILE, channels);
}

/** Adds the channel to the list or refreshes it there (name, picture, subscribers), first in the list. */
function rememberChannel(channel: SavedChannel) {
  const others = listChannels().filter((c) => c.id !== channel.id);
  const before = listChannels().find((c) => c.id === channel.id);
  saveChannels([{ ...channel, addedAt: before?.addedAt ?? channel.addedAt }, ...others]);
}

export function removeChannel(id: string) {
  const channels = listChannels().filter((c) => c.id !== id);
  saveChannels(channels);
  return channels;
}

const decoded = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** The lookups to try for a pasted channel: channel link, @handle, channel id, or a video link. */
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

/** Every video id of a playlist, up to `maxPages` pages of 50 (1 unit each). */
async function playlistIds(api: YoutubeApi, playlistId: string, maxPages: number, onPage: (got: number, total: number) => void) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 1; page <= maxPages; page++) {
    const r = await api.uploads(playlistId, pageToken);
    ids.push(...r.items.map((i) => i.id));
    onPage(ids.length, r.total ?? ids.length);
    pageToken = r.nextPageToken;
    if (!pageToken) return { ids: [...new Set(ids)], complete: true };
  }
  return { ids: [...new Set(ids)], complete: false };
}

/** A hidden playlist (Shorts, regular videos), or null when YouTube does not serve it: an unknown playlist id answers 400. */
async function hiddenPlaylistIds(...args: Parameters<typeof playlistIds>) {
  try {
    return await playlistIds(...args);
  } catch (e) {
    if (e instanceof YoutubeApiError && (e.status === 400 || e.status === 404)) return null;
    throw e;
  }
}

const asShort = (v: DiscoveredVideo): DiscoveredVideo => ({ ...v, format: "shorts", url: `https://www.youtube.com/shorts/${v.id}` });

/** Scans every Short of one channel (link, @handle or one of its video links) and ranks the most viewed. */
export async function runChannelShorts(raw: unknown, emit: (e: ChannelEvent) => void): Promise<DiscoverResult> {
  const text = String((raw as { channel?: unknown } | null)?.channel ?? "").trim();
  if (!text) throw new Error("Hãy dán link kênh, @tên kênh hoặc link một video của kênh.");
  const api = new YoutubeApi();
  const notes: string[] = [];

  // 1. The channel.
  emit({ type: "step", step: "channel", status: "start" });
  const found = await findChannel(api, text);
  if (!found) throw new Error(`Không tìm thấy kênh "${text}". Kiểm tra lại link hoặc @tên kênh.`);
  const channel = toSavedChannel(found);
  emit({ type: "step", step: "channel", status: "done", message: channel.title });

  // 2. Every Short it published, from YouTube's Shorts playlist of the channel.
  emit({ type: "step", step: "list", status: "start" });
  const progress = (got: number, total: number) => emit({ type: "progress", step: "list", progress: total ? Math.min(1, got / total) : 1 });
  const listed = await hiddenPlaylistIds(api, shortsPlaylist(channel.id), MAX_PAGES, progress);
  let ids = listed?.ids ?? [];
  // Fallback when YouTube no longer serves the hidden playlists: read the newest uploads and check each short one.
  let checkEach = !listed;
  if (listed && !listed.complete) notes.push(`Kênh có hơn ${MAX_PAGES * 50} Shorts: YouTube chỉ cho đọc ${MAX_PAGES * 50} Shorts mới nhất.`);
  if (listed && !ids.length) {
    const uploads = await api.uploads(channel.uploads);
    if (!uploads.items.length) notes.push("Kênh này chưa đăng video công khai nào.");
    else {
      // An empty Shorts playlist means no Shorts only if the regular-video playlist is served.
      const regular = await hiddenPlaylistIds(api, longPlaylist(channel.id), 1, () => {});
      if (regular?.ids.length) notes.push("Kênh này chưa đăng Short nào (chỉ có video dài).");
      else checkEach = true;
    }
  }
  if (checkEach) {
    ids = (await playlistIds(api, channel.uploads, FALLBACK_MAX_PAGES, progress)).ids;
    notes.push(
      `YouTube không trả về danh sách Shorts riêng của kênh nên app đọc ${ids.length} video mới nhất của kênh (tối đa ${FALLBACK_MAX_PAGES * 50}) và kiểm từng video ngắn có phải Short không.`,
    );
  }
  emit({ type: "step", step: "list", status: "done", message: checkEach ? `${ids.length} video (chưa lọc Shorts)` : `${ids.length} Shorts` });

  // 3. Views, likes, comments (50 per call).
  emit({ type: "step", step: "details", status: "start" });
  let shorts = (await api.videos(ids)).filter((v) => v.snippet.liveBroadcastContent === "none").map(toVideo);
  if (checkEach) {
    const candidates = shorts.filter((v) => v.durationSec <= SHORTS_MAX_SEC);
    const verdicts = await mapLimit(candidates, 8, async (v) => (await isShortsPage(v.id)) ?? guessShorts(v.durationSec, `${v.title} ${v.description}`));
    shorts = candidates.filter((_, i) => verdicts[i]);
  }
  shorts = shorts.map(asShort);
  emit({ type: "step", step: "details", status: "done", message: `${shorts.length} Shorts` });

  // 4. Most viewed first, saved with the other results.
  emit({ type: "step", step: "save", status: "start" });
  scoreByEngagement(shorts);
  shorts.sort((a, b) => b.views - a.views || (b.likes ?? 0) - (a.likes ?? 0));
  const top = shorts.slice(0, TOP_SHORTS).map((v, i) => ({ ...v, rank: i + 1 }));
  if (shorts.length) {
    const total = shorts.reduce((sum, v) => sum + v.views, 0);
    const topViews = top.reduce((sum, v) => sum + v.views, 0);
    notes.unshift(
      `Đã quét toàn bộ ${shorts.length} Shorts của kênh ${channel.title}. ${top.length} Shorts đứng đầu có ${Math.round((topViews / Math.max(1, total)) * 100)}% tổng lượt xem Shorts của kênh.`,
      "🏆 Điểm tương tác 0–100 so mỗi Short với toàn bộ Shorts của kênh (trung bình thứ hạng về lượt xem, lượt thích và bình luận).",
    );
  }
  const dates = shorts.map((v) => v.publishedAt).filter(Boolean).sort();
  const now = new Date().toISOString();
  rememberChannel({ ...channel, scannedAt: now, shorts: shorts.length });
  const result = saveDiscovery({
    label: `📌 Shorts nhiều lượt xem nhất của ${channel.title}`,
    // No country: a channel scan does not filter by language.
    options: parseDiscoverOptions({ country: "", format: "shorts", sort: "views", limit: TOP_SHORTS }),
    range: { from: dates[0] ?? now, to: now },
    videos: top,
    stats: { scanned: ids.length, matchedLanguage: shorts.length, matchedFormat: shorts.length, quotaUsed: api.quotaUsed },
    notes,
  });
  emit({ type: "step", step: "save", status: "done", message: `${top.length} Shorts · đã dùng ${api.quotaUsed} đơn vị quota` });
  return result;
}
