// Hedgehog logo: a chubby hedgehog facing forward, drawn as a line icon. Spikes crown its
// head and run down both sides, with a round belly, two little feet, eyes, a nose and a
// small smile. Drawn on a 64x64 grid. Color comes from `currentColor` (the nav uses the text color).

export const HEDGEHOG_PATH =
  "M11.14 42.68 L3.82 39.32 L9.53 33.97 L4.44 28.12 L12.09 25.45 L10.18 18.19 L18.35 18.70 L19.97 11.38 L27.15 14.98 L32.00 8.96 L36.85 14.98 L44.03 11.38 L45.65 18.70 L53.82 18.19 L51.91 25.45 L59.56 28.12 L54.47 33.97 L60.18 39.32 L52.86 42.68 C54.36 51.68 46 57 32 57 C18 57 9.64 51.68 11.14 42.68 Z";

export function Logo({ className = "", strokeWidth = 3.4 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <path d={HEDGEHOG_PATH} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {/* feet */}
      <path d="M25 57v3.6M39 57v3.6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      {/* eyes, nose, smile */}
      <circle cx="25.5" cy="36" r="2.5" fill="currentColor" />
      <circle cx="38.5" cy="36" r="2.5" fill="currentColor" />
      <ellipse cx="32" cy="42.3" rx="3" ry="2.3" fill="currentColor" />
      <path d="M29.2 47c1.7 1.3 3.9 1.3 5.6 0" stroke="currentColor" strokeWidth={strokeWidth * 0.7} strokeLinecap="round" />
    </svg>
  );
}
