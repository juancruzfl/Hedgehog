// Records Gemini prediction-market odds every few minutes for odds-over-time charts.
// Run:  npm run collect            (loops forever)
//       npm run collect -- --once  (single snapshot)
// Env:  ODDS_INTERVAL_MIN (default 5), ODDS_CATEGORIES (default "Crypto,Commodities,Weather")

import { snapshot, startCollector } from "../lib/odds/collect";

if (process.argv.includes("--once")) {
  snapshot().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  startCollector();
  // Keep the process alive; the collector's interval is unref'd so servers can exit cleanly.
  setInterval(() => {}, 1 << 30);
}
