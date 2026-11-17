# Hedgehog

**One market. Many real-world risks.**

A prediction market pays $1 if something happens. If that same thing would cost you money, the payout softens the hit. Hedgehog turns live
[Gemini prediction markets](https://developer.gemini.com/products/prediction-markets) into plain-English hedges for two kinds of people:

- **Crypto holders:** paste a Solana wallet (or type what you hold), see the market's odds of your coins dropping, and cushion a fall in a few taps.
- **Small businesses:** describe a promo, fuel bill or weather worry in your own words. Hedgehog finds the matching market, checks its fine print, and shows what you'd pay and get back.

No seed phrases, no signing, no custody. Every order is shown in full, including what it doesn't cover, and nothing happens without your approval.

> Hedgehog is software, not an exchange or an advisor. A hedge reduces, but does not remove, losses, and you can lose what you pay for it.

---

## What it does

| | Crypto holders (`/crypto`) | Small businesses (`/business`) |
|---|---|---|
| **1. Tell us** | Tap a coin and type an amount, read a Solana wallet, or import Gemini balances | Describe the risk in plain English ("Half-price wings if the home team wins…") |
| **2. See the odds** | "Will SOL drop below $65 by Nov 20? **7%** (about 1 in 14)", plus a ladder of smaller/bigger drops and odds history | AI parses the risk, finds candidate Gemini markets, labels each **Exact** or **Partial** match and lists the fine print |
| **3. Decide** | Light / Balanced / Strong cushion; "what happens if SOL ends at…" table | "You pay $480 now · if it happens you get $3,000 · your cost either way $480" |
| **4. Approve** | Review → acknowledge → server re-checks live price, spend cap and tradability → order | Same |

Then **My hedges** tracks open positions at live prices and settles them from Gemini's own market resolution ("✓ Paid out $400 · net +$280").

The landing page shows the idea directly: live markets rotate in the center (oil, SOL, an NFL game, gold) with the real-world risks each one can offset floating around them.

## How it uses the Gemini Prediction Markets API

| Endpoint | Used for |
|---|---|
| `GET /v1/prediction-markets/events` (+ `category`, `search`, `sport` filters) | Market discovery for forecasts, matching and the landing page |
| `GET /v1/prediction-markets/events/{ticker}` | Live re-validation before placing orders; **settlement** via each contract's `resolutionSide` |
| `POST /v1/prediction-markets/order` | Placing approved hedges (limit orders at the user-approved price) |
| `POST /v1/prediction-markets/order/cancel`, `/orders/active` | Order management |
| `POST /v1/prediction-markets/positions` | Live positions |
| `POST /v1/prediction-markets/terms/status` | Refuses to trade until the account has accepted the latest terms |
| `POST /v1/balances` | Importing crypto held on Gemini, and USD available for hedges |

Private calls use HMAC-SHA384 signing with a shared client that serializes requests so nonces always increase.

**Odds over time:** Gemini doesn't return price history for these markets, so `scripts/collect-odds.ts` snapshots every crypto, commodity and weather contract every 5 minutes into SQLite. The forecast cards and landing page chart that history.

## How it uses Solana

The crypto flow reads a wallet **read-only** over Solana JSON-RPC (`getBalance`, `getTokenAccountsByOwner`): native SOL plus SPL tokens that track hedgeable assets (cbBTC, Wormhole WBTC/WETH, mSOL, JitoSOL). Paste an address or connect Phantom just to share the public key. Nothing is signed.

## Architecture

```
          Crypto front door                     Business front door
   (Solana wallet / Gemini / typed)       (plain English → AI interpretation)
                    │                                    │
                    └──────────────►  RiskProfile  ◄─────┘
                                          │
                         ┌────────── Hedging engine ──────────┐
                         │ forecast · market matching · sizer │  ← deterministic money math
                         └──────────────────┬─────────────────┘
                                            │
                         VenueAdapter  ──►  GeminiAdapter  (Kalshi etc. can plug in)
                                            │
                            approval → re-validate → paper or live order
```

- `lib/engine/sizer.ts`: all money math (event hedges, downside/upside strike ladders, payoff curves). Pure and unit-tested.
- `lib/ai/`: `AIProvider` interface; one OpenAI-compatible implementation (xAI Grok by default). **The AI interprets; it never sizes or places orders**, and it can only pick from real candidate contracts.
- `lib/business/fallback.ts`: if the AI is unavailable, a basic matcher still handles game-day promos (team found in live NFL markets, cost from "500 orders at $6") and fuel/metal costs (gallons converted to barrels), and the page says it was used.
- `lib/venues/`: venue-agnostic types; `gemini/` client, normalizer and adapter.
- `lib/hedges/`: approval, re-validation, paper execution and settlement.
- `lib/holdings/`, `lib/chain/`: Solana wallet reading, Gemini balances, live prices.

### Paper vs. live trading

Gemini's sandbox only lists strikes above the current price and has empty order books, so downside hedges can't be executed there. Hedgehog defaults to **paper mode**: it fills at the live production ask and records the hedge locally, then settles it from Gemini's real resolution. `HEDGE_EXECUTION=live` places real limit orders wherever `GEMINI_TRADING_ENV` points.

## Run it

```bash
npm install
cp .env.example .env.local     # market data needs no key; add Gemini + AI keys for the rest
npm run collect &              # start recording odds history (keep it running)
npm run dev                    # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY`, `GEMINI_API_SECRET` | Account-scoped key with the Trader role (balances, positions, live orders) |
| `GEMINI_TRADING_ENV` / `GEMINI_MARKET_DATA_ENV` | Where orders go (`sandbox`) / where market data comes from (`production`) |
| `HEDGE_EXECUTION` | `paper` (default) or `live` |
| `MAX_HEDGE_USD` | Per-hedge spend cap enforced server-side (default 5000) |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Any OpenAI-compatible provider; `npm run ai:check` lists your models |

```bash
npm test             # 48 unit tests: sizer, forecast, normalizer, AI guardrails, fallback matcher, execution, settlement
npm run typecheck
npm run demo:check   # pre-demo readiness: collector, market data, next game, AI, Gemini key, settled hedges
```

## Honest limits

- **Approximate matches are labeled.** Oil is a stand-in for diesel; a game result isn't foot traffic. The app says how close the match is.
- **Markets are short-dated.** Gemini's commodity and weather markets settle within days, so longer risks need renewing.
- **No market, no hedge.** Rain, snow and interest rates aren't listed right now, and Hedgehog says so instead of forcing a bad match.
- Costs shown exclude Gemini trading fees.
