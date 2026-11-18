import { Suspense } from "react";
import { swr } from "@/lib/cache";
import { BUSINESS_EXAMPLES } from "@/lib/business/examples";
import { gameDayExample } from "@/lib/landing/board";
import { getVenue } from "@/lib/venues";
import { BusinessFlow } from "./BusinessFlow";

export const metadata = { title: "Business · Hedgehog" };
export const revalidate = 300;

export default async function BusinessPage() {
  // Swap the static game-day example for the next real game so it's always current.
  const game = await swr("game-day-example", 5 * 60_000, () => gameDayExample(getVenue())).catch(() => null);
  const examples = BUSINESS_EXAMPLES.map((ex) => (game && ex.label === game.label ? game : ex));

  return (
    // The title lives inside BusinessFlow: once a risk is analyzed, it becomes the title.
    <main className="mx-auto max-w-6xl px-4 pb-10">
      <Suspense>
        <BusinessFlow examples={examples} />
      </Suspense>
    </main>
  );
}
