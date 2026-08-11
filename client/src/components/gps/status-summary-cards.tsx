import { Card, CardContent } from '@/components/ui/card';
import { Navigation, ParkingCircle, WifiOff, Car } from 'lucide-react';
import type { MovingStatus } from './types';

export interface StatusCounts {
  moving: number;
  stopped: number;
  offline: number;
}

const TILES: Array<{ key: MovingStatus | 'total'; label: string; icon: typeof Navigation; accent: string }> = [
  { key: 'total', label: 'Tracked vehicles', icon: Car, accent: 'text-foreground' },
  { key: 'moving', label: 'Moving', icon: Navigation, accent: 'text-green-600 dark:text-green-400' },
  { key: 'stopped', label: 'Stopped', icon: ParkingCircle, accent: 'text-amber-600 dark:text-amber-400' },
  { key: 'offline', label: 'Offline', icon: WifiOff, accent: 'text-gray-500 dark:text-gray-400' },
];

/** Moving/stopped/offline summary tiles. Counts are derived entirely from
 * whatever `VehicleLiveStateRow[]` the caller already fetched from real
 * telemetry — this component never queries anything itself, so it cannot
 * independently drift from "only vehicles with actual stored telemetry". */
export function StatusSummaryCards({ counts }: { counts: StatusCounts }) {
  const total = counts.moving + counts.stopped + counts.offline;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="gps-status-summary">
      {TILES.map((tile) => {
        const value = tile.key === 'total' ? total : counts[tile.key];
        const Icon = tile.icon;
        return (
          <Card key={tile.key}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 shrink-0 ${tile.accent}`} />
              <div className="min-w-0">
                <div className={`text-xl font-semibold leading-tight ${tile.accent}`}>{value}</div>
                <div className="text-xs text-muted-foreground truncate">{tile.label}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
