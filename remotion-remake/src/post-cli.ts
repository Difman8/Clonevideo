import "./env";
import path from "node:path";
import { parseProvider } from "./pipeline/ai";
import { composedPostText, composePost, loadPostSource, saveComposedPost } from "./pipeline/post-writer";
import { OUT_DIR } from "./pipeline/tools";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));

if (!target) {
  console.log(`Soạn thông tin đăng YouTube bằng AI từ một video gốc:
tiêu đề và mô tả giống khoảng 80–90%, giữ 100% hashtag và keywords.

  npm run post -- <link YouTube> [--openai]`);
  process.exit(1);
}

try {
  const source = await loadPostSource(target);
  console.log(`Video gốc: ${source.title}\nHashtag: ${source.hashtags.length} · Keywords: ${source.keywords.length}`);
  const post = await composePost(source, parseProvider(args.includes("--openai") ? "openai" : "claude"), (m) => console.log(`   ${m}`));
  saveComposedPost(post);
  console.log(`\n${composedPostText(post)}\n`);
  console.log(`Đã lưu: ${path.join(OUT_DIR, post.videoId, "new-post.txt")}`);
} catch (e) {
  console.error(`\n✖ ${(e as Error).message}`);
  process.exit(1);
}
