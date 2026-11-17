// Suggested rewordings for a risk that matched no Gemini market. Each one ties the same
// worry to something Gemini actually lists, keeps the user's own cost and date, and leaves
// [blanks] for the details only they know. Built in code: no AI call, no cost.

import type { RiskProfile } from "@/lib/types";

export interface Rewrite {
  id: "weather" | "game" | "fuel" | "metals";
  label: string;
  text: string;
  /** Why this version can find a market. */
  why: string;
}

const KEYWORDS: Record<Rewrite["id"], RegExp> = {
  weather: /\b(rain|snow|storm|weather|cold|hot|heat|temperature|freez|frost|wind|outdoor|patio|sunny)/i,
  game: /\b(game|team|wins?|promo|match|playoff|super ?bowl|nfl|ncaa|score|sports?|bar)\b/i,
  fuel: /\b(fuel|diesel|gas|gasoline|oil|energy|heating|propane|delivery|truck|van|fleet|flight)/i,
  metals: /\b(gold|silver|copper|platinum|metal|jewel)/i,
};

const DEFAULT_ORDER: Rewrite["id"][] = ["weather", "game", "fuel", "metals"];

function money(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function day(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "[the date]" : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Up to three rewordings, the ones closest to what the user wrote first. */
export function suggestRewrites(text: string, profile: Pick<RiskProfile, "exposureUsd" | "window">, max = 3): Rewrite[] {
  const cost = profile.exposureUsd?.expected > 0 ? money(profile.exposureUsd.expected) : "[$ amount]";
  const when = profile.window?.end ? day(profile.window.end) : "[the date]";
  const all: Record<Rewrite["id"], Rewrite> = {
    weather: {
      id: "weather",
      label: "Tie it to the temperature",
      text: `If the high in [your city] on ${when} is under [50]°F, I lose about ${cost}.`,
      why: "Gemini lists the daily high for about 50 US cities. A cold day is often a good stand-in for bad weather.",
    },
    game: {
      id: "game",
      label: "Tie it to a game",
      text: `If [team] wins on ${when}, [my promo] costs me about ${cost}.`,
      why: "Gemini lists who wins NFL, college and other games, plus point spreads and totals.",
    },
    fuel: {
      id: "fuel",
      label: "Tie it to fuel prices",
      text: `I buy about [2,000] gallons of diesel before ${when}. If fuel prices jump, my costs go up.`,
      why: "Gemini lists oil and natural gas prices, which move with what you pay for fuel.",
    },
    metals: {
      id: "metals",
      label: "Tie it to metal prices",
      text: `I need to buy about [20] oz of gold by ${when}. If the price jumps, it costs me more.`,
      why: "Gemini lists gold, silver and copper prices.",
    },
  };
  const matched = DEFAULT_ORDER.filter((id) => KEYWORDS[id].test(text));
  const order = [...matched, ...DEFAULT_ORDER.filter((id) => !matched.includes(id))];
  return order.slice(0, max).map((id) => all[id]);
}
