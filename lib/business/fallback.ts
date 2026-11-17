// Basic matcher used when the AI provider is unavailable (no credits, outage).
// Handles the common, well-structured cases deterministically and returns null
// otherwise, so the user sees an honest error instead of a bad match.
//   - Game-day promos: a team named in the text that plays in an upcoming NFL game
//   - Rising costs: diesel/fuel/oil, natural gas, gold, silver, copper, with units

import type { AIProvider } from "@/lib/ai/types";
import { upcomingGames } from "@/lib/landing/board";
import type { Market, RiskProfile } from "@/lib/types";
import type { VenueAdapter } from "@/lib/venues/types";
import { analyzeRisk, type Analysis, type EventMatch, type OnStep } from "./analyze";

const num = (s: string) => Number(s.replace(/,/g, ""));

/** "500 orders ... $6 each" -> 3000; otherwise the largest dollar amount mentioned. */
export function parseExposure(text: string): number | null {
  const count = text.match(/(\d[\d,]*)\s*(?:orders|customers|deliveries|cars|people|tickets|covers|sales)/i);
  const each = text.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(?:off|each|discount|per|back)/i) ?? text.match(/(?:discount|off)[^$]{0,20}\$\s*(\d[\d,]*(?:\.\d+)?)/i);
  if (count && each) return num(count[1]) * num(each[1]);
  const dollars = [...text.matchAll(/\$\s*(\d[\d,]*(?:\.\d+)?)/g)].map((m) => num(m[1]));
  return dollars.length ? Math.max(...dollars) : null;
}

const COMMODITIES: { re: RegExp; ref: string; unit: "barrels" | "MMBtu" | "oz" | "lb" }[] = [
  { re: /natural gas/i, ref: "Natural Gas", unit: "MMBtu" },
  { re: /\bgold\b/i, ref: "Gold", unit: "oz" },
  { re: /\bsilver\b/i, ref: "Silver", unit: "oz" },
  { re: /\bcopper\b/i, ref: "Copper", unit: "lb" },
  { re: /diesel|gasoline|jet fuel|\bfuel\b|\boil\b|\bgas\b/i, ref: "Brent", unit: "barrels" },
];

/** Which commodity and how many of its price units the business is exposed to. */
export function parseCommodity(text: string): { ref: string; units: number | null } | null {
  const c = COMMODITIES.find((x) => x.re.test(text));
  if (!c) return null;
  let units: number | null = null;
  if (c.unit === "barrels") {
    const gal = text.match(/(\d[\d,]*)\s*gallons?/i);
    const bbl = text.match(/(\d[\d,]*)\s*barrels?/i);
    units = gal ? num(gal[1]) / 42 : bbl ? num(bbl[1]) : null; // 42 gallons per barrel
  } else if (c.unit === "oz") {
    const oz = text.match(/(\d[\d,.]*)\s*(?:troy\s*)?(?:oz|ounces?)/i);
    units = oz ? num(oz[1]) : null;
  } else if (c.unit === "lb") {
    const lb = text.match(/(\d[\d,]*)\s*(?:lbs?|pounds?)/i);
    units = lb ? num(lb[1]) : null;
  } else {
    const mm = text.match(/(\d[\d,]*)\s*mmbtu/i);
    units = mm ? num(mm[1]) : null;
  }
  return { ref: c.ref, units };
}

function endOfWindow(text: string, now: Date): string {
  if (/end of (the )?month|this month|before month[- ]end/i.test(text)) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59)).toISOString();
  }
  return new Date(now.getTime() + 14 * 24 * 3600_000).toISOString();
}

/**
 * The team whose win triggers the cost. When both teams are named ("If Indianapolis
 * beats Houston"), prefer the one followed by beats/wins; otherwise the first one named.
 */
export function findTeam(text: string, games: { m: Market }[]): { m: Market; team: string } | null {
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hits: { m: Market; team: string; at: number; wins: boolean }[] = [];
  for (const g of games) {
    for (const c of g.m.contracts) {
      const m = new RegExp(`\\b${esc(c.label)}\\b`, "i").exec(text);
      if (!m) continue;
      const wins = new RegExp(`\\b${esc(c.label)}\\s+(?:beats?|wins?|takes|tops)\\b`, "i").test(text);
      hits.push({ m: g.m, team: c.label, at: m.index, wins });
    }
  }
  if (!hits.length) return null;
  const best = hits.find((h) => h.wins) ?? hits.sort((a, b) => a.at - b.at)[0];
  return { m: best.m, team: best.team };
}

export interface FallbackResult {
  profile: RiskProfile;
  followUps: string[];
  analysis: Analysis;
}

const noAI = {} as AIProvider; // price risks never call the AI in analyzeRisk

