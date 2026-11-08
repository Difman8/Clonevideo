# Remotion Remake

Dán link YouTube → app phân tích video → dựng lại bằng **Remotion** → xuất MP4, kèm **nội dung đăng** của video gốc (tiêu đề, hashtag, mô tả, keywords).

## Cài đặt (một lần)

Cần Node.js 20+ và Python 3.10+.

```bash
npm install
npm run setup
```

`npm run setup` cài `yt-dlp` vào `.venv/`, tạo hiệu ứng âm thanh, tải trình duyệt render của Remotion và tạo file `.env`.

Mở app, vào tab **⚙️ Cài đặt** (hoặc sửa file `.env`) để điền khóa và thông số:

- **Claude** (`ANTHROPIC_API_KEY`) hoặc **OpenAI** (`OPENAI_API_KEY`): phân tích video, soạn thông tin đăng.
- **ElevenLabs** (`ELEVENLABS_API_KEY` + chọn giọng): lồng tiếng cho video.
- **YouTube Data API** (`YOUTUBE_API_KEY`): tab Tìm video hot.

Mọi thông số ngoài khóa đều xem và sửa được trên tab Cài đặt, có hiệu lực ngay, không cần khởi động lại: model, mức suy nghĩ (effort), số token tối đa của Claude/OpenAI; voice ID, model, ngôn ngữ, stability, similarity_boost, style, speaker boost, tốc độ, định dạng âm thanh, chuẩn hoá số, seed của ElevenLabs; tên kênh. Danh sách đầy đủ kèm giải thích nằm trong [.env.example](.env.example). Sửa tay file `.env` cũng có hiệu lực ngay khi app đang mở; nhớ xoá dấu `#` ở đầu dòng, vì dòng còn `#` chỉ là chú thích (app cảnh báo trên tab Cài đặt và trong nhật ký nếu thấy dòng như vậy). Trên tab Cài đặt, nút **Tải giọng & model từ tài khoản** liệt kê giọng và model của tài khoản ElevenLabs (model nào có tiếng Việt, còn bao nhiêu ký tự); nút **Nghe thử** đọc một câu bằng cài đặt đang lưu.

Không có khóa Claude/OpenAI thì app vẫn chạy với **phân tích cơ bản** (dựng từ chapters/phụ đề, màu lấy từ khung hình).

## Dùng

**Giao diện web:** bấm đúp **`Khởi động Remotion Remake.bat`** ở thư mục ngoài (lần đầu nó tự cài mọi thứ), hoặc:

```bash
npm start
```

Mở http://localhost:3210, dán link, chọn **kiểu video**:

- **🎨 Hoạt hình Fedtoon** (mặc định): AI xem video gốc và viết kịch bản Fedtoon theo từng cảnh, gồm lời thoại (chép nguyên hoặc viết mới tuỳ chế độ), nhân vật Fedtoon thay cho nhân vật gốc, mô tả nền, đồ vật, chữ, góc máy. OpenAI vẽ nền và đồ vật theo phong cách đồ hoạ phẳng (mô tả đổi được ở tab Cài đặt), có gửi kèm bảng nhân vật của kênh (`assets/style/fedtoon-characters.png`) làm ảnh mẫu để nền và đồ vật cùng nét vẽ với nhân vật; có thể thêm ảnh mẫu của bạn vào `assets/style/` (tối đa 8 ảnh) hoặc tắt ở mục "Vẽ theo ảnh mẫu phong cách". Linh vật Fed là ảnh do chủ kênh vẽ, được cắt thành từng bộ phận để cử động (vẫy tay, nghiêng đầu, chớp mắt, khẩu hình theo giọng đọc, đổi biểu cảm); các nhân vật phụ (woman, man, scientist, teen, boy, kid, grandpa) xuất hiện lại với cùng ngoại hình ở mọi video. Cả 7 nhân vật đều được cắt ghép từ ảnh nét của kênh như Fed; nhân vật AI tự thêm được vẽ bằng code theo ảnh mẫu (`assets/cast/reference.png`). Nhân vật phụ chỉ minh hoạ cho lời thoại: không tên, không vai, không nói, không gọi tên nhau (kênh quốc tế, không dùng tên riêng); chỉ người dẫn hoặc Fed nói. AI chọn nhân vật hợp với từng tình huống và có thể thêm người khác cùng phong cách. Cả hai giống nhau ở mọi video và không tốn tiền. Phong cách đồ hoạ phẳng màu rực, không bóng đổ; màu nền không bao giờ trùng mã màu với nhân vật trong cảnh, ngoài ra để tự nhiên. Video có phụ đề, logo Fedtoon, hiệu ứng âm thanh. Cần khóa Claude hoặc OpenAI để viết kịch bản; thiếu khóa OpenAI thì dùng nền vẽ sẵn bằng code.
- **🔤 Chữ & đồ hoạ** (kiểu cũ): 11 mẫu cảnh chữ và biểu đồ.

