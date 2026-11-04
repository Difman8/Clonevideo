// "Hoạt hình Fedtoon": the AI watches the source (keyframes + transcript) and
// writes a shot-by-shot storyboard in the Fedtoon style. Claude and OpenAI share
// the prompt and schema below.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { BACKGROUND_SETS, BRAND_NAME, COLOR_NAMES } from "../fedtoon/brand";
import { numberSetting } from "../settings";
import { ACTIONS, AnalyzedStoryboardSchema, CAMERAS, EXPRESSIONS } from "../spec/storyboard";
import { PROVIDERS, type Provider } from "./ai";
import { buildContext, progressReporter, type AiInput, type RemakeMode } from "./ai-common";
import { claudeEffort } from "./analyze-claude";
import { openaiEffort, stripDefaults } from "./analyze-openai";

export const StoryboardOutputSchema = AnalyzedStoryboardSchema.extend({
  suggestedKeywords: z.array(z.string()).describe("10-15 search keywords for this video, in the video's language."),
  remixPost: z
    .object({ title: z.string(), description: z.string(), hashtags: z.array(z.string()) })
    .describe("Remix mode only: new title, description and hashtags. Clone mode: empty strings and empty array."),
});
export type StoryboardOutput = z.infer<typeof StoryboardOutputSchema>;

export const STORYBOARD_PROMPT = `You are the head writer and storyboard artist of "${BRAND_NAME}", an animated YouTube channel. ${BRAND_NAME} videos look like polished flat-vector science explainers: bold saturated flat colors (magenta, violet, deep purple, cyan, lime green, yellow, orange, royal blue), rounded geometric shapes, no outlines, no drop shadows and no glow. A subject stands out only because its background is a clearly different color (a pink brain on deep purple, a yellow sun on cyan sky, Fed in his teal shirt on magenta). Objects often get simple cute faces (a sleepy brain, a smiling sun); diagrams are shown inside big flat circles; key terms appear in solid colored boxes. Smooth camera moves, a calm and curious narrator.

You receive keyframes of a source video (each labelled with its timestamp), its transcript when available and its metadata. Turn it into a ${BRAND_NAME} storyboard with the same topic, hook, structure and pacing. The visuals are always ${BRAND_NAME}'s own (backgrounds, characters, props, text styling), never the source's footage, people or art. Whether the words are copied from the source or rewritten depends on the mode given at the end.

Shots:
- Cover the whole video in chronological order. Each shot is usually 2-6 seconds; durations should add up to roughly the source length.
- narration: what the narrator (or the speaking character) says during the shot, in the video's language (copied or rewritten: see the mode). Leave "" for silent shots.
- speaker: the castId whose mouth moves while the narration plays, or "narrator".
- background.prompt: the environment only, in English, concrete and visual (places, objects, lighting), 1-2 sentences. Never people, characters or text. Keep the lower middle third open: characters stand there. Do not describe the art style; it is added automatically. Reuse the same wording for shots that happen in the same place, so the image is generated once.
- background.mood: night, day, sunset, space, indoor or abstract (abstract = flat rays or shapes, for ideas and feelings).
- background.colors: the 2 named colors that dominate the background (${COLOR_NAMES.join(", ")}), chosen naturally for the scene (e.g. ${BACKGROUND_SETS.slice(0, 4).map((s) => s.join("+")).join(", ")}). The only rule: never the exact same color as the outfit/body color of a character in the shot.
- camera: vary it (${CAMERAS.join(", ")}); "shake" only for impacts.
- characters: 0-3 cast members with position, scale, action (${ACTIONS.join(", ")}) and expression (${EXPRESSIONS.join(", ")}). Characters who are not in the source can appear when they help tell the story.
- props: 0-2 single objects that illustrate the narration (a planet, a cell, a coin, a phone…), in English, each drawn on its own. Name the object's main color (never exactly one of background.colors); give it a simple cute face when that fits the tone.
- text: short (at most 6-8 words) and only when it helps; style "title" for the opening question/title, "label" for a key term (solid colored box), "caption" for a statistic or fact (dark rounded box), "big-number" for one striking number, "none" when unused.
- transition: cut for fast-paced moments, fade or slide otherwise. sfx: none or one, sparingly.

Cast:
- 1-4 characters. Fed is the ${BRAND_NAME} host: a cheerful young man with messy dark navy hair, round orange glasses, a teal short-sleeved shirt, purple trousers and yellow sneakers (kind "mascot", outfit "teal"; his look is fixed). Include Fed when a host or narrator character fits; there is only one Fed, and no other character should look like him.
- Replace the people or characters of the source with ${BRAND_NAME} characters (kind "human"): never copy a real person, a celebrity or another channel's character or mascot.

The last shot should be a short ${BRAND_NAME} outro: Fed waving, with a call to follow ${BRAND_NAME} in the video's language.
Write notes in Vietnamese: what you changed from the source and why. Every field is required: use "" or [] when something does not apply.`;

