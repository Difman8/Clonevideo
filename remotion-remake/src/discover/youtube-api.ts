// Minimal client for the free YouTube Data API v3 (API key, 10,000 quota units per day).

const API = "https://www.googleapis.com/youtube/v3";

export const KEY_HELP_URL = "https://console.cloud.google.com/apis/library/youtube.googleapis.com";

export const youtubeKey = () => process.env.YOUTUBE_API_KEY?.trim() ?? "";
export const hasYoutubeKey = () => !!youtubeKey();

export type ApiVideo = {
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
    tags?: string[];
    categoryId: string;
    liveBroadcastContent: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    thumbnails: Partial<Record<"default" | "medium" | "high" | "standard" | "maxres", { url: string; width?: number; height?: number }>>;
  };
  contentDetails: { duration: string };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
  topicDetails?: { topicCategories?: string[] };
};

export type ApiChannel = {
  id: string;
  snippet: { title: string; customUrl?: string; thumbnails: Partial<Record<"default" | "medium" | "high", { url: string }>> };
  contentDetails: { relatedPlaylists: { uploads: string } };
  statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
};

/** Finds a channel: exactly one of these. */
export type ChannelLookup = { id: string } | { forHandle: string } | { forUsername: string };

export type SearchParams = {
  publishedAfter: Date;
  publishedBefore: Date;
  regionCode?: string;
  relevanceLanguage?: string;
  q?: string;
  videoCategoryId?: string;
  videoDuration: "any" | "short" | "medium" | "long";
  pageToken?: string;
};

export class YoutubeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type ApiErrorBody = { error?: { code?: number; message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } };

/** Turns the API's error payload into a message the user can act on. */
function explainError(status: number, body: ApiErrorBody): string {
  const err = body.error ?? {};
  const reasons = [...(err.errors ?? []).map((e) => e.reason), ...(err.details ?? []).map((d) => d.reason)].filter(Boolean) as string[];
  const has = (...r: string[]) => reasons.some((x) => r.includes(x));
  if (has("quotaExceeded", "dailyLimitExceeded", "RATE_LIMIT_EXCEEDED"))
    return "Đã dùng hết quota miễn phí hôm nay của YouTube API (10.000 đơn vị/ngày). Quota được làm mới lúc 0h giờ Thái Bình Dương (khoảng 14–15h giờ Việt Nam).";
  if (has("API_KEY_INVALID", "keyInvalid")) return "YOUTUBE_API_KEY không hợp lệ. Kiểm tra lại khóa đã dán.";
  if (has("SERVICE_DISABLED", "accessNotConfigured"))
    return `Dự án Google Cloud của khóa này chưa bật YouTube Data API v3. Mở ${KEY_HELP_URL}, chọn đúng dự án rồi bấm "Enable".`;
  if (has("API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED", "forbidden", "ipRefererBlocked"))
    return "Khóa API đang bị giới hạn (theo website/IP hoặc theo API) nên không gọi được YouTube Data API. Sửa phần \"API restrictions\" của khóa trong Google Cloud.";
  return `YouTube API báo lỗi ${status}: ${err.message ?? "không rõ lý do"}`;
}

export class YoutubeApi {
  /** Quota units spent by this client (search = 100, list calls = 1). */
  quotaUsed = 0;

  constructor(private readonly key = youtubeKey()) {
    if (!key) throw new Error("Chưa có YOUTUBE_API_KEY. Dán khóa YouTube Data API v3 trong tab \"Tìm video hot\" hoặc thêm vào file .env.");
  }

  private async get<T>(endpoint: string, params: Record<string, string | undefined>, cost: number): Promise<T> {
    const url = new URL(`${API}/${endpoint}`);
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
    url.searchParams.set("key", this.key);
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { Accept: "application/json" } });
    } catch (e) {
      throw new Error(`Không kết nối được tới YouTube API: ${(e as Error).message}`);
    }
    this.quotaUsed += cost;
    const body = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
    if (!res.ok) throw new YoutubeApiError(explainError(res.status, body), res.status);
    return body;
  }

  /** One page (up to 50) of video ids, most viewed first. Costs 100 units. */
  async search(p: SearchParams): Promise<{ ids: string[]; nextPageToken?: string }> {
    const body = await this.get<{ nextPageToken?: string; items?: { id?: { videoId?: string } }[] }>(
      "search",
      {
        part: "id",
        type: "video",
        order: "viewCount",
        maxResults: "50",
        fields: "nextPageToken,items/id/videoId",
        publishedAfter: p.publishedAfter.toISOString(),
        publishedBefore: p.publishedBefore.toISOString(),
        regionCode: p.regionCode,
        relevanceLanguage: p.relevanceLanguage,
        q: p.q,
        videoCategoryId: p.videoCategoryId,
        videoDuration: p.videoDuration,
        pageToken: p.pageToken,
      },
      100,
    );
    return { ids: (body.items ?? []).map((i) => i.id?.videoId).filter((x): x is string => !!x), nextPageToken: body.nextPageToken };
  }

  /** Full details and statistics, 50 videos per call (1 unit each). */
  async videos(ids: string[]): Promise<ApiVideo[]> {
    const out: ApiVideo[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const body = await this.get<{ items?: ApiVideo[] }>(
        "videos",
        { part: "snippet,statistics,contentDetails,topicDetails", id: ids.slice(i, i + 50).join(","), maxResults: "50" },
        1,
      );
      out.push(...(body.items ?? []));
    }
    return out;
  }

  /** A channel, or null when it does not exist (1 unit). */
  async channel(lookup: ChannelLookup): Promise<ApiChannel | null> {
    const body = await this.get<{ items?: ApiChannel[] }>("channels", { part: "snippet,contentDetails,statistics", ...lookup }, 1);
    return body.items?.[0] ?? null;
  }

  /** One page (up to 50) of a playlist (e.g. a channel's uploads), newest first, and how many videos it holds (1 unit). */
  async uploads(playlistId: string, pageToken?: string): Promise<{ items: { id: string; publishedAt: string }[]; nextPageToken?: string; total?: number }> {
    try {
      const body = await this.get<{ nextPageToken?: string; pageInfo?: { totalResults?: number }; items?: { contentDetails: { videoId: string; videoPublishedAt?: string } }[] }>(
        "playlistItems",
        { part: "contentDetails", playlistId, maxResults: "50", pageToken },
        1,
      );
      return {
        items: (body.items ?? []).map((i) => ({ id: i.contentDetails.videoId, publishedAt: i.contentDetails.videoPublishedAt ?? "" })),
        nextPageToken: body.nextPageToken,
        total: body.pageInfo?.totalResults,
      };
    } catch (e) {
      // A channel that never uploaded has no playlist.
      if (e instanceof YoutubeApiError && e.status === 404) return { items: [] };
      throw e;
    }
  }

  /** Cheapest call (1 unit): used to check a key before saving it. */
  async ping(): Promise<void> {
    await this.get("videoCategories", { part: "id", regionCode: "US" }, 1);
  }
}

/** ISO 8601 duration ("PT1H2M3S", "P1DT2H") to seconds. */
export function parseDuration(iso: string): number {
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}
