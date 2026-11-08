import { setEnvValue } from "../env";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream";
import { fileURLToPath } from "node:url";
import { addChannels, CHANNEL_STEPS, listChannels, removeChannel, runChannelShorts } from "../discover/channels";
import { dismissDiscovery, DISCOVER_STEPS, listDiscoveries, loadDiscovery, newDiscoverId, runDiscover, unfinishedDiscoveries } from "../discover/discover";
import { LANGUAGE_NAMES } from "../discover/language";
import { COUNTRIES, CATEGORIES, DEFAULT_OPTIONS, estimateQuota, PERIODS, SORTS } from "../discover/options";
import { hasYoutubeKey, KEY_HELP_URL, YoutubeApi } from "../discover/youtube-api";
import { FED, RECURRING_CAST } from "../fedtoon/cast";
import { parseProvider, providerStatus } from "../pipeline/ai";
import { catalog, hasElevenLabsKey, previewVoice } from "../pipeline/elevenlabs";
import { dismissJob, drawBackgroundForJob, drawPropForJob, listJobs, loadJob, loadState, previewShot, renderSavedJob, rerenderJob, runJob, saveSpec, stepsNow, unfinishedJobs, type JobOptions } from "../pipeline/job";
import { imageToolNames } from "../pipeline/images";
import { composePost, defaultChannel, LIMITS, loadComposedPost, loadPostSource, parseWriterOptions, sanitizeSource, saveComposedPost, TARGET } from "../pipeline/post-writer";
import { OUT_DIR, ROOT, ytDlp } from "../pipeline/tools";
import { parseVideoId } from "../pipeline/youtube";
import { commentedSettingWarnings, numberSetting, publicSettings, saveSettings } from "../settings";

const PORT = numberSetting("PORT") || 3210;
const HTML = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.html");

/**
 * The commit of the code on disk. The app keeps running the code it started with, so after an update
 * (git pull) it must be reopened: until then the page warns, or new videos would be made the old way.
 */
function codeVersion(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8", timeout: 5000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}
const STARTED_VERSION = codeVersion();
const isOutdated = () => !!STARTED_VERSION && codeVersion() !== STARTED_VERSION;

/** Events streamed to the page: JobEvent, DiscoverEvent, plus the final result or error. */
type TaskEvent = { type: string };
type Running = { events: TaskEvent[]; listeners: Set<http.ServerResponse>; done: boolean };
const running = new Map<string, Running>();

function startTask<E extends TaskEvent>(id: string, task: (emit: (e: E) => void) => Promise<unknown>) {
  const state: Running = { events: [], listeners: new Set(), done: false };
  running.set(id, state);
  const emit = (e: TaskEvent) => {
    state.events.push(e);
    for (const res of state.listeners) res.write(`data: ${JSON.stringify(e)}\n\n`);
  };
  task(emit)
    .then((result) => emit({ type: "result", result } as TaskEvent))
    .catch((err: Error) => emit({ type: "error", message: err.message } as TaskEvent))
    .finally(() => {
      state.done = true;
      for (const res of state.listeners) res.end();
      state.listeners.clear();
    });
}

/** Replays a task's past events, then streams new ones until it ends (Server-Sent Events). */
function streamEvents(req: http.IncomingMessage, res: http.ServerResponse, id: string) {
  const state = running.get(id);
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  for (const e of state?.events ?? []) res.write(`data: ${JSON.stringify(e)}\n\n`);
  if (!state || state.done) return res.end();
  state.listeners.add(res);
  req.on("close", () => state.listeners.delete(res));
}

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const readBody = (req: http.IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("JSON không hợp lệ"));
      }
    });
  });

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".jpg": "image/jpeg", ".png": "image/png",
};

/** Serves a file from out/<id>/ with Range support so the video can be scrubbed. Pictures are named after their content, so the browser may keep them. */
const MEDIA_CHUNK = 2 * 1024 * 1024;

