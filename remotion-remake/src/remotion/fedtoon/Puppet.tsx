// Fedtoon characters: Fed and the side characters the channel owner drew are
// animated from their drawings (cut into parts); anyone else is drawn in code
// (SVG) in the same style, consistent in every video and fully animatable.
import React from "react";
import { Img, staticFile } from "remotion";
import { HAIR_COLORS, PALETTE, SKIN } from "../../fedtoon/brand";
import { isDrawnAction, rigFor, type CharacterRig } from "../../fedtoon/rig";
import type { CastMember, ShotCharacter } from "../../spec/storyboard";

type Action = ShotCharacter["action"];
type Expression = ShotCharacter["expression"];

export type PuppetProps = {
  member: CastMember;
  action: Action;
  expression: Expression;
  facing: ShotCharacter["facing"];
  /** Seconds since the shot started (drives every motion). */
  t: number;
  /** 0 (closed) → 1 (wide open): lip-sync from the voice clip. */
  mouth: number;
  /** Height of the character in pixels. */
  height: number;
  /** Per-character offset so two characters never blink or bob in sync. */
  seed?: number;
};

// ---------- color helpers ----------
function mix(hex: string, target: string, amount: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex);
  const b = p(target);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0")).join("")}`;
}
const shade = (hex: string, k = 0.22) => mix(hex, "#0A1024", k);
const light = (hex: string, k = 0.3) => mix(hex, "#FFFFFF", k);

const wave = (t: number, hz: number, phase = 0) => Math.sin((t * hz + phase) * Math.PI * 2);

/** Blink: eyes close for ~0.12 s every 3-4.5 s. */
function blink(t: number, seed: number) {
  const period = 3.2 + (seed % 5) * 0.3;
  const x = (t + seed * 0.77) % period;
  return x < 0.12 ? Math.max(0.08, Math.abs(x - 0.06) / 0.06) : 1;
}

/** Arm angles (degrees, 0 = hanging down, positive = raised outward) and elbow bends for each action. */
function arms(action: Action, t: number): { front: number; back: number; frontElbow: number; backElbow: number } {
  switch (action) {
    case "wave":
      return { front: 150 + wave(t, 2.2) * 18, back: 8, frontElbow: 20 + wave(t, 2.2) * 12, backElbow: 0 };
    case "point":
      return { front: 88, back: 8, frontElbow: 0, backElbow: 0 };
    case "walk":
      return { front: wave(t, 1.8) * 26, back: -wave(t, 1.8) * 26, frontElbow: 12, backElbow: 12 };
    case "think":
      return { front: 130, back: 8, frontElbow: 112, backElbow: 0 };
    case "cheer":
      return { front: 118 + wave(t, 2.5) * 8, back: 118 - wave(t, 2.5) * 8, frontElbow: 52, backElbow: 52 };
    case "shrug": {
      const up = Math.max(0, wave(t, 0.9));
      return { front: 40 + up * 16, back: 40 + up * 16, frontElbow: 70, backElbow: 70 };
    }
    case "talk":
      return { front: 26 + wave(t, 0.8) * 12, back: 6, frontElbow: 50 + wave(t, 0.8) * 18, backElbow: 0 };
    default:
      return { front: 5 + wave(t, 0.5) * 2, back: 5 - wave(t, 0.5) * 2, frontElbow: 0, backElbow: 0 };
  }
}

/** Vertical body offset (px in the 200-unit drawing). */
function bob(action: Action, t: number) {
  if (action === "jump") return -Math.max(0, wave(t, 1.1)) * 46;
  if (action === "walk") return -Math.abs(wave(t, 1.8)) * 6;
  if (action === "cheer") return -Math.max(0, wave(t, 2.5)) * 10;
  return wave(t, 0.5) * 1.6;
}

// ---------- people ----------
// Drawn after the channel's character sheet (assets/cast/reference.png): big
// round heads with side ears, large shiny eyes, long-sleeved tops, dark
// trousers and shoes; flat colors, no outlines (only a soft darker edge where
// the near arm crosses the body).

const INK = { pupil: "#060719", brow: "#0E143C", mouth: "#7A0C14", tongue: "#F04950", shoe: "#0A0D21", glasses: "#0B0B10", coat: "#F7F7F6", coatLine: "#ADABB3", pad: "#1E2A6E" };
const PANTS_COLORS: Record<CastMember["pants"], string> = { dark: "#0A1234", jeans: "#122979" };

const HEAD_Y = -252; // face center
const HEAD_SCALE = 1.1; // heads are drawn in a 46x49-radius face space, then scaled
const FACE = { rx: 46, ry: 49 };
const NECK_Y = HEAD_Y + FACE.ry * HEAD_SCALE; // chin, pivot of head tilts

/** Brow offset and rotation (positive lowers the inner end) per expression, [left, right]. */
const BROWS: Record<Expression, [{ dy: number; rot: number }, { dy: number; rot: number }]> = {
  neutral: [{ dy: 0, rot: 0 }, { dy: 0, rot: 0 }],
  happy: [{ dy: -2, rot: -4 }, { dy: -2, rot: -4 }],
  sad: [{ dy: -1, rot: -16 }, { dy: -1, rot: -16 }],
  surprised: [{ dy: -6, rot: 0 }, { dy: -6, rot: 0 }],
  angry: [{ dy: 3, rot: 22 }, { dy: 3, rot: 22 }],
  thinking: [{ dy: -5, rot: -6 }, { dy: 1, rot: 8 }],
};
const LIDS: Record<Expression, number> = { neutral: 0, happy: 0, sad: 0.24, surprised: 0, angry: 0.3, thinking: 0.12 };

