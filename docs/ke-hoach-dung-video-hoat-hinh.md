# Kế hoạch: dựng video hoạt hình giống video gốc nhưng có chất riêng

Trạng thái: **bản nháp, chờ xem video gốc.** Viết ngày 03/11/2026.

## 0. Việc cần làm trước: cho Claude xem video gốc

Video gốc bạn đã chạy thử nằm trên máy tính của bạn, trong `remotion-remake/out/<videoId>/` (có `source.mp4`, `frames/`, `analysis.json`, `spec.json`, `transcript.txt`). Claude chạy trên máy chủ đám mây nên chưa mở được thư mục này. Có hai cách:

- **A. Chia sẻ thư mục (khuyên dùng):** mở ứng dụng Claude trên máy tính → Settings → Claude Code → Remote Control → thêm thư mục `Clonevideo`. Sau đó nhắn Claude để yêu cầu truy cập; Claude sẽ đọc thẳng video, khung hình và kịch bản AI đã phân tích.
- **B. Gửi tay:** gửi link YouTube của video gốc, kèm 5–10 ảnh chụp các cảnh tiêu biểu (lấy trong `out/<videoId>/frames/`) và mô tả ngắn: nhân vật, bối cảnh, có lời thoại hay không, có nhạc nền không.

Kế hoạch dưới đây sẽ được chỉnh lại cho đúng video đó.

## 1. Vì sao bản hiện tại chỉ ra "chữ trên nền màu"

Bộ dựng hiện tại chỉ có 11 mẫu cảnh vẽ bằng code: chữ, danh sách, quiz, biểu đồ, số liệu, trích dẫn… Không có ảnh, nhân vật, bối cảnh hay chuyển động nhân vật nào. Vì thế với video hoạt hình, nó chỉ giữ được lời thoại và màu sắc. Đây là giới hạn của cách làm, không phải lỗi nhỏ có thể sửa trong vài dòng code.

## 2. Một video hoạt hình gồm những gì, app đã có gì

| Thành phần | Cần để dựng lại | App hiện có |
|---|---|---|
| Kịch bản, lời thoại | AI (Claude/OpenAI) phân tích và viết lại | ✅ Có |
| Giọng đọc | ElevenLabs Text to Speech | ✅ Có (1 giọng cho cả video, mới thêm) |
| Nhiều giọng nhân vật, hội thoại | ElevenLabs: mỗi nhân vật một Voice ID, hoặc API Text to Dialogue | ❌ Thiếu |
| Nhân vật (thiết kế + nhiều tư thế/biểu cảm, giữ nguyên hình dạng qua các cảnh) | AI tạo ảnh có giữ nhân vật, hoặc nhân vật dựng sẵn bằng Rive/Lottie | ❌ **Thiếu, quan trọng nhất** |
| Bối cảnh, đạo cụ | AI tạo ảnh | ❌ Thiếu |
| Chuyển động (đi, nhảy, nói, máy quay lia/zoom, rung) | Remotion (keyframe, spring), hoặc AI biến ảnh thành video | ⚠️ Remotion có sẵn, chưa có lớp nhân vật/bối cảnh để điều khiển |
| Tách nhân vật khỏi nền | `@imgly/background-removal-node` (chạy trên máy, miễn phí) | ❌ Thiếu |
| Khẩu hình khi nói (lip-sync) | Rhubarb Lip Sync (miễn phí) hoặc mốc thời gian từng ký tự của ElevenLabs (app đã lưu) | ❌ Thiếu |
| Phụ đề chạy theo giọng | `@remotion/captions` + mốc thời gian ElevenLabs | ⚠️ Có chữ, chưa chạy theo từng từ |
| Hiệu ứng âm thanh | ElevenLabs Sound Effects (`/v1/sound-generation`) | ⚠️ Mới có 4 âm thanh tổng hợp |
| Nhạc nền | ElevenLabs Music (`/v1/music`, có cả tạo nhạc theo video) hoặc nhạc bạn có bản quyền | ❌ Thiếu |
| Lấy lời thoại khi video gốc không có phụ đề | ElevenLabs Speech to Text | ❌ Thiếu |
| Chất riêng "Fedtoon" | Bộ nhận diện: nhân vật đại diện, màu, font, logo, intro/outro | ❌ Thiếu |

## 3. Ba hướng dựng hình: bạn cần chọn

**A. Truyện tranh chuyển động (motion comic).** AI tạo ảnh nhân vật và bối cảnh, tách nền, rồi Remotion ghép thành nhiều lớp: máy quay lia/zoom, nhân vật nảy, di chuyển, đổi biểu cảm, khẩu hình đơn giản. Chi phí chủ yếu là tiền tạo ảnh (khoảng 20–40 ảnh mỗi video). Giống video gốc ở mức khá; hợp video kể chuyện, giải thích, top list.

