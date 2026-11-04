// Fedtoon characters: people drawn in code (SVG), consistent in every video,
// free to render and fully animatable (flat shapes, no outlines, no shadows or
// glow), plus Fed, the mascot, animated from the channel owner's own drawing.
import React from "react";
import { Img, staticFile } from "remotion";
import { HAIR_COLORS, PALETTE, SKIN } from "../../fedtoon/brand";
import { MASCOT_RIG } from "../../fedtoon/mascot-rig";
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

/** Arm angles (degrees, 0 = hanging down, positive = raised forward/outward) for each action. */
function arms(action: Action, t: number): { front: number; back: number; frontElbow: number } {
  switch (action) {
    case "wave":
      return { front: 150 + wave(t, 2.2) * 22, back: 12, frontElbow: 0 };
    case "point":
      return { front: 92, back: 10, frontElbow: 0 };
    case "walk":
      return { front: wave(t, 1.8) * 28, back: -wave(t, 1.8) * 28, frontElbow: 0 };
    case "think":
      return { front: 128, back: 18, frontElbow: 95 };
    case "cheer":
      return { front: 160 + wave(t, 2.5) * 12, back: 160 - wave(t, 2.5) * 12, frontElbow: 0 };
    case "shrug":
      return { front: 58 + Math.max(0, wave(t, 0.9)) * 18, back: 58 + Math.max(0, wave(t, 0.9)) * 18, frontElbow: 60 };
    case "talk":
      return { front: 22 + wave(t, 0.8) * 14, back: 8, frontElbow: 30 + wave(t, 0.8) * 20 };
    default:
      return { front: 6 + wave(t, 0.5) * 3, back: 6 - wave(t, 0.5) * 3, frontElbow: 0 };
  }
}

/** Vertical body offset (px in the 200-unit drawing). */
function bob(action: Action, t: number) {
  if (action === "jump") return -Math.max(0, wave(t, 1.1)) * 46;
  if (action === "walk") return -Math.abs(wave(t, 1.8)) * 6;
  if (action === "cheer") return -Math.max(0, wave(t, 2.5)) * 10;
  return wave(t, 0.5) * 1.6;
}

