// TASK-BOOKING-QUEUES-05 — booking findability queues + previous-booking
// reuse. A standalone route-registration module, owned exclusively by this
// task (server/booking/queues/**) — NOT called from server/routes.ts, which
// is on this task's forbidden-to-edit list. Matches the exact
// `registerXRoutes(app: Express)` convention server/gps/routes/*.ts already
// established for additive route namespaces (see registerGpsConnectionRoutes
// etc., called from server/routes.ts's registerRoutes()) — see this task's
// REPORT.md for the single proposed line
// (`registerBookingQueuesRoutes(app);`) the Integrator needs to add.
//
// Every route here is a plain GET with no new write path — it composes
// entirely from data storage.getBookingsByTenant() (or, for the reuse
// endpoints, a direct read-only Booking.find/findOne) already provides,
// same auth/tenant-scoping convention (`authenticateUser, requireTenant`)
// as every other route in server/routes.ts.

import type { Express } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { storage } from '../../storage-mongodb';
import {
  buildMostRecentQueue,
  buildDatePendingQueue,
  buildFollowUpDueQueue,
  buildTentativeQueue,
  buildNeedsAttentionQueue,
  QueueQueryParams,
} from './queries';
import { getPreviousBookingsForReuse, buildReusePrefill } from './previousBookingReuse';

export function registerBookingQueuesRoutes(app: Express): void {
  app.get('/api/bookings/queues/most-recent', authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      res.json({ items: buildMostRecentQueue(bookings, parseQueryParams(req)) });
    } catch (error) {
      console.error('Most Recent queue error:', error);
      res.status(500).json({ message: 'Failed to load Most Recent queue' });
    }
  });

  app.get('/api/bookings/queues/date-pending', authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      res.json({ items: buildDatePendingQueue(bookings, parseQueryParams(req)) });
    } catch (error) {
      console.error('Date Pending queue error:', error);
      res.status(500).json({ message: 'Failed to load Date Pending queue' });
    }
  });

  app.get('/api/bookings/queues/follow-up-due', authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      res.json({ items: buildFollowUpDueQueue(bookings, new Date(), parseQueryParams(req)) });
    } catch (error) {
      console.error('Follow-up Due queue error:', error);
      res.status(500).json({ message: 'Failed to load Follow-up Due queue' });
    }
  });

  app.get('/api/bookings/queues/tentative', authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      res.json({ items: buildTentativeQueue(bookings, parseQueryParams(req)) });
    } catch (error) {
      console.error('Tentative Bookings queue error:', error);
      res.status(500).json({ message: 'Failed to load Tentative Bookings queue' });
    }
  });

  app.get('/api/bookings/queues/needs-attention', authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      res.json({ items: buildNeedsAttentionQueue(bookings, new Date(), parseQueryParams(req)) });
    } catch (error) {
      console.error('Needs Attention queue error:', error);
      res.status(500).json({ message: 'Failed to load Needs Attention queue' });
    }
  });

  // Customer previous-booking reuse. Read-only — see previousBookingReuse.ts's
  // header comment for why this can never mutate history. `?apply=<bookingId>`
  // returns the reuse prefill for one specific previous booking; omitted,
  // returns the list of reusable previous bookings to choose from.
  app.get('/api/customers/:id/previous-booking-reuse', authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const applyTo = typeof req.query.apply === 'string' ? req.query.apply : undefined;
      if (applyTo) {
        const prefill = await buildReusePrefill(req.tenantId!, req.params.id, applyTo);
        if (!prefill) return res.status(404).json({ message: 'Previous booking not found for this customer' });
        return res.json({ prefill });
      }
      const options = await getPreviousBookingsForReuse(req.tenantId!, req.params.id);
      res.json({ options });
    } catch (error) {
      console.error('Previous-booking reuse error:', error);
      res.status(500).json({ message: 'Failed to load previous bookings for reuse' });
    }
  });
}

function parseQueryParams(req: AuthRequest): QueueQueryParams {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const sortBy = ['lastActivityAt', 'pickupDate', 'followUpAt'].includes(req.query.sortBy as string)
    ? (req.query.sortBy as QueueQueryParams['sortBy'])
    : undefined;
  const order = req.query.order === 'asc' ? 'asc' : req.query.order === 'desc' ? 'desc' : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  return { q, sortBy, order, limit: Number.isFinite(limit) ? limit : undefined };
}
