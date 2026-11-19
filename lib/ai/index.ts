import { OpenAICompatibleProvider } from "./openai-compatible";
import type { AIProvider } from "./types";

let cached: AIProvider | null = null;

/** AI_MODE=off: never call the AI provider (no cost); the basic matcher is used instead. */
export const aiOff = () => process.env.AI_MODE === "off";

export class AIDisabledError extends Error {
  constructor() {
    super("AI is turned off (AI_MODE=off)");
  }
}

/** Configured AI provider, or a clear error if keys/model aren't set or AI is turned off. */
export function getAI(): AIProvider {
  if (aiOff()) throw new AIDisabledError();
  cached ??= OpenAICompatibleProvider.fromEnv();
  return cached;
}

/** Turns provider errors (no credits, bad key) into something a user can act on. */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof AIDisabledError) return "AI is turned off for testing (AI_MODE=off).";
  const msg = (e as Error)?.message ?? String(e);
  if (/credits|spending limit|402|insufficient/i.test(msg)) return "The AI provider account is out of credits.";
  if (/429|rate.?limit/i.test(msg)) return "The AI provider is rate limiting requests. Try again in a moment.";
  if (/401|invalid api key|incorrect api key/i.test(msg)) return "The AI provider key is invalid.";
  if (/AI_MODEL|AI_API_KEY/.test(msg)) return msg;
  if (/daily AI limit/.test(msg)) return "Today's AI budget is used up.";
  return `The AI step failed: ${msg}`;
}
