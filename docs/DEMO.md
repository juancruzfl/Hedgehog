# Demo script (about 3 minutes)

**Before you start**
- Remove `AI_MODE=off` from `.env.local` (it's there for cheap UI testing) and restart the server.
- Run `npm run demo:check` and fix anything marked ✗.
- `npm run collect` has been running (odds history), and `npm run dev` is up.
- `.env.local` has working AI credits and `AI_MODEL` set (`npm run ai:check` returns a parse). If the AI is down, the business page falls back to its basic matcher for the game-day and fuel examples and says so.
- The **Game-day promo** example automatically uses the next upcoming NFL game. Check that it names a game that hasn't kicked off.
- Run the game-day example once a few hours early, so the game's odds are being recorded and its card has history to flip to.
- Approve one or two small paper hedges on short-dated markets a day ahead, so **My hedges** has settled results to show.
- Clear the browser's site data so the crypto page starts empty. Have a Solana address ready to paste.

---

**0:00 · Landing (30s)**
> "Prediction markets price real-world events every minute. Hedgehog lets anyone hedge a real-world risk in under 10 clicks, without knowing what a prediction market is. Are the odds in your favor?"

Hover a risk widget (it comes forward):
> "This live Gemini market pays $1 if oil rises above $93. To a delivery fleet, that's a way to turn a fuel spike into a known cost. Same market: food truck, landscaper, charter airline."

**0:30 · Business (75s)**
Click **Reduce a business risk** → **Try: Game-day promo** → press **Enter**.
> "A bar owner types this in plain English. That's the whole interface."

The steps take over the screen one at a time:
- "Hedgehog understood it: the trigger, the date, a $3,000 cost."
- "It found the live Gemini market on that exact game, labeled it an exact match, and read the fine print: overtime counts."
- "Pay $480 now. If they win, the market pays $3,000. Either way the promo costs $480. An uncertain $3,000 hit is now a known $480 cost."

Flip the card (**See how these odds have moved**): "Hedgehog records the odds itself; Gemini's API doesn't give history." Flip back.

Click **Use this option** (the popup opens) → **Review & approve** → tick → **Approve**.
> "Five actions. Nothing happens without approval, and the server re-checks the live price before placing."

**1:45 · Crypto (55s)**
Go to **Crypto**. The **What do you hold?** popup opens → **Connect wallet** → paste the address.
> "Read-only. No seed phrase, nothing to sign."

- Scroll: each coin swaps in place and the title follows: "How likely is your SOL to drop?"
- "5% chance SOL drops below $67 by Thursday, about 1 in 20." Flip the card to show how the odds moved.
- **Soften a drop in my SOL** → **Balanced**: "Pay $12 now. Here's what happens if SOL ends 10, 20 or 30% lower, with and without Hedgehog." Switch to **Strong** to show the price change.

**2:40 · My hedges (20s)**
> "Hedges settle from Gemini's own resolution." Point at a settled one: "Paid out $400, net +$280."

Close:
> "You could wire an AI agent to Gemini's MCP server and get part of the way, if you're a developer. Hedgehog is for everyone else: Gemini prediction markets for everyday risk, built on Gemini's API and Solana, with crypto that stays invisible."

**If a judge asks "why not just an AI agent with Gemini's MCP server?"**
> "That works for developers. Hedgehog speaks the user's language, not the market's. The money math is tested code, not the model. Every order is approved and re-checked. Matches are labeled honestly. And it has data an agent doesn't: odds history and your real exposure. The AI is one step; the app works with it switched off."
