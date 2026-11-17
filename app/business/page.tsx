import { Suspense } from "react";
import { BUSINESS_EXAMPLES } from "@/lib/business/examples";
import { gameDayExample } from "@/lib/landing/board";
import { getVenue } from "@/lib/venues";
import { BusinessFlow } from "./BusinessFlow";

export const metadata = { title: "Business · Hedgehog" };
export const revalidate = 300;

export default async function BusinessPage() {
  // Swap the static game-day example for the next real game so it's always current.
  const game = await gameDayExample(getVenue()).catch(() => null);
  const examples = BUSINESS_EXAMPLES.map((ex) => (game && ex.label === game.label ? game : ex));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Turn a surprise cost into a known one</h1>
      <p className="mt-2 text-text-2">
        Promos, fuel, weather, metal prices: tell Hedgehog what worries you, and it finds Gemini prediction markets that pay out when it happens.
      </p>
      <div className="mt-8">
        <Suspense>
          <BusinessFlow examples={examples} />
        </Suspense>
      </div>
    </main>
  );
}
