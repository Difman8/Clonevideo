// AI pass of "Tìm video hot": looks at each video's thumbnail + text and returns
// its visual style, a specific topic and search keywords. Claude and OpenAI share
// the prompt and schema below.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { PROVIDERS, type Provider } from "../pipeline/ai";
import { mapLimit } from "./classify";

export const InsightsSchema = z.object({
  videos: z.array(
    z.object({
      id: z.string(),
      style: z.enum(["live", "animation", "other"]),
      topic: z.string(),
      keywords: z.array(z.string()),
    }),
  ),
});
export type Insight = z.infer<typeof InsightsSchema>["videos"][number];

export type InsightInput = {
  id: string;
  title: string;
  channel: string;
  category: string;
  tags: string[];
  description: string;
  durationSec: number;
  thumbnailUrl: string;
};

export const INSIGHTS_PROMPT = `You help a Vietnamese content creator research trending YouTube videos. For each video you receive its id, title, channel, category, tags, duration, the start of its description and its thumbnail. Return exactly one entry per video, with the same id.

- style:
  - "live": filmed with a real camera — real people, places, animals or objects (vlogs, pranks, challenges, cooking, sports, street interviews, reactions, real-footage compilations, live-action film or TV clips).
  - "animation": drawn or computer-generated — 2D/3D cartoons, anime, motion graphics, kinetic typography and text-on-screen videos, stickman, claymation/stop-motion, AI-generated animation.
  - "other": neither, or an even mix — video-game footage, screen recordings, photo slideshows, lyric videos or a still image with music.
  Judge mainly from the thumbnail; use the text when the thumbnail is missing or unclear.
- topic: the specific subject in Vietnamese, 3–8 words, e.g. "Thử thách ăn đồ siêu cay", "Mẹo dọn nhà nhanh", "Hoạt hình hài về chú mèo". Be more specific than the category.
- keywords: 6–10 search phrases someone would type to find this video, in the video's own language, lowercase, without "#".`;

/** Downloads a thumbnail as base64; null when it cannot be fetched. */
async function thumbnail(url: string): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    const mediaType = type.includes("png") ? "image/png" : type.includes("webp") ? "image/webp" : "image/jpeg";
    return { data: Buffer.from(await res.arrayBuffer()).toString("base64"), mediaType };
  } catch {
    return null;
  }
}

const describe = (v: InsightInput) =>
  [
    `Video id: ${v.id}`,
    `Title: ${v.title}`,
    `Channel: ${v.channel}`,
    `Category: ${v.category || "?"}`,
    `Duration: ${Math.round(v.durationSec)} s`,
    `Tags: ${v.tags.slice(0, 25).join(", ") || "(none)"}`,
    `Description: ${v.description.slice(0, 400).replace(/\s+/g, " ") || "(empty)"}`,
  ].join("\n");

type Part = { text: string } | { image: NonNullable<Awaited<ReturnType<typeof thumbnail>>> };

async function buildParts(videos: InsightInput[]): Promise<Part[]> {
  const images = await mapLimit(videos, 8, (v) => thumbnail(v.thumbnailUrl));
  const parts: Part[] = [{ text: `${videos.length} videos follow.` }];
  videos.forEach((v, i) => {
    parts.push({ text: `${describe(v)}\nThumbnail:${images[i] ? "" : " (not available)"}` });
    if (images[i]) parts.push({ image: images[i] });
  });
  parts.push({ text: "Return the entries now." });
  return parts;
}

async function withClaude(parts: Part[]): Promise<Insight[]> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = parts.map((p) =>
    "text" in p ? { type: "text", text: p.text } : { type: "image", source: { type: "base64", media_type: p.image.mediaType, data: p.image.data } },
  );
  const stream = new Anthropic().beta.messages.stream({
    model: PROVIDERS.claude.model,
    max_tokens: 16000,
    output_config: { effort: "low", format: betaZodOutputFormat(InsightsSchema) },
    // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: INSIGHTS_PROMPT,
    messages: [{ role: "user", content }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error(`Claude từ chối phân tích (${message.stop_details?.category ?? "không rõ lý do"}).`);
  if (message.stop_reason === "max_tokens") throw new Error("Câu trả lời của Claude vượt giới hạn max_tokens.");
  if (!message.parsed_output) throw new Error("Claude không trả về JSON hợp lệ.");
  return message.parsed_output.videos;
}

async function withOpenAI(parts: Part[]): Promise<Insight[]> {
  const content: OpenAI.Responses.ResponseInputContent[] = parts.map((p) =>
    "text" in p
      ? { type: "input_text", text: p.text }
      : { type: "input_image", detail: "low", image_url: `data:${p.image.mediaType};base64,${p.image.data}` },
  );
  const stream = new OpenAI().responses.stream({
    model: PROVIDERS.openai.model,
    instructions: INSIGHTS_PROMPT,
    input: [{ role: "user", content }],
    text: { format: zodTextFormat(InsightsSchema, "video_insights") },
    reasoning: { effort: "low" },
    max_output_tokens: 16000,
  });
  const response = await stream.finalResponse();
  const refusal = response.output.flatMap((o) => (o.type === "message" ? o.content : [])).find((c) => c.type === "refusal");
  if (refusal) throw new Error(`OpenAI từ chối phân tích: ${refusal.refusal}`);
  if (response.status === "incomplete") throw new Error(`OpenAI dừng giữa chừng (${response.incomplete_details?.reason ?? "không rõ lý do"}).`);
  if (!response.output_parsed) throw new Error("OpenAI không trả về JSON hợp lệ.");
  return response.output_parsed.videos;
}

/** Classifies one batch (about 20 videos) with the chosen provider. */
export async function videoInsights(provider: Provider, videos: InsightInput[]): Promise<Map<string, Insight>> {
  const parts = await buildParts(videos);
  const list = provider === "openai" ? await withOpenAI(parts) : await withClaude(parts);
  return new Map(list.map((v) => [v.id, v]));
}
