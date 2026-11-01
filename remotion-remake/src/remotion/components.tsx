import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { TextAnimation, Theme } from "../spec/schema";
import { normWord, useLayout, useMotion, useSpec, withAlpha } from "./helpers";

/** `frameOffset` keeps the animated background continuous across scene cuts. */
export const Background: React.FC<{ colors: string[]; style: Theme["bgStyle"]; frameOffset?: number }> = ({
  colors,
  style,
  frameOffset = 0,
}) => {
  const frame = useCurrentFrame() + frameOffset;
  const { u } = useLayout();
  const [c0, c1 = c0, c2 = c1] = colors;
  const drift = frame * 0.35;

  const pattern =
    style === "grid"
      ? {
          backgroundImage: `linear-gradient(${withAlpha("#FFFFFF", 0.06)} 2px, transparent 2px), linear-gradient(90deg, ${withAlpha("#FFFFFF", 0.06)} 2px, transparent 2px)`,
          backgroundSize: `${90 * u}px ${90 * u}px`,
          backgroundPosition: `${drift}px ${drift}px`,
        }
      : style === "dots"
        ? {
            backgroundImage: `radial-gradient(${withAlpha("#FFFFFF", 0.12)} ${3 * u}px, transparent ${3.5 * u}px)`,
            backgroundSize: `${60 * u}px ${60 * u}px`,
            backgroundPosition: `${drift}px ${-drift}px`,
          }
        : null;

  const base =
    style === "solid"
      ? c0
      : style === "radial"
        ? `radial-gradient(circle at 50% 40%, ${c1} 0%, ${c0} 75%)`
        : `linear-gradient(${160 + Math.sin(frame / 90) * 12}deg, ${c0} 0%, ${c1} 60%, ${c2} 100%)`;

  return (
    <AbsoluteFill style={{ background: base }}>
      {style === "blobs" &&
        [c1, c2, c1].map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 1100 * u,
              height: 1100 * u,
              // A soft radial gradient instead of filter: blur(), which is very slow in headless Chrome.
              background: `radial-gradient(circle, ${withAlpha(c, 0.6)} 0%, ${withAlpha(c, 0.25)} 35%, transparent 70%)`,
              left: `${[10, 55, 30][i] + Math.sin(frame / (60 + i * 25) + i) * 12}%`,
              top: `${[5, 45, 75][i] + Math.cos(frame / (70 + i * 20) + i) * 8}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      {pattern && <AbsoluteFill style={pattern} />}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)" }} />
    </AbsoluteFill>
  );
};

type AnimatedTextProps = {
  text: string;
  animation: TextAnimation;
  delay?: number;
  highlight?: string[];
  style?: React.CSSProperties;
};

/** Frames AnimatedText needs before the whole text is visible. */
export function textRevealFrames(text: string, animation: TextAnimation, stagger: number) {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (animation === "word-by-word") return words * stagger + 10;
  if (animation === "typewriter") return Math.ceil(text.length / 1.3) + 6;
  return 14;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({ text, animation, delay = 0, highlight = [], style }) => {
  const frame = useCurrentFrame();
  const { theme } = useSpec();
  const { enter, stagger } = useMotion();
  const marks = new Set(highlight.flatMap((h) => h.split(/\s+/)).map(normWord).filter(Boolean));

  const renderWord = (word: string, i: number, appear: number) => {
    const hot = marks.has(normWord(word));
    return (
      <span
        key={i}
        style={{
          display: "inline-block",
          position: "relative",
          zIndex: 0,
          opacity: appear,
          transform: animation === "word-by-word" ? `translateY(${(1 - appear) * 30}%) scale(${0.85 + 0.15 * appear})` : undefined,
          color: hot ? theme.accent : undefined,
          marginRight: "0.28em",
        }}
      >
        {hot && (
          <span
            style={{
              position: "absolute",
              left: "-0.08em",
              right: "-0.08em",
              bottom: "0.06em",
              height: "0.32em",
              background: withAlpha(theme.accent, 0.25),
              borderRadius: "0.1em",
              transformOrigin: "left",
              transform: `scaleX(${interpolate(appear, [0.6, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
              zIndex: -1,
            }}
          />
        )}
        {word}
      </span>
    );
  };

  const words = text.split(/\s+/).filter(Boolean);

  if (animation === "typewriter") {
    const chars = Math.max(0, Math.floor((frame - delay) * 1.3));
    const shown = text.slice(0, chars);
    const cursorOn = Math.floor(frame / 8) % 2 === 0 || chars < text.length;
    return (
      <div style={style}>
        {shown.split(/(\s+)/).map((part, i) => (/\s+/.test(part) ? part : renderWord(part, i, 1)))}
        <span style={{ opacity: cursorOn && frame >= delay ? 1 : 0, color: theme.accent }}>|</span>
      </div>
    );
  }

  if (animation === "word-by-word") {
    return <div style={style}>{words.map((w, i) => renderWord(w, i, enter(frame, delay + i * stagger)))}</div>;
  }

  const p = enter(frame, delay);
  const transform =
    animation === "pop"
      ? `scale(${0.6 + 0.4 * p})`
      : animation === "slide-up"
        ? `translateY(${(1 - p) * 80}px)`
        : undefined;
  return (
    <div style={{ ...style, opacity: Math.min(1, p * 1.4), transform }}>{words.map((w, i) => renderWord(w, i, 1))}</div>
  );
};

/** Emoji that pops in and keeps floating. */
export const Emoji: React.FC<{ char: string; size: number; delay?: number }> = ({ char, size, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { enter } = useMotion();
  if (!char.trim()) return null;
  const p = enter(frame, delay);
  return (
    <div
      style={{
        fontSize: size,
        lineHeight: 1,
        transform: `scale(${p}) translateY(${Math.sin((frame - delay) / 12) * size * 0.04}px) rotate(${(1 - p) * -25}deg)`,
      }}
    >
      {char}
    </div>
  );
};

export const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; delay?: number }> = ({
  children,
  style,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { theme } = useSpec();
  const { u } = useLayout();
  const { enter } = useMotion();
  const p = enter(frame, delay);
  return (
    <div
      style={{
        background: withAlpha(theme.panel, 0.88),
        borderRadius: 36 * u,
        padding: `${48 * u}px ${56 * u}px`,
        boxShadow: `0 ${24 * u}px ${60 * u}px rgba(0,0,0,0.35)`,
        border: `${2 * u}px solid ${withAlpha("#FFFFFF", 0.08)}`,
        opacity: Math.min(1, p * 1.5),
        transform: `translateY(${(1 - p) * 60 * u}px) scale(${0.94 + 0.06 * p})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Full-frame centered column with safe margins. */
export const Stage: React.FC<{ children: React.ReactNode; align?: "center" | "left"; gap?: number }> = ({
  children,
  align = "center",
  gap = 40,
}) => {
  const { u, vertical } = useLayout();
  return (
    <AbsoluteFill
      style={{
        padding: vertical ? `${200 * u}px ${80 * u}px` : `${90 * u}px ${160 * u}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align,
        gap: gap * u,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
