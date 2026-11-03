// "Soạn thông tin đăng YouTube": rewrites a source video's title and description
// with AI so they stay 80–90% identical, and keeps 100% of its hashtags and
// keywords (enforced in code, not left to the AI). Claude and OpenAI share the
// prompt and schema below.
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { extractHashtags } from "../discover/classify";
import { hasYoutubeKey, YoutubeApi } from "../discover/youtube-api";
import { setting } from "../settings";
import { PROVIDERS, type Provider } from "./ai";
import { claudeEffort } from "./analyze-claude";
import { openaiEffort } from "./analyze-openai";
import { extractPostContent, type PostContent } from "./metadata";
import { similarity, words } from "./similarity";
import { OUT_DIR } from "./tools";
import { fetchInfo, parseVideoId } from "./youtube";

export type PostSource = {
  videoId: string;
  url: string;
  title: string;
  description: string;
  hashtags: string[];
  keywords: string[];
  channel: string;
};

/** The creator's own channel, used to make the rewrite different and as a hashtag/keyword. */
export type WriterOptions = { channel: string; brandTags: boolean };

export const defaultChannel = () => setting("CHANNEL_NAME");

export function parseWriterOptions(raw: { channel?: unknown; brandTags?: unknown }): WriterOptions {
  const channel = typeof raw.channel === "string" ? raw.channel.trim().slice(0, 60) : "";
  return { channel: channel || defaultChannel(), brandTags: raw.brandTags !== false && raw.brandTags !== "false" };
}

/** "Fedtoon" → "#Fedtoon"; spaces and symbols are dropped. Null when nothing is left. */
export const channelHashtag = (channel: string) => {
  const tag = channel.replace(/[^\p{L}\p{N}_]/gu, "");
  return tag ? `#${tag}` : null;
};

export type ComposedPost = {
  videoId: string;
  channel: string;
  brandTags: boolean;
  title: string;
  description: string;
  /** Every hashtag of the source (original spelling) plus any the text already had. */
  hashtags: string[];
  /** The source's keywords unchanged, or AI suggestions when the source declared none. */
  keywords: string[];
  keywordsFromAi: boolean;
  /** Share of the source's words kept (0–1). Target: 0.80–0.90. */
  similarity: { title: number; description: number };
  checks: {
    hashtagsKept: number;
    hashtagsTotal: number;
    keywordsKept: number;
    keywordsTotal: number;
    titleLength: number;
    descriptionLength: number;
    /** #Fedtoon / Fedtoon added (when brandTags is on). */
    brandHashtag: boolean;
    brandKeyword: boolean;
  };
  /** Words of the rewrite found neither in the source title/description nor in the channel name. */
  newWords: string[];
  model: string;
  attempts: number;
  createdAt: string;
  source: PostSource;
};

export const TARGET = { min: 0.8, max: 0.9 };
export const LIMITS = { title: 100, description: 5000, tags: 500 };

export const PostDraftSchema = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
});
type PostDraft = z.infer<typeof PostDraftSchema>;

/** System prompt shared by Claude and OpenAI. */
export function writerPrompt(o: WriterOptions): string {
  const tag = o.brandTags ? channelHashtag(o.channel) : null;
  return `You help a creator publish their own remake of a YouTube video on their channel "${o.channel}". Rewrite the source video's title and description for the new upload.

Goal: the new text stays 80–90% identical to the source, word for word: same language, meaning, tone, structure, line breaks, emoji and calls to action.

Make it different ONLY in these two ways:
1. Add the channel name "${o.channel}" naturally. Title examples: "${o.channel} | <title>", "<title> - ${o.channel}", "<title> (${o.channel})". Description: a short opening or closing line with "${o.channel}" (for example an invitation to subscribe to ${o.channel}); where the source names its own channel, use "${o.channel}" instead.
2. Use information that is already in the source description: add a short detail from it to the title, or reorder and lightly rephrase the description's sentences with facts it already contains.

Never change the letters inside a word, never reverse, scramble or misspell words, never invent words, never write meaningless text, never translate. Every word must be a correctly spelled, natural word of the source's language, or the channel name. Keep all other words exactly as they are in the source.

Rules:
- Title: at most ${LIMITS.title} characters. Hashtags that are in the source title stay in the title.
- Hashtags: keep every hashtag of the source exactly as written (same spelling and letter case), where it was.${tag ? ` Add ${tag} after the other hashtags at the end of the description.` : " Do not add new hashtags."}
- Remove what belongs only to the source creator: URLs, @mentions, social-media handles, sponsor, affiliate, contact and copyright lines.
- An empty source description stays empty.
- keywords: when the source has keywords, return an empty array (they are reused unchanged). When it has none, suggest 10–15 search keywords in the video's language, lowercase, without "#".`;
}

