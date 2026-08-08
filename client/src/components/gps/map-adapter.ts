// Map-library-agnostic contract every GPS map surface (Live Map, route
// replay) renders against. No component outside this directory's map files
// should import a map library directly — they import `FleetMap` from
// `./fleet-map` (the barrel) and this file's types only. This is the "map
// adapter abstraction" the task asks for: swapping Leaflet for MapLibre (or
// anything else) later means changing `fleet-map.tsx`'s re-export and
// writing one new implementation file, not touching live-map-view.tsx,
// route-replay-panel.tsx, or any status-card component.
import type { ReactNode } from 'react';
import type { MovingStatus } from './types';

export interface FleetMapMarker {
  id: string; // gpsDeviceId — stable per-vehicle marker identity
  latitude: number;
  longitude: number;
  headingDegrees?: number;
  status: MovingStatus;
  label: string; // e.g. license plate, shown in a tooltip/popup
  selected?: boolean;
}

export interface FleetMapRoutePoint {
  latitude: number;
  longitude: number;
  recordedAt: string;
}

export interface FleetMapProps {
  /** Live vehicle positions. Every marker here MUST come from real stored
   * telemetry (a `VehicleLatestState` row) — never a placeholder or
   * synthesized coordinate. Per GPS-SECURITY-SPEC.md §5, no caller of this
   * component may pass a fabricated marker. */
  markers: FleetMapMarker[];
  /** Optional ordered route (route replay) rendered as a polyline. */
  route?: FleetMapRoutePoint[];
  selectedMarkerId?: string | null;
  onMarkerSelect?: (id: string) => void;
  /** Re-fit the viewport to the current marker/route set whenever it
   * changes size (new vehicle appears, filter narrows the set, etc). */
  fitToContent?: boolean;
  className?: string;
  /** Shown instead of the map body when there are zero markers and no
   * route — the caller decides the copy so it can say *why* (no GPS
   * connection configured vs. connected but zero live vehicles vs. backend
   * endpoint not available yet). */
  emptyState?: ReactNode;
}

export const MOVING_STATUS_COLOR: Record<MovingStatus, string> = {
  moving: '#16a34a', // green-600
  stopped: '#f59e0b', // amber-500
  offline: '#6b7280', // gray-500
};
