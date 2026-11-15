// At most one call per interval: the first at once, the calls in between folded into one at the end of the interval. For
// work that peers can trigger (a re-render for every offer update): every peer is hostile, and the main thread is the one
// Stop runs on.

export function throttle(fn: () => void, ms: number): () => void {
  let last = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => { last = Date.now(); timer = null; fn(); };
  return () => {
    if (timer !== null) return;
    const wait = last + ms - Date.now();
    if (wait <= 0) run();
    else timer = setTimeout(run, wait);
  };
}