// ---------- face ----------
const Face: React.FC<{ cx: number; cy: number; r: number; expression: Expression; mouth: number; eyesOpen: number; look: number; lid: string }> = ({
  cx,
  cy,
  r,
  expression,
  mouth,
  eyesOpen,
  look,
  lid,
}) => {
  const eyeR = r * 0.15;
  const eyeY = cy - r * 0.05;
  const gap = r * 0.34;
  const surprised = expression === "surprised";
  const thinking = expression === "thinking";
  const eyeScale = (surprised ? 1.25 : 1) * eyesOpen;
  const lookY = thinking ? -eyeR * 0.6 : 0;
  const brow = { neutral: 0, happy: -6, sad: 16, surprised: -12, angry: -20, thinking: 8 }[expression];
  const browY = eyeY - eyeR * (surprised ? 2.6 : 2.1);
  const mouthY = cy + r * 0.42;
  const mw = r * 0.26;
  const talking = mouth > 0.04;
  let mouthEl: React.ReactNode;
  if (talking || surprised) {
    const open = surprised && !talking ? 0.55 : mouth;
    mouthEl = (
      <g>
        <ellipse cx={cx + look} cy={mouthY} rx={mw * (surprised && !talking ? 0.55 : 0.7)} ry={mw * (0.18 + open * 0.62)} fill="#5A1530" />
        <ellipse cx={cx + look} cy={mouthY + mw * (0.12 + open * 0.3)} rx={mw * 0.42} ry={mw * 0.2 * open + 0.5} fill="#FF7E95" />
      </g>
    );
  } else if (expression === "happy") {
    mouthEl = <path d={`M ${cx + look - mw} ${mouthY - mw * 0.2} Q ${cx + look} ${mouthY + mw * 0.85} ${cx + look + mw} ${mouthY - mw * 0.2} Z`} fill="#5A1530" />;
  } else if (expression === "sad" || expression === "angry") {
    mouthEl = <path d={`M ${cx + look - mw * 0.7} ${mouthY + mw * 0.3} Q ${cx + look} ${mouthY - mw * 0.35} ${cx + look + mw * 0.7} ${mouthY + mw * 0.3}`} stroke="#5A1530" strokeWidth={r * 0.06} strokeLinecap="round" fill="none" />;
  } else {
    mouthEl = <path d={`M ${cx + look - mw * 0.6} ${mouthY} Q ${cx + look} ${mouthY + mw * (thinking ? 0.05 : 0.35)} ${cx + look + mw * 0.6} ${mouthY}`} stroke="#5A1530" strokeWidth={r * 0.06} strokeLinecap="round" fill="none" />;
  }
  return (
    <g>
      {[-1, 1].map((side) => {
        const ex = cx + side * gap + look * 0.4;
        // Upper lid lowered for sad / angry / thinking looks, closed when blinking.
        const lidDrop = { neutral: 0.05, happy: 0.0, sad: 0.42, surprised: 0, angry: 0.5, thinking: 0.3 }[expression];
        const lidY = eyeY - eyeR * 1.15 + eyeR * 2.3 * Math.max(lidDrop, 1 - eyesOpen);
        const clip = `eye-${side}-${Math.round(cx)}-${Math.round(cy)}`;
        return (
        <g key={side}>
          <clipPath id={clip}>
            <ellipse cx={ex} cy={eyeY} rx={eyeR} ry={eyeR * 1.15 * (surprised ? 1.15 : 1)} />
          </clipPath>
          <g clipPath={`url(#${clip})`}>
            <ellipse cx={ex} cy={eyeY} rx={eyeR} ry={eyeR * 1.15 * (surprised ? 1.15 : 1)} fill="#FFFFFF" />
            <circle cx={ex + look * 0.5} cy={eyeY + lookY + eyeR * 0.1} r={eyeR * (surprised ? 0.42 : 0.58)} fill="#141022" />
            <circle cx={ex + look * 0.5 + eyeR * 0.2} cy={eyeY + lookY - eyeR * 0.15} r={eyeR * 0.18} fill="#FFFFFF" />
            <rect
              x={ex - eyeR * 1.3}
              y={eyeY - eyeR * 2.6}
              width={eyeR * 2.6}
              height={lidY - (eyeY - eyeR * 2.6)}
              fill={lid}
              transform={`rotate(${expression === "angry" ? side * -14 : expression === "sad" ? side * 12 : 0} ${ex} ${lidY})`}
            />
          </g>
          <rect
            x={ex - eyeR * 1.2}
            y={browY - r * 0.025}
            width={eyeR * 2.4}
            height={r * 0.06}
            rx={r * 0.03}
            fill="#141022"
            opacity={0.85}
            transform={`rotate(${side * brow} ${ex} ${browY})`}
          />
          <ellipse cx={ex + side * eyeR * 0.9} cy={eyeY + r * 0.32} rx={r * 0.12} ry={r * 0.07} fill="#FF6F91" opacity={0.45} />
        </g>
        );
      })}
      {mouthEl}
    </g>
  );
};