function serveMedia(req: http.IncomingMessage, res: http.ServerResponse, id: string, file: string) {
  const full = path.resolve(OUT_DIR, id, file);
  if (!full.startsWith(path.resolve(OUT_DIR, id) + path.sep) || !fs.existsSync(full)) return json(res, 404, { error: "Không tìm thấy file" });
  const size = fs.statSync(full).size;
  const type = TYPES[path.extname(full)] ?? "application/octet-stream";
  const headers: http.OutgoingHttpHeaders = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": file.startsWith("img/") ? "max-age=86400" : "no-store" };
  if (new URL(req.url!, "http://x").searchParams.has("download")) headers["Content-Disposition"] = `attachment; filename="${id}-${file}"`;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = Math.min(range[1] && range[2] ? Number(range[2]) : size - 1, start + MEDIA_CHUNK - 1);
    // Read a chunk and close the file at once. A stream would stay open while the browser
    // pauses buffering, and Windows then refuses to replace remake.mp4 after the next render.
    const chunk = Buffer.alloc(end - start + 1);
    const fd = fs.openSync(full, "r");
    try {
      fs.readSync(fd, chunk, 0, chunk.length, start);
    } finally {
      fs.closeSync(fd);
    }
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": chunk.length });
    res.end(chunk);
  } else {
    res.writeHead(200, { ...headers, "Content-Length": size });
    pipeline(fs.createReadStream(full), res, () => {});
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return fs.createReadStream(HTML).pipe(res);
    }
    if (parts[0] === "media" && parts.length >= 3) return serveMedia(req, res, parts[1], parts.slice(2).join("/"));
    if (parts[0] !== "api") return json(res, 404, { error: "Not found" });

    if (req.method === "GET" && parts[1] === "version") return json(res, 200, { outdated: isOutdated() });
    if (req.method === "GET" && parts[1] === "status") {
      let ytdlp = true;
      try {
        ytDlp();
      } catch {
        ytdlp = false;
      }
      return json(res, 200, { providers: providerStatus(), ytdlp, steps: stepsNow(), imageTools: imageToolNames(), youtubeApi: hasYoutubeKey(), elevenlabs: hasElevenLabsKey(), fedtoonCast: [FED, ...RECURRING_CAST] });
    }
    if (parts[1] === "settings" && parts.length === 2) return await settingsRoutes(req, res);
    if (parts[1] === "elevenlabs") return await elevenLabsRoutes(req, res, parts[2]);
    if (parts[1] === "discover") return await discoverRoutes(req, res, parts.slice(2));
    if (parts[1] === "post" && req.method === "POST") return await postRoutes(req, res, parts[2]);
    if (parts[1] === "unfinished") return await unfinishedRoutes(req, res, parts[2]);
    if (parts[1] === "settings" && parts[2] === "youtube-key" && req.method === "POST") return await saveYoutubeKey(req, res);
    if (parts[1] !== "jobs") return json(res, 404, { error: "Not found" });

    if (req.method === "GET" && parts.length === 2) return json(res, 200, listJobs());

    if (req.method === "POST" && parts.length === 2) {
      const body = (await readBody(req)) as Partial<JobOptions>;
      const id = parseVideoId(body.url ?? "");
      if (!id) return json(res, 400, { error: "Link YouTube không hợp lệ." });
      if (running.get(id)?.done === false) return json(res, 409, { error: "Video này đang được xử lý.", id });
      const opts: JobOptions = {
        url: body.url!,
        mode: body.mode === "remix" ? "remix" : "clone",
        analyzer: body.analyzer === "ai" || body.analyzer === "basic" ? body.analyzer : "auto",
        provider: parseProvider(body.provider),
        render: body.render !== false,
        voice: body.voice === true,
        style: body.style === "classic" ? "classic" : "fedtoon",
        review: body.review === true,
      };
      startTask(id, (emit) => runJob(opts, emit));
      return json(res, 202, { id });
    }

    const id = parts[2];
    if (req.method === "GET" && parts.length === 3) {
      const job = loadJob(id);
      return job ? json(res, 200, { ...job, running: running.get(id)?.done === false }) : json(res, 404, { error: "Không có job này" });
    }

    if (req.method === "POST" && parts[3] === "resume") {
      if (running.get(id)?.done === false) return json(res, 409, { error: "Video này đang được xử lý." });
      const state = loadState(id);
      if (!state) return json(res, 404, { error: "Không còn tiến trình đã lưu của video này." });
      startTask(id, (emit) => runJob(state.options, emit, { resume: true }));
      return json(res, 202, { id });
    }

    if (req.method === "POST" && parts[3] === "render") {
      if (running.get(id)?.done === false) return json(res, 409, { error: "Video này đang được xử lý." });
      const body = (await readBody(req)) as { spec?: unknown };
      startTask(id, (emit) => rerenderJob(id, body.spec ?? null, emit));
      return json(res, 202, { id });
    }

    if (req.method === "POST" && parts[3] === "render-saved") {
      if (running.get(id)?.done === false) return json(res, 409, { error: "Video này đang được xử lý." });
      startTask(id, (emit) => renderSavedJob(id, emit));
      return json(res, 202, { id });
    }

    // Scene editor: saving, previewing and reusing pictures never call an AI; draw-prop and draw-bg do, on an explicit click.
    if (req.method === "POST" && (parts[3] === "spec" || parts[3] === "preview")) {
      if (running.get(id)?.done === false) return json(res, 409, { error: "Video này đang được render, chờ xong rồi thử lại." });
      const body = (await readBody(req)) as { spec?: unknown; shot?: number };
      return json(res, 200, parts[3] === "spec" ? { spec: saveSpec(id, body.spec) } : await previewShot(id, body.spec, Number(body.shot)));
    }

    if (req.method === "POST" && parts[3] === "draw-prop") {
      const body = (await readBody(req)) as { prompt?: string };
      return json(res, 200, await drawPropForJob(id, String(body.prompt ?? "")));
    }
    if (req.method === "POST" && parts[3] === "draw-bg") {
      // Paid: only the app's own page (a JSON request) may ask, not a form on another website.
      if (!req.headers["content-type"]?.startsWith("application/json")) return json(res, 415, { error: "Cần gửi JSON" });
      const body = (await readBody(req)) as { prompt?: string; colors?: unknown; avoid?: unknown };
      return json(res, 200, await drawBackgroundForJob(id, String(body.prompt ?? ""), body.colors, body.avoid));
    }

    if (req.method === "GET" && parts[3] === "events") return streamEvents(req, res, id);
    return json(res, 404, { error: "Not found" });
  } catch (e) {
    return json(res, 500, { error: (e as Error).message });
  }
});

