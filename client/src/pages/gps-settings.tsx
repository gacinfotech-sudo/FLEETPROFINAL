import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/use-permissions';
import { Map, Link2, Plug } from 'lucide-react';
import { LiveMapView } from '@/components/gps/live-map-view';
import { VehicleMappingPanel } from '@/components/gps/vehicle-mapping-panel';
import { ConnectionSetupPanel } from '@/components/gps/connection-setup-panel';

// This is the single page file TASK-GPS-FLEET-UI-05 owns
// (`client/src/pages/gps-settings.tsx`). Everything the task needs to ship
// — Live Map, vehicle<->device mapping, connection setup — is composed here
// as tabs rather than as separate top-level pages, because `dashboard.tsx`'s
// `/dashboard/:section?` switch (Integrator-only, see the task report for
// the exact proposed registration diff) only has room for one new case to
// mount one new component without that file's owner adding several. The
// filename predates this decision; "Connections" is one tab among three
// here, not the whole page, by design — see the task report for the
// alternative considered (a standalone page per surface) and why this was
// chosen instead.
type GpsTab = 'live-map' | 'mapping' | 'connections';

export default function GpsSettingsPage() {
  const { hasPermission } = usePermissions();
  const canViewLive = hasPermission('gps.live.view') || hasPermission('gps.connection.view');
  const canManageMapping = hasPermission('gps.assignment.manage') || hasPermission('gps.device.view');
  const canManageConnections = hasPermission('gps.connection.view');

  const availableTabs: GpsTab[] = [
    ...(canViewLive ? (['live-map'] as GpsTab[]) : []),
    ...(canManageMapping ? (['mapping'] as GpsTab[]) : []),
    ...(canManageConnections ? (['connections'] as GpsTab[]) : []),
  ];
  const [tab, setTab] = useState<GpsTab>(availableTabs[0] ?? 'live-map');

  if (availableTabs.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-md">
        You don't have permission to view GPS fleet tracking.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="gps-settings-page">
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">📍 GPS Fleet Tracking</h1>
        <p className="text-emerald-100 mt-1">Real-time vehicle locations • Device mapping & provider connections</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as GpsTab)}>
        <TabsList className="flex-wrap h-auto">
          {canViewLive && (
            <TabsTrigger value="live-map" data-testid="gps-tab-live-map">
              <Map className="h-4 w-4 mr-1.5" /> Live Map
            </TabsTrigger>
          )}
          {canManageMapping && (
            <TabsTrigger value="mapping" data-testid="gps-tab-mapping">
              <Link2 className="h-4 w-4 mr-1.5" /> Vehicle Mapping
            </TabsTrigger>
          )}
          {canManageConnections && (
            <TabsTrigger value="connections" data-testid="gps-tab-connections">
              <Plug className="h-4 w-4 mr-1.5" /> Connections
            </TabsTrigger>
          )}
        </TabsList>

        {canViewLive && (
          <TabsContent value="live-map" className="pt-4">
            <LiveMapView />
          </TabsContent>
        )}
        {canManageMapping && (
          <TabsContent value="mapping" className="pt-4">
            <VehicleMappingPanel />
          </TabsContent>
        )}
        {canManageConnections && (
          <TabsContent value="connections" className="pt-4">
            <ConnectionSetupPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