/** Face features, drawn relative to the face center. */
const PersonFace: React.FC<{ expression: Expression; mouth: number; eyes: number; look: number; skin: string; lashes: boolean; uid: string }> = ({ expression, mouth, eyes, look, skin, lashes, uid }) => {
  const eyeY = -3;
  const sclera = { rx: 10.5, ry: 12 * (expression === "surprised" ? 1.1 : 1) };
  const closed = eyes < 0.35;
  const lid = closed ? 1 : Math.max(LIDS[expression], 1 - eyes);
  const lookY = expression === "thinking" ? -3 : 1;
  const mx = look * 0.5;
  const talking = mouth > 0.04;
  const openMouth = (w: number, h: number) => {
    const y0 = 21;
    const d = `M ${mx - w} ${y0} Q ${mx} ${y0 + 1.6} ${mx + w} ${y0} C ${mx + w} ${y0 + h * 0.9} ${mx + w * 0.55} ${y0 + h} ${mx} ${y0 + h} C ${mx - w * 0.55} ${y0 + h} ${mx - w} ${y0 + h * 0.9} ${mx - w} ${y0} Z`;
    return (
      <g>
        <clipPath id={`${uid}-m`}>
          <path d={d} />
        </clipPath>
        <path d={d} fill={INK.mouth} />
        <ellipse cx={mx + 1} cy={y0 + h * 0.86} rx={w * 0.62} ry={Math.max(1.2, h * 0.36)} fill={INK.tongue} clipPath={`url(#${uid}-m)`} />
      </g>
    );
  };
  const line = (d: string, width = 2.6) => <path d={d} stroke={INK.mouth} strokeWidth={width} strokeLinecap="round" fill="none" />;
  let mouthEl: React.ReactNode;
  if (talking) mouthEl = openMouth(12, 3 + 12 * Math.min(1, mouth));
  else if (expression === "happy") mouthEl = openMouth(14, 13);
  else if (expression === "surprised")
    mouthEl = (
      <g>
        <ellipse cx={mx} cy={27} rx={5.2} ry={6.8} fill={INK.mouth} />
        <ellipse cx={mx + 0.5} cy={31} rx={3.2} ry={2.2} fill={INK.tongue} />
      </g>
    );
  else if (expression === "sad") mouthEl = line(`M ${mx - 7} ${29} Q ${mx} ${22} ${mx + 7} ${29}`);
  else if (expression === "angry") mouthEl = line(`M ${mx - 7.5} ${29} Q ${mx} ${23} ${mx + 7.5} ${29}`, 3);
  else if (expression === "thinking") mouthEl = line(`M ${mx - 3} ${26} Q ${mx + 3} ${29} ${mx + 8} ${24.5}`);
  else mouthEl = line(`M ${mx - 7} ${24} Q ${mx} ${29} ${mx + 7} ${24}`);
  return (
    <g>
      {[-1, 1].map((side, i) => {
        const ex = side * 18 + look * 0.4;
        const b = BROWS[expression][i];
        const by = eyeY - 17 + b.dy;
        const tilt = expression === "angry" ? -side * 16 : expression === "sad" ? side * 12 : 0;
        const y0 = eyeY - sclera.ry - 2;
        const lidY = y0 + (sclera.ry * 2 + 4) * lid;
        return (
          <g key={side}>
            <clipPath id={`${uid}-e${i}`}>
              <ellipse cx={ex} cy={eyeY} rx={sclera.rx} ry={sclera.ry} />
            </clipPath>
            <g clipPath={`url(#${uid}-e${i})`}>
              <ellipse cx={ex} cy={eyeY} rx={sclera.rx} ry={sclera.ry} fill="#FFFFFF" />
              <circle cx={ex + look * 0.9} cy={eyeY + lookY} r={expression === "surprised" ? 6.2 : 7.4} fill={INK.pupil} />
              <circle cx={ex + look * 0.9 + 2.6} cy={eyeY + lookY - 3} r={2.4} fill="#FFFFFF" />
              {lid > 0.01 && <rect x={ex - 14} y={y0 - 12} width={28} height={lidY - y0 + 12} fill={skin} transform={`rotate(${tilt} ${ex} ${lidY})`} />}
            </g>
            {closed && <path d={`M ${ex - 8.5} ${eyeY + 1} Q ${ex} ${eyeY + 6.5} ${ex + 8.5} ${eyeY + 1}`} stroke={INK.pupil} strokeWidth={2.4} strokeLinecap="round" fill="none" />}
            {lashes && !closed && (
              <path d={`M ${ex + side * 7} ${eyeY - 8.5} L ${ex + side * 11.5} ${eyeY - 12} M ${ex + side * 9.2} ${eyeY - 5} L ${ex + side * 13.6} ${eyeY - 7}`} stroke={INK.pupil} strokeWidth={1.7} strokeLinecap="round" />
            )}
            <path
              d={`M ${ex - 7} ${by + 1.2} Q ${ex} ${by - 3} ${ex + 7} ${by + 1.2}`}
              stroke={INK.brow}
              strokeWidth={expression === "angry" ? 4.4 : 3.4}
              strokeLinecap="round"
              fill="none"
              transform={`rotate(${-side * b.rot} ${ex} ${by})`}
            />
          </g>
        );
      })}
      {mouthEl}
    </g>
  );
};

/** Hair drawn behind the head (long hair, bun, side tufts), relative to the face center. */
const HairBack: React.FC<{ style: CastMember["hair"]; color: string }> = ({ style, color }) => {
  if (style === "long") return <path d="M -52 -6 C -60 -54 -30 -68 0 -68 C 30 -68 60 -54 52 -6 C 60 30 60 62 48 80 C 30 92 -30 92 -48 80 C -60 62 -60 30 -52 -6 Z" fill={color} />;
  if (style === "bun") return <circle cx={3} cy={-62} r={19} fill={color} />;
  if (style === "bald")
    return (
      <g fill={color}>
        {[-1, 1].map((s) => (
          <g key={s}>
            <circle cx={s * 44} cy={-14} r={10} />
            <circle cx={s * 49} cy={-4} r={10} />
            <circle cx={s * 43} cy={-2} r={9} />
          </g>
        ))}
      </g>
    );
  return null;
};