export async function fallbackAnalyze(text: string, venue: VenueAdapter, now = new Date(), onStep: OnStep = () => {}): Promise<FallbackResult | null> {
  const exposure = parseExposure(text);
  const range = (v: number) => ({ low: Math.round(v * 0.8), expected: Math.round(v), high: Math.round(v * 1.2) });

  // Rising costs first: "fuel" etc. are unambiguous.
  const commodity = parseCommodity(text);
  if (commodity && !/\bwins?\b|\bbeats?\b/i.test(text)) {
    if (!commodity.units) return null; // can't size without "how much"
    const profile: RiskProfile = {
      id: `biz-${now.getTime()}`,
      segment: "business",
      kind: "price_rise",
      underlying: { type: "commodity", ref: commodity.ref },
      condition: `${commodity.ref === "Brent" ? "Fuel" : commodity.ref} prices rise`,
      exposureUsd: range(exposure ?? 0),
      window: { start: now.toISOString(), end: endOfWindow(text, now) },
      source: "conversation",
      headline: `${commodity.ref === "Brent" ? "Fuel" : commodity.ref} prices rising`,
      notes: commodity.ref === "Brent" ? `${Math.round(commodity.units)} barrels-equivalent (42 gallons each); oil as a stand-in for fuel.` : undefined,
      position: { asset: commodity.ref, quantity: commodity.units, spotPrice: 0 },
    };
    onStep({ step: "understand", status: "done", detail: `${profile.condition} · about ${Math.round(commodity.units)} ${commodity.ref === "Brent" ? "barrels-equivalent" : "units"}` });
    const analysis = await analyzeRisk(profile, { venue, ai: noAI, now, onStep });
    return { profile, followUps: [], analysis };
  }

  // Game-day promos.
  onStep({ step: "search", status: "active", detail: "Looking through upcoming NFL games" });
  const games = await upcomingGames(venue);
  const hit = findTeam(text, games);
  if (!hit || !exposure) return null;
  onStep({ step: "understand", status: "done", detail: `${hit.team} wins · costs you about $${Math.round(exposure).toLocaleString()}` });
  onStep({ step: "search", status: "done", detail: `${games.length} upcoming games checked · found ${hit.m.title}` });
  const related = await relatedGameOptions(venue, hit.m, hit.team);
  onStep({
    step: "match",
    status: "done",
    detail: `${1 + related.length} option${related.length ? "s" : ""} · 1 exact match on the game result${related.length ? ` · ${related.length} partial` : ""}`,
  });
  const contract = hit.m.contracts.find((c) => c.label === hit.team)!;
  const profile: RiskProfile = {
    id: `biz-${now.getTime()}`,
    segment: "business",
    kind: "event_trigger",
    underlying: { type: "sports", ref: hit.m.title },
    condition: `${hit.team} wins`,
    exposureUsd: range(exposure),
    window: { start: now.toISOString(), end: hit.m.expiry },
    source: "conversation",
    headline: `Your promo if ${hit.team} wins`,
    notes: `Cost estimated from your description; turnout ±20%.`,
  };
  return {
    profile,
    followUps: [],
    analysis: {
      type: "event",
      matches: [
        {
          symbol: contract.symbol,
          outcome: "yes",
          quality: "exact",
          rationale: `Pays out if ${hit.team} beats ${hit.m.contracts.find((c) => c.label !== hit.team)?.label ?? "their opponent"}, the same thing that triggers your promo.`,
          ruleMismatches: ["Read the contract rules for overtime, postponement and cancellation before approving."],
          contract,
        },
        ...related,
      ],
    },
  };
}

const pointsIn = (label: string, re: RegExp) => Number(label.match(re)?.[1] ?? NaN);

/**
 * Other markets on the same game that partly line up with "if <team> wins": the point
 * spread (a narrow win doesn't pay) and the team's points total (correlated, not the same).
 */
async function relatedGameOptions(venue: VenueAdapter, game: Market, team: string) {
  const prefix = game.id.replace(/-M$/, "-");
  const markets = (await venue.listMarkets({ category: ["Sports"], sport: ["american_football"], search: team, limit: 50 }).catch(() => [])).filter(
    (m) => m.id.startsWith(prefix) && m.id !== game.id,
  );
  const priced = (m: Market | undefined, starts: string) =>
    (m?.contracts ?? []).filter((c) => c.tradable && c.quote.yesAsk !== null && c.label.startsWith(starts));
  const out: EventMatch[] = [];

  const spread = priced(markets.find((m) => m.id === `${prefix}S`), `${team} wins by more than`).sort(
    (a, b) => pointsIn(a.label, /more than ([\d.]+)/) - pointsIn(b.label, /more than ([\d.]+)/),
  )[0];
  if (spread) {
    const pts = pointsIn(spread.label, /more than ([\d.]+)/);
    out.push({
      symbol: spread.symbol,
      outcome: "yes",
      quality: "proxy",
      rationale: `Pays if ${team} wins by more than ${pts} points. That covers most ${team} wins, but not a very close one.`,
      ruleMismatches: [`If ${team} wins by ${Math.floor(pts)} point${Math.floor(pts) === 1 ? "" : "s"} or fewer, your promo still runs but this doesn't pay.`],
      contract: spread,
    });
  }

  const totals = priced(markets.find((m) => m.id === `${prefix}TT`), `${team} scores more than`).sort(
    (a, b) => pointsIn(a.label, /more than ([\d.]+)/) - pointsIn(b.label, /more than ([\d.]+)/),
  );
  const total = totals[Math.floor(totals.length / 2)];
  if (total) {
    const pts = pointsIn(total.label, /more than ([\d.]+)/);
    out.push({
      symbol: total.symbol,
      outcome: "yes",
      quality: "proxy",
      rationale: `Pays if ${team} scores more than ${pts} points. A team that scores a lot usually wins, but it's not the same event.`,
      ruleMismatches: [`${team} can score more than ${pts} and still lose, or win while scoring less, so this can pay when your promo doesn't run, or miss when it does.`],
      contract: total,
    });
  }
  return out;
}
