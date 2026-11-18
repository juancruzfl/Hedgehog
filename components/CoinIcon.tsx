// Coin icons. Flat except Solana, whose brand mark is a purple-to-green gradient.
// ZEC and HYPE are simplified versions of the Zcash and Hyperliquid marks.
// Unknown assets fall back to a lettered circle.

import { useId } from "react";

const SIZE = { sm: "h-6 w-6", md: "h-10 w-10", lg: "h-12 w-12" } as const;

export function CoinIcon({ asset, size = "md", className = "" }: { asset: string; size?: keyof typeof SIZE; className?: string }) {
  // Unique per instance so several SOL icons on one page don't share a gradient id.
  const gradId = `sol-${useId().replace(/:/g, "")}`;
  const cls = `${SIZE[size]} shrink-0 ${className}`;
  switch (asset.toUpperCase()) {
    case "BTC":
      return (
        <svg viewBox="0 0 32 32" className={cls} role="img" aria-label="Bitcoin">
          <circle cx="16" cy="16" r="16" fill="#F7931A" />
          <path
            fill="#fff"
            d="M22.1 14.1c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.7 2.6-1.3-.3.7-2.6-1.6-.4-.7 2.7-1-.3-2.2-.5-.4 1.7s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.1.2.1-.2-.1-1.1 4.4c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.1.5 1.2.3-.7 2.8 1.6.4.7-2.7 1.3.3-.7 2.7 1.6.4.7-2.8c2.8.5 4.9.3 5.8-2.2.7-2-.1-3.2-1.5-4 1.1-.2 1.9-1 2.1-2.4zm-3.8 5.3c-.5 2-3.9.9-5 .6l.9-3.6c1.1.3 4.6.8 4.1 3zm.5-5.4c-.5 1.8-3.3.9-4.2.7l.8-3.2c.9.2 3.9.7 3.4 2.5z"
          />
        </svg>
      );
    case "ETH":
      return (
        <svg viewBox="0 0 32 32" className={cls} role="img" aria-label="Ethereum">
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <path fill="#fff" fillOpacity=".6" d="M16.5 4v8.9l7.5 3.3z" />
          <path fill="#fff" d="M16.5 4 9 16.2l7.5-3.3z" />
          <path fill="#fff" fillOpacity=".6" d="M16.5 22v6l7.5-10.4z" />
          <path fill="#fff" d="M16.5 28v-6L9 17.6z" />
          <path fill="#fff" fillOpacity=".2" d="m16.5 20.6 7.5-4.4-7.5-3.3z" />
          <path fill="#fff" fillOpacity=".6" d="m9 16.2 7.5 4.4v-7.7z" />
        </svg>
      );
    case "SOL":
      return (
        <svg viewBox="0 0 32 32" className={cls} role="img" aria-label="Solana">
          <defs>
            {/* Solana brand gradient: purple (bottom-left) to green (top-right) */}
            <linearGradient id={gradId} x1="8" y1="23" x2="24" y2="9" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#9945FF" />
              <stop offset="1" stopColor="#14F195" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="16" fill="#000" />
          <path fill={`url(#${gradId})`} d="M10.2 19.8a.6.6 0 0 1 .4-.2h12.6c.3 0 .4.3.2.5l-2.4 2.5a.6.6 0 0 1-.4.2H8c-.3 0-.4-.3-.2-.5z" />
          <path fill={`url(#${gradId})`} d="M10.2 9.2a.6.6 0 0 1 .4-.2h12.6c.3 0 .4.3.2.5L21 12a.6.6 0 0 1-.4.2H8c-.3 0-.4-.3-.2-.5z" />
          <path fill={`url(#${gradId})`} d="M21 14.5a.6.6 0 0 0-.4-.2H8c-.3 0-.4.3-.2.5l2.4 2.5c.1.1.3.2.4.2h12.6c.3 0 .4-.3.2-.5z" />
        </svg>
      );
    case "XRP":
      return (
        <svg viewBox="0 0 32 32" className={cls} role="img" aria-label="XRP">
          <circle cx="16" cy="16" r="16" fill="#23292F" />
          <path
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            d="M9 9.5h1.6l3.6 3.7a2.6 2.6 0 0 0 3.6 0l3.6-3.7H23M9 22.5h1.6l3.6-3.7a2.6 2.6 0 0 1 3.6 0l3.6 3.7H23"
          />
        </svg>
      );
    case "ZEC":
      return (
        <svg viewBox="0 0 32 32" className={cls} role="img" aria-label="Zcash">
          <circle cx="16" cy="16" r="16" fill="#F4B728" />
          {/* Zcash mark: a Z with a bar through the top and bottom */}
          <path fill="#1A1A1A" d="M15 6.5h2V9h4.2v2.6l-6.4 8.7h6.4V23H17v2.5h-2V23h-4.2v-2.6l6.4-8.7h-6.4V9H15z" />
        </svg>
      );
    case "HYPE":
      return (
        <svg viewBox="0 0 32 32" className={cls} role="img" aria-label="Hyperliquid">
          <circle cx="16" cy="16" r="16" fill="#0F3933" />
          {/* Hyperliquid mark: a rounded figure-eight wave */}
          <path
            fill="#97FCE4"
            d="M24.6 15.9c0 4.4-2.6 6-5.3 3.7-2.2-1.9-2.6-5.6-3.3-5.6s-1.1 3.7-3.3 5.6c-2.7 2.3-5.3.7-5.3-3.7s2.6-6 5.3-3.7c2.2 1.9 2.6 5.6 3.3 5.6s1.1-3.7 3.3-5.6c2.7-2.3 5.3-.7 5.3 3.7z"
          />
        </svg>
      );
    default:
      return (
        <span className={`${cls} flex items-center justify-center rounded-full bg-surface-2 text-[10px] font-bold`} aria-label={asset}>
          {asset.slice(0, 3)}
        </span>
      );
  }
}
