# Demo script (about 3 minutes)

**Before you start**
- Run `npm run demo:check` and fix anything marked ✗.
- `npm run collect` has been running (odds history), and `npm run dev` is up.
- `.env.local` has working AI credits and `AI_MODEL` set (`npm run ai:check` returns a parse). If the AI is down, the business page falls back to its basic matcher for the game-day and fuel examples and says so.
- The **Game-day promo** example automatically uses the next upcoming NFL game. Check that it names a game that hasn't kicked off.
- Approve one or two small paper hedges on short-dated markets a day ahead, so **My hedges** has settled results to show.
- Clear the browser's site data so the crypto page starts empty. Have a Solana address ready to paste.

---

**0:00 · Landing (30s)**
> "Prediction markets price real-world events every minute. Hedgehog turns them into hedges for normal people. Are the odds in your favor?"

Let the stage rotate once. Hover a risk widget (it pauses and comes forward):
> "This live Gemini market pays $1 if oil rises above $93. To a delivery fleet, that's a way to turn a fuel spike into a known cost. Same market: food truck, landscaper, charter airline."

**0:30 · Business (75s)**
Click **Reduce a business risk** → **Try: Game-day promo** → **Find a market**.
> "A bar owner types this in plain English."

- Step 2: "Hedgehog understood it: the trigger, the date, a $3,000 cost. Editable."
- Step 3: "It found the live Gemini market on that exact game, labeled it an exact match, and read the fine print: overtime counts."
- Step 4: "Pay $480 now. If they win, the market pays $3,000. Either way the promo costs $480. An uncertain $3,000 hit is now a known $480 cost."

Click **Review & approve** → tick → **Approve**.
> "Nothing happens without approval, and the server re-checks the live price before placing."

**1:45 · Crypto (55s)**
Go to **Crypto** → **Or import from: Solana wallet** → paste → **Read wallet**.
> "Read-only. No seed phrase, nothing to sign."

- "7% chance SOL drops below $65 by Thursday, about 1 in 14. Here's how those odds moved over the last few days." (open the chart)
- **Soften a drop** → **Balanced**: "Pay $12 now. Here's what happens if SOL ends 10, 20 or 30% lower, with and without Hedgehog." Switch to **Strong** to show the price change.

**2:40 · My hedges (20s)**
> "Hedges settle from Gemini's own resolution." Point at a settled one: "Paid out $400, net +$280."

Close:
> "Gemini prediction markets for everyday risk, built on Gemini's API and Solana, with crypto that stays invisible."
