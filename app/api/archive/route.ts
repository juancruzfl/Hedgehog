import { NextResponse } from "next/server";
import { archiveKeypair, cluster, explorerAddress, explorerTx } from "@/lib/archive/solana";
import { archiveTotals, listBatches, sampleReadings } from "@/lib/archive/store";
import { listKickoffSeals } from "@/lib/archive/kickoff-store";

// GET: the archive at a glance: totals, every sealed hour with its Solana transaction,
// and a few readings people can verify. Raw odds are not listed here (Gemini's market
// data terms); only fingerprints, and single readings inside a proof.
export async function GET() {
  try {
    const batches = listBatches();
    const latestSealed = batches.find((b) => b.signature);
    const wallet = archiveKeypair().publicKey.toBase58();
    return NextResponse.json(
      {
        cluster: cluster(),
        wallet,
        walletUrl: explorerAddress(wallet),
        totals: { ...archiveTotals(), hoursSealed: batches.filter((b) => b.signature).length },
        batches: batches.map((b) => ({ ...b, txUrl: b.signature ? explorerTx(b.signature, b.cluster) : null })),
        samples: latestSealed ? sampleReadings(latestSealed.hourStart) : [],
        kickoffs: listKickoffSeals(12).map((k) => ({ ...k, txUrl: k.signature ? explorerTx(k.signature, k.cluster) : null })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
