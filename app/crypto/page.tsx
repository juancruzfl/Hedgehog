import { Suspense } from "react";
import { CryptoFlow } from "./CryptoFlow";

export const metadata = { title: "Crypto · Hedgehog" };

export default function CryptoPage() {
  return (
    <main className="mx-auto max-w-4xl snap-start px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">How likely is your crypto to drop?</h1>
      <p className="mt-2 max-w-2xl text-text-2">
        See the market&apos;s odds of your crypto dropping, and cushion a fall if you want. Nothing happens without your OK.
      </p>
      <div className="mt-8">
        <Suspense>
          <CryptoFlow />
        </Suspense>
      </div>
    </main>
  );
}
