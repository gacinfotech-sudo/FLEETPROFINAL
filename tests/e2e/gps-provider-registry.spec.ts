import { expect, test } from '@playwright/test';
import type { GpsProviderAdapter } from '../../server/gps/providers/adapter';
import {
  DefaultGpsProviderRegistry,
  GpsConnectionNotFoundError,
  GpsProviderConfigurationError,
} from '../../server/gps/providers/registry';
import type { GpsProviderConnectionConfig } from '../../server/gps/types';

const connection: GpsProviderConnectionConfig = {
  id: 'connection-a',
  tenantId: 'tenant-a',
  connectionName: 'Official provider test',
  providerKey: 'documented_provider',
  authenticationType: 'bearer_token',
  enabled: true,
  status: 'configuration_required',
  secrets: { apiToken: 'server-only-token' },
};

test('GPS registry refuses cross-tenant connection resolution', async () => {
  const registry = new DefaultGpsProviderRegistry(async () => connection);

  await expect(registry.getAdapter('tenant-b', connection.id)).rejects.toBeInstanceOf(
    GpsConnectionNotFoundError,
  );
});

test('GPS registry keeps an undocumented provider in configuration-required state', async () => {
  const registry = new DefaultGpsProviderRegistry(async (tenantId, connectionId) =>
    tenantId === connection.tenantId && connectionId === connection.id ? connection : null,
  );

  await expect(registry.getAdapter(connection.tenantId, connection.id)).rejects.toBeInstanceOf(
    GpsProviderConfigurationError,
  );
});

test('GPS registry resolves a registered adapter without exposing it globally', async () => {
  const registry = new DefaultGpsProviderRegistry(async () => connection);
  const adapter = { providerKey: connection.providerKey } as GpsProviderAdapter;
  let receivedConnection: Readonly<GpsProviderConnectionConfig> | undefined;
  registry.register(connection.providerKey, (resolved) => {
    receivedConnection = resolved;
    return adapter;
  });

  await expect(registry.getAdapter(connection.tenantId, connection.id)).resolves.toBe(adapter);
  expect(receivedConnection?.secrets.apiToken).toBe('server-only-token');
  expect(Object.isFrozen(receivedConnection)).toBe(true);
  expect(Object.isFrozen(receivedConnection?.secrets)).toBe(true);
});
