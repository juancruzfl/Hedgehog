import { usd } from "@/lib/format";
import type { LookbackResult } from "@/lib/lookback/data";
import { etDay, HEDGE_WHEN, triggerPhrase } from "@/lib/lookback/lookback";

// The words for one look-back result, shared by the page, its link preview and the share image.

export type Tone = "good" | "bad" | "flat";

export function headline(r: LookbackResult): { title: string; big: string; line: string; tone: Tone } {
  const promo = r.promo || "Your promo";
  const title = `${promo} if ${triggerPhrase(r.event.category, r.label, "future")} · ${etDay(r.event.cutoff)}`;
  const m = r.math;
  if (r.resolution === null) {
    return {
      title,
      big: "Waiting on the final result",
      line: `A ${usd(m.hedgeCost)} hedge pays back ${usd(m.contracts)} if ${triggerPhrase(r.event.category, r.label, "future")}. Gemini hasn't settled it yet.`,
      tone: "flat",
    };
  }
  if (r.resolution === "yes") {
    return {
      title,
      big: `You'd have saved ${usd(m.saved!)}`,
      line: `${cap(r.trigger)}, so the promo cost ${usd(r.promoCost)}. A ${usd(m.hedgeCost)} hedge would have paid back ${usd(m.payout!)}.`,
      tone: "good",
    };
  }
  return {
    title,
    big: "The promo never kicked in",
    line: `${cap(triggerPhrase(r.event.category, r.label, "not"))}, so the promo cost nothing. The hedge would have cost ${usd(m.hedgeCost)}: the price of knowing your worst case ahead of time.`,
    tone: "flat",
  };
}

export const whenLabel = (w: LookbackResult["when"]) => HEDGE_WHEN.find((x) => x.value === w)!.label.toLowerCase();

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
