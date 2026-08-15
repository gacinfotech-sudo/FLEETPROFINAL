// STEP 16-17: Subscription Management Service
// Manage subscriptions, plan changes, renewals

import mongoose from 'mongoose';
import { Subscription } from '../models/Subscription';
import { PlatformInvoice } from '../models/PlatformInvoice';
import { Plan } from '../models/Plan';
import { AuditLog } from '../models/AuditLog';

export class SubscriptionService {
  // List subscriptions
  async listSubscriptions(filters: any = {}) {
    try {
      const query: any = {};
      if (filters.status) query.status = filters.status;

      return await Subscription.find(query)
        .populate('planId')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('List subscriptions failed:', error);
      throw error;
    }
  }

  // Get tenant's subscription
  async getTenantSubscription(tenantId: string | mongoose.Types.ObjectId) {
    try {
      const sub = await Subscription.findOne({
        tenantId,
        status: { $in: ['trial', 'active', 'renewal_due', 'payment_due'] }
      }).populate('planId');

      if (!sub) throw new Error('No active subscription found');
      return sub;
    } catch (error) {
      console.error('Get tenant subscription failed:', error);
      throw error;
    }
  }

  // Create subscription (assign plan)
  async createSubscription(data: {
    tenantId: mongoose.Types.ObjectId;
    planId: mongoose.Types.ObjectId;
    billingCycle: 'monthly' | 'quarterly' | 'annual';
    trialDays?: number;
    createdBy: string;
  }) {
    try {
      const plan = await Plan.findById(data.planId);
      if (!plan) throw new Error('Plan not found');

      const startDate = new Date();
      const nextBillingDate = new Date();
      nextBillingDate.setDate(nextBillingDate.getDate() + (data.trialDays || 30));

      const subscription = new Subscription({
        tenantId: data.tenantId,
        planId: data.planId,
        billingCycle: data.billingCycle,
        startDate,
        periodStart: startDate,
        periodEnd: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate,
        status: data.trialDays ? 'trial' : 'active',
        priceSnapshot: plan.monthlyPrice,
        taxSnapshot: plan.tax || 0,
        features: plan.features,
        createdBy: data.createdBy,
        createdAt: new Date()
      });

      await subscription.save();

      // Audit log
      await AuditLog.create({
        actor: data.createdBy,
        action: 'SUBSCRIPTION_CREATED',
        resource: 'subscription',
        resourceId: subscription._id.toString(),
        tenantId: data.tenantId,
        status: 'success',
        createdAt: new Date()
      });

      return subscription;
    } catch (error) {
      console.error('Create subscription failed:', error);
      throw error;
    }
  }

  // Change plan
  async changePlan(
    subscriptionId: mongoose.Types.ObjectId,
    newPlanId: mongoose.Types.ObjectId,
    changedBy: string
  ) {
    try {
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) throw new Error('Subscription not found');

      const newPlan = await Plan.findById(newPlanId);
      if (!newPlan) throw new Error('Plan not found');

      const oldPlan = subscription.planId;

      subscription.planId = newPlanId;
      subscription.priceSnapshot = newPlan.monthlyPrice;
      subscription.taxSnapshot = newPlan.tax || 0;
      subscription.features = newPlan.features;
      subscription.modifiedAt = new Date();
      subscription.modifiedBy = changedBy;

      await subscription.save();

      // Audit log
      await AuditLog.create({
        actor: changedBy,
        action: 'SUBSCRIPTION_PLAN_CHANGED',
        resource: 'subscription',
        resourceId: subscriptionId.toString(),
        tenantId: subscription.tenantId,
        changes: {
          before: { planId: oldPlan },
          after: { planId: newPlanId }
        },
        status: 'success',
        createdAt: new Date()
      });

      return subscription;
    } catch (error) {
      console.error('Change plan failed:', error);
      throw error;
    }
  }

  // Force renewal
  async forceRenewal(subscriptionId: mongoose.Types.ObjectId, renewedBy: string) {
    try {
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) throw new Error('Subscription not found');

      const newNextBillingDate = new Date();
      if (subscription.billingCycle === 'monthly') {
        newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1);
      } else if (subscription.billingCycle === 'quarterly') {
        newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 3);
      } else if (subscription.billingCycle === 'annual') {
        newNextBillingDate.setFullYear(newNextBillingDate.getFullYear() + 1);
      }

      subscription.periodStart = new Date();
      subscription.periodEnd = newNextBillingDate;
      subscription.nextBillingDate = newNextBillingDate;
      subscription.status = 'active';
      subscription.modifiedAt = new Date();
      subscription.modifiedBy = renewedBy;

      await subscription.save();

      // Audit log
      await AuditLog.create({
        actor: renewedBy,
        action: 'SUBSCRIPTION_RENEWED',
        resource: 'subscription',
        resourceId: subscriptionId.toString(),
        tenantId: subscription.tenantId,
        status: 'success',
        createdAt: new Date()
      });

      return subscription;
    } catch (error) {
      console.error('Force renewal failed:', error);
      throw error;
    }
  }
}

export const subscriptionService = new SubscriptionService();
