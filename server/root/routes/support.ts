// TASK-ROOT-SUPPORT-03 — Support ticket routes.
//
// New, additive namespace: /api/root/support/**. Not mounted anywhere yet —
// see this task's report for the exact proposed `registerSupportRoutes(app)`
// call (mirrors the existing `registerGpsConnectionRoutes(app)` pattern in
// server/routes.ts, which this task is forbidden to edit directly).
//
// Every route here requires an authenticated platform-role user
// (`requirePlatformRoleLocal`, a local placeholder for
// `RootAccessService.requirePlatformRole` — see
// server/root/services/errorCaptureService.ts's header comment). A
// tenant-scoped session (no `platformRole`) always gets 403, proven in
// server/root/routes/support.test.ts.

import type { Express, NextFunction, Response } from 'express';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { authenticateUser, type AuthRequest } from '../../middleware/auth';
import {
  ALL_PLATFORM_ROLES,
  MUTATION_PLATFORM_ROLES,
  requirePlatformRoleLocal,
} from '../services/errorCaptureService';
import {
  SUPPORT_TICKET_MODULES,
  SUPPORT_TICKET_SEVERITIES,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_TRANSITIONS,
  SupportTicket,
  type SupportTicketStatus,
} from '../models/supportTicket';

const ticketIdAlphabet = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8);
export function generateTicketId(): string {
  return `TCK-${ticketIdAlphabet()}`;
}

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map((issue) => issue.message).join('; ');
  return 'Support ticket request failed.';
}

const objectIdString = z.string().regex(/^[a-f0-9]{24}$/i, 'Must be a valid ObjectId');

const createTicketSchema = z
  .object({
    tenantId: objectIdString,
    reportedBy: z
      .object({
        userId: z.string().max(100).optional(),
        name: z.string().max(200).optional(),
        email: z.string().email().max(320).optional(),
        role: z.string().max(50).optional(),
      })
      .strict()
      .optional(),
    module: z.enum(SUPPORT_TICKET_MODULES),
    severity: z.enum(SUPPORT_TICKET_SEVERITIES).default('MEDIUM'),
    category: z.string().trim().min(1).max(120),
    subject: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    correlationId: z.string().max(128).optional(),
    relatedEntities: z
      .object({
        bookingId: objectIdString.optional(),
        customerId: objectIdString.optional(),
        driverId: objectIdString.optional(),
        vehicleId: objectIdString.optional(),
        vendorId: objectIdString.optional(),
      })
      .strict()
      .optional(),
    sla: z
      .object({
        targetResponseAt: z.coerce.date().optional(),
        targetResolutionAt: z.coerce.date().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const updateTicketSchema = z
  .object({
    status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
    note: z.string().trim().max(2000).optional(),
    assignedAgent: z
      .object({
        userId: z.string().min(1).max(100),
        name: z.string().max(200).optional(),
      })
      .strict()
      .optional(),
    severity: z.enum(SUPPORT_TICKET_SEVERITIES).optional(),
  })
  .strict();

const listQuerySchema = z.object({
  tenantId: objectIdString.optional(),
  status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
  severity: z.enum(SUPPORT_TICKET_SEVERITIES).optional(),
  module: z.enum(SUPPORT_TICKET_MODULES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export function registerSupportRoutes(app: Express): void {
  app.get(
    '/api/root/support/tickets',
    authenticateUser,
    requirePlatformRoleLocal(ALL_PLATFORM_ROLES),
    safeAsync(async (req: AuthRequest, res) => {
      try {
        const query = listQuerySchema.parse(req.query);
        const filter: Record<string, unknown> = {};
        if (query.tenantId) filter.tenantId = query.tenantId;
        if (query.status) filter.status = query.status;
        if (query.severity) filter.severity = query.severity;
        if (query.module) filter.module = query.module;

        const [tickets, total] = await Promise.all([
          SupportTicket.find(filter)
            .sort({ createdAt: -1 })
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
          SupportTicket.countDocuments(filter),
        ]);

        res.json({ tickets, total, page: query.page, limit: query.limit });
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
        res.status(500).json({ message: 'Failed to list support tickets.' });
      }
    }),
  );

  app.post(
    '/api/root/support/tickets',
    authenticateUser,
    requirePlatformRoleLocal(MUTATION_PLATFORM_ROLES),
    safeAsync(async (req: AuthRequest, res) => {
      try {
        const body = createTicketSchema.parse(req.body);
        const actorUserId = req.userId ?? req.user?.userId ?? 'unknown';

        const ticket = await SupportTicket.create({
          ticketId: generateTicketId(),
          tenantId: body.tenantId,
          reportedBy: body.reportedBy,
          module: body.module,
          severity: body.severity,
          category: body.category,
          subject: body.subject,
          description: body.description,
          status: 'NEW',
          correlationId: body.correlationId,
          relatedEntities: body.relatedEntities,
          sla: body.sla,
          timeline: [
            {
              status: 'NEW',
              note: 'Ticket created',
              changedBy: actorUserId,
              changedAt: new Date(),
            },
          ],
        });

        res.status(201).json({ ticket });
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
        res.status(500).json({ message: 'Failed to create support ticket.' });
      }
    }),
  );

  app.patch(
    '/api/root/support/tickets/:id',
    authenticateUser,
    requirePlatformRoleLocal(MUTATION_PLATFORM_ROLES),
    safeAsync(async (req: AuthRequest, res) => {
      try {
        const params = z.object({ id: objectIdString }).parse(req.params);
        const body = updateTicketSchema.parse(req.body);
        const actorUserId = req.userId ?? req.user?.userId ?? 'unknown';

        const ticket = await SupportTicket.findById(params.id);
        if (!ticket) {
          res.status(404).json({ message: 'Support ticket not found.' });
          return;
        }

        if (body.status && body.status !== ticket.status) {
          const allowedNext = SUPPORT_TICKET_TRANSITIONS[ticket.status as SupportTicketStatus];
          if (!allowedNext.includes(body.status)) {
            res.status(422).json({
              message: `Invalid status transition: ${ticket.status} -> ${body.status}.`,
              allowedNext,
            });
            return;
          }
          ticket.status = body.status;
          ticket.timeline.push({
            status: body.status,
            note: body.note,
            changedBy: actorUserId,
            changedAt: new Date(),
          });
          if (body.status === 'RESOLVED') ticket.sla.resolvedAt = new Date();
        }

        if (body.assignedAgent) ticket.assignedAgent = body.assignedAgent;
        if (body.severity) ticket.severity = body.severity;

        await ticket.save();
        res.json({ ticket });
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
        res.status(500).json({ message: 'Failed to update support ticket.' });
      }
    }),
  );
}
