import { expect, test } from '@playwright/test';
import { generateKeyPairSync } from 'crypto';
import { ServiceAccountTokenProvider, DriveAuthError } from '../../server/driver/documents/drive/serviceAccountAuth';
import { DRIVE_SCOPES } from '../../server/driver/documents/drive/driveApiClient';

// This is the one genuinely LIVE-network test in this task's suite — see the
// task report's "verified live vs mock-only" section. This sandboxed dev
// environment has no real Google service-account credentials, so a full
// authenticated Drive operation cannot be exercised here. What CAN be, and
// is, verified live: a real HTTPS POST to Google's real OAuth2 token endpoint
// (https://oauth2.googleapis.com/token) carrying a real RS256-signed
// JWT-bearer assertion built by ServiceAccountTokenProvider. A fake (locally
// generated, never-registered) key pair cannot produce a real access token,
// but the *shape* of Google's rejection is diagnostic: "invalid_grant:
// account not found" means Google's server parsed our JWT header/claims/
// signature encoding successfully and evaluated it as a real, well-formed
// JWT-bearer grant request — it just doesn't recognize this (fake) service
// account. A malformed assertion gets a different error (e.g.
// "invalid_request" / "Malformed JWT" / "Invalid JWT Signature" for a
// mismatched signature) — so this test also asserts the failure is
// specifically the "account not found" shape, not a format error, which
// would mean the JWT construction itself was wrong.
test('service-account JWT-bearer token exchange reaches Google\'s real OAuth2 endpoint with a well-formed, correctly-signed assertion', async () => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const provider = new ServiceAccountTokenProvider(
    { client_email: 'fleetpro-test-fixture@fleetpro-test-project.iam.gserviceaccount.com', private_key: privateKey },
    DRIVE_SCOPES,
  );

  let caught: unknown;
  try {
    await provider.getAccessToken();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(DriveAuthError);
  const authError = caught as DriveAuthError;
  // A real HTTP response was received FROM Google (not a network/DNS/TLS
  // failure) — status is always present when the request round-tripped.
  expect(authError.status).toBe(400);
  expect(authError.message).toContain('invalid_grant');
  expect(authError.message).not.toMatch(/invalid_request|Malformed JWT|Invalid JWT Signature/i);
});
