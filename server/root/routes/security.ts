// TASK-ROOT-SECURITY-05 — Security routes: Support Access mode, break-glass
// access, and the Security Command Center (extends the existing
// GET /api/admin/security/stats precedent at server/routes.ts:1144 rather
// than replacing it — see the report for exact proposed mount lines).
//
// NOT MOUNTED by this task — server/routes.ts is Integrator-only. Proposed
// mount line (see report for the full list):
//   app.use('/api/root', authenticateUser, securityRouter);
// `authenticateUser` MUST run before this router for every route here —
// `requirePlatformRoleLocal` reads `req.user`, which only `authenticateUser`
// populates. Routes are written relative to that `/api/root` mount, e.g.
// `POST /tenants/:id/support-access` below resolves to the expected API
// `POST /api/root/tenants/:id/support-access`.
//
// INTEGRATION NOTE (resolved at merge of integration/root-control-plane-wave1):
// this router now uses the real `rootAccessService.requirePlatformRole` from
// TASK-ROOT-DOMAIN-01's `server/root/services/rootAccessService.ts` (identical
// behavior to the `requirePlatformRoleLocal` stand-in this task originally
// shipped — 403 unless `req.user.platformRole` is in the allowed list).

import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import type { AuthRequest } from '../../middleware/auth';
import { loginAttempts, type LoginAttempt } from '../../middleware/security';
import type { PlatformRole } from '../types';
import { rootAccessService } from '../services/rootAccessService';
import { recordPlatformAuditEvent } from '../models/auditLog';
import {
  createBreakGlassEvent,
  revokeBreakGlassEvent,
  listRecentBreakGlassEvents,
  isBreakGlassEventActive,
  BreakGlassValidationError,
} from '../services/breakGlassService';

const ALL_PLATFORM_ROLES: PlatformRole[] = [
  'PLATFORM_ROOT',
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_SUPPORT_ADMIN',
  'PLATFORM_FINANCE_ADMIN',
  'PLATFORM_SECURITY_ADMIN',
  'PLATFORM_READ_ONLY_AUDITOR',
];

/** Delegates to the canonical `RootAccessService.requirePlatformRole`. Kept as
 * a named export (still called `requirePlatformRoleLocal` elsewhere in this
 * router and re-exported for `audit.ts`) to minimize diff churn. */
export const requirePlatformRoleLocal = rootAccessService.requirePlatformRole;

export const securityRouter = Router();

// ---------------------------------------------------------------------------
// Support Access mode
// ---------------------------------------------------------------------------
// State lives server-side in the authenticated session (express-session,
// backed by the existing MongoStore — server/routes.ts:280-282), never in a
// client-readable-only place, so "the banner state is derivable from an API
// response (not just client-side UI state that could be spoofed)" holds: a
// tenant-scoped client cannot forge req.session server-side, and GET
// /support-access/status is the only way to read it.
//
// Deliberately read-only in this task: no write-mode toggle is implemented
// (see report "Deviations" — read-only-by-default is the acceptance
// criterion; a scoped write-override is flagged as follow-up, not silently
// implied to exist).

interface SupportAccessSessionState {
  tenantId: string;
  reason: string;
  ticketReference?: string;
  actorUserId: string;
  actorPlatformRole?: string;
  enteredAt: string;
  readOnly: true;
}

function getSupportAccessState(req: AuthRequest): SupportAccessSessionState | null {
  return (req.session as unknown as { rootSupportAccess?: SupportAccessSessionState })?.rootSupportAccess ?? null;
}

