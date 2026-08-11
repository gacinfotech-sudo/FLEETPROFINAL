/**
 * TASK-03 (performance QA) — generic debounce utility.
 *
 * Reproduced today: client/src/pages/customers.tsx's search box calls
 * `setSearch(e.target.value)` directly in its `onChange`, and `search` is
 * part of the React Query key (`["/api/customers", search, ...]`), so
 * every keystroke fires a brand-new `GET /api/customers?search=...`
 * request — see TASK-03-report.md for a measured reproduction (typing an
 * 8-character term fired 8 separate requests, with older, slower
 * responses able to race and overwrite a newer, faster one).
 *
 * `debounce()` is the fix's building block: it delays invoking `fn` until
 * `delayMs` have elapsed since the *last* call, so N calls inside the
 * delay window collapse into exactly one. It's framework-agnostic on
 * purpose so it can be unit-tested directly (see
 * tests/e2e/performance-search-debounce.spec.ts) without mounting React —
 * `client/src/hooks/use-debounced-value.ts` is the thin React wrapper
 * pages should use.
 *
 * Not yet wired into customers.tsx or any other page — those files are
 * owned by TASK-01/other tasks; see TASK-03-report.md for the exact
 * proposed diff.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Args) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };

  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return debounced;
}
