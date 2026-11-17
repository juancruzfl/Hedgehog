import { Suspense } from "react";
import { BusinessFlow } from "./BusinessFlow";

export const metadata = { title: "Business · Hedgehog" };

export default function BusinessPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Turn a surprise cost into a known one</h1>
      <p className="mt-2 text-text-2">
        Promos, fuel, weather, metal prices: tell Hedgehog what worries you, and it finds Gemini prediction markets that pay out when it happens.
      </p>
      <div className="mt-8">
        <Suspense>
          <BusinessFlow />
        </Suspense>
      </div>
    </main>
  );
}
