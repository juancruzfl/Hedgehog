# Hedgehog

**Are the odds in your favor?**

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

## Connecting a Gemini account

Each person trades from their own Gemini account. **Connect Gemini account** in the nav sends them to Gemini to sign in and approve Hedgehog's access (`account:read`, `balances:read`, `orders:read`, `orders:create`). Gemini redirects back to `/api/auth/gemini/callback`, where the server swaps the code for an access token (24 hours) and a one-time-use refresh token.

- Tokens stay on the server, encrypted with AES-256-GCM. The browser holds only a random session id in an httpOnly cookie, and the database stores just its hash.
- Access tokens refresh automatically before they expire; one refresh runs at a time per session, because each refresh token works once.
- Balances, positions and live orders use the signed-in user's token (`Authorization: Bearer`, no nonce). Sign out revokes the refresh token.
- Until Gemini approves the app for production, sign-in runs against the sandbox.

## Odds archive, sealed on Solana

Gemini's API returns today's odds but no history, so Hedgehog records every crypto, commodity and weather contract, every game's winner market (moneyline), and any other game market someone looks at, every 5 minutes. Each finished hour is **sealed on Solana**:

- All of that hour's readings are hashed into a Merkle tree, and only the 32-byte root goes on-chain, in a Memo transaction from Hedgehog's archive wallet (`hedgehog-odds v1 <hour> n=<readings> root=<hash>`). Users never sign or pay anything.
- The odds themselves are never published. Gemini's Market Data Agreement allows internal use; redistribution needs a separate agreement, so a public API for the archive comes after that.
- `/archive` lists every sealed hour with its Solana transaction. **Check it yourself** fetches one reading and its proof (about 14 hashes) from Hedgehog, rebuilds the fingerprint in the browser, reads the memo straight from Solana's public RPC, and shows whether they match.
- `lib/archive/merkle.ts` is the format (leaf = SHA-256(0x00 ‖ reading), node = SHA-256(0x01 ‖ left ‖ right)); it runs in Node and in the browser.

```bash
npm run archive:anchor -- --wallet   # show the archive wallet and balance (devnet key is created in data/)
npm run archive:anchor               # seal every finished hour that isn't on-chain yet
```

## Past promos (look-back)

`/lookback` answers "what would a hedge have saved on my last promo?" A business picks a past game or weather day from the archive, what triggered the promo ("Indianapolis wins", "the high is 90°F or above"), what the promo cost, and when they'd have hedged (as early as possible, the day before, or last minute).

- The price is the archived YES ask at that time. Only readings from **before** kickoff (games) or 10 AM ET (weather days) are used, so there's no hindsight.
- The hedge is sized like the live one: enough $1 contracts to pay the promo cost back. Gemini's own settlement says whether the promo kicked in (`lib/lookback/lookback.ts` is pure and unit-tested; `lib/lookback/data.ts` reads the archive and Gemini).
- **Check it yourself** verifies the exact price used against the hour's fingerprint on Solana, in the browser.
- Every result is a URL (`?m=&c=&cost=&at=&promo=`) with its own preview image (`/api/lookback/card`), so a "you'd have saved $X" result can be shared or dropped into an outreach email.

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
- `lib/ai/`: `AIProvider` interface; one OpenAI-compatible implementation (OpenRouter by default, so any model works: Grok, Claude, Gemini, GPT). If a model doesn't support strict JSON schemas it falls back to JSON mode automatically. **The AI interprets; it never sizes or places orders**, and it can only pick from real candidate contracts.
- `lib/business/fallback.ts`: if the AI is unavailable, a basic matcher still handles game-day promos (team found in live NFL markets, cost from "500 orders at $6") and fuel/metal costs (gallons converted to barrels), and the page says it was used.
- `lib/venues/`: venue-agnostic types; `gemini/` client, normalizer and adapter.
- `lib/hedges/`: approval, re-validation, paper execution and settlement.
- `lib/holdings/`, `lib/chain/`: Solana wallet reading, Gemini balances, live prices (Gemini's public ticker, Hyperliquid as a fallback).

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
| `GEMINI_OAUTH_CLIENT_ID`, `GEMINI_OAUTH_CLIENT_SECRET` | OAuth app for "Connect Gemini account" (each user's balances, positions and live orders) |
| `GEMINI_OAUTH_ENV` | `sandbox` (default) or `production`; production needs Gemini's approval of the app |
| `SESSION_SECRET` | Encrypts the Gemini tokens stored for signed-in users |
| `GEMINI_API_KEY`, `GEMINI_API_SECRET` | Local development only: one server-side key, used when OAuth isn't configured |
| `GEMINI_TRADING_ENV` / `GEMINI_MARKET_DATA_ENV` | Where orders go (`sandbox`) / where market data comes from (`production`) |
| `HEDGE_EXECUTION` | `paper` (default) or `live` |
| `MAX_HEDGE_USD` | Per-hedge spend cap enforced server-side (default 5000) |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | OpenRouter by default (`https://openrouter.ai/api/v1`); any OpenAI-compatible provider works. `npm run ai:check` verifies the key and model |
| `AI_LIMIT_PER_HOUR`, `AI_DAILY_LIMIT` | Guardrails for the business AI. Defaults: 20 analyses per visitor per hour, 300 AI analyses a day in total, then the free basic matcher. Off-topic text (math, trivia, coding) is turned away before the AI or by its first call, and repeated identical requests are cached for 15 minutes |

```bash
npm test             # 48 unit tests: sizer, forecast, normalizer, AI guardrails, fallback matcher, execution, settlement
npm run typecheck
npm run demo:check   # pre-demo readiness: collector, market data, next game, AI, Gemini key, settled hedges
```

## Deploy (Railway)

`railway.json` builds with `npm run build` and starts with `npm run start` (Node 22, health check `/api/health`).
One service plus one volume mounted at `/data`. Set:

| Variable | Value |
|---|---|
| `ODDS_DB_PATH` / `HEDGES_DB_PATH` | `/data/odds.sqlite` / `/data/hedgehog.sqlite` |
| `ENABLE_COLLECTOR` | `1` (runs the odds collector inside the web process) |
| `HEDGE_EXECUTION` | `paper` |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | as locally |

Gemini API keys are optional for the hosted demo: market data and paper trading need no key. Leaving them unset keeps your account's balances off a public site.

## Honest limits

- **Approximate matches are labeled.** Oil is a stand-in for diesel; a game result isn't foot traffic. The app says how close the match is.
- **Markets are short-dated.** Gemini's commodity and weather markets settle within days, so longer risks need renewing.
- **No market, no hedge.** Rain, snow and interest rates aren't listed right now, and Hedgehog says so instead of forcing a bad match.
- Costs shown exclude Gemini trading fees.
