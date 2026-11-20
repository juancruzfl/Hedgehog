import { NextResponse } from "next/server";
import { explorerTx } from "@/lib/archive/solana";
import { getKickoffForMarkets } from "@/lib/archive/kickoff-store";
import { getReceipt } from "@/lib/hedges/store";
import type { ReceiptDocument } from "@/lib/hedges/receipt";

// GET: a hedge receipt, byte-for-byte as it was fingerprinted, plus where its fingerprint
// sits on Solana. The browser hashes `document` itself and checks it against the chain.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = getReceipt(id);
  if (!r) return NextResponse.json({ error: "No receipt for that hedge." }, { status: 404 });
  const doc = JSON.parse(r.document) as ReceiptDocument;
  return NextResponse.json({
    hedgeId: r.hedgeId,
    document: r.document,
    sha256: r.sha256,
    cluster: r.cluster,
    signature: r.signature,
    sealedAt: r.sealedAt,
    error: r.signature ? null : r.error,
    archiveOn: process.env.ARCHIVE_ANCHOR === "1",
    txUrl: r.signature ? explorerTx(r.signature, r.cluster ?? undefined) : null,
    // Games among the hedged markets whose pre-kickoff odds were sealed too.
    kickoffs: getKickoffForMarkets([...new Set(doc.orders.map((o) => o.marketId))]).map((k) => ({
      ...k,
      txUrl: k.signature ? explorerTx(k.signature, k.cluster) : null,
    })),
  });
}
