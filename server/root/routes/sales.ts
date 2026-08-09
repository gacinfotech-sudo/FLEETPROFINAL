// TASK-ROOT-SALES-CONFIG-04 — Sales / Onboarding CRM routes.
//
// "Create Tenant" on a WON prospect reuses the *exact same* underlying
// logic POST /api/admin/tenants already calls (mongoTenantSchema.parse +
// storage.createTenant) — see the imports below. This file never edits or
// duplicates the /api/admin/tenants route itself (server/routes.ts is not
// in this task's owned files).
//
// Not mounted here — see this task's report for the proposed
// `registerSalesRoutes(app)` mount line. server/routes.ts is Integrator-only.

import type { Express, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, type AuthRequest } from '../../middleware/auth';
import { storage } from '../../storage-mongodb';
import { mongoTenantSchema } from '../../schemas/mongodb-schemas';
import { Prospect, PROSPECT_STAGES, isValidStageTransition, type ProspectStage } from '../models/prospect';
import { rootAccessService } from '../services/rootAccessService';

// Repointed at integration to the canonical RootAccessService
// (server/root/services/rootAccessService.ts, TASK-ROOT-DOMAIN-01) — this
// task's original `_localPlatformAccess.ts` placeholder remains in the repo
// only because this task's own tests (server/root/__tests__/*.test.ts)
// still exercise it directly by name.
const requirePlatformRole = rootAccessService.requirePlatformRole;
const recordAuditEvent = rootAccessService.recordAuditEvent;

// Wave-1 policy choice (documented in this task's report): Sales CRM is
// gated to the two broadest platform roles. A future task can widen this
// (e.g. a dedicated PLATFORM_SALES_ADMIN role) without touching this file's
// route logic, only this constant.
const SALES_ROLES = ['PLATFORM_ROOT', 'PLATFORM_SUPER_ADMIN'] as const;

const createProspectSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(254),
  contactPhone: z.string().trim().max(40).optional(),
  source: z.enum(['website', 'referral', 'cold_outreach', 'event', 'partner', 'other']).optional(),
  dealValueMonthlyUsd: z.number().min(0).optional(),
  assignedTo: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(5000).optional(),
  nextFollowUpAt: z.coerce.date().optional(),
});

const updateProspectSchema = z.object({
  companyName: z.string().trim().min(1).max(200).optional(),
  contactName: z.string().trim().min(1).max(200).optional(),
  contactEmail: z.string().trim().email().max(254).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  source: z.enum(['website', 'referral', 'cold_outreach', 'event', 'partner', 'other']).optional(),
  dealValueMonthlyUsd: z.number().min(0).optional(),
  assignedTo: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(5000).optional(),
  nextFollowUpAt: z.coerce.date().optional(),
  stage: z.enum(PROSPECT_STAGES).optional(),
  lostReason: z.string().trim().max(1000).optional(),
  stageNote: z.string().trim().max(1000).optional(),
}).strict();

const createTenantFromProspectSchema = z.object({
  name: z.string().min(1).optional(),
  businessName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  subscriptionPlan: z.enum(['starter', 'pro', 'custom']).optional(),
  limits: z.object({
    vehicles: z.number().min(1).optional(),
    drivers: z.number().min(1).optional(),
    managers: z.number().min(1).optional(),
  }).optional(),
}).optional();

