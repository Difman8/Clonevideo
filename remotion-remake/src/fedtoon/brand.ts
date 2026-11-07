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

// People's colors follow the channel's character sheet (assets/cast/reference.png).
export const SKIN = { light: "#FEC59B", tan: "#E99762", brown: "#CA7248", dark: "#8E4F2E" } as const;
export const HAIR_COLORS = { black: "#101641", brown: "#703823", blonde: "#FEBE1E", red: "#D2502C", gray: "#ECEDF2", blue: "#4F6FFA", pink: "#F06BB4" } as const;

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
  "Flat 2D vector illustration for a cute, playful animated science short. Clean geometric shapes with soft rounded corners, solid flat fills, " +
  "no outlines; volume only from one slightly darker flat tone inside a shape. Bold, saturated, high-contrast colors: deep purple and violet " +
  "night or abstract scenes with magenta, hot pink and lime-green accents; bright cyan skies over smooth rolling green hills with simple " +
  "dark-green bushes and grass tufts; warm yellow and orange suns. Depth made of a few overlapping flat layers (foreground, middle, background), " +
  "each in its own flat color, far layers softer and less saturated. Objects are simple bold shapes; when an object has a face it is cute and " +
  "simple: large round white eyes with black pupils and a small white highlight, a small simple mouth, rosy cheeks optional. " +
  "No drop shadows, no cast shadows, no glow, no bloom, no gradients, no lens effects, no vignette, no texture or grain, no photorealism, no 3D. " +
  "Absolutely no text, letters, numbers, logos or watermarks.";

/**
 * Sent with the style reference images (assets/style/: the channel's own characters by default) so
 * the image model draws backgrounds and props in the same hand as the characters, without them.
 */
export const STYLE_REFERENCE_NOTE =
  "The attached image(s) are a STYLE GUIDE only: the channel's own characters. Draw a completely new picture in exactly the same art style: " +
  "the same flat colors and simple flat shading, the same soft rounded shapes and proportions, the same line work, the same cute face style " +
  "and the same level of detail, so that these characters would look at home in it. Do not draw, copy or include any of these characters, " +
  "do not reuse their poses, layout or plain background.";

/**
 * Google's image models follow the reference picture more than the words and tend to skip "no ..." lists:
 * scenes they draw came out with outlines and soft shading. So for Google the flat look is described as
 * what to draw, before the shared style text, and the character sheet is only a palette and shape guide.
 */
export const GEMINI_FLAT_STYLE =
  "Art direction: a flat vector illustration built only from solid-color shapes, like shapes cut from colored paper and laid side by side. " +
  "Neighbouring shapes touch directly and are told apart only by their colors, so the picture has no line art at all: no outline strokes, " +
  "not even thin dark edges around trees, bushes, hills, furniture, clouds or buildings. Every shape is filled with one even color from edge to edge. " +
  "Where an object needs volume it gets a single slightly darker flat shape of the same hue, with a crisp hard edge. Light from lamps, the sun or " +
  "windows is drawn as flat lighter shapes with crisp edges, never as a soft glow, airbrush, gradient or shadow.";

/** Sent with the style reference images to Google instead of STYLE_REFERENCE_NOTE. */
export const GEMINI_STYLE_REFERENCE_NOTE =
  "The attached image is the channel's character sheet, a guide only for the color palette, the soft rounded shapes and the cute simple faces. " +
  "Do not draw these characters, their poses or their plain background. The scene is even flatter than these characters: it has none of their " +
  "thin edge lines and none of the shaded folds on their clothes.";