**B. AI biến ảnh thành video (image-to-video).** Tạo ảnh từng cảnh rồi dùng dịch vụ như Kling, Runway, Luma, Google Veo, Sora để tạo 3–10 giây chuyển động thật mỗi cảnh. Remotion ghép lại, thêm phụ đề, giọng, nhạc, chuyển cảnh. Giống hoạt hình thật nhất, nhưng tính tiền theo giây video (đắt hơn nhiều lần hướng A) và khó giữ nhân vật giống hệt nhau giữa các cảnh.

**C. Nhân vật dựng sẵn (rig) bằng Rive hoặc Lottie.** Làm một lần bộ nhân vật Fedtoon có sẵn động tác: đi, nói, vẫy tay, vui, buồn, ngạc nhiên. Remotion điều khiển các động tác đó theo kịch bản (`@remotion/rive`, `@remotion/lottie`). Mỗi video gần như không tốn thêm tiền, nhân vật nhất quán tuyệt đối, đúng "chất riêng". Đổi lại, phải có bộ nhân vật trước: tự thiết kế trên Rive/LottieFiles, mua, hoặc thuê.

**Gợi ý ban đầu (sẽ chốt sau khi xem video):** C cho nhân vật Fedtoon cố định, cộng A cho bối cảnh; dùng B cho vài cảnh cao trào nếu ngân sách cho phép.

## 4. Công cụ còn thiếu

**Cần bạn chọn hoặc cung cấp:**

1. **Dịch vụ tạo ảnh AI** (bắt buộc cho hướng A và B; tuỳ chọn cho C). Ví dụ: OpenAI Images API (dùng được khóa OpenAI bạn đã có), Google Gemini (giữ nhân vật qua nhiều ảnh tốt), fal.ai hoặc Replicate (các model Flux). Cần khóa API và chấp nhận chi phí theo ảnh.
2. **Dịch vụ image-to-video** (chỉ khi chọn B): Kling, Runway, Luma, Google Veo… Cần khóa API.
3. **Bộ nhân vật** (chỉ khi chọn C): file `.riv` (Rive) hoặc `.json` (Lottie). Bạn có thể tìm trên LottieFiles, cộng đồng Rive, hoặc thuê thiết kế.
4. **Bộ nhận diện Fedtoon** nếu đã có: logo, nhân vật đại diện, màu chủ đạo, font.
5. **Ngân sách mỗi video:** ví dụ dưới 1 USD/video (hướng A/C) hay chấp nhận vài chục USD/video (hướng B).

**Claude tự cài được, không cần bạn tìm** (đều miễn phí, khớp phiên bản Remotion 4.0.539 của app):

- `@remotion/lottie`, `@remotion/rive`, `@remotion/captions`, `@remotion/media`, `@remotion/motion-blur`, `@remotion/noise`, `@remotion/shapes`
- `@imgly/background-removal-node` (tách nền ảnh ngay trên máy)
- Rhubarb Lip Sync (chương trình khẩu hình miễn phí trên GitHub; sẽ cài qua `scripts/setup.ts`)
- ElevenLabs Sound Effects, Music, Text to Dialogue, Speech to Text (dùng chung khóa ElevenLabs đã có)

## 5. Lộ trình đề xuất

Mỗi giai đoạn xong, bạn duyệt rồi mới làm giai đoạn sau.

1. **Phân tích sâu thành storyboard:** từng cảnh có nhân vật nào, hành động gì, bối cảnh, góc máy, lời thoại của ai, hiệu ứng âm thanh, không khí nhạc. App hiện storyboard để bạn sửa **trước khi** tốn tiền tạo hình.
2. **Bộ nhận diện và thư viện tài sản Fedtoon:** nhân vật, bối cảnh, âm thanh lưu lại để dùng cho nhiều video, không tạo lại mỗi lần.
3. **Tạo tài sản cho từng cảnh:** ảnh, clip, giọng nhiều nhân vật, hiệu ứng âm thanh, nhạc. Có lưu đệm và tiếp tục được khi máy tắt (giống cơ chế đã làm cho giọng đọc).
4. **Bộ dựng Remotion mới theo lớp:** nền, nhân vật, đạo cụ, máy quay, phụ đề chạy theo giọng, giọng, hiệu ứng, nhạc. Thay cho 11 mẫu cảnh chữ hiện tại.
5. **"Giống nhưng không sao chép":** viết lại lời thoại, thay nhân vật gốc bằng nhân vật Fedtoon, đổi bối cảnh và màu, giữ nhịp và cấu trúc câu chuyện. Cách này cũng tránh lỗi bản quyền và chính sách "nội dung dùng lại" của YouTube khi dùng nhân vật của kênh khác.