// ---------- human ----------
const Hair: React.FC<{ style: CastMember["hair"]; color: string; cx: number; cy: number; r: number; layer: "back" | "front"; outfit: string }> = ({ style, color, cx, cy, r, layer, outfit }) => {
  const dark = shade(color, 0.18);
  if (layer === "back") {
    if (style === "long") return <path d={`M ${cx - r * 1.02} ${cy} Q ${cx - r * 1.1} ${cy + r * 1.5} ${cx - r * 0.7} ${cy + r * 1.7} L ${cx + r * 0.7} ${cy + r * 1.7} Q ${cx + r * 1.1} ${cy + r * 1.5} ${cx + r * 1.02} ${cy} Z`} fill={dark} />;
    if (style === "bun") return <circle cx={cx} cy={cy - r * 1.05} r={r * 0.42} fill={dark} />;
    return null;
  }
  switch (style) {
    case "bald":
      return <ellipse cx={cx - r * 0.3} cy={cy - r * 0.6} rx={r * 0.22} ry={r * 0.12} fill="#FFFFFF" opacity={0.25} />;
    case "cap":
      return (
        <g>
          <path d={`M ${cx - r * 0.98} ${cy - r * 0.15} A ${r} ${r} 0 0 1 ${cx + r * 0.98} ${cy - r * 0.15} Z`} fill={outfit} />
          <rect x={cx - r * 0.2} y={cy - r * 0.32} width={r * 1.45} height={r * 0.2} rx={r * 0.1} fill={shade(outfit, 0.25)} />
          <circle cx={cx} cy={cy - r * 0.98} r={r * 0.09} fill={shade(outfit, 0.25)} />
        </g>
      );
    case "curly":
      return (
        <g fill={color}>
          {[-0.85, -0.5, -0.1, 0.3, 0.7].map((x, i) => (
            <circle key={i} cx={cx + x * r} cy={cy - r * (0.62 + (i % 2) * 0.22)} r={r * 0.36} />
          ))}
          <circle cx={cx - r * 0.95} cy={cy - r * 0.1} r={r * 0.26} />
          <circle cx={cx + r * 0.95} cy={cy - r * 0.1} r={r * 0.26} />
        </g>
      );
    case "spiky":
      return (
        <path
          d={`M ${cx - r} ${cy - r * 0.05} L ${cx - r * 0.9} ${cy - r * 0.95} L ${cx - r * 0.55} ${cy - r * 0.7} L ${cx - r * 0.35} ${cy - r * 1.25} L ${cx} ${cy - r * 0.85} L ${cx + r * 0.3} ${cy - r * 1.3} L ${cx + r * 0.5} ${cy - r * 0.8} L ${cx + r * 0.95} ${cy - r * 1.05} L ${cx + r} ${cy - r * 0.05} Q ${cx} ${cy - r * 0.55} ${cx - r} ${cy - r * 0.05} Z`}
          fill={color}
        />
      );
    case "long":
    case "bun":
    case "short":
    default:
      return (
        <path
          d={`M ${cx - r * 1.02} ${cy + (style === "long" ? r * 0.35 : -r * 0.05)} A ${r * 1.02} ${r * 1.02} 0 0 1 ${cx + r * 1.02} ${cy - r * 0.05} Q ${cx + r * 0.3} ${cy - r * 0.55} ${cx - r * 0.35} ${cy - r * 0.4} Q ${cx - r * 0.75} ${cy - r * 0.3} ${cx - r * 1.02} ${cy + (style === "long" ? r * 0.35 : -r * 0.05)} Z`}
          fill={color}
        />
      );
  }
};

const Limb: React.FC<{ x: number; y: number; angle: number; elbow?: number; len: number; w: number; color: string; hand?: string }> = ({ x, y, angle, elbow = 0, len, w, color, hand }) => {
  const upper = len * 0.55;
  const lower = len * 0.5;
  return (
    <g transform={`rotate(${-angle} ${x} ${y})`}>
      <line x1={x} y1={y} x2={x} y2={y + upper} stroke={color} strokeWidth={w} strokeLinecap="round" />
      <g transform={`rotate(${-elbow} ${x} ${y + upper})`}>
        <line x1={x} y1={y + upper} x2={x} y2={y + upper + lower} stroke={color} strokeWidth={w * 0.92} strokeLinecap="round" />
        {hand && <circle cx={x} cy={y + upper + lower} r={w * 0.62} fill={hand} />}
      </g>
    </g>
  );
};

