// Barrel for the map adapter abstraction. Every other component in this
// feature imports `FleetMap` from here, never from `leaflet-fleet-map.tsx`
// or `react-leaflet` directly — swapping the underlying map library later
// (see the task report for the Leaflet-vs-MapLibre tradeoff this repo
// picked) means changing this one file's re-export target plus writing the
// new implementation, nothing else.
export { LeafletFleetMap as FleetMap } from './leaflet-fleet-map';
export type { FleetMapMarker, FleetMapProps, FleetMapRoutePoint } from './map-adapter';
export { MOVING_STATUS_COLOR } from './map-adapter';
