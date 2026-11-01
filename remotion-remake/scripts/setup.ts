// One-time setup: yt-dlp in a local Python venv, sound effects, and the Remotion browser.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ensureSfx } from "../src/pipeline/sfx";
import { browserExecutable, PUBLIC_DIR, ROOT, ytDlp } from "../src/pipeline/tools";

const isWin = process.platform === "win32";
const venv = path.join(ROOT, ".venv");
const venvPython = path.join(venv, isWin ? "Scripts/python.exe" : "bin/python");

function sh(cmd: string, args: string[]) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  return r.status === 0;
}

if (!fs.existsSync(venvPython)) {
  const python = ["python", "python3", "py"].find((p) => spawnSync(p, ["--version"], { stdio: "ignore" }).status === 0);
  if (!python) {
    console.error("Không tìm thấy Python 3.10+. Cài Python từ https://www.python.org/ rồi chạy lại `npm run setup`.");
    process.exit(1);
  }
  if (!sh(python, ["-m", "venv", venv])) process.exit(1);
}
if (!sh(venvPython, ["-m", "pip", "install", "-q", "-U", "yt-dlp[default]"])) process.exit(1);
const y = ytDlp();
console.log(`✔ yt-dlp: ${[y.cmd, ...y.args].join(" ")}`);

ensureSfx(PUBLIC_DIR);
console.log("✔ Hiệu ứng âm thanh: public/sfx/*.wav");

const browser = await browserExecutable();
console.log(`✔ Trình duyệt render: ${browser ?? "mặc định của Remotion"}`);

if (!fs.existsSync(path.join(ROOT, ".env"))) {
  fs.copyFileSync(path.join(ROOT, ".env.example"), path.join(ROOT, ".env"));
  console.log("✔ Đã tạo .env — điền ANTHROPIC_API_KEY để bật phân tích bằng Claude.");
}
console.log("\nXong! Chạy `npm start` rồi mở http://localhost:3210");
