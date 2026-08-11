import type { Express, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { GpsConnection } from '../models/gpsConnection';
import { gpsProviderRegistry } from '../providers/runtimeRegistry';
import { resolveInternalGpsDevice } from '../telemetry/deviceResolver';
import { storeTelemetryPoint } from '../telemetry/store';
import type { NormalizedTelemetryPoint } from '../types';
import type { ProviderTelemetryPoint } from '../telemetry/types';
import { GpsWebhookEvent } from './models/webhookEvent';
import { openOrBumpDeadLetter } from './deadLetter';
import { withRetryBackoff, WEBHOOK_RETRY_BACKOFF } from './retry';

/**
 * Two capabilities a webhook-capable adapter needs that don't exist on the
 * shared `GpsProviderAdapter` interface today — see this task's report,
 * "Interface gaps found". Declared locally rather than added to the shared,
 * forbidden `server/gps/providers/adapter.ts`:
 *
 * 1. `verifyWebhookSignature` — already optional on the real interface
 *    (TASK-GPS-CONNECTION-02 left it unimplemented for Traccar, which has
 *    no signature scheme to implement — see that task's report, caveat c).
 * 2. `normalizeWebhookPayload` — does not exist on the interface at all yet.
 *    No current adapter (Traccar) can turn a raw webhook body into
 *    `NormalizedTelemetryPoint`s, because no current adapter receives
 *    provider-initiated webhooks at all. This route is real, working
 *    plumbing (signature verification, dedup, storage, retry/dead-letter)
 *    that is simply capability-gated off until a future adapter implements
 *    both methods below — see report for the exact proposed `adapter.ts`
 *    patch.
 */
interface WebhookCapableAdapter {
  verifyWebhookSignature(headers: Readonly<Record<string, string>>, rawBody: Buffer): Promise<boolean>;
  normalizeWebhookPayload(rawBody: Buffer, headers: Readonly<Record<string, string>>): Promise<ProviderTelemetryPoint[]>;
}

const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many webhook requests.' },
});

const MAX_STORED_RAW_BODY_BYTES = 64 * 1024;
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'x-api-key']);

function headerRecord(req: Request): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') record[key.toLowerCase()] = value;
    else if (Array.isArray(value)) record[key.toLowerCase()] = value.join(', ');
  }
  return record;
}

async function recordWebhookEvent(input: {
  connectionId: string;
  tenantId: string;
  providerKey: string;
  rawBody: Buffer;
  headers: Record<string, string>;
  processingStatus: 'verified_stored' | 'unmapped_device' | 'signature_rejected' | 'processing_failed' | 'unsupported_provider';
  errorMessage?: string;
}): Promise<void> {
  const safeHeaders = Object.fromEntries(
    Object.entries(input.headers).filter(([key]) => !SENSITIVE_HEADERS.has(key)),
  );
  await GpsWebhookEvent.create({
    tenantId: input.tenantId,
    connectionId: input.connectionId,
    providerKey: input.providerKey,
    receivedAt: new Date(),
    headers: safeHeaders,
    bodySize: input.rawBody.length,
    rawBody: input.rawBody.length > 0 && input.rawBody.length <= MAX_STORED_RAW_BODY_BYTES
      ? input.rawBody.toString('utf8')
      : undefined,
    processingStatus: input.processingStatus,
    errorMessage: input.errorMessage?.slice(0, 1000),
  });
}

