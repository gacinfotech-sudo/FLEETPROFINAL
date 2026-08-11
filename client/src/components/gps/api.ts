// TASK-GPS-FLEET-UI-05's client-side data layer for every GPS screen.
//
// Split into two groups:
//   1. EXISTING routes (phases 1-4 + TASK-GPS-CONNECTION-02) — used directly.
//   2. PROPOSED routes — this UI's acceptance criteria (a Live Map driven by
//      real stored telemetry, route replay over a date range) need reads that
//      TASK-GPS-INGESTION-04 deliberately left as internal server functions
//      only (`server/gps/telemetry/queries.ts`), not HTTP routes — see that
//      task's report: "If either downstream task's own report proposes
//      routes on top of these functions, that is their call to make." This
//      is that call. Each proposed fetcher below is written to call the
//      route it needs; until a backend task adds that route, the call 404s
//      and the corresponding hook surfaces `notYetAvailable: true` instead of
//      throwing or fabricating data, so the UI degrades to an honest empty
//      state rather than a broken one. The exact proposed route + handler
//      shape for each is documented in the task report.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type {
  CreateGpsConnectionInput,
  FleetVehicle,
  GpsConnection,
  GpsConnectionCredentialsInput,
  GpsConnectionSyncHealth,
  GpsDevice,
  StoredTelemetryPoint,
  VehicleGpsAssignment,
  VehicleLiveStateRow,
} from './types';

/** Thrown by getJson() when a proposed-but-not-yet-registered route is
 * called. This app's Express server (server/vite.ts's dev middleware, and
 * the equivalent static-file fallback in production) serves the SPA's
 * `index.html` — status 200, `content-type: text/html` — for *any* request
 * path it hasn't registered a handler for, including under `/api/`. A
 * missing proposed route therefore never actually 404s; it silently
 * "succeeds" with an HTML body that isn't valid JSON. Checking
 * `content-type` before parsing is what distinguishes that case (route not
 * registered) from a genuine JSON 404 (e.g. "device not found", which a
 * real handler returns deliberately) or a real server error. */
class GpsRouteNotRegisteredError extends Error {
  constructor(url: string) {
    super(`GPS route not registered in this environment: ${url}`);
    this.name = 'GpsRouteNotRegisteredError';
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await apiRequest('GET', url);
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new GpsRouteNotRegisteredError(url);
  }
  return (await res.json()) as T;
}

/** True for a route that genuinely isn't registered yet — either a real
 * JSON 404 or this app's HTML-SPA-fallback "200 but not JSON" case (see
 * GpsRouteNotRegisteredError above). Never swallows a real server error
 * (500) or an auth failure (401/403), which apiRequest() throws before
 * getJson() ever reaches the content-type check. */
function isRouteNotFound(error: unknown): boolean {
  return error instanceof GpsRouteNotRegisteredError || (error instanceof Error && /^404:/.test(error.message));
}

// ---------------------------------------------------------------------------
// EXISTING: GPS connections (server/gps/routes/connections.ts)
// ---------------------------------------------------------------------------

export function useGpsConnections() {
  return useQuery({
    queryKey: ['/api/gps/connections'],
    queryFn: () => getJson<GpsConnection[]>('/api/gps/connections'),
  });
}

export function useGpsConnectionLogs(connectionId: string | null) {
  return useQuery({
    queryKey: ['/api/gps/connections', connectionId, 'logs'],
    queryFn: () => getJson<Array<{ id: string; action: string; createdAt: string; reason?: string }>>(`/api/gps/connections/${connectionId}/logs`),
    enabled: Boolean(connectionId),
  });
}

export function useCreateGpsConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGpsConnectionInput) => {
      const res = await apiRequest('POST', '/api/gps/connections', input);
      return (await res.json()) as GpsConnection;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/gps/connections'] }),
  });
}

export function useUpdateGpsConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ connectionId, input }: { connectionId: string; input: Partial<CreateGpsConnectionInput> }) => {
      const res = await apiRequest('PATCH', `/api/gps/connections/${connectionId}`, input);
      return (await res.json()) as GpsConnection;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/gps/connections'] }),
  });
}

export function useRotateGpsCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ connectionId, credentials, reason }: { connectionId: string; credentials: GpsConnectionCredentialsInput; reason: string }) => {
      const res = await apiRequest('POST', `/api/gps/connections/${connectionId}/rotate-credentials`, { credentials, reason });
      return (await res.json()) as GpsConnection;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/gps/connections'] }),
  });
}

export interface TestConnectionResult {
  success: boolean;
  status: string;
  checkedAt: string;
  latencyMs?: number;
  message?: string;
}

export function useTestGpsConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest('POST', `/api/gps/connections/${connectionId}/test`);
      return (await res.json()) as TestConnectionResult;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/gps/connections'] }),
  });
}

export function useSyncGpsDevices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest('POST', `/api/gps/connections/${connectionId}/sync-devices`);
      return (await res.json()) as { received: number; created: number; updated: number; rejected: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gps/connections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gps/devices'] });
    },
  });
}

// ---------------------------------------------------------------------------
// EXISTING: GPS devices (server/gps/routes/devices.ts)
// ---------------------------------------------------------------------------

