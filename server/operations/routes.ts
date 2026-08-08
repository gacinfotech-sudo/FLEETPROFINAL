// Live Operations HTTP surface — registered from routes.ts with one call so
// the shared route registry stays a single line. Everything here is a VIEW
// or an action over canonical Booking/Tenant/OperationsAlert records.

import type { Express } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../middleware/auth';
import { requirePermission, PERMISSIONS } from '../middleware/permissions';
import { Tenant, OperationsAlert, OperationsActivity, Booking } from '../models/index';
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
