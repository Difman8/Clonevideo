import { z } from "zod";
import { COLOR_NAMES, HAIR_COLORS, MOODS, SKIN, type ColorName } from "../fedtoon/brand";
import { RECURRING_CAST } from "../fedtoon/cast";
import { characterColors, withoutCharacterColors } from "../fedtoon/contrast";
import { MetaSchema, VoiceClipSchema } from "./schema";

// The "Fedtoon" storyboard: the contract between the AI (which writes it), the
// image generator (backgrounds and props) and the Remotion composition
// src/remotion/fedtoon/FedtoonVideo.tsx. Like schema.ts, every field the AI
// fills is required ("" / [] when unused) to stay within structured-output limits.

export const POSITIONS = ["far-left", "left", "center", "right", "far-right"] as const;
export const SCALES = ["small", "medium", "large"] as const;
export const ACTIONS = ["idle", "talk", "wave", "point", "walk", "jump", "think", "cheer", "shrug"] as const;
export const EXPRESSIONS = ["neutral", "happy", "sad", "surprised", "angry", "thinking"] as const;
export const CAMERAS = ["static", "zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down", "shake"] as const;
export const SHOT_TRANSITIONS = ["cut", "fade", "slide", "wipe"] as const;
export const PROP_MOTIONS = ["float", "pop", "spin", "pulse", "none"] as const;
export const TEXT_STYLES = ["none", "title", "label", "big-number", "caption"] as const;
export const SFX = ["whoosh", "pop", "ding", "tick"] as const;
export const HAIR_STYLES = ["short", "long", "bun", "curly", "spiky", "bald", "cap"] as const;
export const ACCESSORIES = ["none", "glasses", "scarf", "backpack", "lab-coat", "headphones", "headband"] as const;
export const TOPS = ["sweater", "hoodie", "polo"] as const;
export const PANTS = ["dark", "jeans"] as const;

const Color = z.enum(COLOR_NAMES).catch("teal");

export const CastMemberSchema = z.object({
  id: z.string().describe('Short id used by shots, e.g. "fed", "mai", "boss".'),
  name: z.string(),
  kind: z.enum(["mascot", "human"]).catch("human").describe('"mascot" = Fed, the Fedtoon host (a fixed drawing: the options below are ignored); "human" = a person built from the options below.'),
  skin: z.enum(Object.keys(SKIN) as [keyof typeof SKIN]).catch("tan"),
  hair: z.enum(HAIR_STYLES).catch("short"),
  hairColor: z.enum(Object.keys(HAIR_COLORS) as [keyof typeof HAIR_COLORS]).catch("black"),
  outfit: Color.describe("Color of the top (sweater, hoodie or polo)."),
  top: z.enum(TOPS).catch("sweater"),
  pants: z.enum(PANTS).catch("dark"),
  accessory: z.enum(ACCESSORIES).catch("none"),
});

export const ShotCharacterSchema = z.object({
  castId: z.string(),
  position: z.enum(POSITIONS).catch("center"),
  scale: z.enum(SCALES).catch("medium"),
  action: z.enum(ACTIONS).catch("idle"),
  expression: z.enum(EXPRESSIONS).catch("neutral"),
  facing: z.enum(["left", "right", "front"]).catch("front"),
  enter: z.enum(["none", "pop", "slide-in", "fade"]).catch("none"),
});

export const PropSchema = z.object({
  prompt: z.string().describe("One object to draw on a transparent background, in English, e.g. 'a glowing red blood cell'."),
  position: z.enum([...POSITIONS, "top", "bottom"]).catch("center"),
  scale: z.enum(SCALES).catch("medium"),
  motion: z.enum(PROP_MOTIONS).catch("float"),
});

export const ShotSchema = z.object({
  durationSec: z.number().describe("Seconds on screen, usually 2-6."),
  narration: z.string().catch("").describe("Voice-over during this shot, in the video's language. Empty = silent."),
  speaker: z.string().catch("narrator").describe('castId of the character speaking (their mouth moves), or "narrator".'),
  background: z.object({
    prompt: z.string().describe("The environment only, in English: no characters, no text. Leave the lower middle open for characters."),
    mood: z.enum(Object.keys(MOODS) as [keyof typeof MOODS]).catch("night"),
    colors: z
      .array(z.enum(COLOR_NAMES))
      .catch([])
      .describe("2 named colors that dominate the background. Never the exact same color as a character in the shot."),
  }),
  camera: z.enum(CAMERAS).catch("zoom-in"),
  characters: z.array(ShotCharacterSchema).describe("0-3 cast members on screen."),
  props: z.array(PropSchema).describe("0-2 objects that illustrate the narration."),
  text: z.object({
    content: z.string().describe("At most 6 words, or empty."),
    style: z.enum(TEXT_STYLES).catch("none"),
    position: z.enum(["top", "center", "bottom"]).catch("top"),
  }),
  transition: z.enum(SHOT_TRANSITIONS).catch("fade").describe("How this shot comes in (ignored for the first shot)."),
  sfx: z.array(z.enum(SFX)).describe("Sound effects at the start of the shot, usually none or one."),
});

