"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Shows its children exactly as designed at `width` px and scales the whole thing down to
 * fit narrower screens (CSS zoom, so layout shrinks with it), instead of reflowing it. Used
 * so phone versions of the landing widgets look like the desktop ones. Children shouldn't
 * use viewport breakpoints, since the design width is what they're laid out at.
 */
export function FitScale({ width, className = "", children }: { width: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, el.clientWidth / width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={`w-full ${className}`}>
      {/* Until measured, fall back to filling the space (no overflow on first paint). */}
      <div className="mx-auto" style={zoom === null ? { maxWidth: width } : { width, zoom }}>
        {children}
      </div>
    </div>
  );
}
