"""Cắt ảnh linh vật Fed (source.png) thành các bộ phận để Remotion làm hoạt hình.

Chỉ dùng khi thay ảnh linh vật (không chạy lúc dựng video). Cần Python 3 + Pillow + numpy:
    python assets/mascot/split.py

Kết quả:
  public/fedtoon/mascot/*.png  — từng bộ phận, giữ nguyên nét vẽ gốc (avatar.png: đầu nguyên vẹn cho logo)
  src/fedtoon/mascot-rig.ts    — vị trí các bộ phận, khớp xoay, mắt, miệng (file sinh tự động)

Các tọa độ dưới đây (khớp xoay, mắt, miệng…) đo trên ảnh 1024x1536 hiện tại; đổi ảnh thì đo lại.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SRC = HERE / "source.png"
OUT = ROOT / "public" / "fedtoon" / "mascot"
RIG = ROOT / "src" / "fedtoon" / "mascot-rig.ts"

SKIN = (253, 149, 125)  # #FD957D
NECK = (228, 104, 78)  # #E4684E (dải bóng dưới cằm)
TEAL = (0, 182, 183)  # áo
TEAL_DARK = (2, 146, 149)
PANTS = (72, 48, 129)
CUFF = (137, 104, 196)
NAVY = (28, 39, 92)  # tóc, lông mày

# Khớp xoay và vùng đặc trưng (tọa độ ảnh gốc)
NECK_PIVOT = (447, 456)
ELBOW = (634, 667)  # khuỷu tay đang giơ (tâm đầu khuỷu tròn)
ELBOW_R = 31
SHOULDER = (286, 596)  # vai tay buông
FEET_Y = 1506
CENTER_X = 452
EYES = [  # đồng tử trong tròng kính: tâm, bán kính ngang/dọc
    {"cx": 410, "cy": 302, "rx": 19, "ry": 22},
    {"cx": 531, "cy": 281, "rx": 18, "ry": 21},
]
MOUTH_BOX = (418, 342, 536, 420)
BROW_BOXES = [((336, 198, 428, 264), (380, 226)), ((480, 178, 562, 228), (520, 200))]  # khung + điểm mốc


def dist(rgb: np.ndarray, color: tuple[int, int, int]) -> np.ndarray:
    return np.sqrt(((rgb - np.array(color, dtype=float)) ** 2).sum(-1))


def to_img(mask: np.ndarray) -> Image.Image:
    return Image.fromarray((mask * 255).astype(np.uint8), "L")


def dilate(mask: np.ndarray, px: int) -> np.ndarray:
    return np.array(to_img(mask).filter(ImageFilter.MaxFilter(px * 2 + 1))) > 127


def component(mask: np.ndarray, seed: tuple[int, int]) -> np.ndarray:
    """Vùng liên thông của `mask` chứa điểm `seed`."""
    # Floodfill của Pillow chỉ chạy ổn trên ảnh RGB.
    img = to_img(mask).convert("RGB")
    if img.getpixel(seed) != (255, 255, 255):
        raise SystemExit(f"Điểm mốc {seed} không nằm trong vùng cần tách")
    ImageDraw.floodfill(img, seed, (128, 0, 0))
    return np.array(img)[..., 0] == 128


def fill_holes(mask: np.ndarray) -> np.ndarray:
    padded = np.pad(mask, 1)
    outside = component(~padded, (0, 0))
    return ~outside[1:-1, 1:-1]


def smooth_disc(w: int, h: int, center: tuple[int, int], r: float) -> np.ndarray:
    """Hình tròn khử răng cưa (độ phủ 0-1)."""
    k = 4
    img = Image.new("L", (w * k, h * k), 0)
    cx, cy = center
    ImageDraw.Draw(img).ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=255)
    return np.array(img.resize((w, h), Image.LANCZOS)).astype(float) / 255


def nearest(rgb: np.ndarray, target: tuple[int, int, int], others: list[tuple[int, int, int]]) -> np.ndarray:
    d = dist(rgb, target)
    return np.all([d < dist(rgb, o) for o in others], axis=0)


def main() -> None:
    im = np.array(Image.open(SRC).convert("RGBA")).astype(float)
    h, w = im.shape[:2]
    rgb, alpha = im[..., :3], im[..., 3]
    ys, xs = np.mgrid[0:h, 0:w]

    # 1. Dọn các chấm lẻ còn sót khi tách nền; nền gần như đặc → đặc hẳn.
    main_part = component(alpha > 24, (CENTER_X, 700))
    keep = dilate(main_part, 4) & (alpha >= 8)
    alpha = np.where(keep, alpha, 0)
    alpha = np.where(alpha >= 248, 255, alpha)
    visible = alpha > 0

    # 2. Đầu: mọi thứ phía trên cằm (trừ bàn tay đang giơ), cộng phần da mặt sát cằm.
    near_chin = (ys >= 448) & (ys < 464) & (xs > 360) & (xs < 540) & nearest(rgb, SKIN, [NECK, TEAL, TEAL_DARK]) & (dist(rgb, SKIN) < 30)
    head = visible & (((ys < 448) & (xs < 690)) | near_chin)

    # 3. Cẳng tay + bàn tay đang giơ.
    region = (xs >= 585) & (ys >= 395) & (ys <= 705) & ~head
    arm_up = region & visible & nearest(rgb, SKIN, [TEAL, TEAL_DARK])
    arm_up = fill_holes(component(arm_up, (760, 500)))

    # 4. Tay buông bên trái ảnh (cả nếp ngón tay tối màu bên trong).
    region = (xs <= 340) & (ys >= 600) & (ys <= 1045)
    arm_down = region & visible & nearest(rgb, SKIN, [TEAL, TEAL_DARK, PANTS, CUFF])
    arm_down = fill_holes(component(arm_down, (250, 800)))

    # Viền mờ (bán trong suốt) đi theo bộ phận đặc nằm sát nó.
    edge = visible & (alpha < 248) & ~head & ~arm_up & ~arm_down
    arm_up |= edge & dilate(arm_up, 3) & (xs >= 585)
    arm_down |= edge & dilate(arm_down, 3) & ~arm_up & (xs <= 340)
    body = visible & ~head & ~arm_up & ~arm_down

    rgba = np.dstack([rgb, alpha])

    def layer(mask: np.ndarray) -> np.ndarray:
        out = rgba.copy()
        out[..., 3] = np.where(mask, alpha, 0)
        return out

    def paint(arr: np.ndarray, mask: np.ndarray, color: tuple[int, int, int]) -> None:
        arr[mask, :3] = color
        arr[mask, 3] = 255

    head_l, body_l, up_l, down_l = layer(head), layer(body), layer(arm_up), layer(arm_down)
    avatar_l = head_l.copy()  # đầu nguyên vẹn (cả miệng, lông mày) cho logo góc video
    body_opaque = body_l[..., 3] > 200

    # Phần che khuất (chỉ lộ ra khi bộ phận xoay): cổ dưới đầu, khuỷu tay và bắp tay trong tay áo.
    neck_fill = (xs >= 400) & (xs <= 494) & (ys >= 412) & (ys <= 462) & (body_l[..., 3] == 0)
    paint(body_l, neck_fill, NECK)

    # Tay nằm sau thân: kéo dài thêm vài pixel dưới áo để chỗ giáp nhau không lộ đường kẽ.
    paint(up_l, dilate(arm_up, 3) & body_opaque & ~arm_up, SKIN)
    # Khuỷu tay là một hình tròn quanh khớp xoay: cẳng tay xoay tới đâu khuỷu vẫn tròn, liền.
    disc = smooth_disc(w, h, ELBOW, ELBOW_R)
    up_l[..., :3] = np.where((up_l[..., 3:] > 0) & (disc[..., None] < 1), up_l[..., :3], SKIN)
    up_l[..., 3] = np.maximum(up_l[..., 3], disc * 255)

    upper = to_img(np.zeros((h, w), bool))
    ImageDraw.Draw(upper).polygon([(234, 700), (322, 700), (318, 575), (258, 575)], fill=255)
    hidden_down = ((np.array(upper) > 0) | dilate(arm_down, 3)) & body_opaque & ~arm_down
    paint(down_l, hidden_down, SKIN)

    # 5. Miệng và lông mày tách khỏi đầu để đổi biểu cảm; chỗ cũ tô màu da.
    x0, y0, x1, y1 = MOUTH_BOX
    box = (xs >= x0) & (xs < x1) & (ys >= y0) & (ys < y1)
    mouth = fill_holes(component(box & head & (dist(rgb, SKIN) > 34), (470, 384)))
    mouth = dilate(mouth, 1) & box
    mouth_l = layer(mouth)
    paint(head_l, dilate(mouth, 1) & box, SKIN)

    brows = []
    for (bx0, by0, bx1, by1), seed in BROW_BOXES:
        box = (xs >= bx0) & (xs < bx1) & (ys >= by0) & (ys < by1)
        cand = box & head & (dist(rgb, SKIN) > 34)
        brow = dilate(component(cand, seed), 1) & box
        brows.append(layer(brow))
        paint(head_l, dilate(brow, 1) & box, SKIN)

    OUT.mkdir(parents=True, exist_ok=True)
    parts = {}
    for name, arr in [
        ("arm-down", down_l),
        ("arm-up", up_l),
        ("body", body_l),
        ("head", head_l),
        ("avatar", avatar_l),
        ("mouth", mouth_l),
        ("brow-left", brows[0]),
        ("brow-right", brows[1]),
    ]:
        a = arr[..., 3] > 0
        rows, cols = np.where(a.any(1))[0], np.where(a.any(0))[0]
        y0, y1, x0, x1 = int(rows[0]), int(rows[-1]) + 1, int(cols[0]), int(cols[-1]) + 1
        crop = arr[y0:y1, x0:x1].round().clip(0, 255).astype(np.uint8)
        # Pixel trong suốt hoàn toàn: đưa về 0 để PNG nén tốt hơn.
        crop[crop[..., 3] == 0] = 0
        Image.fromarray(crop, "RGBA").save(OUT / f"{name}.png", optimize=True)
        parts[name] = {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}

    rig = {
        "parts": parts,
        "neck": NECK_PIVOT,
        "elbow": ELBOW,
        "shoulder": SHOULDER,
        "feetY": FEET_Y,
        "centerX": CENTER_X,
        "top": int(np.where(visible.any(1))[0][0]),
        "eyes": EYES,
        "mouthTop": {"x0": 430, "y0": 367, "x1": 520, "y1": 355},
        "colors": {"skin": "#FD957D", "shirt": "#00B6B7", "pants": "#483081", "hair": "#1D285E", "mouth": "#9C1B26", "tongue": "#DF3E44", "pupil": "#1C1B32"},
    }
    RIG.write_text(
        "// File sinh tự động bởi assets/mascot/split.py — không sửa tay.\n"
        "// Tọa độ tính bằng pixel của ảnh linh vật gốc (assets/mascot/source.png).\n"
        f"export const MASCOT_RIG = {json.dumps(rig, indent=2, ensure_ascii=False)} as const;\n",
        encoding="utf-8",
    )
    for name, p in parts.items():
        size = (OUT / f"{name}.png").stat().st_size // 1024
        print(f"{name:11s} {p['w']}x{p['h']} @ ({p['x']},{p['y']})  {size} KB")


if __name__ == "__main__":
    main()
