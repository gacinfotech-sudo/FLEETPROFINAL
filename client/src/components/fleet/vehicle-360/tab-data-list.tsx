import { useQuery } from "@tanstack/react-query";
import { Loader2, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shared list-tab shell used by every Vehicle 360 tab that fetches a
 * collection and renders rows. Handles the three states every tab's
 * acceptance criterion cares about: loading, genuine empty (no crash, no
 * error boundary trip), and error (also no crash — a 404 from a
 * not-yet-mounted proposed endpoint, expected until the Integrator applies
 * this batch's route patches, renders the same as "not yet available" here
 * rather than an unhandled exception).
 */
export function TabDataList<T>({
  queryKey,
  queryFn,
  renderRow,
  emptyLabel,
  notYetAvailableLabel,
  addAction,
}: {
  queryKey: unknown[];
  queryFn: () => Promise<T[]>;
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyLabel: string;
  /** Set only for tabs backed by a not-yet-merged/not-yet-built backend
   * (Daily Inspections, GPS & Telematics, Handover & Return, Timeline) —
   * shown instead of a generic error when the fetch fails, so the
   * distinction between "genuinely empty" and "backend not wired yet" is
   * honest, not hidden behind one ambiguous message. */
  notYetAvailableLabel?: string;
  addAction?: React.ReactNode;
}) {
  const { data, isLoading, isError } = useQuery<T[]>({ queryKey, queryFn, retry: false });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{notYetAvailableLabel ?? "This section is temporarily unavailable."}</p>
        </CardContent>
      </Card>
    );
  }

  const items = data ?? [];
  return (
    <div className="space-y-4">
      {addAction && <div className="flex justify-end">{addAction}</div>}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{emptyLabel}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">{items.map((item, i) => renderRow(item, i))}</div>
      )}
    </div>
  );
}
