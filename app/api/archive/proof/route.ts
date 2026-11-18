import { NextResponse, type NextRequest } from "next/server";
import { buildLevels, proofFor, rootOf, sortReadings } from "@/lib/archive/merkle";
import { explorerTx } from "@/lib/archive/solana";
import { HOUR, getBatch, readingsForHour } from "@/lib/archive/store";

// GET ?symbol=…&ts=… → one archived reading plus the hashes that link it to the
// fingerprint recorded on Solana for its hour. The browser checks the rest itself.

// Building an hour's tree takes up to a second; keep the last few in memory.
const cache = new Map<number, Awaited<ReturnType<typeof buildLevels>>>();

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const ts = Number(req.nextUrl.searchParams.get("ts"));
  if (!symbol || !Number.isFinite(ts)) return NextResponse.json({ error: "symbol and ts are required" }, { status: 400 });

  const hourStart = Math.floor(ts / HOUR) * HOUR;
  const batch = getBatch(hourStart);
  if (!batch?.signature) return NextResponse.json({ error: "That hour hasn't been sealed on Solana yet." }, { status: 404 });

  const rows = sortReadings(readingsForHour(hourStart));
  const index = rows.findIndex((r) => r.symbol === symbol && r.ts === ts);
  if (index < 0) return NextResponse.json({ error: "No such reading in the archive." }, { status: 404 });

  let levels = cache.get(hourStart);
  if (!levels) {
    levels = await buildLevels(rows);
    cache.set(hourStart, levels);
    if (cache.size > 6) cache.delete(cache.keys().next().value!);
  }
  const root = rootOf(levels);
  // Should never differ; if it does, the archive changed after sealing and the page must say so.
  return NextResponse.json({
    reading: rows[index],
    proof: proofFor(levels, index),
    serverRoot: root,
    sealedRoot: batch.root,
    hourStart,
    count: batch.count,
    signature: batch.signature,
    cluster: batch.cluster,
    txUrl: explorerTx(batch.signature, batch.cluster),
  });
}
