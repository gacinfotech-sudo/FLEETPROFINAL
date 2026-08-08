// Live Operations HTTP surface — registered from routes.ts with one call so
// the shared route registry stays a single line. Everything here is a VIEW
// or an action over canonical Booking/Tenant/OperationsAlert records.

import type { Express } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../middleware/auth';
import { requirePermission, PERMISSIONS } from '../middleware/permissions';
import { Tenant, OperationsAlert, OperationsActivity, Booking } from '../models/index';
import { SelfDriveTrip, computeRefund } from '../booking/self-drive/models';
import { buildLiveVehicles } from './liveVehicles';
import { sweepTenant } from './reminderEngine';
import { resolvePolicy, DEFAULT_SELF_DRIVE_STAGES, DEFAULT_WITH_DRIVER_STAGES } from './policy';

const CONTACT_ACTIONS = ['called_customer', 'called_driver', 'whatsapp_customer', 'whatsapp_driver', 'note', 'return_confirmed', 'extension_discussed', 'collection_assigned'];

export function registerOperationsRoutes(app: Express): void {
  // Vehicles on Booking — the canonical live view (spec §2, §81).
  app.get('/api/operations/live-vehicles', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const result = await buildLiveVehicles(req.tenantId!);
      res.json(result);
    } catch (error: any) {
      console.error('Live vehicles error:', error?.message || error);
      res.status(500).json({ message: 'Failed to load live operations' });
    }
  });

  // Operations alerts — notification center + top strip feed.
  app.get('/api/operations/alerts', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'open';
      const query: any = { tenantId: req.tenantId };
      if (status === 'open') query.status = { $in: ['active', 'acknowledged', 'snoozed'] };
      else if (status === 'active') query.status = 'active';
      else if (status === 'resolved') query.status = 'resolved';
      const alerts = await OperationsAlert.find(query)
        .sort({ createdAt: -1 })
        .limit(200)
        .populate('bookingId', 'bookingId customerName customerPhone bookingType status')
        .lean();
      res.json(alerts);
    } catch (error: any) {
      console.error('Operations alerts error:', error?.message || error);
      res.status(500).json({ message: 'Failed to load alerts' });
    }
  });

  // Acknowledge — stops repeat popups; the alert row stays visible where
  // appropriate (critical overdue never disappears until resolved).
  app.post('/api/operations/alerts/:id/acknowledge', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const alert: any = await OperationsAlert.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!alert) return res.status(404).json({ message: 'Alert not found' });
      if (alert.status === 'resolved') return res.status(400).json({ message: 'Alert is already resolved' });
      alert.status = 'acknowledged';
      alert.acknowledgedBy = { userId: req.userId!, name: req.user?.name || req.user?.userId };
      alert.acknowledgedAt = new Date();
      await alert.save();
      res.json(alert);
    } catch (error: any) {
      console.error('Acknowledge alert error:', error?.message || error);
      res.status(500).json({ message: 'Failed to acknowledge alert' });
    }
  });

  app.post('/api/operations/alerts/:id/snooze', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const minutes = Number(req.body?.minutes);
      if (!Number.isFinite(minutes) || minutes < 5 || minutes > 24 * 60) {
        return res.status(400).json({ message: 'minutes must be between 5 and 1440' });
      }
      const alert: any = await OperationsAlert.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!alert) return res.status(404).json({ message: 'Alert not found' });
      if (alert.status === 'resolved') return res.status(400).json({ message: 'Alert is already resolved' });
      // A critical overdue alert must remain visible — it can be
      // acknowledged but not snoozed out of sight (spec §13).
      if (alert.priority === 'critical') {
        return res.status(400).json({ message: 'Critical alerts cannot be snoozed — acknowledge instead.' });
      }
      alert.status = 'snoozed';
      alert.snoozedUntil = new Date(Date.now() + minutes * 60000);
      alert.contactLog.push({ at: new Date(), userId: req.userId!, userName: req.user?.name || req.user?.userId, action: 'snoozed', note: `${minutes} min` });
      await alert.save();
      res.json(alert);
    } catch (error: any) {
      console.error('Snooze alert error:', error?.message || error);
      res.status(500).json({ message: 'Failed to snooze alert' });
    }
  });

  // Contact/outcome logging on an alert (Called Customer, Extension
  // Discussed, …) — attributed, and mirrored into the booking's
  // operational activity timeline (spec §42-43, §65).
  app.post('/api/operations/alerts/:id/contact', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const { action, note } = req.body || {};
      if (!CONTACT_ACTIONS.includes(action)) {
        return res.status(400).json({ message: `action must be one of: ${CONTACT_ACTIONS.join(', ')}` });
      }
      const alert: any = await OperationsAlert.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!alert) return res.status(404).json({ message: 'Alert not found' });
      const entry = { at: new Date(), userId: req.userId!, userName: req.user?.name || req.user?.userId, action, note };
      alert.contactLog.push(entry);
      await alert.save();
      await OperationsActivity.create({ tenantId: req.tenantId, bookingId: alert.bookingId, ...entry });
      res.json(alert);
    } catch (error: any) {
      console.error('Alert contact error:', error?.message || error);
      res.status(500).json({ message: 'Failed to record contact' });
    }
  });

  // Booking-level operational activity (quick notes / contact attempts
  // made outside any specific alert).
  app.get('/api/operations/bookings/:id/activity', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const rows = await OperationsActivity.find({ tenantId: req.tenantId, bookingId: req.params.id })
        .sort({ at: -1 })
        .limit(50)
        .lean();
      res.json(rows);
    } catch (error: any) {
      console.error('Operations activity error:', error?.message || error);
      res.status(500).json({ message: 'Failed to load activity' });
    }
  });

  app.post('/api/operations/bookings/:id/activity', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const { action, note } = req.body || {};
      if (!CONTACT_ACTIONS.includes(action)) {
        return res.status(400).json({ message: `action must be one of: ${CONTACT_ACTIONS.join(', ')}` });
      }
      const booking = await Booking.findOne({ _id: req.params.id, tenantId: req.tenantId }).select('_id');
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      const row = await OperationsActivity.create({
        tenantId: req.tenantId, bookingId: booking._id,
        userId: req.userId!, userName: req.user?.name || req.user?.userId,
        action, note, at: new Date(),
      });
      res.json(row);
    } catch (error: any) {
      console.error('Record activity error:', error?.message || error);
      res.status(500).json({ message: 'Failed to record activity' });
    }
  });

  // Reminder policy settings (Settings → Operations → Booking End
  // Reminders). GET returns the RESOLVED policy so the UI always shows the
  // effective stages, defaults included.
  app.get('/api/tenant/operations-settings', authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const tenant: any = await Tenant.findById(req.tenantId).lean();
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
      res.json({
        policy: resolvePolicy(tenant),
        raw: tenant.operationsSettings || null,
        timezone: tenant.timezone || null,
        defaults: { selfDriveStages: DEFAULT_SELF_DRIVE_STAGES, withDriverStages: DEFAULT_WITH_DRIVER_STAGES },
      });
    } catch (error: any) {
      console.error('Operations settings error:', error?.message || error);
      res.status(500).json({ message: 'Failed to load operations settings' });
    }
  });

  app.patch('/api/tenant/operations-settings', authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      // Policy is a tenant-owner decision (spec §14, §62) — managers run
      // operations, the owner (role 'client') configures escalation.
      if (req.user?.role !== 'client' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only the account owner can change reminder settings' });
      }
      const tenant: any = await Tenant.findById(req.tenantId);
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

      const { timezone, operationsSettings } = req.body || {};
      if (timezone !== undefined) {
        if (timezone !== null && timezone !== '') {
          try { new Intl.DateTimeFormat('en-IN', { timeZone: timezone }); } catch {
            return res.status(400).json({ message: `Invalid timezone: ${timezone}` });
          }
        }
        tenant.timezone = timezone || undefined;
      }
      if (operationsSettings !== undefined && operationsSettings !== null && typeof operationsSettings === 'object') {
        const s: any = {};
        const num = (v: any, lo: number, hi: number) => Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : undefined;
        if (operationsSettings.graceMinutes !== undefined) s.graceMinutes = num(operationsSettings.graceMinutes, 0, 1440);
        if (operationsSettings.turnaroundBufferMinutes !== undefined) s.turnaroundBufferMinutes = num(operationsSettings.turnaroundBufferMinutes, 0, 1440);
        if (operationsSettings.notifyOwner !== undefined) s.notifyOwner = !!operationsSettings.notifyOwner;
        if (operationsSettings.notifyAssignedUser !== undefined) s.notifyAssignedUser = !!operationsSettings.notifyAssignedUser;
        if (typeof operationsSettings.whatsappInternalPhone === 'string') s.whatsappInternalPhone = operationsSettings.whatsappInternalPhone.trim();
        if (operationsSettings.overdueRealertMinutes !== undefined) s.overdueRealertMinutes = num(operationsSettings.overdueRealertMinutes, 5, 1440);
        if (typeof operationsSettings.googleReviewUrl === 'string') {
          const url = operationsSettings.googleReviewUrl.trim();
          if (url && !/^https?:\/\//i.test(url)) {
            return res.status(400).json({ message: 'Google review link must be an http(s) URL' });
          }
          s.googleReviewUrl = url;
        }
        if (typeof operationsSettings.reviewTemplate === 'string') s.reviewTemplate = operationsSettings.reviewTemplate.slice(0, 2000);
        if (operationsSettings.sdTemplates && typeof operationsSettings.sdTemplates === 'object') {
          const allowed = ['handover_details', 'return_reminder', 'overdue_reminder', 'extension_payment_request', 'refund_confirmation'];
          const tpl: Record<string, string> = {};
          for (const k of allowed) {
            if (typeof operationsSettings.sdTemplates[k] === 'string') tpl[k] = operationsSettings.sdTemplates[k].slice(0, 2000);
          }
          s.sdTemplates = tpl;
        }
        const cleanStages = (stages: any) => Array.isArray(stages) ? stages
          .filter((st: any) => Number.isFinite(Number(st?.minutesBefore)))
          .slice(0, 12)
          .map((st: any) => ({
            minutesBefore: Math.max(5, Math.min(1440, Math.round(Number(st.minutesBefore)))),
            enabled: st.enabled !== false,
            whatsappInternal: !!st.whatsappInternal,
            whatsappCustomer: !!st.whatsappCustomer,
            whatsappDriver: !!st.whatsappDriver,
          })) : undefined;
        const sd = cleanStages(operationsSettings.selfDriveStages);
        const wd = cleanStages(operationsSettings.withDriverStages);
        if (sd) s.selfDriveStages = sd;
        if (wd) s.withDriverStages = wd;
        tenant.operationsSettings = { ...(tenant.operationsSettings?.toObject?.() || tenant.operationsSettings || {}), ...s };
      }
      await tenant.save();
      res.json({ policy: resolvePolicy(tenant.toObject()), timezone: tenant.timezone || null });
    } catch (error: any) {
      console.error('Update operations settings error:', error?.message || error);
      res.status(500).json({ message: 'Failed to update operations settings' });
    }
  });

  // Self Drive refund queue (spec §30) — tenant-wide, bounded, SLA-aged.
  app.get('/api/operations/self-drive/refunds', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'open';
      const query: any = { tenantId: req.tenantId, refund: { $exists: true } };
      if (status === 'open') query['refund.status'] = { $in: ['pending', 'partially_refunded'] };
      else if (status === 'closed') query['refund.status'] = { $in: ['refunded', 'forfeited', 'closed'] };
      const trips: any[] = await SelfDriveTrip.find(query)
        .sort({ 'refund.pendingSince': 1 })
        .limit(500)
        .populate({
          path: 'bookingId',
          select: 'bookingId customerName customerPhone customerId vehicleId scheduledEndDateTime status',
          populate: { path: 'vehicleId', select: 'make vehicleModel licensePlate' },
        })
        .lean();
      const now = Date.now();
      const rows = trips.map((t) => {
        const booking: any = t.bookingId && typeof t.bookingId === 'object' ? t.bookingId : null;
        const vehicle: any = booking?.vehicleId && typeof booking.vehicleId === 'object' ? booking.vehicleId : null;
        const comp = computeRefund(t.refund);
        const hoursPending = (now - new Date(t.refund.pendingSince).getTime()) / 3600000;
        return {
          bookingId: booking ? String(booking._id) : String(t.bookingId),
          bookingCode: booking?.bookingId || null,
          customerId: booking?.customerId ? String(booking.customerId) : null,
          customerName: booking?.customerName || null,
          customerPhone: booking?.customerPhone || null,
          vehicle: vehicle ? { make: vehicle.make, model: vehicle.vehicleModel, registrationNumber: vehicle.licensePlate } : null,
          returnedAt: t.returnRecord?.conductedAt || null,
          refundStatus: t.refund.status,
          pendingSince: t.refund.pendingSince,
          hoursPending: Math.round(hoursPending * 10) / 10,
          slaLevel: hoursPending >= 48 ? 'critical' : hoursPending >= 24 ? 'urgent' : hoursPending >= 6 ? 'attention' : 'normal',
          deductions: t.refund.deductions,
          ...comp,
        };
      });
      res.json({ generatedAt: new Date().toISOString(), rows });
    } catch (error: any) {
      console.error('Self-drive refunds queue error:', error?.message || error);
      res.status(500).json({ message: 'Failed to load refund queue' });
    }
  });

  // Self Drive report (spec §45) — bounded period aggregates for the hub's
  // Reports tab; numbers derive from canonical bookings + trips only.
  app.get('/api/operations/self-drive/report', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const days = Math.max(1, Math.min(365, Number(req.query.days) || 30));
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);
      const [bookings, trips] = await Promise.all([
        Booking.find({ tenantId, bookingType: 'self_drive', createdAt: { $gte: since } })
          .select('totalAmount advanceReceived status extensionHistory securityDepositAmount createdAt scheduledEndDateTime')
          .limit(2000).lean() as any,
        SelfDriveTrip.find({ tenantId, updatedAt: { $gte: since } })
          .select('deposit refund returnRecord latePolicy').limit(2000).lean() as any,
      ]);
      const revenue = bookings.reduce((s2: number, b: any) => s2 + (b.totalAmount || 0), 0);
      const received = bookings.reduce((s2: number, b: any) => s2 + (b.advanceReceived || 0), 0);
      const extensionRevenue = bookings.reduce((s2: number, b: any) =>
        s2 + (Array.isArray(b.extensionHistory) ? b.extensionHistory.filter((e: any) => new Date(e.createdAt) >= since).reduce((x: number, e: any) => x + (e.extensionTotal || 0), 0) : 0), 0);
      const deductionsByKind: Record<string, number> = {};
      let lateCharges = 0, refundsCompleted = 0, refundsCompletedAmount = 0, depositsCollected = 0;
      for (const t of trips) {
        if (t.deposit?.amount) depositsCollected += t.deposit.amount;
        if (t.refund) {
          for (const d of t.refund.deductions || []) {
            if (d.waived) continue;
            deductionsByKind[d.kind] = (deductionsByKind[d.kind] || 0) + d.amount;
            if (d.kind === 'late') lateCharges += d.amount;
          }
          if (['refunded', 'closed'].includes(t.refund.status)) {
            refundsCompleted += 1;
            refundsCompletedAmount += (t.refund.transactions || []).reduce((x: number, tr: any) => x + tr.amount, 0);
          }
        }
      }
      res.json({
        periodDays: days, since: since.toISOString(),
        bookings: bookings.length, revenue, received,
        extensionRevenue, depositsCollected,
        lateCharges, deductionsByKind,
        refundsCompleted, refundsCompletedAmount,
        returnsCompleted: trips.filter((t: any) => t.returnRecord).length,
      });
    } catch (error: any) {
      console.error('Self-drive report error:', error?.message || error);
      res.status(500).json({ message: 'Failed to build self-drive report' });
    }
  });

  // Self Drive dashboard KPIs (spec §29) — bounded aggregates, no history scans.
  app.get('/api/operations/self-drive/kpis', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [openRefundTrips, refundedTodayTrips, activeDepositTrips] = await Promise.all([
        SelfDriveTrip.find({ tenantId, 'refund.status': { $in: ['pending', 'partially_refunded'] } }).select('refund').limit(1000).lean(),
        SelfDriveTrip.find({ tenantId, 'refund.transactions.at': { $gte: startOfDay } }).select('refund').limit(1000).lean(),
        // Deposits currently held: collected, trip not yet settled/closed.
        SelfDriveTrip.find({ tenantId, 'deposit.amount': { $gt: 0 }, $or: [{ refund: { $exists: false } }, { 'refund.status': { $in: ['pending', 'partially_refunded'] } }], settlement: { $exists: false } }).select('deposit refund').limit(1000).lean(),
      ]);
      const refundPendingAmount = openRefundTrips.reduce((sum: number, t: any) => sum + computeRefund(t.refund).balance, 0);
      const refundedToday = refundedTodayTrips.reduce((sum: number, t: any) =>
        sum + (t.refund?.transactions || []).filter((x: any) => new Date(x.at) >= startOfDay).reduce((s: number, x: any) => s + x.amount, 0), 0);
      const depositHeld = activeDepositTrips.reduce((sum: number, t: any) => {
        const deposit = t.deposit?.amount || 0;
        const refunded = (t.refund?.transactions || []).reduce((s: number, x: any) => s + x.amount, 0);
        return sum + Math.max(0, deposit - refunded);
      }, 0);
      res.json({
        refundPendingCount: openRefundTrips.length,
        refundPendingAmount,
        refundedToday,
        depositHeld,
      });
    } catch (error: any) {
      console.error('Self-drive KPIs error:', error?.message || error);
      res.status(500).json({ message: 'Failed to load self-drive KPIs' });
    }
  });

  // Manual sweep trigger — idempotent by design (dedupe keys), bounded, and
  // the mechanism E2E tests use instead of waiting hours (spec §71: use an
  // accelerated path, don't fake time in production code).
  app.post('/api/operations/reminders/run', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req: AuthRequest, res) => {
    try {
      const result = await sweepTenant(req.tenantId!);
      res.json({ ok: true, ...result });
    } catch (error: any) {
      console.error('Manual sweep error:', error?.message || error);
      res.status(500).json({ message: 'Failed to run reminder sweep' });
    }
  });
}
