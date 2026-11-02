import "./env";
import path from "node:path";
import { rerenderJob, runJob, STEPS, type JobEvent } from "./pipeline/job";
import { ROOT } from "./pipeline/tools";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const target = args.find((a) => !a.startsWith("--"));

if (!target) {
  console.log(`Cách dùng:
  npm run remake -- <link YouTube> [--openai] [--remix] [--basic] [--no-render]
  npm run remake -- --rerender <videoId>     (render lại từ out/<videoId>/spec.json)`);
  process.exit(1);
}

const label = (id: string) => STEPS.find((s) => s.id === id)?.label ?? id;
let lastPct = -10;
const print = (e: JobEvent) => {
  if (e.type === "step") {
    const icon = { start: "▶", done: "✔", skip: "–" }[e.status];
    console.log(`${icon} ${label(e.step)}${e.message ? `: ${e.message}` : ""}`);
    lastPct = -10;
  } else if (e.type === "progress") {
    const pct = Math.round(e.progress * 100);
    if (pct - lastPct >= 10 || pct === 100) {
      lastPct = pct;
      console.log(`   ${pct}%`);
    }
  } else if (e.type === "log") console.log(`   ${e.message}`);
};

try {
  const result = flag("--rerender")
    ? await rerenderJob(target, null, print)
    : await runJob(
        { url: target, mode: flag("--remix") ? "remix" : "clone", analyzer: flag("--basic") ? "basic" : "auto", provider: flag("--openai") ? "openai" : "claude", render: !flag("--no-render") },
        print,
      );
  const dir = path.join(ROOT, "out", result.id);
  console.log(`\nXong! Thư mục: ${dir}`);
  console.log(`  • Nội dung đăng: ${path.join(dir, "post.txt")}`);
  console.log(`  • Kịch bản:      ${path.join(dir, "spec.json")}`);
  if (result.video) console.log(`  • Video:         ${result.video}`);
  for (const n of result.notes) console.log(`  ! ${n}`);
} catch (e) {
  console.error(`\n✖ ${(e as Error).message}`);
  process.exit(1);
}
