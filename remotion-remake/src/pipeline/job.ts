import fs from "node:fs";
import path from "node:path";
import { finalizeSpec } from "../spec/normalize";
import { VideoSpecSchema, type VideoSpec } from "../spec/schema";
import { PROVIDERS, type Provider } from "./ai";
import type { AiOutput, RemakeMode } from "./ai-common";
import { analyzeBasic } from "./analyze-basic";
import { hasElevenLabsKey } from "./elevenlabs";
import { extractFrames, type Frame } from "./frames";
import { extractPostContent, postContentText, type PostContent } from "./metadata";
import { renderSpec } from "./render";
import { OUT_DIR, readJsonSafe, writeFileAtomic, writeJsonAtomic } from "./tools";
import { parseVtt, transcriptText, type Cue } from "./transcript";
import { addVoiceover, narrationChars, voiceDir } from "./voiceover";
import { downloadedSource, downloadSubtitles, downloadVideo, fetchInfo, parseVideoId, type YtInfo } from "./youtube";

export const STEPS = [
  { id: "info", label: "Lấy thông tin & nội dung đăng" },
  { id: "download", label: "Tải video nguồn (≤720p)" },
  { id: "subtitles", label: "Lấy phụ đề" },
  { id: "frames", label: "Cắt khung hình chính" },
  { id: "analyze", label: "Phân tích & viết kịch bản" },
  { id: "voice", label: "Lồng tiếng (ElevenLabs)" },
  { id: "render", label: "Render bằng Remotion" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

export type JobEvent =
  | { type: "step"; step: StepId; status: "start" | "done" | "skip"; message?: string }
  | { type: "progress"; step: StepId; progress: number; message?: string }
  | { type: "log"; message: string }
  | { type: "result"; result: JobResult }
  | { type: "error"; message: string };

export type JobOptions = { url: string; mode: RemakeMode; analyzer: "auto" | "ai" | "basic"; provider: Provider; render: boolean; voice: boolean };

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

/**
 * Progress of a job, saved after every step in out/<id>/state.json. If the
 * computer shuts down mid-job the file still says "running"; the next start
 * of the app offers to continue from the first unfinished step.
 */
export type JobState = {
  options: JobOptions;
  status: "running" | "done" | "error" | "dismissed";
  /** Step in progress (or the one that failed). */
  step: StepId;
  /** Steps already finished; skipped when the job is continued. */
  done: StepId[];
  title: string;
  error: string;
  startedAt: string;
  updatedAt: string;
};

type Emit = (e: JobEvent) => void;

const readJson = <T>(file: string): T | null => readJsonSafe<T>(file);
const stateFile = (id: string) => path.join(OUT_DIR, id, "state.json");
export const loadState = (id: string) => readJson<JobState>(stateFile(id));

class Progress {
  constructor(
    private id: string,
    public state: JobState,
  ) {}
  save(patch: Partial<JobState>) {
    this.state = { ...this.state, ...patch, updatedAt: new Date().toISOString() };
    writeJsonAtomic(stateFile(this.id), this.state);
  }
  has = (s: StepId) => this.state.done.includes(s);
  /** Steps that come before `s` in the pipeline. */
  private before = (s: StepId) => STEPS.map((x) => x.id as StepId).slice(0, STEPS.findIndex((x) => x.id === s));
  /** A step that runs again makes itself and every later step stale until they finish again. */
  start = (s: StepId) => this.save({ status: "running", step: s, error: "", done: this.state.done.filter((d) => this.before(s).includes(d)) });
  finish = (s: StepId) => this.save({ done: [...this.state.done.filter((d) => this.before(s).includes(d)), s] });
}

async function step<T>(emit: Emit, p: Progress, id: StepId, fn: () => Promise<T>, doneMessage?: (r: T) => string): Promise<T> {
  p.start(id);
  emit({ type: "step", step: id, status: "start" });
  const r = await fn();
  p.finish(id);
  emit({ type: "step", step: id, status: "done", message: doneMessage?.(r) });
  return r;
}

/** Marks a step finished in an earlier run (continued job). */
const reuse = (emit: Emit, id: StepId, message: string) => emit({ type: "step", step: id, status: "done", message: `${message} (đã xong từ lần trước)` });

const guessLanguage = (info: YtInfo) =>
  info.language?.split("-")[0] ||
  (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(`${info.title} ${info.description ?? ""}`) ? "vi" : "en");

/**
 * Runs (or, with `resume`, continues) a remake. A continued job reuses every
 * finished step whose files are still on disk: the download goes on from the
 * partial file, the AI analysis and voice clips are not paid for again.
 */
export async function runJob(opts: JobOptions, emit: Emit, { resume = false } = {}): Promise<JobResult> {
  const id = parseVideoId(opts.url);
  if (!id) throw new Error("Link YouTube không hợp lệ (cần dạng youtube.com/watch?v=…, youtu.be/… hoặc /shorts/…).");
  const dir = path.join(OUT_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const previous = resume ? loadState(id) : null;
  if (resume && !previous) throw new Error("Không còn tiến trình đã lưu của video này để tiếp tục.");
  const now = new Date().toISOString();
  const p = new Progress(
    id,
    previous
      ? { ...previous, status: "running" }
      : { options: opts, status: "running", step: "info", done: [], title: "", error: "", startedAt: now, updatedAt: now },
  );
  if (previous) opts = previous.options;
  p.save({});

  try {
    // 1. Metadata
    let info = p.has("info") ? readJson<YtInfo>(path.join(dir, "info.json")) : null;
    if (info) reuse(emit, "info", info.title);
    else {
      info = await step(emit, p, "info", () => fetchInfo(opts.url), (i) => `${i.title} · ${Math.round(i.duration ?? 0)}s · ${i.width}x${i.height}`);
      writeJsonAtomic(path.join(dir, "info.json"), info);
    }
    p.save({ title: info.title });
    const post = extractPostContent(info);
    writeJsonAtomic(path.join(dir, "post.json"), post);
    writeFileAtomic(path.join(dir, "post.txt"), postContentText(post));
    emit({ type: "log", message: `Hashtag: ${post.hashtags.length} · Keywords: ${post.keywords.length}` });

    // 2. Source video
    let video = p.has("download") ? downloadedSource(dir) : null;
    if (video) reuse(emit, "download", path.basename(video));
    else {
      video = await step(
        emit,
        p,
        "download",
        () =>
          downloadVideo(
            info,
            dir,
            (line) => {
              const m = line.match(/\[download\]\s+([\d.]+)%/);
              if (m) emit({ type: "progress", step: "download", progress: Number(m[1]) / 100 });
            },
            resume,
          ),
        (f) => path.basename(f),
      );
    }

    // 3. Captions (optional)
    let cues: Cue[] = [];
    const vttFile = () => fs.readdirSync(dir).find((f) => f.startsWith("subs.") && f.endsWith(".vtt"));
    if (p.has("subtitles")) {
      const vtt = vttFile();
      cues = vtt ? parseVtt(fs.readFileSync(path.join(dir, vtt), "utf8")) : [];
      reuse(emit, "subtitles", cues.length ? `${cues.length} dòng phụ đề` : "Video không có phụ đề");
    } else {
      p.start("subtitles");
      emit({ type: "step", step: "subtitles", status: "start" });
      try {
        const vtt = await downloadSubtitles(info, dir);
        if (vtt) {
          cues = parseVtt(fs.readFileSync(vtt, "utf8"));
          writeFileAtomic(path.join(dir, "transcript.txt"), transcriptText(cues));
        }
        emit({ type: "step", step: "subtitles", status: cues.length ? "done" : "skip", message: cues.length ? `${cues.length} dòng phụ đề` : "Video không có phụ đề" });
      } catch (e) {
        emit({ type: "step", step: "subtitles", status: "skip", message: `Bỏ qua phụ đề: ${(e as Error).message.split("\n")[0]}` });
      }
      p.finish("subtitles");
    }

    // 4. Keyframes (list saved in frames.json so a continued job can reuse them)
    const framesFile = path.join(dir, "frames.json");
    const savedFrames = p.has("frames") ? readJson<{ name: string; t: number }[]>(framesFile) : null;
    let frames: Frame[] | null = savedFrames?.map((f) => ({ t: f.t, file: path.join(dir, "frames", f.name) })) ?? null;
    if (frames && frames.every((f) => fs.existsSync(f.file))) reuse(emit, "frames", `${frames.length} khung hình`);
    else {
      frames = await step(emit, p, "frames", () => extractFrames(video, dir, info.duration ?? 60), (f) => `${f.length} khung hình`);
      writeJsonAtomic(
        framesFile,
        frames.map((f) => ({ name: path.basename(f.file), t: f.t })),
      );
    }

    // 5. AI (or basic) analysis → spec
    const ai = PROVIDERS[opts.provider];
    const useAi = opts.analyzer === "ai" || (opts.analyzer === "auto" && ai.ready());
    const analyzerName = useAi ? `${ai.label} · ${ai.model}` : "basic";
    let spec = p.has("analyze") ? readJson<VideoSpec>(path.join(dir, "spec.json")) : null;
    const savedAnalysis = p.has("analyze") ? readJson<AiOutput>(path.join(dir, "analysis.json")) : null;
    if (spec && savedAnalysis) reuse(emit, "analyze", `${spec.scenes.length} cảnh · thể loại ${spec.genre}`);
    else {
      const analysis = await step(
        emit,
        p,
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
          const result = useAi
            ? await ai.analyze({ info, post, frames, cues, mode: opts.mode, onProgress: (message) => emit({ type: "log", message }) })
            : await analyzeBasic({ info, post, frames, cues });
          // Saved before the step is marked done, so a paid AI answer is never lost.
          writeJsonAtomic(path.join(dir, "analysis.json"), result);
          return result;
        },
        (a) => `${a.scenes.length} cảnh · thể loại ${a.genre}`,
      );
      spec = finalizeSpec(analysis, { width: info.width ?? 1080, height: info.height ?? 1920, fps: info.fps ?? 30, language: guessLanguage(info) }, info.duration);
      writeJsonAtomic(path.join(dir, "spec.json"), spec);
      post.suggestedKeywords = analysis.suggestedKeywords;
      writeJsonAtomic(path.join(dir, "post.json"), post);
      writeFileAtomic(path.join(dir, "post.txt"), postContentText(post));
      const remixPost = opts.mode === "remix" && analysis.remixPost.title ? analysis.remixPost : null;
      writeJsonAtomic(path.join(dir, "job.json"), { options: opts, analyzer: analyzerName, notes: analysis.notes, remixPost });
    }

    // 6. Voice-over
    if (opts.voice) spec = await voiceStep(id, spec, emit, p);
    else emit({ type: "step", step: "voice", status: "skip", message: "Không lồng tiếng" });

    // 7. Render
    if (!opts.render) emit({ type: "step", step: "render", status: "skip", message: "Bỏ qua render (--no-render)" });
    else if (p.has("render") && fs.existsSync(path.join(dir, "remake.mp4"))) reuse(emit, "render", "remake.mp4");
    else await renderJobVideo(id, spec, emit, p);

    p.save({ status: "done" });
    return loadJob(id)!;
  } catch (e) {
    p.save({ status: "error", error: (e as Error).message.split("\n")[0] });
    throw e;
  }
}

/** Creates (or reuses) the ElevenLabs clips and saves the spec with them. */
async function voiceStep(id: string, spec: VideoSpec, emit: Emit, p: Progress): Promise<VideoSpec> {
  return step(
    emit,
    p,
    "voice",
    async () => {
      if (!hasElevenLabsKey()) throw new Error("Chưa có ELEVENLABS_API_KEY: thêm ở tab ⚙️ Cài đặt, hoặc bỏ chọn Lồng tiếng.");
      emit({ type: "log", message: `Lồng tiếng ${spec.scenes.filter((s) => s.narration.trim()).length} cảnh · ${narrationChars(spec)} ký tự (dòng đã tạo trước đó không tính lại).` });
      const voiced = await addVoiceover(id, spec, (done, total, message) => {
        emit({ type: "progress", step: "voice", progress: done / total });
        emit({ type: "log", message });
      });
      writeJsonAtomic(path.join(OUT_DIR, id, "spec.json"), voiced);
      return voiced;
    },
    (s) => `${s.voiceover.length} đoạn giọng · video dài ${s.scenes.reduce((n, x) => n + x.durationSec, 0).toFixed(1)} giây`,
  );
}

export async function renderJobVideo(id: string, spec: VideoSpec, emit: Emit, p?: Progress) {
  const dir = path.join(OUT_DIR, id);
  const progress = p ?? new Progress(id, loadState(id) ?? newState(id));
  await step(
    emit,
    progress,
    "render",
    () =>
      renderSpec(spec, path.join(dir, "remake.mp4"), (x) => emit({ type: "progress", step: "render", progress: x }), [
        { from: voiceDir(id), to: `voice/${id}` },
      ]),
    () => "remake.mp4",
  );
}

/** State for jobs made before state.json existed (re-render from the page). */
function newState(id: string): JobState {
  const job = readJson<{ options: JobOptions }>(path.join(OUT_DIR, id, "job.json"));
  const now = new Date().toISOString();
  const options = { url: `https://www.youtube.com/watch?v=${id}`, mode: "clone", analyzer: "auto", provider: "claude", render: true, voice: false, ...job?.options } as JobOptions;
  return { options, status: "running", step: "render", done: ["info", "download", "subtitles", "frames", "analyze"], title: "", error: "", startedAt: now, updatedAt: now };
}

/** Saves an edited spec, refreshes the voice-over if the job uses one, and renders it again. */
export async function rerenderJob(id: string, rawSpec: unknown, emit: Emit): Promise<JobResult> {
  const dir = path.join(OUT_DIR, id);
  if (!fs.existsSync(dir)) throw new Error(`Không có job ${id}`);
  const parsed = VideoSpecSchema.safeParse(rawSpec ?? readJson(path.join(dir, "spec.json")));
  if (!parsed.success) throw new Error(`Kịch bản không hợp lệ: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  let spec = parsed.data;
  writeJsonAtomic(path.join(dir, "spec.json"), spec);
  const p = new Progress(id, loadState(id) ?? newState(id));
  try {
    if (p.state.options.voice) spec = await voiceStep(id, spec, emit, p);
    await renderJobVideo(id, spec, emit, p);
    p.save({ status: "done" });
  } catch (e) {
    p.save({ status: "error", error: (e as Error).message.split("\n")[0] });
    throw e;
  }
  return loadJob(id)!;
}

/** Jobs that stopped before the end: interrupted (power cut, app closed) or failed. */
export function unfinishedJobs(isRunningNow: (id: string) => boolean) {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs
    .readdirSync(OUT_DIR)
    .filter((id) => !id.startsWith("_") && !isRunningNow(id))
    .map((id) => ({ id, state: loadState(id) }))
    .filter((j): j is { id: string; state: JobState } => !!j.state && (j.state.status === "running" || j.state.status === "error"))
    .map(({ id, state }) => ({
      id,
      title: state.title || id,
      interrupted: state.status === "running",
      step: state.step,
      stepLabel: STEPS.find((s) => s.id === state.step)?.label ?? state.step,
      done: state.done.length,
      total: STEPS.length,
      error: state.error,
      updatedAt: state.updatedAt,
    }));
}

/** "Bỏ qua": the job is no longer offered for continuing (its files stay). */
export function dismissJob(id: string) {
  const state = loadState(id);
  if (state) writeJsonAtomic(stateFile(id), { ...state, status: "dismissed", updatedAt: new Date().toISOString() });
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
