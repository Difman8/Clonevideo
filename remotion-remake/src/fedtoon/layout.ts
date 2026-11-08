// Where props and characters sit in the frame. Shared by the Remotion composition
// and the scene editor, so the clickable boxes on the preview match the video.
import type { Placement, Prop, Shot, ShotCharacter } from "../spec/storyboard";

const POS_X: Record<string, number> = { "far-left": 0.14, left: 0.3, center: 0.5, right: 0.7, "far-right": 0.86, top: 0.5, bottom: 0.5 };
const PROP_WIDTH = { small: 0.2, medium: 0.3, large: 0.42 };
/** Character box height as a share of the frame height. */
const CHARACTER_HEIGHT = {
  vertical: { small: 0.29, medium: 0.39, large: 0.52 },
  horizontal: { small: 0.36, medium: 0.5, large: 0.66 },
};

/** Center (x, y) and side of a prop, in pixels: where it was dragged in the scene editor, or its named position. */
export function propBox(prop: Prop, width: number, height: number) {
  const size = PROP_WIDTH[prop.scale] * width;
  if (prop.at) return { x: prop.at.x * width, y: prop.at.y * height, size };
  return {
    x: POS_X[prop.position] * width,
    y: (prop.position === "top" ? 0.24 : prop.position === "bottom" ? 0.62 : 0.4) * height,
    size,
  };
}

/** Center x, feet line and height of a character, in pixels. */
export function characterBox(ch: ShotCharacter, width: number, height: number) {
  const vertical = height >= width;
  const h = CHARACTER_HEIGHT[vertical ? "vertical" : "horizontal"][ch.scale] * height;
  // Puppet width is h * 200/380: keep the whole figure inside the frame.
  const halfWidth = h * (100 / 380);
  // Dragged in the scene editor: exactly there (partly out of the frame if the owner wants).
  if (ch.at) return { x: ch.at.x * width, feet: ch.at.y * height, h, halfWidth };
  const x = Math.min(width - halfWidth, Math.max(halfWidth, POS_X[ch.position] * width));
  // Subjects sit around the middle of the frame; subtitles go below their feet.
  return { x, feet: height * (vertical ? 0.8 : 0.9), h, halfWidth };
}

export type LayerBox = { left: number; top: number; width: number; height: number };

/** True when the editor cut something off the item. */
export const isCropped = (crop: Placement["crop"]) => !!crop && crop.top + crop.right + crop.bottom + crop.left > 0;

/**
 * CSS clip-path for a cropped item. `box` is the item's box (as the editor shows it) in pixels of the
 * clipped element; a side that is not cut is left far open, so an arm raised above the box still shows.
 */
export function cropClipPath(crop: Placement["crop"], box: LayerBox): string | undefined {
  if (!crop || !isCropped(crop)) return undefined;
  const open = 100000;
  const left = crop.left ? box.left + crop.left * box.width : -open;
  const right = crop.right ? box.left + box.width * (1 - crop.right) : open;
  const top = crop.top ? box.top + crop.top * box.height : -open;
  const bottom = crop.bottom ? box.top + box.height * (1 - crop.bottom) : open;
  return `polygon(${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px)`;
}

/** Boxes of a shot's layers as fractions of the frame, for clicking on a preview. */
export function shotLayers(shot: Shot, width: number, height: number): { props: LayerBox[]; characters: LayerBox[] } {
  return {
    props: shot.props.map((p) => {
      const { x, y, size } = propBox(p, width, height);
      return { left: (x - size / 2) / width, top: (y - size / 2) / height, width: size / width, height: size / height };
    }),
    characters: shot.characters.map((c) => {
      const { x, feet, h, halfWidth } = characterBox(c, width, height);
      return { left: (x - halfWidth) / width, top: (feet - h) / height, width: (2 * halfWidth) / width, height: h / height };
    }),
  };
}
