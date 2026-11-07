// The post published with a video. The AI writes it together with the storyboard;
// the channel's format is applied here so it always holds and needs no extra AI call.
import type { AiOutput } from "./ai-common";
import { LIMITS } from "./post-writer";

const TITLE_HASHTAG = "#shorts";
const DESCRIPTION_HASHTAGS = "#Fedtoon #shorts #science";
const HASHTAG = /#[\p{L}\p{N}_]+/gu;

export type OfficialPost = { title: string; keywords: string; description: string };

/** The title without hashtags, shortened at a word so "#shorts" fits YouTube's limit, then "#shorts". */
function formatTitle(title: string) {
  const text = title.replace(HASHTAG, " ").replace(/\s+/g, " ").trim();
  const room = LIMITS.title - TITLE_HASHTAG.length - 1;
  const fitted = text.length <= room ? text : text.slice(0, room).replace(/\s+\S*$/, "");
  return `${fitted} ${TITLE_HASHTAG}`.trim();
}

/** The AI's hashtags as comma-separated keywords, without "#" or repeats, within YouTube's tag limit. */
function formatKeywords(hashtags: string[]) {
  const seen = new Set<string>();
  let keywords = "";
  for (const raw of hashtags) {
    const word = raw.trim().replace(/^#+/, "").trim();
    const key = word.toLowerCase();
    if (!word || seen.has(key)) continue;
    seen.add(key);
    const next = keywords ? `${keywords}, ${word}` : word;
    if (next.length > LIMITS.tags) break;
    keywords = next;
  }
  return keywords;
}

/** The AI's text without lines of hashtags, then the channel's hashtags as the last line. */
function formatDescription(description: string) {
  const text = description
    .split("\n")
    .filter((line) => !line.trim() || line.replace(HASHTAG, "").trim())
    .join("\n")
    .trim();
  return `${text}\n\n${DESCRIPTION_HASHTAGS}`.trim();
}

export function officialPost(ai: AiOutput["remixPost"]): OfficialPost {
  return { title: formatTitle(ai.title), keywords: formatKeywords(ai.hashtags), description: formatDescription(ai.description) };
}