Tích **✋ Dừng để duyệt kịch bản trước khi vẽ ảnh** nếu muốn xem và sửa kịch bản trước khi tốn tiền vẽ ảnh và lồng tiếng; sửa xong bấm **Lưu & render lại**. Mỗi ảnh được vẽ một lần rồi lưu lại: sửa một mô tả thì chỉ vẽ lại đúng ảnh đó.

Gạt công tắc **Claude ⟷ OpenAI** để chọn AI viết kịch bản, rồi chọn chế độ:

- **Bản sao** — giữ nguyên nội dung video gốc. Với kiểu **Hoạt hình Fedtoon**: lời thoại chép đúng từng câu theo phụ đề (cùng thứ tự, cùng nhịp), chữ trên hình giữ nguyên, chỉ hình ảnh làm lại theo phong cách Fedtoon (Fed thay người dẫn) và thêm một cảnh kết ngắn "Theo dõi Fedtoon". App so lời thoại với phụ đề và báo số % từ được giữ; video không có phụ đề thì không chép được lời thoại. Với kiểu chữ & đồ hoạ: dựng giống bản gốc nhất có thể (chữ, thứ tự, thời lượng, màu, chuyển cảnh).
- **Remix** — giữ khuôn, nhịp và phong cách nhưng AI viết nội dung mới, kèm tiêu đề/mô tả/hashtag mới.

Tích **🎙️ Lồng tiếng (ElevenLabs)** để AI viết lời thoại (`narration`) cho từng cảnh và ElevenLabs đọc lời đó. Cảnh nào lời đọc dài hơn cảnh sẽ được kéo dài cho vừa. Giọng đã tạo được lưu lại: render lại hay tiếp tục sau khi tắt máy không phải trả tiền lại cho câu đã đọc.

Sau khi render, có thể sửa `spec.json` ngay trên trang (chữ, màu, thời lượng, lời thoại, thêm/bớt cảnh) rồi bấm **Lưu & render lại**; chỉ câu thoại đã sửa mới được tạo giọng lại.

Mỗi video do AI viết có sẵn khung **Nội dung đăng chính thức**: AI viết tiêu đề, mô tả và từ khoá ngay khi viết kịch bản (không tốn thêm lượt gọi AI), app định dạng theo kênh: tiêu đề có `#shorts`, keywords ngăn cách bằng dấu phẩy, dòng cuối mô tả là `#Fedtoon #shorts #science`.

Muốn sửa chi tiết trong video Fedtoon: tạm dừng video ở chỗ chưa ưng, bấm **✏️ Sửa cảnh đang xem**. Bấm thẳng vào đồ vật hay nhân vật trên ảnh để chọn, rồi xoá, đổi vị trí, đổi cỡ, đổi động tác, biểu cảm hay sửa chữ trên màn hình; ảnh xem trước cập nhật sau khoảng 3 giây. **Thêm đồ vật** lấy từ ảnh sẵn có của video (miễn phí) hoặc mô tả để OpenAI vẽ ảnh mới (tốn phí 1 ảnh, chỉ khi bấm nút vẽ). Bấm **Lưu & render lại (không tốn AI)** khi xong. Chi tiết nằm trong ảnh nền không tách riêng để xoá được; lời thoại sửa ở ô Kịch bản vì cần tạo lại giọng.

