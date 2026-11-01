import fs from "node:fs";
import path from "node:path";
import { finalizeSpec } from "../spec/normalize";
import { VideoSpecSchema, type VideoSpec } from "../spec/schema";
import { PROVIDERS, type Provider } from "./ai";
import type { AiOutput, RemakeMode } from "./ai-common";
import { analyzeBasic } from "./analyze-basic";
import { extractFrames } from "./frames";
import { extractPostContent, postContentText, type PostContent } from "./metadata";
import { renderSpec } from "./render";
import { parseVtt, transcriptText, type Cue } from "./transcript";
import { OUT_DIR } from "./tools";
import { downloadSubtitles, downloadVideo, fetchInfo, parseVideoId, type YtInfo } from "./youtube";

export const STEPS = [
  { id: "info", label: "Lấy thông tin & nội dung đăng" },
  { id: "download", label: "Tải video nguồn (≤720p)" },
  { id: "subtitles", label: "Lấy phụ đề" },
  { id: "frames", label: "Cắt khung hình chính" },
  { id: "analyze", label: "Phân tích & viết kịch bản" },
  { id: "render", label: "Render bằng Remotion" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

export type JobEvent =
  | { type: "step"; step: StepId; status: "start" | "done" | "skip"; message?: string }
  | { type: "progress"; step: StepId; progress: number; message?: string }
  | { type: "log"; message: string }
  | { type: "result"; result: JobResult }
  | { type: "error"; message: string };

export type JobOptions = { url: string; mode: RemakeMode; analyzer: "auto" | "ai" | "basic"; provider: Provider; render: boolean };

export type JobResult = {
  id: string;
  post: PostContent;
  spec: VideoSpec;
  notes: string[];
  analyzer: string;
  mode: RemakeMode;
  remixPost: AiOutput["remixPost"] | null;
  video: string | null;
  updatedAt: string;
};

type Emit = (e: JobEvent) => void;

const writeJson = (file: string, data: unknown) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
const readJson = <T>(file: string): T | null => (fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null);

async function step<T>(emit: Emit, id: StepId, fn: () => Promise<T>, doneMessage?: (r: T) => string): Promise<T> {
  emit({ type: "step", step: id, status: "start" });
  const r = await fn();
  emit({ type: "step", step: id, status: "done", message: doneMessage?.(r) });
  return r;
}

const guessLanguage = (info: YtInfo) =>
  info.language?.split("-")[0] ||
  (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(`${info.title} ${info.description ?? ""}`) ? "vi" : "en");

export async function runJob(opts: JobOptions, emit: Emit): Promise<JobResult> {
  const id = parseVideoId(opts.url);
  if (!id) throw new Error("Link YouTube không hợp lệ (cần dạng youtube.com/watch?v=…, youtu.be/… hoặc /shorts/…).");
  const dir = path.join(OUT_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  const info = await step(emit, "info", () => fetchInfo(opts.url), (i) => `${i.title} · ${Math.round(i.duration ?? 0)}s · ${i.width}x${i.height}`);
  writeJson(path.join(dir, "info.json"), info);
  const post = extractPostContent(info);
  writeJson(path.join(dir, "post.json"), post);
  fs.writeFileSync(path.join(dir, "post.txt"), postContentText(post));
  emit({ type: "log", message: `Hashtag: ${post.hashtags.length} · Keywords: ${post.keywords.length}` });

  const video = await step(
    emit,
    "download",
    () =>
      downloadVideo(info, dir, (line) => {
        const m = line.match(/\[download\]\s+([\d.]+)%/);
        if (m) emit({ type: "progress", step: "download", progress: Number(m[1]) / 100 });
      }),
    (f) => path.basename(f),
  );

  let cues: Cue[] = [];
  emit({ type: "step", step: "subtitles", status: "start" });
  try {
    const vtt = await downloadSubtitles(info, dir);
    if (vtt) {
      cues = parseVtt(fs.readFileSync(vtt, "utf8"));
      fs.writeFileSync(path.join(dir, "transcript.txt"), transcriptText(cues));
    }
    emit({ type: "step", step: "subtitles", status: cues.length ? "done" : "skip", message: cues.length ? `${cues.length} dòng phụ đề` : "Video không có phụ đề" });
  } catch (e) {
    emit({ type: "step", step: "subtitles", status: "skip", message: `Bỏ qua phụ đề: ${(e as Error).message.split("\n")[0]}` });
  }

  const frames = await step(emit, "frames", () => extractFrames(video, dir, info.duration ?? 60), (f) => `${f.length} khung hình`);

  const ai = PROVIDERS[opts.provider];
  const useAi = opts.analyzer === "ai" || (opts.analyzer === "auto" && ai.ready());
  const analyzerName = useAi ? `${ai.label} · ${ai.model}` : "basic";
  const analysis = await step(
    emit,
    "analyze",
    async () => {
      emit({
        type: "log",
        message: useAi
          ? `Gửi ${frames.length} khung hình + phụ đề cho ${analyzerName}…`
          : opts.analyzer === "basic"
            ? "Dùng phân tích cơ bản (không AI)."
            : `Chưa có ${ai.envKey} → dùng phân tích cơ bản.`,
      });
      return useAi
        ? ai.analyze({ info, post, frames, cues, mode: opts.mode, onProgress: (message) => emit({ type: "log", message }) })
        : analyzeBasic({ info, post, frames, cues });
    },
    (a) => `${a.scenes.length} cảnh · thể loại ${a.genre}`,
  );
  writeJson(path.join(dir, "analysis.json"), analysis);

  const spec = finalizeSpec(analysis, { width: info.width ?? 1080, height: info.height ?? 1920, fps: info.fps ?? 30, language: guessLanguage(info) }, info.duration);
  writeJson(path.join(dir, "spec.json"), spec);
  post.suggestedKeywords = analysis.suggestedKeywords;
  writeJson(path.join(dir, "post.json"), post);
  fs.writeFileSync(path.join(dir, "post.txt"), postContentText(post));

  const remixPost = opts.mode === "remix" && analysis.remixPost.title ? analysis.remixPost : null;
  writeJson(path.join(dir, "job.json"), { options: opts, analyzer: analyzerName, notes: analysis.notes, remixPost });

  if (opts.render) await renderJobVideo(id, spec, emit);
  else emit({ type: "step", step: "render", status: "skip", message: "Bỏ qua render (--no-render)" });

  return loadJob(id)!;
}

export async function renderJobVideo(id: string, spec: VideoSpec, emit: Emit) {
  const dir = path.join(OUT_DIR, id);
  await step(
    emit,
    "render",
    () => renderSpec(spec, path.join(dir, "remake.mp4"), (p) => emit({ type: "progress", step: "render", progress: p })),
    () => "remake.mp4",
  );
}

/** Saves an edited spec and renders it again. */
export async function rerenderJob(id: string, rawSpec: unknown, emit: Emit): Promise<JobResult> {
  const dir = path.join(OUT_DIR, id);
  if (!fs.existsSync(dir)) throw new Error(`Không có job ${id}`);
  const parsed = VideoSpecSchema.safeParse(rawSpec ?? readJson(path.join(dir, "spec.json")));
  if (!parsed.success) throw new Error(`Kịch bản không hợp lệ: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  writeJson(path.join(dir, "spec.json"), parsed.data);
  await renderJobVideo(id, parsed.data, emit);
  return loadJob(id)!;
}

export function loadJob(id: string): JobResult | null {
  const dir = path.join(OUT_DIR, id);
  const post = readJson<PostContent>(path.join(dir, "post.json"));
  const spec = readJson<VideoSpec>(path.join(dir, "spec.json"));
  if (!post || !spec) return null;
  const job = readJson<{ options: JobOptions; analyzer: string; notes: string[]; remixPost: JobResult["remixPost"] }>(path.join(dir, "job.json"));
  const video = path.join(dir, "remake.mp4");
  const hasVideo = fs.existsSync(video);
  return {
    id,
    post,
    spec,
    notes: job?.notes ?? [],
    analyzer: job?.analyzer ?? "",
    mode: job?.options.mode ?? "clone",
    remixPost: job?.remixPost ?? null,
    video: hasVideo ? video : null,
    updatedAt: (hasVideo ? fs.statSync(video) : fs.statSync(path.join(dir, "spec.json"))).mtime.toISOString(),
  };
}

export function listJobs() {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs
    .readdirSync(OUT_DIR)
    .map((id) => loadJob(id))
    .filter((j): j is JobResult => !!j)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((j) => ({ id: j.id, title: j.post.title, thumbnail: j.post.thumbnail, hasVideo: !!j.video, updatedAt: j.updatedAt }));
}