export function registerSalesRoutes(app: Express): void {
  app.get('/api/root/sales/prospects', authenticateUser, requirePlatformRole([...SALES_ROLES]), async (req: AuthRequest, res: Response) => {
    try {
      const filter: Record<string, unknown> = {};
      const stage = req.query.stage;
      if (typeof stage === 'string' && (PROSPECT_STAGES as readonly string[]).includes(stage)) {
        filter.stage = stage;
      }
      const prospects = await Prospect.find(filter).sort({ createdAt: -1 });
      res.json(prospects);
    } catch (error) {
      console.error('Error listing prospects:', error);
      res.status(500).json({ message: 'Failed to list prospects' });
    }
  });

  app.post('/api/root/sales/prospects', authenticateUser, requirePlatformRole([...SALES_ROLES]), async (req: AuthRequest, res: Response) => {
    try {
      const data = createProspectSchema.parse(req.body);
      const prospect = await Prospect.create({
        ...data,
        stage: 'PROSPECT',
        stageHistory: [{ stage: 'PROSPECT', changedAt: new Date(), changedBy: req.userId }],
        createdBy: req.userId,
      });
      await recordAuditEvent({
        actorUserId: req.userId!,
        actorPlatformRole: (req.user as any)?.platformRole,
        action: 'sales.prospect.created',
        resourceType: 'Prospect',
        resourceId: prospect.id,
        newValue: { companyName: prospect.companyName, stage: prospect.stage },
      });
      res.status(201).json(prospect);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid prospect data', errors: error.errors });
      }
      console.error('Error creating prospect:', error);
      res.status(500).json({ message: 'Failed to create prospect' });
    }
  });

  app.get('/api/root/sales/prospects/:id', authenticateUser, requirePlatformRole([...SALES_ROLES]), async (req: AuthRequest, res: Response) => {
    try {
      const prospect = await Prospect.findById(req.params.id);
      if (!prospect) return res.status(404).json({ message: 'Prospect not found' });
      res.json(prospect);
    } catch (error) {
      console.error('Error fetching prospect:', error);
      res.status(500).json({ message: 'Failed to fetch prospect' });
    }
  });

  app.patch('/api/root/sales/prospects/:id', authenticateUser, requirePlatformRole([...SALES_ROLES]), async (req: AuthRequest, res: Response) => {
    try {
      const data = updateProspectSchema.parse(req.body);
      const prospect = await Prospect.findById(req.params.id);
      if (!prospect) return res.status(404).json({ message: 'Prospect not found' });

      const { stage: nextStage, stageNote, lostReason, ...rest } = data;
      Object.assign(prospect, rest);

      if (nextStage && nextStage !== prospect.stage) {
        // WON -> TENANT_CREATED is only ever performed by the create-tenant
        // route below (it needs to actually create the tenant first) — a
        // plain PATCH may not jump straight to TENANT_CREATED.
        if (nextStage === 'TENANT_CREATED') {
          return res.status(400).json({ message: 'Use POST /prospects/:id/create-tenant to move a WON prospect to TENANT_CREATED' });
        }
        if (!isValidStageTransition(prospect.stage, nextStage)) {
          return res.status(400).json({ message: `Cannot move from ${prospect.stage} to ${nextStage}` });
        }
        const oldStage = prospect.stage;
        prospect.stage = nextStage;
        prospect.stageHistory.push({ stage: nextStage, changedAt: new Date(), changedBy: req.userId!, note: stageNote });
        if (nextStage === 'WON') prospect.wonAt = new Date();
        if (nextStage === 'LOST') {
          prospect.lostAt = new Date();
          if (lostReason) prospect.lostReason = lostReason;
        }
        await recordAuditEvent({
          actorUserId: req.userId!,
          actorPlatformRole: (req.user as any)?.platformRole,
          action: 'sales.prospect.stage_changed',
          resourceType: 'Prospect',
          resourceId: prospect.id,
          oldValue: { stage: oldStage },
          newValue: { stage: nextStage },
        });
      }

      await prospect.save();
      res.json(prospect);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid prospect data', errors: error.errors });
      }
      console.error('Error updating prospect:', error);
      res.status(500).json({ message: 'Failed to update prospect' });
    }
  });

  // "Create Tenant" on a WON prospect. Reuses the exact same underlying
  // logic as POST /api/admin/tenants (mongoTenantSchema.parse +
  // storage.createTenant) — this is deliberately NOT a second
  // implementation of tenant creation.
  app.post('/api/root/sales/prospects/:id/create-tenant', authenticateUser, requirePlatformRole([...SALES_ROLES]), async (req: AuthRequest, res: Response) => {
    try {
      const prospect = await Prospect.findById(req.params.id);
      if (!prospect) return res.status(404).json({ message: 'Prospect not found' });
      if (prospect.stage !== 'WON') {
        return res.status(400).json({ message: `Prospect must be WON to create a tenant (currently ${prospect.stage})` });
      }
      if (prospect.tenantId) {
        return res.status(409).json({ message: 'A tenant has already been created for this prospect' });
      }

      const overrides = createTenantFromProspectSchema.parse(req.body) ?? {};
      const tenantData = mongoTenantSchema.parse({
        name: overrides.name ?? prospect.companyName,
        businessName: overrides.businessName ?? prospect.companyName,
        email: overrides.email ?? prospect.contactEmail,
        phone: overrides.phone ?? prospect.contactPhone,
        address: overrides.address,
        subscriptionPlan: overrides.subscriptionPlan ?? 'starter',
        limits: overrides.limits,
      });

      // The exact same storage-layer call POST /api/admin/tenants makes.
      const tenant = await storage.createTenant(tenantData);

      const oldStage = prospect.stage;
      prospect.tenantId = tenant._id as any;
      prospect.tenantCreatedAt = new Date();
      prospect.stage = 'TENANT_CREATED';
      prospect.stageHistory.push({
        stage: 'TENANT_CREATED',
        changedAt: new Date(),
        changedBy: req.userId!,
        note: `Tenant created: ${tenant._id}`,
      });
      await prospect.save();

      await recordAuditEvent({
        actorUserId: req.userId!,
        actorPlatformRole: (req.user as any)?.platformRole,
        action: 'sales.prospect.tenant_created',
        targetTenantId: String(tenant._id),
        resourceType: 'Prospect',
        resourceId: prospect.id,
        oldValue: { stage: oldStage },
        newValue: { stage: 'TENANT_CREATED', tenantId: String(tenant._id) },
      });

      res.status(201).json({ prospect, tenant });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid tenant data', errors: error.errors });
      }
      console.error('Error creating tenant from prospect:', error);
      res.status(500).json({ message: 'Failed to create tenant' });
    }
  });
}