// ---------- Source ----------

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validates a source sent by the page (e.g. a "Tìm video hot" result); hashtags are recomputed. */
export function sanitizeSource(raw: unknown): PostSource {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const url = str(o.url, 300);
  const videoId = parseVideoId(url);
  if (!videoId) throw new Error("Link YouTube của video gốc không hợp lệ.");
  const title = str(o.title, 300);
  if (!title) throw new Error("Video gốc chưa có tiêu đề.");
  const description = str(o.description, 10_000);
  const keywords = Array.isArray(o.keywords) ? o.keywords.map((k) => str(k, 100)).filter(Boolean).slice(0, 200) : [];
  return { videoId, url, title, description, hashtags: extractHashtags(title, description), keywords, channel: str(o.channel, 200) };
}

const fromPostContent = (p: PostContent) => sanitizeSource({ url: p.url, title: p.title, description: p.description, keywords: p.keywords, channel: p.channel });

/** Title, description and keywords of a video: from a past remake job, else the YouTube API (1 quota unit), else yt-dlp. */
export async function loadPostSource(url: string): Promise<PostSource> {
  const id = parseVideoId(url);
  if (!id) throw new Error("Link YouTube không hợp lệ (cần dạng youtube.com/watch?v=…, youtu.be/… hoặc /shorts/…).");
  const saved = path.join(OUT_DIR, id, "post.json");
  if (fs.existsSync(saved)) return fromPostContent(JSON.parse(fs.readFileSync(saved, "utf8")) as PostContent);
  if (hasYoutubeKey()) {
    const [v] = await new YoutubeApi().videos([id]);
    if (!v) throw new Error("Không tìm thấy video này (có thể đã bị xoá hoặc để riêng tư).");
    return sanitizeSource({ url, title: v.snippet.title, description: v.snippet.description, keywords: v.snippet.tags ?? [], channel: v.snippet.channelTitle });
  }
  return fromPostContent(extractPostContent(await fetchInfo(url)));
}

// ---------- AI ----------

