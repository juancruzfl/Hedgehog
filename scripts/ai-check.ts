// Verifies the AI key: lists models, then (if AI_MODEL is set) runs one risk parse.
// Run: npm run ai:check
import OpenAI from "openai";
import { OpenAICompatibleProvider } from "../lib/ai/openai-compatible";

async function main() {
  const apiKey = process.env.AI_API_KEY ?? process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("Set AI_API_KEY (or XAI_API_KEY) in .env.local");
  const client = new OpenAI({ apiKey, baseURL: process.env.AI_BASE_URL ?? "https://api.x.ai/v1" });
  const models = await client.models.list();
  console.log("Available models:\n" + models.data.map((m) => `  ${m.id}`).join("\n"));
  if (!process.env.AI_MODEL) return console.log("\nSet AI_MODEL to one of the above, then rerun.");

  const ai = OpenAICompatibleProvider.fromEnv();
  const t0 = Date.now();
  const parsed = await ai.parseRisk(
    "I own a sports bar. Half-price wings all night if the Colts beat Houston this weekend. We usually sell about 500 orders and the discount is $6 each.",
    new Date(),
  );
  console.log(`\nparseRisk (${Date.now() - t0}ms):`, JSON.stringify(parsed, null, 2));
  console.log("\nsearchPlan:", await ai.searchPlan(parsed.profile));
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
