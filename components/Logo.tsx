// Hedgehog logo: a chubby hedgehog sitting down, facing forward, drawn as a line icon.
// Spikes crown its head and run down its back to wide haunches; a light face-and-belly
// panel (pinched at the neck) separates head from body, with paws resting on the belly and
// two feet poking out in front. Drawn on a 64x64 grid. Color comes from `currentColor`
// (the nav uses the text color); the feet are filled with the page color so they sit in front.

export const HEDGEHOG_PATH =
  "M13.46 38.39 L6.63 35.42 L11.01 29.62 L6.26 24.09 L12.88 20.72 L11.19 13.76 L18.69 13.53 L20.40 6.57 L27.24 9.52 L32.00 4.00 L36.76 9.52 L43.60 6.57 L45.31 13.53 L52.81 13.76 L51.12 20.72 L57.74 24.09 L52.99 29.62 L57.37 35.42 L50.54 38.39 C54.54 45.39 55 55 46 57.5 C40 59 24 59 18 57.5 C9 55 9.46 45.39 13.46 38.39 Z";

/** The face and belly panel. */
export const HEDGEHOG_BELLY =
  "M32 16.5 C44 16.5 47 25.5 44.2 32.4 C43.5 34.2 43.2 35.4 44 37 C48 44 47 55.5 32 55.5 C17 55.5 16 44 20 37 C20.8 35.4 20.5 34.2 19.8 32.4 C17 25.5 20 16.5 32 16.5 Z";

export function Logo({ className = "", strokeWidth = 3.4 }: { className?: string; strokeWidth?: number }) {
  const thin = strokeWidth * 0.72;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <path d={HEDGEHOG_PATH} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <path d={HEDGEHOG_BELLY} stroke="currentColor" strokeWidth={thin} strokeLinejoin="round" />
      {/* eyes and nose */}
      <circle cx="27" cy="28" r="2.4" fill="currentColor" />
      <circle cx="37" cy="28" r="2.4" fill="currentColor" />
      <ellipse cx="32" cy="33.2" rx="2.7" ry="2.1" fill="currentColor" />
      {/* paws resting on the belly */}
      <path d="M23.8 42.4c2.1.9 3.5 2.6 3.9 4.9M40.2 42.4c-2.1.9-3.5 2.6-3.9 4.9" stroke="currentColor" strokeWidth={thin} strokeLinecap="round" />
      {/* feet, in front of the body */}
      <ellipse cx="22.5" cy="58.3" rx="5" ry="2.8" transform="rotate(-14 22.5 58.3)" fill="var(--background, #fff)" stroke="currentColor" strokeWidth={thin} />
      <ellipse cx="41.5" cy="58.3" rx="5" ry="2.8" transform="rotate(14 41.5 58.3)" fill="var(--background, #fff)" stroke="currentColor" strokeWidth={thin} />
    </svg>
  );
}
