import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Route } from 'lucide-react';
import { usePositionHistory } from './api';
import { FleetMap, type FleetMapMarker } from './fleet-map';
import type { GpsProviderCapabilities } from './types';

function isoDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Route replay for a single vehicle over a chosen date range, backed by
 * TASK-GPS-INGESTION-04's `getPositionHistoryByRange` (via the proposed
 * `/api/gps/devices/:gpsDeviceId/position-history` route — see api.ts). The
 * scrubber only ever moves across points this call actually returned; it
 * never interpolates or invents a position between two real fixes. */
export function RouteReplayPanel({ gpsDeviceId, capabilities }: { gpsDeviceId: string; capabilities: GpsProviderCapabilities }) {
  const today = useMemo(() => new Date(), []);
  const weekAgo = useMemo(() => new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), [today]);
  const [startDate, setStartDate] = useState(isoDateInputValue(weekAgo));
  const [endDate, setEndDate] = useState(isoDateInputValue(today));
  const [scrubIndex, setScrubIndex] = useState(0);

  const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;

  const { data: points, isLoading, notYetAvailable, isError } = usePositionHistory({ gpsDeviceId, start, end });

  const route = points ?? [];
  const clampedIndex = Math.min(scrubIndex, Math.max(route.length - 1, 0));
  const current = route[clampedIndex];

  const markers: FleetMapMarker[] = current
    ? [{ id: gpsDeviceId, latitude: current.latitude, longitude: current.longitude, headingDegrees: current.headingDegrees, status: current.movingStatus, label: 'Selected point', selected: true }]
    : [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="gps-replay-start">Start date</Label>
          <Input id="gps-replay-start" type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="gps-replay-end">End date</Label>
          <Input id="gps-replay-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="h-[280px] rounded-lg overflow-hidden border">
        <FleetMap
          markers={markers}
          route={route}
          fitToContent
          className="w-full h-full"
          emptyState={
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/30 p-4 text-center">
              <Route className="h-8 w-8" />
              <p className="text-sm max-w-xs">
                {notYetAvailable
                  ? "Route replay endpoint isn't deployed in this environment yet."
                  : isLoading
                    ? 'Loading route…'
                    : isError
                      ? 'Could not load route history for this range.'
                      : 'No stored positions in this date range.'}
              </p>
            </div>
          }
        />
      </div>

      {route.length > 1 && (
        <div className="space-y-2">
          <Slider
            min={0}
            max={route.length - 1}
            step={1}
            value={[clampedIndex]}
            onValueChange={([v]) => setScrubIndex(v)}
            data-testid="gps-route-replay-scrubber"
          />
          <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-x-4">
            <span>{new Date(current.recordedAt).toLocaleString()}</span>
            {typeof current.speedKph === 'number' && <span>{Math.round(current.speedKph)} km/h</span>}
            {capabilities.hasIgnition && typeof current.ignition === 'boolean' && (
              <span>Ignition {current.ignition ? 'on' : 'off'}</span>
            )}
            <span>{clampedIndex + 1} / {route.length} points</span>
          </div>
        </div>
      )}
    </div>
  );
}
