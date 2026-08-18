// STEP 8: Tenant Provisioning Service
// Atomic tenant creation: Tenant + Owner + Subscription + Invoice

import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { Tenant, User } from '../../models';
import { Subscription } from '../models/Subscription';
import { PlatformInvoice } from '../models/PlatformInvoice';
import { AuditLog } from '../models/AuditLog';
import { Plan } from '../models/Plan';

export class TenantProvisioningService {
  async createTenant(data: {
    companyName: string;
    legalName?: string;
    ownerName: string;
    ownerEmail: string;
    ownerMobile?: string;
    address?: string;
    planId: mongoose.Types.ObjectId;
    trialDays?: number;
    createdBy: string;
  }) {
    // Start transaction (atomic operation)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Step 1: Create Tenant
      const tenant = new Tenant({
        name: data.companyName,
        businessName: data.legalName || data.companyName,
        email: data.ownerEmail,
        phone: data.ownerMobile,
        address: data.address,
        isActive: true,
        subscriptionPlan: 'pro',
        limits: { vehicles: 100, drivers: 50, managers: 5 },
        createdAt: new Date(),
        tenantCode: `TEN-${Date.now()}`
      });
      await tenant.save({ session });

      // Step 2: Create Tenant Owner User
      const tempPassword = this.generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      const owner = new User({
        userId: `owner_${tenant._id.toString().slice(0, 8)}`,
        name: data.ownerName,
        password: hashedPassword,
        role: 'admin',                    // Tenant role
        tenantId: tenant._id,             // Associated with tenant
        platformRole: undefined,          // NOT a platform user
        isActive: true,
        permissions: ['*'],               // All permissions for owner
        mustResetPassword: true,          // Force password change
        hasCompletedOnboarding: false,
        createdBy: data.createdBy,
        createdAt: new Date()
      });
      await owner.save({ session });

      // Step 3: Create Subscription
      const plan = await Plan.findById(data.planId).session(session);
      if (!plan) {
        throw new Error('Plan not found');
      }

      const startDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + (data.trialDays || 30));

      const subscription = new Subscription({
        tenantId: tenant._id,
        planId: plan._id,
        billingCycle: 'monthly',
        startDate,
        periodStart: startDate,
        periodEnd: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: trialEndDate,    // First invoice after trial
        status: 'trial',
        priceSnapshot: plan.monthlyPrice,
        taxSnapshot: plan.tax || 0,
        features: plan.features,
        createdBy: data.createdBy,
        createdAt: new Date()
      });
      await subscription.save({ session });

      // Step 4: Create initial (draft) invoice
      const invoiceNumber = `INV-${Date.now()}`;
      const firstInvoice = new PlatformInvoice({
        invoiceNumber,
        invoiceSequence: 1,
        tenantId: tenant._id,
        subscriptionId: subscription._id,
        billingPeriodStart: trialEndDate,
        billingPeriodEnd: new Date(trialEndDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 0,                      // Zero for trial
        tax: 0,
        total: 0,
        paid: 0,
        outstanding: 0,
        dueDate: new Date(trialEndDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'draft',
        lineItems: [{
          description: `${plan.name} Plan (Trial)`,
          quantity: 1,
          unitPrice: 0,
          amount: 0
        }],
        createdBy: data.createdBy,
        createdAt: new Date()
      });
      await firstInvoice.save({ session });

      // Step 5: Audit log
      await AuditLog.create(
        [{
          actor: data.createdBy,
          action: 'TENANT_PROVISIONING',
          resource: 'tenant',
          resourceId: tenant._id.toString(),
          resourceName: tenant.businessName,
          changes: {
            after: {
              tenantId: tenant._id,
              ownerId: owner._id,
              subscriptionId: subscription._id,
              invoiceId: firstInvoice._id
            }
          },
          status: 'success',
          createdAt: new Date()
        }],
        { session }
      );

      // Commit transaction
      await session.commitTransaction();

      return {
        tenant,
        owner,
        subscription,
        invoice: firstInvoice,
        tempPassword  // For email to owner
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private generateTempPassword(): string {
    return Math.random().toString(36).slice(-12).toUpperCase();
  }
}

export const tenantProvisioningService = new TenantProvisioningService();