/** /api/discover/… — the "Tìm video hot" tab. */
async function discoverRoutes(req: http.IncomingMessage, res: http.ServerResponse, rest: string[]) {
  if (req.method === "GET" && rest[0] === "options")
    return json(res, 200, {
      countries: COUNTRIES,
      categories: CATEGORIES,
      periods: PERIODS,
      sorts: SORTS,
      defaults: DEFAULT_OPTIONS,
      steps: DISCOVER_STEPS,
      channelSteps: CHANNEL_STEPS,
      quotaPerPage: estimateQuota(1),
      youtubeApi: hasYoutubeKey(),
      keyHelpUrl: KEY_HELP_URL,
      languages: LANGUAGE_NAMES,
    });
  if (rest[0] === "channels") return channelRoutes(req, res, rest.slice(1));
  if (req.method === "GET" && rest.length === 0) return json(res, 200, listDiscoveries());
  if (req.method === "POST" && rest.length === 0) {
    if (!hasYoutubeKey()) return json(res, 400, { error: "Chưa có YOUTUBE_API_KEY. Dán khóa YouTube Data API v3 ở phần cài đặt phía trên." });
    const body = await readBody(req);
    const id = newDiscoverId();
    const task = `discover-${id}`;
    startTask(task, (emit) => runDiscover(body, emit, { id }));
    return json(res, 202, { task });
  }
  if (req.method === "GET" && rest.length === 2 && rest[1] === "events") return streamEvents(req, res, rest[0]);
  if (req.method === "POST" && rest.length === 2 && rest[1] === "resume") {
    const task = `discover-${rest[0]}`;
    if (running.get(task)?.done === false) return json(res, 409, { error: "Lần tìm này đang chạy." });
    if (!hasYoutubeKey()) return json(res, 400, { error: "Chưa có YOUTUBE_API_KEY." });
    startTask(task, (emit) => runDiscover(null, emit, { id: rest[0], resume: true }));
    return json(res, 202, { task });
  }
  if (req.method === "GET" && rest.length === 1) {
    const result = loadDiscovery(rest[0]);
    return result ? json(res, 200, result) : json(res, 404, { error: "Không có kết quả tìm kiếm này" });
  }
  return json(res, 404, { error: "Not found" });
}

