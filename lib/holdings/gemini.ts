import { GeminiClient } from "@/lib/venues/gemini/client";
import { isHedgeable, type Holding } from "./index";

// Crypto the user keeps on Gemini. Uses the same signed connection used for trading.
// Note: in sandbox mode this reads SANDBOX balances.

interface GeminiBalance {
  currency: string;
  amount: string;
  available?: string;
}

/** Hedgeable crypto on Gemini plus USD available to pay for hedges, from one call. */
export async function getGeminiAccount(client = GeminiClient.fromEnv()): Promise<{ holdings: Holding[]; usdAvailable: number | null }> {
  const balances = await client.privatePost<GeminiBalance[]>("/v1/balances");
  const holdings = balances
    .filter((b) => isHedgeable(b.currency) && Number(b.amount) > 0)
    .map((b) => ({
      asset: b.currency.toUpperCase(),
      quantity: Number(b.amount),
      source: "gemini" as const,
      detail: `${b.currency.toUpperCase()} on Gemini`,
    }));
  const usd = balances.find((b) => b.currency.toUpperCase() === "USD");
  return { holdings, usdAvailable: usd ? Number(usd.available ?? usd.amount) : null };
}
