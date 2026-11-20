// Hedgehog logo: a chubby, round hedgehog seen side-on (facing right), drawn as a line icon
// with a row of spikes along its back, a pointed snout with a round nose, an eye and two
// little feet. Drawn on a 64x64 grid. Color comes from `currentColor` (the nav uses the text color).

export const HEDGEHOG_PATH =
  "M9.46 40.85 L2.30 37.94 L9.18 34.56 L3.54 29.71 L11.31 28.56 L7.84 22.33 L15.60 23.53 L14.70 16.64 L21.55 20.06 L23.33 13.30 L28.48 18.55 L32.73 12.70 L35.59 19.17 L41.81 14.91 L42.05 21.85 C46.05 23.35 53 33 57.5 39 C59 41 57.5 43.5 54.5 43.5 C52 43.5 51.5 46 50 49 C46 55.5 38 57 30 57 C19 57 8.96 50 9.46 40.85 Z";

export function Logo({ className = "", strokeWidth = 3.4 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <path d={HEDGEHOG_PATH} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {/* feet */}
      <path d="M23 57v3.5M38 57v3.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="47" cy="37" r="2.4" fill="currentColor" />
      <circle cx="57.6" cy="39.4" r="2.6" fill="currentColor" />
    </svg>
  );
}
