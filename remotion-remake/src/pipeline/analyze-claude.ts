import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { numberSetting, setting } from "../settings";
import { AiOutputSchema, buildContext, finalInstruction, progressReporter, SYSTEM_PROMPT, type AiInput, type AiOutput } from "./ai-common";

export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";
export const claudeModel = () => setting("CLAUDE_MODEL");
export const claudeEffort = (key: "CLAUDE_EFFORT" | "CLAUDE_POST_EFFORT") => setting(key) as ClaudeEffort;

/** True when the Anthropic SDK can find credentials (env var or an `ant auth login` profile). */
export function hasClaudeCredentials(): boolean {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE) return true;
  return fs.existsSync(path.join(os.homedir(), ".config", "anthropic"));
}

export async function analyzeWithClaude(input: AiInput): Promise<AiOutput> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: buildContext(input) }];
  for (const f of input.frames) {
    content.push({ type: "text", text: `Frame at ${f.t.toFixed(2)}s:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f.file).toString("base64") } });
  }
  content.push({ type: "text", text: finalInstruction(input.mode) });

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: claudeModel(),
    max_tokens: numberSetting("CLAUDE_MAX_TOKENS"),
    // Opus 5.5 always thinks; effort controls how much.
    output_config: { effort: claudeEffort("CLAUDE_EFFORT"), format: betaZodOutputFormat(AiOutputSchema) },
    // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  stream.on("text", progressReporter("Claude", input.onProgress));

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error(`Claude từ chối phân tích video này (${message.stop_details?.category ?? "không rõ lý do"}).`);
  }
  if (message.stop_reason === "max_tokens") throw new Error("Kịch bản quá dài, vượt giới hạn max_tokens.");
  if (!message.parsed_output) throw new Error("Claude không trả về JSON hợp lệ.");
  return message.parsed_output;
}
