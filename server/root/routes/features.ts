// TASK-ROOT-SALES-CONFIG-04 — Tenant Feature Flags routes.
//
// GET returns the effective state for every module in FEATURE_MODULES
// (explicit per-tenant override if one exists, else the tenant's resolved
// Plan default — see featureFlag.ts's resolveFeatureState). PATCH sets an
// explicit per-tenant override and always records an audit event.
//
// Disabling a flag here only ever writes to the FeatureFlag collection —
// it never touches any other module's collections (proven by
// server/root/__tests__/featureFlagDataPreservation.test.ts).
//
// Not mounted here — see this task's report for the proposed
// `registerFeatureFlagRoutes(app)` mount line.

import type { Express, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, type AuthRequest } from '../../middleware/auth';
import { Tenant } from '../../models';
import {
  FeatureFlag,
  FEATURE_MODULES,
  FEATURE_FLAG_STATES,
  resolveFeatureState,
  type FeatureModule,
} from '../models/featureFlag';
import { requirePlatformRole, recordAuditEvent } from './_localPlatformAccess';

const FEATURE_ROLES = ['PLATFORM_ROOT', 'PLATFORM_SUPER_ADMIN'] as const;

const updateFeatureFlagSchema = z.object({
  feature: z.enum(FEATURE_MODULES),
  state: z.enum(FEATURE_FLAG_STATES),
  reason: z.string().trim().max(1000).optional(),
}).strict();

export function registerFeatureFlagRoutes(app: Express): void {
  app.get('/api/root/tenants/:tenantId/features', authenticateUser, requirePlatformRole([...FEATURE_ROLES]), async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await Tenant.findById(req.params.tenantId);
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

      const explicitFlags = await FeatureFlag.find({ tenantId: req.params.tenantId });
      const explicitByFeature = new Map(explicitFlags.map((f) => [f.feature, f]));

      const result = await Promise.all(
        (FEATURE_MODULES as readonly FeatureModule[]).map(async (feature) => {
          const explicit = explicitByFeature.get(feature);
          const state = await resolveFeatureState(req.params.tenantId, feature);
          return {
            feature,
            state,
            source: explicit ? 'tenant_override' : 'plan_default',
            updatedBy: explicit?.updatedBy,
            updatedAt: explicit?.updatedAt,
            reason: explicit?.reason,
          };
        }),
      );

      res.json(result);
    } catch (error) {
      console.error('Error listing tenant feature flags:', error);
      res.status(500).json({ message: 'Failed to list feature flags' });
    }
  });

  app.patch('/api/root/tenants/:tenantId/features', authenticateUser, requirePlatformRole([...FEATURE_ROLES]), async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await Tenant.findById(req.params.tenantId);
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

      const { feature, state, reason } = updateFeatureFlagSchema.parse(req.body);

      // Capture the effective state *before* this change (whether it came
      // from an explicit prior override or the plan default) so the audit
      // event's oldValue is meaningful either way.
      const oldState = await resolveFeatureState(req.params.tenantId, feature);

      const flag = await FeatureFlag.findOneAndUpdate(
        { tenantId: req.params.tenantId, feature },
        { $set: { state, updatedBy: req.userId, reason } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      // Every change MUST produce an audit event — this is the local
      // placeholder for RootAccessService.recordAuditEvent (see
      // routes/_localPlatformAccess.ts). Deliberately does not touch any
      // collection other than FeatureFlag + this audit ledger.
      await recordAuditEvent({
        actorUserId: req.userId!,
        actorRole: (req.user as any)?.platformRole,
        action: 'features.flag.updated',
        tenantId: req.params.tenantId,
        targetType: 'FeatureFlag',
        targetId: String(feature),
        oldValue: { feature, state: oldState },
        newValue: { feature, state },
        reason,
      });

      res.json(flag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid feature flag data', errors: error.errors });
      }
      console.error('Error updating tenant feature flag:', error);
      res.status(500).json({ message: 'Failed to update feature flag' });
    }
  });
}
