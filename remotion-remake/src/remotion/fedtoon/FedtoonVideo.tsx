// "Fedtoon" composition: renders a storyboard (src/spec/storyboard.ts).
// Each shot = background (OpenAI image, or a backdrop drawn in code) with a
// camera move, floating particles, code-drawn characters with lip-sync, props,
// on-screen text, karaoke captions, voice-over and sound effects.
import React from "react";
import { AbsoluteFill, Easing, Html5Audio, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { BRAND_FONT, BRAND_NAME, MOODS, PALETTE } from "../../fedtoon/brand";
import type { VoiceClip } from "../../spec/schema";
import { imageRef, storyboardTimeline, type Prop, type Shot, type ShotCharacter, type Storyboard } from "../../spec/storyboard";
import { useFontFamily } from "../fonts";
import { mouthAt, Puppet } from "./Puppet";

const POS_X: Record<string, number> = { "far-left": 0.14, left: 0.3, center: 0.5, right: 0.7, "far-right": 0.86, top: 0.5, bottom: 0.5 };

function useBox() {
  const { width, height } = useVideoConfig();
  return { width, height, vertical: height >= width, u: Math.min(width, height) / 1080 };
}

// ---------- background ----------

/** Drawn in code when the shot has no generated image yet (also the Studio preview). */
const Backdrop: React.FC<{ mood: Shot["background"]["mood"]; seed: number }> = ({ mood, seed }) => {
  const { width, height } = useBox();
  const m = MOODS[mood] ?? MOODS.night;
  const starry = mood === "night" || mood === "space";
  const r = (i: number) => random(`${seed}-${i}`);
  const hill = (y: number, amp: number, phase: number) => {
    let d = `M 0 ${height} L 0 ${y}`;
    for (let x = 0; x <= width; x += width / 8) d += ` Q ${x + width / 16} ${y - amp * Math.sin(phase + x / 220)} ${x + width / 8} ${y}`;
    return `${d} L ${width} ${height} Z`;
  };
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${m.sky[0]} 0%, ${m.sky[1]} 100%)` }}>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id={`glow-${seed}`}>
            <stop offset="0%" stopColor={m.glow} stopOpacity={0.95} />
            <stop offset="35%" stopColor={m.glow} stopOpacity={0.35} />
            <stop offset="100%" stopColor={m.glow} stopOpacity={0} />
          </radialGradient>
        </defs>
        {starry &&
          Array.from({ length: 70 }, (_, i) => <circle key={i} cx={r(i) * width} cy={r(i + 100) * height * 0.7} r={1 + r(i + 200) * 2.6} fill="#FFFFFF" opacity={0.25 + r(i + 300) * 0.6} />)}
        <circle cx={width * (0.25 + r(1) * 0.5)} cy={height * (0.18 + r(2) * 0.12)} r={Math.min(width, height) * 0.36} fill={`url(#glow-${seed})`} />
        <circle cx={width * (0.25 + r(1) * 0.5)} cy={height * (0.18 + r(2) * 0.12)} r={Math.min(width, height) * 0.07} fill={m.glow} opacity={mood === "indoor" || mood === "abstract" ? 0 : 0.95} />
        {mood === "indoor" ? (
          <>
            <rect x={width * 0.08} y={height * 0.14} width={width * 0.34} height={height * 0.22} rx={24} fill={PALETTE.sky} opacity={0.18} />
            <rect x={width * 0.58} y={height * 0.2} width={width * 0.3} height={height * 0.34} rx={24} fill={PALETTE.amber} opacity={0.12} />
            <rect x={0} y={height * 0.78} width={width} height={height * 0.22} fill={m.ground} />
            <rect x={0} y={height * 0.78} width={width} height={height * 0.012} fill="#FFFFFF" opacity={0.12} />
          </>
        ) : mood === "abstract" ? (
          Array.from({ length: 6 }, (_, i) => <circle key={i} cx={r(i + 400) * width} cy={r(i + 500) * height} r={(0.08 + r(i + 600) * 0.2) * width} fill={[PALETTE.teal, PALETTE.purple, PALETTE.coral][i % 3]} opacity={0.18} />)
        ) : (
          <>
            <path d={hill(height * 0.7, height * 0.05, seed)} fill={m.ground} opacity={0.6} />
            <path d={hill(height * 0.8, height * 0.035, seed + 2)} fill={m.ground} />
            <path d={hill(height * 0.9, height * 0.02, seed + 4)} fill={PALETTE.night} opacity={0.7} />
          </>
        )}
      </svg>
    </AbsoluteFill>
  );
};

