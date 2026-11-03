import fs from "node:fs";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { numberSetting, setting } from "../settings";
import { AiOutputSchema, buildContext, finalInstruction, progressReporter, SYSTEM_PROMPT, type AiInput, type AiOutput } from "./ai-common";

export const openaiModel = () => setting("OPENAI_MODEL");
export const openaiEffort = (key: "OPENAI_REASONING_EFFORT" | "OPENAI_POST_REASONING_EFFORT") => setting(key) as OpenAI.ReasoningEffort;

export const hasOpenAICredentials = () => !!process.env.OPENAI_API_KEY;

/** Strict structured outputs reject `default`; zod adds one for every `.catch()` fallback. */
function stripDefaults(node: unknown) {
  if (Array.isArray(node)) node.forEach(stripDefaults);
  else if (node && typeof node === "object") {
    delete (node as Record<string, unknown>).default;
    Object.values(node).forEach(stripDefaults);
  }
}

export async function analyzeWithOpenAI(input: AiInput): Promise<AiOutput> {
  const format = zodTextFormat(AiOutputSchema, "video_spec");
  stripDefaults(format.schema);

  const content: OpenAI.Responses.ResponseInputContent[] = [{ type: "input_text", text: buildContext(input) }];
  for (const f of input.frames) {
    content.push({ type: "input_text", text: `Frame at ${f.t.toFixed(2)}s:` });
    content.push({ type: "input_image", detail: "auto", image_url: `data:image/jpeg;base64,${fs.readFileSync(f.file).toString("base64")}` });
  }
  content.push({ type: "input_text", text: finalInstruction(input.mode) });

  const client = new OpenAI();
  const stream = client.responses.stream({
    model: openaiModel(),
    instructions: SYSTEM_PROMPT,
    input: [{ role: "user", content }],
    text: { format },
    reasoning: { effort: openaiEffort("OPENAI_REASONING_EFFORT") },
    max_output_tokens: numberSetting("OPENAI_MAX_OUTPUT_TOKENS"),
  });
  const report = progressReporter("OpenAI", input.onProgress);
  stream.on("response.output_text.delta", (e) => report(e.delta));

  const response = await stream.finalResponse();
  const refusal = response.output.flatMap((o) => (o.type === "message" ? o.content : [])).find((c) => c.type === "refusal");
  if (refusal) throw new Error(`OpenAI từ chối phân tích video này: ${refusal.refusal}`);
  if (response.status === "incomplete") throw new Error(`OpenAI dừng giữa chừng (${response.incomplete_details?.reason ?? "không rõ lý do"}).`);
  if (!response.output_parsed) throw new Error("OpenAI không trả về JSON hợp lệ.");
  return response.output_parsed;
}
