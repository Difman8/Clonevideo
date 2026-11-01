import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseProvider, providerStatus } from "../pipeline/ai";
import { listJobs, loadJob, rerenderJob, runJob, STEPS, type JobEvent, type JobOptions } from "../pipeline/job";
import { OUT_DIR, ROOT, ytDlp } from "../pipeline/tools";
import { parseVideoId } from "../pipeline/youtube";

if (fs.existsSync(path.join(ROOT, ".env"))) process.loadEnvFile(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT) || 3210;
const HTML = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.html");

type Running = { events: JobEvent[]; listeners: Set<http.ServerResponse>; done: boolean };
const running = new Map<string, Running>();

function startTask(id: string, task: (emit: (e: JobEvent) => void) => Promise<unknown>) {
  const state: Running = { events: [], listeners: new Set(), done: false };
  running.set(id, state);
  const emit = (e: JobEvent) => {
    state.events.push(e);
    for (const res of state.listeners) res.write(`data: ${JSON.stringify(e)}\n\n`);
  };
  task(emit)
    .then((result) => emit({ type: "result", result: result as never }))
    .catch((err: Error) => emit({ type: "error", message: err.message }))
    .finally(() => {
      state.done = true;
      for (const res of state.listeners) res.end();
      state.listeners.clear();
    });
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

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8", ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg" };

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
      return json(res, 200, { providers: providerStatus(), ytdlp, steps: STEPS });
    }
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

    if (req.method === "GET" && parts[3] === "events") {
      const state = running.get(id);
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      for (const e of state?.events ?? []) res.write(`data: ${JSON.stringify(e)}\n\n`);
      if (!state || state.done) return res.end();
      state.listeners.add(res);
      req.on("close", () => state.listeners.delete(res));
      return;
    }
    return json(res, 404, { error: "Not found" });
  } catch (e) {
    return json(res, 500, { error: (e as Error).message });
  }
});

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
