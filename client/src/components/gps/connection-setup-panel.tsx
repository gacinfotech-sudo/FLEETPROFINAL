import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plug, Plus, RefreshCw, Settings2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGpsConnections, useSyncGpsDevices, useTestGpsConnection } from './api';
import { ConnectionFormDialog } from './connection-form-dialog';
import { ConnectionSyncHealthBadge } from './connection-sync-health-badge';
import type { GpsConnection, GpsConnectionStatus } from './types';

const STATUS_BADGE_CLASS: Record<GpsConnectionStatus, string> = {
  connected: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
  testing: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
  configuration_required: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  authentication_failed: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
  provider_unavailable: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
  rate_limited: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  webhook_failed: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
  sync_failed: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
  disabled: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800',
};

function ConnectionCard({ connection, onEdit }: { connection: GpsConnection; onEdit: (c: GpsConnection) => void }) {
  const { toast } = useToast();
  const testMutation = useTestGpsConnection();
  const syncMutation = useSyncGpsDevices();

  return (
    <Card data-testid={`gps-connection-card-${connection.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base truncate">{connection.connectionName}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{connection.providerKey} &middot; {connection.authenticationType.replace(/_/g, ' ')}</p>
        </div>
        <Badge variant="outline" className={STATUS_BADGE_CLASS[connection.status]}>{connection.status.replace(/_/g, ' ')}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConnectionSyncHealthBadge connectionId={connection.id} />

        {connection.lastError && (
          <p className="text-xs text-destructive break-words">{connection.lastError}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!connection.enabled || testMutation.isPending}
            onClick={() =>
              testMutation.mutate(connection.id, {
                onSuccess: (result) => toast({ title: result.success ? 'Connection test passed' : 'Connection test failed', description: result.message, variant: result.success ? undefined : 'destructive' }),
                onError: (error: any) => toast({ title: 'Test failed', description: error?.message, variant: 'destructive' }),
              })
            }
            data-testid={`gps-conn-test-${connection.id}`}
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> {testMutation.isPending ? 'Testing…' : 'Test connection'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={connection.status !== 'connected' || syncMutation.isPending}
            onClick={() =>
              syncMutation.mutate(connection.id, {
                onSuccess: (result) => toast({ title: 'Devices synced', description: `${result.created} new, ${result.updated} updated, ${result.rejected} rejected.` }),
                onError: (error: any) => toast({ title: 'Sync failed', description: error?.message, variant: 'destructive' }),
              })
            }
            data-testid={`gps-conn-sync-${connection.id}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} /> Sync devices
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(connection)} data-testid={`gps-conn-edit-${connection.id}`}>
            <Settings2 className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Connection setup flow: list existing connections, add a new one, test it,
 * then sync its devices — end to end against the real routes TASK-GPS-
 * CONNECTION-02 already shipped (`/api/gps/connections*`). */
export function ConnectionSetupPanel() {
  const { data: connections, isLoading } = useGpsConnections();
  const [formTarget, setFormTarget] = useState<'new' | GpsConnection | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Connect a telematics provider, verify it, then sync its devices for vehicle mapping.</p>
        <Button size="sm" onClick={() => setFormTarget('new')} data-testid="gps-conn-add">
          <Plus className="h-4 w-4 mr-1" /> Add connection
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground p-6 text-center border rounded-md">Loading connections…</div>}

      {!isLoading && (connections ?? []).length === 0 && (
        <div className="text-sm text-muted-foreground p-8 text-center border rounded-md border-dashed flex flex-col items-center gap-2">
          <Plug className="h-6 w-6" />
          No GPS provider connections yet. Add one to start tracking vehicles.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(connections ?? []).map((connection) => (
          <ConnectionCard key={connection.id} connection={connection} onEdit={setFormTarget} />
        ))}
      </div>

      {formTarget && (
        <ConnectionFormDialog
          connection={formTarget === 'new' ? null : formTarget}
          open={Boolean(formTarget)}
          onOpenChange={(open) => !open && setFormTarget(null)}
        />
      )}
    </div>
  );
}