const Human: React.FC<PuppetProps & { eyes: number }> = ({ member, action, expression, t, mouth, eyes, facing }) => {
  const skin = SKIN[member.skin] ?? SKIN.tan;
  const hair = HAIR_COLORS[member.hairColor] ?? HAIR_COLORS.black;
  const outfit = PALETTE[member.outfit] ?? PALETTE.teal;
  const pants = PALETTE.navy;
  const a = arms(action, t);
  const legSwing = action === "walk" ? wave(t, 1.8) * 22 : 0;
  const tilt = action === "think" ? -6 : action === "talk" ? wave(t, 0.7) * 3 : expression === "sad" ? 5 : 0;
  const look = facing === "left" ? -6 : facing === "right" ? 6 : 0;
  const headR = 50;
  const headY = -248;
  const coat = member.accessory === "lab-coat";
  return (
    <g>
      {member.accessory === "backpack" && <rect x={-62} y={-196} width={124} height={96} rx={26} fill={shade(PALETTE.amber, 0.15)} />}
      {/* legs */}
      <Limb x={-20} y={-96} angle={legSwing} len={96} w={30} color={pants} />
      <Limb x={20} y={-96} angle={-legSwing} len={96} w={30} color={shade(pants, 0.1)} />
      <ellipse cx={-22 + legSwing * 0.9} cy={-2} rx={22} ry={10} fill={PALETTE.ink} />
      <ellipse cx={22 - legSwing * 0.9} cy={-2} rx={22} ry={10} fill={PALETTE.ink} />
      {/* back arm */}
      <Limb x={-44} y={-184} angle={-a.back} len={92} w={24} color={shade(coat ? PALETTE.cream : outfit, 0.2)} hand={shade(skin, 0.08)} />
      {/* torso */}
      <path d="M -46 -200 Q -50 -200 -54 -190 L -62 -104 Q -62 -90 -48 -90 L 48 -90 Q 62 -90 62 -104 L 54 -190 Q 50 -200 46 -200 Z" fill={coat ? PALETTE.cream : outfit} />
      <path d="M 10 -200 L 46 -200 Q 50 -200 54 -190 L 62 -104 Q 62 -90 48 -90 L 18 -90 Z" fill={shade(coat ? PALETTE.cream : outfit, 0.12)} />
      {coat && <path d="M -14 -200 L 0 -150 L 14 -200 Z" fill={outfit} />}
      {member.accessory === "scarf" && (
        <g>
          <rect x={-40} y={-210} width={80} height={22} rx={11} fill={PALETTE.coral} />
          <rect x={14} y={-196} width={20} height={54} rx={10} fill={shade(PALETTE.coral, 0.12)} />
        </g>
      )}
      {/* neck + head */}
      <rect x={-12} y={-212} width={24} height={20} fill={shade(skin, 0.1)} />
      <g transform={`rotate(${tilt} 0 ${headY + headR})`}>
        <Hair style={member.hair} color={hair} cx={0} cy={headY} r={headR} layer="back" outfit={outfit} />
        <circle cx={0} cy={headY} r={headR} fill={skin} />
        <path d={`M ${headR * 0.15} ${headY - headR * 0.99} A ${headR} ${headR} 0 0 1 ${headR * 0.15} ${headY + headR * 0.99} A ${headR * 0.9} ${headR} 0 0 0 ${headR * 0.15} ${headY - headR * 0.99} Z`} fill={shade(skin, 0.08)} />
        <circle cx={-headR * 1.0} cy={headY + 4} r={9} fill={shade(skin, 0.06)} />
        <circle cx={headR * 1.0} cy={headY + 4} r={9} fill={shade(skin, 0.1)} />
        <Face cx={0} cy={headY} r={headR} expression={expression} mouth={mouth} eyesOpen={eyes} look={look} lid={skin} />
        <Hair style={member.hair} color={hair} cx={0} cy={headY} r={headR} layer="front" outfit={outfit} />
        {member.accessory === "glasses" && (
          <g fill="none" stroke="#141022" strokeWidth={3.5} opacity={0.85}>
            <circle cx={-17 + look} cy={headY - 2} r={12} />
            <circle cx={17 + look} cy={headY - 2} r={12} />
            <line x1={-5 + look} y1={headY - 2} x2={5 + look} y2={headY - 2} />
          </g>
        )}
        {member.accessory === "headphones" && (
          <g>
            <path d={`M ${-headR * 1.02} ${headY} A ${headR * 1.05} ${headR * 1.1} 0 0 1 ${headR * 1.02} ${headY}`} stroke={PALETTE.ink} strokeWidth={8} fill="none" />
            <rect x={-headR * 1.18} y={headY - 16} width={20} height={34} rx={9} fill={PALETTE.coral} />
            <rect x={headR * 1.18 - 20} y={headY - 16} width={20} height={34} rx={9} fill={PALETTE.coral} />
          </g>
        )}
      </g>
      {/* front arm */}
      <Limb x={44} y={-184} angle={a.front} elbow={a.frontElbow} len={92} w={24} color={coat ? PALETTE.cream : light(outfit, 0.06)} hand={skin} />
    </g>
  );
};

