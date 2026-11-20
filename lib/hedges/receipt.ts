import { createHash } from "node:crypto";
import type { ArchiveReading } from "@/lib/archive/merkle";
import type { HedgeOrder } from "./store";

// A hedge receipt: one JSON document saying what was hedged, at what price and against
// which odds, fingerprinted with SHA-256 and recorded on Solana right after approval. It
// lets a business show it hedged at those odds, at that time (e.g. before kickoff).
//
// The document is stored and served byte-for-byte; the verifier hashes exactly what it
// receives, so no canonical re-serialization is needed. The promo terms are included only
// as a hash, so the document can be shared without spelling out the business's numbers.

export interface ReceiptDocument {
  type: "hedgehog-hedge-receipt";
  v: 1;
  hedgeId: string;
  approvedAt: string; // ISO
  mode: "paper" | "live";
  venue: string;
  segment: string;
  title: string;
  /** SHA-256 of the risk profile (the promo/terms as Hedgehog understood them). */
  termsSha256: string;
  orders: Pick<HedgeOrder, "marketId" | "symbol" | "outcome" | "quantity" | "limitPrice" | "fillPrice" | "orderId" | "status">[];
  totalCost: number;
  maxPayout: number;
  /** The live quotes the hedge was checked against; each is also in that hour's sealed odds archive. */
  oddsSeen: ArchiveReading[];
}

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export function buildReceipt(r: Omit<ReceiptDocument, "type" | "v" | "termsSha256"> & { profileJson: string }): { document: string; sha256: string } {
  const { profileJson, ...rest } = r;
  // Fixed key order, so receipts read the same way every time.
  const doc: ReceiptDocument = {
    type: "hedgehog-hedge-receipt",
    v: 1,
    hedgeId: rest.hedgeId,
    approvedAt: rest.approvedAt,
    mode: rest.mode,
    venue: rest.venue,
    segment: rest.segment,
    title: rest.title,
    termsSha256: sha256(profileJson),
    orders: rest.orders.map((o) => ({
      marketId: o.marketId,
      symbol: o.symbol,
      outcome: o.outcome,
      quantity: o.quantity,
      limitPrice: o.limitPrice,
      fillPrice: o.fillPrice,
      orderId: o.orderId,
      status: o.status,
    })),
    totalCost: rest.totalCost,
    maxPayout: rest.maxPayout,
    oddsSeen: rest.oddsSeen.map((x) => ({ ts: x.ts, symbol: x.symbol, marketId: x.marketId, yesBid: x.yesBid, yesAsk: x.yesAsk, last: x.last })),
  };
  const document = JSON.stringify(doc, null, 2);
  return { document, sha256: sha256(document) };
}
