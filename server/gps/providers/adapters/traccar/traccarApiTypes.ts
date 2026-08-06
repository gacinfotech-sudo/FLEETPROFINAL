// Raw Traccar REST API response shapes.
//
// Every field below is transcribed from the OpenAPI 3.1.0 spec cited in
// docs/gps-research/GPS-PROVIDER-RESEARCH.md §1 (info.version 6.14.5,
// https://raw.githubusercontent.com/traccar/traccar/master/openapi.yaml,
// linked as canonical from https://www.traccar.org/traccar-api/). Nothing
// here is guessed: a field is only declared if the research doc names it.
// `attributes` on Device/Position is intentionally untyped beyond the
// documented keys (GPS-PROVIDER-RESEARCH.md §1 "Ignition / odometer") because
// the research doc is explicit that "every attribute is optional" and
// device-dependent.

/**
 * Traccar `Device` object — GPS-PROVIDER-RESEARCH.md §1 "Listing
 * devices/vehicles". `status` is documented as tri-state
 * (online/offline/unknown), not binary.
 */
export interface TraccarDevice {
  id: number;
  name?: string;
  uniqueId: string;
  status?: 'online' | 'offline' | 'unknown';
  disabled?: boolean;
  lastUpdate?: string;
  positionId?: number;
  groupId?: number;
  phone?: string;
  model?: string;
  contact?: string;
  category?: string;
  attributes?: Record<string, unknown>;
}

/**
 * `GET /devices/{id}/accumulators` — GPS-PROVIDER-RESEARCH.md §1 "Listing
 * devices/vehicles". `totalDistance` is meters, `hours` is total engine
 * hours (the research doc does not restate the unit here, but
 * GPS-DATA-SOURCE-MATRIX.md §4 documents the sibling `attributes.hours`
 * field as milliseconds per Traccar's Position.java source comment; we
 * apply the same ms-based conversion defensively — see normalize.ts).
 */
export interface TraccarDeviceAccumulators {
  deviceId: number;
  totalDistance?: number;
  hours?: number;
}

/**
 * Canonical `attributes` keys documented in GPS-PROVIDER-RESEARCH.md §1
 * "Ignition / odometer — inside attributes, not typed fields". Every key is
 * optional — presence depends on what the physical device reports.
 */
export interface TraccarPositionAttributes {
  ignition?: boolean;
  motion?: boolean;
  odometer?: number;
  totalDistance?: number;
  tripOdometer?: number;
  obdOdometer?: number;
  /** Milliseconds, per Traccar's Position.java source comment (not seconds). */
  hours?: number;
  obdSpeed?: number;
  fuelLevel?: number;
  batteryLevel?: number;
  rpm?: number;
  vin?: string;
  driverUniqueId?: string;
  [key: string]: unknown;
}

/**
 * Traccar `Position` object — GPS-PROVIDER-RESEARCH.md §1 "Current
 * position". `speed` is in knots. `fixTime`/`deviceTime`/`serverTime` are
 * three distinct timestamps (§6); `fixTime` is treated as canonical per the
 * research doc's recommendation.
 */
export interface TraccarPosition {
  id: number;
  deviceId: number;
  protocol?: string;
  deviceTime?: string;
  fixTime: string;
  serverTime?: string;
  valid?: boolean;
  latitude: number;
  longitude: number;
  altitude?: number;
  /** Knots — convert with KNOTS_TO_KMH before exposing on NormalizedTelemetryPoint. */
  speed?: number;
  /** Heading, 0-360 degrees, 0 = true north. */
  course?: number;
  address?: string;
  accuracy?: number;
  geofenceIds?: number[];
  attributes?: TraccarPositionAttributes;
}

/**
 * `GET /reports/trips` per-trip row — GPS-PROVIDER-RESEARCH.md §1
 * "Historical positions & reports". No trip identifier field is documented
 * (unlike Position.id) — see traccarAdapter.ts's getTripHistory for how this
 * is handled without inventing one.
 */
export interface TraccarTripReportRow {
  deviceId?: number;
  distance?: number;
  duration?: number;
  maxSpeed?: number;
  averageSpeed?: number;
  startTime: string;
  endTime: string;
  startAddress?: string;
  endAddress?: string;
  startLat?: number;
  startLon?: number;
  endLat?: number;
  endLon?: number;
  driverUniqueId?: string;
  driverName?: string;
  spentFuel?: number;
}
