// Dev helper: renders one still per scene of the sample spec into out/stills/ for a visual check.
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { sampleSpec } from "../src/remotion/sample";
import { computeTimeline } from "../src/spec/timeline";
import { ensureSfx } from "../src/pipeline/sfx";
import { browserExecutable, ROOT as root } from "../src/pipeline/tools";

ensureSfx(path.join(root, "public"));
const browser = await browserExecutable();
const serveUrl = await bundle({ entryPoint: path.join(root, "src/remotion/index.ts"), publicDir: path.join(root, "public") });
const inputProps = sampleSpec;
const composition = await selectComposition({ serveUrl, id: "Remake", inputProps, browserExecutable: browser });
const t = computeTimeline(sampleSpec);
for (let i = 0; i < sampleSpec.scenes.length; i++) {
  const frame = t.start[i] + Math.round(t.base[i] * 0.85);
  const output = path.join(root, "out/stills", `${String(i).padStart(2, "0")}-${sampleSpec.scenes[i].type}.jpeg`);
  await renderStill({ composition, serveUrl, inputProps, frame, output, imageFormat: "jpeg", scale: 0.5, browserExecutable: browser });
  console.log("still", output);
}
