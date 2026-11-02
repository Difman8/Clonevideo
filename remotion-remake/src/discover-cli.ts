import "./env";
import path from "node:path";
import { DISCOVER_DIR, DISCOVER_STEPS, runDiscover, type DiscoverEvent } from "./discover/discover";
import { COUNTRIES, PERIODS, STYLE_LABEL } from "./discover/options";

const args = process.argv.slice(2);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Tìm video YouTube có nhiều tương tác nhất (cần YOUTUBE_API_KEY trong .env).

  npm run discover -- [tuỳ chọn]

  --format shorts|long|all          Shorts, video dài hoặc cả hai (mặc định shorts)
  --style all|live|animation        Người thật cảnh thật hoặc animation (mặc định all)
  --country VN                      Mã quốc gia, "" = toàn cầu (mặc định VN)
  --strict-country                  Chỉ giữ kênh khai báo quốc gia đó
  --period ${PERIODS.map((p) => p.id).join("|")}       Khoảng thời gian (mặc định 7d)
  --from 2026-10-01 --to 2026-10-31 Khoảng thời gian tuỳ chọn
  --sort engagement|views|likes|comments|rate
  --q "từ khoá"                     Từ khoá tìm kiếm (tuỳ chọn)
  --category 24                     Mã danh mục YouTube (tuỳ chọn)
  --limit 20                        Số video trả về (1–50)
  --pages 2                         Độ sâu tìm kiếm, mỗi trang 50 video = 100 quota (1–5)
  --ai claude|openai|none           AI phân tích chủ đề, keyword, hình ảnh (mặc định claude)

Quốc gia: ${COUNTRIES.filter((c) => c.code)
    .map((c) => c.code)
    .join(", ")}`);
  process.exit(0);
}

const from = value("--from");
const options = {
  format: value("--format"),
  style: value("--style"),
  country: value("--country"),
  strictCountry: args.includes("--strict-country"),
  period: from ? "custom" : value("--period"),
  from,
  to: value("--to"),
  sort: value("--sort"),
  query: value("--q"),
  category: value("--category"),
  limit: value("--limit"),
  pages: value("--pages"),
  ai: value("--ai"),
};

const label = (id: string) => DISCOVER_STEPS.find((s) => s.id === id)?.label ?? id;
const print = (e: DiscoverEvent) => {
  if (e.type === "step" && e.status !== "start") console.log(`${e.status === "done" ? "✔" : "–"} ${label(e.step)}${e.message ? `: ${e.message}` : ""}`);
  else if (e.type === "log") console.log(`   ${e.message}`);
};
const fmt = (n: number | null) => (n === null ? "ẩn" : n.toLocaleString("vi-VN"));

try {
  const r = await runDiscover(options, print);
  console.log(`\n${r.label} · AI: ${r.ai}\n`);
  for (const v of r.videos) {
    console.log(`#${v.rank} ${v.title}`);
    console.log(`   ${v.url}`);
    console.log(`   ${v.format === "shorts" ? "Shorts" : "Video dài"} · ${STYLE_LABEL[v.style]}${v.styleSource === "guess" ? " (đoán)" : ""} · ${v.channel}`);
    console.log(`   👁 ${fmt(v.views)} · 👍 ${fmt(v.likes)} · 💬 ${fmt(v.comments)} · tương tác ${v.engagementRate}% · điểm ${v.score}`);
    console.log(`   Chủ đề: ${v.topic || "?"}`);
    console.log(`   Keywords: ${[...v.keywords, ...v.suggestedKeywords].join(", ") || "(không có)"}`);
    console.log(`   Hashtag: ${v.hashtags.join(" ") || "(không có)"}\n`);
  }
  for (const n of r.notes) console.log(`! ${n}`);
  console.log(`\nĐã lưu: ${path.join(DISCOVER_DIR, `${r.id}.csv`)} (và .json) · quota đã dùng: ${r.stats.quotaUsed}`);
} catch (e) {
  console.error(`\n✖ ${(e as Error).message}`);
  process.exit(1);
}
