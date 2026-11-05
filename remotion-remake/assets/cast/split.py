"""Cắt ảnh nhân vật phụ (assets/cast/<id>/source.png) thành bộ phận để Remotion làm hoạt hình.

Mỗi nhân vật có một file cấu hình assets/cast/<id>/rig.json (vùng của từng bộ phận, khớp xoay,
mắt, miệng, lông mày). Chỉ chạy khi thêm hoặc thay ảnh nhân vật, không chạy lúc dựng video.
Cần Python 3 + Pillow + numpy:
    python assets/cast/split.py            # mọi nhân vật
    python assets/cast/split.py mai        # một nhân vật

Kết quả:
  public/fedtoon/cast/<id>/*.png  — từng bộ phận, giữ nguyên nét vẽ gốc
  src/fedtoon/cast-rigs.ts        — vị trí bộ phận, khớp xoay, mắt, miệng (file sinh tự động)

Cấu hình rig.json:
  classes   nhóm màu {tên: [mã màu, ...]}; mỗi pixel thuộc nhóm có màu gần nó nhất
  parts     bộ phận theo thứ tự ưu tiên: {name, regions: [{polygon, classes?}]}; phần còn lại là "body"
  erase     [{part, polygon}] vùng xoá khỏi một bộ phận (mẩu nhọn lộ ra khi cử động)
  fills     phần bị che (chỉ lộ ra khi bộ phận xoay): {part, color, disc: [x, y, r]} | {part, color, polygon, under}
            | {part, color, dilate: px, into: part}
  head      {pivot}; arms [{side, kind: raised|hanging, segments: [{part, pivot}]}] (đoạn sau nằm trong đoạn trước)
  order     thứ tự vẽ từ sau ra trước: tên bộ phận, "arm:<i>" hoặc "head"
  face      {skin, mouth: {box, seed, top}, brows: [{box, seed}], eyes: [{cx, cy, rx, ry}]}
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / "public" / "fedtoon" / "cast"
RIGS = ROOT / "src" / "fedtoon" / "cast-rigs.ts"


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def dist(rgb: np.ndarray, color: str) -> np.ndarray:
    return np.sqrt(((rgb - np.array(hex_rgb(color), dtype=float)) ** 2).sum(-1))


def to_img(mask: np.ndarray) -> Image.Image:
    return Image.fromarray((mask * 255).astype(np.uint8), "L")


def dilate(mask: np.ndarray, px: int) -> np.ndarray:
    return np.array(to_img(mask).filter(ImageFilter.MaxFilter(px * 2 + 1))) > 127


def component(mask: np.ndarray, seed: list[int]) -> np.ndarray:
    """Vùng liên thông của `mask` chứa điểm `seed` (floodfill của Pillow chỉ ổn trên ảnh RGB)."""
    img = to_img(mask).convert("RGB")
    if img.getpixel(tuple(seed)) != (255, 255, 255):
        raise SystemExit(f"Điểm mốc {seed} không nằm trong vùng cần tách")
    ImageDraw.floodfill(img, tuple(seed), (128, 0, 0))
    return np.array(img)[..., 0] == 128


def fill_holes(mask: np.ndarray) -> np.ndarray:
    padded = np.pad(mask, 1)
    outside = component(~padded, [0, 0])
    return ~outside[1:-1, 1:-1]


def polygon(w: int, h: int, points: list[list[float]]) -> np.ndarray:
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).polygon([tuple(p) for p in points], fill=255)
    return np.array(img) > 0


def smooth_disc(w: int, h: int, x: float, y: float, r: float) -> np.ndarray:
    """Hình tròn khử răng cưa (độ phủ 0-1)."""
    k = 4
    img = Image.new("L", (w * k, h * k), 0)
    ImageDraw.Draw(img).ellipse([(x - r) * k, (y - r) * k, (x + r) * k, (y + r) * k], fill=255)
    return np.array(img.resize((w, h), Image.LANCZOS)).astype(float) / 255


def split(cid: str, done: dict) -> dict:
    cfg = json.loads((HERE / cid / "rig.json").read_text(encoding="utf-8"))
    im = np.array(Image.open(HERE / cid / "source.png").convert("RGBA")).astype(float)
    h, w = im.shape[:2]
    rgb, alpha = im[..., :3], im[..., 3]

    # Dọn chấm lẻ còn sót khi tách nền; nền gần như đặc → đặc hẳn.
    main = component(alpha > 24, cfg["seed"])
    alpha = np.where(dilate(main, 4) & (alpha >= 8), alpha, 0)
    alpha = np.where(alpha >= 248, 255, alpha)
    visible = alpha > 0
    solid = alpha > 200

    # Nhóm màu của từng pixel: nhóm có màu gần nhất.
    names, colors = [], []
    for name, hexes in cfg["classes"].items():
        for c in hexes:
            names.append(name)
            colors.append(c)
    nearest = np.argmin(np.stack([dist(rgb, c) for c in colors]), axis=0)
    cls = np.array(names)[nearest]

    taken = np.zeros((h, w), bool)
    masks: dict[str, np.ndarray] = {}
    for part in cfg["parts"]:
        m = np.zeros((h, w), bool)
        for region in part["regions"]:
            r = polygon(w, h, region["polygon"]) & visible & ~taken
            if "classes" in region:
                r &= np.isin(cls, region["classes"])
            m |= r
        if "seed" in part:
            m = component(m, part["seed"])
        m = fill_holes(m) & visible & ~taken if part.get("fillHoles", True) else m
        masks[part["name"]] = m
        taken |= m
    # Viền mờ (bán trong suốt) đi theo bộ phận đặc nằm sát nó.
    edge = visible & (alpha < 248)
    for part in cfg["parts"]:
        m = masks[part["name"]]
        extra = edge & ~taken & dilate(m, 3)
        masks[part["name"]] = m | extra
        taken |= extra
    # Tay có tư thế nghỉ (xoay nhiều quanh vai): phần gốc tay phía thân, ngoài vòng khớp, để lại
    # cho thân áo; nếu không, khi hạ tay phần gốc đó lòi ra thành gợn trên vai.
    xs_, ys_ = np.meshgrid(np.arange(w), np.arange(h))
    for arm in cfg["arms"]:
        if "rest" not in arm and not arm.get("trim"):
            continue
        seg = arm["segments"][0]
        disc = next((f["disc"] for f in cfg.get("fills", []) if f.get("part") == seg["part"] and "disc" in f), None)
        if not disc:
            continue
        px, py = seg["pivot"]
        m = masks[seg["part"]]
        cy_, cx_ = np.argwhere(m).mean(0)
        ax, ay = cx_ - px, cy_ - py
        norm = max(1e-6, (ax * ax + ay * ay) ** 0.5)
        proj = ((xs_ - px) * ax + (ys_ - py) * ay) / norm
        far = (xs_ - px) ** 2 + (ys_ - py) ** 2 > disc[2] ** 2
        moved = m & (proj < 0) & far
        masks[seg["part"]] = m & ~moved
        taken &= ~moved
    masks["body"] = visible & ~taken

    rgba = np.dstack([rgb, alpha])
    layers = {}
    for name, m in masks.items():
        arr = rgba.copy()
        arr[..., 3] = np.where(m, alpha, 0)
        layers[name] = arr

    def paint(name: str, where: np.ndarray, color: str, cover: np.ndarray | float = 1.0, force: bool = False) -> None:
        """Tô màu vào chỗ trống của bộ phận (force: tô đè cả chỗ đã có hình)."""
        arr = layers[name]
        cov = np.where(where, cover, 0.0)
        a = arr[..., 3] / 255
        new_a = np.maximum(a, cov)
        keep = ((a >= cov) & ~(force & where))[..., None]
        arr[..., :3] = np.where(keep, arr[..., :3], np.array(hex_rgb(color), dtype=float))
        arr[..., 3] = new_a * 255

    for f in cfg.get("fills", []):
        if "disc" in f:
            x, y, r = f["disc"]
            d = smooth_disc(w, h, x, y, r)
            # Lúc đứng yên, vòng khớp phải nằm gọn sau (hoặc trùng) các bộ phận trong "within".
            hidden = np.any([masks[n] & solid for n in f.get("within", [f["part"]])], axis=0)
            outside = (d > 0.5) & ~hidden
            if outside.sum() > 20:
                print(f"  ! {cid}: vòng khớp {f['disc']} lòi ra ngoài {int(outside.sum())} px")
            paint(f["part"], d > 0, f["color"], d)
        elif "dilate" in f:
            src = masks[f["part"]]
            paint(f["part"], dilate(src, f["dilate"]) & ~src & (layers[f["into"]][..., 3] > 200), f["color"])
        else:
            where = polygon(w, h, f["polygon"]) & (layers[f["part"]][..., 3] < 250) & solid
            if "under" in f:
                where &= masks[f["under"]] | dilate(masks[f["under"]], 2)
            paint(f["part"], where, f["color"])

    # Đường viền giữa tay áo và thân áo: tách thành lớp riêng "<đoạn tay>-seam" để chỉ hiện khi tay
    # nép sát thân (Remotion ẩn nó khi tay đưa ra); chỗ cũ trên tay và thân tô màu áo.
    xs, ys = np.meshgrid(np.arange(w), np.arange(h))
    arms_out = []
    for arm in cfg["arms"]:
        segs = []
        for seg in arm["segments"]:
            seam = seg.get("seam")
            seg = {k: v for k, v in seg.items() if k != "seam"}
            if seam:
                region = polygon(w, h, seam["polygon"]) & visible
                line = region & (dist(rgb, seam["color"]) < 70)
                cut = dilate(line, 2) & region
                arr = rgba.copy()
                arr[..., 3] = np.where(cut, alpha, 0)
                name = f"{seg['part']}-seam"
                layers[name] = arr
                for other in list(layers):
                    if other != name and other != "head" and not other.endswith("-seam"):
                        paint(other, cut & (layers[other][..., 3] > 0), cfg["colors"]["shirt"], force=True)
                # Mép trong của tay áo khi tay đưa ra: thẳng và mượt theo tâm đường viền (khử răng cưa),
                # không còn mẩu viền hay mẩu thân áo dính theo tay.
                ys_, xs_ = np.nonzero(line)
                rows = np.unique(ys_)
                spans = np.array([np.ptp(xs_[ys_ == r]) + 1 for r in rows])
                centers = np.array([xs_[ys_ == r].mean() for r in rows])
                straight = spans <= 1.5 * np.median(spans)
                slope, icpt = np.polyfit(rows[straight], centers[straight], 1)
                arm_layer = layers[seg["part"]]
                side = 1 if np.argwhere(masks["body"]).mean(0)[1] > np.argwhere(masks[seg["part"]]).mean(0)[1] else -1
                d = (xs - (slope * ys + icpt)) * side / np.sqrt(1 + slope * slope)
                keep = np.clip(0.5 - d, 0, 1)
                near = dilate(region, 6)
                arm_layer[..., 3] = np.where(near, arm_layer[..., 3] * keep, arm_layer[..., 3])
                # Thân áo phủ kín tới tâm đường viền (phần bù của tay), để khi viền ẩn không lộ khe.
                body_cover = np.clip(0.5 + d, 0, 1)
                paint("body", near & solid & (body_cover > 0) & (d > -12), cfg["colors"]["shirt"], body_cover, force=True)
                px, py = seg["pivot"]
                seg["seam"] = {"part": name, "reach": int(np.sqrt((xs_ - px) ** 2 + (ys_ - py) ** 2).max())}
            segs.append(seg)
        arms_out.append({**arm, "segments": segs})

    # Xoá tay những mẩu nhỏ không đẹp khi bộ phận cử động (vd. góc nhọn của tay áo).
    for e in cfg.get("erase", []):
        layers[e["part"]][..., 3] = np.where(polygon(w, h, e["polygon"]), 0, layers[e["part"]][..., 3])

    # Miệng và lông mày tách khỏi đầu để đổi biểu cảm; chỗ cũ tô màu da.
    face = cfg["face"]
    xs, ys = np.meshgrid(np.arange(w), np.arange(h))
    head = masks["head"]

    def cut_feature(name: str, box: list[int], seed: list[int]) -> None:
        x0, y0, x1, y1 = box
        inside = (xs >= x0) & (xs < x1) & (ys >= y0) & (ys < y1)
        m = fill_holes(component(inside & head & (dist(rgb, face["skin"]) > 34), seed))
        m = dilate(m, 1) & inside
        arr = rgba.copy()
        arr[..., 3] = np.where(m, alpha, 0)
        layers[name] = arr
        paint("head", dilate(m, 1) & inside, face["skin"], force=True)

    cut_feature("mouth", face["mouth"]["box"], face["mouth"]["seed"])
    mouth_top = face["mouth"]["top"]
    mf = cfg.get("mouthFrom")
    if mf:
        # Miệng lấy từ ảnh khác của cùng nhân vật (vd. miệng cười của ảnh chính cho ảnh vẫy tay):
        # thu phóng, xoay theo góc mặt rồi đặt vào tâm `center`; miệng gốc của ảnh này đã bị xoá.
        src = done[mf["rig"]]
        sp = src["parts"]["mouth"]
        k, ang = mf["scale"], mf["angle"]
        mimg = Image.open(OUT / mf["rig"] / "mouth.png").convert("RGBA")
        mimg = mimg.resize((round(mimg.width * k), round(mimg.height * k)), Image.LANCZOS).rotate(-ang, resample=Image.BICUBIC, expand=True)
        cx, cy = mf["center"]
        x0, y0 = round(cx - mimg.width / 2), round(cy - mimg.height / 2)
        arr = np.zeros((h, w, 4))
        arr[y0 : y0 + mimg.height, x0 : x0 + mimg.width] = np.array(mimg).astype(float)
        layers["mouth"] = arr
        scx, scy = sp["x"] + sp["w"] / 2, sp["y"] + sp["h"] / 2
        th = np.radians(ang)

        def tf(px: float, py: float) -> list[float]:
            dx, dy = (px - scx) * k, (py - scy) * k
            return [round(cx + dx * np.cos(th) - dy * np.sin(th), 1), round(cy + dx * np.sin(th) + dy * np.cos(th), 1)]

        t = src["mouthTop"]
        mouth_top = tf(t[0], t[1]) + tf(t[2], t[3])
    for i, b in enumerate(face["brows"]):
        cut_feature(f"brow-{i}", b["box"], b["seed"])

    out = OUT / cid
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    parts = {}
    for name, arr in layers.items():
        a = arr[..., 3] > 0
        if not a.any():
            continue
        rows, cols = np.where(a.any(1))[0], np.where(a.any(0))[0]
        y0, y1, x0, x1 = int(rows[0]), int(rows[-1]) + 1, int(cols[0]), int(cols[-1]) + 1
        crop = arr[y0:y1, x0:x1].round().clip(0, 255).astype(np.uint8)
        crop[crop[..., 3] == 0] = 0
        Image.fromarray(crop, "RGBA").save(out / f"{name}.png", optimize=True)
        parts[name] = {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}
        print(f"  {name:16s} {x1 - x0}x{y1 - y0} @ ({x0},{y0})  {(out / f'{name}.png').stat().st_size // 1024} KB")

    feet = int(np.where(solid.any(1))[0][-1])
    top = int(np.where(solid.any(1))[0][0])
    return {
        "dir": f"fedtoon/cast/{cid}",
        "units": cfg["units"],
        "feetY": feet,
        "top": top,
        "centerX": cfg["centerX"],
        "parts": parts,
        "head": cfg["head"],
        "arms": arms_out,
        "order": cfg["order"],
        "eyes": face["eyes"],
        "mouthTop": mouth_top,
        "brows": [f"brow-{i}" for i in range(len(face["brows"]))],
        "colors": cfg["colors"],
        **{k: cfg[k] for k in ("lid", "drawnAction", "mouthStyle", "poses", "shoulderShare", "elbowRange") if k in cfg},
    }


def main() -> None:
    ids = sys.argv[1:] or sorted(p.name for p in HERE.iterdir() if (p / "rig.json").exists())
    existing = {}
    if RIGS.exists() and sys.argv[1:]:
        text = RIGS.read_text(encoding="utf-8")
        existing = json.loads(text[text.index("= {") + 2 : text.rindex("}") + 1])
    for cid in ids:
        print(cid)
        existing[cid] = split(cid, existing)
    RIGS.write_text(
        "// File sinh tự động bởi assets/cast/split.py — không sửa tay.\n"
        "// Tọa độ tính bằng pixel của ảnh gốc assets/cast/<id>/source.png.\n"
        'import type { CharacterRig } from "./rig";\n\n'
        f"export const CAST_RIGS: Record<string, CharacterRig> = {json.dumps(existing, indent=2, ensure_ascii=False)};\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
