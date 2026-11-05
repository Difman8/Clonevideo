"""Ghép bảng ảnh mẫu phong cách (fedtoon-characters.png) từ ảnh các nhân vật của kênh.

OpenAI nhận bảng này kèm mỗi yêu cầu vẽ (khi bật "Vẽ theo ảnh mẫu phong cách") để nền và đồ vật
cùng nét vẽ với nhân vật. Chạy lại khi thêm hoặc đổi ảnh nhân vật:
    python assets/style/board.py
Mọi ảnh png/jpg/webp khác đặt trong thư mục này cũng được gửi kèm (tối đa 8 ảnh, chỉ dùng ảnh của bạn).
"""
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCES = [
    ROOT / "assets" / "mascot" / "source.png",
    *(ROOT / "assets" / "cast" / cid / "source.png" for cid in ["woman", "man", "scientist", "teen", "boy", "kid", "grandpa"]),
]
OUT = HERE / "fedtoon-characters.png"
BG = (238, 236, 244, 255)


def trimmed(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    a = np.array(im)[..., 3]
    ys, xs = np.nonzero(a > 200)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def main() -> None:
    figures = [trimmed(p) for p in SOURCES]
    h = 700
    figures = [f.resize((round(f.width * h / f.height), h), Image.LANCZOS) for f in figures]
    gap = 40
    width = sum(f.width for f in figures) + gap * (len(figures) + 1)
    board = Image.new("RGBA", (width, h + 2 * gap), BG)
    x = gap
    for f in figures:
        board.alpha_composite(f, (x, gap))
        x += f.width + gap
    # Kích thước vừa phải: đủ rõ nét vẽ mà không tốn nhiều token ảnh đầu vào.
    scale = 1536 / board.width
    board = board.resize((1536, round(board.height * scale)), Image.LANCZOS)
    board.convert("RGB").save(OUT, optimize=True)
    print(OUT, board.size, OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
