// Deterministic hedge math. No AI, no I/O: everything here is pure and unit-tested.
// All prices are per-contract in [0,1]; every contract pays $1 if its outcome resolves true.
// Costs exclude exchange fees (surfaced as a warning).

import type { Contract, ExposureRange, HedgeLeg, HedgeProposal, Outcome, RiskProfile } from "@/lib/types";

const FEE_WARNING = "Costs shown exclude Gemini trading fees.";

/** Round down to the instrument's quantity grid (never over-buy by rounding). */
export function roundQuantity(qty: number, c: Contract): number {
  const { quantityIncrement: inc } = c.increments;
  const steps = Math.floor(qty / inc + 1e-9);
  return Number((steps * inc).toFixed(8));
}

export const askFor = (c: Contract, outcome: Outcome): number | null =>
  outcome === "yes" ? c.quote.yesAsk : c.quote.noAsk;

const money = (n: number) => Math.round(n * 100) / 100;

function makeLeg(contract: Contract, outcome: Outcome, rawQty: number): HedgeLeg | null {
  const ask = askFor(contract, outcome);
  if (ask === null || ask <= 0) return null;
  const quantity = roundQuantity(rawQty, contract);
  if (quantity < contract.increments.quantityMinimum) return null;
  return {
    contract,
    outcome,
    quantity,
    limitPrice: ask,
    cost: money(quantity * ask),
    maxPayout: money(quantity),
  };
}

function total(legs: HedgeLeg[]) {
  return {
    totalCost: money(legs.reduce((s, l) => s + l.cost, 0)),
    maxPayout: money(legs.reduce((s, l) => s + l.maxPayout, 0)),
  };
}

// ---------------------------------------------------------------------------
// Event hedges (promos, discrete triggers): one contract, payout sized to the
// cost the business takes on if the event happens. Turns an uncertain cost into
// a fixed one: net cost = hedge cost in BOTH outcomes when fully hedged.
// ---------------------------------------------------------------------------

export interface EventHedgeOptions {
  /** Which exposure estimate to size to. */
  sizeTo?: keyof ExposureRange;
  /** Fraction of that exposure to offset, 0..1. */
  hedgeRatio?: number;
}

export interface EventHedgeResult extends HedgeProposal {
  /** Net result for the business in each world, at each exposure estimate. */
  scenarios: {
    exposure: keyof ExposureRange;
    ifTriggered: number; // -promo cost + payout - hedge cost
    ifNotTriggered: number; // -hedge cost
  }[];
}

export function sizeEventHedge(
  profile: RiskProfile,
  contract: Contract,
  outcome: Outcome,
  opts: EventHedgeOptions = {},
): EventHedgeResult {
  const sizeTo = opts.sizeTo ?? "expected";
  const ratio = opts.hedgeRatio ?? 1;
  const target = profile.exposureUsd[sizeTo] * ratio;
  const warnings: string[] = [FEE_WARNING];

  if (!contract.tradable) warnings.push("This market is not currently open for trading.");
  const leg = makeLeg(contract, outcome, target);
  if (!leg) {
    return {
      riskProfileId: profile.id,
      legs: [],
      totalCost: 0,
      maxPayout: 0,
      summary: "No live offer to buy this outcome right now.",
      warnings: [...warnings, `No ask available for ${outcome.toUpperCase()} on "${contract.label}".`],
      scenarios: [],
    };
  }
  if (leg.limitPrice >= 0.9) {
    warnings.push(
      `The market prices this at ${Math.round(leg.limitPrice * 100)}%; offsetting it costs nearly the full amount.`,
    );
  }

  const { totalCost, maxPayout } = total([leg]);
  const scenarios = (["low", "expected", "high"] as const).map((k) => ({
    exposure: k,
    ifTriggered: money(-profile.exposureUsd[k] + maxPayout - totalCost),
    ifNotTriggered: money(-totalCost),
  }));

  return {
    riskProfileId: profile.id,
    legs: [leg],
    totalCost,
    maxPayout,
    summary: `Pay $${totalCost.toFixed(2)} now; receive $${maxPayout.toFixed(2)} if "${contract.label}" resolves ${outcome.toUpperCase()}.`,
    warnings,
    scenarios,
  };
}

// ---------------------------------------------------------------------------
// Downside ladders (crypto holders): buy NO on several "X or above" strikes so
// the payout grows step-wise as price falls, approximating the holder's loss.
// Leg i pays Q * (K_i - K_{i+1}) when price < K_i, so between strikes the payout
// is >= the loss measured from the top strike (over-offsets by at most one step).
// ---------------------------------------------------------------------------

