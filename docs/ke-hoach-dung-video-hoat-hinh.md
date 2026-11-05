# Kế hoạch: dựng video hoạt hình giống video gốc nhưng có chất riêng

## Quyết định của chủ dự án (04/11/2026)

- Hướng **A + C**: nền và đồ vật do AI vẽ (A), nhân vật Fedtoon dựng sẵn (C).
- Tạo ảnh bằng **OpenAI** (dùng khóa đã có).
- Phong cách hình ảnh tham khảo video Shorts `youtube.com/shorts/b1EMX3wyqCY`, bộ nhận diện theo phong cách kênh Kurzgesagt: đồ hoạ phẳng, màu rực trên nền xanh đậm, hình khối bo tròn, ánh sáng phát quang. Fedtoon **lấy cảm hứng từ phong cách** đó nhưng có linh vật, logo, nhân vật riêng; không dùng chim, logo hay nhân vật đặc trưng của Kurzgesagt (đó là nhận diện thương hiệu của họ).

## Đã làm (bản đầu tiên)

| Phần | File | Ghi chú |
|---|---|---|
| Bộ nhận diện | `remotion-remake/src/fedtoon/brand.ts` | Bảng màu, font Nunito, mô tả phong cách ảnh (sửa được ở tab Cài đặt: `FEDTOON_IMAGE_STYLE`) |
| Nhân vật (hướng C) | `remotion-remake/src/remotion/fedtoon/Puppet.tsx`, `src/fedtoon/cast.ts` | 05/11: kênh quốc tế (tiếng Anh): nhân vật phụ dùng id/tên tiếng Anh, chỉ minh hoạ cho lời thoại (không tên, không vai, không nói, không gọi tên nhau); `finalizeStoryboard` đặt người nói là người dẫn hoặc Fed, id cũ (mai, tuan…) vẫn đọc được. |
| Nhân vật vẽ bằng code | `remotion-remake/src/remotion/fedtoon/Puppet.tsx` | Nhân vật người vẽ bằng SVG theo ảnh mẫu của chủ kênh `remotion-remake/assets/cast/reference.png` (05/11: cùng phong cách với Fed: đầu to, tai tròn, mắt to có đốm sáng, áo dài tay, quần và giày sẫm). Không cắt ảnh mẫu như Fed vì ảnh nhỏ (mỗi người ~400 px) và mỗi người bị cố định một tư thế. Dàn nhân vật phụ cố định: Mai, Tuấn, Lan, Khoa, Bảo, An, Ông (AI dùng lại theo id, ngoại hình bị khoá); người khác được tuỳ chỉnh da, tóc, màu áo, kiểu áo (len, hoodie, polo), quần (sẫm, jean), phụ kiện; 9 động tác, 6 biểu cảm, chớp mắt, khẩu hình theo mốc thời gian từng từ của ElevenLabs. Xem tất cả: Remotion Studio → `FedtoonCast` |
| Nhân vật phụ từ ảnh | `remotion-remake/assets/cast/<id>/` → `public/fedtoon/cast/<id>/`, `src/fedtoon/cast-rigs.ts` | 05/11: chủ kênh gửi ảnh nét từng nhân vật, dùng ảnh thay cho bản vẽ code. Đã xong: **woman** (Mai cũ), **man** (Tuấn, làm lại 05/11 với 2 ảnh), **scientist** (Lan), **kid** (An), **grandpa** (Ông); chủ kênh thấy 4 nhân vật sau còn méo nên làm lại từng người, mỗi người thêm một ảnh dáng tự nhiên. Cách làm lại (đã áp dụng cho man): ảnh dáng tự nhiên làm rig chính, ảnh cũ thành rig phụ `<id>-<động tác>` chỉ dùng cho động tác của nó (`poses` trong rig.json, vd. man: wave, cheer → man-wave), miệng cười của rig chính ghép sang rig phụ (`mouthFrom`), `shoulderShare` dồn chuyển động tay vào khuỷu cho vai đỡ lộ đường cắt, `trim` để phần vai ngoài vòng khớp ở lại thân áo; tránh xoay tay góc lớn (`rest`) vì dễ méo. Còn vẽ bằng code: **teen** (Khoa, chưa có ảnh) và **boy** (Bảo: ảnh đang nhảy co chân nên không dựng thành dáng đứng được, cần ảnh đứng thẳng). Mỗi nhân vật có `rig.json`: vùng từng bộ phận (đa giác + nhóm màu), khớp xoay, vòng khớp lấp chỗ hở, mắt, miệng, lông mày; tay giơ trong ảnh có `rest` (góc hạ tay khi nghỉ), `point`, `cap` (vai tròn khi hạ tay); `drawnAction` (động tác của ảnh: man vẫy, scientist chỉ, kid suy nghĩ, grandpa reo hò), `mouthStyle` (miệng trong ảnh: các biểu cảm khác vẽ bằng vector); đoạn tay `front` vẽ trước mặt (tay kid chạm thái dương). `python assets/cast/split.py <id>` cắt ảnh. Fed và nhân vật ảnh dùng chung bộ dựng `src/fedtoon/rig.ts` + `RigPuppet`. Xem: Remotion Studio → `FedtoonMascot` với props `{"id":"man"}`… |
| Linh vật Fed | `remotion-remake/assets/mascot/` → `public/fedtoon/mascot/` | Ảnh do chủ kênh tự tạo (05/11), giữ nguyên nét vẽ. `split.py` cắt ảnh thành tay buông, cẳng tay đang giơ, thân, đầu, miệng, hai lông mày và sinh `src/fedtoon/mascot-rig.ts` (vị trí, khớp xoay). Remotion xoay đầu quanh cổ, cẳng tay quanh khuỷu, tay buông quanh vai; mí mắt vẽ đè để chớp mắt, miệng co giãn theo giọng đọc, lông mày đổi theo biểu cảm. Chân không cử động (đi bộ = nhún + trượt). Xem: Remotion Studio → `FedtoonMascot`. Đổi ảnh linh vật: thay `source.png`, đo lại toạ độ trong `split.py`, chạy `python assets/mascot/split.py` (cần Pillow + numpy) |
| Kịch bản theo cảnh | `remotion-remake/src/spec/storyboard.ts`, `src/pipeline/storyboard-ai.ts` | AI (Claude/OpenAI) viết: lời thoại (chế độ **Bản sao** chép đúng từng câu theo phụ đề, app báo % từ giữ được; **Remix** viết mới), người nói, mô tả nền, góc máy, nhân vật + động tác + biểu cảm, đồ vật, chữ, chuyển cảnh, hiệu ứng âm thanh |
| Vẽ ảnh (hướng A) | `remotion-remake/src/pipeline/images.ts` | `gpt-image-2.5-sunburst` mặc định (đổi được), nền 9:16 đúng khung, đồ vật nền trong suốt; mỗi ảnh vẽ một lần; ảnh bị từ chối được thay bằng hình vẽ sẵn |
| Dựng video | `remotion-remake/src/remotion/fedtoon/FedtoonVideo.tsx` | Máy quay lia/zoom/rung, hạt sáng, nhân vật, đồ vật chuyển động, chữ theo bộ nhận diện, phụ đề karaoke, logo, giọng, hiệu ứng âm thanh; nền vẽ bằng code khi chưa có ảnh |
| Quy trình | `remotion-remake/src/pipeline/job.ts` | Bước mới "Vẽ hình ảnh"; tuỳ chọn dừng để duyệt kịch bản trước khi tốn tiền; tiếp tục được khi tắt máy |