/** Camera move over the whole shot: scale and pan of the background layer. */
function camera(kind: Shot["camera"], p: number, frame: number, fps: number) {
  const e = Easing.inOut(Easing.cubic)(p);
  switch (kind) {
    case "zoom-in":
      return { scale: 1.02 + 0.12 * e, x: 0, y: 0 };
    case "zoom-out":
      return { scale: 1.14 - 0.12 * e, x: 0, y: 0 };
    case "pan-left":
      return { scale: 1.14, x: 5 - 10 * e, y: 0 };
    case "pan-right":
      return { scale: 1.14, x: -5 + 10 * e, y: 0 };
    case "pan-up":
      return { scale: 1.14, x: 0, y: 5 - 10 * e };
    case "pan-down":
      return { scale: 1.14, x: 0, y: -5 + 10 * e };
    case "shake": {
      const k = Math.max(0, 1 - frame / (fps * 0.6));
      return { scale: 1.08, x: Math.sin(frame * 2.1) * 1.4 * k, y: Math.cos(frame * 2.7) * 1.2 * k };
    }
    default:
      return { scale: 1.04 + 0.01 * e, x: 0, y: 0 };
  }
}

const Particles: React.FC<{ seed: number; color: string }> = ({ seed, color }) => {
  const frame = useCurrentFrame();
  const { width, height, u } = useBox();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 22 }, (_, i) => {
        const r = (k: number) => random(`p-${seed}-${i}-${k}`);
        const speed = 0.25 + r(1) * 0.6;
        const y = (((r(2) * height - frame * speed * u) % height) + height) % height;
        const x = r(3) * width + Math.sin(frame / (40 + r(4) * 40) + i) * 18 * u;
        const size = (3 + r(5) * 7) * u;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: "50%", background: color, opacity: 0.18 + r(6) * 0.35, boxShadow: `0 0 ${size * 2}px ${color}` }} />;
      })}
    </AbsoluteFill>
  );
};

// ---------- props, characters, text ----------

