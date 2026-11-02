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

## Tìm video hot

Tab **🔥 Tìm video hot** dùng [YouTube Data API v3](https://developers.google.com/youtube/v3) (miễn phí) để tìm video có nhiều lượt xem, lượt thích và bình luận nhất trong một khoảng thời gian. Mỗi video trả về kèm **link, chủ đề, keywords và hashtag**, lượt xem/thích/bình luận, tỉ lệ tương tác, và nút **🎬 Dựng lại video này** để chuyển sang tab dựng lại.

**Lấy khóa (một lần, miễn phí):** mở [YouTube Data API v3 trong Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com), tạo/chọn dự án, bấm **Enable**, rồi vào **APIs & Services → Credentials → Create credentials → API key**. Dán khóa ngay trên tab (app kiểm tra rồi lưu vào `.env`), hoặc tự thêm dòng `YOUTUBE_API_KEY=...` vào `.env`.

Bộ lọc:

| Bộ lọc | Cách hoạt động |
|---|---|
| Định dạng: Shorts / Video dài / Cả hai | Kiểm tra trang `youtube.com/shorts/<id>` của từng video ≤ 3 phút; nếu không mở được thì đoán theo thời lượng (≤ 60 giây hoặc có `#shorts`). |
| Hình ảnh: Người thật / Animation | AI (Claude hoặc OpenAI) xem thumbnail + tiêu đề để phân loại. Không có khóa AI thì chỉ đoán theo từ khoá (kém chính xác hơn, có ghi "đoán"). |
| Quốc gia | YouTube lọc video xem được ở quốc gia đó và ưu tiên ngôn ngữ của nước đó. Tích **Chỉ kênh của quốc gia này** để chỉ giữ kênh khai báo quốc gia đó. |
| Khoảng thời gian | 24 giờ, 3/7/30 ngày, 3/12 tháng, hoặc chọn ngày. |
| Xếp hạng theo | Điểm tương tác tổng hợp (trung bình thứ hạng lượt xem, lượt thích, bình luận), hoặc từng chỉ số, hoặc tỉ lệ (thích + bình luận) / xem. |
| Từ khoá, danh mục, số video, độ sâu tìm kiếm | Tuỳ chọn thêm. |

**Quota:** miễn phí 10.000 đơn vị/ngày; mỗi trang tìm kiếm (50 video) tốn 100 đơn vị, nên một lần tìm "Vừa" tốn khoảng 200. Quota làm mới lúc 0h giờ Thái Bình Dương (khoảng 14–15h giờ Việt Nam).

Kết quả được lưu ở `out/_discover/<thời điểm>.csv` (mở bằng Excel/Google Sheets) và `.json`; tab hiện danh sách các lần tìm trước.

**Dòng lệnh:**

```bash
npm run discover -- --format shorts --style animation --country VN --period 7d --limit 20
npm run discover -- --format long --style live --country US --strict-country --from 2026-10-01 --to 2026-10-31
npm run discover -- --help    # xem mọi tuỳ chọn
```

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

- **Tìm video hot:** YouTube API không có cờ "Shorts", "quay thật/animation" hay "quốc gia của video", nên các bộ lọc này được suy ra như bảng trên và có thể sai ở vài video. Danh sách ứng viên là các video nhiều lượt xem nhất mà YouTube Search trả về (không phải toàn bộ YouTube), sau đó mới xếp lại theo tiêu chí bạn chọn.
- Video có cảnh quay thật, ảnh, khuôn mặt, giọng đọc hoặc nhạc sẽ chỉ được **mô phỏng** bằng chữ + đồ hoạ; phần ghi chú phân tích liệt kê những chỗ này.
- Đăng lại nguyên nội dung kênh khác có thể vi phạm bản quyền và chính sách "nội dung dùng lại" của YouTube; chế độ **Remix** tạo nội dung mới trên cùng khuôn.
- Remotion miễn phí cho cá nhân và công ty ≤3 người; công ty lớn hơn cần mua license (remotion.dev/license).
