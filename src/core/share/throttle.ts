// At most one call per interval: the first at once, the calls in between folded into one at the end of the interval. For
// work that peers can trigger (a re-render for every offer update): every peer is hostile, and the main thread is the one
// Stop runs on. performance.now() and not Date.now(): a wall clock that moves back would hold the next call for as long
// as the jump.

// cancel() drops a pending call, for when the work is no longer wanted (the view was stopped).

export type Throttled = (() => void) & { cancel(): void };

export function throttle(fn: () => void, ms: number): Throttled {
  let last = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => { last = performance.now(); timer = null; fn(); };
  const call = () => {
    if (timer !== null) return;
    const wait = last + ms - performance.now();
    if (wait <= 0) run();
    else timer = setTimeout(run, wait);
  };
  return Object.assign(call, {
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  });
}
