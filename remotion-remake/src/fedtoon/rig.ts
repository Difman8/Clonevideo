// Characters animated from a drawing (Fed and the side characters drawn by the
// channel owner): the picture is cut into parts that move around joints, so the
// original art is kept. Fed's rig comes from assets/mascot/split.py, the side
// characters' from assets/cast/split.py (src/fedtoon/cast-rigs.ts).
import { CAST_RIGS } from "./cast-rigs";
import { MASCOT_RIG } from "./mascot-rig";

type Box = { x: number; y: number; w: number; h: number };
type Pt = readonly number[];

export type CharacterRig = {
  /** Folder of the part images inside public/. */
  dir: string;
  /** Height in the 380-unit puppet box (code-drawn people are ~320). */
  units: number;
  feetY: number;
  top: number;
  centerX: number;
  parts: Record<string, Box>;
  head: { pivot: Pt };
  /** "raised": the arm held up in the drawing (its last segment waves); "hanging": the arm along the body. */
  arms: readonly { side: "left" | "right"; kind: "raised" | "hanging"; segments: readonly { part: string; pivot: Pt }[] }[];
  /** Drawing order, back to front: part names, "arm:<index>" or "head" (head, brows, mouth, eyelids). */
  order: readonly string[];
  eyes: readonly { cx: number; cy: number; rx: number; ry: number }[];
  /** Top lip of the open mouth (x0, y0, x1, y1): the mouth part closes toward it. */
  mouthTop: Pt;
  /** [left, right] brow parts. */
  brows: readonly string[];
  colors: { skin: string; mouth: string; tongue: string; pupil: string; [name: string]: string };
  /** Eyelids: how far past the eye they reach (px) and whether their edge is drawn as a dark line (eyes drawn with an outline). */
  lid?: { margin: number; line: boolean };
};

export const FED_RIG: CharacterRig = {
  dir: "fedtoon/mascot",
  units: 330,
  feetY: MASCOT_RIG.feetY,
  top: MASCOT_RIG.top,
  centerX: MASCOT_RIG.centerX,
  parts: MASCOT_RIG.parts,
  head: { pivot: MASCOT_RIG.neck },
  arms: [
    { side: "left", kind: "hanging", segments: [{ part: "arm-down", pivot: MASCOT_RIG.shoulder }] },
    { side: "right", kind: "raised", segments: [{ part: "arm-up", pivot: MASCOT_RIG.elbow }] },
  ],
  order: ["arm:0", "arm:1", "body", "head"],
  eyes: MASCOT_RIG.eyes,
  mouthTop: [MASCOT_RIG.mouthTop.x0, MASCOT_RIG.mouthTop.y0, MASCOT_RIG.mouthTop.x1, MASCOT_RIG.mouthTop.y1],
  brows: ["brow-left", "brow-right"],
  colors: MASCOT_RIG.colors,
};

/** The drawn rig of a cast member: Fed, or a recurring side character with a picture. */
export function rigFor(member: { kind: string; id: string }): CharacterRig | undefined {
  return member.kind === "mascot" ? FED_RIG : CAST_RIGS[member.id.toLowerCase()];
}
