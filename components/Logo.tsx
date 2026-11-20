// Hedgehog logo: a chubby hedgehog sitting back in its spiky coat, facing forward, drawn as
// a simple line icon. A ring of big spikes around it, a soft face that flows into a round
// belly, two eyes, a nose, a small smile and two feet sticking out. Drawn on a 64x64 grid
// (scaled slightly so the spikes stay inside). Color comes from `currentColor` (the nav uses
// the text color); shapes are filled with the page color so the front sits over the coat.

export const HEDGEHOG_COAT =
  "M14.04 55.48 L5.73 54.89 L6.80 46.48 L1.73 40.02 L7.87 34.80 L5.16 27.37 L12.00 23.73 L8.51 16.12 L16.23 12.93 L18.11 4.87 L26.15 6.79 L31.76 1.01 L37.85 6.79 L45.89 4.87 L47.77 12.93 L55.49 16.12 L52.00 23.73 L58.84 27.37 L56.13 34.80 L62.27 40.02 L57.20 46.48 L58.27 54.89 L49.96 55.48 C45.96 60.00 38 60.50 32 60.50 C26 60.50 18.04 60.00 14.04 55.48 Z";

/** Face and belly, one soft shape. */
export const HEDGEHOG_FRONT =
  "M32 11C41.8 11 45.2 17.5 44.8 24.5C44.6 28.5 49 32.5 49 41.5C49 52 41.5 57.5 32 57.5C22.5 57.5 15 52 15 41.5C15 32.5 19.4 28.5 19.2 24.5C18.8 17.5 22.2 11 32 11Z";

export function Logo({ className = "", strokeWidth = 3 }: { className?: string; strokeWidth?: number }) {
  const thin = strokeWidth * 0.8;
  const fill = "var(--background, #fff)";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <g transform="translate(32 32) scale(0.94) translate(-32 -31)">
        <path d={HEDGEHOG_COAT} fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
        <path d={HEDGEHOG_FRONT} fill={fill} stroke="currentColor" strokeWidth={thin} />
        {/* eyes, nose, smile */}
        <circle cx="27.2" cy="22.5" r="2.4" fill="currentColor" />
        <circle cx="36.8" cy="22.5" r="2.4" fill="currentColor" />
        <ellipse cx="32" cy="27.2" rx="2.9" ry="2.2" fill="currentColor" />
        <path d="M29.4 30.8c1.6 1.1 3.6 1.1 5.2 0" stroke="currentColor" strokeWidth={thin * 0.85} strokeLinecap="round" />
        {/* feet */}
        <ellipse cx="24" cy="56.2" rx="4.3" ry="3.1" transform="rotate(-28 24 56.2)" fill={fill} stroke="currentColor" strokeWidth={thin} />
        <ellipse cx="40" cy="56.2" rx="4.3" ry="3.1" transform="rotate(28 40 56.2)" fill={fill} stroke="currentColor" strokeWidth={thin} />
      </g>
    </svg>
  );
}
