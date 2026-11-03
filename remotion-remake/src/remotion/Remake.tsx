import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { TransitionName, VideoSpec } from "../spec/schema";
import { computeTimeline } from "../spec/timeline";
import { Background } from "./components";
import { useFontFamily } from "./fonts";
import { Sfx, SpecContext, useLayout, withAlpha } from "./helpers";
import { SceneView } from "./scenes";

function transitionElement(name: TransitionName, durationInFrames: number, key: string) {
  const timing = linearTiming({ durationInFrames });
  switch (name) {
    case "slide-left":
      return <TransitionSeries.Transition key={key} presentation={slide({ direction: "from-right" })} timing={timing} />;
    case "slide-up":
      return <TransitionSeries.Transition key={key} presentation={slide({ direction: "from-bottom" })} timing={timing} />;
    case "wipe":
      return <TransitionSeries.Transition key={key} presentation={wipe({ direction: "from-left" })} timing={timing} />;
    case "flip":
      return <TransitionSeries.Transition key={key} presentation={flip()} timing={timing} />;
    default:
      return <TransitionSeries.Transition key={key} presentation={fade()} timing={timing} />;
  }
}

const ProgressBar: React.FC<{ total: number; color: string }> = ({ total, color }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12 * u, background: "rgba(255,255,255,0.12)" }}>
      <div style={{ width: `${(frame / total) * 100}%`, height: "100%", background: color, boxShadow: `0 0 ${16 * u}px ${withAlpha(color, 0.8)}` }} />
    </div>
  );
};

/** ElevenLabs voice-over: each clip starts when its scene becomes fully visible. */
const Voiceover: React.FC<{ spec: VideoSpec; start: number[] }> = ({ spec, start }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {(spec.voiceover ?? []).map((clip) =>
        start[clip.scene] === undefined ? null : (
          <Sequence key={clip.src} from={start[clip.scene]} durationInFrames={Math.ceil(clip.durationSec * fps) + 1} layout="none">
            <Html5Audio src={staticFile(clip.src)} />
          </Sequence>
        ),
      )}
    </>
  );
};

export const Remake: React.FC<VideoSpec> = (spec) => {
  const { theme, scenes } = spec;
  const fontFamily = useFontFamily(theme.font);
  const { u } = useLayout();
  const t = computeTimeline(spec);

  const children: React.ReactNode[] = [];
  scenes.forEach((scene, i) => {
    if (t.trans[i] > 0) children.push(transitionElement(scene.transition, t.trans[i], `t${i}`));
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={t.seq[i]}>
        <Background
          colors={scene.background.length ? scene.background : theme.bgColors}
          style={theme.bgStyle}
          frameOffset={t.start[i] - t.trans[i]}
        />
        <SceneView scene={scene} dur={t.base[i]} />
      </TransitionSeries.Sequence>,
    );
  });

  return (
    <SpecContext.Provider value={{ theme, locale: spec.meta.language }}>
      <AbsoluteFill style={{ fontFamily, color: theme.textColor, background: theme.bgColors[0] }}>
        <TransitionSeries>{children}</TransitionSeries>
        <Voiceover spec={spec} start={t.start} />
        {scenes.map((s, i) => (i > 0 && t.trans[i] > 0 ? <Sfx key={i} name="whoosh" at={t.start[i] - t.trans[i]} volume={0.35} /> : null))}
        {theme.progressBar && <ProgressBar total={t.total} color={theme.accent} />}
        {theme.watermark.trim() && (
          <div style={{ position: "absolute", right: 40 * u, bottom: 40 * u, fontSize: 32 * u, fontWeight: 700, opacity: 0.7 }}>{theme.watermark}</div>
        )}
      </AbsoluteFill>
    </SpecContext.Provider>
  );
};
