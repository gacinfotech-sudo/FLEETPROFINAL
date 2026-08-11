import { formatDistanceToNow } from 'date-fns';
import { HeartPulse } from 'lucide-react';
import { useConnectionSyncHealth } from './api';

/** GPS health indicator for a connection — devices tracked/healthy/failing
 * and last poll time, from the proposed sync-health endpoint (see api.ts).
 * Renders nothing (not an error, not a placeholder) when that endpoint
 * isn't deployed yet, so its absence never looks like a real "no health
 * data" state. */
export function ConnectionSyncHealthBadge({ connectionId }: { connectionId: string }) {
  const { data, notYetAvailable, isLoading } = useConnectionSyncHealth(connectionId);

  if (isLoading || notYetAvailable || !data) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-md px-2 py-1.5" data-testid={`gps-sync-health-${connectionId}`}>
      <HeartPulse className="h-3.5 w-3.5 shrink-0" />
      <span>{data.devicesHealthy}/{data.devicesTracked} devices healthy</span>
      {data.openDeadLetters > 0 && <span className="text-destructive">&middot; {data.openDeadLetters} failing</span>}
      {data.lastPolledAt && <span>&middot; last poll {formatDistanceToNow(new Date(data.lastPolledAt), { addSuffix: true })}</span>}
    </div>
  );
}
