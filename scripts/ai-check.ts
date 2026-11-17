// Verifies the AI setup. Run: npm run ai:check
// OpenRouter (default): checks the key and credit, that AI_MODEL exists and supports
// structured output, suggests models if none is set, then runs one live risk parse.
// Other OpenAI-compatible providers: lists models, then runs the same parse.

import OpenAI from "openai";
import { OpenAICompatibleProvider, resolveAIConfig } from "../lib/ai/openai-compatible";

const SUGGESTED = ["x-ai/grok-4.20", "anthropic/claude-haiku-5.5", "google/gemini-2.5-flash-lite", "openai/gpt-oss-120b"];

async function main() {
  // Same key -> provider rules as the app; AI_MODEL may still be unset here.
  const { apiKey, baseURL, model } = (() => {
    try {
      return resolveAIConfig();
    } catch {
      return resolveAIConfig({ ...process.env, AI_MODEL: "unset" });
    }
  })();
  const modelSet = process.env.AI_MODEL ? model : undefined;
  console.log(`Provider: ${baseURL}`);

  if (baseURL.includes("openrouter.ai")) {
    const key = await fetch(`${baseURL}/key`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!key.ok) throw new Error(`OpenRouter rejected the key (${key.status}). Check AI_API_KEY.`);
    const info = ((await key.json()) as { data?: { limit?: number | null; usage?: number; limit_remaining?: number | null } }).data ?? {};
    const remaining = info.limit_remaining ?? (info.limit != null ? info.limit - (info.usage ?? 0) : null);
    console.log(`✓ OpenRouter key works · used $${(info.usage ?? 0).toFixed(4)}${remaining != null ? ` · $${remaining.toFixed(2)} left on this key` : ""}`);

    const models = ((await (await fetch(`${baseURL}/models`)).json()) as { data: { id: string; supported_parameters?: string[] }[] }).data;
    const structured = new Set(models.filter((m) => m.supported_parameters?.includes("structured_outputs")).map((m) => m.id));
    if (!modelSet) {
      console.log("\nSet AI_MODEL in .env.local. Good options (all support structured output):");
      for (const id of SUGGESTED.filter((id) => structured.has(id))) console.log(`  ${id}`);
      return;
    }
    if (!models.some((m) => m.id === model)) throw new Error(`AI_MODEL "${model}" isn't an OpenRouter model id. Try one of: ${SUGGESTED.join(", ")}`);
    console.log(`✓ ${model} ${structured.has(model) ? "supports structured output" : "has no strict schema support; Hedgehog will use JSON mode"}`);
  } else {
    const client = new OpenAI({ apiKey, baseURL });
    const list = await client.models.list();
    console.log("Available models:\n" + list.data.map((m) => `  ${m.id}`).join("\n"));
    if (!modelSet) return console.log("\nSet AI_MODEL to one of the above, then rerun.");
  }

  const ai = OpenAICompatibleProvider.fromEnv();
  const t0 = Date.now();
  const parsed = await ai.parseRisk(
    "I own a sports bar. Half-price wings all night if the home team wins on Sunday. We usually sell about 500 orders and the discount is $6 each.",
    new Date(),
  );
  console.log(`\n✓ parseRisk in ${Date.now() - t0}ms: "${parsed.profile.condition}", cost if it happens ~$${parsed.profile.exposureUsd.expected}`);
  console.log("✓ searchPlan:", JSON.stringify(await ai.searchPlan(parsed.profile)));
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
