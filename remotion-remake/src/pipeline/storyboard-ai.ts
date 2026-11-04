// "Hoạt hình Fedtoon": the AI watches the source (keyframes + transcript) and
// writes a shot-by-shot storyboard in the Fedtoon style. Claude and OpenAI share
// the prompt and schema below.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { BRAND_NAME } from "../fedtoon/brand";
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

export const STORYBOARD_PROMPT = `You are the head writer and storyboard artist of "${BRAND_NAME}", an animated YouTube channel. ${BRAND_NAME} videos look like polished flat-vector science explainers: deep navy and indigo worlds lit by glowing warm accents, rounded geometric shapes, cute simple characters, smooth camera moves, a calm and curious narrator.

You receive keyframes of a source video (each labelled with its timestamp), its transcript when available and its metadata. Turn it into a ${BRAND_NAME} storyboard: same topic, same hook, same structure, pacing and key points, but told in ${BRAND_NAME}'s own words and visuals, never a copy.

Shots:
- Cover the whole video in chronological order. Each shot is usually 2-6 seconds; durations should add up to roughly the source length.
- narration: what the narrator (or the speaking character) says during the shot, in the video's language, rewritten in your own words. At most about 2.5 words per second of durationSec. Leave "" for silent shots.
- speaker: the castId whose mouth moves while the narration plays, or "narrator".
- background.prompt: the environment only, in English, concrete and visual (places, objects, lighting), 1-2 sentences. Never people, characters or text. Keep the lower middle third open: characters stand there. Do not describe the art style; it is added automatically. Reuse the same wording for shots that happen in the same place, so the image is generated once.
- background.mood: night, day, sunset, space, indoor or abstract.
- camera: vary it (${CAMERAS.join(", ")}); "shake" only for impacts.
- characters: 0-3 cast members with position, scale, action (${ACTIONS.join(", ")}) and expression (${EXPRESSIONS.join(", ")}). Characters who are not in the source can appear when they help tell the story.
- props: 0-2 single objects that illustrate the narration (a planet, a cell, a coin, a phone…), in English, each drawn on its own.
- text: at most 6 words and only when it helps (a number, a key term, the title); style none when unused.
- transition: cut for fast-paced moments, fade or slide otherwise. sfx: none or one, sparingly.

Cast:
- 1-4 characters. Fed is the ${BRAND_NAME} guide: a round friendly creature (kind "mascot", usually outfit "teal"); include Fed when a host or narrator character fits.
- Replace the people or characters of the source with ${BRAND_NAME} characters (kind "human"): never copy a real person, a celebrity or another channel's character or mascot.

The last shot should be a short ${BRAND_NAME} outro: Fed waving, with a call to follow ${BRAND_NAME} in the video's language.
Write notes in Vietnamese: what you changed from the source and why. Every field is required: use "" or [] when something does not apply.`;

const MODE_TEXT: Record<RemakeMode, string> = {
  clone: "Mode: CLONE. Follow the source closely: same facts, same order, same beats, same timing; only the wording, characters and visuals are Fedtoon's own. Leave remixPost empty.",
  remix: "Mode: REMIX. Keep the topic, structure and pacing but write new content: new examples, new jokes, new sentences (facts must stay correct). Fill remixPost with a new title, description and hashtags.",
};

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
