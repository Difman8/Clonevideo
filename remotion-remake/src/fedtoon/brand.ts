// Fedtoon brand kit: shared by the pipeline (image prompts) and the Remotion
// composition (colors, font). Flat-vector explainer look: deep navy/indigo
// worlds lit by warm glowing accents, rounded geometric shapes, no outlines.
// Fedtoon has its own mascot and logo; it does not reuse another channel's
// characters or marks.

export const BRAND_NAME = "Fedtoon";

/** Named colors: the storyboard refers to them by name, the renderer maps them to hex. */
export const PALETTE = {
  night: "#0B1633",
  navy: "#13285A",
  indigo: "#2C3D8F",
  blue: "#3D7DD8",
  sky: "#7EC8F2",
  teal: "#16B8A6",
  mint: "#7CE7D2",
  green: "#5BC26A",
  yellow: "#FFD15C",
  amber: "#FFAA2B",
  orange: "#FF7B3A",
  coral: "#FF5D73",
  pink: "#F472B6",
  purple: "#9B6BFF",
  cream: "#FFF3DE",
  white: "#FFFFFF",
  gray: "#9AA7C7",
  ink: "#0A1024",
} as const;
export type ColorName = keyof typeof PALETTE;
export const COLOR_NAMES = Object.keys(PALETTE) as [ColorName, ...ColorName[]];

export const SKIN = { light: "#FFD9C2", tan: "#F2B48C", brown: "#C98458", dark: "#8A5534" } as const;
export const HAIR_COLORS = { black: "#1B1B2F", brown: "#5B3A29", blonde: "#F2C46D", red: "#C4502E", gray: "#B8BCC8", blue: "#3D7DD8", pink: "#F472B6" } as const;

/** Background moods: the fallback backdrop (drawn in code) and the image prompt both use them. */
export const MOODS = {
  night: { sky: ["#0B1633", "#2C3D8F"], glow: "#FFD15C", ground: "#13285A" },
  day: { sky: ["#3D7DD8", "#7EC8F2"], glow: "#FFF3DE", ground: "#16B8A6" },
  sunset: { sky: ["#2C3D8F", "#FF7B3A"], glow: "#FFD15C", ground: "#13285A" },
  space: { sky: ["#05091C", "#2C1B5E"], glow: "#9B6BFF", ground: "#13285A" },
  indoor: { sky: ["#13285A", "#3D7DD8"], glow: "#FFAA2B", ground: "#0B1633" },
  abstract: { sky: ["#2C3D8F", "#9B6BFF"], glow: "#7CE7D2", ground: "#13285A" },
} as const;
export type Mood = keyof typeof MOODS;

export const BRAND_FONT = "Nunito" as const;

/**
 * Art direction prepended to every image prompt. Editable in the Settings tab
 * (FEDTOON_IMAGE_STYLE) to fine-tune the look without changing code.
 */
export const DEFAULT_IMAGE_STYLE =
  "Flat 2D vector illustration for an animated science explainer. Clean geometric shapes with rounded corners, no outlines, " +
  "smooth soft gradients and a very subtle grain texture. Rich saturated colors: a deep navy and indigo base lit by glowing warm accents " +
  "(amber, coral, yellow) and cool teal and mint highlights. Soft rim light and gentle glow, simple stylized forms, minimal detail, " +
  "strong depth with layered foreground and background, cinematic composition. Absolutely no text, letters, numbers, logos or watermarks.";
