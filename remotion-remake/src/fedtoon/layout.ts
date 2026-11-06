// Where props and characters sit in the frame. Shared by the Remotion composition
// and the scene editor, so the clickable boxes on the preview match the video.
import type { Prop, Shot, ShotCharacter } from "../spec/storyboard";

const POS_X: Record<string, number> = { "far-left": 0.14, left: 0.3, center: 0.5, right: 0.7, "far-right": 0.86, top: 0.5, bottom: 0.5 };
const PROP_WIDTH = { small: 0.2, medium: 0.3, large: 0.42 };
/** Character box height as a share of the frame height. */
const CHARACTER_HEIGHT = {
  vertical: { small: 0.29, medium: 0.39, large: 0.52 },
  horizontal: { small: 0.36, medium: 0.5, large: 0.66 },
};

/** Center (x, y) and side of a prop, in pixels. */
export function propBox(prop: Prop, width: number, height: number) {
  return {
    x: POS_X[prop.position] * width,
    y: (prop.position === "top" ? 0.24 : prop.position === "bottom" ? 0.62 : 0.4) * height,
    size: PROP_WIDTH[prop.scale] * width,
  };
}

/** Center x, feet line and height of a character, in pixels. */
export function characterBox(ch: ShotCharacter, width: number, height: number) {
  const vertical = height >= width;
  const h = CHARACTER_HEIGHT[vertical ? "vertical" : "horizontal"][ch.scale] * height;
  // Puppet width is h * 200/380: keep the whole figure inside the frame.
  const halfWidth = h * (100 / 380);
  const x = Math.min(width - halfWidth, Math.max(halfWidth, POS_X[ch.position] * width));
  // Subjects sit around the middle of the frame; subtitles go below their feet.
  return { x, feet: height * (vertical ? 0.8 : 0.9), h, halfWidth };
}

export type LayerBox = { left: number; top: number; width: number; height: number };

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
