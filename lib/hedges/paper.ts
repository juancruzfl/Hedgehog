import type { Position } from "@/lib/types";
import type { VenueAdapter } from "@/lib/venues/types";
import { listHedges } from "./store";

// Paper positions: filled paper orders, marked to the live production bid.
export async function paperPositions(venue: VenueAdapter): Promise<Position[]> {
  const fills = listHedges()
    .filter((h) => h.mode === "paper")
    .flatMap((h) => h.orders.filter((o) => o.status === "filled"));

  const grouped = new Map<string, { marketId: string; symbol: string; outcome: "yes" | "no"; qty: number; cost: number }>();
  for (const o of fills) {
    const key = `${o.symbol}:${o.outcome}`;
    const g = grouped.get(key) ?? { marketId: o.marketId, symbol: o.symbol, outcome: o.outcome as "yes" | "no", qty: 0, cost: 0 };
    g.qty += o.quantity;
    g.cost += o.quantity * (o.fillPrice ?? o.limitPrice);
    grouped.set(key, g);
  }

  const markets = new Map(
    await Promise.all(
      [...new Set([...grouped.values()].map((g) => g.marketId))].map(async (id) => [id, await venue.getMarket(id)] as const),
    ),
  );

  return [...grouped.values()].map((g) => {
    const m = markets.get(g.marketId);
    const c = m?.contracts.find((x) => x.symbol === g.symbol);
    const bid = c ? (g.outcome === "yes" ? c.quote.yesBid : c.quote.noBid) : null;
    const marketValue = bid === null ? null : g.qty * bid;
    return {
      venue: `${venue.name} (paper)`,
      symbol: g.symbol,
      outcome: g.outcome,
      quantity: g.qty,
      avgPrice: g.cost / g.qty,
      marketValue,
      unrealizedPnl: marketValue === null ? null : marketValue - g.cost,
      resolutionSide: null,
      marketTitle: m ? `${m.title}: ${c?.label ?? g.symbol}` : g.symbol,
      expiry: c?.expiry ?? m?.expiry,
    };
  });
}
