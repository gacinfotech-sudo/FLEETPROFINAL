// TASK-DRIVER-DOMAIN-02 — HTTP surface for the driver lifecycle domain.
//
// Follows the exact registration pattern already established by the GPS
// module (server/gps/routes/connections.ts's registerGpsConnectionRoutes,
// read-only reference — not modified): a register*Routes(app) function
// called once from server/routes.ts's registerRoutes(). This file cannot
// be wired in directly (server/routes.ts is a forbidden file for this
// task) — the one import line + one call line are proposed in the task
// report, matching the GPS/booking precedent's "propose the patch"
// convention.
//
// Every route here is a STAFF route (authenticateUser + requireTenant),
// never mounted on the separate driver-portal auth boundary
// (server/middleware/driverAuth.ts's authenticateDriver) — per the
// manifest's highest-severity risk note, no route here is added to that
// small allow-list, and none of these paths overlap with any
// /api/driver-portal/* route.
import type { Express, NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { canViewFullDriverContacts } from './access';
import {
  ContactPolicyViolationError, DuplicateContactPhoneError,
  createDriverContact, deactivateDriverContact, getDriverContactPolicy,
  listDriverContacts, setContactVerificationStatus, setDriverContactPolicy,
} from './contactService';
import { listDriverAuditLog } from './auditLogService';
import { DriverNotFoundError as EmploymentDriverNotFoundError } from './employmentHistoryService';
import {
  createEmploymentHistoryEntry, deactivateEmploymentHistoryEntry,
  listEmploymentHistory, setEmploymentHistoryVerificationStatus,
} from './employmentHistoryService';
import { isEligibleForAssignment } from './eligibility';
import {
  DriverNotFoundError as LifecycleDriverNotFoundError,
  InvalidLifecycleTransitionError, getEffectiveLifecycleStage, transitionLifecycleStage,
} from './lifecycleService';
import { CONTACT_CATEGORIES, LIFECYCLE_STAGES, type LifecycleStage } from './types';

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function actorFrom(req: AuthRequest) {
  return { userId: req.userId!, role: req.user?.role || 'client' };
}

function invalidId(res: Response, label = 'driver ID') {
  return res.status(400).json({ message: `Invalid ${label}.` });
}

export function registerDriverDomainRoutes(app: Express): void {
  // ---------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------
  app.get('/api/drivers/:id/contacts', authenticateUser, requireTenant, safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    const canViewFull = canViewFullDriverContacts(req.user);
    try {
      const contacts = await listDriverContacts({ tenantId: req.tenantId!, driverId: req.params.id, canViewFull });
      res.json({ contacts, fullListAccess: canViewFull });
    } catch (error) {
      if (error instanceof EmploymentDriverNotFoundError) return res.status(404).json({ message: 'Driver not found.' });
      throw error;
    }
  }));

  app.post('/api/drivers/:id/contacts', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    if (!CONTACT_CATEGORIES.includes(req.body?.contactCategory)) {
      return res.status(400).json({ message: `contactCategory must be one of: ${CONTACT_CATEGORIES.join(', ')}` });
    }
    if (!req.body?.fullName || !req.body?.primaryMobile) {
      return res.status(400).json({ message: 'fullName and primaryMobile are required.' });
    }
    try {
      const contact = await createDriverContact({
        tenantId: req.tenantId!, driverId: req.params.id, actor: actorFrom(req),
        fullName: req.body.fullName, relationship: req.body.relationship,
        contactCategory: req.body.contactCategory, primaryMobile: req.body.primaryMobile,
        alternateMobile: req.body.alternateMobile, address: req.body.address,
        occupation: req.body.occupation, preferredLanguage: req.body.preferredLanguage,
        emergencyPriority: req.body.emergencyPriority,
        consentStatus: req.body.consentStatus, notificationStatus: req.body.notificationStatus,
        notes: req.body.notes,
      });
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof EmploymentDriverNotFoundError) return res.status(404).json({ message: 'Driver not found.' });
      if (error instanceof DuplicateContactPhoneError) return res.status(409).json({ message: error.message, code: 'DUPLICATE_CONTACT_PHONE' });
      if (error instanceof ContactPolicyViolationError) return res.status(400).json({ message: error.message, code: 'CONTACT_POLICY_VIOLATION' });
      throw error;
    }
  }));

  app.post('/api/drivers/:id/contacts/:contactId/verification', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.contactId)) return invalidId(res, 'ID');
    const { status, verificationMethod, reason } = req.body || {};
    if (!['unverified', 'pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid verification status.' });
    }
    const contact = await setContactVerificationStatus({
      tenantId: req.tenantId!, driverId: req.params.id, contactId: req.params.contactId,
      actor: actorFrom(req), status, verificationMethod, reason,
    });
    if (!contact) return res.status(404).json({ message: 'Contact not found.' });
    res.json(contact);
  }));

  // Soft removal only — see contactService.deactivateDriverContact. No
  // route in this file ever calls deleteOne/findOneAndDelete/.remove().
  app.delete('/api/drivers/:id/contacts/:contactId', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.contactId)) return invalidId(res, 'ID');
    const contact = await deactivateDriverContact({
      tenantId: req.tenantId!, driverId: req.params.id, contactId: req.params.contactId,
      actor: actorFrom(req), reason: req.body?.reason,
    });
    if (!contact) return res.status(404).json({ message: 'Contact not found.' });
    res.json({ message: 'Contact deactivated.', contact });
  }));

  // Tenant-wide contact policy (backs the >4-contacts businessPurpose
  // gate). Not in the task's minimum "Expected APIs" list but required to
  // make that acceptance criterion testable/configurable at all.
  app.get('/api/driver-contact-policy', authenticateUser, requireTenant, safeAsync(async (req, res) => {
    res.json(await getDriverContactPolicy(req.tenantId!));
  }));

  app.post('/api/driver-contact-policy', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    const { maxContacts, businessPurpose } = req.body || {};
    if (typeof maxContacts !== 'number' || maxContacts < 1) {
      return res.status(400).json({ message: 'maxContacts must be a positive number.' });
    }
    try {
      const policy = await setDriverContactPolicy({ tenantId: req.tenantId!, maxContacts, businessPurpose, actor: actorFrom(req) });
      res.json(policy);
    } catch (error) {
      if (error instanceof ContactPolicyViolationError) return res.status(400).json({ message: error.message, code: 'CONTACT_POLICY_VIOLATION' });
      throw error;
    }
  }));

  // ---------------------------------------------------------------------
  // Employment history
  // ---------------------------------------------------------------------
  app.get('/api/drivers/:id/employment-history', authenticateUser, requireTenant, safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    try {
      const entries = await listEmploymentHistory({ tenantId: req.tenantId!, driverId: req.params.id });
      res.json(entries);
    } catch (error) {
      if (error instanceof EmploymentDriverNotFoundError) return res.status(404).json({ message: 'Driver not found.' });
      throw error;
    }
  }));

  app.post('/api/drivers/:id/employment-history', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    if (!req.body?.employerName || !req.body?.startDate) {
      return res.status(400).json({ message: 'employerName and startDate are required.' });
    }
    try {
      const entry = await createEmploymentHistoryEntry({
        tenantId: req.tenantId!, driverId: req.params.id, actor: actorFrom(req),
        employerName: req.body.employerName, role: req.body.role,
        startDate: req.body.startDate, endDate: req.body.endDate,
        contactForVerification: req.body.contactForVerification, notes: req.body.notes,
      });
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof EmploymentDriverNotFoundError) return res.status(404).json({ message: 'Driver not found.' });
      throw error;
    }
  }));

  app.post('/api/drivers/:id/employment-history/:entryId/verification', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.entryId)) return invalidId(res, 'ID');
    const { status, reason } = req.body || {};
    if (!['unverified', 'pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid verification status.' });
    }
    const entry = await setEmploymentHistoryVerificationStatus({
      tenantId: req.tenantId!, driverId: req.params.id, entryId: req.params.entryId,
      actor: actorFrom(req), status, reason,
    });
    if (!entry) return res.status(404).json({ message: 'Employment history entry not found.' });
    res.json(entry);
  }));

  app.delete('/api/drivers/:id/employment-history/:entryId', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.entryId)) return invalidId(res, 'ID');
    const entry = await deactivateEmploymentHistoryEntry({
      tenantId: req.tenantId!, driverId: req.params.id, entryId: req.params.entryId,
      actor: actorFrom(req), reason: req.body?.reason,
    });
    if (!entry) return res.status(404).json({ message: 'Employment history entry not found.' });
    res.json({ message: 'Employment history entry deactivated.', entry });
  }));

  // ---------------------------------------------------------------------
  // Lifecycle stage
  // ---------------------------------------------------------------------
  app.get('/api/drivers/:id/lifecycle-stage', authenticateUser, requireTenant, safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    try {
      const lifecycleStage = await getEffectiveLifecycleStage(req.tenantId!, req.params.id);
      res.json({ driverId: req.params.id, lifecycleStage });
    } catch (error) {
      if (error instanceof LifecycleDriverNotFoundError) return res.status(404).json({ message: 'Driver not found.' });
      throw error;
    }
  }));

  app.post('/api/drivers/:id/lifecycle-stage', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    const targetStage = req.body?.lifecycleStage as LifecycleStage;
    if (!LIFECYCLE_STAGES.includes(targetStage)) {
      return res.status(400).json({ message: `lifecycleStage must be one of: ${LIFECYCLE_STAGES.join(', ')}` });
    }
    try {
      const result = await transitionLifecycleStage({
        tenantId: req.tenantId!, driverId: req.params.id, targetStage,
        actor: actorFrom(req), reason: req.body?.reason,
      });
      res.json({ driverId: req.params.id, ...result });
    } catch (error) {
      if (error instanceof LifecycleDriverNotFoundError) return res.status(404).json({ message: 'Driver not found.' });
      if (error instanceof InvalidLifecycleTransitionError) {
        return res.status(409).json({ message: error.message, code: 'INVALID_LIFECYCLE_TRANSITION', from: error.from, to: error.to });
      }
      throw error;
    }
  }));

  // ---------------------------------------------------------------------
  // Revision history (spec §6) — read-only; entries are only ever written
  // by this module's own services, never edited or deleted.
  // ---------------------------------------------------------------------
  app.get('/api/drivers/:id/audit-log', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    const entries = await listDriverAuditLog({ tenantId: req.tenantId!, driverId: req.params.id });
    res.json(entries);
  }));

  // ---------------------------------------------------------------------
  // Assignment eligibility (read-only probe; the real gate is wired into
  // checkDriverAvailability() via the proposed availability.ts patch).
  // ---------------------------------------------------------------------
  app.get('/api/drivers/:id/assignment-eligibility', authenticateUser, requireTenant, safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    const result = await isEligibleForAssignment(req.tenantId!, req.params.id);
    res.json(result);
  }));
}
