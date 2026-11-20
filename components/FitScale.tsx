"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Shows its children exactly as designed at `width` px and scales the whole thing down to
 * fit narrower spaces (CSS zoom, so layout shrinks with it), instead of reflowing it. Used
 * so phone versions of the landing widgets look like the desktop ones, and for grids of
 * cards. Children shouldn't depend on viewport breakpoints for their layout.
 *
 * `wideWidth`: a different design width on screens 1024px and up.
 * `hideUntilFit`: stay invisible until measured (for content that would look squashed first).
 */
export function FitScale({
  width,
  wideWidth,
  hideUntilFit = false,
  className = "",
  children,
}: {
  width: number;
  wideWidth?: number;
  hideUntilFit?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ zoom: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      const w = wideWidth && wide.matches ? wideWidth : width;
      setFit({ zoom: Math.min(1, el.clientWidth / w), width: w });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    wide.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      wide.removeEventListener("change", measure);
    };
  }, [width, wideWidth]);
  return (
    <div ref={ref} className={`w-full ${hideUntilFit ? "overflow-hidden" : ""} ${className}`}>
      <div
        className="mx-auto"
        style={
          fit
            ? { width: fit.width, zoom: fit.zoom }
            : hideUntilFit
              ? { width, visibility: "hidden" }
              : { maxWidth: width } // until measured, fill the space (no overflow on first paint)
        }
      >
        {children}
      </div>
    </div>
  );
}
