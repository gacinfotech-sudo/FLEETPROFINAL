// AGENT-6: Platform Tenant Provisioning + User/Agent Management
//
// POST /api/platform/tenants - Create new tenant (PLATFORM_ROOT only)
// POST /api/platform/tenants/:tenantId/owner - Create tenant owner user
// POST /api/platform/tenants/:tenantId/users - Create tenant users/agents
// GET /api/platform/tenants/:tenantId/users - List tenant users

import type { Express, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticateUser, type AuthRequest } from '../../middleware/auth';
import { storage } from '../../storage-mongodb';
import { rootAccessService } from '../services/rootAccessService';
import { User, Tenant } from '../../models/index';
import { mongoTenantSchema } from '../../schemas/mongodb-schemas';

const requirePlatformRoot = rootAccessService.requirePlatformRole(['PLATFORM_ROOT']);
const recordAuditEvent = rootAccessService.recordAuditEvent;

// Validation schemas
const createTenantSchema = z.object({
  companyName: z.string().min(1).max(200),
  legalName: z.string().min(1).max(200).optional(),
  email: z.string().email().max(254),
  mobile: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  gst: z.string().max(50).optional(),
  pan: z.string().max(50).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
  plan: z.enum(['BASIC', 'STANDARD', 'PREMIUM']).optional().default('BASIC'),
});

const createOwnerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  mobile: z.string().max(40).optional(),
});

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  mobile: z.string().max(40).optional(),
  role: z.enum(['OWNER', 'MANAGER', 'AGENT', 'STAFF']).optional().default('STAFF'),
});

// Helper: Generate secure random token
function generateToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}

// Helper: Check if valid ObjectId
function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

// Helper: Map API plan names to database plan names
function mapPlanToDatabase(apiPlan?: string): 'starter' | 'pro' | 'custom' {
  if (!apiPlan) return 'starter';
  const mapping: Record<string, 'starter' | 'pro' | 'custom'> = {
    'BASIC': 'starter',
    'STANDARD': 'pro',
    'PREMIUM': 'custom',
    'basic': 'starter',
    'standard': 'pro',
    'premium': 'custom',
  };
  return mapping[apiPlan] || 'starter';
}

