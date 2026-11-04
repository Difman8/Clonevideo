// Background colors vs characters: the only rule is that a background color is
// never the exact same color (same hex code) as a character on screen.
// Everything else is left as the AI chose it. Shared by the pipeline and the
// Remotion composition (no Node APIs).
import { HAIR_COLORS, PALETTE, SKIN, type ColorName } from "./brand";
import { MASCOT_RIG } from "./mascot-rig";
import type { CastMember } from "../spec/storyboard";

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

/** CIE76 color distance: 0 = identical. Used to pick readable text colors. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Hex codes a character is drawn with: outfit, skin and hair (Fed's come from his drawing). */
export function characterColors(member: CastMember): string[] {
  if (member.kind === "mascot") return [MASCOT_RIG.colors.shirt, MASCOT_RIG.colors.skin, MASCOT_RIG.colors.hair];
  const outfit = PALETTE[member.outfit] ?? PALETTE.teal;
  const hair = member.hair === "bald" || member.hair === "cap" ? [] : [HAIR_COLORS[member.hairColor] ?? HAIR_COLORS.black];
  return [outfit, SKIN[member.skin] ?? SKIN.tan, ...hair];
}

/**
 * Background colors with every color that is exactly a character's color
 * replaced by the closest palette color that is not; other colors are kept.
 */
export function withoutCharacterColors(colors: ColorName[], characters: string[]): ColorName[] {
  const taken = new Set(characters.map((c) => c.toUpperCase()));
  const clash = (name: ColorName) => taken.has(PALETTE[name].toUpperCase());
  const out: ColorName[] = [];
  for (const c of colors) {
    let pick = c;
    if (clash(c)) {
      const others = (Object.keys(PALETTE) as ColorName[]).filter((n) => !clash(n) && !out.includes(n) && !colors.includes(n));
      pick = others.sort((a, b) => deltaE(PALETTE[a], PALETTE[c]) - deltaE(PALETTE[b], PALETTE[c]))[0] ?? c;
    }
    if (!out.includes(pick)) out.push(pick);
  }
  return out;
}
