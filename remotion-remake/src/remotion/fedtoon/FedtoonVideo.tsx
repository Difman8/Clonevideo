// "Fedtoon" composition: renders a storyboard (src/spec/storyboard.ts).
// Look: flat vivid colors, no drop shadows, no glow, no vignette.
import React from "react";
import { AbsoluteFill, Easing, Html5Audio, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { BRAND_FONT, BRAND_NAME, PALETTE, type ColorName } from "../../fedtoon/brand";
import { deltaE } from "../../fedtoon/contrast";
import type { VoiceClip } from "../../spec/schema";
import { bgRef, imageRef, storyboardTimeline, type Prop, type Shot, type ShotCharacter, type Storyboard } from "../../spec/storyboard";
import { useFontFamily } from "../fonts";
import { mouthAt, Puppet } from "./Puppet";

const POS_X: Record<string, number> = { "far-left": 0.14, left: 0.3, center: 0.5, right: 0.7, "far-right": 0.86, top: 0.5, bottom: 0.5 };
const hex = (names: readonly ColorName[]) => names.map((n) => PALETTE[n] ?? PALETTE.plum);

function useBox() {
  const { width, height } = useVideoConfig();
  return { width, height, vertical: height >= width, u: Math.min(width, height) / 1080 };
}

/** Mix a color toward white (k > 0) or black (k < 0): flat light/dark variants for layered shapes. */
function tint(c: string, k: number) {
  const n = parseInt(c.slice(1, 7), 16);
  const t = k > 0 ? 255 : 0;
  const a = Math.abs(k);
  return `#${[16, 8, 0].map((s) => Math.round(((n >> s) & 255) + (t - ((n >> s) & 255)) * a).toString(16).padStart(2, "0")).join("")}`;
}

/** Readable text color (ink or white) on top of `bg`. */
const onColor = (bg: string) => (deltaE(bg, PALETTE.ink) > deltaE(bg, PALETTE.white) ? PALETTE.ink : PALETTE.white);

/** Of `choices`, the color most different from `against`. */
const mostDifferent = (choices: string[], against: string) => choices.reduce((a, b) => (deltaE(b, against) > deltaE(a, against) ? b : a));

// ---------- background ----------

/** Flat backdrop drawn in code (no image yet, or Studio preview), in the shot's background colors. */
const Backdrop: React.FC<{ bg: Shot["background"]; seed: number }> = ({ bg, seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useBox();
  const [c0, c1 = tint(c0, 0.25)] = hex(bg.colors.length ? bg.colors : ["plum", "violet"]);
  const r = (i: number) => random(`${seed}-${i}`);
  const hill = (y: number, amp: number, phase: number) => {
    let d = `M 0 ${height} L 0 ${y}`;
    for (let x = 0; x <= width; x += width / 6) d += ` Q ${x + width / 12} ${y - amp * (0.6 + 0.4 * Math.sin(phase + x / 180))} ${x + width / 6} ${y}`;
    return `${d} L ${width} ${height} Z`;
  };
  // Sun / moon on one side, below the on-screen text area.
  const sunX = width * (r(1) < 0.5 ? 0.2 : 0.8);
  const sunY = height * (0.25 + r(2) * 0.05);
  const S = Math.min(width, height);
  let shapes: React.ReactNode;
  switch (bg.mood) {
    case "night":
    case "space":
      shapes = (
        <>
          {Array.from({ length: 60 }, (_, i) => (
            <circle key={i} cx={r(i + 10) * width} cy={r(i + 100) * height * 0.75} r={(1.5 + r(i + 200) * 3) * (S / 1080)} fill={PALETTE.white} opacity={0.35 + 0.5 * Math.abs(Math.sin(frame / 20 + i))} />
          ))}
          <circle cx={sunX} cy={sunY} r={S * 0.09} fill={bg.mood === "space" ? c1 : PALETTE.cream} />
          {bg.mood === "night" && <path d={hill(height * 0.82, height * 0.03, seed)} fill={tint(c0, 0.18)} />}
        </>
      );
      break;
    case "indoor":
      shapes = (
        <>
          <rect x={width * 0.1} y={height * 0.16} width={width * 0.32} height={height * 0.2} rx={S * 0.02} fill={tint(c0, 0.22)} />
          <rect x={width * 0.12} y={height * 0.175} width={width * 0.28} height={height * 0.17} rx={S * 0.015} fill={PALETTE.sky} />
          <rect x={width * 0.58} y={height * 0.22} width={width * 0.3} height={height * 0.3} rx={S * 0.02} fill={tint(c0, -0.15)} />
          <rect x={0} y={height * 0.78} width={width} height={height * 0.22} fill={c1} />
          <rect x={0} y={height * 0.78} width={width} height={height * 0.015} fill={tint(c1, 0.25)} />
        </>
      );
      break;
    case "abstract":
      // Rays rotating slowly around a point: flat stripes in the two background colors.
      shapes = (
        <g transform={`rotate(${frame * 0.25} ${width / 2} ${height * 0.42})`}>
          {Array.from({ length: 16 }, (_, i) => {
            const a0 = (i / 16) * Math.PI * 2;
            const a1 = ((i + 0.5) / 16) * Math.PI * 2;
            const R = Math.hypot(width, height);
            const cx = width / 2;
            const cy = height * 0.42;
            return <path key={i} d={`M ${cx} ${cy} L ${cx + Math.cos(a0) * R} ${cy + Math.sin(a0) * R} L ${cx + Math.cos(a1) * R} ${cy + Math.sin(a1) * R} Z`} fill={c1} />;
          })}
        </g>
      );
      break;
    default:
      // day / sunset: flat sky, flat sun, three flat hills in shades of the second color.
      shapes = (
        <>
          <circle cx={sunX} cy={sunY} r={S * 0.1} fill={bg.mood === "sunset" ? PALETTE.amber : PALETTE.yellow} />
          <path d={hill(height * 0.66, height * 0.05, seed)} fill={tint(c1, 0.22)} />
          <path d={hill(height * 0.76, height * 0.04, seed + 2)} fill={c1} />
          <path d={hill(height * 0.88, height * 0.025, seed + 4)} fill={tint(c1, -0.22)} />
        </>
      );
  }
  return (
    <AbsoluteFill style={{ background: c0 }}>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {shapes}
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

// ---------- props, characters, text ----------

const PropView: React.FC<{ prop: Prop; src?: string; index: number; bgColor: string }> = ({ prop, src, index, bgColor }) => {
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
  // Placeholder while the picture is missing: a flat "spotlight" circle with a ring.
  const fill = mostDifferent([PALETTE.plum, PALETTE.lime, PALETTE.magenta, PALETTE.cyan], bgColor);
  const ring = mostDifferent([PALETTE.magenta, PALETTE.yellow, PALETTE.cyan, PALETTE.lime], fill);
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, transform: `scale(${prop.motion === "none" ? 1 : enter}) ${motion}` }}>
      {src ? (
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: fill, border: `${size * 0.035}px solid ${ring}`, boxSizing: "border-box" }} />
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
  // Subjects sit around the middle of the frame; subtitles go below their feet.
  const feet = height * (vertical ? 0.8 : 0.9);
  const pop = spring({ frame: frame - index * 4, fps, config: { damping: 11, stiffness: 140 } });
  const slideIn = interpolate(spring({ frame: frame - index * 4, fps, config: { damping: 200 } }), [0, 1], [x < width / 2 ? -width * 0.4 : width * 0.4, 0]);
  const opacity = ch.enter === "fade" ? interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const transform = ch.enter === "pop" ? `scale(${pop})` : ch.enter === "slide-in" ? `translateX(${slideIn}px)` : "";
  // A character who speaks but was given no gesture talks with its hands.
  const action = speaking && ch.action === "idle" ? "talk" : ch.action;
  const walkX = ch.action === "walk" ? (frame / fps) * (ch.facing === "left" ? -60 : 60) : 0;
  return (
    <div style={{ position: "absolute", left: x - h * 0.5 + walkX, top: feet - h, width: h, height: h, opacity, transform, transformOrigin: "50% 100%" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
        <Puppet member={member} action={action} expression={ch.expression} facing={ch.facing} t={frame / fps} mouth={mouth} height={h} seed={index + sb.cast.indexOf(member) * 3} />
      </div>
    </div>
  );
};

/** Text with stacked outlines (no shadow): `strokes` from outermost to innermost, widths in px. */
const Outlined: React.FC<{ children: string; fill: string; strokes: { color: string; width: number }[]; style: React.CSSProperties }> = ({ children, fill, strokes, style }) => (
  <div style={{ position: "relative", ...style }}>
    {strokes.map((s, i) => (
      <div key={i} aria-hidden style={{ position: i === 0 ? "relative" : "absolute", inset: 0, color: s.color, WebkitTextStroke: `${s.width}px ${s.color}` }}>
        {children}
      </div>
    ))}
    <div style={{ position: strokes.length ? "absolute" : "relative", inset: 0, color: fill }}>{children}</div>
  </div>
);

const OnScreenText: React.FC<{ text: Shot["text"]; bgColor: string }> = ({ text, bgColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, height } = useBox();
  if (text.style === "none" || !text.content.trim()) return null;
  const enter = spring({ frame: frame - 3, fps, config: { damping: 14, stiffness: 140 } });
  const top = { top: 0.1, center: 0.36, bottom: 0.6 }[text.position] * height;
  const base: React.CSSProperties = { position: "absolute", left: 60 * u, right: 60 * u, top, display: "flex", justifyContent: "center", transform: `scale(${0.6 + enter * 0.4})`, opacity: Math.min(1, enter * 1.5) };
  if (text.style === "title")
    return (
      <div style={base}>
        <Outlined
          fill={PALETTE.purple}
          strokes={[
            { color: PALETTE.cyan, width: 34 * u },
            { color: PALETTE.yellow, width: 18 * u },
          ]}
          style={{ textAlign: "center", fontSize: 104 * u, fontWeight: 900, lineHeight: 1.08 }}
        >
          {text.content}
        </Outlined>
      </div>
    );
  if (text.style === "big-number")
    return (
      <div style={base}>
        <Outlined fill={PALETTE.yellow} strokes={[{ color: PALETTE.plum, width: 26 * u }]} style={{ fontSize: 200 * u, fontWeight: 900, lineHeight: 1 }}>
          {text.content}
        </Outlined>
      </div>
    );
  if (text.style === "label") {
    // A solid block in the color that stands out most against the background.
    const block = mostDifferent([PALETTE.lime, PALETTE.magenta, PALETTE.yellow, PALETTE.cyan], bgColor);
    return (
      <div style={base}>
        <div style={{ fontSize: 66 * u, fontWeight: 900, color: block === PALETTE.magenta ? PALETTE.yellow : PALETTE.plum, background: block, padding: `${10 * u}px ${30 * u}px`, borderRadius: 8 * u }}>{text.content}</div>
      </div>
    );
  }
  // caption: a dark rounded box with white text (numbers, facts).
  const box = deltaE(bgColor, PALETTE.plum) > 25 ? PALETTE.plum : PALETTE.navy;
  return (
    <div style={base}>
      <div style={{ fontSize: 48 * u, fontWeight: 800, color: onColor(box), background: box, padding: `${16 * u}px ${36 * u}px`, borderRadius: 60 * u, textAlign: "center", lineHeight: 1.2 }}>{text.content}</div>
    </div>
  );
};

/** Subtitles: a few words at a time, white with a thin dark outline, no box. */
const Captions: React.FC<{ narration: string; clip?: VoiceClip; duration: number }> = ({ narration, clip, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, height, vertical } = useBox();
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
    if (cur && cur.length < 3 && w.start - cur[cur.length - 1].end < 0.3 && !/[.,!?;:]$/.test(cur[cur.length - 1].text)) cur.push(w);
    else chunks.push([w]);
  }
  const chunk = chunks.find((c) => t < c[c.length - 1].end + 0.1) ?? (t <= words[words.length - 1].end + 0.5 ? chunks[chunks.length - 1] : null);
  if (!chunk) return null;
  return (
    <div style={{ position: "absolute", left: 60 * u, right: 60 * u, top: height * (vertical ? 0.835 : 0.86), display: "flex", justifyContent: "center" }}>
      <Outlined fill={PALETTE.white} strokes={[{ color: "rgba(18,10,36,0.85)", width: 7 * u }]} style={{ fontSize: 56 * u, fontWeight: 700, textAlign: "center", lineHeight: 1.15 }}>
        {chunk.map((w) => w.text).join(" ")}
      </Outlined>
    </div>
  );
};

const Watermark: React.FC = () => {
  const { u } = useBox();
  return (
    <div style={{ position: "absolute", left: 40 * u, top: 40 * u, display: "flex", alignItems: "center", gap: 12 * u, opacity: 0.9 }}>
      <svg width={54 * u} height={54 * u} viewBox="-30 -36 60 66">
        <line x1={-8} y1={-18} x2={-10} y2={-30} stroke={PALETTE.teal} strokeWidth={3} strokeLinecap="round" />
        <line x1={8} y1={-18} x2={10} y2={-30} stroke={PALETTE.teal} strokeWidth={3} strokeLinecap="round" />
        <circle cx={-10} cy={-31} r={4} fill={PALETTE.yellow} />
        <circle cx={10} cy={-31} r={4} fill={PALETTE.yellow} />
        <circle cx={0} cy={0} r={26} fill={PALETTE.teal} />
        <circle cx={-9} cy={-3} r={6} fill={PALETTE.white} />
        <circle cx={9} cy={-3} r={6} fill={PALETTE.white} />
        <circle cx={-8} cy={-2} r={3} fill={PALETTE.ink} />
        <circle cx={10} cy={-2} r={3} fill={PALETTE.ink} />
        <path d="M -7 9 Q 0 14 7 9" stroke={PALETTE.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
      </svg>
      <Outlined fill={PALETTE.white} strokes={[{ color: PALETTE.ink, width: 6 * u }]} style={{ fontSize: 38 * u, fontWeight: 900 }}>
        {BRAND_NAME}
      </Outlined>
    </div>
  );
};

// ---------- shot ----------

const ShotView: React.FC<{ sb: Storyboard; shot: Shot; index: number; frames: number; clip?: VoiceClip }> = ({ sb, shot, index, frames, clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = bgRef(shot.background);
  const bg = sb.images[ref];
  const cam = camera(shot.camera, Math.min(1, frame / Math.max(1, frames)), frame, fps);
  const t = frame / fps;
  const mouth = clip ? mouthAt(t, clip.words, clip.durationSec) : 0;
  const [c0] = hex(shot.background.colors.length ? shot.background.colors : ["plum", "violet"]);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: c0 }}>
      <AbsoluteFill style={{ transform: `scale(${cam.scale}) translate(${cam.x}%, ${cam.y}%)` }}>
        {bg ? <Img src={staticFile(bg)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Backdrop bg={shot.background} seed={index + 1} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${cam.x * 0.4}%, ${cam.y * 0.4}%)` }}>
        {shot.props.map((p, i) => (
          <PropView key={i} prop={p} index={i} src={sb.images[imageRef("prop", p.prompt)]} bgColor={c0} />
        ))}
        {shot.characters.map((c, i) => (
          <CharacterView key={c.castId + i} sb={sb} ch={c} index={i} speaking={shot.speaker === c.castId && !!clip} mouth={shot.speaker === c.castId ? mouth : 0} />
        ))}
      </AbsoluteFill>
      <OnScreenText text={shot.text} bgColor={c0} />
      {sb.captions && shot.narration && <Captions narration={shot.narration} clip={clip} duration={frames / fps} />}
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
