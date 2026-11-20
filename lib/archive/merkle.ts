// Fingerprints for the odds archive: a Merkle tree over one hour of readings.
//
// Only the root (32 bytes) goes on-chain, so Gemini's market data itself is never
// published; yet any single reading can later be proven to have been in that hour's
// archive, unchanged, with a short list of sibling hashes.
//
// Runs in Node and in the browser (Web Crypto), so visitors can verify proofs themselves.
//   leaf = SHA-256(0x00 || canonical JSON of the reading)
//   node = SHA-256(0x01 || left || right)      (an odd node is carried up unchanged)
// The 0x00 / 0x01 prefixes keep a leaf from ever being mistaken for an inner node.

export interface ArchiveReading {
  ts: number; // unix ms
  symbol: string;
  marketId: string;
  yesBid: number | null;
  yesAsk: number | null;
  last: number | null;
}

export interface ProofStep {
  sibling: string; // hex
  side: "left" | "right"; // where the sibling sits
}

/** The exact bytes a reading is fingerprinted as. Field order is fixed; never change it within v1. */
export const canonical = (r: ArchiveReading) => JSON.stringify([r.ts, r.symbol, r.marketId, r.yesBid, r.yesAsk, r.last]);

/** Readings in the order they are fingerprinted: by time, then contract symbol. */
export const sortReadings = <T extends ArchiveReading>(rows: T[]) =>
  [...rows].sort((a, b) => a.ts - b.ts || (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));

const enc = new TextEncoder();
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
  const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.length;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

const LEAF = Uint8Array.of(0);
const NODE = Uint8Array.of(1);

export const leafHash = async (r: ArchiveReading) => sha256(LEAF, enc.encode(canonical(r)));
const nodeHash = (l: Uint8Array, r: Uint8Array) => sha256(NODE, l, r);

/** Every level of the tree, leaves first. Empty input has no tree. */
export async function buildLevels(rows: ArchiveReading[]): Promise<Uint8Array[][]> {
  if (rows.length === 0) throw new Error("No readings to fingerprint");
  const levels: Uint8Array[][] = [await Promise.all(sortReadings(rows).map(leafHash))];
  while (levels.at(-1)!.length > 1) {
    const prev = levels.at(-1)!;
    const next: Promise<Uint8Array>[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(i + 1 < prev.length ? nodeHash(prev[i], prev[i + 1]) : Promise.resolve(prev[i]));
    levels.push(await Promise.all(next));
  }
  return levels;
}

export const rootOf = (levels: Uint8Array[][]) => toHex(levels.at(-1)![0]);

/** Sibling hashes from a leaf up to the root. */
export function proofFor(levels: Uint8Array[][], index: number): ProofStep[] {
  const steps: ProofStep[] = [];
  for (let lvl = 0; lvl < levels.length - 1; lvl++) {
    const nodes = levels[lvl];
    const isRight = index % 2 === 1;
    const sib = isRight ? index - 1 : index + 1;
    if (sib < nodes.length) steps.push({ sibling: toHex(nodes[sib]), side: isRight ? "left" : "right" });
    index = Math.floor(index / 2);
  }
  return steps;
}

/** Recompute the root from one reading and its proof. */
export async function rootFromProof(r: ArchiveReading, proof: ProofStep[]): Promise<string> {
  let h = await leafHash(r);
  for (const s of proof) h = s.side === "left" ? await nodeHash(fromHex(s.sibling), h) : await nodeHash(h, fromHex(s.sibling));
  return toHex(h);
}

/** The memo written on-chain for one archived hour. */
export const memoFor = (hourStart: number, count: number, root: string) =>
  `hedgehog-odds v1 ${new Date(hourStart).toISOString()} n=${count} root=${root}`;

/** Reads a memo back; null if it isn't a Hedgehog archive memo. */
export function parseMemo(memo: string): { hourStart: number; count: number; root: string } | null {
  const m = memo.match(/hedgehog-odds v1 (\S+) n=(\d+) root=([0-9a-f]{64})/);
  return m ? { hourStart: Date.parse(m[1]), count: Number(m[2]), root: m[3] } : null;
}

/** SHA-256 of a UTF-8 string, as hex. Runs in Node and the browser. */
export const sha256Hex = async (text: string) => toHex(await sha256(enc.encode(text)));

/**
 * The memo written on-chain for one hedge receipt: the hedge's id and the SHA-256 of the
 * exact receipt document. The document itself stays with Hedgehog (it names the business's
 * promo); anyone holding it can check it against this memo.
 */
export const hedgeMemoFor = (hedgeId: string, sha: string) => `hedgehog-hedge v1 id=${hedgeId} sha256=${sha}`;

export function parseHedgeMemo(memo: string): { hedgeId: string; sha256: string } | null {
  const m = memo.match(/hedgehog-hedge v1 id=(\S+) sha256=([0-9a-f]{64})/);
  return m ? { hedgeId: m[1], sha256: m[2] } : null;
}

/** The memo for a game's kickoff seal: a fingerprint of its markets' last readings before play began. */
export const kickoffMemoFor = (ticker: string, startTime: number, readingTs: number, count: number, root: string) =>
  `hedgehog-kickoff v1 ${ticker} start=${new Date(startTime).toISOString()} at=${new Date(readingTs).toISOString()} n=${count} root=${root}`;

export function parseKickoffMemo(memo: string): { ticker: string; startTime: number; readingTs: number; count: number; root: string } | null {
  const m = memo.match(/hedgehog-kickoff v1 (\S+) start=(\S+) at=(\S+) n=(\d+) root=([0-9a-f]{64})/);
  return m ? { ticker: m[1], startTime: Date.parse(m[2]), readingTs: Date.parse(m[3]), count: Number(m[4]), root: m[5] } : null;
}
