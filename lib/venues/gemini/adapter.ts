import type { Market, Order, OrderRequest, Position } from "@/lib/types";
import type { ListMarketsQuery, VenueAdapter } from "@/lib/venues/types";
import { GeminiClient } from "./client";
import {
  toMarkets,
  toOrder,
  toPosition,
  type GeminiEvent,
  type GeminiOrder,
  type GeminiPosition,
} from "./normalize";

/** Formats a number on the instrument's grid as the string Gemini expects. */
function onGrid(value: number, increment: number): string {
  const decimals = Math.max(0, Math.ceil(-Math.log10(increment)));
  return (Math.round(value / increment) * increment).toFixed(decimals);
}

export class GeminiAdapter implements VenueAdapter {
  readonly name = "gemini";
  constructor(private client: GeminiClient = GeminiClient.fromEnv()) {}

  async listMarkets(q: ListMarketsQuery = {}): Promise<Market[]> {
    const res = await this.client.publicGet<{ data: GeminiEvent[] }>("/v1/prediction-markets/events", {
      status: "active",
      category: q.category,
      search: q.search,
      sport: q.sport,
      limit: q.limit ?? 100,
      offset: q.offset,
    });
    return res.data.flatMap(toMarkets);
  }

  async getMarket(ticker: string): Promise<Market | null> {
    try {
      const ev = await this.client.publicGet<GeminiEvent>(
        `/v1/prediction-markets/events/${encodeURIComponent(ticker)}`,
      );
      return toMarkets(ev)[0] ?? null;
    } catch {
      return null;
    }
  }

  /** The market as listed where orders actually go (sandbox listings differ from production). */
  async getTradingMarket(ticker: string): Promise<Market | null> {
    try {
      const ev = await this.client.publicGet<GeminiEvent>(
        `/v1/prediction-markets/events/${encodeURIComponent(ticker)}`,
        {},
        this.client.tradingEnv,
      );
      return toMarkets(ev)[0] ?? null;
    } catch {
      return null;
    }
  }

  async placeOrder(o: OrderRequest): Promise<Order> {
    await this.ensureTermsAccepted();
    const res = await this.client.privatePost<GeminiOrder>("/v1/prediction-markets/order", {
      symbol: o.symbol,
      orderType: "limit",
      side: o.side,
      outcome: o.outcome,
      quantity: onGrid(o.quantity, 0.01),
      price: onGrid(o.limitPrice, 0.01),
      timeInForce: "good-til-cancel",
    });
    return toOrder(res);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.client.privatePost("/v1/prediction-markets/order/cancel", { orderId: Number(orderId) });
  }

  async getActiveOrders(): Promise<Order[]> {
    const res = await this.client.privatePost<GeminiOrder[] | { orders: GeminiOrder[] }>(
      "/v1/prediction-markets/orders/active",
    );
    return (Array.isArray(res) ? res : res.orders ?? []).map(toOrder);
  }

  async getPositions(): Promise<Position[]> {
    const res = await this.client.privatePost<{ positions: GeminiPosition[] }>(
      "/v1/prediction-markets/positions",
    );
    return (res.positions ?? []).map(toPosition);
  }

  private termsChecked = false;
  /** Orders are rejected until the account accepts the latest Prediction Markets terms. */
  private async ensureTermsAccepted(): Promise<void> {
    if (this.termsChecked) return;
    const status = await this.client.privatePost<{ hasAcceptedLatest?: boolean }>(
      "/v1/prediction-markets/terms/status",
    );
    if (status.hasAcceptedLatest === false) {
      throw new Error(
        "This Gemini account has not accepted the latest Prediction Markets terms. Accept them in Gemini before trading.",
      );
    }
    this.termsChecked = true;
  }
}
