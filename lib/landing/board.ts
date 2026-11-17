// Live "risk board" for the landing page: real Gemini markets framed as risks people
// can reduce. Each card's odds come straight from the market; sparklines come from
// Hedgehog's own odds history (collector).

import { impliedMedian, pickPriceMarket } from "@/lib/business/analyze";
import { getMids } from "@/lib/chain/hyperliquid";
import { buildForecast, yesMid } from "@/lib/forecast/forecast";
import { historyForSymbol } from "@/lib/odds/store";
import { usd } from "@/lib/format";
import type { Contract, Market } from "@/lib/types";
import type { VenueAdapter } from "@/lib/venues/types";
import { commodityUses, cryptoUses, gameUses, type RiskUse } from "./uses";

export type BoardCategory = "Crypto" | "Commodities" | "Sports";

export interface BoardCard {
  id: string;
  category: BoardCategory;
  badge: string; // short avatar text, e.g. "SOL", "OIL", "NFL"
  title: string;
  subtitle: string;
  prob: number; // chance the risk happens
  cost: number | null; // price per $1 of payout if it happens (the ask)
  history: { ts: number; p: number }[];
  cta: { label: string; href: string };
  /** Real-world risks this one market can offset. */
  uses: RiskUse[];
  /** For two-sided game markets: the other side's chance. */
  other?: { label: string; prob: number };
  /** Plain-English name of the market as Gemini lists it. */
  marketName: string;
  /** The market as a plain question, e.g. "Will oil rise above $96 by Nov 30?" */
  question: string;
  /** Short label for tabs, e.g. "Oil price". */
  tabLabel: string;
}

const SINCE = () => Date.now() - 3 * 24 * 3600_000;

function history(symbol: string, side: "yes" | "no") {
  try {
    return historyForSymbol(symbol, SINCE()).flatMap((h) => {
      const m = yesMid(h);
      return m === null ? [] : [{ ts: h.ts, p: side === "yes" ? m : 1 - m }];
    });
  } catch {
    return [];
  }
}

const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

async function cryptoCards(venue: VenueAdapter): Promise<BoardCard[]> {
  const mids = await getMids();
  const out: BoardCard[] = [];
  for (const asset of ["BTC", "ETH", "SOL"]) {
    const markets = await venue.listMarkets({ category: ["Crypto"], search: asset, limit: 100 });
    const f = buildForecast({ asset, spot: mids[asset], quantity: 1, markets, drops: [0.1] });
    const h = f.horizons[Math.min(1, f.horizons.length - 1)];
    const p = h?.points[0];
    if (!h || !p) continue;
    const c = markets.flatMap((m) => m.contracts).find((x) => x.symbol === p.symbol);
    out.push({
      id: p.symbol,
      category: "Crypto",
      badge: asset,
      title: `${asset} drops below ${usd(p.strike)}`,
      subtitle: `by ${shortDay(h.expiry)} · ${usd(f.spot)} now`,
      prob: p.probBelow,
      cost: c?.quote.noAsk ?? null,
      history: [...history(p.symbol, "no"), { ts: Date.now(), p: p.probBelow }],
      cta: { label: `Protect my ${asset}`, href: `/crypto?asset=${asset}` },
      uses: cryptoUses(asset, usd(p.strike), shortDay(h.expiry)),
      marketName: `${h.title}: ${c?.label ?? usd(p.strike)}`,
      question: `Will ${asset} drop below ${usd(p.strike)} by ${shortDay(h.expiry)}?`,
      tabLabel: `${asset} price`,
    });
  }
  return out;
}

const COMMODITIES = [
  { prefix: "Oil (Brent) price on", badge: "OIL", name: "Oil", who: "fuel" },
  { prefix: "Gold price on", badge: "AU", name: "Gold", who: "gold" },
  { prefix: "Natural Gas price on", badge: "GAS", name: "Natural gas", who: "energy" },
];