export function registerPlatformTenantRoutes(app: Express): void {
  // =========================================================================
  // PHASE 1: CREATE TENANT
  // =========================================================================
  app.post('/api/platform/tenants', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: Response) => {
    try {
      const data = createTenantSchema.parse(req.body);

      // Check if tenant already exists with this email
      const existing = await Tenant.findOne({ email: data.email });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Tenant with this email already exists',
        });
      }

      // Create tenant
      const tenantData = mongoTenantSchema.parse({
        name: data.companyName,
        businessName: data.legalName || data.companyName,
        email: data.email,
        phone: data.mobile,
        address: data.address,
        subscriptionPlan: mapPlanToDatabase(data.plan),
      });

      const tenant = await storage.createTenant(tenantData);

      // Audit log
      await recordAuditEvent({
        actorUserId: req.userId!,
        actorPlatformRole: (req.user as any)?.platformRole,
        action: 'platform.tenant.created',
        targetTenantId: String(tenant._id),
        resourceType: 'Tenant',
        resourceId: String(tenant._id),
        newValue: {
          companyName: data.companyName,
          email: data.email,
          plan: data.plan,
        },
      });

      res.status(201).json({
        success: true,
        id: tenant._id,
        companyName: data.companyName,
        email: data.email,
        plan: data.plan,
        status: data.status,
        createdAt: tenant.createdAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error creating tenant:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create tenant',
      });
    }
  });

  // =========================================================================
  // PHASE 2: CREATE TENANT OWNER
  // =========================================================================
  app.post('/api/platform/tenants/:tenantId/owner', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const data = createOwnerSchema.parse(req.body);

      // Verify tenant exists
      if (!isValidObjectId(tenantId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tenantId format',
        });
      }

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found',
        });
      }

      // Check if owner already exists
      const existingOwner = await User.findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        role: 'admin',
      });

      if (existingOwner) {
        return res.status(409).json({
          success: false,
          message: 'An owner already exists for this tenant',
        });
      }

      // Create owner user
      const setupToken = generateToken();
      const ownerData: any = {
        userId: data.email.split('@')[0].toLowerCase(),
        name: data.name,
        email: data.email,
        password: generateToken(), // Temporary, will be set via setup link
        role: 'admin' as const,
        tenantId: new mongoose.Types.ObjectId(tenantId),
        setupToken,
        setupTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const owner = await storage.createUser(ownerData);

      // Add owner to tenant's users array
      await Tenant.findByIdAndUpdate(
        tenantId,
        { $addToSet: { users: owner._id } },
        { new: true }
      );

      // Audit log
      await recordAuditEvent({
        actorUserId: req.userId!,
        actorPlatformRole: (req.user as any)?.platformRole,
        action: 'platform.tenant.owner.created',
        targetTenantId: String(tenantId),
        resourceType: 'User',
        resourceId: String(owner._id),
        newValue: {
          name: data.name,
          email: data.email,
          role: 'OWNER',
          setupUrl: `/setup?token=${setupToken}`,
        },
      });

      res.status(201).json({
        success: true,
        userId: owner._id,
        email: data.email,
        role: 'OWNER',
        setupUrl: `/setup?token=${setupToken}`,
        setupTokenExpiry: ownerData.setupTokenExpiry,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error creating owner:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create owner',
      });
    }
  });

  // =========================================================================
  // PHASE 3: CREATE TENANT USERS/AGENTS
  // =========================================================================
  app.post('/api/platform/tenants/:tenantId/users', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const data = createUserSchema.parse(req.body);

      // Verify tenant exists
      if (!isValidObjectId(tenantId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tenantId format',
        });
      }

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found',
        });
      }

      // Check if user already exists in this tenant
      const existing = await User.findOne({
        email: data.email,
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists in this tenant',
        });
      }

      // Map role: OWNER -> admin, others -> client
      const mongoRole: 'admin' | 'client' | 'manager' = data.role === 'OWNER' ? 'admin' : 'client';

      // Create user
      const setupToken = generateToken();
      const userData: any = {
        userId: data.email.split('@')[0].toLowerCase(),
        name: data.name,
        email: data.email,
        password: generateToken(),
        role: mongoRole,
        tenantId: new mongoose.Types.ObjectId(tenantId),
        setupToken,
        setupTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const user = await storage.createUser(userData);

      // Add user to tenant's users array
      await Tenant.findByIdAndUpdate(
        tenantId,
        { $addToSet: { users: user._id } },
        { new: true }
      );

      // Audit log
      await recordAuditEvent({
        actorUserId: req.userId!,
        actorPlatformRole: (req.user as any)?.platformRole,
        action: 'platform.tenant.user.created',
        targetTenantId: String(tenantId),
        resourceType: 'User',
        resourceId: String(user._id),
        newValue: {
          name: data.name,
          email: data.email,
          role: data.role,
          setupUrl: `/setup?token=${setupToken}`,
        },
      });

      res.status(201).json({
        success: true,
        userId: user._id,
        email: data.email,
        name: data.name,
        role: data.role,
        setupUrl: `/setup?token=${setupToken}`,
        setupTokenExpiry: userData.setupTokenExpiry,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      console.error('Error creating user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create user',
      });
    }
  });

  // =========================================================================
  // PHASE 4: LIST TENANT USERS
  // =========================================================================
  app.get('/api/platform/tenants/:tenantId/users', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      if (!isValidObjectId(tenantId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tenantId format',
        });
      }

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found',
        });
      }

      const users = await User.find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
        .select('-password -setupToken')
        .lean();

      res.json({
        success: true,
        count: users.length,
        tenantId,
        tenantName: tenant.name,
        users,
      });
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to list users',
      });
    }
  });
}
