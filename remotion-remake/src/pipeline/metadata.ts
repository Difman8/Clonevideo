import type { YtInfo } from "./youtube";
import { sourceUrl } from "./youtube";

export type PostContent = {
  title: string;
  description: string;
  hashtags: string[];
  keywords: string[];
  /** Filled by the AI analyzer when the source declares no keywords (or always, as extra ideas). */
  suggestedKeywords: string[];
  channel: string;
  handle: string;
  url: string;
  thumbnail: string;
  durationSec: number;
  uploadDate: string;
  views: number | null;
  likes: number | null;
  categories: string[];
  language: string;
};

const HASHTAG = /#[\p{L}\p{N}_]+/gu;

function uniqueCaseless(list: string[]) {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.toLocaleLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function extractPostContent(info: YtInfo): PostContent {
  const description = info.description ?? "";
  const date = info.upload_date ?? "";
  return {
    title: info.title,
    description,
    hashtags: uniqueCaseless([...(info.title.match(HASHTAG) ?? []), ...(description.match(HASHTAG) ?? [])]),
    keywords: uniqueCaseless(info.tags ?? []),
    suggestedKeywords: [],
    channel: info.channel || info.uploader || "",
    handle: info.uploader_id?.startsWith("@") ? info.uploader_id : "",
    url: sourceUrl(info),
    thumbnail: info.thumbnail ?? "",
    durationSec: info.duration ?? 0,
    uploadDate: date.length === 8 ? `${date.slice(6)}/${date.slice(4, 6)}/${date.slice(0, 4)}` : date,
    views: info.view_count ?? null,
    likes: info.like_count ?? null,
    categories: info.categories ?? [],
    language: info.language ?? "",
  };
}

/** Plain-text version ready to paste into YouTube Studio. */
export function postContentText(p: PostContent): string {
  const lines = [
    `TIÊU ĐỀ:`,
    p.title,
    ``,
    `HASHTAG (${p.hashtags.length}):`,
    p.hashtags.join(" ") || "(video không có hashtag)",
    ``,
    `MÔ TẢ:`,
    p.description || "(trống)",
    ``,
    `KEYWORDS / TAGS (${p.keywords.length}):`,
    p.keywords.join(", ") || "(video không khai báo keywords)",
  ];
  if (p.suggestedKeywords.length) lines.push(``, `KEYWORDS GỢI Ý (AI):`, p.suggestedKeywords.join(", "));
  lines.push(``, `---`, `Nguồn: ${p.url}`, `Kênh: ${p.channel} ${p.handle}`.trim(), `Ngày đăng: ${p.uploadDate}`, `Danh mục: ${p.categories.join(", ")}`);
  return lines.join("\n");
}
