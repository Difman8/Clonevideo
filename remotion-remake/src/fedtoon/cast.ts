// Fedtoon's recurring side characters, drawn after the channel's character
// sheet (assets/cast/reference.png). The AI reuses them by id; their look is
// fixed (finalizeStoryboard), so they look the same in every video.
import type { CastMember } from "../spec/storyboard";

export const RECURRING_CAST: CastMember[] = [
  { id: "mai", name: "Mai", kind: "human", skin: "light", hair: "long", hairColor: "black", outfit: "coral", top: "sweater", pants: "dark", accessory: "headband" },
  { id: "tuan", name: "Tuấn", kind: "human", skin: "light", hair: "short", hairColor: "brown", outfit: "blue", top: "sweater", pants: "dark", accessory: "glasses" },
  { id: "lan", name: "Lan", kind: "human", skin: "tan", hair: "bun", hairColor: "black", outfit: "purple", top: "sweater", pants: "dark", accessory: "lab-coat" },
  { id: "khoa", name: "Khoa", kind: "human", skin: "brown", hair: "curly", hairColor: "black", outfit: "amber", top: "hoodie", pants: "jeans", accessory: "headphones" },
  { id: "bao", name: "Bảo", kind: "human", skin: "light", hair: "cap", hairColor: "black", outfit: "green", top: "sweater", pants: "jeans", accessory: "none" },
  { id: "an", name: "An", kind: "human", skin: "light", hair: "spiky", hairColor: "blonde", outfit: "teal", top: "sweater", pants: "dark", accessory: "scarf" },
  { id: "ong", name: "Ông", kind: "human", skin: "light", hair: "bald", hairColor: "gray", outfit: "navy", top: "polo", pants: "dark", accessory: "glasses" },
];

/** One line per recurring character, for the storyboard prompt. */
export const RECURRING_CAST_TEXT = [
  'mai — Mai, a cheerful young woman: long black hair with a white headband, coral sweater',
  'tuan — Tuấn, a young man: short brown hair, round black glasses, blue sweater',
  'lan — Lan, a scientist: black hair in a bun, white lab coat over a purple top',
  'khoa — Khoa, a teenager: curly black hair, pink headphones, yellow hoodie, jeans',
  'bao — Bảo, a boy: green cap, green sweater, jeans',
  'an — An, a kid: spiky blonde hair, red scarf, teal sweater',
  'ong — Ông, a grandfather: bald with white hair at the sides, round glasses, navy polo',
].join("\n");
