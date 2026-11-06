import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import type { VideoSpec } from "../spec/schema";
import { isStoryboard, storyboardTimeline, type Storyboard } from "../spec/storyboard";
import { ensureSfx } from "./sfx";
import { browserExecutable, PUBLIC_DIR, ROOT } from "./tools";

let bundled: Promise<string> | null = null;

/** Webpack bundle of src/remotion, built once per process. */
function getBundle(): Promise<string> {
  if (!bundled) {
    ensureSfx(PUBLIC_DIR);
    bundled = bundle({ entryPoint: path.join(ROOT, "src/remotion/index.ts"), publicDir: PUBLIC_DIR }).catch((e) => {
      bundled = null;
      throw e;
    });
  }
  return bundled;
}

/**
 * Renders the spec to `outputLocation`. `publicFiles` (e.g. voice clips made
 * after the bundle was built) are copied into the bundle's public folder, which
 * is where staticFile() points. The video is written to a temporary file and
 * renamed at the end, so an interrupted render never leaves a broken MP4.
 */
export async function renderSpec(
  spec: VideoSpec | Storyboard,
  outputLocation: string,
  onProgress: (p: number) => void,
  publicFiles: { from: string; to: string }[] = [],
): Promise<void> {
  const serveUrl = await getBundle();
  for (const f of publicFiles) {
    if (!fs.existsSync(f.from)) continue;
    const dest = path.join(serveUrl, "public", f.to);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(f.from, dest, { recursive: true });
  }
  const partial = `${outputLocation}.part.mp4`;
  const browser = await browserExecutable();
  const inputProps = spec as unknown as Record<string, unknown>;
  // Fedtoon storyboards and classic text specs have their own compositions (src/remotion/Root.tsx).
  const composition = await selectComposition({ serveUrl, id: isStoryboard(spec) ? "Fedtoon" : "Remake", inputProps, browserExecutable: browser });
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    imageFormat: "jpeg",
    jpegQuality: 100,
    outputLocation: partial,
    inputProps,
    browserExecutable: browser,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct !== last) {
        last = pct;
        onProgress(progress);
      }
    },
  });
  await replaceFile(partial, outputLocation);
}

/**
 * One frame of a shot, with the storyboard as edited so far. Late in the shot, when
 * everything has entered. No AI is involved: this is the same drawing as the video.
 */
export async function renderShotPreview(sb: Storyboard, shot: number, publicFiles: { from: string; to: string }[]): Promise<Buffer> {
  const serveUrl = await getBundle();
  // Only adds what is new (a picture just drawn), so previews stay fast and never disturb each other.
  for (const f of publicFiles) if (fs.existsSync(f.from)) fs.cpSync(f.from, path.join(serveUrl, "public", f.to), { recursive: true, force: false });
  const browser = await browserExecutable();
  const inputProps = sb as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "Fedtoon", inputProps, browserExecutable: browser });
  const tl = storyboardTimeline(sb);
  const frame = Math.min(tl.start[shot] + Math.round(tl.base[shot] * 0.7), composition.durationInFrames - 1);
  const { buffer } = await renderStill({ composition, serveUrl, inputProps, frame, imageFormat: "jpeg", jpegQuality: 85, scale: 0.5, browserExecutable: browser });
  if (!buffer) throw new Error("Không tạo được ảnh xem trước.");
  return buffer;
}

/** Windows refuses to replace a file another program has open, so a brief hold is waited out. */
async function replaceFile(from: string, to: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") throw e;
      if (attempt === 20) throw new Error(`Đã render xong nhưng không thay được ${path.basename(to)} vì file đang mở ở chương trình khác (trình phát video, trình tải xuống…). Đóng chương trình đó rồi render lại. Bản mới đang nằm ở ${path.basename(from)}.`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
