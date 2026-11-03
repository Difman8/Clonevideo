import "./env";
import path from "node:path";
import { parseProvider } from "./pipeline/ai";
import { composedPostText, composePost, loadPostSource, parseWriterOptions, saveComposedPost } from "./pipeline/post-writer";
import { OUT_DIR } from "./pipeline/tools";

const args = process.argv.slice(2);
const channelIndex = args.indexOf("--channel");
const channel = channelIndex >= 0 ? args[channelIndex + 1] : undefined;
const target = args.find((a, i) => !a.startsWith("--") && (channelIndex < 0 || i !== channelIndex + 1));

if (!target) {
  console.log(`Soạn thông tin đăng YouTube bằng AI từ một video gốc:
tiêu đề và mô tả giống khoảng 80–90% (khác đi nhờ tên kênh của bạn và thông tin
trong mô tả), giữ 100% hashtag và keywords, thêm #<tên kênh> vào hashtag và keywords.

  npm run post -- <link YouTube> [--openai] [--channel "Fedtoon"] [--no-brand-tags]

  --channel        Tên kênh của bạn (mặc định CHANNEL_NAME trong .env, hoặc Fedtoon)
  --no-brand-tags  Không thêm #<tên kênh> vào hashtag và keywords`);
  process.exit(1);
}

try {
  const source = await loadPostSource(target);
  console.log(`Video gốc: ${source.title}\nHashtag: ${source.hashtags.length} · Keywords: ${source.keywords.length}`);
  const options = parseWriterOptions({ channel, brandTags: !args.includes("--no-brand-tags") });
  const post = await composePost(source, parseProvider(args.includes("--openai") ? "openai" : "claude"), options, (m) => console.log(`   ${m}`));
  saveComposedPost(post);
  console.log(`\n${composedPostText(post)}\n`);
  console.log(`Đã lưu: ${path.join(OUT_DIR, post.videoId, "new-post.txt")}`);
} catch (e) {
  console.error(`\n✖ ${(e as Error).message}`);
  process.exit(1);
}
