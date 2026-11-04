import { z } from "zod";

// The "video spec" is the contract between the analyzer (Claude or the basic
// fallback) and the Remotion templates. Every field is required on purpose:
// "absent" is expressed as "" or [] so the schema stays within structured
// output limits and the templates never deal with undefined.

export const FONTS = [
  "Be Vietnam Pro",
  "Montserrat",
  "Inter",
  "Nunito",
  "Oswald",
  "Anton",
  "Lexend",
  "Baloo 2",
  "Pacifico",
] as const;

export const TRANSITIONS = ["none", "fade", "slide-left", "slide-up", "wipe", "flip"] as const;
export const TEXT_ANIMATIONS = ["pop", "word-by-word", "typewriter", "slide-up", "fade"] as const;
export const BG_STYLES = ["solid", "linear", "radial", "blobs", "grid", "dots"] as const;
export const GENRES = [
  "quiz",
  "top-list",
  "facts",
  "quotes",
  "data-stats",
  "timeline",
  "text-story",
  "comparison",
  "mixed",
] as const;

const Color = z.string().describe("Hex color such as #FF3366");

const sceneBase = {
  durationSec: z
    .number()
    .describe("How long this scene is on screen, in seconds. Scene durations must add up to the source video length."),
  transition: z.enum(TRANSITIONS).catch("fade").describe("Transition used when this scene comes in (ignored for the first scene)."),
  background: z
    .array(Color)
    .describe("Per-scene background colors (1-3). Empty array = use the theme background."),
  narration: z
    .string()
    .catch("")
    .describe("Voice-over spoken while this scene is on screen, in the video's language. Empty string = silent scene."),
};

export const TitleSceneSchema = z.object({
  type: z.literal("title"),
  ...sceneBase,
  heading: z.string(),
  subheading: z.string().describe("Empty string if none."),
  emoji: z.string().describe("A single emoji shown above the heading, or empty string."),
});

export const TextSceneSchema = z.object({
  type: z.literal("text"),
  ...sceneBase,
  lines: z.array(z.string()).describe("Lines of on-screen text, shown one after another."),
  highlight: z.array(z.string()).describe("Words or short phrases from the lines to emphasize with the accent color."),
  animation: z.enum(TEXT_ANIMATIONS).catch("word-by-word"),
  align: z.enum(["center", "left"]).catch("center"),
  size: z.enum(["md", "lg", "xl"]).catch("lg"),
  emoji: z.string().describe("Optional emoji shown above the text, or empty string."),
});

export const ListItemSceneSchema = z.object({
  type: z.literal("list-item"),
  ...sceneBase,
  rank: z.string().describe('Rank label such as "#5" or "5".'),
  heading: z.string(),
  body: z.string().describe("Supporting sentence, or empty string."),
  emoji: z.string().describe("Emoji illustrating the item, or empty string."),
});

export const QuizSceneSchema = z.object({
  type: z.literal("quiz"),
  ...sceneBase,
  question: z.string(),
  options: z.array(z.string()).describe("2 to 4 answer options."),
  correctIndex: z.number().int().describe("0-based index of the correct option."),
  thinkSec: z.number().describe("Seconds of countdown before the answer is revealed."),
  explanation: z.string().describe("Short explanation shown after the reveal, or empty string."),
  emoji: z.string().describe("Emoji shown next to the question, or empty string."),
});

export const BarChartSceneSchema = z.object({
  type: z.literal("bar-chart"),
  ...sceneBase,
  heading: z.string(),
  unit: z.string().describe('Unit appended to values, e.g. "%", " triệu", or empty string.'),
  bars: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      color: z.string().describe("Hex color for this bar, or empty string to use the theme palette."),
    }),
  ),
});

export const BigNumberSceneSchema = z.object({
  type: z.literal("big-number"),
  ...sceneBase,
  prefix: z.string(),
  value: z.number(),
  decimals: z.number().int(),
  suffix: z.string(),
  label: z.string().describe("What the number means."),
});

export const QuoteSceneSchema = z.object({
  type: z.literal("quote"),
  ...sceneBase,
  text: z.string(),
  author: z.string().describe("Author, or empty string."),
});

