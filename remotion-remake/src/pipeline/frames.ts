import fs from "node:fs";
import path from "node:path";
import { ffmpegPath, run } from "./tools";

export type Frame = { file: string; t: number };

const MAX_FRAMES = 60;

/**
 * Samples keyframes: the first frame, every scene change, and at least one
 * frame every `step` seconds. Timestamps come from ffmpeg's showinfo filter.
 */
export async function extractFrames(video: string, dir: string, durationSec: number): Promise<Frame[]> {
  const out = path.join(dir, "frames");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const step = Math.min(8, Math.max(1, durationSec / 30)).toFixed(2);
  const filter = [
    `select='isnan(prev_selected_t)+gt(scene,0.3)+gte(t-prev_selected_t,${step})'`,
    `scale='if(gt(iw,ih),768,-2)':'if(gt(iw,ih),-2,768)'`,
    "showinfo",
  ].join(",");
  const { stderr } = await run(ffmpegPath(), [
    "-hide_banner",
    "-i",
    video,
    "-vf",
    filter,
    "-fps_mode",
    "vfr",
    "-q:v",
    "4",
    path.join(out, "f_%04d.jpg"),
  ]);
  const times = [...stderr.matchAll(/Parsed_showinfo.*?pts_time:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  let frames = times
    .map((t, i) => ({ t, file: path.join(out, `f_${String(i + 1).padStart(4, "0")}.jpg`) }))
    .filter((f) => fs.existsSync(f.file));

  if (frames.length > MAX_FRAMES) {
    const keep = new Set(Array.from({ length: MAX_FRAMES }, (_, i) => Math.round((i * (frames.length - 1)) / (MAX_FRAMES - 1))));
    frames.forEach((f, i) => !keep.has(i) && fs.rmSync(f.file));
    frames = frames.filter((_, i) => keep.has(i));
  }
  return frames;
}

type Rgb = [number, number, number];

const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

function hsl([r, g, b]: Rgb) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/** Rough palette from the keyframes, used by the basic analyzer (no AI). */
export async function framePalette(frames: Frame[]): Promise<{ bg: string[]; primary: string; accent: string } | null> {
  const picks = frames.filter((_, i) => i % Math.max(1, Math.floor(frames.length / 8)) === 0).slice(0, 8);
  const pixels: Rgb[] = [];
  for (const f of picks) {
    const { stdout } = await runRaw(f.file);
    for (let i = 0; i + 2 < stdout.length; i += 3) pixels.push([stdout[i], stdout[i + 1], stdout[i + 2]]);
  }
  if (!pixels.length) return null;
  const byLight = [...pixels].sort((a, b) => hsl(a).l - hsl(b).l);
  const dark = byLight.slice(0, Math.max(1, Math.floor(byLight.length * 0.3)));
  const avg = (list: Rgb[]): Rgb => list.reduce<Rgb>((acc, p) => [acc[0] + p[0] / list.length, acc[1] + p[1] / list.length, acc[2] + p[2] / list.length], [0, 0, 0]);
  const vivid = pixels
    .map((p) => ({ p, ...hsl(p) }))
    .filter((x) => x.l > 0.35 && x.l < 0.8 && x.s > 0.35)
    .sort((a, b) => b.s - a.s);
  const accent = vivid[0];
  const primary = vivid.find((x) => accent && Math.min(Math.abs(x.h - accent.h), 360 - Math.abs(x.h - accent.h)) > 40);
  const bg0 = avg(dark);
  const bg1 = avg(byLight.slice(Math.floor(byLight.length * 0.3), Math.floor(byLight.length * 0.5)));
  // Keep the background dark enough for white text.
  const darken = (c: Rgb, max: number): Rgb => {
    const l = hsl(c).l;
    return l > max ? (c.map((v) => (v * max) / l) as Rgb) : c;
  };
  return {
    bg: [toHex(darken(bg0, 0.18)), toHex(darken(bg1, 0.32))],
    primary: primary ? toHex(primary.p) : accent ? toHex(accent.p) : "#6366F1",
    accent: accent ? toHex(accent.p) : "#FACC15",
  };
}

async function runRaw(file: string): Promise<{ stdout: Buffer }> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-i", file, "-vf", "scale=8:8", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.on("error", reject);
    child.on("close", () => resolve({ stdout: Buffer.concat(chunks) }));
  });
}
