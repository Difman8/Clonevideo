import type { VideoSpec } from "./schema";

export type Timeline = {
  /** Visible length of each scene in frames (what the analyzer asked for). */
  base: number[];
  /** Transition overlap coming INTO scene i (0 for the first scene or "none"). */
  trans: number[];
  /** Length of each TransitionSeries.Sequence: base + the overlap of the next transition. */
  seq: number[];
  /** Frame where scene i becomes fully visible. */
  start: number[];
  total: number;
};

// Each sequence is lengthened by the next transition's overlap, so the total
// equals the sum of scene durations and every scene starts exactly where the
// source video's scene started.
export function computeTimeline(spec: Pick<VideoSpec, "scenes" | "meta">): Timeline {
  const fps = spec.meta.fps;
  const maxTrans = Math.round(fps * 0.4);
  const base = spec.scenes.map((s) => Math.max(Math.round(s.durationSec * fps), Math.round(fps * 0.5)));
  const trans = spec.scenes.map((s, i) =>
    i === 0 || s.transition === "none"
      ? 0
      : Math.min(maxTrans, Math.floor(base[i - 1] / 2), Math.floor(base[i] / 2)),
  );
  const seq = base.map((b, i) => b + (trans[i + 1] ?? 0));
  const start: number[] = [];
  let acc = 0;
  for (const b of base) {
    start.push(acc);
    acc += b;
  }
  return { base, trans, seq, start, total: Math.max(acc, 1) };
}
