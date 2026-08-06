import { DefaultGpsProviderRegistry } from './registry';
import { resolveGpsProviderConnection } from '../services/connectionService';

// Real provider factories are registered here only after their official API
// documentation has been supplied and mapped. An empty registry deliberately
// produces Configuration Required instead of a fake successful connection.
export const gpsProviderRegistry = new DefaultGpsProviderRegistry(resolveGpsProviderConnection);
