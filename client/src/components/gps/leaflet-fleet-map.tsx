// Concrete Leaflet implementation of the FleetMap contract (map-adapter.ts).
// Nothing outside this file (and its barrel re-export in fleet-map.tsx)
// should import 'leaflet' or 'react-leaflet' directly.
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MOVING_STATUS_COLOR, type FleetMapProps } from './map-adapter';

// Leaflet's default marker icon URLs are relative to the CSS file location,
// which breaks under Vite's bundling. Building a small colored div-icon per
// status avoids that class of bug entirely and doubles as the moving/
// stopped/offline visual encoding requested by the task.
function statusIcon(color: string, selected: boolean, headingDegrees?: number) {
  const size = selected ? 22 : 16;
  const rotation = typeof headingDegrees === 'number' ? headingDegrees : 0;
  return L.divIcon({
    className: 'gps-fleet-marker',
    html: `<span style="
      display:block;
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      background:${color};
      border:2px solid white;
      box-shadow:0 0 0 1px rgba(0,0,0,0.25);
      transform:rotate(${rotation}deg);
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitToContent({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 15 });
  }, [map, points]);
  return null;
}

const DEFAULT_CENTER: [number, number] = [22.7196, 75.8577]; // Indore — this tenant base's existing test-data default
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function LeafletFleetMap({
  markers,
  route,
  selectedMarkerId,
  onMarkerSelect,
  fitToContent = true,
  className,
  emptyState,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasContent = markers.length > 0 || (route && route.length > 0);

  const fitPoints = useMemo<Array<[number, number]>>(() => {
    const markerPoints = markers.map((m) => [m.latitude, m.longitude] as [number, number]);
    const routePoints = (route ?? []).map((p) => [p.latitude, p.longitude] as [number, number]);
    return [...markerPoints, ...routePoints];
  }, [markers, route]);

  const routeLatLngs = useMemo<Array<[number, number]>>(
    () => (route ?? []).map((p) => [p.latitude, p.longitude]),
    [route],
  );

  if (!hasContent && emptyState) {
    return (
      <div className={className} data-testid="gps-fleet-map-empty" ref={containerRef}>
        {emptyState}
      </div>
    );
  }

  return (
    <div className={className} data-testid="gps-fleet-map" ref={containerRef}>
      <MapContainer
        center={fitPoints[0] ?? DEFAULT_CENTER}
        zoom={fitPoints[0] ? 13 : 5}
        scrollWheelZoom
        style={{ width: '100%', height: '100%', minHeight: 0 }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {fitToContent && fitPoints.length > 0 && <FitToContent points={fitPoints} />}
        {routeLatLngs.length > 1 && (
          <Polyline positions={routeLatLngs} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }} />
        )}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.latitude, marker.longitude]}
            icon={statusIcon(MOVING_STATUS_COLOR[marker.status], Boolean(marker.selected || marker.id === selectedMarkerId), marker.headingDegrees)}
            eventHandlers={onMarkerSelect ? { click: () => onMarkerSelect(marker.id) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -10]}>{marker.label}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
