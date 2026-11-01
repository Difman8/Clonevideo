import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static";
import { ensureBrowser } from "@remotion/renderer";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const OUT_DIR = path.join(ROOT, "out");
export const PUBLIC_DIR = path.join(ROOT, "public");

const isWin = process.platform === "win32";

export function ffmpegPath(): string {
  const p = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string | null);
  if (!p || !fs.existsSync(p)) throw new Error("Không tìm thấy ffmpeg. Chạy lại `npm install` hoặc đặt biến FFMPEG_PATH.");
  return p;
}

export type Command = { cmd: string; args: string[] };

// The venv is called through `python -m yt_dlp` rather than its yt-dlp.exe
// launcher, which hard-codes the folder it was installed in and breaks when
// the project is moved.
export function ytDlp(): Command {
  const candidates: Command[] = [
    ...(process.env.YTDLP_PATH ? [{ cmd: process.env.YTDLP_PATH, args: [] }] : []),
    { cmd: path.join(ROOT, ".venv", isWin ? "Scripts/python.exe" : "bin/python"), args: ["-m", "yt_dlp"] },
    { cmd: "yt-dlp", args: [] },
  ];
  for (const c of candidates) {
    if (c.cmd !== "yt-dlp" && !fs.existsSync(c.cmd)) continue;
    if (spawnSync(c.cmd, [...c.args, "--version"], { stdio: "ignore" }).status === 0) return c;
  }
  throw new Error("Chưa cài yt-dlp. Chạy `npm run setup` (cần Python 3.10+) hoặc đặt biến YTDLP_PATH.");
}

export type RunResult = { stdout: string; stderr: string };

export function run(cmd: string, args: string[], opts: { onLine?: (line: string) => void } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, PYTHONWARNINGS: "ignore", PYTHONIOENCODING: "utf-8" } });
    let stdout = "";
    let stderr = "";
    const partial = { out: "", err: "" };
    const feed = (which: "out" | "err", s: string) => {
      if (!opts.onLine) return;
      const lines = (partial[which] + s).split(/\r?\n|\r/);
      partial[which] = lines.pop() ?? "";
      lines.filter(Boolean).forEach(opts.onLine);
    };
    child.stdout.on("data", (d) => {
      const s = d.toString("utf8");
      stdout += s;
      feed("out", s);
    });
    child.stderr.on("data", (d) => {
      const s = d.toString("utf8");
      stderr += s;
      feed("err", s);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(cmd)} thoát với mã ${code}:\n${stderr.trim().split("\n").slice(-8).join("\n")}`));
    });
  });
}

/**
 * Windows cannot start an .exe whose path is longer than 260 characters, which
 * happens when the project lives in a deep folder. In that case the Chrome
 * Headless Shell that Remotion downloads is copied once to a short path.
 */
export async function browserExecutable(): Promise<string | null> {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return process.env.REMOTION_BROWSER_EXECUTABLE;
  await ensureBrowser();
  if (!isWin) return null;
  const base = path.join(ROOT, "node_modules/.remotion/chrome-headless-shell");
  const src = path.join(base, "win64/chrome-headless-shell-win64");
  const exe = path.join(src, "chrome-headless-shell.exe");
  if (exe.length < 240 || !fs.existsSync(exe)) return null;
  const version = fs.readFileSync(path.join(base, "VERSION"), "utf8").trim();
  const dst = path.join(os.homedir(), ".remotion-remake", "chrome");
  const marker = path.join(dst, "VERSION");
  if (!fs.existsSync(marker) || fs.readFileSync(marker, "utf8").trim() !== version) {
    fs.rmSync(dst, { recursive: true, force: true });
    fs.cpSync(src, dst, { recursive: true });
    fs.writeFileSync(marker, version);
  }
  return path.join(dst, "chrome-headless-shell.exe");
}