// ---------- Fed, the mascot ----------
// Fed is drawn from the channel owner's own artwork (assets/mascot/source.png),
// cut into parts by assets/mascot/split.py: arms, body, head, mouth and brows
// move separately, so the original drawing is kept untouched.

type MascotPart = keyof typeof MASCOT_RIG.parts;
type Point = readonly [number, number];

/** Fed's height in the 380-unit puppet box (code-drawn people are ~300-310). */
const MASCOT_UNITS = 330;
const MASCOT_SKIN = MASCOT_RIG.colors.skin;

/** Joint angles (degrees, clockwise) for each action. */
function mascotPose(action: Action, expression: Expression, t: number) {
  const tilt = expression === "sad" ? 4 : expression === "thinking" ? -4 : 0;
  const pose = (() => {
    switch (action) {
      case "wave":
        return { head: 3 + wave(t, 1.1) * 2, armUp: wave(t, 2.2) * 16, armDown: 2, sway: 0 };
      case "point":
        return { head: 2, armUp: -6 + wave(t, 0.5) * 1.5, armDown: 1, sway: 0 };
      case "walk":
        return { head: wave(t, 1.8) * 1.5, armUp: wave(t, 1.8) * 6, armDown: wave(t, 1.8) * 9, sway: wave(t, 1.8) * 1.5 };
      case "think":
        return { head: -6, armUp: -34 + wave(t, 0.4) * 1.5, armDown: 1, sway: 0 };
      case "cheer":
        return { head: wave(t, 2.5) * 3, armUp: -18 + wave(t, 2.5) * 10, armDown: 10 + wave(t, 2.5) * 5, sway: 0 };
      case "shrug": {
        const up = Math.max(0, wave(t, 0.9));
        return { head: 6, armUp: 22 + up * 6, armDown: 12 + up * 4, sway: 0 };
      }
      case "jump":
        return { head: wave(t, 1.1) * 2, armUp: -12, armDown: 8, sway: 0 };
      case "talk":
        return { head: wave(t, 0.7) * 3, armUp: -3 + wave(t, 0.8) * 9, armDown: 1 + wave(t, 0.8, 0.3) * 2, sway: 0 };
      default:
        return { head: wave(t, 0.4) * 1.5, armUp: wave(t, 0.5) * 3, armDown: 1 + wave(t, 0.5) * 1.5, sway: 0 };
    }
  })();
  return { ...pose, head: pose.head + tilt };
}

