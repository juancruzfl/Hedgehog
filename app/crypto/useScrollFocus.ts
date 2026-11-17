"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks which of a list of elements is "in focus": the one crossing the middle
 * band of the viewport, the last one once the page is scrolled to the bottom, or
 * whichever one holds keyboard focus. Also turns on gentle (proximity) scroll
 * snapping while mounted so a card settles in the middle when scrolling stops.
 */
export function useScrollFocus(keys: string[]) {
  const [active, setActive] = useState<string | null>(keys[0] ?? null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const keyList = keys.join("|");

  const register = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(key, el);
      else nodes.current.delete(key);
    },
    [],
  );

  useEffect(() => {
    if (!keys.length) return;
    setActive((cur) => (cur && keys.includes(cur) ? cur : keys[0]));

    // A thin band across the middle of the viewport decides which card is in focus.
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) {
          const key = [...nodes.current.entries()].find(([, el]) => el === hit.target)?.[0];
          if (key) setActive(key);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.01] },
    );
    nodes.current.forEach((el) => io.observe(el));

    // The last card may never reach the middle band; give it focus at the bottom.
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setActive(keys[keys.length - 1]);
      else if (window.scrollY < 4) setActive(keys[0]);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Keyboard users: whatever card contains focus is the focused card.
    const onFocus = (e: FocusEvent) => {
      for (const [key, el] of nodes.current) if (el.contains(e.target as Node)) setActive(key);
    };
    document.addEventListener("focusin", onFocus);

    const html = document.documentElement;
    html.style.scrollSnapType = "y proximity";
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocus);
      html.style.scrollSnapType = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyList]);

  return { active, register };
}