/** /api/discover/channels/… — "Top Shorts của kênh": the saved channels (add, remove) and a scan of one channel's Shorts. */
async function channelRoutes(req: http.IncomingMessage, res: http.ServerResponse, rest: string[]) {
  if (req.method === "GET" && rest.length === 0) return json(res, 200, listChannels());
  if (req.method === "DELETE" && rest.length === 1) return json(res, 200, removeChannel(rest[0]));
  if (req.method === "POST") {
    if (!hasYoutubeKey()) return json(res, 400, { error: "Chưa có YOUTUBE_API_KEY. Dán khóa YouTube Data API v3 ở phần cài đặt phía trên." });
    const body = (await readBody(req)) as { channel?: unknown; text?: unknown };
    if (rest.length === 0) return json(res, 200, await addChannels(String(body.text ?? "")));
    if (rest[0] === "scan") {
      const task = "channels-scan";
      if (running.get(task)?.done === false) return json(res, 409, { error: "Đang quét kênh, chờ xong rồi thử lại." });
      startTask(task, (emit) => runChannelShorts(body, emit));
      return json(res, 202, { task });
    }
  }
  return json(res, 404, { error: "Not found" });
}

/** /api/post/… — "Soạn thông tin đăng YouTube" in the remake tab. */
async function postRoutes(req: http.IncomingMessage, res: http.ServerResponse, action: string | undefined) {
  // These calls can spend AI credit: only the app's own page (JSON fetch) may make them, not a form on another website.
  if (!req.headers["content-type"]?.startsWith("application/json")) return json(res, 415, { error: "Cần gửi JSON" });
  const body = (await readBody(req)) as { url?: unknown; source?: unknown; provider?: unknown; channel?: unknown; brandTags?: unknown };
  // source: the source video's title/description/keywords; from the page, or loaded by URL.
  if (action === "source") {
    const source = body.source ? sanitizeSource(body.source) : await loadPostSource(typeof body.url === "string" ? body.url : "");
    return json(res, 200, { source, saved: loadComposedPost(source.videoId), target: TARGET, limits: LIMITS, defaultChannel: defaultChannel() });
  }
  if (action === "compose") {
    const post = await composePost(sanitizeSource(body.source), parseProvider(body.provider), parseWriterOptions(body));
    saveComposedPost(post);
    return json(res, 200, post);
  }
  return json(res, 404, { error: "Not found" });
}