securityRouter.post(
  '/tenants/:id/support-access',
  requirePlatformRoleLocal(ALL_PLATFORM_ROLES),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.params.id;
      const reason = (req.body?.reason ?? '').trim();
      const ticketReference = req.body?.ticketReference ? String(req.body.ticketReference).trim() : undefined;

      if (!tenantId) return res.status(400).json({ message: 'tenantId is required' });
      if (!reason) return res.status(400).json({ message: 'reason is required to enter Support Access mode' });

      const actorUserId = req.user?.userId ?? req.userId;
      const actorPlatformRole = (req.user as { platformRole?: PlatformRole } | undefined)?.platformRole;

      const state: SupportAccessSessionState = {
        tenantId,
        reason,
        ticketReference,
        actorUserId,
        actorPlatformRole,
        enteredAt: new Date().toISOString(),
        readOnly: true,
      };
      (req.session as unknown as { rootSupportAccess?: SupportAccessSessionState }).rootSupportAccess = state;

      await recordPlatformAuditEvent({
        userId: actorUserId,
        actorPlatformRole,
        action: 'support_access.enter',
        targetTenantId: tenantId,
        targetEntity: `Tenant:${tenantId}`,
        reason,
        newValue: { ticketReference, readOnly: true },
      });

      res.json({ active: true, ...state });
    } catch (error) {
      console.error('support-access enter error:', error);
      res.status(500).json({ message: 'Failed to enter Support Access mode' });
    }
  },
);

securityRouter.post(
  '/tenants/:id/support-access/exit',
  requirePlatformRoleLocal(ALL_PLATFORM_ROLES),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = getSupportAccessState(req);
      const actorUserId = req.user?.userId ?? req.userId;
      const actorPlatformRole = (req.user as { platformRole?: PlatformRole } | undefined)?.platformRole;

      if (existing) {
        await recordPlatformAuditEvent({
          userId: actorUserId,
          actorPlatformRole,
          action: 'support_access.exit',
          targetTenantId: existing.tenantId,
          targetEntity: `Tenant:${existing.tenantId}`,
          reason: existing.reason,
        });
      }

      delete (req.session as unknown as { rootSupportAccess?: SupportAccessSessionState }).rootSupportAccess;
      res.json({ active: false });
    } catch (error) {
      console.error('support-access exit error:', error);
      res.status(500).json({ message: 'Failed to exit Support Access mode' });
    }
  },
);

// Gated by requirePlatformRoleLocal like every other route in this router —
// deliberately, even though the data it returns is low-sensitivity, so the
// invariant "no tenant-scoped session reaches ANY /api/root/** route in this
// task" holds uniformly rather than carving out an exception per endpoint.
securityRouter.get('/support-access/status', requirePlatformRoleLocal(ALL_PLATFORM_ROLES), async (req: AuthRequest, res: Response) => {
  const state = getSupportAccessState(req);
  res.json(state ? { active: true, ...state } : { active: false });
});

// ---------------------------------------------------------------------------
// Break-glass access
// ---------------------------------------------------------------------------

securityRouter.post('/break-glass', requirePlatformRoleLocal(ALL_PLATFORM_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const actorUserId = req.user?.userId ?? req.userId;
    const actorPlatformRole = (req.user as { platformRole?: PlatformRole } | undefined)?.platformRole;

    const event = await createBreakGlassEvent({
      actorUserId,
      actorPlatformRole,
      reason: req.body?.reason,
      ticketReference: req.body?.ticketReference,
      scope: req.body?.scope,
      tenantId: req.body?.tenantId,
      durationMinutes: Number(req.body?.durationMinutes),
    });

    res.status(201).json({
      id: event.id,
      scope: event.scope,
      tenantId: event.tenantId,
      reason: event.reason,
      ticketReference: event.ticketReference,
      durationMinutes: event.durationMinutes,
      expiresAt: event.expiresAt,
      active: isBreakGlassEventActive(event),
    });
  } catch (error) {
    if (error instanceof BreakGlassValidationError) {
      return res.status(400).json({ message: error.message });
    }
    console.error('break-glass create error:', error);
    res.status(500).json({ message: 'Failed to create break-glass event' });
  }
});

