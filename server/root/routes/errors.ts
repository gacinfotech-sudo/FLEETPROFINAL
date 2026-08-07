// TASK-ROOT-SUPPORT-03 — Error Center + Support Diagnostics routes.
//
// New, additive namespace: /api/root/errors/**, /api/root/diagnostics/**.
// Not mounted anywhere yet — see this task's report for the exact proposed
// `registerErrorRoutes(app)` call.
//
// Diagnostics (GET /api/root/diagnostics/:correlationId) reads from
// ErrorRecord only — per this task's scope, it "does not require a separate
// new capture mechanism beyond" the Error Center. It reconstructs the trace
// (tenant, user, module, action, step reached, validation failure, API
// response, retry count, last successful step, correlation ID) from every
// ErrorRecord sharing one correlation ID, ordered chronologically.

import type { Express, NextFunction, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, type AuthRequest } from '../../middleware/auth';
import { ALL_PLATFORM_ROLES, requirePlatformRoleLocal } from '../services/errorCaptureService';
import { ERROR_RECORD_SOURCES, ErrorRecord } from '../models/errorRecord';

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map((issue) => issue.message).join('; ');
  return 'Error Center request failed.';
}

const objectIdString = z.string().regex(/^[a-f0-9]{24}$/i, 'Must be a valid ObjectId');
const errorRecordIdString = z.string().regex(/^[a-f0-9]{24}$/i, 'Must be a valid ErrorRecord id');

const listQuerySchema = z.object({
  tenantId: objectIdString.optional(),
  source: z.enum(ERROR_RECORD_SOURCES).optional(),
  correlationId: z.string().max(128).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const correlationIdParamSchema = z.object({
  correlationId: z.string().min(1).max(128),
});

export function registerErrorRoutes(app: Express): void {
  app.get(
    '/api/root/errors',
    authenticateUser,
    requirePlatformRoleLocal(ALL_PLATFORM_ROLES),
    safeAsync(async (req: AuthRequest, res) => {
      try {
        const query = listQuerySchema.parse(req.query);
        const filter: Record<string, unknown> = {};
        if (query.tenantId) filter.tenantId = query.tenantId;
        if (query.source) filter.source = query.source;
        if (query.correlationId) filter.correlationId = query.correlationId;

        const [errors, total] = await Promise.all([
          ErrorRecord.find(filter)
            .sort({ createdAt: -1 })
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
          ErrorRecord.countDocuments(filter),
        ]);

        res.json({ errors, total, page: query.page, limit: query.limit });
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
        res.status(500).json({ message: 'Failed to list error records.' });
      }
    }),
  );

  app.get(
    '/api/root/errors/:id',
    authenticateUser,
    requirePlatformRoleLocal(ALL_PLATFORM_ROLES),
    safeAsync(async (req: AuthRequest, res) => {
      try {
        const params = z.object({ id: errorRecordIdString }).parse(req.params);
        const errorRecord = await ErrorRecord.findById(params.id).lean();
        if (!errorRecord) {
          res.status(404).json({ message: 'Error record not found.' });
          return;
        }
        res.json({ error: errorRecord });
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
        res.status(500).json({ message: 'Failed to fetch error record.' });
      }
    }),
  );

  app.get(
    '/api/root/diagnostics/:correlationId',
    authenticateUser,
    requirePlatformRoleLocal(ALL_PLATFORM_ROLES),
    safeAsync(async (req: AuthRequest, res) => {
      try {
        const params = correlationIdParamSchema.parse(req.params);

        const events = await ErrorRecord.find({ correlationId: params.correlationId })
          .sort({ createdAt: 1 })
          .lean();

        if (events.length === 0) {
          res.status(404).json({ message: 'No diagnostics trace found for this correlation ID.' });
          return;
        }

        const first = events[0];
        const last = events[events.length - 1];

        // Reconstructed trace per this task's objective: tenant, user,
        // module, action attempted, step reached, validation failure, API
        // response, retry count, last successful step, correlation ID —
        // derived from the chronological sequence of ErrorRecords sharing
        // this correlation ID, not a separate capture mechanism.
        const trace = {
          correlationId: params.correlationId,
          tenantId: first.tenantId,
          userId: first.userId,
          role: first.role,
          module: last.module ?? first.module,
          actionAttempted: last.actionAttempted ?? first.actionAttempted,
          stepReached: last.stepReached ?? first.stepReached,
          validationFailure: last.validationFailure,
          apiResponseSnapshot: last.apiResponseSnapshot,
          retryCount: last.retryCount,
          lastSuccessfulStep: last.lastSuccessfulStep,
          firstEventAt: first.createdAt,
          lastEventAt: last.createdAt,
          events,
        };

        res.json({ trace });
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
        res.status(500).json({ message: 'Failed to reconstruct diagnostics trace.' });
      }
    }),
  );
}
