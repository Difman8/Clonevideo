// Adds one entry to the top of CHANGELOG.md, grouped under today's date (Vietnam time).
// Input (env): CL_TITLE, CL_AUTHOR, CL_LINK (optional markdown), CL_COMMITS (one subject per line).
import fs from "node:fs";

const FILE = "CHANGELOG.md";
const HEADER = "# Nhật ký thay đổi\n\nGitHub Actions tự ghi mục này mỗi khi có thay đổi được gộp vào `main` (mới nhất ở trên).\n";
const TZ = "Asia/Ho_Chi_Minh";

const now = new Date();
const day = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);

const title = (process.env.CL_TITLE || "Cập nhật").trim();
const commits = [
  ...new Set(
    (process.env.CL_COMMITS || "")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && s !== title && !s.includes("[skip changelog]")),
  ),
];
const meta = [process.env.CL_AUTHOR && `@${process.env.CL_AUTHOR}`, time, process.env.CL_LINK].filter(Boolean).join(" · ");
const entry = [`- **${title}** — ${meta}`, ...commits.map((c) => `  - ${c}`)].join("\n");

let text = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n") : HEADER;
const heading = `## ${day}`;
const first = text.search(/^## /m);
if (first >= 0 && text.startsWith(`${heading}\n`, first)) {
  const after = first + heading.length + 1;
  text = `${text.slice(0, after)}\n${entry}\n${text.slice(after).replace(/^\n/, "")}`;
} else {
  const block = `${heading}\n\n${entry}\n\n`;
  text = first >= 0 ? text.slice(0, first) + block + text.slice(first) : `${text.trimEnd()}\n\n${block}`;
}
fs.writeFileSync(FILE, `${text.trimEnd()}\n`);
console.log(`CHANGELOG: ${title}`);
