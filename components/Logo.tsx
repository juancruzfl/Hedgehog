// Hedgehog logo: a teal outline (transparent inside), turned 45° clockwise.
// Drawn on a 64x64 grid; the path is generated from an oval body with evenly
// spaced spikes, a pointed snout and two small feet.

export const HEDGEHOG_PATH =
  "M10.19 39.02 L2.8 37.28 L10.12 35.38 L3.56 32.36 L11.3 31.85 L5.98 27.74 L13.66 28.64 L9.91 23.7 L17.04 25.96 L15.11 20.5 L21.23 23.97 L21.23 18.33 L25.98 22.8 L27.91 17.34 L30.98 22.52 L34.72 17.58 L35.91 23.15 L41.24 19.04 L40.48 24.65 L47.04 21.63 L44.39 26.93 C50.39 25.43 54.39 29.93 60.5 35.43 C61.8 36.53 61.2 38.33 59.4 38.23 C55 37.93 51.5 39.43 48.5 46 L43.5 48.5 C43.5 51.5 39 51.5 39 49 L24 49.5 C24 52 19.5 52 19.5 49.3 C14.5 48 9.69 44 10.19 39.02 Z";

export function Logo({ className = "", strokeWidth = 3.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="-2 -2 68 68" className={className} aria-hidden fill="none">
      <g transform="rotate(45 32 32)">
        <path d={HEDGEHOG_PATH} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="48.59" cy="33.23" r="2" fill="currentColor" />
        <circle cx="60.1" cy="36.83" r="1.6" fill="currentColor" />
      </g>
    </svg>
  );
}
