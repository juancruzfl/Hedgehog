// Seals finished hours of odds readings into the on-chain archive (Solana fingerprints).
// Run:  npm run archive:anchor              (anchor every finished, unanchored hour)
//       npm run archive:anchor -- --airdrop (devnet: first ask the faucet for 1 test SOL)
//       npm run archive:anchor -- --wallet  (show the archive wallet and its balance)
// Env:  SOLANA_CLUSTER (devnet | mainnet-beta), SOLANA_RPC_URL, SOLANA_ARCHIVE_SECRET

import { anchorPending } from "../lib/archive/anchor";
import { archiveKeypair, cluster, explorerAddress, requestDevnetAirdrop, walletBalanceSol } from "../lib/archive/solana";

async function main() {
  const addr = archiveKeypair().publicKey.toBase58();
  console.log(`Archive wallet (${cluster()}): ${addr}\n  ${explorerAddress(addr)}`);
  if (process.argv.includes("--airdrop")) {
    try {
      console.log("Airdrop:", await requestDevnetAirdrop(1));
    } catch (e) {
      console.error(`Airdrop failed (${(e as Error).message}). Get test SOL at https://faucet.solana.com for ${addr}`);
    }
  }
  console.log(`Balance: ${(await walletBalanceSol()).toFixed(4)} SOL`);
  if (process.argv.includes("--wallet")) return;
  const n = await anchorPending(500);
  console.log(`Recorded ${n} hour(s) on Solana.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
