import type { Scene } from "../spec/schema";
import type { AiOutput } from "./ai-common";
import { framePalette, type Frame } from "./frames";
import type { PostContent } from "./metadata";
import type { Cue } from "./transcript";
import type { YtInfo } from "./youtube";

const base = { transition: "fade" as const, background: [] as string[], narration: "" };

/** Groups caption lines into on-screen chunks of roughly 2.5–5 seconds. */
function chunkCues(cues: Cue[]) {
  const chunks: { start: number; end: number; lines: string[] }[] = [];
  for (const c of cues) {
    const cur = chunks[chunks.length - 1];
    const words = cur ? cur.lines.join(" ").split(/\s+/).length : 0;
    if (cur && c.start - cur.start < 4.5 && words + c.text.split(/\s+/).length <= 14) {
      cur.lines.push(c.text);
      cur.end = c.end;
    } else chunks.push({ start: c.start, end: c.end, lines: [c.text] });
  }
  return chunks;
}

/**
 * Analyzer that needs no AI: keeps the source's length, title, chapters or
 * captions and colors, laid out with the generic templates.
 */
export async function analyzeBasic(input: { info: YtInfo; post: PostContent; frames: Frame[]; cues: Cue[] }): Promise<AiOutput> {
  const { info, post, frames, cues } = input;
  const duration = info.duration || 30;
  const palette = await framePalette(frames).catch(() => null);
  const introSec = Math.min(3, duration * 0.15);
  const outroSec = duration > 20 ? 3 : 0;
  const body = Math.max(1, duration - introSec - outroSec);
  const heading = post.title.replace(/#[\p{L}\p{N}_]+/gu, "").trim();
  const scenes: Scene[] = [{ type: "title", ...base, transition: "none", durationSec: introSec, narration: heading, heading, subheading: post.channel, emoji: "" }];

  const chapters = (info.chapters ?? []).filter((c) => c.end_time > introSec);
  if (chapters.length >= 2) {
    chapters.forEach((c, i) =>
      scenes.push({
        type: "list-item",
        ...base,
        transition: "slide-left",
        durationSec: c.end_time - Math.max(c.start_time, introSec),
        narration: c.title,
        rank: String(i + 1),
        heading: c.title,
        body: "",
        emoji: "",
      }),
    );
  } else if (cues.length) {
    const chunks = chunkCues(cues.filter((c) => c.end > introSec && c.start < duration - outroSec));
    let cursor = introSec;
    chunks.forEach((ch, i) => {
      const end = i === chunks.length - 1 ? duration - outroSec : Math.max(chunks[i + 1].start, cursor + 0.8);
      scenes.push({
        type: "text",
        ...base,
        transition: i % 3 === 0 ? "slide-up" : "fade",
        durationSec: end - cursor,
        narration: ch.lines.join(" "),
        lines: ch.lines,
        highlight: [],
        animation: "word-by-word",
        align: "center",
        size: "lg",
        emoji: "",
      });
      cursor = end;
    });
  } else {
    const sentences = (post.description || post.title)
      .split(/\n+|(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s && !/^https?:\/\//.test(s) && !/^#/.test(s))
      .slice(0, 8);
    const per = body / Math.max(sentences.length, 1);
    sentences.forEach((s) =>
      scenes.push({ type: "text", ...base, durationSec: per, narration: s, lines: [s], highlight: [], animation: "pop", align: "center", size: "md", emoji: "" }),
    );
  }

  if (outroSec)
    scenes.push({ type: "outro", ...base, durationSec: outroSec, heading: post.channel || post.title, subheading: "", cta: "subscribe", handle: post.handle });

  return {
    genre: chapters.length >= 2 ? "top-list" : "text-story",
    theme: {
      font: "Be Vietnam Pro",
      bgStyle: "blobs",
      bgColors: palette?.bg ?? ["#0F172A", "#1E293B"],
      textColor: "#FFFFFF",
      primary: palette?.primary ?? "#6366F1",
      accent: palette?.accent ?? "#FACC15",
      panel: "#111827",
      motion: duration < 90 ? "energetic" : "smooth",
      progressBar: false,
      sfx: true,
      watermark: post.handle,
    },
    scenes,
    notes: [
      "Phân tích cơ bản (không dùng AI): bố cục dựng từ " +
        (chapters.length >= 2 ? "chapters của video" : cues.length ? "phụ đề có mốc thời gian" : "mô tả video") +
        ", màu lấy trung bình từ khung hình. Thêm API key Claude hoặc OpenAI để AI phân tích chữ, bố cục và chuyển cảnh chính xác hơn.",
    ],
    suggestedKeywords: [],
    remixPost: { title: "", description: "", hashtags: [] },
  };
}
