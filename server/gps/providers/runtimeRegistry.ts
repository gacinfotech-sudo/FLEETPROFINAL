import { DefaultGpsProviderRegistry } from './registry';
import { resolveGpsProviderConnection } from '../services/connectionService';
import { TRACCAR_PROVIDER_KEY, createTraccarAdapter } from './adapters/traccar';

// Real provider factories are registered here only after their official API
// documentation has been supplied and mapped. An empty registry deliberately
// produces Configuration Required instead of a fake successful connection.
export const gpsProviderRegistry = new DefaultGpsProviderRegistry(resolveGpsProviderConnection);

// Traccar — TASK-GPS-CONNECTION-02. Implemented against the documented REST
// API cited in docs/gps-research/GPS-PROVIDER-RESEARCH.md §1 (Traccar
// OpenAPI 3.1.0 spec, info.version 6.14.5). See
// server/gps/providers/adapters/traccar/traccarAdapter.ts for the endpoint
// map and this task's report for what was implemented vs. deferred.
gpsProviderRegistry.register(TRACCAR_PROVIDER_KEY, createTraccarAdapter);
