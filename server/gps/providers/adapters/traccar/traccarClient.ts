// Low-level HTTP client for Traccar's REST API.
//
// Endpoint paths, auth flows and query parameters are all cited from
// docs/gps-research/GPS-PROVIDER-RESEARCH.md §1:
//   - Base path `/api` (self-hosted default `http://<host>:8082/api`).
//   - Auth: `POST /session/token` (form-encoded, Basic-authenticated) mints a
//     Bearer token returned as text/plain; "Recommended for FleetPro: mint a
//     long-lived token once via POST /session/token (authenticated with
//     Basic), store it encrypted, use Bearer thereafter". `BasicAuth` is
//     also a globally usable security scheme, so username/password can be
//     sent directly on every request without minting a token.
//   - `GET /devices` supports `id` (repeatable), `uniqueId` (repeatable),
//     `limit`/`offset`, `all`, `userId`, `keyword`.
//   - `GET /devices/{id}/accumulators`.
//   - `GET /positions` (no params) → latest position per device;
//     `GET /positions?deviceId=&from=&to=` for one device's history.
//   - `GET /reports/trips` (`deviceId[]`/`groupId[]` + required `from`/`to`).
//
// Credential handling: per docs/gps-research/GPS-SECURITY-SPEC.md §2, no
// credential is ever logged. Errors thrown/rethrown from this module never
// interpolate the raw Authorization header, username, password or token —
// only the HTTP status code and a short, fixed, human-readable reason.

import type { GpsAuthenticationType } from '../../../types';
import { assertPublicTraccarUrl } from './traccarSsrfGuard';

export class TraccarAuthenticationFailedError extends Error {
  constructor() {
    super('Traccar authentication failed (401/403).');
    this.name = 'TraccarAuthenticationFailedError';
  }
}

export class TraccarRateLimitedError extends Error {
  readonly retryAfterSeconds?: number;
  constructor(retryAfterSeconds?: number) {
    super('Traccar rate limit exceeded (429).');
    this.name = 'TraccarRateLimitedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class TraccarProviderUnavailableError extends Error {
  constructor(reason: string) {
    super(`Traccar provider is unavailable: ${reason}`);
    this.name = 'TraccarProviderUnavailableError';
  }
}

export class TraccarNotFoundError extends Error {
  constructor(resource: string) {
    super(`Traccar ${resource} not found.`);
    this.name = 'TraccarNotFoundError';
  }
}

export class TraccarRequestError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Traccar request failed with status ${status}.`);
    this.name = 'TraccarRequestError';
    this.status = status;
  }
}

export interface TraccarClientSecrets {
  apiToken?: string;
  apiUsername?: string;
  apiPassword?: string;
}

export interface TraccarClientOptions {
  apiBaseUrl: string;
  authenticationType: GpsAuthenticationType;
  secrets: TraccarClientSecrets;
  timeoutMs?: number;
  /** Injectable for tests; defaults to the global fetch (Node 18+). */
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function normalizeApiBase(rawBaseUrl: string): URL {
  let base = rawBaseUrl.trim().replace(/\/+$/, '');
  // Traccar's documented base path is always `/api` (GPS-PROVIDER-RESEARCH.md
  // §1 "Base URL & auth"). Tenants commonly enter just the host
  // (`https://gps.example.com`) or the host with a port
  // (`https://gps.example.com:8082`) rather than the full `/api` suffix —
  // append it defensively rather than rejecting an otherwise-valid entry.
  if (!/\/api$/i.test(base)) base = `${base}/api`;
  return new URL(base);
}

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

export class TraccarClient {
  private readonly apiBase: URL;
  private readonly authenticationType: GpsAuthenticationType;
  private readonly secrets: TraccarClientSecrets;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private mintedToken: string | undefined;
  // Single-flight guard: adapter methods like listDevices() issue several
  // GET requests concurrently (Promise.all), and each independently needs
  // an Authorization header. Without this, two concurrent session_login
  // callers who both observe `!mintedToken` would each mint their own
  // token, wasting a Traccar session-token quota and leaving `mintedToken`
  // set to whichever mint happened to finish last.
  private mintingPromise: Promise<string> | undefined;

