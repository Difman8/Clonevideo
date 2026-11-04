import { finalizeStoryboard, type Storyboard } from "../../spec/storyboard";
import { SAMPLE_CAST } from "./CastSheet";

const none = { content: "", style: "none" as const, position: "top" as const };

// Preview storyboard for Remotion Studio (no generated images: backdrops are drawn in code).
// Shot 1 asks for a teal background behind teal Fed on purpose: finalizeStoryboard replaces that one color.
export const sampleStoryboard: Storyboard = finalizeStoryboard(
  {
    title: "Why is the sky blue?",
    cast: ["fed", "man", "scientist", "grandpa"].map((id) => SAMPLE_CAST.find((m) => m.id === id)!),
    notes: [],
    shots: [
      { durationSec: 3, narration: "Have you ever wondered why the sky is blue?", speaker: "fed", background: { prompt: "swirling rays", mood: "abstract", colors: ["teal", "mint"] }, camera: "zoom-in", characters: [{ castId: "fed", position: "center", scale: "large", action: "wave", expression: "happy", facing: "front", enter: "pop" }], props: [], text: { content: "Why is the sky blue?", style: "title", position: "top" }, transition: "cut", sfx: ["pop"] },
      { durationSec: 3.5, narration: "Sunlight is actually a mix of every color.", speaker: "narrator", background: { prompt: "deep space", mood: "space", colors: ["night", "violet"] }, camera: "pan-left", characters: [], props: [{ prompt: "a smiling sun with a face", position: "center", scale: "large", motion: "pulse" }], text: { content: "White light", style: "label", position: "top" }, transition: "fade", sfx: [] },
      { durationSec: 3.5, narration: "In the air, blue light gets scattered the most.", speaker: "narrator", background: { prompt: "a science classroom", mood: "indoor", colors: ["blue", "sky"] }, camera: "zoom-out", characters: [{ castId: "man", position: "left", scale: "medium", action: "point", expression: "neutral", facing: "right", enter: "slide-in" }, { castId: "scientist", position: "right", scale: "medium", action: "think", expression: "thinking", facing: "left", enter: "fade" }], props: [], text: { content: "~5x more", style: "caption", position: "top" }, transition: "slide", sfx: [] },
      { durationSec: 3, narration: "About five times more than red light!", speaker: "narrator", background: { prompt: "green hills under a cyan sky", mood: "day", colors: ["cyan", "green"] }, camera: "shake", characters: [{ castId: "grandpa", position: "center", scale: "large", action: "jump", expression: "surprised", facing: "front", enter: "pop" }], props: [], text: { content: "×5", style: "big-number", position: "top" }, transition: "wipe", sfx: ["ding"] },
      { durationSec: 3, narration: "Follow Fedtoon to discover more!", speaker: "fed", background: { prompt: "a starry night", mood: "night", colors: ["plum", "violet"] }, camera: "static", characters: [{ castId: "fed", position: "center", scale: "large", action: "cheer", expression: "happy", facing: "front", enter: "pop" }], props: [], text: { content: "Follow Fedtoon", style: "label", position: "top" }, transition: "fade", sfx: [] },
    ],
  },
  { width: 1080, height: 1920, fps: 30, language: "en" },
);
