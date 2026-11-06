// Fedtoon's recurring side characters. They are silent extras that only
// illustrate the narration: no names, no story role, no lines. The AI reuses
// them by id and their look is fixed (finalizeStoryboard), so they look the same
// in every video. Characters with a drawing from the channel owner
// (assets/cast/<id>/) are animated from it; the others are drawn in code after
// the character sheet assets/cast/reference.png.
import type { CastMember } from "../spec/storyboard";

export const RECURRING_CAST: CastMember[] = [
  { id: "woman", name: "Young woman", kind: "human", skin: "light", hair: "long", hairColor: "black", outfit: "coral", top: "sweater", pants: "dark", accessory: "headband" },
  { id: "man", name: "Young man", kind: "human", skin: "light", hair: "short", hairColor: "brown", outfit: "blue", top: "sweater", pants: "dark", accessory: "glasses" },
  { id: "scientist", name: "Scientist", kind: "human", skin: "tan", hair: "bun", hairColor: "black", outfit: "purple", top: "sweater", pants: "dark", accessory: "lab-coat" },
  { id: "teen", name: "Teen", kind: "human", skin: "brown", hair: "curly", hairColor: "black", outfit: "amber", top: "hoodie", pants: "jeans", accessory: "headphones" },
  { id: "boy", name: "Boy", kind: "human", skin: "light", hair: "cap", hairColor: "black", outfit: "green", top: "sweater", pants: "jeans", accessory: "none" },
  { id: "kid", name: "Kid", kind: "human", skin: "light", hair: "spiky", hairColor: "blonde", outfit: "teal", top: "sweater", pants: "dark", accessory: "scarf" },
  { id: "grandpa", name: "Grandpa", kind: "human", skin: "light", hair: "bald", hairColor: "gray", outfit: "navy", top: "polo", pants: "dark", accessory: "glasses" },
];

/** The host, for adding him to a video that has no Fed yet. */
export const FED: CastMember = { id: "fed", name: "Fed", kind: "mascot", skin: "light", hair: "short", hairColor: "black", outfit: "teal", top: "polo", pants: "dark", accessory: "glasses" };

/** Ids used before the channel went international (old storyboards still render). */
const LEGACY_IDS: Record<string, string> = { mai: "woman", tuan: "man", lan: "scientist", khoa: "teen", bao: "boy", an: "kid", ong: "grandpa" };

/** Recurring-character id of a cast id ("Woman", "mai" → "woman"). */
export const castKey = (id: string) => LEGACY_IDS[id.toLowerCase()] ?? id.toLowerCase();

/** One line per recurring character, for the storyboard prompt. */
export const RECURRING_CAST_TEXT = [
  "woman: a cheerful young woman, long black hair with a white headband, pink sweater (drawn standing with arms down, smiling; has her own drawing presenting with an open hand)",
  "man: a young man, short brown hair, round black glasses, blue sweater (drawn presenting with an open hand; has his own waving drawing)",
  "scientist: a woman in a white lab coat over a purple top, black hair in a bun (drawn standing with arms down, surprised; has her own pointing drawing)",
  "teen: a teenager, curly black hair, pink headphones, yellow hoodie, jeans (drawn standing with arms down, frowning; has his own walking drawing)",
  "boy: a boy, green cap, green sweater, jeans (drawn standing with arms down, smiling; has his own drawing hopping with a finger on his chin, used for jump and think)",
  "kid: a kid with a yellow paper crown, red scarf, teal sweater (drawn standing with arms down, smiling; has his own thinking drawing, finger on the temple)",
  "grandpa: a bald grandfather with white hair at the sides, round glasses, navy sweater with a collar (drawn standing with arms down, laughing; has his own cheering drawing, both fists up)",
].join("\n");
