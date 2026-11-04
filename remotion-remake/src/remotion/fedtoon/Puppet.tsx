// Fedtoon characters drawn in code (SVG): consistent in every video, free to
// render, and fully animatable. Flat shapes, no outlines, a darker side for
// volume and a soft rim light, in the brand palette.
import React from "react";
import { HAIR_COLORS, PALETTE, SKIN } from "../../fedtoon/brand";
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
const Face: React.FC<{ cx: number; cy: number; r: number; expression: Expression; mouth: number; eyesOpen: number; look: number; mascot?: boolean }> = ({
  cx,
  cy,
  r,
  expression,
  mouth,
  eyesOpen,
  look,
  mascot,
}) => {
  const eyeR = mascot ? r * 0.17 : r * 0.12;
  const eyeY = cy - r * (mascot ? 0.12 : 0.05);
  const gap = r * (mascot ? 0.36 : 0.34);
  const surprised = expression === "surprised";
  const thinking = expression === "thinking";
  const eyeScale = (surprised ? 1.25 : 1) * eyesOpen;
  const lookY = thinking ? -eyeR * 0.6 : 0;
  const brow = { neutral: 0, happy: -6, sad: 16, surprised: -12, angry: -20, thinking: 8 }[expression];
  const browY = eyeY - eyeR * (surprised ? 2.6 : 2.1);
  const mouthY = cy + r * (mascot ? 0.32 : 0.42);
  const mw = r * (mascot ? 0.3 : 0.26);
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
      {[-1, 1].map((side) => (
        <g key={side}>
          <ellipse cx={cx + side * gap + look} cy={eyeY + lookY} rx={eyeR} ry={eyeR * eyeScale} fill="#141022" />
          {eyesOpen > 0.5 && <circle cx={cx + side * gap + look + eyeR * 0.35} cy={eyeY + lookY - eyeR * 0.35} r={eyeR * 0.32} fill="#FFFFFF" />}
          <rect
            x={cx + side * gap + look - eyeR * 1.2}
            y={browY - r * 0.025}
            width={eyeR * 2.4}
            height={r * 0.06}
            rx={r * 0.03}
            fill="#141022"
            opacity={mascot ? 0 : 0.85}
            transform={`rotate(${side * brow} ${cx + side * gap + look} ${browY})`}
          />
          <ellipse cx={cx + side * (gap + eyeR * 0.9) + look} cy={eyeY + r * 0.3} rx={r * 0.12} ry={r * 0.07} fill="#FF6F91" opacity={0.35} />
        </g>
      ))}
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
        <Face cx={0} cy={headY} r={headR} expression={expression} mouth={mouth} eyesOpen={eyes} look={look} />
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
        {/* rim light */}
        <path d={`M ${-headR * 0.75} ${headY - headR * 0.66} A ${headR} ${headR} 0 0 1 ${headR * 0.2} ${headY - headR * 0.98}`} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={4} fill="none" strokeLinecap="round" />
      </g>
      {/* front arm */}
      <Limb x={44} y={-184} angle={a.front} elbow={a.frontElbow} len={92} w={24} color={coat ? PALETTE.cream : light(outfit, 0.06)} hand={skin} />
    </g>
  );
};

// ---------- Fed, the mascot ----------
const Fed: React.FC<PuppetProps & { eyes: number }> = ({ member, action, expression, t, mouth, eyes, facing }) => {
  const body = PALETTE[member.outfit] ?? PALETTE.teal;
  const a = arms(action, t);
  const squash = action === "jump" ? 1 + Math.min(0, wave(t, 1.1)) * -0.06 : 1 + wave(t, 0.5) * 0.015;
  const look = facing === "left" ? -10 : facing === "right" ? 10 : 0;
  const glow = 0.6 + wave(t, 0.6) * 0.25;
  const cy = -118;
  const r = 102;
  return (
    <g transform={`translate(0 0) scale(${1 / squash} ${squash}) `}>
      {/* antennae */}
      {[-1, 1].map((s) => (
        <g key={s} transform={`rotate(${s * (14 + wave(t, 0.7, s * 0.25) * 6)} ${s * 30} ${cy - r * 0.85})`}>
          <line x1={s * 30} y1={cy - r * 0.85} x2={s * 34} y2={cy - r * 1.32} stroke={shade(body, 0.15)} strokeWidth={9} strokeLinecap="round" />
          <circle cx={s * 34} cy={cy - r * 1.36} r={15} fill={PALETTE.amber} opacity={0.35 * glow} />
          <circle cx={s * 34} cy={cy - r * 1.36} r={10} fill={PALETTE.yellow} />
        </g>
      ))}
      {/* feet */}
      <ellipse cx={-36} cy={-8} rx={26} ry={14} fill={shade(body, 0.3)} />
      <ellipse cx={36} cy={-8} rx={26} ry={14} fill={shade(body, 0.3)} />
      {/* back arm */}
      <Limb x={-r * 0.82} y={cy + 4} angle={-a.back} len={58} w={22} color={shade(body, 0.2)} />
      {/* body */}
      <ellipse cx={0} cy={cy} rx={r} ry={r * 0.94} fill={body} />
      <path d={`M ${r * 0.1} ${cy - r * 0.93} A ${r} ${r * 0.94} 0 0 1 ${r * 0.1} ${cy + r * 0.93} A ${r * 0.85} ${r * 0.94} 0 0 0 ${r * 0.1} ${cy - r * 0.93} Z`} fill={shade(body, 0.12)} />
      <ellipse cx={-4} cy={cy + r * 0.38} rx={r * 0.52} ry={r * 0.4} fill={light(body, 0.45)} opacity={0.75} />
      <path d={`M ${-r * 0.78} ${cy - r * 0.45} A ${r} ${r * 0.94} 0 0 1 ${-r * 0.05} ${cy - r * 0.93}`} stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Face cx={0} cy={cy - r * 0.08} r={r * 0.78} expression={expression} mouth={mouth} eyesOpen={eyes} look={look} mascot />
      {member.accessory === "glasses" && (
        <g fill="none" stroke="#141022" strokeWidth={4.5} opacity={0.85}>
          <circle cx={-28 + look} cy={cy - 20} r={20} />
          <circle cx={28 + look} cy={cy - 20} r={20} />
        </g>
      )}
      {/* front arm */}
      <Limb x={r * 0.82} y={cy + 4} angle={a.front} elbow={a.frontElbow} len={58} w={22} color={light(body, 0.08)} />
    </g>
  );
};

/** A cast member standing with its feet at the bottom-center of the box. */
export const Puppet: React.FC<PuppetProps> = (props) => {
  const { member, action, t, height, facing, seed = 0 } = props;
  const eyes = blink(t, seed);
  const y = bob(action, t + seed * 0.37);
  const mascot = member.kind === "mascot";
  const flip = facing === "left" ? -1 : 1;
  return (
    <svg width={height * (200 / 380)} height={height} viewBox="-100 -366 200 380" style={{ overflow: "visible" }}>
      <ellipse cx={0} cy={6} rx={mascot ? 88 : 64} ry={12} fill="#000" opacity={0.22} />
      <g transform={`translate(0 ${y}) scale(${flip} 1)`}>{mascot ? <Fed {...props} eyes={eyes} /> : <Human {...props} eyes={eyes} />}</g>
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
