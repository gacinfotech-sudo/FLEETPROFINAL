import { useEffect, useState } from "react";

/**
 * TASK-03 (performance QA) — debounces a fast-changing value (typically
 * search-box input state) so a consumer can put the *debounced* value —
 * not the raw one — into a React Query key. See
 * client/src/lib/debounce.ts for the full reproduction this addresses.
 *
 * Usage (proposed diff for client/src/pages/customers.tsx — not applied
 * here since pages/** is owned by another task; see TASK-03-report.md):
 *
 *   const [search, setSearch] = useState("");
 *   const debouncedSearch = useDebouncedValue(search, 350);
 *   useQuery({ queryKey: ["/api/customers", debouncedSearch, ...], ... });
 *   <Input value={search} onChange={(e) => setSearch(e.target.value)} />
 *
 * The input stays bound to the raw, immediately-updating `search` state
 * (so the user sees their own keystrokes with zero lag) while only the
 * value driving the network request updates after a pause in typing.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
