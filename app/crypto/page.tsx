import { Suspense } from "react";
import { CryptoFlow } from "./CryptoFlow";

export const metadata = { title: "Crypto · Hedgehog" };

export default function CryptoPage() {
  // The title lives inside CryptoFlow so it can stay pinned with the market card.
  return (
    <main className="mx-auto max-w-6xl px-4 pb-10">
      <Suspense>
        <CryptoFlow />
      </Suspense>
    </main>
  );
}
