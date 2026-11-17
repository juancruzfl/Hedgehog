// Runs once when the Next.js server starts. On the hosted deploy (one Railway service
// with one volume) the odds collector runs in-process so it shares the SQLite volume.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.ENABLE_COLLECTOR !== "1") return;
  const { startCollector } = await import("./lib/odds/collect");
  startCollector();
  console.log("[collect] in-process odds collector started");
}
