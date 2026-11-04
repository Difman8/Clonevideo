import React from "react";
import { Composition } from "remotion";
import type { VideoSpec } from "../spec/schema";
import { computeTimeline } from "../spec/timeline";
import type { Storyboard } from "../spec/storyboard";
import { storyboardTimeline } from "../spec/storyboard";
import { CastSheet } from "./fedtoon/CastSheet";
import { FedtoonVideo } from "./fedtoon/FedtoonVideo";
import { sampleStoryboard } from "./fedtoon/sample";
import { Remake } from "./Remake";
import { sampleSpec } from "./sample";

export const Root: React.FC = () => (
  <>
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
  <Composition
    id="Fedtoon"
    component={FedtoonVideo}
    defaultProps={sampleStoryboard}
    durationInFrames={300}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({ props }: { props: Storyboard }) => ({
      durationInFrames: storyboardTimeline(props).total,
      fps: props.meta.fps,
      width: props.meta.width,
      height: props.meta.height,
    })}
  />
  <Composition id="FedtoonCast" component={CastSheet} durationInFrames={150} fps={30} width={1080} height={1920} />
  </>
);
