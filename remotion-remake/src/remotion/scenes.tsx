import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "../spec/schema";
import { AnimatedText, Emoji, Panel, Stage, textRevealFrames } from "./components";
import { formatNumber, isVietnamese, onColor, Sfx, useLayout, useMotion, useSpec, withAlpha } from "./helpers";

type Of<T extends Scene["type"]> = Extract<Scene, { type: T }>;
type SceneProps<T extends Scene["type"]> = { scene: Of<T>; dur: number };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const shadow = "0 6px 30px rgba(0,0,0,0.35)";

/** Shrinks long headings so they keep fitting. */
const fit = (text: string, size: number) => (text.length > 120 ? size * 0.7 : text.length > 70 ? size * 0.8 : text.length > 35 ? size * 0.9 : size);

/** Scales a list of delays down so the last one lands before `limit`. */
const squeeze = (delays: number[], limit: number) => {
  const last = delays[delays.length - 1] ?? 0;
  return last > limit && last > 0 ? delays.map((d) => Math.round((d * limit) / last)) : delays;
};

export const TitleScene: React.FC<SceneProps<"title">> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const { theme } = useSpec();
  const { enter, stagger } = useMotion();
  const headDelay = scene.emoji.trim() ? 8 : 2;
  const subDelay = headDelay + textRevealFrames(scene.heading, "word-by-word", stagger);
  return (
    <Stage>
      <Emoji char={scene.emoji} size={190 * u} />
      <AnimatedText
        text={scene.heading}
        animation="word-by-word"
        delay={headDelay}
        style={{ fontSize: fit(scene.heading, 120 * u), fontWeight: 900, lineHeight: 1.1, textShadow: shadow }}
      />
      <div style={{ width: 240 * u * enter(frame, subDelay - 6), height: 14 * u, borderRadius: 7 * u, background: theme.accent }} />
      {scene.subheading.trim() && (
        <AnimatedText
          text={scene.subheading}
          animation="slide-up"
          delay={subDelay}
          style={{ fontSize: fit(scene.subheading, 54 * u), fontWeight: 600, opacity: 0.9 }}
        />
      )}
    </Stage>
  );
};

const TEXT_SIZES = { md: 64, lg: 84, xl: 110 };

export const TextScene: React.FC<SceneProps<"text">> = ({ scene, dur }) => {
  const { u } = useLayout();
  const { stagger } = useMotion();
  const first = scene.emoji.trim() ? 8 : 2;
  const raw: number[] = [];
  let acc = first;
  for (const line of scene.lines) {
    raw.push(acc);
    acc += textRevealFrames(line, scene.animation, stagger) + 4;
  }
  const delays = squeeze(raw, dur * 0.6);
  const size = TEXT_SIZES[scene.size] * u;
  return (
    <Stage align={scene.align}>
      <Emoji char={scene.emoji} size={160 * u} />
      {scene.lines.map((line, i) => (
        <AnimatedText
          key={i}
          text={line}
          animation={scene.animation}
          delay={delays[i]}
          highlight={scene.highlight}
          style={{ fontSize: fit(line, size), fontWeight: 800, lineHeight: 1.2, textShadow: shadow }}
        />
      ))}
    </Stage>
  );
};

export const ListItemScene: React.FC<SceneProps<"list-item">> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const { theme } = useSpec();
  const { enter } = useMotion();
  const p = enter(frame, 0);
  const rank = scene.rank.trim();
  return (
    <Stage>
      <Sfx name="pop" at={2} volume={0.5} />
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 50 * u }}>
        {rank && (
          <div
            style={{
              minWidth: 250 * u,
              height: 250 * u,
              padding: `0 ${30 * u}px`,
              borderRadius: 125 * u,
              background: theme.primary,
              color: onColor(theme.primary),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: (rank.length > 3 ? 90 : 130) * u,
              fontWeight: 900,
              boxShadow: `0 0 0 ${14 * u}px ${withAlpha(theme.primary, 0.25)}, ${shadow}`,
              transform: `scale(${p}) rotate(${(1 - p) * -90}deg)`,
              flexShrink: 0,
            }}
          >
            {rank}
          </div>
        )}
        <Panel delay={6} style={{ maxWidth: vertical ? "100%" : 1100 * u, textAlign: vertical ? "center" : "left" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: vertical ? "center" : "flex-start", gap: 24 * u }}>
            <Emoji char={scene.emoji} size={130 * u} delay={10} />
            <AnimatedText
              text={scene.heading}
              animation="word-by-word"
              delay={10}
              style={{ fontSize: fit(scene.heading, 80 * u), fontWeight: 900, lineHeight: 1.15 }}
            />
            {scene.body.trim() && (
              <AnimatedText text={scene.body} animation="fade" delay={24} style={{ fontSize: fit(scene.body, 46 * u), fontWeight: 500, opacity: 0.85, lineHeight: 1.35 }} />
            )}
          </div>
        </Panel>
      </div>
    </Stage>
  );
};

