// Loads remotion-remake/.env. Import this module first: other modules read
// process.env (e.g. CLAUDE_MODEL) as soon as they are imported.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENV_FILE = path.join(ROOT, ".env");

/** Variables inherited from the parent process, restored when their line leaves .env. */
const inherited: Record<string, string | undefined> = { ...process.env };
/** Non-empty values last read from .env, and the file version they came from. */
let fromFile: Record<string, string> = {};
let loadedVersion: string | null = null;

const readEnvFile = () => {
  try {
    return fs.readFileSync(ENV_FILE, "utf8");
  } catch {
    return "";
  }
};

/**
 * Loads .env again if it changed on disk, so a hand edit applies without restarting
 * the app. Values in .env win over variables inherited from the parent process;
 * empty values do not, so a key set system-wide keeps working.
 */
export function refreshEnv() {
  let version = "missing";
  try {
    const st = fs.statSync(ENV_FILE);
    version = `${st.mtimeMs}:${st.size}`;
  } catch {
    // no .env: only inherited variables
  }
  if (version === loadedVersion) return;
  loadedVersion = version;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(parseEnv(readEnvFile()))) if (value) next[key] = value;
  for (const key of Object.keys(fromFile)) {
    if (key in next) continue;
    if (inherited[key] === undefined) delete process.env[key];
    else process.env[key] = inherited[key];
  }
  for (const [key, value] of Object.entries(next)) process.env[key] = value;
  fromFile = next;
}
refreshEnv();

/**
 * Values on commented-out lines of .env (`# KEY=value`) whose key has no active line.
 * Every line of a .env copied from .env.example starts with "# ", so a value typed
 * there without removing the # does nothing.
 */
export function commentedEnvValues(): Record<string, string> {
  const text = readEnvFile();
  const active = parseEnv(text);
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/^[ \t]*#[ \t]*([A-Z][A-Z0-9_]*)[ \t]*=(.*)$/gm)) {
    const [, key, rest] = m;
    if (key in active || key in out) continue;
    out[key] = parseEnv(`${key}=${rest}`)[key] ?? "";
  }
  return out;
}

/**
 * Values with spaces, # or quotes are quoted so .env reads them back verbatim
 * (a value containing all three quote characters gets ’ instead of ').
 */
function quote(value: string): { line: string; value: string } {
  if (!/[\s#"'`]/.test(value)) return { line: value, value };
  for (const q of ["'", '"', "`"]) if (!value.includes(q)) return { line: `${q}${value}${q}`, value };
  const safe = value.replace(/'/g, "’");
  return { line: `'${safe}'`, value: safe };
}

/** Sets KEY=value in .env (replacing a commented or empty line if present) and in process.env. */
export function setEnvValue(key: string, value: string) {
  if (!fs.existsSync(ENV_FILE)) {
    const example = path.join(ROOT, ".env.example");
    fs.writeFileSync(ENV_FILE, fs.existsSync(example) ? fs.readFileSync(example, "utf8") : "");
  }
  const text = fs.readFileSync(ENV_FILE, "utf8");
  const q = quote(value);
  const line = `${key}=${q.line}`;
  const active = new RegExp(`^[ \\t]*${key}[ \\t]*=.*$`, "m");
  const commented = new RegExp(`^[ \\t]*#[ \\t]*${key}[ \\t]*=.*$`, "m");
  const re = active.test(text) ? active : commented.test(text) ? commented : null;
  // Temp file + rename: a power cut never leaves a half-written .env.
  const tmp = `${ENV_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, re ? text.replace(re, () => line) : `${text.replace(/\s*$/, "")}\n${line}\n`);
  fs.renameSync(tmp, ENV_FILE);
  process.env[key] = q.value;
}
