// Shown instantly on navigation while a page's server data loads, so a click never
// feels ignored. The nav and footer stay in place around it.
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-10" aria-busy="true" aria-label="Loading">
      <div className="mx-auto h-10 w-2/3 max-w-xl animate-pulse rounded-xl bg-surface-2" />
      <div className="mx-auto mt-4 h-5 w-1/2 max-w-md animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-10 h-80 animate-pulse rounded-2xl border border-border bg-surface" />
    </main>
  );
}
