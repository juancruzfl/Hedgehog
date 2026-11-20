// Runs once when the Next.js server starts.
// 1. Warms the landing-page, game-day and trending-markets caches so even the first visitor doesn't wait.
// 2. On the hosted deploy (one Railway service with one volume) runs the odds collector
//    in-process so it shares the SQLite volume.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  void (async () => {
    try {
      const [{ swr }, { buildBoard, gameDayExample }, { getVenue }, { trendingMarkets }] = await Promise.all([
        import("./lib/cache"),
        import("./lib/landing/board"),
        import("./lib/venues"),
        import("./lib/markets/trending"),
      ]);
      await Promise.all([
        swr("landing-board", 60_000, () => buildBoard(getVenue())),
        swr("game-day-example", 5 * 60_000, () => gameDayExample(getVenue())),
        trendingMarkets(),
      ]);
      console.log("[cache] landing page, game-day example and trending markets warmed");
    } catch (e) {
      console.error("[cache] warm-up failed:", (e as Error).message);
    }
  })();

  if (process.env.ENABLE_COLLECTOR !== "1") return;
  const { startCollector } = await import("./lib/odds/collect");
  startCollector();
  console.log("[collect] in-process odds collector started");
}
