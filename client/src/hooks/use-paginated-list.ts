import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useDebouncedValue } from "./use-debounced-value";

interface UsePaginatedListOptions {
  /** Rows per page sent to the server (opt-in — server endpoints keep
   * their existing default/shape when this hook isn't used). */
  limit?: number;
  /** Debounce delay applied to `filters.search` before it reaches the
   * query key / network request. */
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * TASK-03 (performance QA) — reusable, debounced, stably-keyed paginated
 * list query.
 *
 * Two problems this fixes, both audited in TASK-03-report.md:
 *  1. Un-debounced search: `filters.search` is passed through
 *     useDebouncedValue() before it's placed in the query key, so a burst
 *     of keystrokes collapses into one request instead of one per
 *     keystroke (see client/src/lib/debounce.ts).
 *  2. Unstable query keys / list-refetch flicker: the key is built from a
 *     plain, memoized filter object (not a fresh object literal per
 *     render) and `placeholderData: keepPreviousData` (TanStack Query v5)
 *     keeps the previous page's rows on screen while the next page loads
 *     instead of the list flashing to empty/loading on every page turn or
 *     filter tweak.
 *
 * Expects the server endpoint to return `{ rows, total }` — matching the
 * shape GET /api/inquiries and GET /api/leads already use today. Not yet
 * wired into any page (pages/** and components/{customers,leads,...}/**
 * are owned by other tasks) — see TASK-03-report.md for proposed
 * per-page diffs, including the new storage-layer helpers
 * (getCustomersListPaginated / getBookingsByTenantPaginated in
 * server/storage-mongodb.ts) a route would need to call to serve this
 * hook's expected response shape for customers/bookings.
 */
export function usePaginatedList<TRow = any>(
  baseUrl: string,
  filters: Record<string, string | number | undefined>,
  { limit = 50, debounceMs = 350, enabled = true }: UsePaginatedListOptions = {},
) {
  const rawSearch = typeof filters.search === "string" ? filters.search : "";
  const debouncedSearch = useDebouncedValue(rawSearch, debounceMs);

  // Stable, serializable filter set — every field that can change the
  // result set (other than the raw/pre-debounce search keystrokes) is
  // included, and nothing else, so the query key only changes when the
  // *effective* request would change.
  const stableFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSearch, JSON.stringify({ ...filters, search: undefined })],
  );

  const queryKey = useMemo(
    () => [baseUrl, stableFilters, limit] as const,
    [baseUrl, stableFilters, limit],
  );

  return useQuery<{ rows: TRow[]; total: number }>({
    queryKey,
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(stableFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") params.set(key, String(value));
      });
      params.set("limit", String(limit));

      const res = await fetch(`${baseUrl}?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
