// TASK-ROOT-SECURITY-05 — shared test harness for exercising the REAL
// `securityRouter`/`auditRouter` Express Router objects (real middleware
// chain, including `requirePlatformRoleLocal`) without needing a running
// HTTP server. This deliberately does NOT reimplement route logic in tests
// — it walks the actual Router's `.stack`, matches the concrete request
// path against each registered route's path (including `:param` segments),
// and runs the real middleware/handler functions in order against a fake
// req/res pair, exactly like Express would.
//
// This mirrors the existing convention in tests/e2e/gps-credential-leakage.spec.ts
// (a hand-built "fakeExpressApp" that captures a handler and invokes it
// directly), extended to walk a real `Router` so multi-middleware chains
// (auth gate -> handler) are exercised faithfully.

import type { Router } from 'express';

export interface FakeResponse {
  statusCode: number;
  body: unknown;
  ended: boolean;
  status(code: number): FakeResponse;
  json(body: unknown): FakeResponse;
  send(body: unknown): FakeResponse;
}

function createFakeRes(onSend: () => void): FakeResponse {
  const res: FakeResponse = {
    statusCode: 200,
    body: undefined,
    ended: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      res.ended = true;
      onSend();
      return res;
    },
    send(body: unknown) {
      res.body = body;
      res.ended = true;
      onSend();
      return res;
    },
  };
  return res;
}

function pathToRegex(routePath: string, keys: string[]): RegExp {
  const escaped = routePath
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${escaped}$`);
}

interface MatchedRoute {
  layers: Array<{ handle: (req: any, res: any, next: (err?: unknown) => void) => unknown }>;
  params: Record<string, string>;
}

function findRoute(router: Router, method: string, path: string): MatchedRoute | null {
  const stack = (router as unknown as { stack: any[] }).stack;
  for (const layer of stack) {
    if (!layer.route) continue;
    const route = layer.route;
    if (!route.methods[method.toLowerCase()]) continue;
    const keys: string[] = [];
    const pattern = pathToRegex(route.path, keys);
    const match = pattern.exec(path);
    if (match) {
      const params: Record<string, string> = {};
      keys.forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1]);
      });
      return { layers: route.stack, params };
    }
  }
  return null;
}

/**
 * Runs a real HTTP method+path against a real Express Router by walking its
 * registered routes and executing each middleware/handler in the chain in
 * order, stopping as soon as a response is sent (mirrors Express's own
 * short-circuit-on-response behavior). Throws if no route matches, or if a
 * handler throws/passes an error to `next()`.
 */
export async function invokeRoute(
  router: Router,
  method: string,
  path: string,
  req: Record<string, any>,
): Promise<FakeResponse> {
  const matched = findRoute(router, method, path);
  if (!matched) {
    throw new Error(`No route registered for ${method} ${path}`);
  }
  req.params = { ...(req.params ?? {}), ...matched.params };
  req.query = req.query ?? {};
  req.body = req.body ?? {};

  let sent = false;
  // Set fresh for each layer's wait below — res.json()/res.send() can fire
  // asynchronously (after an `await` inside an async handler), well after
  // `layer.handle(...)` has already returned its pending Promise. The
  // per-layer wait below must be resolved from THIS callback in that case,
  // not just from a `next()` call or the handler's own returned Promise
  // settling — an async handler that never calls `next()` (the normal
  // Express pattern: send a response, don't call next) would otherwise
  // leave the per-layer wait pending forever.
  let onLayerSettleFromSend: (() => void) | null = null;
  const res = createFakeRes(() => {
    sent = true;
    onLayerSettleFromSend?.();
  });

  for (const layer of matched.layers) {
    if (sent) break;
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settleOnce = (fn: () => void) => {
        if (settled) return;
        settled = true;
        onLayerSettleFromSend = null;
        fn();
      };
      onLayerSettleFromSend = () => settleOnce(resolve);
      const next = (err?: unknown) => {
        settleOnce(() => {
          if (err) reject(err instanceof Error ? err : new Error(String(err)));
          else resolve();
        });
      };
      try {
        const result = layer.handle(req, res, next);
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          (result as Promise<unknown>).then(
            // Handler's own promise settled without calling next() or
            // sending a response — treat as "done with this layer" rather
            // than hanging forever (shouldn't happen for this task's
            // routes, every one of which either sends or calls next, but
            // this keeps the harness itself from being the thing that
            // times out a test).
            () => settleOnce(resolve),
            (err) => settleOnce(() => reject(err)),
          );
        }
      } catch (err) {
        settleOnce(() => reject(err as Error));
      }
    });
  }

  return res;
}

/** Minimal fake session object — a plain mutable record, exactly like
 * express-session provides on `req.session`, so route handlers that read/
 * write `req.session.rootSupportAccess` work unmodified. */
export function createFakeSession(): Record<string, unknown> {
  return {};
}
