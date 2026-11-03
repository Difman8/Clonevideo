import "./env";
import path from "node:path";
import { DISCOVER_DIR, DISCOVER_STEPS, runDiscover, type DiscoverEvent } from "./discover/discover";
import { languageName } from "./discover/language";
import { COUNTRIES, PERIODS } from "./discover/options";

const args = process.argv.slice(2);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Tìm video YouTube có nhiều tương tác nhất (cần YOUTUBE_API_KEY trong .env, không dùng AI).

  npm run discover -- [tuỳ chọn]

  --format shorts|long|all          Shorts, video dài hoặc cả hai (mặc định shorts)
  --country VN                      Mã quốc gia, "all" = toàn cầu (mặc định VN). Lọc theo
                                    ngôn ngữ của tiêu đề / mô tả video
  --period ${PERIODS.map((p) => p.id).join("|")}       Khoảng thời gian (mặc định 7d)
  --from 2026-10-01 --to 2026-10-31 Khoảng thời gian tuỳ chọn
  --sort engagement|views|likes|comments|rate
  --q "từ khoá"                     Từ khoá tìm kiếm (tuỳ chọn)
  --category 24                     Mã danh mục YouTube (tuỳ chọn)
  --limit 20                        Số video trả về (1–50)
  --pages 2                         Độ sâu tìm kiếm, mỗi trang 50 video = 100 quota (1–5)

Quốc gia: ${COUNTRIES.filter((c) => c.code)
    .map((c) => c.code)
    .join(", ")}`);
  process.exit(0);
}

const from = value("--from");
const country = value("--country");
const options = {
  format: value("--format"),
  country: country && /^(all|global)$/i.test(country) ? "" : country,
  period: from ? "custom" : value("--period"),
  from,
  to: value("--to"),
  sort: value("--sort"),
  query: value("--q"),
  category: value("--category"),
  limit: value("--limit"),
  pages: value("--pages"),
};

const label = (id: string) => DISCOVER_STEPS.find((s) => s.id === id)?.label ?? id;
const print = (e: DiscoverEvent) => {
  if (e.type === "step" && e.status !== "start") console.log(`${e.status === "done" ? "✔" : "–"} ${label(e.step)}${e.message ? `: ${e.message}` : ""}`);
  else if (e.type === "log") console.log(`   ${e.message}`);
};
const fmt = (n: number | null) => (n === null ? "ẩn" : n.toLocaleString("vi-VN"));

try {
  const r = await runDiscover(options, print);
  console.log(`\n${r.label}\n`);
  for (const v of r.videos) {
    console.log(`#${v.rank} ${v.title}`);
    console.log(`   ${v.url}`);
    console.log(`   ${v.format === "shorts" ? "Shorts" : "Video dài"} · ${v.language ? languageName(v.language) : "?"} · ${v.channel}`);
    console.log(`   👁 ${fmt(v.views)} · 👍 ${fmt(v.likes)} · 💬 ${fmt(v.comments)} · tương tác ${v.engagementRate}% · điểm ${v.score}`);
    console.log(`   Chủ đề: ${v.topic || "?"}`);
    console.log(`   Keywords: ${v.keywords.join(", ") || "(không có)"}`);
    console.log(`   Hashtag: ${v.hashtags.join(" ") || "(không có)"}\n`);
  }
  for (const n of r.notes) console.log(`! ${n}`);
  console.log(`\nĐã lưu: ${path.join(DISCOVER_DIR, `${r.id}.csv`)} (và .json) · quota đã dùng: ${r.stats.quotaUsed}`);
} catch (e) {
  console.error(`\n✖ ${(e as Error).message}`);
  process.exit(1);
}
