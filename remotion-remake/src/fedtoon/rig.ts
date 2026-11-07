// Characters animated from a drawing (Fed and the side characters drawn by the
// channel owner): the picture is cut into parts that move around joints, so the
// original art is kept. Fed's rig comes from assets/mascot/split.py, the side
// characters' from assets/cast/split.py (src/fedtoon/cast-rigs.ts).
import { castKey } from "./cast";
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
  /**
   * "raised": an arm held up in the drawing (its last segment waves); "hanging": an arm along the body.
   * `rest`/`point`: angles per segment (degrees, positive lifts the hand) from the drawn pose to an arm
   * at rest / pointing, for arms drawn in a pose that does not suit every action (default: as drawn).
   * A segment marked `front` is drawn with "arm:<i>:front" (e.g. a hand in front of the face).
   */
  arms: readonly {
    side: "left" | "right";
    kind: "raised" | "hanging";
    /**
     * `seam`: the dark line where the sleeve meets the body, drawn by "arm:<i>:seam" over the body and
     * only while the sleeve stays against the body (`reach` = its farthest pixel from the pivot).
     */
    segments: readonly {
      part: string;
      pivot: Pt;
      front?: boolean;
      seam?: { part: string; reach: number };
      /**
       * Outlined characters: the body's own copy of the line between arm and body (`body`, drawn by
       * "arm:<i>:bodyline", stays with the body) and a line added along the arm where the drawing has
       * none (`arm`, moves with the arm, shown only once the arm has left the body).
       */
      away?: { body?: string; arm?: string; reach: number };
    }[];
    rest?: readonly number[];
    point?: readonly number[];
    /** Shoulder side of the first segment left to the body, outside its joint disc (assets/cast/split.py). */
    trim?: boolean;
    /** Rounded shoulder [cx, cy, rx, ry] in the shirt color, shown while the arm is away from its drawn pose. */
    cap?: readonly number[];
  }[];
  /** The action(s) the drawing shows (its raised arms keep the drawn pose for them). */
  drawnAction?: string | readonly string[];
  /** Share of a raised arm's lift done at the shoulder (default 1); the rest goes to the elbow (fewer seams at the shoulder). */
  shoulderShare?: number;
  /** Allowed lift (degrees) of a raised arm's elbow: lowering the forearm too far opens a notch at the elbow crease. */
  elbowRange?: readonly number[];
  /** Other drawings of the same character for some actions, e.g. { wave: "man-wave" } (ids in CAST_RIGS). */
  poses?: Record<string, string>;
  /**
   * Drawing order, back to front: part names, "out:<part>" (drawn only while the arms swing away from the body, e.g. the
   * hoodie hem the hands hide at rest), "arm:<index>", "arm:<index>:front", "arm:<index>:seam", "arm:<index>:bodyline"
   * or "head" (head, brows, mouth, eyelids).
   */
  order: readonly string[];
  /** The expression of the drawn mouth and whether it is open (an open mouth is reused for speech). Default: an open smile. */
  mouthStyle?: { drawn: string; open: boolean };
  /** Expression of the drawn brows and eyes (default "neutral"): other expressions move the brows/lids relative to it. */
  faceBase?: string;
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

/** The drawn rig of a cast member (Fed, or a recurring side character with a picture), for `action` if it has its own drawing. */
export function rigFor(member: { kind: string; id: string }, action?: string): CharacterRig | undefined {
  const rig = member.kind === "mascot" ? FED_RIG : CAST_RIGS[castKey(member.id)];
  const pose = action ? rig?.poses?.[action] : undefined;
  return (pose && CAST_RIGS[pose]) || rig;
}

/** Whether `action` is one the drawing itself shows. */
export const isDrawnAction = (rig: CharacterRig, action: string) =>
  Array.isArray(rig.drawnAction) ? rig.drawnAction.includes(action) : rig.drawnAction === action;
