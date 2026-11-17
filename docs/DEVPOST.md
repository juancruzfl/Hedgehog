# Hedgehog: Devpost submission draft

**Tagline:** One market. Many real-world risks. Hedgehog turns live Gemini prediction markets into plain-English hedges for crypto holders and small businesses.

**Submit to:** Main track: Consumer Applications · Chain award: Best use of Solana · Bounty: Gemini Prediction Markets

---

## Inspiration

A bar owner runs "half-price wings if the home team wins." A delivery company watches diesel climb. Someone holding SOL wonders how bad next week could get. They all face the same problem: a specific event that would cost them money, with no simple way to soften it.

Prediction markets already price these events every minute. A market that pays $1 if oil rises above $93 is, to a delivery fleet, a way to turn a fuel spike into a known cost. Nobody had made that usable for normal people, so we built Hedgehog.

## What it does

Hedgehog has two front doors that feed one hedging engine.

**For crypto holders.** Tap a coin and type an amount, or paste a Solana wallet address (read-only, nothing to sign). Hedgehog shows the market's odds in plain words: *"Will SOL drop below $65 by Nov 20? 7%, about 1 in 14. If it does, you'd be down about $223."* Pick a Light, Balanced or Strong cushion and see exactly what happens if SOL ends 10%, 20% or 30% lower, with and without the hedge.

**For small businesses.** Describe the worry in your own words. AI turns it into a structured risk, searches live Gemini markets, labels each one an *Exact* or *Partial* match and reads the contract's fine print ("Overtime counts…"). Then the numbers: *"You pay $480 now · if it happens you get $3,000 · your cost either way: $480."* An uncertain $3,000 hit becomes a known $480 cost.

**Then you decide.** Every order is shown in full, including what it doesn't cover. On approval the server re-checks the live price, a spend cap and tradability before anything is placed. **My hedges** tracks positions at live prices and settles them from Gemini's own market resolution.

The landing page explains the idea in one glance: live markets rotate in the center with the real-world risks each one can offset floating around them (oil → delivery fleet, food truck, landscaper; an NFL game → sports bar, pizza shop, car dealership).

## How we built it

- **Next.js + TypeScript**, one app with server routes so API keys never reach the browser.
- **Gemini Prediction Markets API** for everything market-related: event discovery with category, search and sport filters; per-event re-validation; order placement, cancel and active orders; positions; terms status; balances. Private calls use HMAC-SHA384 signing through a client that serializes requests so nonces always increase.
- **Odds history:** Gemini doesn't return price history for these markets, so we built a collector that snapshots every crypto, commodity and weather contract every 5 minutes into SQLite. The forecast cards chart how the odds moved.
- **Solana:** read-only wallet reading over JSON-RPC (`getBalance`, `getTokenAccountsByOwner`), mapping native SOL and SPL tokens (cbBTC, Wormhole WBTC/WETH, mSOL, JitoSOL) to hedgeable assets. Phantom is used only to share the public key.
- **Hedging engine:** a pure, unit-tested sizer that builds event hedges and multi-strike ladders for falling prices (crypto) and rising prices (fuel, metals), plus payoff curves.
- **AI (OpenAI-compatible, Grok by default):** parses plain-English risks, plans the market search and checks the fine print. It never does money math, and it can only pick from real candidate contracts; invented market symbols are dropped.
- **Venue adapter:** the engine only talks to a `VenueAdapter` interface. Gemini is the implementation; Kalshi or others can plug in.

## Challenges we ran into

- **The Gemini sandbox can't execute downside hedges.** It only lists strikes above the current price, and its order books are empty. We added a paper mode that fills at the live production price and settles from Gemini's real resolution, with live trading one setting away.
- **Sparse strikes.** Some expiries stop well above where a holder wants protection, which would over-size the lowest contract. The sizer narrows the range and tells the user.
- **Honest wording.** A hedge is not insurance. Every screen says what isn't offset and how close a match really is, and the app says so when no market fits.

## Accomplishments we're proud of

- A bar owner can go from "half-price wings if the home team wins" to a fixed-cost hedge on a live market in under a minute, with the fine print explained.
- Crypto never feels like crypto: no seed phrases, no gas, no signing. Hedges settle in dollars.
- 37 unit tests over the money math, AI guardrails, order validation and settlement, plus end-to-end browser checks of every flow.

## What we learned

The hardest part wasn't the trading. It was translation: turning "$93 or above, NO, 39¢" into "Put in $390, get $1,000 back if oil spikes." Prediction-market data becomes useful to everyday people once it is phrased as their own risk.

## What's next

- Alerts when a hedge needs renewing or the odds move sharply.
- More venues through the adapter, so the best market wins.
- Partnering with exchanges on the markets small businesses ask for most (rain, snow, local events).

## Built with

Next.js · TypeScript · Gemini Prediction Markets API · Solana JSON-RPC · Phantom · xAI Grok (OpenAI-compatible) · Hyperliquid price feed · SQLite · Recharts · Tailwind CSS · Vitest