/** Hair (and caps) in front of the head, relative to the face center. */
const HairFront: React.FC<{ style: CastMember["hair"]; color: string; outfit: string }> = ({ style, color, outfit }) => {
  switch (style) {
    case "short":
      return (
        <g fill={color}>
          <path d="M -52 4 C -60 -42 -32 -69 2 -69 C 34 -69 57 -49 51 -10 C 47 -23 38 -30 25 -31 C 10 -32 -4 -26 -16 -33 C -24 -24 -36 -18 -43 -6 C -47 -2 -50 2 -52 4 Z" />
          <path d="M -18 -65 C -30 -78 -18 -86 -7 -71 Z" />
        </g>
      );
    case "long":
    case "bun":
      return <path d="M -50 2 C -55 -44 -28 -63 0 -63 C 28 -63 55 -44 50 2 C 47 -20 35 -33 16 -35 C 0 -36 -14 -30 -22 -24 C -32 -19 -43 -12 -50 2 Z" fill={color} />;
    case "curly":
      return (
        <g fill={color}>
          <path d="M -50 2 C -56 -48 56 -48 50 2 C 46 -22 30 -30 0 -30 C -30 -30 -46 -22 -50 2 Z" />
          {[
            [-51, -8, 13],
            [-47, -32, 15],
            [-30, -51, 16],
            [-7, -60, 16],
            [17, -57, 16],
            [37, -46, 15],
            [50, -26, 14],
            [52, -6, 12],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      );
    case "spiky":
      return (
        <g>
          <path d="M -49 -4 C -51 4 -48 10 -44 12 L -40 -10 Z M 49 -4 C 51 4 48 10 44 12 L 40 -10 Z" fill={shade(color, 0.45)} />
          <path d="M -47 -14 L -52 -54 L -33 -40 L -24 -70 L -9 -45 L 5 -73 L 18 -46 L 35 -67 L 38 -40 L 52 -52 L 47 -12 C 30 -27 -30 -29 -47 -14 Z" fill={color} />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M -49 -4 C -51 6 -48 12 -44 14 L -40 -6 Z M 49 -4 C 51 6 48 12 44 14 L 40 -6 Z" fill={color} />
          <path d="M -51 -4 C -55 -52 -26 -67 2 -67 C 30 -67 55 -52 51 -4 C 34 -13 -34 -13 -51 -4 Z" fill={outfit} />
          <path d="M 2 -67 C -6 -44 -8 -26 -8 -11" stroke={shade(outfit, 0.18)} strokeWidth={1.8} fill="none" />
          <path d="M 12 -16 C 36 -30 66 -27 74 -15 C 68 -5 42 -4 12 -8 Z" fill={light(outfit, 0.08)} />
          <circle cx={2} cy={-67} r={3.6} fill={shade(outfit, 0.1)} />
        </g>
      );
    default:
      return null;
  }
};

/** An arm or a leg: two segments (shoulder/hip → elbow/knee → end) and something at the end (hand, shoe). */
const Limb: React.FC<{
  x: number;
  y: number;
  angle: number;
  bend?: number;
  upper: number;
  lower: number;
  w: number;
  color: string;
  edge?: string;
  end?: (x: number, y: number) => React.ReactNode;
}> = ({ x, y, angle, bend = 0, upper, lower, w, color, edge, end }) => {
  const knee = y + upper;
  const tip = knee + lower;
  const segments = (stroke: string, width: number, withEnd: boolean) => (
    <>
      <line x1={x} y1={y} x2={x} y2={knee} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <g transform={`rotate(${-bend} ${x} ${knee})`}>
        <line x1={x} y1={knee} x2={x} y2={tip} stroke={stroke} strokeWidth={width * 0.96} strokeLinecap="round" />
        {withEnd && end?.(x, tip)}
      </g>
    </>
  );
  return (
    <g transform={`rotate(${-angle} ${x} ${y})`}>
      {edge && segments(edge, w + 2.4, false)}
      {segments(color, w, true)}
    </g>
  );
};

type HandShape = "fist" | "open" | "point";

/** A hand at the end of an arm; in the arm's frame "down" (+y) points away from the elbow. */
const Hand: React.FC<{ x: number; y: number; skin: string; side: number; shape: HandShape }> = ({ x, y, skin, side, shape }) => (
  <g fill={skin}>
    {shape === "open" ? (
      <g>
        <ellipse cx={x} cy={y + 6} rx={13} ry={12} />
        {[-1.5, -0.5, 0.5, 1.5].map((k) => (
          <rect key={k} x={x + k * 6 - 3} y={y + 7} width={6} height={k === -1.5 || k === 1.5 ? 12.5 : 15} rx={3} transform={`rotate(${k * 9} ${x + k * 6} ${y + 9})`} />
        ))}
        <ellipse cx={x - side * 12.5} cy={y + 2} rx={5.2} ry={8.4} transform={`rotate(${side * 40} ${x - side * 12.5} ${y + 2})`} />
      </g>
    ) : (
      <g>
        <circle cx={x} cy={y + 4} r={14.5} />
        <ellipse cx={x - side * 10.5} cy={y - 1} rx={5.6} ry={7.2} transform={`rotate(${side * 25} ${x - side * 10.5} ${y - 1})`} />
        {shape === "point" && <rect x={x - 3.2} y={y + 10} width={6.4} height={19} rx={3.2} />}
      </g>
    )}
  </g>
);

const Human: React.FC<PuppetProps & { eyes: number; uid: string }> = ({ member, action, expression, t, mouth, eyes, facing, uid }) => {
  const skin = SKIN[member.skin] ?? SKIN.light;
  const hair = HAIR_COLORS[member.hairColor] ?? HAIR_COLORS.black;
  const outfit = PALETTE[member.outfit] ?? PALETTE.teal;
  const pants = PANTS_COLORS[member.pants] ?? PANTS_COLORS.dark;
  const coat = member.accessory === "lab-coat";
  const sleeve = coat ? INK.coat : outfit;
  const a = arms(action, t);
  const legSwing = action === "walk" ? wave(t, 1.8) * 22 : 0;
  const airborne = action === "jump" ? Math.max(0, wave(t, 1.1)) : 0;
  const tilt = action === "think" ? -6 : action === "talk" ? wave(t, 0.7) * 3 : expression === "sad" ? 5 : 0;
  const look = facing === "left" ? -3.5 : facing === "right" ? 3.5 : 0;
  const shoe = (x: number, y: number) => <ellipse cx={x + 5} cy={y + 10.5} rx={20.5} ry={10.5} fill={INK.shoe} />;
  const nearHand: HandShape = action === "wave" || action === "shrug" || action === "talk" ? "open" : action === "point" ? "point" : "fist";
  const hand = (side: number, shape: HandShape) => (x: number, y: number) => <Hand x={x} y={y} skin={side > 0 ? skin : shade(skin, 0.06)} side={side} shape={shape} />;
  // Sloped shoulders, straight sides, rounded hem (the lab coat is longer).
  const hem = coat ? -88 : -100;
  const torso = `M -16 -204 C -30 -204 -44 -197 -50 -182 L -54 ${hem - 10} C -54 ${hem - 3} -50 ${hem} -43 ${hem} L 43 ${hem} C 50 ${hem} 54 ${hem - 3} 54 ${hem - 10} L 50 -182 C 44 -197 30 -204 16 -204 Z`;
  return (
    <g>
      {member.accessory === "backpack" && <rect x={-54} y={-198} width={108} height={92} rx={24} fill={shade(PALETTE.amber, 0.12)} />}
      {/* legs */}
      {[-1, 1].map((side) => (
        <Limb key={side} x={side * 18} y={-106} angle={side * legSwing - airborne * 30} bend={-airborne * 62} upper={44} lower={41} w={33} color={side < 0 ? pants : shade(pants, 0.08)} end={shoe} />
      ))}
      {/* far arm */}
      <Limb x={-46} y={-182} angle={-a.back} bend={-a.backElbow} upper={47} lower={44} w={26} color={shade(sleeve, 0.12)} end={hand(-1, action === "shrug" ? "open" : "fist")} />
      {/* long hair falls behind the body */}
      {member.hair === "long" && (
        <g transform={`translate(0 ${HEAD_Y}) scale(${HEAD_SCALE})`}>
          <HairBack style="long" color={hair} />
        </g>
      )}
      {/* body */}
      <path d={torso} fill={coat ? INK.coat : outfit} />
      {coat ? (
        <g>
          <path d="M -13 -201 L 0 -150 L 13 -201 Z" fill={outfit} />
          <path d="M -14 -200 L -21 -174 L -7 -166 L 0 -150 M 14 -200 L 21 -174 L 7 -166 L 0 -150 M 0 -150 L 0 -88 M -44 -124 L -26 -124 M 26 -124 L 44 -124" stroke={INK.coatLine} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      ) : member.top === "polo" ? (
        <g>
          <path d="M -19 -202 L -4 -184 L -1 -200 Z M 19 -202 L 4 -184 L 1 -200 Z" fill={shade(outfit, 0.18)} />
          <path d="M 0 -186 L 0 -168" stroke={shade(outfit, 0.22)} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      ) : member.top === "hoodie" ? null : (
        <path d="M -15 -200 Q 0 -189 15 -200" stroke={shade(outfit, 0.22)} strokeWidth={3} strokeLinecap="round" fill="none" />
      )}
      {/* neck */}
      <rect x={-10} y={NECK_Y - 10} width={20} height={14} fill={shade(skin, 0.12)} />
      {member.top === "hoodie" && !coat && (
        <g>
          <path d="M -36 -199 C -44 -216 -22 -225 0 -225 C 22 -225 44 -216 36 -199 C 22 -192 -22 -192 -36 -199 Z" fill={shade(outfit, 0.06)} />
          <path d="M -22 -201 C -12 -195 12 -195 22 -201 C 14 -208 -14 -208 -22 -201 Z" fill={shade(outfit, 0.2)} />
          <path d="M -6 -196 L -7 -176 M 6 -196 L 7 -176" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={-7} cy={-175} r={2.2} fill="#FFFFFF" />
          <circle cx={7} cy={-175} r={2.2} fill="#FFFFFF" />
        </g>
      )}
      {/* long hair also falls in front of the shoulders */}
      {member.hair === "long" && (
        <path transform={`translate(0 ${HEAD_Y}) scale(${HEAD_SCALE})`} d="M -50 8 C -58 44 -54 70 -40 80 C -22 88 22 88 40 80 C 54 70 58 44 50 8 Z" fill={hair} />
      )}
      {member.accessory === "scarf" && (
        <g>
          <rect x={-30} y={-212} width={60} height={19} rx={9.5} fill={PALETTE.coral} />
          <rect x={6} y={-202} width={15} height={52} rx={6} fill={shade(PALETTE.coral, 0.1)} transform="rotate(-6 13 -202)" />
          <rect x={15} y={-200} width={15} height={44} rx={6} fill={PALETTE.coral} transform="rotate(4 22 -200)" />
        </g>
      )}
      {member.accessory === "backpack" && (
        <path d="M -30 -198 L -30 -140 M 30 -198 L 30 -140" stroke={PALETTE.amber} strokeWidth={7} strokeLinecap="round" />
      )}
      {/* head */}
      <g transform={`rotate(${tilt} 0 ${NECK_Y}) translate(0 ${HEAD_Y}) scale(${HEAD_SCALE})`}>
        {member.hair !== "long" && <HairBack style={member.hair} color={hair} />}
        {[-1, 1].map((s) => (
          <circle key={s} cx={s * 44} cy={6} r={12.5} fill={skin} />
        ))}
        <ellipse cx={0} cy={0} rx={FACE.rx} ry={FACE.ry} fill={skin} />
        <PersonFace expression={expression} mouth={mouth} eyes={eyes} look={look} skin={skin} lashes={member.hair === "long" || member.hair === "bun"} uid={uid} />
        <HairFront style={member.hair} color={hair} outfit={outfit} />
        {member.accessory === "headband" && <path d="M -46 -16 C -40 -54 40 -58 47 -20" stroke="#F6F6F7" strokeWidth={6.5} strokeLinecap="round" fill="none" />}
        {member.accessory === "glasses" && (
          <g fill="none" stroke={INK.glasses} strokeWidth={3.4} strokeLinecap="round">
            <circle cx={-18 + look * 0.4} cy={-3} r={14.5} />
            <circle cx={18 + look * 0.4} cy={-3} r={14.5} />
            <path d={`M ${-3.5 + look * 0.4} -4 Q ${look * 0.4} -7 ${3.5 + look * 0.4} -4 M ${-32.5 + look * 0.4} -5 L -45 -7 M ${32.5 + look * 0.4} -5 L 45 -7`} />
          </g>
        )}
        {member.accessory === "headphones" && (
          <g>
            <path d="M -50 -2 C -54 -66 54 -66 50 -2" stroke={PALETTE.pink} strokeWidth={6} fill="none" />
            {[-1, 1].map((s) => (
              <g key={s}>
                <ellipse cx={s * 50} cy={4} rx={11.5} ry={17} fill={PALETTE.pink} />
                <ellipse cx={s * 42} cy={4} rx={4.5} ry={12} fill={INK.pad} />
              </g>
            ))}
          </g>
        )}
      </g>
      {/* near arm */}
      <Limb x={46} y={-182} angle={a.front} bend={a.frontElbow} upper={47} lower={44} w={26} color={sleeve} edge={shade(sleeve, 0.22)} end={hand(1, nearHand)} />
    </g>
  );
};

// ---------- characters animated from a drawing (Fed, side characters) ----------
// The picture is cut into parts (src/fedtoon/rig.ts): arms turn around the
// shoulder/elbow, the head around the neck, brows and mouth change with the
// expression and eyelids are drawn over the eyes, so the original art is kept.

/** Joint angles for each action: `raise`/`bend` = shoulder/elbow of the raised arm (positive lifts the hand), `hang` = hanging arm outward, `head` = tilt. */
function rigPose(action: Action, expression: Expression, t: number) {
  const tilt = expression === "sad" ? 4 : expression === "thinking" ? -4 : 0;
  const pose = (() => {
    switch (action) {
      case "wave":
        return { head: 3 + wave(t, 1.1) * 2, raise: 0, bend: -wave(t, 2.2) * 16, hang: 0.3, sway: 0 };
      case "point":
        return { head: 2, raise: 6 - wave(t, 0.5) * 1.5, bend: 0, hang: 0.3, sway: 0 };
      case "walk":
        return { head: wave(t, 1.8) * 1.5, raise: -wave(t, 1.8) * 6, bend: 0, hang: wave(t, 1.8) * 9, hang2: -wave(t, 1.8) * 9, sway: wave(t, 1.8) * 1.5 };
      case "think":
        return { head: -6, raise: 20, bend: 14 - wave(t, 0.4) * 1.5, hang: 0.3, sway: 0 };
      case "cheer":
        return { head: wave(t, 2.5) * 3, raise: 12, bend: 6 - wave(t, 2.5) * 10, hang: 10 + wave(t, 2.5) * 5, sway: 0 };
      case "shrug": {
        const up = Math.max(0, wave(t, 0.9));
        return { head: 6, raise: -12 - up * 3, bend: -10 - up * 3, hang: 12 + up * 4, sway: 0 };
      }
      case "jump":
        return { head: wave(t, 1.1) * 2, raise: 8, bend: 4, hang: 8, sway: 0 };
      case "talk":
        return { head: wave(t, 0.7) * 3, raise: 3, bend: -wave(t, 0.8) * 9, hang: 0.3 + wave(t, 0.8, 0.3) * 0.3, sway: 0 };
      default:
        return { head: wave(t, 0.4) * 1.5, raise: 0, bend: -wave(t, 0.5) * 3, hang: 0.2 + wave(t, 0.5) * 0.2, sway: 0 };
    }
  })();
  // `hang2`: a second hanging arm (characters drawn with both arms down) swings opposite to the first when walking.
  return { hang2: undefined as number | undefined, ...pose, head: pose.head + tilt };
}

/** Brow offset (in Fed-sized face pixels) and rotation (deg) for [left, right] brows; positive rotation lowers the inner end. */
const RIG_BROWS: Record<Expression, [{ dy: number; rot: number }, { dy: number; rot: number }]> = {
  neutral: [{ dy: 0, rot: 0 }, { dy: 0, rot: 0 }],
  happy: [{ dy: -4, rot: 0 }, { dy: -4, rot: 0 }],
  sad: [{ dy: 2, rot: -12 }, { dy: 2, rot: -12 }],
  surprised: [{ dy: -12, rot: 0 }, { dy: -12, rot: 0 }],
  angry: [{ dy: 6, rot: 16 }, { dy: 6, rot: 16 }],
  thinking: [{ dy: -8, rot: -6 }, { dy: 2, rot: 4 }],
};
/** How far the upper lid covers the pupil (0-1) for each expression. */
const RIG_LIDS: Record<Expression, number> = { neutral: 0, happy: 0, sad: 0.35, surprised: 0, angry: 0.4, thinking: 0.25 };
/** Height of the drawn mouth (1 = as drawn) when not talking; missing = drawn in vector. */
const RIG_MOUTH: Partial<Record<Expression, number>> = { neutral: 0.55, happy: 1, angry: 0.28, thinking: 0.3 };
/** Eye width of Fed's drawing: other faces scale brow moves and strokes from it. */
const FED_EYE_RX = 19;

type RigCtx = { rig: CharacterRig; s: number };

const RigImg: React.FC<RigCtx & { name: string; style?: React.CSSProperties }> = ({ rig, s, name, style }) => {
  const p = rig.parts[name];
  if (!p) return null;
  return (
    <Img
      src={staticFile(`${rig.dir}/${name}.png`)}
      style={{ position: "absolute", left: (p.x - rig.centerX) * s, top: (p.y - rig.feetY) * s, width: p.w * s, height: p.h * s, maxWidth: "none", ...style }}
    />
  );
};

/** Children rotated `deg` clockwise around `pivot` (source pixels). */
const Joint: React.FC<RigCtx & { pivot: readonly number[]; deg: number; children: React.ReactNode }> = ({ rig, s, pivot, deg, children }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      transform: `rotate(${deg}deg)`,
      transformOrigin: `${(pivot[0] - rig.centerX) * s}px ${(pivot[1] - rig.feetY) * s}px`,
    }}
  >
    {children}
  </div>
);