Nút **🎬 Render lại (không tốn AI)** dưới video dựng lại bằng đúng kịch bản, ảnh và giọng đã lưu, không gọi API nào. Dùng nút này sau khi cập nhật app để áp dụng thay đổi về dựng hình, âm thanh (ví dụ cỡ nhân vật, âm lượng) cho video đã làm. Video hiện tại sẽ được thay bằng bản mới. Khác với **Lưu & render lại**: nút đó có thể tạo lại giọng hoặc ảnh nếu kịch bản hay cài đặt đã đổi.

**Tắt máy giữa chừng:** app lưu tiến trình sau mỗi bước. Lần mở app sau sẽ hiện thẻ **⏸ Việc đang dở từ lần trước**; bấm **Tiếp tục** để làm nốt. Các bước đã xong không phải làm lại: video đang tải dở được tải tiếp, phân tích AI và giọng đọc đã trả tiền được dùng lại, các trang tìm kiếm YouTube đã tốn quota không bị tìm lại. Việc bị lỗi (ví dụ hết quota, khóa sai) cũng hiện ở đây để thử lại sau khi sửa.

**Dòng lệnh:**

```bash
npm run remake -- "https://www.youtube.com/shorts/XXXXXXXXXXX"
npm run remake -- "<link>" --openai       # phân tích bằng OpenAI thay vì Claude
npm run remake -- "<link>" --remix        # chế độ remix
npm run remake -- "<link>" --basic        # không dùng AI
npm run remake -- "<link>" --voice        # lồng tiếng bằng ElevenLabs
npm run remake -- "<link>" --review       # dừng sau kịch bản để duyệt (Fedtoon)
npm run remake -- "<link>" --classic      # kiểu chữ & đồ hoạ cũ
npm run remake -- "<link>" --no-render    # chỉ phân tích + lấy nội dung đăng
npm run remake -- --resume <videoId>      # làm tiếp việc đang dở (sau khi máy tắt đột ngột)
npm run remake -- --rerender <videoId>    # render lại sau khi sửa out/<videoId>/spec.json
```

**Xem/chỉnh template trong Remotion Studio:** `npm run studio`. Composition `Fedtoon` là video mẫu, `FedtoonCast` là bảng mọi nhân vật và động tác, `Remake` là kiểu chữ & đồ hoạ.

## Soạn thông tin đăng YouTube (AI)

Thẻ **✍️ Soạn thông tin đăng YouTube bằng AI** trong tab Dựng lại video viết tiêu đề, mô tả, hashtag và keywords cho bản dựng lại, dựa trên video gốc:

- **Tiêu đề và mô tả** được AI viết lại, giữ khoảng **80–90%** số từ của video gốc (cùng ngôn ngữ, ý, bố cục, emoji) để tránh bị quét trùng lặp. AI chỉ được làm khác đi bằng hai cách: **thêm tên kênh của bạn** (mặc định **Fedtoon**, đổi được ngay trên thẻ hoặc bằng `CHANNEL_NAME` trong `.env`) và **dùng thông tin có sẵn trong mô tả** của video gốc. AI bị cấm đảo chữ, viết sai chính tả hay bịa từ; thẻ kết quả liệt kê mọi từ AI thêm vào mà video gốc không có để bạn soát.
- App tự đo độ giống sau khi AI viết; nếu lệch khỏi 80–90% hoặc tiêu đề quá 100 ký tự, app nhờ AI viết lại một lần nữa và giữ bản gần mục tiêu hơn. Link, @tên kênh, tên kênh gốc, thông tin tài trợ/liên hệ của video gốc được bỏ đi (tên kênh gốc được thay bằng tên kênh của bạn).
- **Hashtag** giữ **100%**, đúng cách viết của video gốc: code tự kiểm tra và thêm lại hashtag nào AI làm rơi. Có thêm **#Fedtoon** (tắt được bằng ô tích trên thẻ).
- **Keywords (tags)** giữ **100%**: dùng nguyên danh sách của video gốc, thêm **Fedtoon** ở cuối nếu chưa vượt 500 ký tự. Chỉ khi video gốc không khai báo keywords thì AI mới gợi ý.

