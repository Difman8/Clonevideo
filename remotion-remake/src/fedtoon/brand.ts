// Fedtoon brand kit: shared by the pipeline (image prompts) and the Remotion
// composition (colors, font). Flat-vector explainer look: vivid saturated flat
// colors, rounded geometric shapes, no outlines, no drop shadows, no glow.
// A background color is never the exact same color as a character (contrast.ts).
// Fedtoon has its own mascot (Fed, drawn by the channel owner: assets/mascot/)
// and logo; it does not reuse another channel's characters or marks.

export const BRAND_NAME = "Fedtoon";

/** Named colors: the storyboard refers to them by name, the renderer maps them to hex. */
export const PALETTE = {
  night: "#140B2E",
  plum: "#2A1050",
  indigo: "#3A2C8C",
  violet: "#5B2A9E",
  purple: "#7B3FE4",
  magenta: "#D62E9E",
  pink: "#F06BB4",
  coral: "#FF5A6E",
  orange: "#F7862A",
  amber: "#FFB627",
  yellow: "#FFD84D",
  lime: "#C4EF3C",
  green: "#119A4B",
  mint: "#6EE7C8",
  teal: "#00B6B7", // = Fed's shirt (MASCOT_RIG.colors.shirt)
  cyan: "#18D8F2",
  sky: "#6FC8F5",
  blue: "#4F6FFA",
  navy: "#1E2A6E",
  cream: "#FFF1DC",
  white: "#FFFFFF",
  gray: "#9AA3C7",
  ink: "#120A24",
} as const;
export type ColorName = keyof typeof PALETTE;
export const COLOR_NAMES = Object.keys(PALETTE) as [ColorName, ...ColorName[]];

export const SKIN = { light: "#FFC9B0", tan: "#F2A08F", brown: "#C9805A", dark: "#8A5034" } as const;
export const HAIR_COLORS = { black: "#25205C", brown: "#6B3A2A", blonde: "#F4C75E", red: "#D2502C", gray: "#C2C6D6", blue: "#4F6FFA", pink: "#F06BB4" } as const;

/** Background color pairs offered to the AI as examples. */
export const BACKGROUND_SETS: ColorName[][] = [
  ["plum", "violet"],
  ["cyan", "sky"],
  ["green", "lime"],
  ["magenta", "pink"],
  ["navy", "indigo"],
  ["orange", "amber"],
  ["blue", "sky"],
  ["night", "purple"],
  ["yellow", "amber"],
];

/** Background moods: decide the shapes of the fallback backdrop (sky, hills, stars, room…). */
export const MOODS = {
  night: { colors: ["night", "plum"], glow: "yellow" },
  day: { colors: ["cyan", "green"], glow: "yellow" },
  sunset: { colors: ["violet", "orange"], glow: "yellow" },
  space: { colors: ["night", "violet"], glow: "cream" },
  indoor: { colors: ["indigo", "blue"], glow: "amber" },
  abstract: { colors: ["magenta", "purple"], glow: "lime" },
} as const satisfies Record<string, { colors: ColorName[]; glow: ColorName }>;
export type Mood = keyof typeof MOODS;

export const BRAND_FONT = "Nunito" as const;

/**
 * Art direction prepended to every image prompt. Editable in the Settings tab
 * (FEDTOON_IMAGE_STYLE) to fine-tune the look without changing code.
 */
export const DEFAULT_IMAGE_STYLE =
  "Flat 2D vector illustration for an animated science explainer. Bold, vivid, saturated colors (magenta, violet, deep purple, cyan, lime green, " +
  "yellow, orange, royal blue) filled as solid flat areas. Simple rounded geometric shapes, no outlines. Shading only as a few flat darker shapes " +
  "inside objects. No drop shadows, no cast shadows, no glow, no bloom, no lens effects, no vignette, no texture or grain. Clean layered depth " +
  "(foreground, middle, background) with each layer in its own flat color. " +
  "Absolutely no text, letters, numbers, logos or watermarks.";
