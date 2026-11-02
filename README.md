# Clone Video — Remotion Remake

Dán link YouTube → AI (Claude hoặc OpenAI) phân tích video → dựng lại bằng **Remotion** → xuất MP4, kèm nội dung đăng của video gốc (tiêu đề, hashtag, mô tả, keywords).

Phù hợp nhất với video chữ + đồ hoạ chuyển động: quiz, top list, sự thật thú vị, trích dẫn, số liệu, timeline.

Tab **🔥 Tìm video hot** tìm video YouTube có nhiều lượt xem, lượt thích và bình luận nhất trong một khoảng thời gian (lọc theo quốc gia, Shorts/video dài, người thật/animation), trả về link, chủ đề, keywords và hashtag. Cần khóa YouTube Data API v3 miễn phí — xem hướng dẫn ngay trên tab.

## Chạy nhanh (Windows)

1. Cài [Node.js](https://nodejs.org) 20+ và [Python](https://www.python.org) 3.10+.
2. Bấm đúp **`Khởi động Remotion Remake.bat`** — lần đầu sẽ tự cài thư viện, yt-dlp và trình duyệt render.
3. Điền `ANTHROPIC_API_KEY` và/hoặc `OPENAI_API_KEY` vào `remotion-remake/.env`, rồi bấm lại nút khởi động.

Chi tiết: [remotion-remake/README.md](remotion-remake/README.md).

## Sửa từ điện thoại, cập nhật trên máy tính

1. Nhờ Claude (Claude Code trên web/điện thoại) sửa repo này. Claude làm trên một nhánh riêng và đẩy lên GitHub.
2. GitHub Actions ([auto-merge.yml](.github/workflows/auto-merge.yml)) tự kiểm tra code, **gộp nhánh vào `main`** và ghi một dòng vào [CHANGELOG.md](CHANGELOG.md). Code lỗi TypeScript hoặc xung đột sẽ không được gộp (xem tab **Actions** trên GitHub).
3. Sửa trực tiếp trên `main` (nút Edit trên github.com) cũng được ghi vào CHANGELOG.
4. Về máy tính: đóng app nếu đang mở, bấm đúp **`Cập nhật Remotion Remake.bat`**. Nút này lấy mọi thay đổi từ GitHub, cài lại thư viện nếu cần và in danh sách thay đổi mới.
