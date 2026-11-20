"use client";

import { useEffect, useRef } from "react";

/**
 * Popup used for building a hedge. Opens as soon as it mounts and closes via ✕, Esc or a click
 * on the backdrop. It's centered on every screen size. The header stays
 * put while the body scrolls, and the page behind it doesn't move.
 */
export function Sheet({
  title,
  sub,
  icon,
  onClose,
  children,
  labelId = "sheet-title",
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  labelId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // Lock the page behind while open.
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
      if (d?.open) d.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click that lands on the dialog element itself (not its content) is the backdrop.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="hh-sheet fixed inset-0 m-auto flex h-fit max-h-[calc(100svh-2rem)] w-[calc(100vw-1.5rem)] max-w-none flex-col overflow-hidden rounded-2xl border border-border bg-surface p-0 text-text sm:max-h-[min(calc(100svh-3rem),60rem)] sm:w-[min(52rem,calc(100vw-3rem))]"
    >
      <header className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
        {icon}
        <div className="mr-auto min-w-0">
          <h2 id={labelId} className="text-xl font-bold tracking-tight">
            {title}
          </h2>
          {sub && <p className="mt-0.5 text-sm text-text-2">{sub}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="-mr-2 rounded-lg px-2.5 py-1 text-lg text-text-3 hover:bg-surface-2 hover:text-text">
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-6">{children}</div>
    </dialog>
  );
}
