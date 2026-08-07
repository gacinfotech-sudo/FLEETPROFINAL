// TASK-ROOT-SALES-CONFIG-04 — Product Configuration + Plan catalog routes.
//
// Product Configuration is a single canonical config document (not
// scattered constants) — model defined in this file since this task's
// owned-files list doesn't include a separate productConfig model file.
// Plan catalog CRUD lives here too (Product Configuration's "plan catalog"
// per this task's spec), while the Plan *model* + resolution helpers live
// in server/root/models/plan.ts.
//
// Not mounted here — see this task's report for the proposed
// `registerConfigRoutes(app)` mount line.

import type { Express, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { z } from 'zod';
import { authenticateUser, type AuthRequest } from '../../middleware/auth';
import { Plan, PLAN_CODES, LEGACY_SUBSCRIPTION_PLANS, ensureDefaultPlansSeeded } from '../models/plan';
import { rootAccessService } from '../services/rootAccessService';

// Repointed at integration to the canonical RootAccessService — see
// sales.ts's header comment for why _localPlatformAccess.ts remains (its
// own tests still exercise it directly).
const requirePlatformRole = rootAccessService.requirePlatformRole;
const recordAuditEvent = rootAccessService.recordAuditEvent;

const CONFIG_ROLES = ['PLATFORM_ROOT', 'PLATFORM_SUPER_ADMIN'] as const;

// --- Product Configuration model (singleton) --------------------------

export interface IProductConfig extends Document {
  productName: string;
  supportEmail?: string;
  supportPhone?: string;
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    companyLegalName?: string;
  };
  billingContact?: {
    name?: string;
    email?: string;
  };
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductConfigSchema = new Schema<IProductConfig>({
  productName: { type: String, required: true, default: 'FleetPro', maxlength: 200 },
  supportEmail: { type: String, maxlength: 254 },
  supportPhone: { type: String, maxlength: 40 },
  branding: {
    logoUrl: { type: String, maxlength: 1000 },
    primaryColor: { type: String, maxlength: 20 },
    companyLegalName: { type: String, maxlength: 300 },
  },
  billingContact: {
    name: { type: String, maxlength: 200 },
    email: { type: String, maxlength: 254 },
  },
  updatedBy: { type: String },
}, { timestamps: true });

export const ProductConfig =
  mongoose.models.ProductConfig || mongoose.model<IProductConfig>('ProductConfig', ProductConfigSchema);

async function getOrCreateSingletonConfig(): Promise<IProductConfig> {
  let config = await ProductConfig.findOne({});
  if (!config) {
    config = await ProductConfig.create({ productName: 'FleetPro', branding: {} });
  }
  return config;
}

const productConfigUpdateSchema = z.object({
  productName: z.string().trim().min(1).max(200).optional(),
  supportEmail: z.string().trim().email().max(254).optional(),
  supportPhone: z.string().trim().max(40).optional(),
  branding: z.object({
    logoUrl: z.string().trim().max(1000).optional(),
    primaryColor: z.string().trim().max(20).optional(),
    companyLegalName: z.string().trim().max(300).optional(),
  }).optional(),
  billingContact: z.object({
    name: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(254).optional(),
  }).optional(),
}).strict();

const planLimitsSchema = z.object({
  maxVehicles: z.number().min(0),
  maxDrivers: z.number().min(0),
  maxManagers: z.number().min(0),
  maxCustomers: z.number().min(0),
  maxStorageGB: z.number().min(0),
  maxApiCallsPerDay: z.number().min(0),
});

const createPlanSchema = z.object({
  code: z.enum(PLAN_CODES),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
  legacySubscriptionPlan: z.enum(LEGACY_SUBSCRIPTION_PLANS).optional(),
  isDefaultForLegacyCode: z.boolean().optional(),
  limits: planLimitsSchema,
  features: z.record(z.string(), z.boolean()).optional(),
  pricing: z.object({ monthlyUsd: z.number().min(0).optional(), yearlyUsd: z.number().min(0).optional() }).optional(),
}).strict();

const updatePlanSchema = createPlanSchema.partial().strict();

export function registerConfigRoutes(app: Express): void {
  app.get('/api/root/config', authenticateUser, requirePlatformRole([...CONFIG_ROLES]), async (_req: AuthRequest, res: Response) => {
    try {
      const config = await getOrCreateSingletonConfig();
      res.json(config);
    } catch (error) {
      console.error('Error fetching product config:', error);
      res.status(500).json({ message: 'Failed to fetch product configuration' });
    }
  });

  app.patch('/api/root/config', authenticateUser, requirePlatformRole([...CONFIG_ROLES]), async (req: AuthRequest, res: Response) => {
    try {
      const data = productConfigUpdateSchema.parse(req.body);
      const config = await getOrCreateSingletonConfig();
      const oldValue = config.toObject();
      Object.assign(config, {
        ...data,
        branding: { ...config.branding, ...data.branding },
        billingContact: { ...config.billingContact, ...data.billingContact },
      });
      config.updatedBy = req.userId;
      await config.save();

      await recordAuditEvent({
        actorUserId: req.userId!,
        actorPlatformRole: (req.user as any)?.platformRole,
        action: 'config.product_config.updated',
        resourceType: 'ProductConfig',
        resourceId: config.id,
        oldValue,
        newValue: config.toObject(),
      });

      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid config data', errors: error.errors });
      }
      console.error('Error updating product config:', error);
      res.status(500).json({ message: 'Failed to update product configuration' });
    }
  });

  app.get('/api/root/plans', authenticateUser, requirePlatformRole([...CONFIG_ROLES]), async (_req: AuthRequest, res: Response) => {
    try {
      await ensureDefaultPlansSeeded();
      const plans = await Plan.find({}).sort({ code: 1 });
      res.json(plans);
    } catch (error) {
      console.error('Error listing plans:', error);
      res.status(500).json({ message: 'Failed to list plans' });
    }
  });

  app.post('/api/root/plans', authenticateUser, requirePlatformRole([...CONFIG_ROLES]), async (req: AuthRequest, res: Response) => {
    try {
      const data = createPlanSchema.parse(req.body);
      const plan = await Plan.create(data);
      await recordAuditEvent({
        actorUserId: req.userId!,
        actorPlatformRole: (req.user as any)?.platformRole,
        action: 'config.plan.created',
        resourceType: 'Plan',
        resourceId: plan.id,
        newValue: plan.toObject(),
      });
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid plan data', errors: error.errors });
      }
      if ((error as any)?.code === 11000) {
        return res.status(409).json({ message: 'A plan with this code (or legacy default mapping) already exists' });
      }
      console.error('Error creating plan:', error);
      res.status(500).json({ message: 'Failed to create plan' });
    }
  });

  app.patch('/api/root/plans/:id', authenticateUser, requirePlatformRole([...CONFIG_ROLES]), async (req: AuthRequest, res: Response) => {
    try {
      const data = updatePlanSchema.parse(req.body);
      const plan = await Plan.findById(req.params.id);
      if (!plan) return res.status(404).json({ message: 'Plan not found' });

      const oldValue = plan.toObject();
      Object.assign(plan, {
        ...data,
        features: data.features ? { ...plan.features, ...data.features } : plan.features,
        limits: data.limits ? { ...plan.limits, ...data.limits } : plan.limits,
      });
      await plan.save();

      await recordAuditEvent({
        actorUserId: req.userId!,
        actorPlatformRole: (req.user as any)?.platformRole,
        action: 'config.plan.updated',
        resourceType: 'Plan',
        resourceId: plan.id,
        oldValue,
        newValue: plan.toObject(),
      });

      res.json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid plan data', errors: error.errors });
      }
      if ((error as any)?.code === 11000) {
        return res.status(409).json({ message: 'Another plan is already the default for this legacy code' });
      }
      console.error('Error updating plan:', error);
      res.status(500).json({ message: 'Failed to update plan' });
    }
  });
}