/**
 * An arm: each segment turns around its pivot, inside the previous one; later segments sit behind
 * earlier ones. Only the segments on the requested layer (`front` or not) are drawn.
 */
type ArmLayer = "back" | "front" | "seam" | "bodyline";

/** Opacity of the lines an outlined arm needs once it has left the body (its far end moved ~1.5-4.5 source px). */
const awayOpacity = (reach: number, deg: number) => Math.min(1, Math.max(0, (reach * Math.sin((Math.abs(deg) * Math.PI) / 180) - 1.5) / 3));

/**
 * Opacity of a sleeve seam: 1 while the sleeve stays against the body (its farthest point moved less
 * than ~4 source px), fading out by ~10 px: an arm held out in the air has no seam line.
 */
/** Actions where the arms stay against the body (other actions swing them out: no seams at all). */
const SNUG_ACTIONS: readonly Action[] = ["idle", "talk", "wave", "point", "think"];

const seamOpacity = (reach: number, deg: number) => Math.min(1, Math.max(0, (10 - reach * Math.sin((Math.abs(deg) * Math.PI) / 180)) / 6));

const RigArm: React.FC<RigCtx & { segments: CharacterRig["arms"][number]["segments"]; angles: number[]; layer: ArmLayer; turned?: number }> = ({ rig, s, segments, angles, layer, turned = 0 }) => {
  const [first, ...rest] = segments;
  if (!first) return null;
  const deg = angles[0] ?? 0;
  const seam = layer === "seam" && first.seam ? seamOpacity(first.seam.reach, turned + deg) : 0;
  const away = first.away ? awayOpacity(first.away.reach, turned + deg) : 0;
  // The body's own line stays with the body (outside this segment's rotation). It is the very same
  // pixels as the arm's line at rest, so it is always drawn: no seam opens when the arm barely moves.
  if (layer === "bodyline") {
    return (
      <>
        {first.away?.body && <RigImg rig={rig} s={s} name={first.away.body} />}
        {rest.length > 0 && <RigArm rig={rig} s={s} segments={rest} angles={angles.slice(1)} layer={layer} turned={turned + deg} />}
      </>
    );
  }
  const drawn = layer !== "seam" && !!first.front === (layer === "front");
  return (
    <Joint rig={rig} s={s} pivot={first.pivot} deg={deg}>
      {rest.length > 0 && <RigArm rig={rig} s={s} segments={rest} angles={angles.slice(1)} layer={layer} turned={turned + deg} />}
      {drawn && <RigImg rig={rig} s={s} name={first.part} />}
      {drawn && away > 0 && first.away?.arm && <RigImg rig={rig} s={s} name={first.away.arm} style={{ opacity: away }} />}
      {seam > 0 && first.seam && <RigImg rig={rig} s={s} name={first.seam.part} style={{ opacity: seam }} />}
    </Joint>
  );
};

