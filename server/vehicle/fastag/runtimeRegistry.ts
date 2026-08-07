import { DefaultFastagProviderRegistry } from './providers/registry';
import { decryptFastagCredentials } from './security/credentialEncryption';
import { FastagConnection } from './models/fastagConnection';
import type { FastagConnectionConfig } from './types';

async function resolveFastagConnection(tenantId: string, connectionId: string): Promise<FastagConnectionConfig | null> {
  const connection = await FastagConnection.findOne({ _id: connectionId, tenantId }).select('+encryptedSecrets').lean();
  if (!connection) return null;
  return {
    id: String(connection._id),
    tenantId: String(connection.tenantId),
    connectionName: connection.connectionName,
    providerKey: connection.providerKey,
    enabled: connection.enabled,
    secrets: connection.encryptedSecrets
      ? decryptFastagCredentials(connection.encryptedSecrets, tenantId, String(connection._id))
      : {},
  };
}

// Real provider factories are registered here only after their official API
// documentation has been supplied and mapped — mirrors
// server/gps/providers/runtimeRegistry.ts's exact "empty by default"
// reasoning. This task ships zero real provider registrations (the mock
// provider in providers/mockProvider.ts is for tests/local dev only and is
// never registered here).
export const fastagProviderRegistry = new DefaultFastagProviderRegistry(resolveFastagConnection);
