// Flat coin icons (no gradients). Unknown assets fall back to a lettered circle.

const SIZE = { sm: "h-6 w-6", md: "h-10 w-10", lg: "h-12 w-12" } as const;

export function CoinIcon({ asset, size = "md", className = "" }: { asset: string; size?: keyof typeof SIZE; className?: string }) {
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
          <circle cx="16" cy="16" r="16" fill="#9945FF" />
          <path fill="#fff" d="M10.2 19.8a.6.6 0 0 1 .4-.2h12.6c.3 0 .4.3.2.5l-2.4 2.5a.6.6 0 0 1-.4.2H8c-.3 0-.4-.3-.2-.5z" />
          <path fill="#fff" d="M10.2 9.2a.6.6 0 0 1 .4-.2h12.6c.3 0 .4.3.2.5L21 12a.6.6 0 0 1-.4.2H8c-.3 0-.4-.3-.2-.5z" />
          <path fill="#fff" d="M21 14.5a.6.6 0 0 0-.4-.2H8c-.3 0-.4.3-.2.5l2.4 2.5c.1.1.3.2.4.2h12.6c.3 0 .4-.3.2-.5z" />
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
    default:
      return (
        <span className={`${cls} flex items-center justify-center rounded-full bg-surface-2 text-[10px] font-bold`} aria-label={asset}>
          {asset.slice(0, 3)}
        </span>
      );
  }
}
