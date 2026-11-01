import type { AiInput, AiOutput } from "./ai-common";
import { analyzeWithClaude, CLAUDE_MODEL, hasClaudeCredentials } from "./analyze-claude";
import { analyzeWithOpenAI, hasOpenAICredentials, OPENAI_MODEL } from "./analyze-openai";

export type Provider = "claude" | "openai";

export const PROVIDERS: Record<Provider, { label: string; model: string; envKey: string; ready: () => boolean; analyze: (input: AiInput) => Promise<AiOutput> }> = {
  claude: { label: "Claude", model: CLAUDE_MODEL, envKey: "ANTHROPIC_API_KEY", ready: hasClaudeCredentials, analyze: analyzeWithClaude },
  openai: { label: "OpenAI", model: OPENAI_MODEL, envKey: "OPENAI_API_KEY", ready: hasOpenAICredentials, analyze: analyzeWithOpenAI },
};

export const parseProvider = (value: unknown): Provider => (value === "openai" ? "openai" : "claude");

export function providerStatus() {
  return Object.fromEntries(
    Object.entries(PROVIDERS).map(([id, p]) => [id, { label: p.label, model: p.model, envKey: p.envKey, ready: p.ready() }]),
  ) as Record<Provider, { label: string; model: string; envKey: string; ready: boolean }>;
}
