import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, TransactionInstruction, clusterApiUrl, sendAndConfirmTransaction } from "@solana/web3.js";

// Writes archive fingerprints to Solana with the Memo program: one small transaction
// per hour, paid by Hedgehog's archive wallet. Users never sign or pay anything.

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export type Cluster = "devnet" | "mainnet-beta";
export const cluster = (): Cluster => (process.env.SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet");
export const rpcUrl = () => process.env.SOLANA_RPC_URL ?? clusterApiUrl(cluster());
export const explorerTx = (sig: string, c: string = cluster()) =>
  `https://explorer.solana.com/tx/${sig}${c === "mainnet-beta" ? "" : `?cluster=${c}`}`;
export const explorerAddress = (addr: string, c: string = cluster()) =>
  `https://explorer.solana.com/address/${addr}${c === "mainnet-beta" ? "" : `?cluster=${c}`}`;

const DEV_KEY_PATH = path.join(process.cwd(), "data", "solana-archive-keypair.json");

/**
 * The archive wallet. SOLANA_ARCHIVE_SECRET (a JSON array of the 64 secret-key bytes)
 * in production; on devnet a key is created once under data/ (git-ignored).
 */
let keypair: Keypair | null = null;
export function archiveKeypair(): Keypair {
  if (keypair) return keypair;
  const env = process.env.SOLANA_ARCHIVE_SECRET;
  if (env) return (keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env))));
  if (cluster() !== "devnet") throw new Error("SOLANA_ARCHIVE_SECRET must be set to anchor on mainnet.");
  if (existsSync(DEV_KEY_PATH)) return (keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(DEV_KEY_PATH, "utf8")))));
  mkdirSync(path.dirname(DEV_KEY_PATH), { recursive: true });
  keypair = Keypair.generate();
  writeFileSync(DEV_KEY_PATH, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600 });
  console.log(`[archive] created devnet archive wallet ${keypair.publicKey.toBase58()} (data/solana-archive-keypair.json)`);
  return keypair;
}

let conn: Connection | null = null;
const connection = () => (conn ??= new Connection(rpcUrl(), "confirmed"));

export async function walletBalanceSol(): Promise<number> {
  return (await connection().getBalance(archiveKeypair().publicKey)) / LAMPORTS_PER_SOL;
}

/** Devnet only: ask the faucet for test SOL. Often rate-limited; faucet.solana.com is the fallback. */
export async function requestDevnetAirdrop(sol = 1): Promise<string> {
  if (cluster() !== "devnet") throw new Error("Airdrops only exist on devnet.");
  const c = connection();
  const sig = await c.requestAirdrop(archiveKeypair().publicKey, sol * LAMPORTS_PER_SOL);
  await c.confirmTransaction(sig, "confirmed");
  return sig;
}

/** Records one memo on-chain and returns the transaction signature. */
export async function writeMemo(memo: string): Promise<string> {
  const payer = archiveKeypair();
  const tx = new Transaction().add(
    new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }], data: Buffer.from(memo, "utf8") }),
  );
  return sendAndConfirmTransaction(connection(), tx, [payer], { commitment: "confirmed" });
}
