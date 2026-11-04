// Color contrast between subjects (characters) and backgrounds, measured as
// CIE76 ΔE in Lab space: ~0 = same color, > ~35 = clearly different colors.
// Shared by the pipeline and the Remotion composition (no Node APIs).
import { BACKGROUND_SETS, PALETTE, SKIN, type ColorName } from "./brand";
import type { CastMember } from "../spec/storyboard";

/** Below this ΔE a character would melt into the background. */
export const MIN_CONTRAST = 38;

function lab(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** The colors that make a character recognisable: body/outfit (and skin for people). */
export function subjectColors(member: CastMember): string[] {
  const outfit = PALETTE[member.outfit] ?? PALETTE.teal;
  return member.kind === "mascot" ? [outfit] : [outfit, SKIN[member.skin] ?? SKIN.tan];
}

/** Smallest ΔE between any subject color and any background color. */
export function minContrast(subjects: string[], background: string[]): number {
  let min = Infinity;
  for (const s of subjects) for (const b of background) min = Math.min(min, deltaE(s, b));
  return min;
}

/**
 * Background colors for a shot: the requested ones if they contrast with every
 * character on screen, otherwise the set from BACKGROUND_SETS that contrasts most.
 */
export function contrastingBackground(requested: ColorName[], subjects: string[]): ColorName[] {
  const hex = (names: ColorName[]) => names.map((n) => PALETTE[n]);
  if (requested.length && (!subjects.length || minContrast(subjects, hex(requested)) >= MIN_CONTRAST)) return requested;
  if (!subjects.length) return BACKGROUND_SETS[0];
  let best = BACKGROUND_SETS[0];
  let bestScore = -1;
  for (const set of BACKGROUND_SETS) {
    // Keep the AI's choice of hue family when one of its colors is in the set.
    const score = minContrast(subjects, hex(set)) + (set.some((c) => requested.includes(c)) ? 6 : 0);
    if (score > bestScore) [best, bestScore] = [set, score];
  }
  return best;
}

/** A flat color that stands out against both `a` and `b` (for a disc behind a character). */
export function standOutColor(a: string, b: string): string {
  let best: string = PALETTE.white;
  let bestScore = -1;
  for (const name of Object.keys(PALETTE) as ColorName[]) {
    const c = PALETTE[name];
    const score = Math.min(deltaE(c, a), deltaE(c, b));
    if (score > bestScore) [best, bestScore] = [c, score];
  }
  return best;
}
