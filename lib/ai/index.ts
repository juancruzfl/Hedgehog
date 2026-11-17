import { OpenAICompatibleProvider } from "./openai-compatible";
import type { AIProvider } from "./types";

let cached: AIProvider | null = null;

/** Configured AI provider, or a clear error if keys/model aren't set. */
export function getAI(): AIProvider {
  cached ??= OpenAICompatibleProvider.fromEnv();
  return cached;
}

/** Turns provider errors (no credits, bad key) into something a user can act on. */
export function aiErrorMessage(e: unknown): string {
  const msg = (e as Error)?.message ?? String(e);
  if (/credits|spending limit|402|insufficient/i.test(msg)) return "The AI provider account is out of credits.";
  if (/429|rate.?limit/i.test(msg)) return "The AI provider is rate limiting requests. Try again in a moment.";
  if (/401|invalid api key|incorrect api key/i.test(msg)) return "The AI provider key is invalid.";
  if (/AI_MODEL|AI_API_KEY/.test(msg)) return msg;
  return `The AI step failed: ${msg}`;
}
