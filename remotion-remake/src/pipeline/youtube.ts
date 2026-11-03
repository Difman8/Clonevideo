import fs from "node:fs";
import path from "node:path";
import { ffmpegPath, run, ytDlp } from "./tools";

const ytdlp = (args: string[], opts?: Parameters<typeof run>[2]) => {
  const { cmd, args: pre } = ytDlp();
  return run(cmd, [...pre, ...args], opts);
};

export type Chapter = { start_time: number; end_time: number; title: string };

export type YtInfo = {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  categories?: string[];
  channel?: string;
  uploader?: string;
  uploader_id?: string;
  channel_url?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  language?: string;
  thumbnail?: string;
  webpage_url?: string;
  view_count?: number;
  like_count?: number;
  upload_date?: string;
  chapters?: Chapter[] | null;
  subtitles?: Record<string, unknown[]>;
  automatic_captions?: Record<string, unknown[]>;
};

const ID_PATTERNS = [
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/))([\w-]{11})/i,
  /youtu\.be\/([\w-]{11})/i,
];

export function parseVideoId(url: string): string | null {
  for (const re of ID_PATTERNS) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
}

// yt-dlp needs a JavaScript runtime for YouTube; the Node running this app is enough.
const commonArgs = () => ["--no-playlist", "--no-warnings", "--js-runtimes", `node:${process.execPath}`, "--ffmpeg-location", ffmpegPath()];

export async function fetchInfo(url: string): Promise<YtInfo> {
  const { stdout } = await ytdlp(["-J", "--skip-download", ...commonArgs(), url]);
  const info = JSON.parse(stdout) as YtInfo & { formats?: unknown; requested_formats?: unknown; heatmap?: unknown };
  delete info.formats;
  delete info.requested_formats;
  delete info.heatmap;
  return info;
}

/** The fully downloaded source video (not a .part / fragment file), if any. */
export function downloadedSource(dir: string): string | null {
  const file = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => /^source\.[a-z0-9]+$/i.test(f)) : undefined;
  return file ? path.join(dir, file) : null;
}

/**
 * Downloads a ≤720p video-only stream: enough to look at, small to fetch.
 * With `resume`, a half-downloaded file is kept and yt-dlp continues it.
 */
export async function downloadVideo(info: YtInfo, dir: string, onLine: (l: string) => void, resume = false): Promise<string> {
  if (!resume) for (const f of fs.readdirSync(dir)) if (f.startsWith("source.")) fs.rmSync(path.join(dir, f));
  await ytdlp(["-f", "bv*/b", "-S", "res:720,vcodec:h264", "--newline", "--continue", "-o", path.join(dir, "source.%(ext)s"), ...commonArgs(), sourceUrl(info)], {
    onLine,
  });
  const file = downloadedSource(dir);
  if (!file) throw new Error("Tải video thất bại: không thấy file source.*");
  return file;
}

function pickSubtitleTrack(info: YtInfo): { key: string; auto: boolean } | null {
  const lang = (info.language || "").split("-")[0].toLowerCase();
  const manual = Object.keys(info.subtitles ?? {}).filter((k) => k !== "live_chat");
  const auto = Object.keys(info.automatic_captions ?? {});
  const manualHit = manual.find((k) => lang && k.toLowerCase().startsWith(lang)) ?? manual[0];
  if (manualHit) return { key: manualHit, auto: false };
  const autoHit =
    auto.find((k) => lang && k === `${lang}-orig`) ??
    auto.find((k) => lang && k === lang) ??
    auto.find((k) => k.endsWith("-orig"));
  return autoHit ? { key: autoHit, auto: true } : null;
}

/** Best-effort: returns the .vtt path, or null when the video has no usable captions. */
export async function downloadSubtitles(info: YtInfo, dir: string): Promise<string | null> {
  const track = pickSubtitleTrack(info);
  if (!track) return null;
  await ytdlp([
    "--skip-download",
    track.auto ? "--write-auto-subs" : "--write-subs",
    "--sub-langs",
    track.key,
    "--sub-format",
    "vtt",
    "-o",
    path.join(dir, "subs"),
    ...commonArgs(),
    sourceUrl(info),
  ]);
  const file = fs.readdirSync(dir).find((f) => f.startsWith("subs.") && f.endsWith(".vtt"));
  return file ? path.join(dir, file) : null;
}

export const sourceUrl = (info: YtInfo) => info.webpage_url || `https://www.youtube.com/watch?v=${info.id}`;
