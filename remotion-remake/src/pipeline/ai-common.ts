import { z } from "zod";
import { AnalyzedSpecSchema } from "../spec/schema";
import type { Frame } from "./frames";
import type { PostContent } from "./metadata";
import { transcriptText, type Cue } from "./transcript";
import type { YtInfo } from "./youtube";

// Prompt and output schema shared by every AI provider.

export const AiOutputSchema = AnalyzedSpecSchema.extend({
  suggestedKeywords: z.array(z.string()).describe("10-15 search keywords for this video, in the video's language."),
  remixPost: z
    .object({ title: z.string(), description: z.string(), hashtags: z.array(z.string()) })
    .describe("Remix mode only: a new title, description and hashtags for the remake. Clone mode: empty strings and empty array."),
});
export type AiOutput = z.infer<typeof AiOutputSchema>;

export type RemakeMode = "clone" | "remix";

export type AiInput = {
  info: YtInfo;
  post: PostContent;
  frames: Frame[];
  cues: Cue[];
  mode: RemakeMode;
  onProgress?: (message: string) => void;
};

export const SYSTEM_PROMPT = `You rebuild YouTube videos as motion-graphics videos rendered with Remotion, using a fixed library of scene templates. You receive keyframes sampled from the source video (each labelled with its timestamp), the transcript when available, and the video's metadata. Return a scene-by-scene spec that, rendered with these templates, looks and reads as close to the source as possible.

Scene templates:
- title: big heading, optional subheading and emoji. Openers, section titles.
- text: one or more lines of animated text (pop, word-by-word, typewriter, slide-up, fade), optional highlighted words and emoji. Facts, captions, statements, story beats.
- list-item: a numbered item (rank badge + heading + body + emoji). Top-N / countdown list videos.
- quiz: question, 2-4 options, countdown timer, then the correct answer is revealed with an optional explanation. Trivia and "guess the..." videos.
- bar-chart: horizontal bars with values and a unit. Rankings and comparisons of numbers.
- big-number: one counting-up number with prefix/suffix and a label. Statistics.
- quote: quotation with author.
- timeline: dated events in order.
- countdown: big numbers counting down to 1.
- comparison: two columns (A vs B) with bullet points.
- outro: closing line with a subscribe/follow/like button animation and channel handle.

Rules:
1. Timing: scenes are in chronological order, and each scene's durationSec is how long that content stays on screen in the source (use the frame timestamps and transcript timing). The durations must add up to the source duration.
2. Text: reproduce on-screen text exactly as shown (same language, spelling, capitalization, emoji). When the frames show no text, take the words from the transcript.
3. Style: take theme colors from the frames as hex codes, choose the closest font, background style and motion feel; enable sfx unless the source is calm; enable progressBar only if the source shows one; watermark = the channel handle if one is shown on screen, else empty.
4. Things the templates cannot draw (camera footage, photos, faces, illustrations, voice-over, music): approximate them with the closest template (for example the key sentence of a talking-head segment as a text scene) and list each approximation in notes. Write notes in Vietnamese.
5. Transitions should resemble the source's cuts; use "none" for hard cuts.
6. Every field is required: use "" or [] when something does not apply.
7. narration (per scene) is the voice-over read aloud by a text-to-speech voice while the scene is on screen, in the video's language. When the source has a voice-over, follow what is said during that scene's time span (from the transcript) in your own wording rather than word for word. When it has none, write a short, natural line that tells the viewer what the scene shows. Leave it "" for scenes that should stay silent (countdowns, pauses). A narration must fit the scene: about 2.5 words per second of durationSec at most.`;

export const MODE_TEXT: Record<RemakeMode, string> = {
  clone:
    "Mode: CLONE. Rebuild the video as faithfully as the templates allow: same text, same order, same timing, same look. Leave remixPost empty.",
  remix:
    "Mode: REMIX. Keep the structure, pacing, scene types, timing and visual style, but write new original wording on the same topic: do not reuse the source's sentences, questions or list items verbatim (facts may stay correct). Fill remixPost with a new title, description and hashtags for this new version.",
};

/** Metadata + transcript block sent before the keyframes. */
export function buildContext({ info, post, frames, cues }: AiInput): string {
  const chapters = (info.chapters ?? []).map((c) => `- ${c.start_time.toFixed(1)}s–${c.end_time.toFixed(1)}s: ${c.title}`).join("\n");
  return [
    `Source video: ${post.url}`,
    `Title: ${post.title}`,
    `Channel: ${post.channel} ${post.handle}`.trim(),
    `Duration: ${info.duration ?? "?"} s`,
    `Frame size: ${info.width ?? "?"}x${info.height ?? "?"} (${(info.height ?? 0) > (info.width ?? 0) ? "vertical" : "horizontal"})`,
    `Language: ${info.language || "unknown"}`,
    `Description:\n${post.description || "(empty)"}`,
    chapters ? `Chapters:\n${chapters}` : "",
    cues.length ? `Transcript (timestamped):\n${transcriptText(cues)}` : "Transcript: not available.",
    `\n${frames.length} keyframes follow, in order.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const finalInstruction = (mode: RemakeMode) => `${MODE_TEXT[mode]}\nNow produce the spec.`;

/** Reports generation progress every ~1500 characters of streamed JSON. */
export function progressReporter(label: string, onProgress?: (message: string) => void) {
  let chars = 0;
  let last = 0;
  return (delta: string) => {
    chars += delta.length;
    if (chars - last > 1500) {
      last = chars;
      onProgress?.(`${label} đang viết kịch bản… (${chars.toLocaleString("vi-VN")} ký tự)`);
    }
  };
}