## Phong cách theo video tham khảo (04/11/2026)

Chủ dự án gửi 6 bản quay màn hình Shorts tham khảo. Quan sát và đã áp dụng:

- **Không bóng đổ, không phát sáng, không vignette.** Chủ thể nổi bật nhờ **màu nền khác hẳn màu chủ thể** (não hồng trên nền tím, mặt trời vàng trên trời xanh lơ, hồ xanh trên cỏ xanh lá). Đã bỏ bóng chân, viền sáng, hạt phát sáng, vignette, hào quang mặt trời.
- **Quy tắc màu duy nhất** (`src/fedtoon/contrast.ts`): màu nền **không bao giờ trùng mã màu** với nhân vật trong cảnh (màu áo, da, tóc; Fed: áo `teal` #00B6B7, da, tóc). AI chọn `background.colors` tự nhiên; màu nào trùng đúng mã thì code thay bằng màu gần nhất không trùng, còn lại giữ nguyên. Yêu cầu vẽ ảnh gửi kèm màu nền và dặn không dùng đúng mã màu của nhân vật. (05/11: chủ dự án yêu cầu bỏ vòng tròn tương phản phía sau nhân vật và bỏ việc ép tương phản mạnh: không thêm lại.)
- Bảng màu rực: hồng cánh sen, tím, tím than, xanh lơ, xanh chanh, vàng, cam, xanh dương (lấy mẫu từ video).
- Mắt có lòng trắng và con ngươi, mí mắt theo biểu cảm; đồ vật có thể có mặt.
- Chữ: tiêu đề viền nhiều lớp màu, nhãn là khối màu đặc, số liệu trong khung tím than bo tròn. Phụ đề trắng viền mảnh, tối đa 3 từ, không nền, nằm dưới chủ thể.

## Việc tiếp theo

1. **Chạy thử với khóa thật** và so với video tham khảo; chỉnh `FEDTOON_IMAGE_STYLE`, bảng màu, nhân vật theo nhận xét.
2. **Chạy thử với khóa thật** và tinh chỉnh: độ nhất quán phong cách giữa các ảnh nền (cân nhắc dùng ảnh nền đầu tiên làm ảnh tham chiếu cho các ảnh sau qua `images.edit`), vị trí nhân vật so với nền.
3. **Nhiều giọng nhân vật**: mỗi nhân vật một Voice ID ElevenLabs.
4. **Nhạc nền và hiệu ứng âm thanh** bằng ElevenLabs Music / Sound Effects.
5. Thêm động tác/kiểu nhân vật (động vật, robot…) nếu video gốc cần.

## 0. Cho Claude xem video gốc và video tham chiếu

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

## 3. Ba hướng dựng hình (đã chọn A + C)

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
