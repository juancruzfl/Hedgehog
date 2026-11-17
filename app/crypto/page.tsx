import { Suspense } from "react";
import { CryptoFlow } from "./CryptoFlow";

export const metadata = { title: "Crypto · Hedgehog" };

export default function CryptoPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Know your downside. Shrink it if you want.</h1>
      <p className="mt-2 text-text-2">
        Live odds from Gemini prediction markets show how likely your crypto is to fall, and what it costs to cushion the fall.
      </p>
      <div className="mt-8">
        <Suspense>
          <CryptoFlow />
        </Suspense>
      </div>
    </main>
  );
}
