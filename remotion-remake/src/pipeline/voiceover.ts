// "Lồng tiếng": one ElevenLabs clip per scene narration, cached by content so
// a resumed or re-rendered job never pays for the same line twice.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { VideoSpec, VoiceClip } from "../spec/schema";
import { audioDuration, synthesize, ttsOptions } from "./elevenlabs";
import { OUT_DIR, writeFileAtomic } from "./tools";

/** Silence kept after a line before the next scene starts. */
const TAIL_SEC = 0.35;

export const voiceDir = (id: string) => path.join(OUT_DIR, id, "voice");
const alignmentFile = (audio: string) => audio.replace(/\.\w+$/, ".alignment.json");

/** Characters ElevenLabs will bill for this spec (lines already cached are free). */
export const narrationChars = (spec: VideoSpec) => spec.scenes.reduce((n, s) => n + s.narration.trim().length, 0);

/**
 * Creates the voice clips, lengthens scenes whose line is longer than the
 * scene, and returns the spec with `voiceover` filled in.
 */
export async function addVoiceover(id: string, spec: VideoSpec, onProgress: (done: number, total: number, message: string) => void): Promise<VideoSpec> {
  const options = ttsOptions(spec.meta.language);
  const dir = voiceDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const lines = spec.scenes.map((s) => s.narration.trim());
  const todo = lines.map((text, i) => ({ text, i })).filter((l) => l.text);
  const scenes = spec.scenes.map((s) => ({ ...s }));
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
      const speech = await synthesize(text, options, { previousText: lines.slice(0, i).filter(Boolean).at(-1), nextText: lines.slice(i + 1).find(Boolean) });
      writeFileAtomic(file, speech.audio);
      if (speech.alignment) writeFileAtomic(alignmentFile(file), JSON.stringify(speech.alignment));
    }
    const durationSec = await audioDuration(file);
    if (scenes[i].durationSec < durationSec + TAIL_SEC) scenes[i].durationSec = +(durationSec + TAIL_SEC).toFixed(2);
    clips.push({ scene: i, src: `voice/${id}/${name}`, durationSec });
    onProgress(++done, todo.length, `Cảnh ${i + 1}: ${durationSec.toFixed(1)} giây${reused ? " (dùng lại file đã tạo)" : ""}`);
  }
  // Clips of older versions of a line are no longer used.
  const keep = new Set(clips.flatMap((c) => [path.basename(c.src), path.basename(alignmentFile(c.src))]));
  for (const f of fs.readdirSync(dir)) if (!keep.has(f)) fs.rmSync(path.join(dir, f), { force: true });
  return { ...spec, scenes, voiceover: clips };
}