  constructor(options: TraccarClientOptions) {
    this.apiBase = normalizeApiBase(options.apiBaseUrl);
    this.authenticationType = options.authenticationType;
    this.secrets = options.secrets;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private buildUrl(path: string, query?: Record<string, string | number | Array<string | number> | undefined>): URL {
    const url = new URL(this.apiBase.toString() + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          // Traccar's Java/Jersey stack takes repeatable plain query params
          // for array-typed fields (e.g. `deviceId=1&deviceId=2`), not a
          // `deviceId[]=` bracket syntax — GPS-PROVIDER-RESEARCH.md §1 notes
          // `id`/`uniqueId` as "(repeatable)" without ever showing bracket
          // notation in an example URL.
          for (const item of value) url.searchParams.append(key, String(item));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url;
  }

  /**
   * `POST /session/token` — mints a Bearer token using Basic auth.
   * GPS-PROVIDER-RESEARCH.md §1: "returns the raw token as text/plain (not
   * JSON)". Only used for the `session_login` authenticationType; cached
   * in-memory for this client instance's lifetime (not persisted — a fresh
   * adapter/client is constructed per registry lookup today, so this is a
   * per-call optimization, not a cross-request cache; see this task's report
   * for the follow-up needed to persist a minted token).
   */
  private async mintSessionToken(): Promise<string> {
    if (!this.secrets.apiUsername || !this.secrets.apiPassword) {
      throw new TraccarProviderUnavailableError('session_login requires apiUsername and apiPassword.');
    }
    await assertPublicTraccarUrl(this.apiBase);
    const url = this.buildUrl('/session/token');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(this.secrets.apiUsername, this.secrets.apiPassword),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: '',
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) throw new TraccarAuthenticationFailedError();
      if (!response.ok) throw new TraccarRequestError(response.status);
      const token = (await response.text()).trim();
      if (!token) throw new TraccarProviderUnavailableError('empty session token response.');
      return token;
    } catch (error) {
      throw this.classifyNetworkError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private classifyNetworkError(error: unknown): Error {
    if (
      error instanceof TraccarAuthenticationFailedError
      || error instanceof TraccarRateLimitedError
      || error instanceof TraccarProviderUnavailableError
      || error instanceof TraccarNotFoundError
      || error instanceof TraccarRequestError
    ) {
      return error;
    }
    const err = error as { name?: string };
    if (err?.name === 'AbortError') return new TraccarProviderUnavailableError('request timed out.');
    // Never interpolate the raw error object here — it can echo back parts
    // of the request (URL, sometimes headers) into logs/report text.
    return new TraccarProviderUnavailableError('network request failed.');
  }

  private async authorizationHeader(forceRemint: boolean): Promise<string> {
    if (this.authenticationType === 'bearer_token') {
      if (!this.secrets.apiToken) throw new TraccarProviderUnavailableError('bearer_token requires apiToken.');
      return `Bearer ${this.secrets.apiToken}`;
    }
    if (this.authenticationType === 'basic_authentication') {
      if (!this.secrets.apiUsername || !this.secrets.apiPassword) {
        throw new TraccarProviderUnavailableError('basic_authentication requires apiUsername and apiPassword.');
      }
      return basicAuthHeader(this.secrets.apiUsername, this.secrets.apiPassword);
    }
    // session_login
    if (forceRemint) this.mintedToken = undefined; // invalidate; do not cancel an already-in-flight mint below
    if (!this.mintedToken) {
      if (!this.mintingPromise) {
        this.mintingPromise = this.mintSessionToken()
          .then((token) => {
            this.mintedToken = token;
            return token;
          })
          .finally(() => {
            this.mintingPromise = undefined;
          });
      }
      return `Bearer ${await this.mintingPromise}`;
    }
    return `Bearer ${this.mintedToken}`;
  }

  /**
   * Performs one authenticated GET against the Traccar API. For
   * `session_login`, a single 401 triggers exactly one re-mint-and-retry
   * (the cached token may have expired) before surfacing an auth failure.
   */
  async get<T>(path: string, query?: Record<string, string | number | Array<string | number> | undefined>): Promise<T> {
    await assertPublicTraccarUrl(this.apiBase);
    const url = this.buildUrl(path, query);

    const attempt = async (forceRemint: boolean): Promise<Response> => {
      const authorization = await this.authorizationHeader(forceRemint);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        return await this.fetchImpl(url.toString(), {
          method: 'GET',
          headers: { Authorization: authorization, Accept: 'application/json' },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      let response = await attempt(false);
      if (response.status === 401 && this.authenticationType === 'session_login') {
        response = await attempt(true);
      }
      if (response.status === 401 || response.status === 403) throw new TraccarAuthenticationFailedError();
      if (response.status === 404) throw new TraccarNotFoundError(path);
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
        throw new TraccarRateLimitedError(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined);
      }
      if (response.status >= 500) throw new TraccarProviderUnavailableError(`upstream returned ${response.status}.`);
      if (!response.ok) throw new TraccarRequestError(response.status);

      const text = await response.text();
      if (!text) return [] as unknown as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new TraccarProviderUnavailableError('response body was not valid JSON.');
      }
    } catch (error) {
      throw this.classifyNetworkError(error);
    }
  }
}
