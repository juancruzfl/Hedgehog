// Hedgehog logo: a cartoon hedgehog, drawn as a bold line icon. Big spikes sweep back from
// its head and down its back; in front, a big round head with little round ears, shiny eyes,
// a tiny nose and a ":3" mouth, on a chubby body with two arms and two feet. Drawn on a
// 64x64 grid (scaled slightly so the spikes stay inside). Color comes from `currentColor`
// (the nav uses the text color); shapes are filled with the page color so they layer.

export const HEDGEHOG_COAT =
  "M18.76 44.74 L8.46 43.41 L11.01 33.78 L6.30 29.61 L12.88 22.65 L9.72 14.97 L18.69 13.66 L19.25 4.22 L27.24 8.65 L32.00 0.40 L36.76 8.65 L44.75 4.22 L45.31 13.66 L54.28 14.97 L51.12 22.65 L57.70 29.61 L52.99 33.78 L55.54 43.41 L45.24 44.74 L40 48 L24 48 Z";

/** Head and body, one shape. */
export const HEDGEHOG_FRONT =
  "M32 12C42.2 12 48.4 18.4 48.4 26.2C48.4 30.6 46.6 33.6 44.8 35.4C47.6 39.4 48.6 44.6 48 49.4C47.2 55 41.6 57.2 32 57.2C22.4 57.2 16.8 55 16 49.4C15.4 44.6 16.4 39.4 19.2 35.4C17.4 33.6 15.6 30.6 15.6 26.2C15.6 18.4 21.8 12 32 12Z";

export function Logo({ className = "", strokeWidth = 2.8 }: { className?: string; strokeWidth?: number }) {
  const thin = strokeWidth * 0.85;
  const fill = "var(--background, #fff)";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <g transform="translate(32 32) scale(0.92) translate(-32 -30.5)">
        <path d={HEDGEHOG_COAT} fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
        {/* ears, behind the head */}
        <circle cx="20.8" cy="15.4" r="4.2" fill={fill} stroke="currentColor" strokeWidth={thin} />
        <circle cx="43.2" cy="15.4" r="4.2" fill={fill} stroke="currentColor" strokeWidth={thin} />
        <path d={HEDGEHOG_FRONT} fill={fill} stroke="currentColor" strokeWidth={strokeWidth} />
        {/* shiny eyes, nose, ":3" mouth */}
        <circle cx="25.6" cy="24.6" r="3.2" fill="currentColor" />
        <circle cx="38.4" cy="24.6" r="3.2" fill="currentColor" />
        <circle cx="26.7" cy="23.5" r="1.05" fill={fill} />
        <circle cx="39.5" cy="23.5" r="1.05" fill={fill} />
        <ellipse cx="32" cy="28.6" rx="1.6" ry="1.2" fill="currentColor" />
        <path d="M29.2 30.6c.7 1.4 2.8 1.4 2.8-.4 0 1.8 2.1 1.8 2.8.4" stroke="currentColor" strokeWidth={thin} strokeLinecap="round" strokeLinejoin="round" />
        {/* arms and feet */}
        <path
          d="M21 40.4c-.4 3.6.9 6.4 3.5 7.1M43 40.4c.4 3.6-.9 6.4-3.5 7.1M22.6 56.6c0 2.6 1.6 4 3.8 4s3.8-1.4 3.8-3.6M41.4 56.6c0 2.6-1.6 4-3.8 4s-3.8-1.4-3.8-3.6"
          stroke="currentColor"
          strokeWidth={thin}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