/** What the AI writes. */
export const AnalyzedStoryboardSchema = z.object({
  title: z.string(),
  cast: z.array(CastMemberSchema).describe("1-4 characters. Usually include Fed (kind mascot) as the guide."),
  shots: z.array(ShotSchema),
  notes: z.array(z.string()).describe("In Vietnamese: what was changed from the source and why."),
});

/** What Remotion renders: + video size, generated images, voice clips. */
export const StoryboardSchema = AnalyzedStoryboardSchema.extend({
  kind: z.literal("fedtoon"),
  meta: MetaSchema,
  /** imageRef(kind, prompt) → path inside the render bundle's public folder. */
  images: z.record(z.string(), z.string()).catch({}),
  voiceover: z.array(VoiceClipSchema).catch([]),
  captions: z.boolean().catch(true),
});

export type CastMember = z.infer<typeof CastMemberSchema>;
export type ShotCharacter = z.infer<typeof ShotCharacterSchema>;
export type Prop = z.infer<typeof PropSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type AnalyzedStoryboard = z.infer<typeof AnalyzedStoryboardSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;

/** FNV-1a: a short stable hash. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** How a shot refers to its generated image in `images`. */
export const imageRef = (kind: "bg" | "prop", prompt: string) => `${kind}:${prompt.trim()}`;

/** Backgrounds also depend on their colors: the same place in other colors is another image. */
export const bgRef = (bg: Shot["background"]) => imageRef("bg", bg.colors.length ? `${bg.prompt.trim()} | ${bg.colors.join(", ")}` : bg.prompt);

/** Cached file name of an image: the same prompt in the same style is generated only once. */
export const imageFileKey = (kind: "bg" | "prop", prompt: string, style: string) => `${kind}-${fnv1a(`${style}\n${prompt.trim().toLowerCase()}`)}`;

/** Frames of each shot, transition overlaps and start frames (same rules as computeTimeline). */
export function storyboardTimeline(sb: Pick<Storyboard, "shots" | "meta">) {
  const fps = sb.meta.fps;
  const maxTrans = Math.round(fps * 0.35);
  const base = sb.shots.map((s) => Math.max(Math.round(s.durationSec * fps), Math.round(fps * 0.6)));
  const trans = sb.shots.map((s, i) => (i === 0 || s.transition === "cut" ? 0 : Math.min(maxTrans, Math.floor(base[i - 1] / 2), Math.floor(base[i] / 2))));
  const seq = base.map((b, i) => b + (trans[i + 1] ?? 0));
  const start: number[] = [];
  let acc = 0;
  for (const b of base) {
    start.push(acc);
    acc += b;
  }
  return { base, trans, seq, start, total: Math.max(acc, 1) };
}

/** Adds defaults, clamps numbers and drops references to unknown cast members. */
export function finalizeStoryboard(analyzed: AnalyzedStoryboard, meta: Storyboard["meta"], extra: Partial<Pick<Storyboard, "images" | "voiceover" | "captions">> = {}): Storyboard {
  // Fed is one person: a second "mascot" in the cast is drawn as an ordinary character.
  // Recurring characters (src/fedtoon/cast.ts) always keep their own look.
  const cast = (analyzed.cast.length ? analyzed.cast.slice(0, 4) : [CastMemberSchema.parse({ id: "fed", name: "Fed", kind: "mascot", outfit: "teal" })]).map((m, i, all) => {
    const member = m.kind === "mascot" && all.findIndex((o) => o.kind === "mascot") !== i ? { ...m, kind: "human" as const } : m;
    const regular = m.kind === "human" ? RECURRING_CAST.find((r) => r.id === m.id.toLowerCase()) : undefined;
    return regular ? { ...regular, id: m.id, name: m.name || regular.name } : member;
  });
  const ids = new Set(cast.map((c) => c.id));
  const shots = analyzed.shots.map((s) => {
    const characters = s.characters.filter((c) => ids.has(c.castId)).slice(0, 3);
    // The one color rule: a background color is never exactly a character's color.
    const subjects = characters.flatMap((c) => characterColors(cast.find((m) => m.id === c.castId)!));
    const requested = (s.background.colors ?? []).slice(0, 3) as ColorName[];
    return {
      ...s,
      durationSec: Math.min(15, Math.max(1, Number(s.durationSec) || 3)),
      narration: s.narration.trim(),
      speaker: ids.has(s.speaker) ? s.speaker : "narrator",
      characters,
      props: s.props.filter((p) => p.prompt.trim()).slice(0, 2),
      background: { ...s.background, colors: withoutCharacterColors(requested.length ? requested : [...MOODS[s.background.mood].colors], subjects) },
    };
  });
  return StoryboardSchema.parse({
    ...analyzed,
    cast,
    shots: shots.length ? shots : [ShotSchema.parse({ durationSec: 3, narration: "", background: { prompt: "a starry night sky", mood: "night", colors: ["night", "plum"] }, characters: [], props: [], text: { content: analyzed.title, style: "title", position: "center" }, sfx: [] })],
    kind: "fedtoon",
    meta,
    images: extra.images ?? {},
    voiceover: extra.voiceover ?? [],
    captions: extra.captions ?? true,
  });
}

export const isStoryboard = (spec: unknown): spec is Storyboard => !!spec && typeof spec === "object" && (spec as { kind?: unknown }).kind === "fedtoon";