/** Mouths drawn in vector for expressions the drawing does not show, sized from the eye width `u`. */
const VectorMouth: React.FC<{ kind: Expression | "talk"; cx: number; cy: number; u: number; mouth: number; colors: CharacterRig["colors"]; uid: string }> = ({ kind, cx, cy, u, mouth, colors, uid }) => {
  const line = (d: string, width = 0.2) => <path d={d} stroke={colors.line ?? colors.pupil} strokeWidth={u * width} strokeLinecap="round" fill="none" />;
  if (kind === "talk" || kind === "happy") {
    const w = u * (kind === "talk" ? 0.95 : 1.1);
    const h = u * (kind === "talk" ? 0.25 + 0.85 * Math.min(1, mouth) : 1);
    const y0 = cy - u * 0.35;
    const d = `M ${cx - w} ${y0} Q ${cx} ${y0 + u * 0.12} ${cx + w} ${y0} C ${cx + w} ${y0 + h * 0.9} ${cx + w * 0.55} ${y0 + h} ${cx} ${y0 + h} C ${cx - w * 0.55} ${y0 + h} ${cx - w} ${y0 + h * 0.9} ${cx - w} ${y0} Z`;
    return (
      <g>
        <clipPath id={`${uid}-vm`}>
          <path d={d} />
        </clipPath>
        <path d={d} fill={colors.mouth} />
        <ellipse cx={cx + u * 0.05} cy={y0 + h * 0.88} rx={w * 0.6} ry={Math.max(u * 0.08, h * 0.36)} fill={colors.tongue} clipPath={`url(#${uid}-vm)`} />
      </g>
    );
  }
  if (kind === "surprised")
    return (
      <g>
        <ellipse cx={cx} cy={cy + u * 0.1} rx={u * 0.42} ry={u * 0.55} fill={colors.mouth} />
        <ellipse cx={cx} cy={cy + u * 0.42} rx={u * 0.26} ry={u * 0.18} fill={colors.tongue} />
      </g>
    );
  if (kind === "sad") return line(`M ${cx - u * 0.62} ${cy + u * 0.28} Q ${cx} ${cy - u * 0.3} ${cx + u * 0.62} ${cy + u * 0.28}`);
  if (kind === "angry") return line(`M ${cx - u * 0.62} ${cy + u * 0.2} Q ${cx} ${cy - u * 0.12} ${cx + u * 0.62} ${cy + u * 0.2}`, 0.24);
  if (kind === "thinking") return line(`M ${cx - u * 0.3} ${cy} Q ${cx + u * 0.2} ${cy + u * 0.25} ${cx + u * 0.65} ${cy - u * 0.15}`);
  return line(`M ${cx - u * 0.62} ${cy - u * 0.05} Q ${cx} ${cy + u * 0.38} ${cx + u * 0.62} ${cy - u * 0.05}`);
};

