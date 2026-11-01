import React from "react";
import { Composition } from "remotion";
import type { VideoSpec } from "../spec/schema";
import { computeTimeline } from "../spec/timeline";
import { Remake } from "./Remake";
import { sampleSpec } from "./sample";

export const Root: React.FC = () => (
  <Composition
    id="Remake"
    component={Remake}
    defaultProps={sampleSpec}
    durationInFrames={300}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({ props }: { props: VideoSpec }) => ({
      durationInFrames: computeTimeline(props).total,
      fps: props.meta.fps,
      width: props.meta.width,
      height: props.meta.height,
    })}
  />
);
