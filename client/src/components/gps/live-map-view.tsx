import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, RefreshCw, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGpsConnections, useLatestVehicleStates } from './api';
import { getProviderCapabilities } from './capabilities';
import { FleetMap, type FleetMapMarker } from './fleet-map';
import { StatusSummaryCards } from './status-summary-cards';
import { VehicleStatusCard } from './vehicle-status-card';
import { VehicleDetailDialog } from './vehicle-detail-dialog';
import type { MovingStatus, VehicleLiveStateRow } from './types';

type StatusFilter = 'all' | MovingStatus;

export function LiveMapView() {
  const { data: connections } = useGpsConnections();
  const { data: rows, isLoading, notYetAvailable, refetch, isFetching } = useLatestVehicleStates();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const connectionByProvider = useMemo(() => {
    const map = new Map<string, string>(); // connectionId -> providerKey
    for (const c of connections ?? []) map.set(c.id, c.providerKey);
    return map;
  }, [connections]);

  const allRows = rows ?? [];

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRows.filter((row) => {
      const status: MovingStatus = row.state?.movingStatus ?? 'offline';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!term) return true;
      const haystack = `${row.licensePlate ?? ''} ${row.make} ${row.vehicleModel ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [allRows, search, statusFilter]);

  const counts = useMemo(() => {
    const result = { moving: 0, stopped: 0, offline: 0 };
    for (const row of allRows) {
      const status: MovingStatus = row.state?.movingStatus ?? 'offline';
      result[status] += 1;
    }
    return result;
  }, [allRows]);

  // Only rows with real, stored telemetry (`row.state` present with
  // coordinates) become map markers — a vehicle whose device is assigned
  // but has never reported a position is listed (so the mapping is visible)
  // but never placed on the map, per GPS-SECURITY-SPEC.md §5.
  const markers: FleetMapMarker[] = useMemo(
    () =>
      filteredRows
        .filter((row): row is VehicleLiveStateRow & { state: NonNullable<VehicleLiveStateRow['state']> } => Boolean(row.state))
        .map((row) => ({
          id: row.gpsDeviceId,
          latitude: row.state.latitude,
          longitude: row.state.longitude,
          headingDegrees: row.state.headingDegrees,
          status: row.state.movingStatus,
          label: row.licensePlate || `${row.make} ${row.vehicleModel ?? ''}`.trim(),
          selected: row.vehicleId === selectedVehicleId,
        })),
    [filteredRows, selectedVehicleId],
  );

  const selectedRow = allRows.find((r) => r.vehicleId === selectedVehicleId) ?? null;

  return (
    <div className="space-y-4">
      <StatusSummaryCards counts={counts} />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by plate or model"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="gps-live-map-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-40" data-testid="gps-live-map-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="moving">Moving</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh live positions">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-[360px] shrink-0 order-2 lg:order-1">
          <ScrollArea className="h-[360px] lg:h-[520px] pr-2">
            <div className="space-y-2">
              {isLoading && <div className="text-sm text-muted-foreground p-4">Loading fleet positions…</div>}
              {!isLoading && notYetAvailable && (
                <div className="text-sm text-muted-foreground p-4 border rounded-md">
                  Live position data isn't available in this environment yet — the
                  <code className="mx-1 px-1 rounded bg-muted">/api/gps/vehicles/latest-states</code>
                  endpoint this view needs is proposed but not yet deployed. See the task report.
                </div>
              )}
              {!isLoading && !notYetAvailable && filteredRows.length === 0 && (
                <div className="text-sm text-muted-foreground p-4 border rounded-md">
                  No GPS-tracked vehicles match this filter.
                </div>
              )}
              {filteredRows.map((row) => (
                <VehicleStatusCard
                  key={row.vehicleId}
                  row={row}
                  capabilities={getProviderCapabilities(connectionByProvider.get(row.connectionId) ?? row.providerKey)}
                  selected={row.vehicleId === selectedVehicleId}
                  onSelect={() => setSelectedVehicleId(row.vehicleId)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 min-w-0 order-1 lg:order-2 h-[360px] lg:h-[520px] rounded-lg overflow-hidden border">
          <FleetMap
            markers={markers}
            selectedMarkerId={selectedVehicleId ? markers.find((m) => allRows.find((r) => r.vehicleId === selectedVehicleId)?.gpsDeviceId === m.id)?.id : null}
            onMarkerSelect={(gpsDeviceId) => {
              const row = allRows.find((r) => r.gpsDeviceId === gpsDeviceId);
              if (row) setSelectedVehicleId(row.vehicleId);
            }}
            fitToContent
            className="w-full h-full"
            emptyState={
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/30">
                <Satellite className={`h-8 w-8 ${isLoading ? 'animate-pulse' : ''}`} />
                <p className="text-sm max-w-xs text-center">
                  {isLoading
                    ? 'Loading fleet positions…'
                    : notYetAvailable
                      ? 'Live map data endpoint is not deployed in this environment yet.'
                      : 'No vehicles with live GPS telemetry to show yet.'}
                </p>
              </div>
            }
          />
        </div>
      </div>

      {selectedRow && (
        <VehicleDetailDialog
          row={selectedRow}
          capabilities={getProviderCapabilities(connectionByProvider.get(selectedRow.connectionId) ?? selectedRow.providerKey)}
          open={Boolean(selectedRow)}
          onOpenChange={(open) => !open && setSelectedVehicleId(null)}
        />
      )}
    </div>
  );
}