const Ring: React.FC<{ progress: number; size: number; color: string; children?: React.ReactNode }> = ({
  progress,
  size,
  color,
  children,
}) => {
  const stroke = size * 0.09;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 900 }}>
        {children}
      </div>
    </div>
  );
};

export const QuizScene: React.FC<SceneProps<"quiz">> = ({ scene, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();
  const { theme } = useSpec();
  const { enter } = useMotion();
  const optStart = 14;
  const timerStart = optStart + scene.options.length * 6 + 6;
  const thinkFrames = Math.max(fps, Math.min(Math.round(scene.thinkSec * fps), dur - timerStart - Math.round(fps * 1.2)));
  const reveal = timerStart + thinkFrames;
  const revealed = frame >= reveal;
  const remaining = Math.ceil((reveal - Math.max(frame, timerStart)) / fps);
  const timerP = interpolate(frame, [timerStart, reveal], [1, 0], clamp);
  const ticks = Array.from({ length: Math.max(0, Math.floor(thinkFrames / fps)) }, (_, i) => timerStart + i * fps);
  const letters = ["A", "B", "C", "D"];

  return (
    <Stage gap={36}>
      {ticks.map((t) => (
        <Sfx key={t} name="tick" at={t} volume={0.45} />
      ))}
      <Sfx name="ding" at={reveal} volume={0.7} />
      <Panel style={{ width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 * u }}>
          <Emoji char={scene.emoji} size={110 * u} delay={4} />
          <AnimatedText text={scene.question} animation="word-by-word" delay={4} style={{ fontSize: fit(scene.question, 70 * u), fontWeight: 900, lineHeight: 1.2 }} />
        </div>
      </Panel>
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: vertical || scene.options.length < 3 ? "1fr" : "1fr 1fr",
          gap: 26 * u,
        }}
      >
        {scene.options.map((opt, i) => {
          const p = enter(frame, optStart + i * 6);
          const correct = i === scene.correctIndex;
          const pulse = revealed && correct ? 1 + 0.06 * Math.sin(((frame - reveal) / fps) * Math.PI * 3) * Math.exp(-(frame - reveal) / fps) : 1;
          const bg = revealed ? (correct ? "#22C55E" : withAlpha(theme.panel, 0.6)) : withAlpha(theme.panel, 0.92);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26 * u,
                padding: `${26 * u}px ${32 * u}px`,
                borderRadius: 28 * u,
                background: bg,
                color: revealed && correct ? "#FFFFFF" : undefined,
                border: `${3 * u}px solid ${revealed && correct ? "#86EFAC" : withAlpha("#FFFFFF", 0.1)}`,
                opacity: (revealed && !correct ? 0.45 : 1) * Math.min(1, p * 1.5),
                transform: `translateX(${(1 - p) * (i % 2 ? 120 : -120) * u}px) scale(${pulse})`,
                boxShadow: shadow,
              }}
            >
              <div
                style={{
                  width: 76 * u,
                  height: 76 * u,
                  borderRadius: 38 * u,
                  flexShrink: 0,
                  background: revealed && correct ? "#FFFFFF" : theme.primary,
                  color: revealed && correct ? "#16A34A" : onColor(theme.primary),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 42 * u,
                }}
              >
                {revealed && correct ? "✓" : letters[i]}
              </div>
              <div style={{ fontSize: fit(opt, 50 * u), fontWeight: 700, lineHeight: 1.2 }}>{opt}</div>
            </div>
          );
        })}
      </div>
      <div style={{ height: 190 * u, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!revealed ? (
          <div style={{ opacity: enter(frame, timerStart - 6), transform: `scale(${1 + 0.05 * Math.sin(frame / 4)})` }}>
            <Ring progress={timerP} size={170 * u} color={theme.accent}>
              {remaining}
            </Ring>
          </div>
        ) : (
          scene.explanation.trim() && (
            <AnimatedText text={scene.explanation} animation="slide-up" delay={reveal + 8} style={{ fontSize: fit(scene.explanation, 46 * u), fontWeight: 600, lineHeight: 1.3 }} />
          )
        )}
      </div>
    </Stage>
  );
};

