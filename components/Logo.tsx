// Hedgehog logo: a front-facing hedgehog drawn as a black line icon (transparent inside),
// with a crown of spikes wrapping down to full, rounded cheeks, two eyes and a nose.
// Drawn on a 64x64 grid. Color comes from `currentColor` (the nav uses the text color).

export const HEDGEHOG_PATH =
  "M10.48 35.95 L4.75 33.12 L10.14 29.83 L5.75 25.58 L12.08 23.94 L9.48 18.7 L16.08 18.89 L15.55 13.21 L21.73 15.2 L23.32 9.66 L28.46 13.25 L32 8.44 L35.54 13.25 L40.68 9.66 L42.27 15.2 L48.45 13.21 L47.92 18.89 L54.52 18.7 L51.92 23.94 L58.25 25.58 L53.86 29.83 L59.25 33.12 L53.52 35.95 C60.52 44.95 44 54.95 32 58.45 C20 54.95 3.48 44.95 10.48 35.95 Z";

export function Logo({ className = "", strokeWidth = 3.4 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <path d={HEDGEHOG_PATH} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="24.5" cy="37.5" r="2.4" fill="currentColor" />
      <circle cx="39.5" cy="37.5" r="2.4" fill="currentColor" />
      <ellipse cx="32" cy="50" rx="3" ry="2.3" fill="currentColor" />
    </svg>
  );
}
