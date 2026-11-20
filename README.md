# Hedgehog

**Are the odds in your favor?**

A prediction market pays $1 if something happens. If that same thing would cost you money, the payout softens the hit. Hedgehog turns live
[Gemini prediction markets](https://developer.gemini.com/products/prediction-markets) into plain-English hedges for two kinds of people:

- **Crypto traders:** paste a Solana wallet (or type what you hold), see the market's odds of your coins dropping, and cushion a fall in a few taps.
- **Small business owners:** describe a promo, fuel bill or weather worry in your own words. Hedgehog finds the matching market, checks its fine print, and shows what you'd pay and get back.

No seed phrases, no signing, no custody. Every order is shown in full, including what it doesn't cover, and nothing happens without your approval. Every price
Hedgehog uses, and every hedge you approve, is sealed on Solana so anyone can check it.

> Hedgehog is software, not an exchange or an advisor. A hedge reduces, but does not remove, losses, and you can lose what you pay for it.

---

## The flow

1. **Landing page** (`/`). Signed out, the nav shows only **Past promos** and **Connect Gemini**. Live markets rotate in the center (oil, SOL, an NFL game, gold) with the real-world risks each one can offset around them.
2. **Connect Gemini.** The user signs in with their Gemini account (OAuth), or, while Gemini reviews Hedgehog's OAuth app, with Hedgehog's shared sandbox account ([below](#connecting-gemini)).
3. **What do you hedge?** (`/welcome`). Right after signing in: **Crypto trader**, **Small business owner**, or both (at least one). This decides the nav, and can be changed from the account menu.
4. **Trending markets** (`/markets`), the product's home for now: Gemini's most-traded markets over the last 24 hours.
5. **Hedge** from **Crypto** (`/crypto`) or **Business** (`/business`), then follow it in **My hedges** (`/positions`), each with a receipt sealed on Solana.

| | Crypto traders (`/crypto`) | Small business owners (`/business`) |
|---|---|---|
| **1. Tell us** | Tap a coin and type an amount, read a Solana wallet, or import Gemini balances | Describe the risk in plain English ("Half-price wings if the home team wins…") |
| **2. See the odds** | "Will SOL drop below $65 by Nov 30? **17%** (about 1 in 6)", plus a ladder of smaller/bigger drops and odds history | AI parses the risk, finds candidate Gemini markets, labels each **Exact** or **Partial** match and lists the fine print |
| **3. Decide** | Light / Balanced / Strong cushion; "what happens if SOL ends at…" table | "You pay $480 now · if it happens you get $3,000 · your cost either way $480" |
| **4. Approve** | Review → acknowledge → server re-checks live price, spend cap and tradability → order + sealed receipt | Same |

**My hedges** tracks open positions at live prices and settles them from Gemini's own market resolution ("✓ Paid out $400 · net +$280"), with a link to each hedge's receipt.

## Connecting Gemini

Hedgehog has two sign-in modes (`lib/auth/mode.ts`):

- **OAuth (normal).** **Connect Gemini account** sends the user to Gemini to sign in and approve Hedgehog's access (`account:read`, `balances:read`, `orders:read`, `orders:create`). Gemini redirects back to `/api/auth/gemini/callback`, where the server swaps the code for an access token (24 hours) and a one-time-use refresh token, then sends the user to `/welcome`.
  - Tokens stay on the server, encrypted with AES-256-GCM. The browser holds only a random session id in an httpOnly cookie; the database stores just its hash.
  - Access tokens refresh automatically before they expire, one refresh at a time per session (each refresh token works once). Sign out revokes the refresh token.
- **Sandbox (while OAuth approval is pending).** With `GEMINI_SIGN_IN=sandbox-key`, **Connect Gemini sandbox** signs people in to Hedgehog's own Gemini **sandbox** account (the server's `GEMINI_API_KEY`/`SECRET`) instead. Everything after sign-in is the same. Every visitor shares that one test account, shown as "Hedgehog demo account"; the account menu says it's a shared test account. The mode refuses to start unless the key trades in the sandbox, so it can never hand out a production account.

Roles (crypto, business or both) are stored on the session (`lib/auth/roles.ts`, `POST /api/account/roles`).

## How it uses the Gemini Prediction Markets API

| Endpoint | Used for |
|---|---|
| `GET /v1/prediction-markets/events` (+ `category`, `search`, `sport` filters) | Market discovery for forecasts, matching, trending markets and the landing page; `volume24h` and `startTime` drive sports tracking |
| `GET /v1/prediction-markets/events/{ticker}` | Live re-validation before placing orders; **settlement** via each contract's `resolutionSide`; games Gemini's list leaves out |
| `POST /v1/prediction-markets/order` | Placing approved hedges (limit orders at the user-approved price) |
| `POST /v1/prediction-markets/order/cancel`, `/orders/active` | Order management |
| `POST /v1/prediction-markets/positions` | Live positions |
| `POST /v1/prediction-markets/terms/status` | Refuses to trade until the account has accepted the latest terms |
| `POST /v1/balances`, `POST /v1/account` | Importing crypto held on Gemini, USD available for hedges, the account's name |

Private calls use HMAC-SHA384 signing (or the signed-in user's bearer token) with a shared client that serializes requests so nonces always increase.

## Odds archive, sealed on Solana

Gemini's API returns today's odds but no history, so the collector (`npm run collect`, or `ENABLE_COLLECTOR=1` in the web process) snapshots markets every 5 minutes into SQLite:

- every crypto, commodity and weather contract, and any market someone hedged or looked at;
- **sports, tracked ahead of time** (`lib/odds/sports.ts`): the 25 busiest games starting in the next 7 days by 24-hour volume, plus every game of the teams in `SPORTS_ALWAYS_TEAMS`. A game's sub-markets are grouped back into it by ticker prefix, and only full-game markets (winner, total, spread) are recorded, so a "free shot per touchdown" promo can be hedged with a points total.

Hedgehog seals three things on Solana, each as a Memo transaction from its archive wallet (users never sign or pay):

| What | When | Memo |
|---|---|---|
| **Each hour of odds** | ~10 minutes after the hour ends | `hedgehog-odds v1 <hour> n=<readings> root=<merkle root>` |
| **The odds at kickoff** | when a tracked game starts: its markets' last readings before play | `hedgehog-kickoff v1 <game> start=… at=… n=… root=…` |
| **Each hedge** | right after it's approved | `hedgehog-hedge v1 id=<hedge> sha256=<receipt hash>` |

- Readings are hashed into a Merkle tree and only the 32-byte root goes on-chain. The odds themselves are never published (Gemini's Market Data Agreement allows internal use; redistribution needs a separate agreement).
- A **hedge receipt** is the exact JSON of what was hedged, the orders, cost, payout and the live quotes it was checked against. The promo terms appear only as a hash, so a receipt can be shared without revealing a business's numbers. Those quotes are also written to the archive, so each one is provable against its hour's seal.
- `/archive` lists every sealed hour and kickoff. **Check it yourself** fetches one reading and its proof (about 14 hashes), rebuilds the fingerprint in the browser, reads the memo straight from Solana's public RPC, and shows whether they match.
- `/receipt/[id]` shows a hedge's receipt. **Verify on Solana** hashes the receipt in the browser and compares it with the memo, then checks each odds reading against its hour's seal.
- `lib/archive/merkle.ts` is the format (leaf = SHA-256(0x00 ‖ reading), node = SHA-256(0x01 ‖ left ‖ right)); it runs in Node and in the browser.

```bash
npm run archive:anchor -- --wallet   # show the archive wallet and balance (devnet key is created in data/)
npm run archive:anchor               # seal every finished hour that isn't on-chain yet
```

Everything runs on **Solana devnet** by default (it's reset from time to time). Mainnet needs `SOLANA_CLUSTER=mainnet-beta` and a funded `SOLANA_ARCHIVE_SECRET`.

## Past promos: "Were the odds in your favor?"

`/lookback` answers "what would a hedge have saved on my last promo?" It's open to everyone and in the signed-out nav; signed-in business owners reach it from `/business`.

- It opens on a recent example: the latest game where hedging a promo the day before would have paid off.
- **Try your own**: pick a past game or weather day from the archive, what triggered the promo ("Indianapolis wins", "the high is 90°F or above"), the promo and its cost, and when you'd have hedged (as early as possible, the day before, or last minute). The result updates as you change anything.
- The price is the archived YES ask at that time. Only readings from **before** kickoff (games) or 10 AM ET (weather days) are used, so there's no hindsight. The hedge is sized like a live one (enough $1 contracts to pay the promo cost back) and Gemini's settlement says whether the promo kicked in (`lib/lookback/lookback.ts` is pure and unit-tested; `lib/lookback/data.ts` reads the archive and Gemini).
- **Check it on Solana** verifies the exact price used against the hour's fingerprint, in the browser.
- Every result is a URL (`?m=&c=&cost=&at=&promo=`) with its own preview image (`/api/lookback/card`), so a "you'd have saved $X" result can be shared.

## Trending markets

`/markets` lists Gemini's most-traded markets over the last 24 hours (`lib/markets/trending.ts`): one card per game (its totals and spreads count toward it), at most 5 per category, skipping markets that close within the hour or have no prices. Cards use the landing page's market card; markets Hedgehog hasn't charted yet show an empty chart until it has a few readings. The list is cached for two minutes, warmed at startup, and its markets are added to the collector.

## How it uses Solana for crypto

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
                approval → re-validate → paper or live order → receipt sealed on Solana
```

- `lib/engine/sizer.ts`: all money math (event hedges, downside/upside strike ladders, payoff curves). Pure and unit-tested.
- `lib/ai/`: `AIProvider` interface; one OpenAI-compatible implementation (OpenRouter by default, so any model works). If a model doesn't support strict JSON schemas it falls back to JSON mode automatically. **The AI interprets; it never sizes or places orders**, and it can only pick from real candidate contracts.
- `lib/business/fallback.ts`: if the AI is unavailable, a basic matcher still handles game-day promos and fuel/metal costs, and the page says it was used.
- `lib/auth/`: Gemini OAuth, sessions, sandbox sign-in and roles.
- `lib/venues/`: venue-agnostic types; `gemini/` client, normalizer and adapter.
- `lib/hedges/`: approval, re-validation, paper execution, settlement, receipts and their sealing.
- `lib/odds/`, `lib/archive/`: the collector, sports tracking, the archive store, Merkle proofs, hourly and kickoff seals, and browser-side verification.
- `lib/markets/`, `lib/lookback/`, `lib/landing/`: trending markets, the past-promos look-back, and the landing page's live board.
- `lib/holdings/`, `lib/chain/`: Solana wallet reading, Gemini balances, live prices (Gemini's public ticker, Hyperliquid as a fallback).

### Paper vs. live trading

Gemini's sandbox only lists strikes above the current price and has nearly empty order books, so most hedges wouldn't fill there. Hedgehog defaults to **paper mode**: it fills at the live production ask and records the hedge locally (still with a sealed receipt), then settles it from Gemini's real resolution. `HEDGE_EXECUTION=live` places real limit orders wherever `GEMINI_TRADING_ENV` points.

## Run it

```bash
npm install
cp .env.example .env.local     # market data needs no key; add Gemini + AI keys for the rest
npm run collect &              # record odds history and seal it (keep it running)
npm run dev                    # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `GEMINI_OAUTH_CLIENT_ID`, `GEMINI_OAUTH_CLIENT_SECRET` | OAuth app for "Connect Gemini account" (each user's balances, positions and live orders) |
| `GEMINI_OAUTH_ENV` | `sandbox` (default) or `production`; production needs Gemini's approval of the app |
| `GEMINI_SIGN_IN` | `sandbox-key`: sign people in to Hedgehog's shared sandbox account instead of OAuth (needs sandbox API keys) |
| `SESSION_SECRET` | Encrypts stored Gemini tokens; required in production, in either sign-in mode |
| `GEMINI_API_KEY`, `GEMINI_API_SECRET` | Server-side key: local development without OAuth, or the shared account for `GEMINI_SIGN_IN=sandbox-key`. Only ever a sandbox key on a public deploy |
| `GEMINI_TRADING_ENV` / `GEMINI_MARKET_DATA_ENV` | Where orders go (`sandbox`) / where market data comes from (`production`) |
| `HEDGE_EXECUTION` | `paper` (default) or `live` |
| `MAX_HEDGE_USD` | Per-hedge spend cap enforced server-side (default 5000) |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | OpenRouter by default (`https://openrouter.ai/api/v1`); any OpenAI-compatible provider works. `npm run ai:check` verifies the key and model |
| `AI_LIMIT_PER_HOUR`, `AI_DAILY_LIMIT` | Guardrails for the business AI. Defaults: 20 analyses per visitor per hour, 300 a day in total, then the free basic matcher. Off-topic text is turned away, and repeated identical requests are cached for 15 minutes |
| `ARCHIVE_ANCHOR` | `1`: seal hours, kickoffs and hedge receipts on Solana |
| `SOLANA_CLUSTER`, `SOLANA_ARCHIVE_SECRET`, `SOLANA_RPC_URL` | `devnet` (default) or `mainnet-beta`; the archive wallet's key (required on mainnet; on devnet one is created in `data/`); an optional RPC |
| `SPORTS_TRACKING`, `SPORTS_ALWAYS_TEAMS` | `0` turns sports pre-tracking off; the teams always tracked (default Knicks, Browns, Seahawks, Dolphins, Giants, Jets, Rangers) |

```bash
npm test             # 177 unit tests: sizer, forecast, normalizer, AI guardrails, fallback matcher, execution, receipts,
                     #   settlement, sessions and roles, sports tracking, kickoff seals, Merkle proofs, look-back, trending
npm run typecheck
npm run demo:check   # pre-demo readiness: collector, market data, next game, AI, Gemini key, settled hedges
```

## Deploy (Railway)

`railway.json` builds with `npm run build` and starts with `npm run start` (Node 22, health check `/api/health`).
One service plus one volume mounted at `/data`. Set:

| Variable | Value |
|---|---|
| `ODDS_DB_PATH` / `HEDGES_DB_PATH` | `/data/odds.sqlite` / `/data/hedgehog.sqlite` |
| `ENABLE_COLLECTOR` | `1` (runs the odds collector and the Solana sealing inside the web process) |
| `ARCHIVE_ANCHOR`, `SOLANA_CLUSTER` | `1`, `devnet`; fund the archive wallet with test SOL |
| `SESSION_SECRET` | a long random string |
| `GEMINI_SIGN_IN` + `GEMINI_API_KEY`/`SECRET` | `sandbox-key` and **sandbox** keys while OAuth approval is pending; otherwise the `GEMINI_OAUTH_*` settings with `GEMINI_OAUTH_REDIRECT_URI` set to the deployed callback |
| `HEDGE_EXECUTION` | `paper` |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | as locally |

## Brand

`docs/brand/` has the current logo (SVG, and PNG at 512 and 1024 px): `hedgehog-logo` for light backgrounds, `hedgehog-logo-white` for dark ones,
`hedgehog-app-icon` (the favicon tile) and `hedgehog-wordmark` (the name with the logo to its right, as in the nav). `hedgehog-intro.gif` is the
logo animation for the demo video: the hedgehog gets startled, curls into a ball and rolls right to reveal the name.

## Honest limits

- **Approximate matches are labeled.** Oil is a stand-in for diesel; a game result isn't foot traffic. The app says how close the match is.
- **Markets are short-dated.** Gemini's commodity and weather markets settle within days, so longer risks need renewing.
- **No market, no hedge.** Rain, snow and interest rates aren't listed right now, and Hedgehog says so instead of forcing a bad match.
- **Sealing proves a record wasn't changed, not that it was right,** and it proves quotes, not fills: the price a user actually paid lives in their Gemini account.
- **The sandbox is a shared test account.** Until Gemini approves the OAuth app, every visitor uses the same sandbox account and hedges are paper trades.
- Costs shown exclude Gemini trading fees.
