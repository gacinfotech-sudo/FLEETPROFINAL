// TASK-ROOT-SUPPORT-03 — Correlation-ID middleware.
//
// Self-contained, NOT wired into the live global request pipeline by this
// task (per task scope: "you do not apply this yourself... propose the
// exact one-line mount in your report"). server/index.ts and
// server/routes.ts are Integrator-only shared files.
//
// Proposed mount point (see this task's report for the exact line and
// justification): in server/index.ts, immediately after the body-parser
// middleware (`express.json()`/`express.urlencoded()`) and before
// `registerRoutes(app)` is called, so every route — including ones outside
// /api/root/** — gets a correlation ID attached to req before any handler
// or error path runs.
//
// Behavior: generates a request-scoped correlation ID if the client didn't
// already supply one via the X-Correlation-Id header, attaches it to
// `req.correlationId`, and echoes it back on the response via the same
// header so a frontend error reporter (or this task's own error-capture
// calls) can always tag captured errors with the ID of the request that
// produced them — the mechanism the Support Diagnostics view depends on to
// reconstruct a trace from one ID.

import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CORRELATION_ID_RESPONSE_HEADER = 'X-Correlation-Id';

export interface CorrelationIdRequest extends Request {
  correlationId?: string;
}

// Client-supplied IDs are trusted only if they look like a reasonable
// opaque identifier (bounded length, safe character set) — this is a log/
// trace-correlation field, not a security boundary, but an unbounded or
// header-injection-shaped value should never be echoed back verbatim into
// a response header or stored as-is.
const MAX_CORRELATION_ID_LENGTH = 128;
const SAFE_CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export function isValidCorrelationId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_CORRELATION_ID_LENGTH &&
    SAFE_CORRELATION_ID_PATTERN.test(value)
  );
}

export function generateCorrelationId(): string {
  return randomUUID();
}

export function correlationIdMiddleware(req: CorrelationIdRequest, res: Response, next: NextFunction): void {
  const rawIncoming = req.headers[CORRELATION_ID_HEADER];
  const incoming = Array.isArray(rawIncoming) ? rawIncoming[0] : rawIncoming;

  const correlationId = isValidCorrelationId(incoming) ? incoming : generateCorrelationId();

  req.correlationId = correlationId;
  res.setHeader(CORRELATION_ID_RESPONSE_HEADER, correlationId);
  next();
}