/** Brow offset (px) and rotation (deg) for [left, right] brows; positive rotation lowers the inner end. */
const MASCOT_BROWS: Record<Expression, [{ dy: number; rot: number }, { dy: number; rot: number }]> = {
  neutral: [{ dy: 0, rot: 0 }, { dy: 0, rot: 0 }],
  happy: [{ dy: -4, rot: 0 }, { dy: -4, rot: 0 }],
  sad: [{ dy: 2, rot: -12 }, { dy: 2, rot: -12 }],
  surprised: [{ dy: -12, rot: 0 }, { dy: -12, rot: 0 }],
  angry: [{ dy: 6, rot: 16 }, { dy: 6, rot: 16 }],
  thinking: [{ dy: -8, rot: -6 }, { dy: 2, rot: 4 }],
};
/** How far the upper lid covers the pupil (0-1) for each expression. */
const MASCOT_LIDS: Record<Expression, number> = { neutral: 0, happy: 0, sad: 0.35, surprised: 0, angry: 0.4, thinking: 0.25 };
/** Height of the drawn smile (1 = as drawn) when Fed is not talking. */
const MASCOT_MOUTH: Partial<Record<Expression, number>> = { neutral: 0.55, happy: 1, angry: 0.28, thinking: 0.3 };

const MascotImg: React.FC<{ name: MascotPart; s: number; style?: React.CSSProperties }> = ({ name, s, style }) => {
  const p = MASCOT_RIG.parts[name];
  return (
    <Img
      src={staticFile(`fedtoon/mascot/${name}.png`)}
      style={{ position: "absolute", left: (p.x - MASCOT_RIG.centerX) * s, top: (p.y - MASCOT_RIG.feetY) * s, width: p.w * s, height: p.h * s, maxWidth: "none", ...style }}
    />
  );
};

/** Children rotated `deg` clockwise around `pivot` (source pixels). */
const Joint: React.FC<{ pivot: Point; deg: number; s: number; children: React.ReactNode }> = ({ pivot, deg, s, children }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      transform: `rotate(${deg}deg)`,
      transformOrigin: `${(pivot[0] - MASCOT_RIG.centerX) * s}px ${(pivot[1] - MASCOT_RIG.feetY) * s}px`,
    }}
  >
    {children}
  </div>
);