/** /api/unfinished — work interrupted by a power cut / closed app (or failed), offered for continuing. */
async function unfinishedRoutes(req: http.IncomingMessage, res: http.ServerResponse, action: string | undefined) {
  if (req.method === "GET" && !action)
    return json(res, 200, {
      jobs: unfinishedJobs((id) => running.get(id)?.done === false),
      discover: unfinishedDiscoveries((id) => running.get(`discover-${id}`)?.done === false),
    });
  if (req.method === "POST" && action === "dismiss") {
    if (!isJson(req)) return json(res, 415, { error: "Cần gửi JSON" });
    const { kind, id } = (await readBody(req)) as { kind?: unknown; id?: unknown };
    if (typeof id !== "string") return json(res, 400, { error: "Thiếu id" });
    if (kind === "discover") dismissDiscovery(id);
    else if (parseVideoId(id) === id) dismissJob(id);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: "Not found" });
}

/** Writes need a JSON body: a form on another website cannot send one to this local app. */
const isJson = (req: http.IncomingMessage) => !!req.headers["content-type"]?.startsWith("application/json");

/** /api/settings — every API parameter (⚙️ Cài đặt tab). Secrets are never sent back. */
async function settingsRoutes(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === "GET") return json(res, 200, publicSettings());
  if (req.method !== "POST") return json(res, 404, { error: "Not found" });
  if (!isJson(req)) return json(res, 415, { error: "Cần gửi JSON" });
  const changed = saveSettings(await readBody(req));
  return json(res, 200, { changed, ...publicSettings() });
}

/** /api/elevenlabs/… — voice list and voice preview for the settings tab. */
async function elevenLabsRoutes(req: http.IncomingMessage, res: http.ServerResponse, action: string | undefined) {
  if (req.method === "GET" && action === "catalog") return json(res, 200, await catalog());
  if (req.method === "POST" && action === "preview") {
    if (!isJson(req)) return json(res, 415, { error: "Cần gửi JSON" });
    const { text } = (await readBody(req)) as { text?: unknown };
    const speech = await previewVoice(typeof text === "string" && text.trim() ? text : "Xin chào, đây là giọng đọc thử cho video của bạn.");
    res.writeHead(200, { "Content-Type": speech.ext === "wav" ? "audio/wav" : speech.ext === "opus" ? "audio/ogg" : "audio/mpeg", "Cache-Control": "no-store" });
    return res.end(speech.audio);
  }
  return json(res, 404, { error: "Not found" });
}

/** Checks a YouTube Data API key with a 1-unit call, then saves it to .env. */
async function saveYoutubeKey(req: http.IncomingMessage, res: http.ServerResponse) {
  // Only the app's own page (JSON fetch) may change settings, not a form on another website.
  if (!req.headers["content-type"]?.startsWith("application/json")) return json(res, 415, { error: "Cần gửi JSON" });
  const { key } = (await readBody(req)) as { key?: unknown };
  const value = typeof key === "string" ? key.trim() : "";
  if (!/^[\w-]{20,100}$/.test(value)) return json(res, 400, { error: "Khóa không đúng định dạng (khóa YouTube API thường bắt đầu bằng AIza…)." });
  await new YoutubeApi(value).ping();
  setEnvValue("YOUTUBE_API_KEY", value);
  return json(res, 200, { ok: true });
}

const APP_URL = `http://localhost:${PORT}`;

/** The double-click launcher sets OPEN_BROWSER so the app opens itself once it is up. */
function openBrowser() {
  if (!process.env.OPEN_BROWSER) return;
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", APP_URL]] : process.platform === "darwin" ? ["open", [APP_URL]] : ["xdg-open", [APP_URL]];
  spawn(cmd, args as string[], { stdio: "ignore", detached: true }).unref();
}

server.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code !== "EADDRINUSE") throw e;
  console.log(`App đã chạy sẵn ở ${APP_URL}.`);
  openBrowser();
  process.exit(0);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Remotion Remake đang chạy: ${APP_URL}`);
  for (const p of Object.values(providerStatus())) console.log(`${p.label} (${p.model}): ${p.ready ? "sẵn sàng" : `chưa có ${p.envKey}`}`);
  for (const w of commentedSettingWarnings()) console.log(w);
  openBrowser();
});
