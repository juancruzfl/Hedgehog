# Hedgehog

Risk reduction powered by Gemini prediction markets. Two front doors (crypto holders, small businesses)
feed one hedging engine. Users approve every trade; orders execute in their own Gemini account.

## Layout

```
lib/types.ts            shared venue-agnostic types (RiskProfile, Contract, HedgeProposal, ...)
lib/engine/sizer.ts     deterministic hedge math (event hedges, downside ladders, payoff curves)
lib/venues/             VenueAdapter interface + gemini/ (client, normalizer, adapter)
lib/ai/types.ts         AIProvider interface (Grok implementation: next step)
lib/chain/              on-chain / live price data (Hyperliquid)
app/api/markets         GET live markets from the venue
app/api/hedge/crypto    GET preview of a BTC/ETH downside hedge (no orders placed)
fixtures/gemini/        real Gemini API responses for tests
```

## Run

```bash
cp .env.example .env.local   # add sandbox keys to trade; market data needs no key
npm run dev
npm test
```

Try: `/api/hedge/crypto?asset=BTC&quantity=1.5&startDrop=0.05&floorDrop=0.3`