securityRouter.post(
  '/break-glass/:id/revoke',
  requirePlatformRoleLocal(ALL_PLATFORM_ROLES),
  async (req: AuthRequest, res: Response) => {
    try {
      const actorUserId = req.user?.userId ?? req.userId;
      const actorPlatformRole = (req.user as { platformRole?: PlatformRole } | undefined)?.platformRole;
      const event = await revokeBreakGlassEvent(req.params.id, actorUserId, actorPlatformRole);
      res.json({ id: event.id, revokedAt: event.revokedAt, active: isBreakGlassEventActive(event) });
    } catch (error) {
      console.error('break-glass revoke error:', error);
      res.status(500).json({ message: 'Failed to revoke break-glass event' });
    }
  },
);

// ---------------------------------------------------------------------------
// Security Command Center
// ---------------------------------------------------------------------------
// Extends GET /api/admin/security/stats (server/routes.ts:1144) — reuses the
// exact same in-memory `loginAttempts` tracker from
// server/middleware/security.ts for failed-login data (not a second,
// competing implementation), and adds active-session count, break-glass
// event listing, and an explicit MFA-not-implemented placeholder. MFA is
// out of scope for this task and this wave — see this task's report.

securityRouter.get('/security/events', requirePlatformRoleLocal(ALL_PLATFORM_ROLES), async (_req: AuthRequest, res: Response) => {
  try {
    const allAttempts: LoginAttempt[] = [];
    Array.from(loginAttempts.entries()).forEach(([, userAttempts]) => {
      allAttempts.push(...userAttempts);
    });

    const recentAttempts = allAttempts.filter(
      (attempt) => Date.now() - attempt.timestamp.getTime() < 24 * 60 * 60 * 1000,
    );
    const failedAttempts = recentAttempts.filter((attempt) => !attempt.success);
    const uniqueFailedIPs = Array.from(new Set(failedAttempts.map((attempt) => attempt.ip)));
    const failedByUser = failedAttempts.reduce((acc: Record<string, number>, attempt) => {
      acc[attempt.userId] = (acc[attempt.userId] || 0) + 1;
      return acc;
    }, {});

    // Best-effort active-session count read from the same MongoStore
    // collection ('sessions') the app already persists sessions to
    // (server/routes.ts:280-282). Only a count + expiry are surfaced —
    // never the raw session payload, which can carry fingerprint/user-agent
    // data that doesn't belong in a dashboard response.
    let activeSessionCount: number | null = null;
    try {
      activeSessionCount = await mongoose.connection
        .collection('sessions')
        .countDocuments({ expires: { $gt: new Date() } });
    } catch (sessionCountError) {
      console.error('security/events: failed to count active sessions:', sessionCountError);
    }

    const breakGlassEvents = await listRecentBreakGlassEvents(20);

    res.json({
      failedLogins: failedAttempts.length,
      uniqueFailedIPs: uniqueFailedIPs.length,
      suspiciousUsers: Object.entries(failedByUser)
        .filter(([, count]) => (count as number) >= 3)
        .map(([userId, count]) => ({ userId, attempts: count })),
      recentFailures: failedAttempts.slice(-10).map((attempt) => ({
        userId: attempt.userId,
        ip: attempt.ip,
        timestamp: attempt.timestamp,
        userAgent: attempt.userAgent,
      })),
      activeSessions: activeSessionCount,
      breakGlassEvents: breakGlassEvents.map((event) => ({
        id: event.id,
        scope: event.scope,
        tenantId: event.tenantId,
        actorUserId: event.actorUserId,
        reason: event.reason,
        ticketReference: event.ticketReference,
        durationMinutes: event.durationMinutes,
        expiresAt: event.expiresAt,
        revokedAt: event.revokedAt,
        active: isBreakGlassEventActive(event),
        createdAt: event.createdAt,
      })),
      // MFA is explicitly out of scope for this task and this wave — see
      // ROOT-CONTROL-PLANE-MANIFEST.md and this task's report. This is a
      // real placeholder, not a fake success state.
      mfaStatus: 'not_implemented',
    });
  } catch (error) {
    console.error('Error getting Root security events:', error);
    res.status(500).json({ message: 'Failed to get security events' });
  }
});
