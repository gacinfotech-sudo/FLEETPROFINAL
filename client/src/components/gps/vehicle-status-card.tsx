import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Gauge, Compass, Power, PowerOff, HelpCircle } from 'lucide-react';
import type { GpsProviderCapabilities, MovingStatus, VehicleLiveStateRow } from './types';

const STATUS_LABEL: Record<MovingStatus, string> = {
  moving: 'Moving',
  stopped: 'Stopped',
  offline: 'Offline',
};

const STATUS_BADGE_CLASS: Record<MovingStatus, string> = {
  moving: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
  stopped: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  offline: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800',
};

function VehicleLabel({ row }: { row: VehicleLiveStateRow }) {
  return (
    <div className="min-w-0">
      <div className="font-medium truncate">{row.licensePlate || `${row.make} ${row.vehicleModel ?? ''}`.trim()}</div>
      <div className="text-xs text-muted-foreground truncate">{row.make} {row.vehicleModel}</div>
    </div>
  );
}

/** One vehicle's live status card — moving/stopped/offline, last
 * communication time, speed/heading, and ignition (only when the active
 * connection's provider capability flags confirm the provider reports it;
 * `capabilities.hasIgnition === false` renders nothing for that field
 * rather than a fabricated on/off value, per GPS-DATA-SOURCE-MATRIX.md). */
export function VehicleStatusCard({
  row,
  capabilities,
  selected,
  onSelect,
}: {
  row: VehicleLiveStateRow;
  capabilities: GpsProviderCapabilities;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const state = row.state;
  const status: MovingStatus = state?.movingStatus ?? 'offline';

  return (
    <Card
      className={`cursor-pointer transition-colors ${selected ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}
      onClick={onSelect}
      data-testid={`gps-vehicle-card-${row.vehicleId}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <VehicleLabel row={row} />
          <Badge variant="outline" className={STATUS_BADGE_CLASS[status]}>{STATUS_LABEL[status]}</Badge>
        </div>

        {!state ? (
          <div className="text-xs text-muted-foreground">No telemetry received yet for this device.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span title={new Date(state.recordedAt).toLocaleString()}>
              Last update {formatDistanceToNow(new Date(state.recordedAt), { addSuffix: true })}
            </span>
            {typeof state.speedKph === 'number' && (
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5" /> {Math.round(state.speedKph)} km/h
              </span>
            )}
            {typeof state.headingDegrees === 'number' && (
              <span className="inline-flex items-center gap-1">
                <Compass className="h-3.5 w-3.5" style={{ transform: `rotate(${state.headingDegrees}deg)` }} />
                {Math.round(state.headingDegrees)}&deg;
              </span>
            )}
            {capabilities.hasIgnition && typeof state.ignition === 'boolean' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1">
                    {state.ignition ? <Power className="h-3.5 w-3.5 text-green-600" /> : <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    Ignition {state.ignition ? 'on' : 'off'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Reported by this provider connection</TooltipContent>
              </Tooltip>
            )}
            {!capabilities.hasIgnition && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 opacity-60">
                    <HelpCircle className="h-3.5 w-3.5" /> Ignition n/a
                  </span>
                </TooltipTrigger>
                <TooltipContent>This provider connection does not report ignition state</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
