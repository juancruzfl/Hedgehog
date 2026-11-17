# Hedgehog: Devpost submission draft

**Tagline:** Are the odds in your favor? Hedgehog lets anyone hedge a real-world risk in under 10 clicks, without knowing what a prediction market is.

**Submit to:** Main track: Consumer Applications · Chain award: Best use of Solana · Bounty: Gemini Prediction Markets

---

## Inspiration

A bar owner runs "half-price wings if the home team wins." A delivery company watches diesel climb. Someone holding SOL wonders how bad next week could get. They all face the same problem: a specific event that would cost them money, with no simple way to soften it.

Prediction markets already price these events every minute. A market that pays $1 if oil rises above $93 is, to a delivery fleet, a way to turn a fuel spike into a known cost. Nobody had made that usable for normal people, so we built Hedgehog.

## What it does

Hedgehog has two front doors that feed one hedging engine.

**For crypto holders.** Connect a Solana wallet (read-only, nothing to sign), import from Gemini, or type what you hold. Each coin gets its own card, and the page title follows along: *"How likely is your SOL to drop?"* Hedgehog shows the market's odds in plain words: *"Will SOL drop below $65 by Nov 20? 7%, about 1 in 14. If it does, you'd be down about $223."* Pick a Light, Balanced or Strong cushion and see exactly what happens if SOL ends 10%, 20% or 30% lower, with and without the hedge.

**For small businesses.** The page is one big chat box: *"What could hurt your business?"* Describe the worry in your own words. The engine's steps then take over the screen, one at a time, as AI turns it into a structured risk, searches live Gemini markets, labels each one an *Exact* or *Partial* match and reads the contract's fine print ("Overtime counts…"). Then the numbers: *"You pay $480 now · if it happens you get $3,000 · your cost either way: $480."* An uncertain $3,000 hit becomes a known $480 cost.

**Then you decide.** Every order is shown in full, including what it doesn't cover. On approval the server re-checks the live price, a spend cap and tradability before anything is placed. **My hedges** tracks positions at live prices and settles them from Gemini's own market resolution.

The landing page explains the idea in one glance: a live market in the center with the real-world risks it can offset around it (oil → delivery fleet, food truck, landscaper; an NFL game → sports bar, pizza shop, car dealership). Every option card flips over to show how its odds have moved.

**Under 10 clicks, start to finish.** A crypto holder goes from an empty page to a placed hedge in about 8 clicks; a business owner in about 5 actions (type the risk, Enter, choose an option, review, approve).

## Why not just an AI agent with Gemini's MCP server?

That path works for developers: pick a model, wire up the MCP server, write prompts, and trust the agent with real orders. Hedgehog is for everyone else: the crypto holder worried about a dip and the bar owner running a game-day promo. It speaks their language, not the market's. Users never see YES/NO contracts, strike ladders or order books. They see "Soften a drop in my BTC" or "Your promo if Indianapolis wins," and Hedgehog translates that into the right contracts.

It also does what you can't trust a chat agent with:

- **The math is code, not the model.** Order sizes, limit prices, payout tables and "what this doesn't cover" are computed by a tested engine.
- **Rails around real money.** Every order needs approval, the server re-checks it before placing, symbols come only from Gemini, and paper mode is the default.
- **Honest matching.** Each option is labeled exact, partial or stand-in, with contract-rule differences spelled out.
- **Data an agent doesn't have.** Odds history (Gemini's API has none, so Hedgehog records it) and your real exposure from your wallet or Gemini balances.

The AI is one step, reading your description, and the app still works with it switched off.

## How we built it

- **Next.js + TypeScript**, one app with server routes so API keys never reach the browser.
- **Gemini Prediction Markets API** for everything market-related: event discovery with category, search and sport filters; per-event re-validation; order placement, cancel and active orders; positions; terms status; balances. Private calls use HMAC-SHA384 signing through a client that serializes requests so nonces always increase.
- **Odds history:** Gemini doesn't return price history for these markets, so we built a collector that snapshots every crypto, commodity and weather contract every 5 minutes into SQLite, plus any game market a business has been shown (recorded until it settles). Every card flips over to chart how the odds moved.
- **Solana:** read-only wallet reading over JSON-RPC (`getBalance`, `getTokenAccountsByOwner`), mapping native SOL and SPL tokens (cbBTC, Wormhole WBTC/WETH, mSOL, JitoSOL) to hedgeable assets. Phantom is used only to share the public key.
- **Hedging engine:** a pure, unit-tested sizer that builds event hedges and multi-strike ladders for falling prices (crypto) and rising prices (fuel, metals), plus payoff curves.
- **AI (OpenAI-compatible through OpenRouter, so the model is swappable):** parses plain-English risks, plans the market search and checks the fine print. It never does money math, and it can only pick from real candidate contracts; invented market symbols are dropped.
- **Venue adapter:** the engine only talks to a `VenueAdapter` interface. Gemini is the implementation; Kalshi or others can plug in.

## Challenges we ran into

- **The Gemini sandbox can't execute downside hedges.** It only lists strikes above the current price, and its order books are empty. We added a paper mode that fills at the live production price and settles from Gemini's real resolution, with live trading one setting away.
- **Sparse strikes.** Some expiries stop well above where a holder wants protection, which would over-size the lowest contract. The sizer narrows the range and tells the user.
- **Honest wording.** A hedge is not insurance. Every screen says what isn't offset and how close a match really is, and the app says so when no market fits.

## Accomplishments we're proud of

- A bar owner can go from "half-price wings if the home team wins" to a fixed-cost hedge on a live market in about 5 actions and under a minute, with the fine print explained.
- Crypto never feels like crypto: no seed phrases, no gas, no signing. Hedges settle in dollars.
- 56 unit tests over the money math, AI guardrails, order validation and settlement, plus end-to-end browser checks of every flow.

## What we learned

The hardest part wasn't the trading. It was translation: turning "$93 or above, NO, 39¢" into "Put in $390, get $1,000 back if oil spikes." Prediction-market data becomes useful to everyday people once it is phrased as their own risk.

## What's next

- Alerts when a hedge needs renewing or the odds move sharply.
- More venues through the adapter, so the best market wins.
- Partnering with exchanges on the markets small businesses ask for most (rain, snow, local events).

## Built with

Next.js · TypeScript · Gemini Prediction Markets API · Gemini price ticker · Solana JSON-RPC · Phantom · OpenRouter (OpenAI-compatible) · SQLite · Recharts · Tailwind CSS · Vitest
