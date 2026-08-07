// Minimal, dependency-free Google service-account (JWT-bearer) OAuth2 client.
//
// Design note (see task report for full rationale): this repo has no `googleapis`
// or `google-auth-library` dependency, and adding one requires a package.json +
// package-lock.json change — both are Integrator-only shared/protected files per
// .claude/rules/parallel-dispatch.md, and this worktree's node_modules is a
// symlink shared with the main checkout and several other concurrently-running
// worktrees, so an `npm install` here would mutate a directory other workers'
// `tsc`/tests depend on mid-run. Rather than risk that, this implements the
// documented Google OAuth2 service-account flow (RFC 7523 JWT-bearer grant)
// directly against Node's built-in `crypto` + global `fetch` (Node 24 here).
// This is a real client against Google's documented token endpoint contract, not
// a simplification of it — see https://developers.google.com/identity/protocols/oauth2/service-account.
import { sign } from 'crypto';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  // Present on real downloaded keys; not required for signing.
  project_id?: string;
  token_uri?: string;
}

export class DriveAuthError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'DriveAuthError';
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input as any).toString('base64url');
}

/** Caches the access token in memory only, per adapter instance — never persisted,
 * never logged. Refreshes 60s before real expiry to avoid races against a stale
 * token being used for an in-flight request. */
export class ServiceAccountTokenProvider {
  private cached?: { accessToken: string; expiresAt: number };

  constructor(private readonly key: ServiceAccountKey, private readonly scopes: string[]) {
    if (!key.client_email || !key.private_key) {
      throw new DriveAuthError('Service account key is missing client_email/private_key.');
    }
  }

  async getAccessToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now() + 60_000) {
      return this.cached.accessToken;
    }
    const assertion = this.buildSignedJwt();
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!response.ok) {
      // Never include the assertion/key material in the error — only Google's
      // own (non-secret) error body.
      const body = await response.text().catch(() => '');
      throw new DriveAuthError(`Service account token exchange failed (${response.status}): ${body.slice(0, 300)}`, response.status);
    }
    const data = await response.json() as { access_token: string; expires_in: number };
    this.cached = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return this.cached.accessToken;
  }

  private buildSignedJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claims = {
      iss: this.key.client_email,
      scope: this.scopes.join(' '),
      aud: this.key.token_uri || TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    };
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
    const signature = sign('RSA-SHA256', Buffer.from(signingInput), this.key.private_key);
    return `${signingInput}.${base64url(signature)}`;
  }
}

/** OAuth-consent (authorization-code) refresh-token exchange — supported by the
 * data model (TenantGoogleDriveConnection.authType === 'oauth_consent') but not
 * wired to an interactive consent UI in this pass; see the task report for why
 * the service-account path is the one actually recommended/exercised end to end. */
export class OAuthRefreshTokenProvider {
  private cached?: { accessToken: string; expiresAt: number };

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string,
  ) {}

  async getAccessToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now() + 60_000) {
      return this.cached.accessToken;
    }
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new DriveAuthError(`OAuth refresh-token exchange failed (${response.status}): ${body.slice(0, 300)}`, response.status);
    }
    const data = await response.json() as { access_token: string; expires_in: number };
    this.cached = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return this.cached.accessToken;
  }
}

export interface AccessTokenProvider {
  getAccessToken(): Promise<string>;
}
