import Link from "next/link";

// "And every price is checkable": the odds archive panel, in Solana's colors (near-black,
// purple → green gradient) with a few twinkling sparkles and a light sweep over the newest
// sealed hour. Motion stops for reduced-motion users (globals.css).

export interface SealedHour {
  label: string;
  readings: number;
  root: string;
}

const SOL_GRADIENT = "linear-gradient(90deg, #9945FF 0%, #19FB9B 100%)";

// Sparkle positions (% of the panel), sizes and colors; delays stagger the twinkle.
const SPARKLES = [
  { x: 1.5, y: 6, s: 16, c: "#19FB9B", d: "0s" },
  { x: 46, y: 7, s: 12, c: "#ffffff", d: "1.1s" },
  { x: 50, y: 86, s: 15, c: "#9945FF", d: "0.5s" },
  { x: 96, y: 6, s: 20, c: "#9945FF", d: "1.7s" },
  { x: 95, y: 84, s: 14, c: "#19FB9B", d: "0.8s" },
  { x: 26, y: 92, s: 10, c: "#ffffff", d: "2.2s" },
  { x: 59, y: 44, s: 11, c: "#19FB9B", d: "1.4s" },
  { x: 62, y: 18, s: 9, c: "#ffffff", d: "2.6s" },
];

function Sparkle({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z" fill={color} />
    </svg>
  );
}

function Receipts({ hours }: { hours: SealedHour[] }) {
  if (!hours.length) return <p className="text-sm text-white/70">The first hour is sealed shortly after recording starts.</p>;
  return (
    <ul className="relative mx-auto flex w-full max-w-[360px] flex-col gap-3">
      {hours.map((h, k) => (
        <li
          key={h.label}
          // Gradient border: a 1px gradient frame around a dark card.
          className="rounded-xl p-px"
          style={{ background: SOL_GRADIENT, opacity: 1 - k * 0.25, transform: `scale(${1 - k * 0.03})` }}
        >
          <div className="relative overflow-hidden rounded-[11px] bg-[#16121f] px-4 py-3">
            {k === 0 && <span className="hh-sweep pointer-events-none absolute inset-y-0 -left-1/3 w-1/3" aria-hidden />}
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="font-medium text-white">{h.label}</span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-[#0e0b16]" style={{ background: SOL_GRADIENT }}>
                ✓ Sealed on Solana
              </span>
            </div>
            <p className="mt-1 flex justify-between font-mono text-[11px] text-white/55">
              <span>{h.readings.toLocaleString("en-US")} readings</span>
              <span>{h.root}</span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SolanaPanel({ hours }: { hours: SealedHour[] }) {
  return (
    <div className="relative mt-14 overflow-hidden rounded-2xl bg-[#0e0b16] p-6 text-white sm:p-8">
      {/* Soft glows in the two Solana colors */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#9945FF] opacity-25 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[#19FB9B] opacity-20 blur-3xl" aria-hidden />
      {SPARKLES.map((p, k) => (
        <span key={k} className="hh-twinkle pointer-events-none absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: p.d }}>
          <Sparkle size={p.s} color={p.c} />
        </span>
      ))}

      <div className="relative grid items-center gap-8 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">And every price is checkable</p>
          <h3 className="mt-2 text-2xl font-medium tracking-[-0.02em]">
            Recorded every 5 minutes,{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: SOL_GRADIENT }}>
              sealed on Solana
            </span>{" "}
            every hour
          </h3>
          <p className="mt-2 text-white/70">
            Gemini shows today&apos;s odds but keeps no history. Hedgehog records it and puts a fingerprint of each hour on Solana, so anyone can check a price
            hasn&apos;t been changed since.
          </p>
          <Link href="/archive" className="group mt-4 inline-block text-sm font-medium text-[#19FB9B]">
            See the odds archive <span className="inline-block transition group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
        <Receipts hours={hours} />
      </div>
    </div>
  );
}
