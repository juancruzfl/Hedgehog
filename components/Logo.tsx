// Hedgehog logo: a chubby hedgehog sitting back in its spiky coat, facing forward, drawn as
// a line icon. The spikes make a halo around it (a crown over the head, a bowl around the
// body); in front, a soft face that flows into a round belly, small ears, a smile, two little
// arms raised at its sides and two feet sticking out. Drawn on a 64x64 grid (scaled slightly
// so the spikes stay inside). Color comes from `currentColor` (the nav uses the text color);
// shapes are filled with the page color so the front sits over the coat.

export const HEDGEHOG_COAT =
  "M14.04 55.48 L8.14 56.25 L8.50 50.28 L2.85 47.96 L6.52 43.02 L2.74 38.56 L7.69 35.47 L4.87 30.42 L10.20 28.24 L7.84 23.05 L12.29 20.96 L9.59 15.62 L15.36 14.02 L15.16 8.05 L21.03 8.95 L23.04 3.38 L28.19 6.33 L31.80 1.80 L35.81 6.33 L40.96 3.38 L42.97 8.95 L48.84 8.05 L48.64 14.02 L54.41 15.62 L51.71 20.96 L56.16 23.05 L53.80 28.24 L59.13 30.42 L56.31 35.47 L61.26 38.56 L57.48 43.02 L61.15 47.96 L55.50 50.28 L55.86 56.25 L49.96 55.48 C45.96 60.00 38 60.50 32 60.50 C26 60.50 18.04 60.00 14.04 55.48 Z";

/** Face and belly, one soft shape. */
export const HEDGEHOG_FRONT =
  "M32 11C41.8 11 45.2 17.5 44.8 24.5C44.6 28.5 49 32.5 49 41.5C49 52 41.5 57.5 32 57.5C22.5 57.5 15 52 15 41.5C15 32.5 19.4 28.5 19.2 24.5C18.8 17.5 22.2 11 32 11Z";

const ARMS =
  "M17.4 36.5C14.6 35.6 13 33.2 13.4 30.6C13.8 28.4 16.6 28.2 17.6 30.4C18.3 32 19.2 33.4 20.6 34.3M46.6 36.5C49.4 35.6 51 33.2 50.6 30.6C50.2 28.4 47.4 28.2 46.4 30.4C45.7 32 44.8 33.4 43.4 34.3";

export function Logo({ className = "", strokeWidth = 3 }: { className?: string; strokeWidth?: number }) {
  const thin = strokeWidth * 0.75;
  const fill = "var(--background, #fff)";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <g transform="translate(32 32) scale(0.94) translate(-32 -31.5)">
        <path d={HEDGEHOG_COAT} fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
        {/* ears, behind the face */}
        <circle cx="22.5" cy="13.2" r="2.6" fill={fill} stroke="currentColor" strokeWidth={thin} />
        <circle cx="41.5" cy="13.2" r="2.6" fill={fill} stroke="currentColor" strokeWidth={thin} />
        <path d={HEDGEHOG_FRONT} fill={fill} stroke="currentColor" strokeWidth={thin} />
        {/* eyes, nose, smile */}
        <circle cx="27.2" cy="21.8" r="2.2" fill="currentColor" />
        <circle cx="36.8" cy="21.8" r="2.2" fill="currentColor" />
        <ellipse cx="32" cy="26.2" rx="2.7" ry="2.1" fill="currentColor" />
        <path d="M29.4 29.7c1.6 1.1 3.6 1.1 5.2 0" stroke="currentColor" strokeWidth={thin * 0.85} strokeLinecap="round" />
        {/* arms and feet */}
        <path d={ARMS} fill={fill} stroke="currentColor" strokeWidth={thin} strokeLinecap="round" strokeLinejoin="round" />
        <ellipse cx="24" cy="56.2" rx="4.3" ry="3.1" transform="rotate(-28 24 56.2)" fill={fill} stroke="currentColor" strokeWidth={thin} />
        <ellipse cx="40" cy="56.2" rx="4.3" ry="3.1" transform="rotate(28 40 56.2)" fill={fill} stroke="currentColor" strokeWidth={thin} />
      </g>
    </svg>
  );
}
