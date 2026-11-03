import { setEnvValue } from "../env";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISCOVER_STEPS, listDiscoveries, loadDiscovery, runDiscover } from "../discover/discover";
import { LANGUAGE_NAMES } from "../discover/language";
import { COUNTRIES, CATEGORIES, DEFAULT_OPTIONS, estimateQuota, PERIODS, SORTS } from "../discover/options";
import { hasYoutubeKey, KEY_HELP_URL, YoutubeApi } from "../discover/youtube-api";
import { parseProvider, providerStatus } from "../pipeline/ai";
import { listJobs, loadJob, rerenderJob, runJob, STEPS, type JobOptions } from "../pipeline/job";
import { OUT_DIR, ytDlp } from "../pipeline/tools";
import { parseVideoId } from "../pipeline/youtube";

const PORT = Number(process.env.PORT) || 3210;
const HTML = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.html");

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
  ".jpg": "image/jpeg",
};

/** Serves a file from out/<id>/ with Range support so the video can be scrubbed. */
function serveMedia(req: http.IncomingMessage, res: http.ServerResponse, id: string, file: string) {
  const full = path.resolve(OUT_DIR, id, file);
  if (!full.startsWith(path.resolve(OUT_DIR, id) + path.sep) || !fs.existsSync(full)) return json(res, 404, { error: "Không tìm thấy file" });
  const size = fs.statSync(full).size;
  const type = TYPES[path.extname(full)] ?? "application/octet-stream";
  const headers: http.OutgoingHttpHeaders = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
  if (new URL(req.url!, "http://x").searchParams.has("download")) headers["Content-Disposition"] = `attachment; filename="${id}-${file}"`;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    fs.createReadStream(full, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...headers, "Content-Length": size });
    fs.createReadStream(full).pipe(res);
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
    if (parts[0] === "media" && parts.length === 3) return serveMedia(req, res, parts[1], parts[2]);
    if (parts[0] !== "api") return json(res, 404, { error: "Not found" });

    if (req.method === "GET" && parts[1] === "status") {
      let ytdlp = true;
      try {
        ytDlp();
      } catch {
        ytdlp = false;
      }
      return json(res, 200, { providers: providerStatus(), ytdlp, steps: STEPS, youtubeApi: hasYoutubeKey() });
    }
    if (parts[1] === "discover") return await discoverRoutes(req, res, parts.slice(2));
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
      };
      startTask(id, (emit) => runJob(opts, emit));
      return json(res, 202, { id });
    }

    const id = parts[2];
    if (req.method === "GET" && parts.length === 3) {
      const job = loadJob(id);
      return job ? json(res, 200, { ...job, running: running.get(id)?.done === false }) : json(res, 404, { error: "Không có job này" });
    }

    if (req.method === "POST" && parts[3] === "render") {
      if (running.get(id)?.done === false) return json(res, 409, { error: "Video này đang được xử lý." });
      const body = (await readBody(req)) as { spec?: unknown };
      startTask(id, (emit) => rerenderJob(id, body.spec ?? null, emit));
      return json(res, 202, { id });
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
      quotaPerPage: estimateQuota(1),
      youtubeApi: hasYoutubeKey(),
      keyHelpUrl: KEY_HELP_URL,
      languages: LANGUAGE_NAMES,
    });
  if (req.method === "GET" && rest.length === 0) return json(res, 200, listDiscoveries());
  if (req.method === "POST" && rest.length === 0) {
    if (!hasYoutubeKey()) return json(res, 400, { error: "Chưa có YOUTUBE_API_KEY. Dán khóa YouTube Data API v3 ở phần cài đặt phía trên." });
    const body = await readBody(req);
    const task = `discover-${Date.now()}`;
    startTask(task, (emit) => runDiscover(body, emit));
    return json(res, 202, { task });
  }
  if (req.method === "GET" && rest.length === 2 && rest[1] === "events") return streamEvents(req, res, rest[0]);
  if (req.method === "GET" && rest.length === 1) {
    const result = loadDiscovery(rest[0]);
    return result ? json(res, 200, result) : json(res, 404, { error: "Không có kết quả tìm kiếm này" });
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
  openBrowser();
});
