// Hedgehog logo: a chubby, round hedgehog sitting up and facing forward, drawn as a line
// icon. Its spiky coat domes over the head, puffs out at the cheeks and belly and rounds
// into a broad seat; two little arms hang in front with clawed paws, and two feet poke out
// at the bottom. Drawn on a 64x64 grid (scaled slightly so the side spikes stay inside).
// Color comes from `currentColor` (the nav uses the text color); the feet are filled with
// the page color so they sit in front of the body.

export const HEDGEHOG_PATH =
  "M13.96 55.95 L9.07 56.46 L9.06 51.54 L4.23 50.37 L6.01 45.71 L1.31 42.57 L5.67 39.15 L2.17 34.93 L7.14 32.70 L3.85 29.10 L9.27 26.50 L8.58 20.98 L13.96 21.85 L11.78 18.53 L16.04 15.84 L14.89 10.97 L19.86 10.50 L20.81 5.61 L25.51 7.14 L28.09 2.94 L32.00 6.00 L35.91 2.94 L38.49 7.14 L43.19 5.61 L44.14 10.50 L49.11 10.97 L47.96 15.84 L52.22 18.53 L50.04 21.85 L55.42 20.98 L54.73 26.50 L60.15 29.10 L56.86 32.70 L61.83 34.93 L58.33 39.15 L62.69 42.57 L57.99 45.71 L59.77 50.37 L54.94 51.54 L54.93 56.46 L50.04 55.95 C48.04 60.00 39 60.50 32 60.50 C25 60.50 15.96 60.00 13.96 55.95 Z";

const ARMS = "M20.6 33.2c-1.5 3.2-1.2 6.6.9 9.6M43.4 33.2c1.5 3.2 1.2 6.6-.9 9.6M20.6 42.4c-.2 1.8.4 3.3 1.6 4.3M23 42.8c.1 1.7.8 3.1 1.9 3.9M43.4 42.4c.2 1.8-.4 3.3-1.6 4.3M41 42.8c-.1 1.7-.8 3.1-1.9 3.9";

export function Logo({ className = "", strokeWidth = 3.2 }: { className?: string; strokeWidth?: number }) {
  const thin = strokeWidth * 0.7;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <g transform="translate(32 32) scale(0.93) translate(-32 -32.5)">
        <path d={HEDGEHOG_PATH} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
        {/* eyes and nose */}
        <circle cx="26" cy="21" r="2.5" fill="currentColor" />
        <circle cx="38" cy="21" r="2.5" fill="currentColor" />
        <ellipse cx="32" cy="27.8" rx="3.2" ry="2.6" fill="currentColor" />
        {/* arms hanging in front, with clawed paws */}
        <path d={ARMS} stroke="currentColor" strokeWidth={thin} strokeLinecap="round" />
        {/* feet */}
        <ellipse cx="24" cy="60.6" rx="5" ry="2.5" transform="rotate(-8 24 60.6)" fill="var(--background, #fff)" stroke="currentColor" strokeWidth={thin} />
        <ellipse cx="40" cy="60.6" rx="5" ry="2.5" transform="rotate(8 40 60.6)" fill="var(--background, #fff)" stroke="currentColor" strokeWidth={thin} />
      </g>
    </svg>
  );
}