export const MODE_TEXT: Record<RemakeMode, string> = {
  clone: `Mode: COPY THE CONTENT. Keep everything the source says; only the look is ${BRAND_NAME}'s.
- narration: copy the words spoken in the source during the shot's time span, word for word from the transcript, in the original language. Do not paraphrase, summarize, shorten, translate or add sentences; only fix punctuation, capitalization and obvious auto-caption mistakes. Every spoken sentence of the transcript appears exactly once, in order, across the shots.
- Split shots at sentence or phrase boundaries. durationSec = the time those words take in the source (from the transcript timestamps), so the durations add up to the source length.
- text: copy the source's on-screen titles, labels and numbers exactly (same language and spelling) when they fit in 8 words.
- Keep the same facts, examples, order and beats. The source's host or narrator becomes Fed.
- Without a transcript, take the words from the text visible in the keyframes; if there is none, write short lines saying what each moment shows, and say so in notes.
- The ${BRAND_NAME} outro is the only addition: one short shot (2-3 s) after the copied content.
Leave remixPost empty.`,
  remix: `Mode: REMIX. Keep the topic, structure and pacing but write new content in ${BRAND_NAME}'s own words: new examples, new jokes, new sentences (facts must stay correct); never reuse the source's sentences. narration: at most about 2.5 words per second of durationSec. Fill remixPost with a new title, description and hashtags.`,
};

const words = (text: string) => text.normalize("NFC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * Share (0-1) of the transcript's words that the narration keeps, in order
 * (longest common subsequence of words). Used to check the "copy" mode.
 */
export function narrationCoverage(cues: { text: string }[], narrations: string[]): number {
  const a = words(cues.map((c) => c.text).join(" "));
  const b = words(narrations.join(" "));
  if (!a.length) return 1;
  let prev = new Uint32Array(b.length + 1);
  let row = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
    [prev, row] = [row, prev];
  }
  return prev[b.length] / a.length;
}

export async function writeStoryboard(provider: Provider, input: AiInput): Promise<StoryboardOutput> {
  const p = PROVIDERS[provider];
  if (!p.ready()) throw new Error(`Kiểu Hoạt hình Fedtoon cần AI để viết kịch bản: chưa có ${p.envKey}. Thêm khóa ở tab ⚙️ Cài đặt.`);
  const context = buildContext(input);
  const final = `${MODE_TEXT[input.mode]}\nNow write the storyboard.`;
  return provider === "openai" ? withOpenAI(input, context, final) : withClaude(input, context, final);
}

async function withClaude(input: AiInput, context: string, final: string): Promise<StoryboardOutput> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: context }];
  for (const f of input.frames) {
    content.push({ type: "text", text: `Frame at ${f.t.toFixed(2)}s:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f.file).toString("base64") } });
  }
  content.push({ type: "text", text: final });
  const stream = new Anthropic().beta.messages.stream({
    model: PROVIDERS.claude.model,
    max_tokens: numberSetting("CLAUDE_MAX_TOKENS"),
    output_config: { effort: claudeEffort("CLAUDE_ANALYZE_EFFORT"), format: betaZodOutputFormat(StoryboardOutputSchema) },
    // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: STORYBOARD_PROMPT,
    messages: [{ role: "user", content }],
  });
  stream.on("text", progressReporter("Claude", input.onProgress));
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error(`Claude từ chối viết kịch bản (${message.stop_details?.category ?? "không rõ lý do"}).`);
  if (message.stop_reason === "max_tokens") throw new Error("Kịch bản quá dài, vượt giới hạn max_tokens (tăng ở tab Cài đặt).");
  if (!message.parsed_output) throw new Error("Claude không trả về JSON hợp lệ.");
  return message.parsed_output;
}

async function withOpenAI(input: AiInput, context: string, final: string): Promise<StoryboardOutput> {
  const format = zodTextFormat(StoryboardOutputSchema, "fedtoon_storyboard");
  stripDefaults(format.schema);
  const content: OpenAI.Responses.ResponseInputContent[] = [{ type: "input_text", text: context }];
  for (const f of input.frames) {
    content.push({ type: "input_text", text: `Frame at ${f.t.toFixed(2)}s:` });
    content.push({ type: "input_image", detail: "auto", image_url: `data:image/jpeg;base64,${fs.readFileSync(f.file).toString("base64")}` });
  }
  content.push({ type: "input_text", text: final });
  const stream = new OpenAI().responses.stream({
    model: PROVIDERS.openai.model,
    instructions: STORYBOARD_PROMPT,
    input: [{ role: "user", content }],
    text: { format },
    reasoning: { effort: openaiEffort("OPENAI_REASONING_EFFORT") },
    max_output_tokens: numberSetting("OPENAI_MAX_OUTPUT_TOKENS"),
  });
  const report = progressReporter("OpenAI", input.onProgress);
  stream.on("response.output_text.delta", (e) => report(e.delta));
  const response = await stream.finalResponse();
  const refusal = response.output.flatMap((o) => (o.type === "message" ? o.content : [])).find((c) => c.type === "refusal");
  if (refusal) throw new Error(`OpenAI từ chối viết kịch bản: ${refusal.refusal}`);
  if (response.status === "incomplete") throw new Error(`OpenAI dừng giữa chừng (${response.incomplete_details?.reason ?? "không rõ lý do"}).`);
  if (!response.output_parsed) throw new Error("OpenAI không trả về JSON hợp lệ.");
  return response.output_parsed;
}