export const TimelineSceneSchema = z.object({
  type: z.literal("timeline"),
  ...sceneBase,
  heading: z.string(),
  events: z.array(z.object({ time: z.string(), label: z.string() })),
});

export const CountdownSceneSchema = z.object({
  type: z.literal("countdown"),
  ...sceneBase,
  from: z.number().int().describe("Count down from this number to 1 (one number per second is typical)."),
  label: z.string(),
});

const ComparisonSide = z.object({ title: z.string(), points: z.array(z.string()) });

export const ComparisonSceneSchema = z.object({
  type: z.literal("comparison"),
  ...sceneBase,
  heading: z.string(),
  left: ComparisonSide,
  right: ComparisonSide,
  vsLabel: z.string().describe('Usually "VS".'),
});

export const OutroSceneSchema = z.object({
  type: z.literal("outro"),
  ...sceneBase,
  heading: z.string(),
  subheading: z.string(),
  cta: z.enum(["subscribe", "follow", "like", "none"]).catch("subscribe"),
  handle: z.string().describe("Channel handle such as @mychannel, or empty string."),
});

export const SceneSchema = z.union([
  TitleSceneSchema,
  TextSceneSchema,
  ListItemSceneSchema,
  QuizSceneSchema,
  BarChartSceneSchema,
  BigNumberSceneSchema,
  QuoteSceneSchema,
  TimelineSceneSchema,
  CountdownSceneSchema,
  ComparisonSceneSchema,
  OutroSceneSchema,
]);

export const ThemeSchema = z.object({
  font: z.enum(FONTS).catch("Be Vietnam Pro").describe("Closest match to the typeface used in the source video. All support Vietnamese."),
  bgStyle: z.enum(BG_STYLES).catch("blobs"),
  bgColors: z.array(Color).describe("1-3 background colors, darkest first."),
  textColor: Color,
  primary: Color.describe("Main brand color: badges, bars, buttons."),
  accent: Color.describe("Highlight color for emphasized words and numbers."),
  panel: Color.describe("Card/panel background color."),
  motion: z.enum(["energetic", "smooth", "minimal"]).catch("smooth").describe("energetic = bouncy springs; smooth = eased; minimal = subtle."),
  progressBar: z.boolean().describe("Thin progress bar along the top edge."),
  sfx: z.boolean().describe("Code-generated whoosh/tick/ding sound effects."),
  watermark: z.string().describe("Small channel handle shown in a corner, or empty string."),
});

// What the analyzer produces. Video size/fps are taken from the source file, not from the model.
export const AnalyzedSpecSchema = z.object({
  genre: z.enum(GENRES).catch("mixed"),
  theme: ThemeSchema,
  scenes: z.array(SceneSchema),
  notes: z
    .array(z.string())
    .describe("Things in the source that cannot be rebuilt with these templates (real footage, voice-over, music, photos) and how they were approximated."),
});

export const MetaSchema = z.object({
  width: z.number().int(),
  height: z.number().int(),
  fps: z.number().int(),
  language: z.string().describe("BCP-47 language code of the on-screen text, e.g. vi or en."),
});

/** A generated voice-over clip (ElevenLabs), played from the start of its scene. */
export const VoiceClipSchema = z.object({
  scene: z.number().int(),
  /** Path inside the render bundle's public folder, e.g. voice/<videoId>/3-ab12cd34.mp3. */
  src: z.string(),
  durationSec: z.number(),
  /** Word timings inside the clip (seconds), from ElevenLabs: karaoke captions and lip-sync. */
  words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })).catch([]),
});

export const VideoSpecSchema = AnalyzedSpecSchema.extend({ meta: MetaSchema, voiceover: z.array(VoiceClipSchema).catch([]) });

export type Scene = z.infer<typeof SceneSchema>;
export type SceneType = Scene["type"];
export type Theme = z.infer<typeof ThemeSchema>;
export type AnalyzedSpec = z.infer<typeof AnalyzedSpecSchema>;
export type VideoSpec = z.infer<typeof VideoSpecSchema>;
export type VoiceClip = z.infer<typeof VoiceClipSchema>;
export type FontName = (typeof FONTS)[number];
export type TransitionName = (typeof TRANSITIONS)[number];
export type TextAnimation = (typeof TEXT_ANIMATIONS)[number];
