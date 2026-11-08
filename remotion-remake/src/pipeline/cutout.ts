// Transparent props from Google: its image models cannot paint transparency, so a prop is drawn
// on a flat green screen and the green is removed here, on the computer (no paid cut-out API).
// ffmpeg (already used by the app) decodes and encodes the pictures; the keying is plain JS.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ffmpegPath, run } from "./tools";

/** The background asked for: pure green is far from every color of the channel's palette (closest: green #119A4B). */
export const GREEN_SCREEN = "#00FF00";

/** Below this distance from the screen color a pixel touching it is background. */
const FLOOD = 75;
/** Pixels this close to the screen color are background anywhere (e.g. the hole inside a handle). */
const ANYWHERE = 40;
/** Edge pixels with no clear object color nearby fade from transparent at FLOOD / 2 to opaque at this distance. */
const OPAQUE = 150;
/** Width of the outline (px) treated as possibly mixed with the screen: JPEG blurs color over ~2-3 px. */
const EDGE = 3;
/** How far in (px) a slight green cast on neutral colors is removed. */
const SPILL = 6;

async function decode(file: string, raw: string): Promise<{ w: number; h: number; px: Buffer }> {
  const { stderr } = await run(ffmpegPath(), ["-hide_banner", "-y", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", raw]);
  const [, w, h] = stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/) ?? [];
  if (!w || !h) throw new Error("Không đọc được ảnh đồ vật Google trả về.");
  return { w: Number(w), h: Number(h), px: fs.readFileSync(raw) };
}

/** Removes the flat background around a prop and returns a transparent PNG. */
export async function cutOutGreenScreen(data: Buffer): Promise<Buffer> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fedtoon-cut-"));
  try {
    const src = path.join(tmp, "src.img");
    fs.writeFileSync(src, data);
    const { w, h, px } = await decode(src, path.join(tmp, "in.rgba"));
    const n = w * h;

    // The screen color as actually painted: the median of the border (models drift a little from pure green).
    const border: number[] = [];
    for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
    for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
    const median = (c: number) => border.map((i) => px[i * 4 + c]).sort((a, b) => a - b)[border.length >> 1];
    const key = [median(0), median(1), median(2)];
    const dist = new Float32Array(n);
    for (let i = 0; i < n; i++) dist[i] = Math.hypot(px[i * 4] - key[0], px[i * 4 + 1] - key[1], px[i * 4 + 2] - key[2]);

    // Background: everything screen-colored connected to the border, plus near-exact screen color anywhere.
    const bg = new Uint8Array(n);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;
    for (const i of border) if (!bg[i] && dist[i] < FLOOD) (bg[i] = 1), (queue[tail++] = i);
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < n && !bg[j] && dist[j] < FLOOD) (bg[j] = 1), (queue[tail++] = j);
      }
    }
    for (let i = 0; i < n; i++) if (dist[i] < ANYWHERE) bg[i] = 1;

    // The outline. Google answers in JPEG, whose color blur mixes some green into the object's first
    // pixels: each pixel within EDGE px of the background is matched to the object color just inside
    // it, gets the share of that color as its alpha and that color without the green (no fringe).
    // Distance (px, 4-neighbour steps) of each pixel from the background, up to SPILL.
    const ring = new Uint8Array(n).fill(255);
    let frontier: number[] = [];
    for (let i = 0; i < n; i++) if (bg[i]) (ring[i] = 0), frontier.push(i);
    for (let d = 1; d <= SPILL; d++) {
      const next: number[] = [];
      for (const i of frontier) {
        const x = i % w;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < n && ring[j] === 255) (ring[j] = d), next.push(j);
      }
      frontier = next;
    }
    const near = Uint8Array.from(ring, (d) => (d <= EDGE ? 1 : 0));
    const out = Buffer.from(px);
    const clear = (o: number) => (out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (bg[i]) {
        clear(o);
        continue;
      }
      if (!near[i]) continue;
      // The nearest object pixel that the blur did not reach.
      const x = i % w;
      const y = (i - x) / w;
      let inner = -1;
      let best = Infinity;
      for (let dy = -EDGE - 1; dy <= EDGE + 1; dy++) {
        for (let dx = -EDGE - 1; dx <= EDGE + 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          const d2 = dx * dx + dy * dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h || d2 >= best) continue;
          const j = yy * w + xx;
          if (!near[j]) (inner = j), (best = d2);
        }
      }
      const v = inner < 0 ? null : [px[inner * 4] - key[0], px[inner * 4 + 1] - key[1], px[inner * 4 + 2] - key[2]];
      const len2 = v ? v[0] * v[0] + v[1] * v[1] + v[2] * v[2] : 0;
      if (v && len2 > 60 * 60) {
        const p = [px[o] - key[0], px[o + 1] - key[1], px[o + 2] - key[2]];
        const a = Math.min(1, Math.max(0, (p[0] * v[0] + p[1] * v[1] + p[2] * v[2]) / len2));
        // Only a true mix of the object color and the screen; another color (a detail at the edge) stays as drawn.
        const miss = Math.hypot(p[0] - a * v[0], p[1] - a * v[1], p[2] - a * v[2]);
        if (miss < 60) {
          if (a <= 0.04) clear(o);
          else if (a < 0.97) {
            for (let c = 0; c < 3; c++) out[o + c] = px[inner * 4 + c];
            out[o + 3] = Math.round(a * 255);
          }
          continue;
        }
      }
      // No clear object color nearby: fade by distance from the screen color and take the green out.
      const a = Math.min(1, Math.max(0, (dist[i] - FLOOD / 2) / (OPAQUE - FLOOD / 2)));
      if (a <= 0.02) {
        clear(o);
        continue;
      }
      for (let c = 0; c < 3; c++) out[o + c] = Math.min(255, Math.max(0, Math.round((px[o + c] - (1 - a) * key[c]) / a)));
      out[o + 3] = Math.round(a * px[o + 3]);
    }

    // The JPEG blur also tints light neutral colors (white paper, gray metal) a little green a few px
    // further in. Near the edge, a neutral color with a slight green cast loses it; real greens
    // (leaves, lime, mint: strongly green or with red far from blue) are kept.
    for (let i = 0; i < n; i++) {
      if (ring[i] === 0 || ring[i] > SPILL) continue;
      const o = i * 4;
      const [r, g, b] = [out[o], out[o + 1], out[o + 2]];
      const cast = g - Math.max(r, b);
      if (out[o + 3] && cast > 0 && cast < 50 && Math.abs(r - b) < 40 && Math.max(r, b) > 110) out[o + 1] = Math.max(r, b);
    }

    const raw = path.join(tmp, "out.rgba");
    const png = path.join(tmp, "out.png");
    fs.writeFileSync(raw, out);
    await run(ffmpegPath(), ["-hide_banner", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${w}x${h}`, "-i", raw, "-frames:v", "1", png]);
    return fs.readFileSync(png);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
