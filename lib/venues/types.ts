import type { Market, Order, OrderRequest, Position } from "@/lib/types";

export interface ListMarketsQuery {
  category?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Every prediction-market venue implements this. The engine depends only on
 * this interface, so adding Kalshi (or anything else) means writing one adapter.
 */
export interface VenueAdapter {
  readonly name: string;
  listMarkets(query?: ListMarketsQuery): Promise<Market[]>;
  getMarket(id: string): Promise<Market | null>;
  placeOrder(order: OrderRequest): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;
  getActiveOrders(): Promise<Order[]>;
  getPositions(): Promise<Position[]>;
}
