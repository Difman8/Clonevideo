import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { VideoSpec } from "../spec/schema";
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
  spec: VideoSpec,
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
  const composition = await selectComposition({ serveUrl, id: "Remake", inputProps, browserExecutable: browser });
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    imageFormat: "jpeg",
    jpegQuality: 90,
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
  fs.renameSync(partial, outputLocation);
}
