// Loads remotion-remake/.env. Import this module first: other modules read
// process.env (e.g. CLAUDE_MODEL) as soon as they are imported.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENV_FILE = path.join(ROOT, ".env");

if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

/** Sets KEY=value in .env (replacing a commented or empty line if present) and in process.env. */
export function setEnvValue(key: string, value: string) {
  if (!fs.existsSync(ENV_FILE)) {
    const example = path.join(ROOT, ".env.example");
    fs.writeFileSync(ENV_FILE, fs.existsSync(example) ? fs.readFileSync(example, "utf8") : "");
  }
  const text = fs.readFileSync(ENV_FILE, "utf8");
  const line = `${key}=${value}`;
  const active = new RegExp(`^[ \\t]*${key}[ \\t]*=.*$`, "m");
  const commented = new RegExp(`^[ \\t]*#[ \\t]*${key}[ \\t]*=.*$`, "m");
  const re = active.test(text) ? active : commented.test(text) ? commented : null;
  fs.writeFileSync(ENV_FILE, re ? text.replace(re, () => line) : `${text.replace(/\s*$/, "")}\n${line}\n`);
  process.env[key] = value;
}
