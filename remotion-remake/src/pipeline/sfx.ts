import fs from "node:fs";
import path from "node:path";

// Sound effects are synthesized here so the project needs no audio assets.
const RATE = 44100;

function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function synth(seconds: number, fn: (t: number, i: number) => number) {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / RATE, i);
  return out;
}

// Deterministic noise so regenerated files are byte-identical.
let seed = 1;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

const SOUNDS: Record<string, () => Float32Array> = {
  tick: () => synth(0.06, (t) => Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t * 90) * 0.8),
  pop: () =>
    synth(0.12, (t) => {
      const f = 650 - 2600 * t;
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 30) * 0.8;
    }),
  ding: () =>
    synth(1.2, (t) =>
      (Math.sin(2 * Math.PI * 1046.5 * t) * 0.5 + Math.sin(2 * Math.PI * 1568 * t) * 0.3 + Math.sin(2 * Math.PI * 2093 * t) * 0.15) *
      Math.exp(-t * 3.2) *
      Math.min(1, t * 400),
    ),
  whoosh: () => {
    seed = 7;
    let low = 0;
    return synth(0.45, (t) => {
      const k = 0.02 + 0.25 * Math.sin((Math.PI * t) / 0.45); // sweeping one-pole low-pass
      low += k * (noise() - low);
      return low * Math.sin((Math.PI * t) / 0.45) * 1.6;
    });
  },
};

export function ensureSfx(publicDir: string) {
  const dir = path.join(publicDir, "sfx");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, make] of Object.entries(SOUNDS)) {
    const file = path.join(dir, `${name}.wav`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, wav(make()));
  }
}