const RigFace: React.FC<RigCtx & { expression: Expression; mouth: number; eyes: number; uid: string }> = ({ rig, s, expression, mouth, eyes, uid }) => {
  const head = rig.parts.head;
  const { colors } = rig;
  const k = (rig.eyes[0]?.rx ?? FED_EYE_RX) / FED_EYE_RX;
  const talking = mouth > 0.04;
  // The drawn open mouth, squashed toward its top lip for smaller mouths.
  const m = rig.parts.mouth;
  const [x0, y0, x1, y1] = rig.mouthTop;
  const angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  // Drawings with an open smile (Fed, woman, grandpa) squash it for most expressions; other drawn mouths are
  // shown for their own expression (and reused for speech if open), vector mouths cover the rest.
  const style = rig.mouthStyle ?? { drawn: "happy", open: true };
  const legacy = style.drawn === "happy" && style.open;
  const open = legacy
    ? talking
      ? 0.22 + 0.78 * Math.min(1, mouth)
      : RIG_MOUTH[expression]
    : talking
      ? style.open
        ? 0.22 + 0.78 * Math.min(1, mouth)
        : undefined
      : expression === style.drawn
        ? 1
        : undefined;
  const vector: Expression | "talk" | undefined = open !== undefined ? undefined : talking ? "talk" : expression;
  const closed = eyes < 0.35;
  // Faces drawn with another expression (e.g. angry brows): brows and lids move relative to it.
  const base = (rig.faceBase ?? "neutral") as Expression;
  const lid = closed ? 1 : Math.max(Math.max(0, RIG_LIDS[expression] - (RIG_LIDS[base] ?? 0)), 1 - eyes);
  return (
    <>
      {rig.brows.map((name, i) => {
        const e = RIG_BROWS[expression][i];
        const o = RIG_BROWS[base]?.[i] ?? { dy: 0, rot: 0 };
        const b = e && { dy: e.dy - o.dy, rot: e.rot - o.rot };
        const p = rig.parts[name];
        if (!b || !p) return null;
        const side = i === 0 ? 1 : -1;
        return (
          <RigImg
            key={name}
            rig={rig}
            s={s}
            name={name}
            style={{ transform: `translateY(${b.dy * k * s}px) rotate(${side * b.rot}deg)`, transformOrigin: `${(p.w / 2) * s}px ${(p.h / 2) * s}px` }}
          />
        );
      })}
      {open !== undefined && m && (
        <RigImg
          rig={rig}
          s={s}
          name="mouth"
          style={{ transform: `rotate(${angle}deg) scaleY(${open}) rotate(${-angle}deg)`, transformOrigin: `${((x0 + x1) / 2 - m.x) * s}px ${((y0 + y1) / 2 - m.y) * s}px` }}
        />
      )}
      <svg
        width={head.w * s}
        height={head.h * s}
        viewBox={`${head.x} ${head.y} ${head.w} ${head.h}`}
        style={{ position: "absolute", left: (head.x - rig.centerX) * s, top: (head.y - rig.feetY) * s, overflow: "visible" }}
      >
        {!legacy && vector && m && <VectorMouth kind={vector} cx={m.x + m.w / 2} cy={m.y + m.h / 2} u={rig.eyes[0]?.rx ?? FED_EYE_RX} mouth={mouth} colors={colors} uid={uid} />}
        {legacy && open === undefined && m && expression === "sad" && (
          <path
            d={`M ${m.x + m.w * 0.16} ${m.y + m.h * 0.68} Q ${m.x + m.w * 0.5} ${m.y + m.h * 0.32} ${m.x + m.w * 0.84} ${m.y + m.h * 0.63}`}
            stroke={colors.mouth}
            strokeWidth={m.w * 0.087}
            strokeLinecap="round"
            fill="none"
          />
        )}
        {legacy && open === undefined && m && expression === "surprised" && (
          <g>
            <ellipse cx={m.x + m.w * 0.49} cy={m.y + m.h * 0.58} rx={m.w * 0.16} ry={m.h * 0.33} fill={colors.mouth} />
            <ellipse cx={m.x + m.w * 0.49} cy={m.y + m.h * 0.77} rx={m.w * 0.1} ry={m.h * 0.105} fill={colors.tongue} />
          </g>
        )}
        {rig.eyes.map((e, i) => {
          const side = i === 0 ? 1 : -1;
          const margin = rig.lid?.margin ?? 4 * k;
          const top = e.cy - e.ry - 5 * k;
          const lidY = top + (e.ry * 2 + 10 * k) * lid;
          const tilt = expression === "angry" ? side * 14 : expression === "sad" ? side * -12 : 0;
          return (
            <g key={i}>
              <clipPath id={`${uid}-eye${i}`}>
                <ellipse cx={e.cx} cy={e.cy} rx={e.rx + margin} ry={e.ry + margin} />
              </clipPath>
              {lid > 0.01 && (
                <g clipPath={`url(#${uid}-eye${i})`}>
                  <g transform={`rotate(${tilt} ${e.cx} ${lidY})`}>
                    <rect x={e.cx - e.rx - 10 * k} y={top - 24 * k} width={(e.rx + 10 * k) * 2} height={lidY - top + 24 * k} fill={colors.skin} />
                    {rig.lid?.line && !closed && <line x1={e.cx - e.rx - 10 * k} y1={lidY} x2={e.cx + e.rx + 10 * k} y2={lidY} stroke={colors.pupil} strokeWidth={4 * k} />}
                  </g>
                </g>
              )}
              {closed && (
                <path d={`M ${e.cx - e.rx - 1} ${e.cy + 2 * k} Q ${e.cx} ${e.cy + e.ry * 0.7} ${e.cx + e.rx + 1} ${e.cy + 2 * k}`} stroke={colors.pupil} strokeWidth={5 * k} strokeLinecap="round" fill="none" />
              )}
            </g>
          );
        })}
      </svg>
    </>
  );
};

