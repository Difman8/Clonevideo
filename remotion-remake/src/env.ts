// Loads remotion-remake/.env. Import this module first: other modules read
// process.env (e.g. CLAUDE_MODEL) as soon as they are imported.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENV_FILE = path.join(ROOT, ".env");

// Values saved in .env (the ⚙️ Cài đặt tab) win over variables inherited from the
// parent process; empty values do not, so a key set system-wide keeps working.
if (fs.existsSync(ENV_FILE)) {
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(ENV_FILE, "utf8")))) if (value !== "") process.env[key] = value;
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
