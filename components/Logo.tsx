// Hedgehog logo: a chubby hedgehog sitting up and facing forward, drawn as a line icon.
// Its spiky coat domes over the head and flares into a ruff at the shoulders; two little
// arms hang down in front ending in clawed paws, and two feet poke out at the bottom.
// Drawn on a 64x64 grid. Color comes from `currentColor` (the nav uses the text color);
// the feet are filled with the page color so they sit in front of the body.

export const HEDGEHOG_PATH =
  "M13.72 53.01 L9.81 49.85 L13.06 46.01 L9.15 42.85 L12.19 39.06 L6.71 37.18 L9.96 32.39 L5.81 27.06 L12.10 26.25 L12.73 21.27 L17.50 21.83 L14.50 17.70 L18.80 14.96 L17.52 10.00 L22.57 9.08 L23.58 3.99 L28.53 5.50 L32.24 1.61 L35.47 5.50 L40.42 3.99 L41.43 9.08 L46.48 10.00 L45.20 14.96 L49.50 17.70 L46.50 21.83 L51.27 21.27 L51.90 26.25 L58.19 27.06 L54.04 32.39 L57.29 37.18 L51.81 39.06 L54.85 42.85 L50.94 46.01 L54.19 49.85 L50.28 53.01 C50.28 59.50 40 60.50 32 60.50 C24 60.50 13.72 59.50 13.72 53.01 Z";

const ARMS = "M21.4 33.6c-1.6 3.8-1.2 7.9 1.2 11.6M42.6 33.6c1.6 3.8 1.2 7.9-1.2 11.6";
const CLAWS = "M21.2 45.2c-.2 1.9.4 3.6 1.7 4.6M23.6 45.6c.1 1.9.8 3.4 2 4.2M42.8 45.2c.2 1.9-.4 3.6-1.7 4.6M40.4 45.6c-.1 1.9-.8 3.4-2 4.2";

export function Logo({ className = "", strokeWidth = 3.2 }: { className?: string; strokeWidth?: number }) {
  const thin = strokeWidth * 0.7;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <path d={HEDGEHOG_PATH} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {/* eyes and nose */}
      <circle cx="26.2" cy="20.5" r="2.4" fill="currentColor" />
      <circle cx="37.8" cy="20.5" r="2.4" fill="currentColor" />
      <ellipse cx="32" cy="27.4" rx="3.1" ry="2.5" fill="currentColor" />
      {/* arms hanging in front, with clawed paws */}
      <path d={`${ARMS}${CLAWS}`} stroke="currentColor" strokeWidth={thin} strokeLinecap="round" />
      {/* feet */}
      <ellipse cx="24.5" cy="59.6" rx="4.6" ry="2.5" transform="rotate(-10 24.5 59.6)" fill="var(--background, #fff)" stroke="currentColor" strokeWidth={thin} />
      <ellipse cx="39.5" cy="59.6" rx="4.6" ry="2.5" transform="rotate(10 39.5 59.6)" fill="var(--background, #fff)" stroke="currentColor" strokeWidth={thin} />
    </svg>
  );
}
