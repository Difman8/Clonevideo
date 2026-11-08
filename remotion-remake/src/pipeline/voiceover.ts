// "Lồng tiếng": one ElevenLabs clip per scene/shot narration, cached by content
// so a resumed or re-rendered job never pays for the same line twice.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { VideoSpec, VoiceClip } from "../spec/schema";
import type { Storyboard } from "../spec/storyboard";
import { audioDuration, synthesize, ttsOptions, type Alignment } from "./elevenlabs";
import { mapLimit } from "../discover/classify";
import { ffmpegPath, OUT_DIR, readJsonSafe, run, writeFileAtomic } from "./tools";

/** Classic videos: silence kept after a line before the next scene starts. */
const TAIL_SEC = 0.35;

/** Fedtoon: pause between the last word of a shot and the next shot's line (a brisk short: ~0.3 s). */
const PAUSE_SEC = 0.3;
/** Fedtoon: after the video's last line, so it does not stop on the last word. */
const END_PAUSE_SEC = 0.8;
/** Fedtoon: shortest shot with a line (a one-word line still shows its picture). */
const MIN_VOICED_SEC = 1;

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

/**
 * When the voice stops inside a clip. ElevenLabs ends its clips with 0.1–0.6 s of silence, and its
 * word timings run into that silence, so the end is measured on the sound (-50 dB keeps soft endings).
 */
async function speechEndSec(file: string, durationSec: number): Promise<number> {
  try {
    const { stderr } = await run(ffmpegPath(), ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-50dB:d=0.05", "-f", "null", "-"]);
    const starts = [...stderr.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Number(m[1]));
    const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
    const last = starts.at(-1);
    // Trailing silence: the last silence never ends, or ends with the file.
    const trailing = last !== undefined && (ends.length < starts.length || Math.abs((ends.at(-1) ?? 0) - durationSec) < 0.05);
    return trailing && last > 0.2 ? Math.min(durationSec, last) : durationSec;
  } catch {
    return durationSec;
  }
}

/**
 * Fedtoon: each shot with a line lasts until a short pause after its last word, so the lines follow
 * each other without long gaps (the storyboard's own durations are kept for shots without a line).
 * Measured on the clips on disk, so re-rendering a saved video ("Render lại") applies it too.
 */
export async function paceToVoice(id: string, sb: Storyboard): Promise<Storyboard> {
  const last = sb.shots.length - 1;
  const shots = await mapLimit(sb.shots, 4, async (s, i) => {
    const clip = sb.voiceover.find((c) => c.scene === i);
    const file = clip && path.join(voiceDir(id), path.basename(clip.src));
    if (!clip || !file || !fs.existsSync(file)) return s;
    const end = await speechEndSec(file, clip.durationSec);
    return { ...s, durationSec: +Math.max(MIN_VOICED_SEC, end + (i === last ? END_PAUSE_SEC : PAUSE_SEC)).toFixed(2) };
  });
  return { ...sb, shots };
}

/** Fedtoon storyboard: voice per shot, shots timed to the voice (paceToVoice). */
export async function addStoryboardVoice(id: string, sb: Storyboard, onProgress: Progress): Promise<Storyboard> {
  const clips = await voiceLines(id, sb.shots.map((s) => s.narration), sb.meta.language, onProgress);
  return paceToVoice(id, { ...sb, voiceover: clips });
}
