import Link from "next/link";

const doors = [
  {
    href: "/crypto",
    title: "I hold crypto",
    body: "Connect a wallet. Hedgehog reads your holdings and builds a downside hedge from Gemini price markets.",
  },
  {
    href: "/business",
    title: "I run a business",
    body: "Describe a promo or a cost you worry about. Hedgehog finds Gemini markets that offset it.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Hedgehog</h1>
      <p className="mt-3 text-lg text-text-2">
        Risk reduction powered by Gemini prediction markets. You approve every trade.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {doors.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="rounded-xl border border-border p-6 transition hover:border-accent bg-surface"
          >
            <h2 className="text-xl font-semibold">{d.title}</h2>
            <p className="mt-2 text-sm text-text-2">{d.body}</p>
          </Link>
        ))}
      </div>
      <p className="mt-10 text-xs text-text-3">
        Hedgehog is software, not an exchange or an advisor. Trades execute on Gemini in your own account.
        Hedges reduce, but do not eliminate, losses.
      </p>
    </main>
  );
}
