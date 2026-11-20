import { Suspense } from "react";
import { RolePicker } from "./RolePicker";

export const metadata = { title: "What do you hedge? · Hedgehog" };

export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:pt-16">
      <Suspense>
        <RolePicker />
      </Suspense>
    </main>
  );
}
