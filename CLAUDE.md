# Clone Video — hướng dẫn cho Claude

App "Remotion Remake": dán link YouTube → AI (Claude hoặc OpenAI) phân tích → Remotion dựng lại video. Code nằm trong `remotion-remake/` (Node + TypeScript); xem `remotion-remake/README.md`.

Chủ dự án nói tiếng Việt: trả lời, viết giao diện, thông báo lỗi và tiêu đề commit/PR bằng tiếng Việt.

## Quy trình

- Làm việc trên một nhánh riêng (ví dụ `claude/...`) và đẩy nhánh đó lên. Workflow `.github/workflows/auto-merge.yml` tự kiểm tra TypeScript, gộp nhánh vào `main` và ghi một mục vào `CHANGELOG.md`. Không cần tự gộp vào main.
- Tiêu đề commit (hoặc PR) chính là dòng xuất hiện trong CHANGELOG, nên hãy viết ngắn gọn, nói rõ thay đổi gì cho người dùng (ví dụ "Thêm mẫu cảnh đếm ngược có âm thanh").
- Không sửa tay `CHANGELOG.md`; workflow tự ghi. Thêm `[skip changelog]` vào commit nếu không muốn ghi.
- Chủ dự án lấy thay đổi về máy tính bằng nút `Cập nhật Remotion Remake.bat`, nút này chỉ chạy `git pull` + `npm install` khi thư viện đổi. Thay đổi cần bước cài đặt khác (Python, file mới ngoài git) phải được xử lý trong `remotion-remake/scripts/setup.ts` hoặc ghi rõ trong CHANGELOG.

## Kiểm tra trước khi đẩy

```bash
cd remotion-remake
npm ci --ignore-scripts
npx tsc -p .
```

Workflow sẽ không gộp nếu lệnh này lỗi.

## Lưu ý

- Bộ dựng video hoạt hình "Fedtoon" (hướng A + C: ảnh OpenAI + nhân vật vẽ bằng code): kế hoạch và tiến độ ở [docs/ke-hoach-dung-video-hoat-hinh.md](docs/ke-hoach-dung-video-hoat-hinh.md). Đọc trước khi sửa phần dựng hình.
- Linh vật Fed là ảnh của chủ kênh (`remotion-remake/assets/mascot/source.png`), cắt thành bộ phận bằng `assets/mascot/split.py` → `public/fedtoon/mascot/*.png` + `src/fedtoon/mascot-rig.ts` (file sinh tự động, không sửa tay). Giữ nguyên nét vẽ gốc; không vẽ lại Fed bằng code.
- Kênh quốc tế (tiếng Anh): không dùng tên tiếng Việt trong video. Nhân vật phụ cố định (woman, man, scientist, teen, boy, kid, grandpa) khai báo ở `src/fedtoon/cast.ts`; họ chỉ minh hoạ cho lời thoại: không tên, không vai, không nói, không gọi tên nhau (chỉ người dẫn hoặc Fed nói). Nhân vật nào chủ kênh đã gửi ảnh nét thì dùng ảnh: `remotion-remake/assets/cast/<id>/source.png` + `rig.json` (vùng bộ phận, khớp xoay), cắt bằng `assets/cast/split.py` → `public/fedtoon/cast/<id>/*.png` + `src/fedtoon/cast-rigs.ts` (sinh tự động, không sửa tay). Nhân vật chưa có ảnh vẽ bằng code (`src/remotion/fedtoon/Puppet.tsx`) theo ảnh mẫu `assets/cast/reference.png`. Fed và nhân vật ảnh dùng chung bộ dựng `src/fedtoon/rig.ts`. Không còn linh vật Fed dạng sinh vật tròn.
- Ảnh OpenAI (nền, đồ vật) được vẽ kèm ảnh mẫu phong cách trong `remotion-remake/assets/style/` (bảng nhân vật của kênh, ghép lại bằng `python assets/style/board.py` khi đổi ảnh nhân vật). Không dùng khung hình video của kênh khác làm ảnh mẫu.
- `src/spec/storyboard.ts` là hợp đồng của kiểu Fedtoon: đổi thì cập nhật `src/pipeline/storyboard-ai.ts` (prompt), `src/remotion/fedtoon/FedtoonVideo.tsx`, `src/remotion/fedtoon/sample.ts` và nhãn tiếng Việt `ED_LABELS` của trình sửa cảnh trong `src/server/index.html`. Vị trí, cỡ đồ vật và nhân vật ở `src/fedtoon/layout.ts` (dùng chung cho video và vùng bấm của trình sửa cảnh). Bộ nhận diện (màu, font, mô tả phong cách ảnh) ở `src/fedtoon/brand.ts`; không dùng logo/nhân vật của kênh khác.
- Mọi thông số API (model, effort, voice ID…) khai báo ở `src/settings.ts`; đọc bằng `setting()` lúc dùng, không ghi cứng. `.env.example` được sinh từ danh sách đó: sửa `settings.ts` rồi chạy `npm run env-example`.
- Kênh theo dõi lưu ở `out/_discover/followed/` (thư mục con riêng vì `listDiscoveries` đọc mọi file `.json` nằm trực tiếp trong `out/_discover/` như kết quả tìm kiếm); cách tính điểm ở `SCORE_WEIGHTS` trong `src/discover/channels.ts`.
- Tiến trình dựng video lưu ở `out/<id>/state.json`, tìm kiếm dở ở `out/_discover/pending/`; ghi file bằng `writeFileAtomic`/`writeJsonAtomic` để mất điện không làm hỏng file.
- Không commit `.env`, khóa API, `out/`, `node_modules/`, `.venv/`.
- `src/spec/schema.ts` là hợp đồng giữa AI và các mẫu cảnh Remotion: đổi schema thì cập nhật cả `src/remotion/scenes.tsx`, `src/spec/normalize.ts`, `src/remotion/sample.ts` và prompt trong `src/pipeline/ai-common.ts`.
- Hai nhà cung cấp AI (`analyze-claude.ts`, `analyze-openai.ts`) dùng chung prompt và schema; sửa một bên thì kiểm tra bên kia.