const MascotFace: React.FC<{ s: number; expression: Expression; mouth: number; eyes: number; uid: string }> = ({ s, expression, mouth, eyes, uid }) => {
  const head = MASCOT_RIG.parts.head;
  const { colors } = MASCOT_RIG;
  const talking = mouth > 0.04;
  // The drawn open smile, squashed toward its top lip for smaller mouths.
  const m = MASCOT_RIG.parts.mouth;
  const top = MASCOT_RIG.mouthTop;
  const angle = (Math.atan2(top.y1 - top.y0, top.x1 - top.x0) * 180) / Math.PI;
  const open = talking ? 0.22 + 0.78 * Math.min(1, mouth) : MASCOT_MOUTH[expression];
  const pivot = [(top.x0 + top.x1) / 2 - m.x, (top.y0 + top.y1) / 2 - m.y];
  const closed = eyes < 0.35;
  const lid = closed ? 1 : Math.max(MASCOT_LIDS[expression], 1 - eyes);
  return (
    <>
      {(["brow-left", "brow-right"] as const).map((name, i) => {
        const b = MASCOT_BROWS[expression][i];
        const p = MASCOT_RIG.parts[name];
        const side = i === 0 ? 1 : -1;
        return (
          <MascotImg
            key={name}
            name={name}
            s={s}
            style={{ transform: `translateY(${b.dy * s}px) rotate(${side * b.rot}deg)`, transformOrigin: `${(p.w / 2) * s}px ${(p.h / 2) * s}px` }}
          />
        );
      })}
      {open !== undefined && (
        <MascotImg
          name="mouth"
          s={s}
          style={{ transform: `rotate(${angle}deg) scaleY(${open}) rotate(${-angle}deg)`, transformOrigin: `${pivot[0] * s}px ${pivot[1] * s}px` }}
        />
      )}
      <svg
        width={head.w * s}
        height={head.h * s}
        viewBox={`${head.x} ${head.y} ${head.w} ${head.h}`}
        style={{ position: "absolute", left: (head.x - MASCOT_RIG.centerX) * s, top: (head.y - MASCOT_RIG.feetY) * s, overflow: "visible" }}
      >
        {open === undefined && expression === "sad" && <path d="M 444 392 Q 475 371 506 389" stroke={colors.mouth} strokeWidth={8} strokeLinecap="round" fill="none" />}
        {open === undefined && expression === "surprised" && (
          <g>
            <ellipse cx={474} cy={386} rx={15} ry={19} fill={colors.mouth} />
            <ellipse cx={474} cy={397} rx={9} ry={6} fill={colors.tongue} />
          </g>
        )}
        {MASCOT_RIG.eyes.map((e, i) => {
          const side = i === 0 ? 1 : -1;
          const y0 = e.cy - e.ry - 5;
          const lidY = y0 + (e.ry * 2 + 10) * lid;
          const tilt = expression === "angry" ? side * 14 : expression === "sad" ? side * -12 : 0;
          return (
            <g key={i}>
              <clipPath id={`${uid}-eye${i}`}>
                <ellipse cx={e.cx} cy={e.cy} rx={e.rx + 4} ry={e.ry + 4} />
              </clipPath>
              {lid > 0.01 && (
                <g clipPath={`url(#${uid}-eye${i})`}>
                  <rect x={e.cx - e.rx - 10} y={y0 - 24} width={(e.rx + 10) * 2} height={lidY - y0 + 24} fill={MASCOT_SKIN} transform={`rotate(${tilt} ${e.cx} ${lidY})`} />
                </g>
              )}
              {closed && (
                <path d={`M ${e.cx - e.rx - 1} ${e.cy + 2} Q ${e.cx} ${e.cy + e.ry * 0.7} ${e.cx + e.rx + 1} ${e.cy + 2}`} stroke={colors.pupil} strokeWidth={5} strokeLinecap="round" fill="none" />
              )}
            </g>
          );
        })}
      </svg>
    </>
  );
};

const Mascot: React.FC<PuppetProps & { eyes: number; width: number }> = ({ action, expression, t, mouth, eyes, facing, height, width, seed = 0 }) => {
  const uid = `fed${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const unit = height / 380;
  const s = (unit * MASCOT_UNITS) / (MASCOT_RIG.feetY - MASCOT_RIG.top);
  const pose = mascotPose(action, expression, t + seed * 0.37);
  const y = bob(action, t + seed * 0.37) * unit;
  const flip = facing === "left" ? -1 : 1;
  return (
    <div style={{ position: "relative", width, height }}>
      <div style={{ position: "absolute", left: width / 2, top: unit * 366, width: 0, height: 0, transform: `translateY(${y}px) scaleX(${flip}) rotate(${pose.sway}deg)` }}>
        <Joint pivot={MASCOT_RIG.shoulder} deg={pose.armDown} s={s}>
          <MascotImg name="arm-down" s={s} />
        </Joint>
        <Joint pivot={MASCOT_RIG.elbow} deg={pose.armUp} s={s}>
          <MascotImg name="arm-up" s={s} />
        </Joint>
        <MascotImg name="body" s={s} />
        <Joint pivot={MASCOT_RIG.neck} deg={pose.head} s={s}>
          <MascotImg name="head" s={s} />
          <MascotFace s={s} expression={expression} mouth={mouth} eyes={eyes} uid={uid} />
        </Joint>
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
  if (member.kind === "mascot") return <Mascot {...props} eyes={eyes} width={height * (200 / 380)} />;
  return (
    <svg width={height * (200 / 380)} height={height} viewBox="-100 -366 200 380" style={{ overflow: "visible" }}>
      <g transform={`translate(0 ${y}) scale(${flip} 1)`}>
        <Human {...props} eyes={eyes} />
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