export interface LadderOptions {
  /** Start offsetting after this fractional drop from spot (0.05 = losses below -5%). */
  startDrop?: number;
  /** Stop offsetting beyond this fractional drop (0.30 = payout capped at -30%). */
  floorDrop?: number;
  /** Max number of strikes to use. */
  maxLegs?: number;
}

export interface LadderResult extends HedgeProposal {
  startPrice: number;
  floorPrice: number;
}

/** Contracts usable for a downside ladder: tradable "above" strikes with a NO offer. */
export function ladderCandidates(contracts: Contract[]): Contract[] {
  return contracts
    .filter((c) => c.tradable && c.strike?.type === "above" && c.strike.value !== null && c.quote.noAsk !== null)
    .sort((a, b) => b.strike!.value! - a.strike!.value!);
}

function pickEvenly<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  if (n === 1) return [items[0]];
  const step = (items.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => items[Math.round(i * step)]);
}

export function buildDownsideLadder(
  profile: RiskProfile,
  contracts: Contract[],
  opts: LadderOptions = {},
): LadderResult {
  if (!profile.position) throw new Error("Downside ladder requires profile.position");
  const { quantity: Q, spotPrice: spot } = profile.position;
  const startDrop = opts.startDrop ?? 0.05;
  const floorDrop = opts.floorDrop ?? 0.3;
  const startPrice = spot * (1 - startDrop);
  let floorPrice = spot * (1 - floorDrop);
  const warnings = [FEE_WARNING];

  const inBand = ladderCandidates(contracts).filter(
    (c) => c.strike!.value! <= startPrice && c.strike!.value! > floorPrice,
  );
  const strikes = pickEvenly(inBand, opts.maxLegs ?? 5);

  // If listed strikes stop well above the requested floor, don't load the whole
  // remaining range onto the lowest strike (that would massively over-offset just
  // below it). Cap the last step at the typical strike spacing and raise the floor.
  if (strikes.length > 0) {
    const ks = strikes.map((c) => c.strike!.value!);
    const gaps = ks.slice(1).map((k, i) => ks[i] - k).sort((a, b) => a - b);
    const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : ks[0] * 0.05;
    const lowest = ks[ks.length - 1];
    if (lowest - floorPrice > typical) {
      floorPrice = lowest - typical;
      warnings.push("Listed strikes don't reach the requested floor; the offset range was narrowed.");
    }
  }

  const legs: HedgeLeg[] = [];
  strikes.forEach((c, i) => {
    const k = c.strike!.value!;
    const next = i + 1 < strikes.length ? strikes[i + 1].strike!.value! : floorPrice;
    const leg = makeLeg(c, "no", Q * (k - next));
    if (leg) legs.push(leg);
  });

  if (legs.length === 0) {
    warnings.push("No tradable strikes between the start and floor prices for this expiry.");
  } else {
    const top = legs[0].contract.strike!.value!;
    warnings.push(
      `Declines from $${Math.round(spot).toLocaleString()} down to $${Math.round(top).toLocaleString()} are not offset, ` +
        `and further losses below $${Math.round(floorPrice).toLocaleString()} are not offset.`,
    );
  }

  const { totalCost, maxPayout } = total(legs);
  return {
    riskProfileId: profile.id,
    legs,
    totalCost,
    maxPayout,
    startPrice,
    floorPrice,
    summary: legs.length
      ? `${legs.length} strikes, $${totalCost.toFixed(2)} total, up to $${maxPayout.toFixed(2)} paid out as price falls.`
      : "No hedge available.",
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Payoff curves for charts.
// ---------------------------------------------------------------------------

/** Payout of one leg at a settlement price. Only "above" strikes are price-evaluable. */
export function legPayoutAt(leg: HedgeLeg, price: number): number {
  const s = leg.contract.strike;
  if (!s || s.type !== "above" || s.value === null) return 0;
  const yesWins = price >= s.value; // "$K or above" resolves YES
  return (leg.outcome === "yes") === yesWins ? leg.quantity : 0;
}

export interface CurvePoint {
  price: number;
  unhedged: number;
  hedged: number;
}

export function payoffCurve(profile: RiskProfile, proposal: HedgeProposal, points = 60): CurvePoint[] {
  if (!profile.position) return [];
  const { quantity: Q, spotPrice: spot } = profile.position;
  const lo = spot * 0.55;
  const hi = spot * 1.15;
  return Array.from({ length: points + 1 }, (_, i) => {
    const price = lo + ((hi - lo) * i) / points;
    const unhedged = Q * (price - spot);
    const payout = proposal.legs.reduce((s, l) => s + legPayoutAt(l, price), 0);
    return { price: money(price), unhedged: money(unhedged), hedged: money(unhedged + payout - proposal.totalCost) };
  });
}
