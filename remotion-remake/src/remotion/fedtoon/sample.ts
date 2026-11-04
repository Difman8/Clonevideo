import { finalizeStoryboard, type Storyboard } from "../../spec/storyboard";
import { SAMPLE_CAST } from "./CastSheet";

const none = { content: "", style: "none" as const, position: "top" as const };

// Preview storyboard for Remotion Studio (no generated images: backdrops are drawn in code).
// Shot 1 asks for a teal background behind teal Fed on purpose: finalizeStoryboard replaces that one color.
export const sampleStoryboard: Storyboard = finalizeStoryboard(
  {
    title: "Vì sao bầu trời màu xanh?",
    cast: [SAMPLE_CAST[0], SAMPLE_CAST[1], SAMPLE_CAST[2]],
    notes: [],
    shots: [
      { durationSec: 3, narration: "Bạn có bao giờ tự hỏi vì sao bầu trời lại màu xanh?", speaker: "fed", background: { prompt: "swirling rays", mood: "abstract", colors: ["teal", "mint"] }, camera: "zoom-in", characters: [{ castId: "fed", position: "center", scale: "large", action: "wave", expression: "happy", facing: "front", enter: "pop" }], props: [], text: { content: "Vì sao trời xanh?", style: "title", position: "top" }, transition: "cut", sfx: ["pop"] },
      { durationSec: 3.5, narration: "Ánh sáng Mặt Trời thật ra chứa đủ mọi màu sắc.", speaker: "narrator", background: { prompt: "deep space", mood: "space", colors: ["night", "violet"] }, camera: "pan-left", characters: [], props: [{ prompt: "a smiling sun with a face", position: "center", scale: "large", motion: "pulse" }], text: { content: "Ánh sáng trắng", style: "label", position: "top" }, transition: "fade", sfx: [] },
      { durationSec: 3.5, narration: "Khi đi vào khí quyển, ánh sáng xanh bị tán xạ nhiều nhất.", speaker: "tuan", background: { prompt: "a science classroom", mood: "indoor", colors: ["blue", "sky"] }, camera: "zoom-out", characters: [{ castId: "tuan", position: "left", scale: "medium", action: "point", expression: "neutral", facing: "right", enter: "slide-in" }, { castId: "mai", position: "right", scale: "medium", action: "think", expression: "thinking", facing: "left", enter: "fade" }], props: [], text: { content: "~5 lần nhiều hơn", style: "caption", position: "top" }, transition: "slide", sfx: [] },
      { durationSec: 3, narration: "Nhiều gấp khoảng năm lần so với ánh sáng đỏ!", speaker: "mai", background: { prompt: "green hills under a cyan sky", mood: "day", colors: ["cyan", "green"] }, camera: "shake", characters: [{ castId: "mai", position: "center", scale: "large", action: "jump", expression: "surprised", facing: "front", enter: "pop" }], props: [], text: { content: "×5", style: "big-number", position: "top" }, transition: "wipe", sfx: ["ding"] },
      { durationSec: 3, narration: "Theo dõi Fedtoon để khám phá thêm nhé!", speaker: "fed", background: { prompt: "a starry night", mood: "night", colors: ["plum", "violet"] }, camera: "static", characters: [{ castId: "fed", position: "center", scale: "large", action: "cheer", expression: "happy", facing: "front", enter: "pop" }], props: [], text: { content: "Theo dõi Fedtoon", style: "label", position: "top" }, transition: "fade", sfx: [] },
    ],
  },
  { width: 1080, height: 1920, fps: 30, language: "vi" },
);