export function useGpsDevices(params?: { connectionId?: string; search?: string }) {
  const search = new URLSearchParams();
  if (params?.connectionId) search.set('connectionId', params.connectionId);
  if (params?.search) search.set('search', params.search);
  const qs = search.toString();
  return useQuery({
    queryKey: ['/api/gps/devices', params?.connectionId ?? null, params?.search ?? null],
    queryFn: () => getJson<GpsDevice[]>(`/api/gps/devices${qs ? `?${qs}` : ''}`),
  });
}

// ---------------------------------------------------------------------------
// EXISTING: fleet vehicles (server/routes.ts) + vehicle<->GPS assignment
// (server/gps/routes/assignments.ts)
// ---------------------------------------------------------------------------

export function useFleetVehicles() {
  return useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: () => getJson<FleetVehicle[]>('/api/vehicles'),
  });
}

export function useVehicleGpsAssignment(vehicleId: string | null) {
  return useQuery({
    queryKey: ['/api/vehicles', vehicleId, 'gps-assignment'],
    queryFn: () => getJson<{ assignment: VehicleGpsAssignment | null }>(`/api/vehicles/${vehicleId}/gps-assignment`),
    enabled: Boolean(vehicleId),
  });
}

export function useAssignGpsDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vehicleId, gpsDeviceId, reason }: { vehicleId: string; gpsDeviceId: string; reason?: string }) => {
      const res = await apiRequest('POST', `/api/vehicles/${vehicleId}/gps-assignment`, { gpsDeviceId, reason });
      return (await res.json()) as { assignment: VehicleGpsAssignment };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles', variables.vehicleId, 'gps-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gps/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gps/vehicles/latest-states'] });
    },
  });
}

export function useUnassignGpsDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vehicleId, reason }: { vehicleId: string; reason: string }) => {
      const res = await apiRequest('DELETE', `/api/vehicles/${vehicleId}/gps-assignment`, { reason });
      return (await res.json()) as { assignment: VehicleGpsAssignment | null };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles', variables.vehicleId, 'gps-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gps/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gps/vehicles/latest-states'] });
    },
  });
}

// ---------------------------------------------------------------------------
// PROPOSED (not yet registered server-side — see report):
// GET /api/gps/vehicles/latest-states
//
// Wraps TASK-GPS-INGESTION-04's `getLatestVehicleStates({ tenantId })`
// joined against active `VehicleGpsAssignment` + `Vehicle` + `GpsConnection.
// providerKey`, tenant-scoped from the session exactly like every other GPS
// route. Proposed so the Live Map does not need one request per vehicle
// (N+1) to learn "which vehicles are GPS-tracked and where are they now."
// ---------------------------------------------------------------------------

export function useLatestVehicleStates(options?: { refetchIntervalMs?: number }) {
  const query = useQuery({
    queryKey: ['/api/gps/vehicles/latest-states'],
    queryFn: () => getJson<VehicleLiveStateRow[]>('/api/gps/vehicles/latest-states'),
    retry: false,
    refetchInterval: options?.refetchIntervalMs ?? 30_000,
  });
  return {
    ...query,
    // Distinguish "backend route for this doesn't exist yet in this
    // environment" from "loaded, zero tracked vehicles" — the Live Map
    // renders a different, honest empty state for each rather than
    // conflating "no data" with "no route".
    notYetAvailable: isRouteNotFound(query.error),
  };
}

// ---------------------------------------------------------------------------
// PROPOSED: GET /api/gps/devices/:gpsDeviceId/position-history?start=&end=
//
// Wraps TASK-GPS-INGESTION-04's `getPositionHistoryByRange({ tenantId,
// gpsDeviceId, startDateTime, endDateTime })`, with the device-ownership
// check the existing `/api/gps/devices/:deviceId` route already performs
// (tenant-scoped lookup, 404 if not owned).
// ---------------------------------------------------------------------------

export function usePositionHistory(params: { gpsDeviceId: string | null; start: Date | null; end: Date | null }) {
  const enabled = Boolean(params.gpsDeviceId && params.start && params.end);
  const query = useQuery({
    queryKey: ['/api/gps/devices', params.gpsDeviceId, 'position-history', params.start?.toISOString(), params.end?.toISOString()],
    queryFn: () => {
      const search = new URLSearchParams({
        start: params.start!.toISOString(),
        end: params.end!.toISOString(),
      });
      return getJson<StoredTelemetryPoint[]>(`/api/gps/devices/${params.gpsDeviceId}/position-history?${search.toString()}`);
    },
    enabled,
    retry: false,
  });
  return { ...query, notYetAvailable: isRouteNotFound(query.error) };
}

// ---------------------------------------------------------------------------
// PROPOSED: GET /api/gps/connections/:connectionId/sync-health
//
// Wraps TASK-GPS-INGESTION-04's `getConnectionSyncHealth(tenantId,
// connectionId)` (server/gps/ingestion/syncHealth.ts) — surfaces poller
// health (that task's report explicitly left this for "the Integrator or
// TASK-GPS-FLEET-UI-05 to wire up").
// ---------------------------------------------------------------------------

export function useConnectionSyncHealth(connectionId: string | null) {
  const query = useQuery({
    queryKey: ['/api/gps/connections', connectionId, 'sync-health'],
    queryFn: () => getJson<GpsConnectionSyncHealth>(`/api/gps/connections/${connectionId}/sync-health`),
    enabled: Boolean(connectionId),
    retry: false,
  });
  return { ...query, notYetAvailable: isRouteNotFound(query.error) };
}
