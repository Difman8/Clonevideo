import type { AiInput, AiOutput } from "./ai-common";
import { analyzeWithClaude, claudeModel, hasClaudeCredentials } from "./analyze-claude";
import { analyzeWithOpenAI, hasOpenAICredentials, openaiModel } from "./analyze-openai";

export type Provider = "claude" | "openai";

// `model` is a getter: it follows the setting saved from the "⚙️ Cài đặt" tab.
export const PROVIDERS: Record<Provider, { label: string; readonly model: string; envKey: string; ready: () => boolean; analyze: (input: AiInput) => Promise<AiOutput> }> = {
  claude: {
    label: "Claude",
    get model() {
      return claudeModel();
    },
    envKey: "ANTHROPIC_API_KEY",
    ready: hasClaudeCredentials,
    analyze: analyzeWithClaude,
  },
  openai: {
    label: "OpenAI",
    get model() {
      return openaiModel();
    },
    envKey: "OPENAI_API_KEY",
    ready: hasOpenAICredentials,
    analyze: analyzeWithOpenAI,
  },
};

export const parseProvider = (value: unknown): Provider => (value === "openai" ? "openai" : "claude");

export function providerStatus() {
  return Object.fromEntries(
    Object.entries(PROVIDERS).map(([id, p]) => [id, { label: p.label, model: p.model, envKey: p.envKey, ready: p.ready() }]),
  ) as Record<Provider, { label: string; model: string; envKey: string; ready: boolean }>;
}
