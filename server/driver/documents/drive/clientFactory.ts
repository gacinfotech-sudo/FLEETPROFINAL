// Resolves a DriveClient for a tenant's connection. Kept as a single, small,
// overridable seam so integration tests can inject a stubbed DriveClient without
// real Google Drive credentials (this sandboxed dev environment has none — see
// the task report's "verified live vs mock-only" section). Production code never
// calls setDriveClientFactoryForTesting.
import { DriveClient, GoogleDriveRestClient, DRIVE_SCOPES } from './driveApiClient';
import { ServiceAccountTokenProvider, OAuthRefreshTokenProvider, type ServiceAccountKey } from './serviceAccountAuth';
import type { DecryptedDriveCredentials } from '../services/connectionService';

export type DriveClientFactory = (credentials: DecryptedDriveCredentials) => DriveClient;

function defaultFactory(credentials: DecryptedDriveCredentials): DriveClient {
  if (credentials.authType === 'service_account') {
    const key: ServiceAccountKey = credentials.serviceAccountKey;
    const tokenProvider = new ServiceAccountTokenProvider(key, DRIVE_SCOPES);
    return new GoogleDriveRestClient(tokenProvider);
  }
  const tokenProvider = new OAuthRefreshTokenProvider(
    credentials.clientId,
    credentials.clientSecret,
    credentials.refreshToken,
  );
  return new GoogleDriveRestClient(tokenProvider);
}

let activeFactory: DriveClientFactory = defaultFactory;

export function buildDriveClient(credentials: DecryptedDriveCredentials): DriveClient {
  return activeFactory(credentials);
}

/** Test-only seam — see module comment. Never called from production code paths. */
export function setDriveClientFactoryForTesting(factory: DriveClientFactory | null): void {
  activeFactory = factory ?? defaultFactory;
}