function request(s: PostSource, o: WriterOptions, retry?: { draft: PostDraft; score: { title: number; description: number } }): string {
  const parts = [
    `Your channel: ${o.channel}`,
    `Source channel (replace it with yours, never mention it): ${s.channel || "?"}`,
    `Source hashtags (keep all, exactly as written): ${s.hashtags.join(" ") || "(none)"}`,
    `Source keywords: ${s.keywords.length ? "provided — return an empty keywords array" : "none — suggest some"}`,
    `Source title:\n${s.title}`,
    `Source description:\n${s.description || "(empty)"}`,
  ];
  if (retry) {
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const verdict = (x: number) =>
      x > TARGET.max
        ? `too close to the source: add the channel name or a detail from the description`
        : x < TARGET.min
          ? "too different: keep more of the source's words unchanged"
          : "on target";
    parts.push(
      [
        `Your previous version kept ${pct(retry.score.title)} of the title's words (${verdict(retry.score.title)}) and ${pct(retry.score.description)} of the description's words (${verdict(retry.score.description)}). The target is 80–90%.`,
        retry.draft.title.length > LIMITS.title ? `Its title is ${retry.draft.title.length} characters; the limit is ${LIMITS.title}.` : "",
        `Previous title:\n${retry.draft.title}`,
        `Previous description:\n${retry.draft.description}`,
        "Write the corrected version.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  return parts.join("\n\n");
}

async function draftWithClaude(system: string, text: string): Promise<PostDraft> {
  const stream = new Anthropic().beta.messages.stream({
    model: PROVIDERS.claude.model,
    max_tokens: 16000,
    output_config: { effort: claudeEffort("CLAUDE_POST_EFFORT"), format: betaZodOutputFormat(PostDraftSchema) },
    // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: text }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error(`Claude từ chối viết (${message.stop_details?.category ?? "không rõ lý do"}).`);
  if (message.stop_reason === "max_tokens") throw new Error("Câu trả lời của Claude vượt giới hạn max_tokens.");
  if (!message.parsed_output) throw new Error("Claude không trả về JSON hợp lệ.");
  return message.parsed_output;
}

async function draftWithOpenAI(system: string, text: string): Promise<PostDraft> {
  const stream = new OpenAI().responses.stream({
    model: PROVIDERS.openai.model,
    instructions: system,
    input: [{ role: "user", content: text }],
    text: { format: zodTextFormat(PostDraftSchema, "youtube_post") },
    reasoning: { effort: openaiEffort("OPENAI_POST_REASONING_EFFORT") },
    max_output_tokens: 16000,
  });
  const response = await stream.finalResponse();
  const refusal = response.output.flatMap((o) => (o.type === "message" ? o.content : [])).find((c) => c.type === "refusal");
  if (refusal) throw new Error(`OpenAI từ chối viết: ${refusal.refusal}`);
  if (response.status === "incomplete") throw new Error(`OpenAI dừng giữa chừng (${response.incomplete_details?.reason ?? "không rõ lý do"}).`);
  if (!response.output_parsed) throw new Error("OpenAI không trả về JSON hợp lệ.");
  return response.output_parsed;
}

// ---------- Guarantees ----------

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Restores the source spelling of every hashtag (a spelling the source itself
 * uses, e.g. "#Vui2" in the title and "#vui2" in the description, is left as is)
 * and appends the ones the AI dropped to the description.
 */
function keepHashtags(title: string, description: string, hashtags: string[], sourceSpellings: Set<string>) {
  for (const h of hashtags) {
    const re = new RegExp(`${escape(h)}(?![\\p{L}\\p{N}_])`, "giu");
    const fix = (m: string) => (sourceSpellings.has(m) ? m : h);
    title = title.replace(re, fix);
    description = description.replace(re, fix);
  }
  const present = new Set(extractHashtags(title, description).map((h) => h.toLocaleLowerCase()));
  const missing = hashtags.filter((h) => !present.has(h.toLocaleLowerCase()));
  if (missing.length) {
    const lines = description.trimEnd().split("\n");
    const last = lines[lines.length - 1] ?? "";
    // A last line made only of hashtags gets the missing ones; otherwise they go on a new paragraph.
    if (last.trim() && /^(\s*#[\p{L}\p{N}_]+)+\s*$/u.test(last)) lines[lines.length - 1] = `${last.trimEnd()} ${missing.join(" ")}`;
    else lines.push(...(description.trim() ? ["", missing.join(" ")] : [missing.join(" ")]));
    description = lines.join("\n");
  }
  return { title, description };
}

/** Characters a tag list takes in YouTube Studio (commas, quotes around multi-word tags). */
const tagsLength = (list: string[]) => list.reduce((n, k, i) => n + k.length + (k.includes(" ") ? 2 : 0) + (i ? 1 : 0), 0);

/** AI keyword suggestions, cleaned and kept under YouTube's 500-character tag limit. */
function cleanKeywords(list: string[]): string[] {
  const out: string[] = [];
  let length = 0;
  for (const raw of list) {
    const k = raw.replace(/^#/, "").trim();
    if (!k || out.some((x) => x.toLocaleLowerCase() === k.toLocaleLowerCase())) continue;
    const cost = k.length + (k.includes(" ") ? 2 : 0) + (out.length ? 1 : 0);
    if (length + cost > LIMITS.tags) break;
    out.push(k);
    length += cost;
  }
  return out;
}

const inRange = (x: number) => x >= TARGET.min && x <= TARGET.max;
const offTarget = (x: number) => Math.abs(x - (TARGET.min + TARGET.max) / 2);

export async function composePost(source: PostSource, provider: Provider, options: WriterOptions, onLog?: (message: string) => void): Promise<ComposedPost> {
  const p = PROVIDERS[provider];
  if (!p.ready()) throw new Error(`Chưa có ${p.envKey} trong .env nên chưa dùng được ${p.label}.`);
  const system = writerPrompt(options);
  const write = (text: string) => (provider === "openai" ? draftWithOpenAI : draftWithClaude)(system, text);
  const hasDescription = !!source.description.trim();
  const score = (d: PostDraft) => ({ title: similarity(source.title, d.title), description: hasDescription ? similarity(source.description, d.description) : 1 });
  const ok = (d: PostDraft, s: ReturnType<typeof score>) => inRange(s.title) && (!hasDescription || inRange(s.description)) && d.title.length <= LIMITS.title;

  onLog?.(`${p.label} đang viết…`);
  const first = await write(request(source, options));
  const firstScore = score(first);
  let title = first.title;
  let description = first.description;
  let titleScore = firstScore.title;
  let descriptionScore = firstScore.description;
  let keywords = first.keywords;
  let attempts = 1;

  // One correction round when the measured similarity is outside 80–90%; each field keeps the closer version.
  if (!ok(first, firstScore)) {
    onLog?.(`Độ giống: tiêu đề ${Math.round(firstScore.title * 100)}%, mô tả ${Math.round(firstScore.description * 100)}% → nhờ ${p.label} chỉnh lại…`);
    const second = await write(request(source, options, { draft: first, score: firstScore }));
    const secondScore = score(second);
    attempts = 2;
    const titleFits = (t: string) => t.length <= LIMITS.title;
    if ((titleFits(second.title) && !titleFits(title)) || (titleFits(second.title) === titleFits(title) && offTarget(secondScore.title) < offTarget(titleScore))) {
      title = second.title;
      titleScore = secondScore.title;
    }
    if (offTarget(secondScore.description) < offTarget(descriptionScore)) {
      description = second.description;
      descriptionScore = secondScore.description;
    }
    if (!keywords.length) keywords = second.keywords;
  }

  // Source hashtags always; the channel hashtag too, unless YouTube's 60-hashtag limit is reached.
  const brandHashtag = options.brandTags ? channelHashtag(options.channel) : null;
  const addBrandHashtag = !!brandHashtag && source.hashtags.length < 60;
  const spellings = new Set(`${source.title}\n${source.description}`.match(/#[\p{L}\p{N}_]+/gu) ?? []);
  ({ title, description } = keepHashtags(title.trim(), description.trim(), addBrandHashtag ? [...source.hashtags, brandHashtag] : source.hashtags, spellings));
  const finalHashtags = extractHashtags(title, description);
  const keywordsFromAi = !source.keywords.length;
  const finalKeywords = keywordsFromAi ? cleanKeywords(keywords) : [...source.keywords];
  // The channel name as the last tag, when it is not there yet and still fits in 500 characters.
  const hasBrandKeyword = () => finalKeywords.some((k) => k.toLocaleLowerCase() === options.channel.toLocaleLowerCase());
  if (options.brandTags && !hasBrandKeyword() && tagsLength([...finalKeywords, options.channel]) <= LIMITS.tags) finalKeywords.push(options.channel);
  const known = new Set([...words(`${source.title} ${source.description}`), ...words(options.channel)]);
  const newWords = [...new Set(words(`${title} ${description}`).filter((w) => !known.has(w)))];
  const lower = (list: string[]) => new Set(list.map((x) => x.toLocaleLowerCase()));
  const hashtagSet = new Set(finalHashtags);
  const keywordSet = lower(finalKeywords);

  return {
    videoId: source.videoId,
    channel: options.channel,
    brandTags: options.brandTags,
    title,
    description,
    hashtags: finalHashtags,
    keywords: finalKeywords,
    keywordsFromAi,
    similarity: { title: titleScore, description: descriptionScore },
    checks: {
      hashtagsKept: source.hashtags.filter((h) => hashtagSet.has(h)).length,
      hashtagsTotal: source.hashtags.length,
      keywordsKept: source.keywords.filter((k) => keywordSet.has(k.toLocaleLowerCase())).length,
      keywordsTotal: source.keywords.length,
      titleLength: title.length,
      descriptionLength: description.length,
      brandHashtag: !!brandHashtag && finalHashtags.some((h) => h.toLocaleLowerCase() === brandHashtag.toLocaleLowerCase()),
      brandKeyword: hasBrandKeyword(),
    },
    newWords,
    model: `${p.label} · ${p.model}`,
    attempts,
    createdAt: new Date().toISOString(),
    source,
  };
}

// ---------- Files ----------

/** Plain text ready to paste into YouTube Studio. */
export function composedPostText(c: ComposedPost): string {
  return [
    "TIÊU ĐỀ:",
    c.title,
    "",
    "MÔ TẢ:",
    c.description || "(trống)",
    "",
    `HASHTAG (${c.hashtags.length}):`,
    c.hashtags.join(" ") || "(không có)",
    "",
    `KEYWORDS / TAGS (${c.keywords.length}${c.keywordsFromAi ? ", AI gợi ý vì video gốc không có" : ""}):`,
    c.keywords.join(", ") || "(không có)",
    "",
    "---",
    `Viết lại từ: ${c.source.url} · Kênh: ${c.channel}`,
    `Độ giống: tiêu đề ${Math.round(c.similarity.title * 100)}%, mô tả ${Math.round(c.similarity.description * 100)}% · ${c.model}`,
  ].join("\n");
}

const postFile = (id: string, ext: string) => path.join(OUT_DIR, id, `new-post.${ext}`);

export function saveComposedPost(c: ComposedPost) {
  fs.mkdirSync(path.join(OUT_DIR, c.videoId), { recursive: true });
  fs.writeFileSync(postFile(c.videoId, "json"), JSON.stringify(c, null, 2));
  fs.writeFileSync(postFile(c.videoId, "txt"), composedPostText(c));
}

export function loadComposedPost(id: string): ComposedPost | null {
  if (!/^[\w-]{11}$/.test(id) || !fs.existsSync(postFile(id, "json"))) return null;
  return JSON.parse(fs.readFileSync(postFile(id, "json"), "utf8")) as ComposedPost;
}