const PropView: React.FC<{ prop: Prop; src?: string; index: number }> = ({ prop, src, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, height } = useBox();
  const size = { small: 0.2, medium: 0.3, large: 0.42 }[prop.scale] * width;
  const x = POS_X[prop.position] * width;
  const y = (prop.position === "top" ? 0.24 : prop.position === "bottom" ? 0.62 : 0.4) * height;
  const enter = spring({ frame: frame - 4 - index * 5, fps, config: { damping: 12, stiffness: 120 } });
  const t = frame / fps;
  const motion =
    prop.motion === "float"
      ? `translateY(${Math.sin(t * 1.4 + index) * 14}px)`
      : prop.motion === "spin"
        ? `rotate(${t * 40}deg)`
        : prop.motion === "pulse"
          ? `scale(${1 + Math.sin(t * 4) * 0.05})`
          : "";
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, transform: `scale(${prop.motion === "none" ? 1 : enter}) ${motion}`, filter: `drop-shadow(0 ${size * 0.05}px ${size * 0.08}px rgba(0,0,0,0.35))` }}>
      {src ? (
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, ${PALETTE.mint}, ${PALETTE.teal} 45%, ${PALETTE.indigo} 100%)`, boxShadow: `0 0 ${size * 0.25}px ${PALETTE.teal}` }} />
      )}
    </div>
  );
};

const CharacterView: React.FC<{ sb: Storyboard; ch: ShotCharacter; index: number; mouth: number; speaking: boolean }> = ({ sb, ch, index, mouth, speaking }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, height, vertical } = useBox();
  const member = sb.cast.find((c) => c.id === ch.castId);
  if (!member) return null;
  const h = (vertical ? { small: 0.22, medium: 0.3, large: 0.4 } : { small: 0.36, medium: 0.5, large: 0.66 })[ch.scale] * height;
  const x = POS_X[ch.position] * width;
  const feet = height * (vertical ? 0.86 : 0.93);
  const pop = spring({ frame: frame - index * 4, fps, config: { damping: 11, stiffness: 140 } });
  const slideIn = interpolate(spring({ frame: frame - index * 4, fps, config: { damping: 200 } }), [0, 1], [x < width / 2 ? -width * 0.4 : width * 0.4, 0]);
  const opacity = ch.enter === "fade" ? interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const transform = ch.enter === "pop" ? `scale(${pop})` : ch.enter === "slide-in" ? `translateX(${slideIn}px)` : "";
  // A character who speaks but was given no gesture talks with its hands.
  const action = speaking && ch.action === "idle" ? "talk" : ch.action;
  const walkX = ch.action === "walk" ? (frame / fps) * (ch.facing === "left" ? -60 : 60) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: x - h * 0.5 + walkX,
        top: feet - h,
        width: h,
        height: h,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        opacity,
        transform,
        transformOrigin: "50% 100%",
        // A faint light rim and a soft shadow keep characters readable on any background.
        filter: `drop-shadow(0 0 ${h * 0.012}px rgba(255,255,255,0.55)) drop-shadow(0 ${h * 0.02}px ${h * 0.04}px rgba(5,9,28,0.45))`,
      }}
    >
      <Puppet member={member} action={action} expression={ch.expression} facing={ch.facing} t={frame / fps} mouth={mouth} height={h} seed={index + sb.cast.indexOf(member) * 3} />
    </div>
  );
};

const OnScreenText: React.FC<{ text: Shot["text"] }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, height } = useBox();
  if (text.style === "none" || !text.content.trim()) return null;
  const enter = spring({ frame: frame - 3, fps, config: { damping: 14, stiffness: 140 } });
  const top = { top: 0.1, center: 0.36, bottom: 0.6 }[text.position] * height;
  const base: React.CSSProperties = { position: "absolute", left: 60 * u, right: 60 * u, top, display: "flex", justifyContent: "center", transform: `translateY(${(1 - enter) * 40 * u}px) scale(${0.85 + enter * 0.15})`, opacity: enter };
  if (text.style === "title")
    return (
      <div style={base}>
        <div style={{ textAlign: "center", fontSize: 92 * u, fontWeight: 900, lineHeight: 1.05, color: PALETTE.white, textShadow: `0 ${6 * u}px ${24 * u}px rgba(0,0,0,0.45)` }}>
          {text.content}
          <div style={{ height: 14 * u, width: `${60 * enter}%`, margin: `${14 * u}px auto 0`, borderRadius: 99, background: PALETTE.amber }} />
        </div>
      </div>
    );
  if (text.style === "big-number")
    return (
      <div style={base}>
        <div style={{ fontSize: 190 * u, fontWeight: 900, color: PALETTE.yellow, textShadow: `0 0 ${40 * u}px ${PALETTE.amber}` }}>{text.content}</div>
      </div>
    );
  if (text.style === "label")
    return (
      <div style={base}>
        <div style={{ fontSize: 52 * u, fontWeight: 800, color: PALETTE.ink, background: PALETTE.amber, padding: `${12 * u}px ${34 * u}px`, borderRadius: 99, boxShadow: `0 ${8 * u}px ${24 * u}px rgba(0,0,0,0.35)` }}>{text.content}</div>
      </div>
    );
  return (
    <div style={base}>
      <div style={{ fontSize: 50 * u, fontWeight: 800, color: PALETTE.white, background: "rgba(11,22,51,0.72)", padding: `${14 * u}px ${30 * u}px`, borderRadius: 24 * u, textAlign: "center" }}>{text.content}</div>
    </div>
  );
};

/** Karaoke captions: the current phrase, with the word being said highlighted. */
const Captions: React.FC<{ narration: string; clip?: VoiceClip; duration: number }> = ({ narration, clip, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, height } = useBox();
  const t = frame / fps;
  const words =
    clip?.words.length
      ? clip.words
      : (() => {
          // No timings (voice off or no alignment): spread the words evenly.
          const list = narration.split(/\s+/).filter(Boolean);
          const span = (clip?.durationSec ?? duration) / Math.max(1, list.length);
          return list.map((text, i) => ({ text, start: i * span, end: (i + 1) * span }));
        })();
  if (!words.length) return null;
  const chunks: (typeof words)[] = [];
  for (const w of words) {
    const cur = chunks[chunks.length - 1];
    if (cur && cur.length < 4 && w.start - cur[cur.length - 1].end < 0.35) cur.push(w);
    else chunks.push([w]);
  }
  const chunk = chunks.find((c) => t < c[c.length - 1].end + 0.15) ?? (t <= words[words.length - 1].end + 0.6 ? chunks[chunks.length - 1] : null);
  if (!chunk) return null;
  return (
    <div style={{ position: "absolute", left: 50 * u, right: 50 * u, top: height * 0.9, transform: "translateY(-50%)", display: "flex", justifyContent: "center" }}>
      <div style={{ fontSize: 58 * u, fontWeight: 900, lineHeight: 1.2, textAlign: "center", color: PALETTE.white, padding: `${10 * u}px ${26 * u}px`, borderRadius: 22 * u, background: "rgba(10,16,36,0.55)", textShadow: `0 ${3 * u}px ${10 * u}px rgba(0,0,0,0.5)` }}>
        {chunk.map((w, i) => (
          <span key={i} style={{ color: t >= w.start && t <= w.end + 0.08 ? PALETTE.yellow : PALETTE.white }}>
            {w.text}
            {i < chunk.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

const Watermark: React.FC = () => {
  const { u } = useBox();
  return (
    <div style={{ position: "absolute", left: 40 * u, top: 40 * u, display: "flex", alignItems: "center", gap: 12 * u, opacity: 0.88 }}>
      <svg width={54 * u} height={54 * u} viewBox="-30 -36 60 66">
        <line x1={-8} y1={-18} x2={-10} y2={-30} stroke={PALETTE.teal} strokeWidth={3} strokeLinecap="round" />
        <line x1={8} y1={-18} x2={10} y2={-30} stroke={PALETTE.teal} strokeWidth={3} strokeLinecap="round" />
        <circle cx={-10} cy={-31} r={4} fill={PALETTE.yellow} />
        <circle cx={10} cy={-31} r={4} fill={PALETTE.yellow} />
        <circle cx={0} cy={0} r={26} fill={PALETTE.teal} />
        <circle cx={-9} cy={-3} r={4.5} fill="#141022" />
        <circle cx={9} cy={-3} r={4.5} fill="#141022" />
        <path d="M -7 8 Q 0 14 7 8" stroke="#141022" strokeWidth={3} fill="none" strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: 38 * u, fontWeight: 900, color: PALETTE.white, letterSpacing: 0.5, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>{BRAND_NAME}</div>
    </div>
  );
};

// ---------- shot ----------

const ShotView: React.FC<{ sb: Storyboard; shot: Shot; index: number; frames: number; clip?: VoiceClip }> = ({ sb, shot, index, frames, clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg = sb.images[imageRef("bg", shot.background.prompt)];
  const cam = camera(shot.camera, Math.min(1, frame / Math.max(1, frames)), frame, fps);
  const t = frame / fps;
  const mouth = clip ? mouthAt(t, clip.words, clip.durationSec) : 0;
  const glow = (MOODS[shot.background.mood] ?? MOODS.night).glow;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: PALETTE.night }}>
      <AbsoluteFill style={{ transform: `scale(${cam.scale}) translate(${cam.x}%, ${cam.y}%)` }}>
        {bg ? <Img src={staticFile(bg)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Backdrop mood={shot.background.mood} seed={index + 1} />}
      </AbsoluteFill>
      <Particles seed={index} color={glow} />
      <AbsoluteFill style={{ transform: `translate(${cam.x * 0.4}%, ${cam.y * 0.4}%)` }}>
        {shot.props.map((p, i) => (
          <PropView key={i} prop={p} index={i} src={sb.images[imageRef("prop", p.prompt)]} />
        ))}
        {shot.characters.map((c, i) => (
          <CharacterView key={c.castId + i} sb={sb} ch={c} index={i} speaking={shot.speaker === c.castId && !!clip} mouth={shot.speaker === c.castId ? mouth : 0} />
        ))}
      </AbsoluteFill>
      <OnScreenText text={shot.text} />
      {sb.captions && shot.narration && <Captions narration={shot.narration} clip={clip} duration={frames / fps} />}
      {/* vignette */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(5,9,28,0.55) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

function transitionFor(name: Shot["transition"], frames: number, key: string) {
  const timing = linearTiming({ durationInFrames: frames });
  if (name === "slide") return <TransitionSeries.Transition key={key} presentation={slide({ direction: "from-right" })} timing={timing} />;
  if (name === "wipe") return <TransitionSeries.Transition key={key} presentation={wipe({ direction: "from-left" })} timing={timing} />;
  return <TransitionSeries.Transition key={key} presentation={fade()} timing={timing} />;
}

export const FedtoonVideo: React.FC<Storyboard> = (sb) => {
  const fontFamily = useFontFamily(BRAND_FONT);
  const tl = storyboardTimeline(sb);
  const clipOf = (i: number) => sb.voiceover.find((c) => c.scene === i);
  const children: React.ReactNode[] = [];
  sb.shots.forEach((shot, i) => {
    if (tl.trans[i] > 0) children.push(transitionFor(shot.transition, tl.trans[i], `t${i}`));
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={tl.seq[i]}>
        <ShotView sb={sb} shot={shot} index={i} frames={tl.seq[i]} clip={clipOf(i)} />
      </TransitionSeries.Sequence>,
    );
  });
  return (
    <AbsoluteFill style={{ fontFamily, background: PALETTE.night }}>
      <TransitionSeries>{children}</TransitionSeries>
      <Watermark />
      {sb.shots.map((shot, i) => {
        const clip = clipOf(i);
        return (
          <React.Fragment key={i}>
            {clip && (
              <Sequence from={tl.start[i]} durationInFrames={Math.ceil(clip.durationSec * sb.meta.fps) + 1} layout="none">
                <Html5Audio src={staticFile(clip.src)} />
              </Sequence>
            )}
            {[...shot.sfx, ...(i > 0 && tl.trans[i] > 0 ? ["whoosh" as const] : [])].map((name, k) => (
              <Sequence key={k} from={Math.max(0, tl.start[i] - (name === "whoosh" ? tl.trans[i] : 0))} durationInFrames={Math.round(sb.meta.fps * 1.5)} layout="none">
                <Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={name === "whoosh" ? 0.25 : 0.5} />
              </Sequence>
            ))}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
