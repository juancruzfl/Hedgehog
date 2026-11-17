// Shared, venue-agnostic types. The hedging engine only ever sees these;
// venue-specific shapes (Gemini tickers, auth, etc.) stay inside lib/venues/*.

export type Segment = "crypto" | "business";

export type RiskKind =
  | "price_drop" // lose money if an asset falls (crypto holders, commodity sellers)
  | "price_rise" // lose money if an asset rises (fuel costs, input costs)
  | "event_trigger" // lose money if a discrete event happens (promo payouts)
  | "threshold"; // lose money if a measured value crosses a line (temperature)

export type UnderlyingType = "crypto" | "sports" | "weather" | "commodity";

export interface ExposureRange {
  low: number;
  expected: number;
  high: number;
}

/** The common output of both front doors (wallet intake and Grok intake). */
export interface RiskProfile {
  id: string;
  segment: Segment;
  kind: RiskKind;
  underlying: { type: UnderlyingType; ref: string }; // e.g. "BTC", "Colts vs Houston"
  condition: string; // human-readable trigger, e.g. "BTC < 60000", "Colts win"
  /** USD the user loses if the risk materializes (for price risks: at the worst modeled price). */
  exposureUsd: ExposureRange;
  window: { start: string; end: string }; // ISO timestamps
  source: "wallet" | "conversation" | "manual";
  /** Price-risk details; present for price_drop / price_rise. */
  position?: { asset: string; quantity: number; spotPrice: number };
  notes?: string;
}

export type Outcome = "yes" | "no";
export type Side = "buy" | "sell";

export type StrikeType =
  | "reference"
  | "above"
  | "spread"
  | "over"
  | "over_or_equal"
  | "under"
  | "under_or_equal";

export interface Quote {
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
  last: number | null;
}

export interface Contract {
  venue: string;
  symbol: string; // opaque venue instrument id; never constructed by us
  label: string;
  marketId: string;
  marketTitle: string;
  category: string;
  expiry: string; // ISO
  strike?: { type: StrikeType; value: number | null };
  quote: Quote;
  increments: {
    quantityIncrement: number;
    quantityMinimum: number;
    priceIncrement: number;
    priceMinimum: number;
  };
  rulesText: string;
  rulesUrl?: string;
  tradable: boolean;
}

export interface Market {
  venue: string;
  id: string;
  ticker: string;
  title: string;
  category: string;
  expiry: string;
  contracts: Contract[];
}

export interface OrderRequest {
  symbol: string;
  side: Side;
  outcome: Outcome;
  quantity: number;
  limitPrice: number;
}

export interface Order {
  venue: string;
  orderId: string;
  symbol: string;
  side: Side;
  outcome: Outcome;
  status: string;
  quantity: number;
  filledQuantity: number;
  limitPrice: number;
  avgExecutionPrice: number | null;
  createdAt: string;
}

export interface Position {
  venue: string;
  symbol: string;
  outcome: Outcome;
  quantity: number;
  avgPrice: number;
  marketValue: number | null;
  unrealizedPnl: number | null;
  resolutionSide: Outcome | null;
  marketTitle?: string;
  expiry?: string;
}

/** One order in a proposed hedge. Payout is $1 per contract if `outcome` resolves true. */
export interface HedgeLeg {
  contract: Contract;
  outcome: Outcome;
  quantity: number;
  limitPrice: number; // ask for the chosen outcome at proposal time
  cost: number;
  maxPayout: number;
}

export interface HedgeProposal {
  riskProfileId: string;
  legs: HedgeLeg[];
  totalCost: number;
  maxPayout: number;
  /** Fixed net outcome for event hedges; for price hedges see payoff curve. */
  summary: string;
  warnings: string[];
}