const RigPuppet: React.FC<PuppetProps & { rig: CharacterRig; eyes: number; width: number }> = ({ rig, action, expression, t, mouth, eyes, facing, height, width, seed = 0 }) => {
  const uid = `rig${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const unit = height / 380;
  const s = (unit * rig.units) / (rig.feetY - rig.top);
  const posed = rigPose(action, expression, t + seed * 0.37);
  // For the action the drawing shows, keep it as drawn: only the hand waves (wave, cheer) or the
  // character breathes (e.g. a finger on the temple).
  const drawnBend = action === "wave" ? -wave(t, 2.2) * 16 : action === "cheer" ? -wave(t, 2.5) * 8 : -wave(t + seed, 0.5) * 2;
  const pose = isDrawnAction(rig, action) ? { ...posed, head: wave(t, 0.4) * 1.2, raise: 0, bend: drawnBend } : posed;
  const y = bob(action, t + seed * 0.37) * unit;
  const flip = facing === "left" ? -1 : 1;
  const firstRaised = rig.arms.findIndex((a) => a.kind === "raised");
  const armAngles = (arm: CharacterRig["arms"][number], index: number): { angles: number[]; drawn: boolean } => {
    const dir = arm.side === "left" ? 1 : -1;
    if (arm.kind === "hanging") {
      const second = rig.arms.slice(0, index).some((a) => a.kind === "hanging");
      return { angles: [(second ? (pose.hang2 ?? pose.hang) : pose.hang) * dir], drawn: true };
    }
    const n = arm.segments.length;
    // Raised arms keep the drawn pose for waving, cheering and the action of the drawing (the
    // first raised arm only, except for cheering); otherwise they rest (or point) if the rig says how.
    const main = index === firstRaised;
    const drawn = !arm.rest || action === "cheer" || (main && (action === "wave" || isDrawnAction(rig, action)));
    const pointing = !drawn && main && action === "point" && arm.point;
    if (drawn) {
      const share = n > 1 ? (rig.shoulderShare ?? 1) : 1;
      const [lo, hi] = rig.elbowRange ?? [-180, 180];
      const elbow = Math.min(hi, Math.max(lo, n > 1 ? pose.bend + pose.raise * (1 - share) : pose.raise + pose.bend));
      return { angles: n > 1 ? [pose.raise * share * dir, elbow * dir] : [elbow * dir], drawn };
    }
    const base = (pointing ? arm.point : arm.rest) ?? [];
    return { angles: Array.from({ length: n }, (_, i) => ((base[i] ?? 0) + (i === 0 ? (pointing ? wave(t, 0.5) * 1.5 : pose.hang) : 0)) * dir), drawn };
  };
  return (
    <div style={{ position: "relative", width, height }}>
      <div style={{ position: "absolute", left: width / 2, top: unit * 366, width: 0, height: 0, transform: `translateY(${y}px) scaleX(${flip}) rotate(${pose.sway}deg)` }}>
        {rig.order.map((item) => {
          if (item === "head")
            return (
              <Joint key={item} rig={rig} s={s} pivot={rig.head.pivot} deg={pose.head}>
                <RigImg rig={rig} s={s} name="head" />
                <RigFace rig={rig} s={s} expression={expression} mouth={mouth} eyes={eyes} uid={uid} />
              </Joint>
            );
          if (item.startsWith("arm:")) {
            const [, i, layer] = item.split(":");
            const arm = rig.arms[Number(i)];
            if (!arm) return null;
            const state = armAngles(arm, Number(i));
            if (layer === "seam" && !SNUG_ACTIONS.includes(action)) return null;
            const cap = !state.drawn && !layer ? arm.cap : undefined;
            return (
              <React.Fragment key={item}>
                <RigArm rig={rig} s={s} segments={arm.segments} angles={state.angles} layer={layer === "front" || layer === "seam" || layer === "bodyline" ? layer : "back"} />
                {cap && (
                  <div
                    style={{
                      position: "absolute",
                      left: (cap[0] - cap[2] - rig.centerX) * s,
                      top: (cap[1] - cap[3] - rig.feetY) * s,
                      width: cap[2] * 2 * s,
                      height: cap[3] * 2 * s,
                      borderRadius: "50%",
                      background: rig.colors.shirt ?? rig.colors.skin,
                    }}
                  />
                )}
              </React.Fragment>
            );
          }
          return <RigImg key={item} rig={rig} s={s} name={item} />;
        })}
      </div>
    </div>
  );
};

/** A cast member standing with its feet at the bottom-center of the box. */
export const Puppet: React.FC<PuppetProps> = (props) => {
  const { member, action, t, height, facing, seed = 0 } = props;
  const eyes = blink(t, seed);
  const y = bob(action, t + seed * 0.37);
  const flip = facing === "left" ? -1 : 1;
  const uid = `p${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const rig = rigFor(member, action);
  if (rig) return <RigPuppet {...props} rig={rig} eyes={eyes} width={height * (200 / 380)} />;
  return (
    <svg width={height * (200 / 380)} height={height} viewBox="-100 -366 200 380" style={{ overflow: "visible" }}>
      <g transform={`translate(0 ${y}) scale(${flip} 1)`}>
        <Human {...props} eyes={eyes} uid={uid} />
      </g>
    </svg>
  );
};

/** Lip-sync: mouth opening at time `t` (s since the clip started) from word timings. */
export function mouthAt(t: number, words: { start: number; end: number }[], clipDuration: number): number {
  if (t < 0 || t > clipDuration) return 0;
  const inWord = words.length ? words.some((w) => t >= w.start && t <= w.end) : true;
  if (!inWord) return 0;
  // Two out-of-phase oscillators give a natural, non-repeating flap of ~6-9 Hz.
  return Math.max(0, 0.35 + 0.4 * Math.sin(t * 2 * Math.PI * 6.3) + 0.25 * Math.sin(t * 2 * Math.PI * 2.7 + 1));
}
