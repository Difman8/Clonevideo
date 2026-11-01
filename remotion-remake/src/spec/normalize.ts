import { VideoSpecSchema, type AnalyzedSpec, type Scene, type VideoSpec } from "./schema";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const color = (value: string, fallback: string) => (HEX.test(value.trim()) ? value.trim() : fallback);
const colors = (values: string[], fallback: string[]) => {
  const ok = values.map((v) => v.trim()).filter((v) => HEX.test(v)).slice(0, 3);
  return ok.length ? ok : fallback;
};

function fixScene(scene: Scene): Scene {
  const s = { ...scene, durationSec: Math.max(0.5, Number(scene.durationSec) || 3) } as Scene;
  s.background = s.background.length ? colors(s.background, []) : [];
  switch (s.type) {
    case "quiz": {
      const options = s.options.filter((o) => o.trim()).slice(0, 4);
      return {
        ...s,
        options: options.length >= 2 ? options : [...options, "?", "?"].slice(0, 2),
        correctIndex: Math.min(Math.max(0, Math.round(s.correctIndex)), Math.max(0, options.length - 1)),
        thinkSec: Math.max(1, Math.min(s.thinkSec || 3, s.durationSec - 1)),
      };
    }
    case "bar-chart":
      return { ...s, bars: s.bars.slice(0, 10).map((b) => ({ ...b, value: Number(b.value) || 0, color: color(b.color, "") })) };
    case "countdown":
      return { ...s, from: Math.max(1, Math.min(Math.round(s.from) || 3, 60)) };
    case "big-number":
      return { ...s, value: Number(s.value) || 0, decimals: Math.max(0, Math.min(Math.round(s.decimals) || 0, 3)) };
    case "text":
      return { ...s, lines: s.lines.filter((l) => l.trim()).length ? s.lines.filter((l) => l.trim()) : [" "] };
    default:
      return s;
  }
}

/**
 * Makes an analyzer result safe to render: valid colors, sane numbers, and
 * scene durations rescaled so the remake has the same length as the source.
 */
export function finalizeSpec(
  analyzed: AnalyzedSpec,
  meta: VideoSpec["meta"],
  targetDurationSec?: number,
): VideoSpec {
  const t = analyzed.theme;
  const theme = {
    ...t,
    bgColors: colors(t.bgColors, ["#0F172A", "#1E293B"]),
    textColor: color(t.textColor, "#FFFFFF"),
    primary: color(t.primary, "#6366F1"),
    accent: color(t.accent, "#FACC15"),
    panel: color(t.panel, "#1E293B"),
  };
  let scenes = analyzed.scenes.map(fixScene);
  if (!scenes.length) {
    scenes = [
      { type: "title", durationSec: targetDurationSec || 5, transition: "none", background: [], heading: " ", subheading: "", emoji: "" },
    ];
  }
  const sum = scenes.reduce((a, s) => a + s.durationSec, 0);
  if (targetDurationSec && targetDurationSec > 1 && Math.abs(sum - targetDurationSec) / targetDurationSec > 0.03) {
    const k = targetDurationSec / sum;
    scenes = scenes.map((s) => ({ ...s, durationSec: Math.max(0.5, +(s.durationSec * k).toFixed(2)) }));
  }
  return VideoSpecSchema.parse({ ...analyzed, theme, scenes, meta: normalizeMeta(meta) });
}

export function normalizeMeta(meta: VideoSpec["meta"]): VideoSpec["meta"] {
  // H.264 needs even dimensions; keep the source aspect ratio but cap the long side at 1920.
  let { width, height } = meta;
  if (!width || !height) [width, height] = [1080, 1920];
  const scale = Math.min(1, 1920 / Math.max(width, height));
  const minSide = Math.min(width, height) * scale;
  const up = minSide < 1080 ? 1080 / minSide : 1;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const fps = Math.round(meta.fps) || 30;
  return {
    width: even(Math.min(width * scale * up, 3840)),
    height: even(Math.min(height * scale * up, 3840)),
    fps: Math.min(Math.max(fps, 24), 60),
    language: meta.language || "vi",
  };
}
