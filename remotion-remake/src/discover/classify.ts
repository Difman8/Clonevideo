// Shorts detection, topic labels and hashtags (no AI).

/** Shorts can be up to 3 minutes long; anything longer is a regular video. */
export const SHORTS_MAX_SEC = 180;

/** Runs `fn` over `items` with at most `limit` calls in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * The API has no "is Short" flag. youtube.com/shorts/<id> answers 200 for a
 * Short and redirects to /watch for a regular video, so that page is the
 * reliable test. Returns null when YouTube could not be asked.
 */
export async function isShortsPage(id: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${id}`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      // Skips the EU cookie-consent redirect.
      headers: { Cookie: "CONSENT=YES+cb; SOCS=CAI", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (res.status === 200) return true;
    if (res.status >= 300 && res.status < 400) return /\/watch\b/.test(res.headers.get("location") ?? "") ? false : null;
    return null;
  } catch {
    return null;
  }
}

/** Fallback when the Shorts page could not be checked. */
export const guessShorts = (durationSec: number, text: string) => durationSec <= 60 || /#shorts?(?![\p{L}\p{N}_])/iu.test(text);

const TOPICS: Record<string, string> = {
  Music: "Âm nhạc",
  Pop_music: "Nhạc pop",
  Hip_hop_music: "Hip hop",
  Electronic_music: "Nhạc điện tử",
  Rock_music: "Nhạc rock",
  Classical_music: "Nhạc cổ điển",
  Country_music: "Nhạc đồng quê",
  Jazz: "Jazz",
  Reggae: "Reggae",
  Rhythm_and_blues: "R&B",
  Soul_music: "Nhạc soul",
  Independent_music: "Nhạc indie",
  Christian_music: "Nhạc Cơ đốc",
  Music_of_Asia: "Nhạc châu Á",
  Music_of_Latin_America: "Nhạc Latin",
  Video_game_culture: "Trò chơi điện tử",
  Action_game: "Game hành động",
  "Action-adventure_game": "Game hành động phiêu lưu",
  Casual_game: "Game giải trí",
  Music_video_game: "Game âm nhạc",
  Puzzle_video_game: "Game giải đố",
  Racing_video_game: "Game đua xe",
  "Role-playing_video_game": "Game nhập vai",
  Simulation_video_game: "Game mô phỏng",
  Sports_game: "Game thể thao",
  Strategy_video_game: "Game chiến thuật",
  Sport: "Thể thao",
  Association_football: "Bóng đá",
  American_football: "Bóng bầu dục Mỹ",
  Baseball: "Bóng chày",
  Basketball: "Bóng rổ",
  Boxing: "Quyền anh",
  Cricket: "Cricket",
  Golf: "Golf",
  Ice_hockey: "Khúc côn cầu",
  Mixed_martial_arts: "Võ tổng hợp (MMA)",
  Motorsport: "Đua xe",
  Professional_wrestling: "Đấu vật",
  Tennis: "Quần vợt",
  Volleyball: "Bóng chuyền",
  Entertainment: "Giải trí",
  Humour: "Hài hước",
  Film: "Phim",
  Performing_arts: "Nghệ thuật biểu diễn",
  Television_program: "Chương trình TV",
  "Lifestyle_(sociology)": "Phong cách sống",
  Fashion: "Thời trang",
  Physical_fitness: "Thể hình",
  Food: "Ẩm thực",
  Hobby: "Sở thích",
  Pet: "Thú cưng",
  Physical_attractiveness: "Làm đẹp",
  Technology: "Công nghệ",
  Tourism: "Du lịch",
  Vehicle: "Xe cộ",
  Health: "Sức khoẻ",
  Society: "Xã hội",
  Business: "Kinh doanh",
  Military: "Quân sự",
  Politics: "Chính trị",
  Religion: "Tôn giáo",
  Knowledge: "Kiến thức",
};

/** topicDetails.topicCategories are Wikipedia URLs; this returns readable Vietnamese labels. */
export function topicLabels(urls: string[] = []): string[] {
  return [
    ...new Set(
      urls.map((u) => {
        const slug = decodeURIComponent(u.split("/wiki/")[1] ?? u);
        return TOPICS[slug] ?? slug.replace(/_\(.*\)$/, "").replace(/_/g, " ");
      }),
    ),
  ];
}

const HASHTAG = /#[\p{L}\p{N}_]+/gu;

/** Hashtags from title and description, first spelling kept, case-insensitive dedupe. */
export function extractHashtags(...texts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of texts)
    for (const h of t.match(HASHTAG) ?? []) {
      if (/^#\d+$/.test(h)) continue; // "#1", "#2" are rankings, not hashtags
      const k = h.toLocaleLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(h);
    }
  return out;
}