Cách dùng: ở tab **🔥 Tìm video hot**, bấm **🎬 Dựng lại video này** trên video ưng ý (thông tin video gốc được điền sẵn), hoặc dán link rồi bấm **📥 Lấy thông tin video từ link ở trên**. Sau đó bấm **✍️ Viết bằng Claude/OpenAI** (theo công tắc AI). Mỗi lần viết gọi AI 1 lần (2 lần nếu phải chỉnh độ giống); bấm **↻ Viết lại** để có phiên bản khác. Kết quả lưu ở `out/<videoId>/new-post.txt` và `.json`.

```bash
npm run post -- "https://www.youtube.com/shorts/XXXXXXXXXXX"            # viết bằng Claude
npm run post -- "https://www.youtube.com/shorts/XXXXXXXXXXX" --openai   # viết bằng OpenAI
npm run post -- "<link>" --channel "Fedtoon" --no-brand-tags            # đổi tên kênh, không thêm #Fedtoon
```

## Công cụ vẽ ảnh Fedtoon

Tab **⚙️ Cài đặt → Hình ảnh Fedtoon** chọn công cụ cho từng loại ảnh (mặc định OpenAI):

- **Ảnh nền: Google Nano Banana** (`gemini-nano-banana-2.1`). Vẽ ở 2K rồi app thu về đúng khung video 1080x1920. Bật **Vẽ ảnh nền theo lô (Batch API)** để rẻ hơn 50%: cả loạt ảnh nền gửi trong một lần, Google trả trong tối đa 24 giờ (thường vài phút); có thể đóng app rồi bấm **Tiếp tục** để lấy ảnh mà không bị tính tiền lần nữa.
- **Đồ vật: Recraft** (`recraftv4_1`). Vẽ theo phong cách tạo từ ảnh mẫu trong `assets/style/` (tạo một lần, mã lưu ở `out/_images/`), rồi tách nền thành PNG trong suốt. Recraft không có Batch API.
- **Đồ vật: Google Nano Banana** (chọn ở **Công cụ vẽ đồ vật**). Google không vẽ được nền trong suốt nên app nhờ vẽ đồ vật trên nền xanh lá thuần (#00FF00, khác hẳn mọi màu của kênh) cỡ 1K rồi tự tách nền ngay trên máy, không tốn thêm phí. Bật **Recraft hết API units thì vẽ đồ vật bằng Google** (mặc định bật) để app tự chuyển sang Google khi tài khoản Recraft hết units, rồi tự quay lại Recraft khoảng 10 phút sau khi bạn nạp thêm.

Cần khóa ở mục **Google Gemini** (bật thanh toán, model ảnh không có gói miễn phí) và **Recraft** (nạp API units).

## Top Shorts của kênh

Trong tab **🔥 Tìm video hot**, dán link kênh, @tên kênh hoặc link một video của kênh rồi bấm **🏆 Quét toàn bộ Shorts**. App đọc **toàn bộ** Shorts kênh đã đăng, lấy lượt xem, lượt thích, bình luận của từng Short và trả về **20 Shorts nhiều lượt xem nhất**, kèm link, keywords, hashtag và nút **🎬 Dựng lại video này**. Mọi kênh bạn quét hoặc bấm **➕ Lưu kênh** (dán được nhiều kênh cùng lúc, cách nhau bằng dấu cách hoặc dấu phẩy) đều được lưu vào danh sách bên dưới ô nhập, ngay khi app tìm thấy kênh, kể cả khi lần quét sau đó bị lỗi. Danh sách lưu trên máy (`out/_discover/followed/channels.json`), vẫn còn sau khi tắt app; bấm **🏆 Quét** cạnh kênh để quét lại, **🗑** để xoá.

Mọi bước chạy bằng YouTube Data API (miễn phí, không dùng AI): danh sách Shorts riêng của kênh do YouTube tạo sẵn (`UUSH…`) và thông tin video, mỗi loại 1 đơn vị quota cho 50 video. Ví dụ kênh có 200 Shorts tốn khoảng 11 đơn vị, kênh 1.000 Shorts khoảng 40 đơn vị (quota miễn phí 10.000 đơn vị/ngày). Danh sách `UUSH…` không có trong tài liệu của Google: nếu một ngày YouTube ngừng trả nó, app tự chuyển sang đọc tối đa 2.000 video mới nhất của kênh rồi kiểm từng video ngắn có phải Short không (chậm hơn và tốn thêm ít quota).

## Tìm video hot

Tab **🔥 Tìm video hot** dùng [YouTube Data API v3](https://developers.google.com/youtube/v3) (miễn phí) để tìm video có nhiều lượt xem, lượt thích và bình luận nhất trong một khoảng thời gian. Mỗi video trả về kèm **link, chủ đề, keywords và hashtag**, ngôn ngữ, lượt xem/thích/bình luận, tỉ lệ tương tác, và nút **🎬 Dựng lại video này** để chuyển sang tab dựng lại.

Công cụ này **không dùng AI** (không tốn token Claude/OpenAI): mọi bước chạy bằng dữ liệu YouTube API hoặc code trên máy.

**Lấy khóa (một lần, miễn phí):** mở [YouTube Data API v3 trong Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com), tạo/chọn dự án, bấm **Enable**, rồi vào **APIs & Services → Credentials → Create credentials → API key**. Dán khóa ngay trên tab (app kiểm tra rồi lưu vào `.env`), hoặc tự thêm dòng `YOUTUBE_API_KEY=...` vào `.env`.

Bộ lọc:

| Bộ lọc | Cách hoạt động |
|---|---|
| Định dạng: Shorts / Video dài / Cả hai | Kiểm tra trang `youtube.com/shorts/<id>` của từng video ≤ 3 phút; nếu không mở được thì đoán theo thời lượng (≤ 60 giây hoặc có `#shorts`). |
| Quốc gia | Giữ video có **tiêu đề** viết bằng ngôn ngữ của nước đó (vd. Việt Nam → tiếng Việt); nếu tiêu đề không đủ chữ để nhận diện thì xét **mô tả**, rồi đến **ngôn ngữ kênh khai báo** cho video. Ngôn ngữ được nhận diện ngay trên máy qua chữ viết (dấu tiếng Việt, chữ Thái, Hàn, Nhật…) và từ thông dụng. YouTube Search cũng được yêu cầu ưu tiên quốc gia và ngôn ngữ đó. |
| Khoảng thời gian | 24 giờ, 3/7/30 ngày, 3/12 tháng, hoặc chọn ngày. |
| Xếp hạng theo | Điểm tương tác tổng hợp (trung bình thứ hạng lượt xem, lượt thích, bình luận), hoặc từng chỉ số, hoặc tỉ lệ (thích + bình luận) / xem. |
| Từ khoá, danh mục, số video, độ sâu tìm kiếm | Tuỳ chọn thêm. |

**Quota:** miễn phí 10.000 đơn vị/ngày; mỗi trang tìm kiếm (50 video) tốn 100 đơn vị, nên một lần tìm "Vừa" tốn khoảng 200. Quota làm mới lúc 0h giờ Thái Bình Dương (khoảng 14–15h giờ Việt Nam).

Kết quả được lưu ở `out/_discover/<thời điểm>.csv` (mở bằng Excel/Google Sheets) và `.json`; tab hiện danh sách các lần tìm trước.

**Dòng lệnh:**

```bash
npm run discover -- --format shorts --country VN --period 7d --limit 20
npm run discover -- --format long --country US --from 2026-10-01 --to 2026-10-31
npm run discover -- --country all --sort comments       # toàn cầu, xếp theo bình luận
npm run discover -- --help    # xem mọi tuỳ chọn
```

## Kết quả (`out/<videoId>/`)

| File | Nội dung |
|---|---|
| `remake.mp4` | Video đã dựng lại |
| `post.txt` / `post.json` | Tiêu đề, hashtag, mô tả, keywords (+ keywords gợi ý của AI) |
| `new-post.txt` / `new-post.json` | Thông tin đăng mới do AI soạn (giống video gốc 80–90%, giữ đủ hashtag/keywords) |
| `spec.json` | Kịch bản cảnh-theo-cảnh mà Remotion render |
| `analysis.json` | Kết quả thô của bộ phân tích |
| `voice/` | Các đoạn giọng ElevenLabs (mỗi cảnh một file, kèm mốc thời gian từng ký tự) |
| `img/` | Ảnh nền và đồ vật OpenAI vẽ cho kiểu Fedtoon (`refused.json`: mô tả bị OpenAI từ chối) |
| `state.json` | Tiến trình các bước, dùng để tiếp tục khi máy tắt giữa chừng |
| `transcript.txt`, `frames/` | Phụ đề và khung hình đã trích để phân tích |

## Cách hoạt động

1. `yt-dlp` lấy metadata, video ≤720p (chỉ hình) và phụ đề.
2. `ffmpeg` cắt khung hình ở mỗi lần chuyển cảnh + mỗi vài giây (tối đa 60 khung).
3. Claude (`claude-opus-5-5`) hoặc OpenAI (`gpt-5.5`) xem khung hình + phụ đề, trả về `spec.json` theo schema cố định ([src/spec/schema.ts](src/spec/schema.ts)). Hai bên dùng chung prompt trong [src/pipeline/ai-common.ts](src/pipeline/ai-common.ts).
4. Kiểu Fedtoon: AI viết storyboard ([src/spec/storyboard.ts](src/spec/storyboard.ts), prompt ở [src/pipeline/storyboard-ai.ts](src/pipeline/storyboard-ai.ts)); OpenAI vẽ nền và đồ vật ([src/pipeline/images.ts](src/pipeline/images.ts)), kèm ảnh mẫu phong cách trong `assets/style/` (bảng nhân vật ghép bằng `python assets/style/board.py`).
5. Nếu bật lồng tiếng, ElevenLabs đọc lời thoại từng cảnh ([src/pipeline/voiceover.ts](src/pipeline/voiceover.ts)).
6. Remotion render: kiểu Fedtoon bằng [src/remotion/fedtoon/FedtoonVideo.tsx](src/remotion/fedtoon/FedtoonVideo.tsx) (nhân vật trong [Puppet.tsx](src/remotion/fedtoon/Puppet.tsx), bộ nhận diện trong [src/fedtoon/brand.ts](src/fedtoon/brand.ts)); kiểu chữ & đồ hoạ bằng 11 mẫu cảnh trong [src/remotion/scenes.tsx](src/remotion/scenes.tsx).

Mẫu cảnh: `title`, `text` (chữ động), `list-item` (top list), `quiz`, `bar-chart`, `big-number`, `quote`, `timeline`, `countdown`, `comparison`, `outro`. Tất cả vẽ bằng code: không cần ảnh, video, nhạc hay font tự cung cấp (font lấy từ Google Fonts, âm thanh tổng hợp bằng code).

## Giới hạn

- **Tìm video hot:** YouTube API không có cờ "Shorts" hay "quốc gia của video", nên hai bộ lọc này được suy ra như bảng trên và có thể sai ở vài video. Lọc quốc gia theo ngôn ngữ không tách được các nước dùng chung một ngôn ngữ (vd. Hoa Kỳ / Anh / Úc đều là tiếng Anh). Chủ đề lấy từ danh mục và chủ đề mà YouTube gán cho video (khá chung, vd. "Giải trí, Thú cưng"). Danh sách ứng viên là các video nhiều lượt xem nhất mà YouTube Search trả về (không phải toàn bộ YouTube), sau đó mới xếp lại theo tiêu chí bạn chọn.
- Video có cảnh quay thật, ảnh, nhân vật hoạt hình, khuôn mặt hoặc nhạc sẽ chỉ được **mô phỏng** bằng chữ + đồ hoạ; phần ghi chú phân tích liệt kê những chỗ này. Kế hoạch dựng video hoạt hình thật (nhân vật, bối cảnh, chuyển động) và các công cụ còn thiếu: [docs/ke-hoach-dung-video-hoat-hinh.md](../docs/ke-hoach-dung-video-hoat-hinh.md).
- Render không tiếp tục được giữa chừng: nếu máy tắt lúc đang render, bước render chạy lại từ đầu (các bước trước vẫn được giữ).
- Đăng lại nguyên nội dung kênh khác có thể vi phạm bản quyền và chính sách "nội dung dùng lại" của YouTube; chế độ **Remix** tạo nội dung mới trên cùng khuôn.
- Remotion miễn phí cho cá nhân và công ty ≤3 người; công ty lớn hơn cần mua license (remotion.dev/license).