export const BarChartScene: React.FC<SceneProps<"bar-chart">> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const { theme, locale } = useSpec();
  const { enter } = useMotion();
  const max = Math.max(...scene.bars.map((b) => b.value), 1);
  const palette = [theme.primary, theme.accent, "#22D3EE", "#F472B6", "#A3E635", "#FB923C"];
  const decimals = scene.bars.some((b) => !Number.isInteger(b.value)) ? 1 : 0;
  const rowH = Math.min(110, 760 / Math.max(scene.bars.length, 1)) * u;
  return (
    <Stage gap={50}>
      <AnimatedText text={scene.heading} animation="word-by-word" style={{ fontSize: fit(scene.heading, 76 * u), fontWeight: 900, lineHeight: 1.15, textShadow: shadow }} />
      <Panel delay={4} style={{ width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: rowH * 0.3 }}>
          {scene.bars.map((bar, i) => {
            const start = 12 + i * 6;
            const grow = interpolate(frame, [start, start + fps * 1.1], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            const color = bar.color || palette[i % palette.length];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 24 * u, opacity: enter(frame, start - 4) }}>
                <div style={{ width: "28%", fontSize: Math.min(44 * u, rowH * 0.45), fontWeight: 700, textAlign: "right", lineHeight: 1.1 }}>{bar.label}</div>
                <div style={{ flex: 1, height: rowH * 0.62, background: "rgba(255,255,255,0.08)", borderRadius: rowH * 0.31, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${(bar.value / max) * 100 * grow}%`,
                      height: "100%",
                      borderRadius: rowH * 0.31,
                      background: `linear-gradient(90deg, ${withAlpha(color, 0.75)}, ${color})`,
                    }}
                  />
                </div>
                <div style={{ width: "20%", fontSize: Math.min(44 * u, rowH * 0.45), fontWeight: 900, color: theme.accent }}>
                  {formatNumber(bar.value * grow, locale, decimals)}
                  {scene.unit}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </Stage>
  );
};

export const BigNumberScene: React.FC<SceneProps<"big-number">> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const { theme, locale } = useSpec();
  const { enter } = useMotion();
  const count = interpolate(frame, [6, 6 + fps * 1.4], [0, scene.value], { ...clamp, easing: Easing.out(Easing.exp) });
  const done = frame >= 6 + fps * 1.4;
  const text = `${scene.prefix}${formatNumber(done ? scene.value : count, locale, scene.decimals)}${scene.suffix}`;
  return (
    <Stage gap={30}>
      <div
        style={{
          fontSize: fit(text, 230 * u),
          fontWeight: 900,
          color: theme.accent,
          lineHeight: 1,
          textShadow: `0 0 ${60 * u}px ${withAlpha(theme.accent, 0.55)}`,
          transform: `scale(${0.7 + 0.3 * enter(frame, 0)})`,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {text}
      </div>
      <AnimatedText text={scene.label} animation="slide-up" delay={18} style={{ fontSize: fit(scene.label, 62 * u), fontWeight: 700, lineHeight: 1.25 }} />
    </Stage>
  );
};

export const QuoteScene: React.FC<SceneProps<"quote">> = ({ scene, dur }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const { theme } = useSpec();
  const { enter, stagger } = useMotion();
  const authorDelay = Math.min(10 + textRevealFrames(scene.text, "word-by-word", stagger), dur * 0.7);
  return (
    <Stage gap={30}>
      <div style={{ fontSize: 300 * u, lineHeight: 0.6, height: 150 * u, color: theme.accent, fontFamily: "Georgia, serif", opacity: enter(frame, 0), transform: `scale(${enter(frame, 0)})` }}>
        “
      </div>
      <AnimatedText text={scene.text} animation="word-by-word" delay={8} style={{ fontSize: fit(scene.text, 76 * u), fontWeight: 700, lineHeight: 1.3, fontStyle: "italic", textShadow: shadow }} />
      {scene.author.trim() && (
        <div style={{ display: "flex", alignItems: "center", gap: 20 * u, opacity: enter(frame, authorDelay) }}>
          <div style={{ width: 70 * u * enter(frame, authorDelay), height: 6 * u, background: theme.accent, borderRadius: 3 * u }} />
          <div style={{ fontSize: 46 * u, fontWeight: 600, opacity: 0.9 }}>{scene.author}</div>
        </div>
      )}
    </Stage>
  );
};

export const TimelineScene: React.FC<SceneProps<"timeline">> = ({ scene, dur }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const { theme } = useSpec();
  const { enter } = useMotion();
  const n = Math.max(scene.events.length, 1);
  const step = Math.max(6, Math.min(24, (dur * 0.65 - 14) / n));
  const line = interpolate(frame, [10, 10 + step * n], [0, 1], clamp);
  return (
    <Stage gap={50}>
      <AnimatedText text={scene.heading} animation="word-by-word" style={{ fontSize: fit(scene.heading, 76 * u), fontWeight: 900, textShadow: shadow }} />
      <div style={{ position: "relative", alignSelf: "stretch", paddingLeft: 90 * u }}>
        <div style={{ position: "absolute", left: 30 * u, top: 0, width: 8 * u, borderRadius: 4 * u, height: `${line * 100}%`, background: theme.primary }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 34 * u }}>
          {scene.events.map((ev, i) => {
            const p = enter(frame, 12 + i * step);
            return (
              <div key={i} style={{ position: "relative", opacity: Math.min(1, p * 1.4), transform: `translateX(${(1 - p) * 80 * u}px)`, textAlign: "left" }}>
                <div style={{ position: "absolute", left: -74 * u, top: 10 * u, width: 40 * u, height: 40 * u, borderRadius: 20 * u, background: theme.accent, transform: `scale(${p})`, boxShadow: `0 0 0 ${8 * u}px ${withAlpha(theme.accent, 0.25)}` }} />
                <div style={{ fontSize: 40 * u, fontWeight: 900, color: theme.accent }}>{ev.time}</div>
                <div style={{ fontSize: fit(ev.label, 50 * u), fontWeight: 600, lineHeight: 1.25 }}>{ev.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

export const CountdownScene: React.FC<SceneProps<"countdown">> = ({ scene, dur }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const { theme } = useSpec();
  const per = dur / scene.from;
  const idx = Math.min(scene.from - 1, Math.floor(frame / per));
  const local = (frame - idx * per) / per;
  const scale = interpolate(local, [0, 0.15, 1], [1.5, 1, 0.9], clamp);
  return (
    <Stage gap={40}>
      {Array.from({ length: scene.from }, (_, i) => (
        <Sfx key={i} name="tick" at={i * per} volume={0.5} />
      ))}
      {scene.label.trim() && <AnimatedText text={scene.label} animation="pop" style={{ fontSize: fit(scene.label, 66 * u), fontWeight: 800 }} />}
      <Ring progress={1 - local} size={420 * u} color={theme.accent}>
        <span style={{ transform: `scale(${scale})`, display: "inline-block", fontSize: 1.3 * 180 * u }}>{scene.from - idx}</span>
      </Ring>
    </Stage>
  );
};

export const ComparisonScene: React.FC<SceneProps<"comparison">> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const { theme } = useSpec();
  const { enter } = useMotion();
  const side = (s: Of<"comparison">["left"], i: number) => (
    <Panel delay={8 + i * 6} style={{ flex: 1, width: vertical ? "100%" : undefined, borderTop: `${10 * u}px solid ${i ? theme.accent : theme.primary}` }}>
      <div style={{ fontSize: fit(s.title, 60 * u), fontWeight: 900, marginBottom: 18 * u, color: i ? theme.accent : theme.primary }}>{s.title}</div>
      {s.points.map((pt, j) => {
        const p = enter(frame, 20 + j * 8 + i * 4);
        return (
          <div key={j} style={{ fontSize: fit(pt, 42 * u), fontWeight: 600, lineHeight: 1.35, opacity: p, transform: `translateY(${(1 - p) * 20 * u}px)`, marginTop: 10 * u }}>
            • {pt}
          </div>
        );
      })}
    </Panel>
  );
  const vs = enter(frame, 14);
  return (
    <Stage gap={36}>
      {scene.heading.trim() && <AnimatedText text={scene.heading} animation="word-by-word" style={{ fontSize: fit(scene.heading, 72 * u), fontWeight: 900, textShadow: shadow }} />}
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 30 * u, width: "100%" }}>
        {side(scene.left, 0)}
        <div
          style={{
            width: 140 * u,
            height: 140 * u,
            borderRadius: 70 * u,
            flexShrink: 0,
            background: theme.accent,
            color: onColor(theme.accent),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56 * u,
            fontWeight: 900,
            transform: `scale(${vs}) rotate(${(1 - vs) * 180}deg)`,
            boxShadow: shadow,
          }}
        >
          {scene.vsLabel || "VS"}
        </div>
        {side(scene.right, 1)}
      </div>
    </Stage>
  );
};

const CTA_LABELS = {
  vi: { subscribe: ["ĐĂNG KÝ", "ĐÃ ĐĂNG KÝ", "🔔"], follow: ["THEO DÕI", "ĐANG THEO DÕI", "➕"], like: ["THÍCH", "ĐÃ THÍCH", "👍"] },
  en: { subscribe: ["SUBSCRIBE", "SUBSCRIBED", "🔔"], follow: ["FOLLOW", "FOLLOWING", "➕"], like: ["LIKE", "LIKED", "👍"] },
} as const;

export const OutroScene: React.FC<SceneProps<"outro">> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const { theme, locale } = useSpec();
  const { enter, stagger } = useMotion();
  const btnDelay = 8 + textRevealFrames(scene.heading, "word-by-word", stagger);
  const clickAt = btnDelay + Math.round(fps * 1.1);
  const clicked = frame >= clickAt;
  const press = interpolate(frame, [clickAt - 4, clickAt, clickAt + 6], [1, 0.9, 1], clamp);
  const labels = CTA_LABELS[isVietnamese(locale) ? "vi" : "en"];
  return (
    <Stage gap={40}>
      <AnimatedText text={scene.heading} animation="word-by-word" delay={4} style={{ fontSize: fit(scene.heading, 96 * u), fontWeight: 900, lineHeight: 1.15, textShadow: shadow }} />
      {scene.subheading.trim() && <AnimatedText text={scene.subheading} animation="fade" delay={btnDelay - 6} style={{ fontSize: fit(scene.subheading, 50 * u), fontWeight: 600, opacity: 0.9 }} />}
      {scene.cta !== "none" && (
        <>
          <Sfx name="pop" at={clickAt} volume={0.6} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20 * u,
              padding: `${30 * u}px ${60 * u}px`,
              borderRadius: 60 * u,
              background: clicked ? "#3F3F46" : scene.cta === "subscribe" ? "#FF0033" : theme.primary,
              color: "#FFFFFF",
              fontSize: 54 * u,
              fontWeight: 900,
              letterSpacing: 2 * u,
              transform: `scale(${enter(frame, btnDelay) * press})`,
              boxShadow: shadow,
            }}
          >
            <span style={{ display: "inline-block", transform: `rotate(${clicked ? Math.sin((frame - clickAt) / 2) * 18 * Math.exp(-(frame - clickAt) / 20) : 0}deg)` }}>
              {labels[scene.cta][2]}
            </span>
            {labels[scene.cta][clicked ? 1 : 0]}
          </div>
          <div
            style={{
              position: "relative",
              marginTop: -70 * u,
              left: 120 * u,
              fontSize: 90 * u,
              opacity: interpolate(frame, [btnDelay + 6, btnDelay + 14, clickAt + 20, clickAt + 30], [0, 1, 1, 0], clamp),
              transform: `translate(${interpolate(frame, [btnDelay + 6, clickAt - 4], [200, 0], clamp) * u}px, ${interpolate(frame, [btnDelay + 6, clickAt - 4], [140, 0], clamp) * u}px) scale(${press})`,
            }}
          >
            👆
          </div>
        </>
      )}
      {scene.handle.trim() && <div style={{ fontSize: 46 * u, fontWeight: 700, color: theme.accent, opacity: enter(frame, btnDelay + 4) }}>{scene.handle}</div>}
    </Stage>
  );
};

export const SceneView: React.FC<{ scene: Scene; dur: number }> = ({ scene, dur }) => {
  switch (scene.type) {
    case "title":
      return <TitleScene scene={scene} dur={dur} />;
    case "text":
      return <TextScene scene={scene} dur={dur} />;
    case "list-item":
      return <ListItemScene scene={scene} dur={dur} />;
    case "quiz":
      return <QuizScene scene={scene} dur={dur} />;
    case "bar-chart":
      return <BarChartScene scene={scene} dur={dur} />;
    case "big-number":
      return <BigNumberScene scene={scene} dur={dur} />;
    case "quote":
      return <QuoteScene scene={scene} dur={dur} />;
    case "timeline":
      return <TimelineScene scene={scene} dur={dur} />;
    case "countdown":
      return <CountdownScene scene={scene} dur={dur} />;
    case "comparison":
      return <ComparisonScene scene={scene} dur={dur} />;
    case "outro":
      return <OutroScene scene={scene} dur={dur} />;
  }
};
