// Line icons for the kinds of people and businesses a market can help (24×24, stroke = currentColor).
// Matched on the use's "who" label; anything unknown gets a generic storefront.

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS: Record<string, React.ReactNode> = {
  // Pint glass with foam
  bar: (
    <>
      <path d="M6 7h10l-1.2 12.2a1 1 0 0 1-1 .8H8.2a1 1 0 0 1-1-.8Z" />
      <path d="M16 10h1.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1.9" />
      <path d="M6 7c0-1.7 1.3-3 3-3 .8-.9 2.6-.9 3.5 0 1.9-.3 3.5 1 3.5 3" />
    </>
  ),
  // Pizza slice
  pizza: (
    <>
      <path d="M4 6.5c5-2.6 11-2.6 16 0L12 21Z" />
      <path d="M5.7 9.4c4-1.8 8.6-1.8 12.6 0" />
      <circle cx="10" cy="12.5" r="1" />
      <circle cx="14" cy="14.5" r="1" />
    </>
  ),
  // Car, side view
  car: (
    <>
      <path d="M3 16v-3.2l2.2-4.4A2 2 0 0 1 7 7.3h8.6a2 2 0 0 1 1.6.8L20 12l1 1v3h-2" />
      <path d="M3 16h2m4 0h6" />
      <circle cx="7" cy="16.5" r="1.8" />
      <circle cx="17" cy="16.5" r="1.8" />
      <path d="M6 12h14" />
    </>
  ),
  // Jersey
  jersey: (
    <>
      <path d="M9 3.5 4 6l1.5 5L7 10.5V20h10v-9.5l1.5.5L20 6l-5-2.5c-.5 1.4-1.6 2.2-3 2.2s-2.5-.8-3-2.2Z" />
      <path d="M12 11v5" />
    </>
  ),
  // Delivery van
  van: (
    <>
      <path d="M2.5 16V7.5a1 1 0 0 1 1-1H14v9.5" />
      <path d="M14 9.5h3.6l3 3.5v3h-1.6" />
      <path d="M2.5 16h2.2m4.6 0H15" />
      <circle cx="7" cy="16.5" r="1.8" />
      <circle cx="17" cy="16.5" r="1.8" />
    </>
  ),
  // Food truck with awning and serving window
  truck: (
    <>
      <path d="M2.5 17V8.5a1 1 0 0 1 1-1H15V17" />
      <path d="M15 10.5h3l3 3V17h-1.5" />
      <path d="M2.5 17h2m5 0h5.5" />
      <path d="M5 10h7v3H5Z" />
      <circle cx="7" cy="17.5" r="1.6" />
      <circle cx="17.5" cy="17.5" r="1.6" />
    </>
  ),
  // Leaf
  leaf: (
    <>
      <path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" />
      <path d="M5 19c3.5-4.5 6.5-7 10-9" />
    </>
  ),
  // Airplane
  plane: <path d="M10.5 20.5 12 15.5l-6.5 1.5L4 15.5l7-4V5.5a1.5 1.5 0 0 1 3 0v6l7 4-1.5 1.5-6.5-1.5 1.5 5Z" />,
  // Gem
  gem: (
    <>
      <path d="M7 4h10l4 5-9 11L3 9Z" />
      <path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" />
    </>
  ),
  // Tooth
  tooth: <path d="M7.5 4c1.6 0 2.8.8 4.5.8S14.9 4 16.5 4C19 4 20 6.2 20 8.5c0 2.2-1 3.6-1.5 5.5-.6 2.4-.8 6-2.5 6-1.6 0-1.5-4.5-4-4.5S9.6 20 8 20c-1.7 0-1.9-3.6-2.5-6C5 12.1 4 10.7 4 8.5 4 6.2 5 4 7.5 4Z" />,
  // Price tag
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.6 6.6a1.4 1.4 0 0 1-2 0Z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  // Shopping bag
  bag: (
    <>
      <path d="M5 8h14l-1 12H6Z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  // Laptop
  laptop: (
    <>
      <path d="M5 6.5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1V15H5Z" />
      <path d="M3 18.5h18L19 15H5Z" />
    </>
  ),
  // Wallet
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3" />
      <path d="M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5Z" />
      <circle cx="16" cy="13.5" r="1.2" />
    </>
  ),
  // Bank / treasury building
  bank: (
    <>
      <path d="M3.5 9 12 4l8.5 5Z" />
      <path d="M5.5 9.5v7M10 9.5v7M14 9.5v7M18.5 9.5v7" />
      <path d="M3.5 19.5h17" />
    </>
  ),
  // Storefront (fallback)
  store: (
    <>
      <path d="M4 9.5 5.5 4.5h13L20 9.5" />
      <path d="M4 9.5h16" />
      <path d="M5.5 12v7.5h13V12M10 19.5v-4h4v4" />
    </>
  ),
};

const BY_WHO: [RegExp, keyof typeof ICONS][] = [
  [/sports bar|bar\b/i, "bar"],
  [/pizza/i, "pizza"],
  [/car dealer/i, "car"],
  [/fan store/i, "jersey"],
  [/delivery/i, "van"],
  [/food truck/i, "truck"],
  [/landscap/i, "leaf"],
  [/airline|charter/i, "plane"],
  [/jewel/i, "gem"],
  [/dental/i, "tooth"],
  [/pawn|resale/i, "tag"],
  [/online shop/i, "bag"],
  [/freelance/i, "laptop"],
  [/treasury/i, "bank"],
  [/holder/i, "wallet"],
];

export function BusinessIcon({ who, className = "h-5 w-5" }: { who: string; className?: string }) {
  const key = BY_WHO.find(([re]) => re.test(who))?.[1] ?? "store";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...P}>
      {ICONS[key]}
    </svg>
  );
}
