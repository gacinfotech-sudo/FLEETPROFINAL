// Global session expiry handler - will be set by AuthProvider
let sessionExpiryHandler: (() => void) | null = null;

export function setSessionExpiryHandler(handler: () => void) {
  sessionExpiryHandler = handler;
}

// The backend now requires an X-CSRF-Token header on every mutating
// (non-GET) request for a logged-in session (see server/middleware/security.ts).
// We cache the token in memory and fetch it lazily; it's re-fetched
// automatically if a request comes back 403 with an invalid-token message so
// that a stale in-memory token (e.g. after a server restart cleared old
// sessions) self-heals without requiring a manual page reload.
let csrfTokenCache: string | null = null;

export async function fetchCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/csrf-token", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    csrfTokenCache = data.csrfToken ?? null;
    return csrfTokenCache;
  } catch {
    return null;
  }
}

export function getCachedCsrfToken(): string | null {
  return csrfTokenCache;
}

export const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// TASK-DRIVER-ADD-400-FIX: apiRequest previously threw a bare Error whose
// message was `${status}: ${rawResponseText}` — for a JSON error body,
// that's the entire raw payload (e.g. a Zod issues array) stuffed into
// `.message` and shown verbatim in a toast. ApiError parses the body once
// here, exposes `status`/`body`/`fields` for callers that want to render
// field-specific errors, and falls back to `body.message` (or the raw
// text if the body isn't JSON) for `.message` so existing callers that
// only read `error.message` get a clean string instead of a JSON blob.
export class ApiError extends Error {
  status: number;
  body: any;
  fields?: Record<string, string>;

  constructor(status: number, rawText: string) {
    let body: any = null;
    try {
      body = JSON.parse(rawText);
    } catch {
      // Not a JSON body — fall back to the raw text below.
    }
    super((body && typeof body.message === "string" && body.message) || rawText || `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.fields = body && typeof body.fields === "object" ? body.fields : undefined;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const needsCsrf = MUTATING_METHODS.has(method.toUpperCase());
  if (needsCsrf && !csrfTokenCache) {
    await fetchCsrfToken();
  }

  const buildHeaders = () => {
    const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
    if (needsCsrf && csrfTokenCache) {
      headers["X-CSRF-Token"] = csrfTokenCache;
    }
    // Add JWT token if available (from localStorage)
    const token = typeof window !== 'undefined' ? localStorage.getItem('fleetpro_token') : null;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  let res = await fetch(url, {
    method,
    headers: buildHeaders(),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Self-heal once if the CSRF token was stale/missing.
  if (needsCsrf && res.status === 403) {
    const clone = res.clone();
    const body = await clone.json().catch(() => null);
    if (body?.message?.toLowerCase().includes("csrf")) {
      await fetchCsrfToken();
      res = await fetch(url, {
        method,
        headers: buildHeaders(),
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    }
  }

  // Handle session expiry
  if (res.status === 401 && sessionExpiryHandler) {
    sessionExpiryHandler();
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new ApiError(res.status, text);
  }

  return res;
}
