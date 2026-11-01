export type Cue = { start: number; end: number; text: string };

const toSec = (ts: string) => {
  const parts = ts.trim().split(":").map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
};

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Parses WebVTT. YouTube auto-captions repeat the previous line in every cue
 * (rolling captions), so a line is kept only the first time it appears.
 */
export function parseVtt(src: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = src.replace(/\r/g, "").split(/\n\n+/);
  let last = "";
  for (const block of blocks) {
    const lines = block.split("\n");
    const timing = lines.findIndex((l) => l.includes("-->"));
    if (timing < 0) continue;
    const [a, b] = lines[timing].split("-->");
    const start = toSec(a);
    const end = toSec(b.trim().split(/\s+/)[0]);
    for (const raw of lines.slice(timing + 1)) {
      const text = clean(raw);
      if (!text || text === last) continue;
      last = text;
      cues.push({ start, end, text });
    }
  }
  // Rolling captions end when the next line starts.
  for (let i = 0; i < cues.length - 1; i++) cues[i].end = Math.max(cues[i].start + 0.3, Math.min(cues[i].end, cues[i + 1].start));
  return cues;
}

export const transcriptText = (cues: Cue[]) => cues.map((c) => `[${c.start.toFixed(1)}s] ${c.text}`).join("\n");
