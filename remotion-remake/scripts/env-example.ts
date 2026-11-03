// Regenerates .env.example from src/settings.ts: npm run env-example
import fs from "node:fs";
import path from "node:path";
import { SETTING_GROUPS, SETTINGS } from "../src/settings";
import { ROOT } from "../src/pipeline/tools";
const out: string[] = [
  "# Cấu hình Remotion Remake. Có thể sửa mọi mục ngay trên giao diện: tab ⚙️ Cài đặt.",
  "# Dòng bắt đầu bằng # là chú thích; bỏ # để đặt giá trị khác mặc định.",
  "# Để trống cả ANTHROPIC_API_KEY và OPENAI_API_KEY thì app dùng phân tích cơ bản (không AI).",
];
for (const g of SETTING_GROUPS) {
  const items = SETTINGS.filter((s) => s.group === g.id);
  if (!items.length) continue;
  out.push("", `# ===== ${g.title} =====${g.link ? ` (${g.link})` : ""}`);
  if (g.help) out.push(`# ${g.help}`);
  for (const s of items) {
    const choices = s.type === "select" ? ` Chọn: ${s.options!.map((o) => o.value).join(" | ")}.` : s.options?.length ? ` Ví dụ: ${s.options.map((o) => o.value).join(", ")}.` : "";
    const range = s.type === "number" && s.min !== undefined && !s.help.includes(`${s.min}–`) ? ` Khoảng ${s.min}–${s.max}.` : "";
    out.push(`# ${[`${s.label}.`, s.help, range.trim(), choices.trim()].filter(Boolean).join(" ")}`);
    out.push(s.type === "secret" || s.key === "ELEVENLABS_VOICE_ID" ? `${s.key}=` : `# ${s.key}=${s.default}`);
  }
}
fs.writeFileSync(path.join(ROOT, ".env.example"), `${out.join("\n")}\n`);
console.log("Đã cập nhật .env.example");
