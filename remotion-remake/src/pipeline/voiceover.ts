// "Lồng tiếng": one ElevenLabs clip per scene/shot narration, cached by content
// so a resumed or re-rendered job never pays for the same line twice.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { VideoSpec, VoiceClip } from "../spec/schema";
import type { Storyboard } from "../spec/storyboard";
import { audioDuration, synthesize, ttsOptions, type Alignment } from "./elevenlabs";
import { OUT_DIR, readJsonSafe, writeFileAtomic } from "./tools";

/** Silence kept after a line before the next scene starts. */
const TAIL_SEC = 0.35;

export const voiceDir = (id: string) => path.join(OUT_DIR, id, "voice");
const alignmentFile = (audio: string) => audio.replace(/\.\w+$/, ".alignment.json");

/** Characters ElevenLabs will bill (lines already generated are free). */
export const narrationChars = (lines: string[]) => lines.reduce((n, l) => n + l.trim().length, 0);

/** Groups ElevenLabs character timings into words. */
export function alignmentWords(a: Alignment | null): VoiceClip["words"] {
  if (!a) return [];
  const words: VoiceClip["words"] = [];
  let cur: { text: string; start: number; end: number } | null = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
    } else if (!cur) cur = { text: ch, start: a.starts[i], end: a.ends[i] };
    else {
      cur.text += ch;
      cur.end = a.ends[i];
    }
  });
  if (cur) words.push(cur);
  return words;
}

type Progress = (done: number, total: number, message: string) => void;

/** Creates (or reuses) one clip per non-empty line. Returns clips whose `scene` is the line index. */
export async function voiceLines(id: string, lines: string[], language: string, onProgress: Progress): Promise<VoiceClip[]> {
  const options = ttsOptions(language);
  const dir = voiceDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const clean = lines.map((l) => l.trim());
  const todo = clean.map((text, i) => ({ text, i })).filter((l) => l.text);
  const clips: VoiceClip[] = [];
  let done = 0;
  for (const { text, i } of todo) {
    const hash = crypto.createHash("sha1").update(JSON.stringify({ text, options })).digest("hex").slice(0, 10);
    const ext = options.outputFormat.startsWith("wav") ? "wav" : options.outputFormat.startsWith("opus") ? "opus" : "mp3";
    const name = `${i}-${hash}.${ext}`;
    const file = path.join(dir, name);
    const reused = fs.existsSync(file);
    if (!reused) {
      // Neighbouring lines help ElevenLabs keep the intonation continuous between clips.
      const speech = await synthesize(text, options, { previousText: clean.slice(0, i).filter(Boolean).at(-1), nextText: clean.slice(i + 1).find(Boolean) });
      writeFileAtomic(file, speech.audio);
      if (speech.alignment) writeFileAtomic(alignmentFile(file), JSON.stringify(speech.alignment));
    }
    const durationSec = await audioDuration(file);
    clips.push({ scene: i, src: `voice/${id}/${name}`, durationSec, words: alignmentWords(readJsonSafe<Alignment>(alignmentFile(file))) });
    onProgress(++done, todo.length, `Câu ${i + 1}: ${durationSec.toFixed(1)} giây${reused ? " (dùng lại file đã tạo)" : ""}`);
  }
  // Clips of older versions of a line are no longer used.
  const keep = new Set(clips.flatMap((c) => [path.basename(c.src), path.basename(alignmentFile(c.src))]));
  for (const f of fs.readdirSync(dir)) if (!keep.has(f)) fs.rmSync(path.join(dir, f), { force: true });
  return clips;
}

/** A scene must last at least as long as its line plus a short pause. */
const fit = (durationSec: number, clip?: VoiceClip) => (clip && durationSec < clip.durationSec + TAIL_SEC ? +(clip.durationSec + TAIL_SEC).toFixed(2) : durationSec);

/** Classic spec: voice per scene, scenes lengthened to fit. */
export async function addVoiceover(id: string, spec: VideoSpec, onProgress: Progress): Promise<VideoSpec> {
  const clips = await voiceLines(id, spec.scenes.map((s) => s.narration), spec.meta.language, onProgress);
  const scenes = spec.scenes.map((s, i) => ({ ...s, durationSec: fit(s.durationSec, clips.find((c) => c.scene === i)) }));
  return { ...spec, scenes, voiceover: clips };
}

/** Fedtoon storyboard: voice per shot, shots lengthened to fit. */
export async function addStoryboardVoice(id: string, sb: Storyboard, onProgress: Progress): Promise<Storyboard> {
  const clips = await voiceLines(id, sb.shots.map((s) => s.narration), sb.meta.language, onProgress);
  const shots = sb.shots.map((s, i) => ({ ...s, durationSec: fit(s.durationSec, clips.find((c) => c.scene === i)) }));
  return { ...sb, shots, voiceover: clips };
}