function safeAsync(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

/**
 * Registers the webhook receiver route on the given Express app. NOT called
 * from server/routes.ts by this task (a forbidden file) — see this task's
 * report for the exact registration line to add there, and for the
 * companion `server/index.ts` `express.json({ verify })` patch this route
 * depends on for real (non-reconstructed) raw-body signature verification.
 *
 * Path: `POST /api/gps/webhooks/:connectionId`. The owning tenant/connection
 * is resolved from `connectionId` in the URL path only (never from any
 * value inside the request body), per GPS-SECURITY-SPEC.md §3. `connectionId`
 * alone (no separate tenantId segment) is sufficient because it is a
 * globally unique Mongo ObjectId and this handler looks the connection up by
 * id and reads `tenantId` off the found document — it never trusts a
 * caller-supplied tenant value for anything.
 */
export function registerGpsWebhookRoutes(app: Express): void {
  app.post('/api/gps/webhooks/:connectionId', webhookRateLimit, safeAsync(async (req: Request, res: Response) => {
    const { connectionId } = req.params;
    if (!mongoose.isValidObjectId(connectionId)) {
      return res.status(404).json({ message: 'GPS webhook endpoint not found.' });
    }

    const connection = await GpsConnection.findOne({ _id: connectionId, enabled: true }).lean();
    if (!connection) {
      // No DB write here deliberately: an unknown/invalid connectionId is
      // attacker-controlled input, and writing a row for every guess would
      // be a trivial storage-filling vector.
      return res.status(404).json({ message: 'GPS webhook endpoint not found.' });
    }
    const tenantId = String(connection.tenantId);
    const headers = headerRecord(req);

    let adapter;
    try {
      adapter = await gpsProviderRegistry.getAdapter(tenantId, connectionId);
    } catch {
      return res.status(404).json({ message: 'GPS webhook endpoint not found.' });
    }
    const webhookAdapter = adapter as unknown as Partial<WebhookCapableAdapter>;

    if (typeof webhookAdapter.verifyWebhookSignature !== 'function') {
      await recordWebhookEvent({
        connectionId, tenantId, providerKey: connection.providerKey,
        rawBody: Buffer.alloc(0), headers, processingStatus: 'unsupported_provider',
      });
      return res.status(501).json({
        message: 'Webhook ingestion is not supported for this provider connection; it is polled instead.',
      });
    }

    // Requires `server/index.ts`'s express.json() to be mounted with a
    // `verify` callback capturing the raw bytes onto `req.rawBody` (see
    // report). Without it we fail closed rather than "verifying" against a
    // reconstructed buffer that was never the real bytes on the wire.
    const rawBody: Buffer | undefined = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      await recordWebhookEvent({
        connectionId, tenantId, providerKey: connection.providerKey,
        rawBody: Buffer.alloc(0), headers, processingStatus: 'processing_failed',
        errorMessage: 'raw body capture unavailable — see report for the required server/index.ts patch',
      });
      return res.status(500).json({ message: 'Webhook signature verification is unavailable on this deployment.' });
    }

    let verified = false;
    try {
      verified = await webhookAdapter.verifyWebhookSignature(headers, rawBody);
    } catch {
      verified = false;
    }
    if (!verified) {
      await recordWebhookEvent({
        connectionId, tenantId, providerKey: connection.providerKey,
        rawBody, headers, processingStatus: 'signature_rejected',
      });
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    if (typeof webhookAdapter.normalizeWebhookPayload !== 'function') {
      await recordWebhookEvent({
        connectionId, tenantId, providerKey: connection.providerKey,
        rawBody, headers, processingStatus: 'unsupported_provider',
      });
      return res.status(501).json({ message: 'This provider connection has no webhook payload normalizer registered.' });
    }

    let points: ProviderTelemetryPoint[];
    try {
      points = await webhookAdapter.normalizeWebhookPayload(rawBody, headers);
    } catch (error) {
      await recordWebhookEvent({
        connectionId, tenantId, providerKey: connection.providerKey,
        rawBody, headers, processingStatus: 'processing_failed',
        errorMessage: (error as Error)?.message,
      });
      return res.status(400).json({ message: 'Webhook payload could not be parsed.' });
    }

    let stored = 0;
    let unmapped = 0;
    let failed = 0;
    for (const rawPoint of points) {
      const resolved = await resolveInternalGpsDevice(tenantId, connectionId, rawPoint.providerDeviceId);
      if (!resolved) {
        unmapped += 1;
        continue;
      }
      const point: NormalizedTelemetryPoint = { ...rawPoint, tenantId, connectionId, gpsDeviceId: resolved.gpsDeviceId };
      try {
        await withRetryBackoff(() => storeTelemetryPoint(point), WEBHOOK_RETRY_BACKOFF);
        stored += 1;
      } catch (error) {
        failed += 1;
        await openOrBumpDeadLetter({
          tenantId, connectionId, gpsDeviceId: resolved.gpsDeviceId, providerDeviceId: rawPoint.providerDeviceId,
          source: 'webhook', errorMessage: (error as Error)?.message ?? 'unknown storage error',
          attempts: WEBHOOK_RETRY_BACKOFF.maxAttempts,
        });
      }
    }

    await recordWebhookEvent({
      connectionId, tenantId, providerKey: connection.providerKey, rawBody, headers,
      processingStatus: failed ? 'processing_failed' : (unmapped && !stored ? 'unmapped_device' : 'verified_stored'),
    });
    res.status(200).json({ received: points.length, stored, unmapped, failed });
  }));
}
