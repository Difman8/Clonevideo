# Remotion Remake

Dán link YouTube → app phân tích video → dựng lại bằng **Remotion** → xuất MP4, kèm **nội dung đăng** của video gốc (tiêu đề, hashtag, mô tả, keywords).

## Cài đặt (một lần)

Cần Node.js 20+ và Python 3.10+.

```bash
npm install
npm run setup
```

`npm run setup` cài `yt-dlp` vào `.venv/`, tạo hiệu ứng âm thanh, tải trình duyệt render của Remotion và tạo file `.env`.

Mở `.env`, điền khóa AI muốn dùng (một hoặc cả hai):

- `ANTHROPIC_API_KEY=...` — phân tích bằng Claude (`claude-opus-5-5`)
- `OPENAI_API_KEY=...` — phân tích bằng OpenAI (`gpt-5.5`)

Để trống cả hai thì app vẫn chạy với **phân tích cơ bản** (dựng từ chapters/phụ đề, màu lấy từ khung hình). Đổi model bằng `CLAUDE_MODEL` / `OPENAI_MODEL`.

## Dùng

**Giao diện web:** bấm đúp **`Khởi động Remotion Remake.bat`** ở thư mục ngoài (lần đầu nó tự cài mọi thứ), hoặc:

```bash
npm start
```

Mở http://localhost:3210, dán link, gạt công tắc **Claude ⟷ OpenAI** để chọn AI, rồi chọn chế độ:

- **Bản sao** — dựng lại giống bản gốc nhất có thể (chữ, thứ tự, thời lượng, màu, chuyển cảnh).
- **Remix** — giữ khuôn, nhịp và phong cách nhưng AI viết nội dung mới, kèm tiêu đề/mô tả/hashtag mới.

Sau khi render, có thể sửa `spec.json` ngay trên trang (chữ, màu, thời lượng, thêm/bớt cảnh) rồi bấm **Lưu & render lại**.

**Dòng lệnh:**

```bash
npm run remake -- "https://www.youtube.com/shorts/XXXXXXXXXXX"
npm run remake -- "<link>" --openai       # phân tích bằng OpenAI thay vì Claude
npm run remake -- "<link>" --remix        # chế độ remix
npm run remake -- "<link>" --basic        # không dùng AI
npm run remake -- "<link>" --no-render    # chỉ phân tích + lấy nội dung đăng
npm run remake -- --rerender <videoId>    # render lại sau khi sửa out/<videoId>/spec.json
```

**Xem/chỉnh template trong Remotion Studio:** `npm run studio`

## Kết quả (`out/<videoId>/`)

| File | Nội dung |
|---|---|
| `remake.mp4` | Video đã dựng lại |
| `post.txt` / `post.json` | Tiêu đề, hashtag, mô tả, keywords (+ keywords gợi ý của AI) |
| `spec.json` | Kịch bản cảnh-theo-cảnh mà Remotion render |
| `analysis.json` | Kết quả thô của bộ phân tích |
| `transcript.txt`, `frames/` | Phụ đề và khung hình đã trích để phân tích |

## Cách hoạt động

1. `yt-dlp` lấy metadata, video ≤720p (chỉ hình) và phụ đề.
2. `ffmpeg` cắt khung hình ở mỗi lần chuyển cảnh + mỗi vài giây (tối đa 60 khung).
3. Claude (`claude-opus-5-5`) hoặc OpenAI (`gpt-5.5`) xem khung hình + phụ đề, trả về `spec.json` theo schema cố định ([src/spec/schema.ts](src/spec/schema.ts)). Hai bên dùng chung prompt trong [src/pipeline/ai-common.ts](src/pipeline/ai-common.ts).
4. Remotion render spec bằng 11 mẫu cảnh trong [src/remotion/scenes.tsx](src/remotion/scenes.tsx).

Mẫu cảnh: `title`, `text` (chữ động), `list-item` (top list), `quiz`, `bar-chart`, `big-number`, `quote`, `timeline`, `countdown`, `comparison`, `outro`. Tất cả vẽ bằng code: không cần ảnh, video, nhạc hay font tự cung cấp (font lấy từ Google Fonts, âm thanh tổng hợp bằng code).

## Giới hạn

- Video có cảnh quay thật, ảnh, khuôn mặt, giọng đọc hoặc nhạc sẽ chỉ được **mô phỏng** bằng chữ + đồ hoạ; phần ghi chú phân tích liệt kê những chỗ này.
- Đăng lại nguyên nội dung kênh khác có thể vi phạm bản quyền và chính sách "nội dung dùng lại" của YouTube; chế độ **Remix** tạo nội dung mới trên cùng khuôn.
- Remotion miễn phí cho cá nhân và công ty ≤3 người; công ty lớn hơn cần mua license (remotion.dev/license).