async function commodityCards(venue: VenueAdapter): Promise<BoardCard[]> {
  const markets = await venue.listMarkets({ category: ["Commodities"], limit: 100 });
  const far = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
  const out: BoardCard[] = [];
  for (const cm of COMMODITIES) {
    const pick = pickPriceMarket(markets, cm.prefix, far);
    if (!pick) continue;
    const median = impliedMedian(pick.market.contracts);
    if (median === null) continue;
    // The listed strike closest to a 5% rise from the market's expected price.
    const target = median * 1.05;
    const c = pick.market.contracts
      .filter((x) => x.strike?.type === "above" && x.strike.value !== null && yesMid(x.quote) !== null && x.strike.value > median)
      .sort((a, b) => Math.abs(a.strike!.value! - target) - Math.abs(b.strike!.value! - target))[0];
    if (!c) continue;
    const prob = yesMid(c.quote)!;
    out.push({
      id: c.symbol,
      category: "Commodities",
      badge: cm.badge,
      title: `${cm.name} rises above ${usd(c.strike!.value!)}`,
      subtitle: `by ${shortDay(pick.market.expiry)} · market expects ~${usd(median, median >= 20 ? 0 : 2)}`,
      prob,
      cost: c.quote.yesAsk,
      history: [...history(c.symbol, "yes"), { ts: Date.now(), p: prob }],
      cta: {
        label: "Offset rising costs",
        href: `/business?q=${encodeURIComponent(`My business spends heavily on ${cm.who}. If ${cm.name.toLowerCase()} prices jump before ${shortDay(pick.market.expiry)}, our margins take a hit.`)}`,
      },
      uses: commodityUses(cm.name, usd(c.strike!.value!), shortDay(pick.market.expiry)),
      marketName: `${pick.market.title.replace(/\?$/, "")}: ${c.label}`,
      question: `Will ${cm.name.toLowerCase()} rise above ${usd(c.strike!.value!)} by ${shortDay(pick.market.expiry)}?`,
      tabLabel: `${cm.name} price`,
    });
  }
  return out;
}

/** NFL tickers look like NFL-2611200115-IND-HOU-M: kickoff yymmddhhmm (UTC). */
function kickoff(ticker: string): Date | null {
  const m = ticker.match(/-(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-/);
  return m ? new Date(Date.UTC(2000 + +m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : null;
}

/** Upcoming NFL game-winner markets on Gemini, soonest kickoff first. */
export async function upcomingGames(venue: VenueAdapter): Promise<{ m: Market; start: Date }[]> {
  // College games dominate this category, so scan a few pages in parallel to reach the NFL games.
  const pages = await Promise.all(
    [0, 100, 200, 300].map((offset) => venue.listMarkets({ category: ["Sports"], sport: ["american_football"], limit: 100, offset }).catch(() => [])),
  );
  return pages
    .flat()
    .filter((m) => m.id.startsWith("NFL-") && m.id.endsWith("-M") && m.contracts.length === 2)
    .map((m) => ({ m, start: kickoff(m.id) }))
    .filter((g): g is { m: Market; start: Date } => !!g.start && g.start.getTime() > Date.now())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

async function sportsCards(venue: VenueAdapter): Promise<BoardCard[]> {
  const games = (await upcomingGames(venue)).slice(0, 3);

  return games.flatMap(({ m, start }) => {
    const priced = m.contracts.filter((c): c is Contract => yesMid(c.quote) !== null);
    if (priced.length < 2) return [];
    const [dog, fav] = [...priced].sort((a, b) => yesMid(a.quote)! - yesMid(b.quote)!);
    const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const prob = yesMid(dog.quote)!;
    return [
      {
        id: dog.symbol,
        category: "Sports" as const,
        badge: "NFL",
        title: `${dog.label} beats ${fav.label}`,
        subtitle: `${day} · ${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`,
        prob,
        cost: dog.quote.yesAsk,
        history: [],
        cta: {
          label: "Hedge a game-day promo",
          href: `/business?q=${encodeURIComponent(`I run a sports bar. If ${dog.label} beats ${fav.label} on ${day}, wings are half price all night. We usually sell about 500 orders and the discount is $6 each.`)}`,
        },
        uses: gameUses(dog.label, fav.label, day),
        other: { label: `${fav.label} wins`, prob: yesMid(fav.quote)! },
        marketName: `${m.title}: ${dog.label} wins`,
        question: `Will ${dog.label} beat ${fav.label}?`,
        tabLabel: `${dog.label} game`,
      },
    ];
  });
}

export async function buildBoard(venue: VenueAdapter): Promise<BoardCard[]> {
  const parts = await Promise.allSettled([cryptoCards(venue), commodityCards(venue), sportsCards(venue)]);
  return parts.flatMap((p) => (p.status === "fulfilled" ? p.value : []));
}

/**
 * The game-day promo example, built from the next upcoming NFL game on Gemini so it
 * never points at a game that's already been played. Null if no game is listed.
 */
export async function gameDayExample(venue: VenueAdapter): Promise<{ label: string; text: string } | null> {
  const [game] = await sportsCards(venue).catch(() => []);
  if (!game) return null;
  const [dog, fav] = game.title.split(" beats ");
  const day = game.subtitle.split(" · ")[0];
  return {
    label: "Game-day promo",
    text: `I run a sports bar. If ${dog} beats ${fav} on ${day}, wings are half price all night. We usually sell about 500 orders and the discount is $6 each.`,
  };
}
