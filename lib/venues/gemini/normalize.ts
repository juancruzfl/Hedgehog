import type { Contract, Market, Order, Position, Quote, StrikeType } from "@/lib/types";

// Raw Gemini shapes: only the fields we rely on (documented fields only).
export interface GeminiPrices {
  buy?: { yes?: string | null; no?: string | null } | null;
  sell?: { yes?: string | null; no?: string | null } | null;
  bestBid?: string | null;
  bestAsk?: string | null;
  lastTradePrice?: string | null;
}

export interface GeminiContract {
  id: string;
  label: string;
  description?: unknown;
  prices?: GeminiPrices | null;
  status?: string;
  marketState?: string;
  expiryDate?: string;
  ticker?: string;
  instrumentSymbol: string;
  termsAndConditionsUrl?: string;
  strike?: { type?: string; value?: string | null } | null;
  resolutionSide?: "yes" | "no" | null;
  settlementValue?: string | null;
  quantityIncrement?: string;
  quantityMinimum?: string;
  priceIncrement?: string;
  priceMinimum?: string;
}

export interface GeminiEvent {
  id: string;
  title: string;
  category?: string;
  ticker: string;
  status?: string;
  expiryDate?: string;
  description?: unknown;
  contracts?: GeminiContract[];
  /** Game events nest child markets (spreads, totals, props). */
  events?: GeminiEvent[];
}

const num = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Gemini descriptions are either strings or rich-text trees; flatten to plain text. */
export function richText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(richText).join("");
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.value === "string") return o.value;
    if (o.content) return richText(o.content);
  }
  return "";
}

export function toQuote(p: GeminiPrices | null | undefined): Quote {
  return {
    yesAsk: num(p?.buy?.yes), // price to BUY yes
    yesBid: num(p?.sell?.yes), // price you can SELL yes at
    noAsk: num(p?.buy?.no),
    noBid: num(p?.sell?.no),
    last: num(p?.lastTradePrice),
  };
}

export function toContract(c: GeminiContract, ev: GeminiEvent): Contract {
  const strikeValue = num(c.strike?.value ?? null);
  return {
    venue: "gemini",
    symbol: c.instrumentSymbol,
    label: c.label,
    marketId: ev.ticker,
    marketTitle: ev.title,
    category: ev.category ?? "Unknown",
    expiry: c.expiryDate ?? ev.expiryDate ?? "",
    strike: c.strike?.type ? { type: c.strike.type as StrikeType, value: strikeValue } : undefined,
    quote: toQuote(c.prices),
    increments: {
      quantityIncrement: num(c.quantityIncrement) ?? 1,
      quantityMinimum: num(c.quantityMinimum) ?? 1,
      priceIncrement: num(c.priceIncrement) ?? 0.01,
      priceMinimum: num(c.priceMinimum) ?? 0.01,
    },
    rulesText: richText(c.description) || richText(ev.description),
    rulesUrl: c.termsAndConditionsUrl,
    tradable: (c.status ?? "active") === "active" && (c.marketState ?? "open") === "open",
    resolutionSide: c.resolutionSide ?? null,
    settlementValue: num(c.settlementValue ?? null),
  };
}

/** Flattens a game event and its child events into separate Markets. */
export function toMarkets(ev: GeminiEvent): Market[] {
  const own: Market = {
    venue: "gemini",
    id: ev.ticker,
    ticker: ev.ticker,
    title: ev.title,
    category: ev.category ?? "Unknown",
    expiry: ev.expiryDate ?? "",
    contracts: (ev.contracts ?? []).map((c) => toContract(c, ev)),
  };
  const children = (ev.events ?? []).flatMap((child) =>
    toMarkets({ ...child, category: child.category ?? ev.category }),
  );
  return [own, ...children].filter((m) => m.contracts.length > 0);
}

export interface GeminiOrder {
  orderId: number | string;
  status: string;
  symbol: string;
  side: "buy" | "sell";
  outcome: "yes" | "no";
  quantity: string;
  filledQuantity?: string;
  price: string;
  avgExecutionPrice?: string | null;
  createdAt: string;
}

export function toOrder(o: GeminiOrder): Order {
  return {
    venue: "gemini",
    orderId: String(o.orderId),
    symbol: o.symbol,
    side: o.side,
    outcome: o.outcome,
    status: o.status,
    quantity: Number(o.quantity),
    filledQuantity: num(o.filledQuantity) ?? 0,
    limitPrice: Number(o.price),
    avgExecutionPrice: num(o.avgExecutionPrice ?? null),
    createdAt: o.createdAt,
  };
}

export interface GeminiPosition {
  symbol: string;
  totalQuantity: string;
  avgPrice: string;
  outcome: "yes" | "no";
  marketValue?: string;
  unrealizedPnl?: string;
  resolutionSide?: "yes" | "no" | null;
  contractMetadata?: { eventName?: string; expiryDate?: string };
}

export function toPosition(p: GeminiPosition): Position {
  return {
    venue: "gemini",
    symbol: p.symbol,
    outcome: p.outcome,
    quantity: Number(p.totalQuantity),
    avgPrice: Number(p.avgPrice),
    marketValue: num(p.marketValue), // absent when there is no live sell quote
    unrealizedPnl: num(p.unrealizedPnl),
    resolutionSide: p.resolutionSide ?? null,
    marketTitle: p.contractMetadata?.eventName,
    expiry: p.contractMetadata?.expiryDate,
  };
}
