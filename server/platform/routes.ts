// STEPS 16-25: Platform API Routes
// Wire all platform services to REST endpoints

import express, { Router } from 'express';
import mongoose from 'mongoose';

// Services
import { platformAuthService } from './auth/platformAuthService';
import { tenantProvisioningService } from './tenants/tenantProvisioningService';
import { tenantManagementService } from './tenants/tenantManagementService';
import { subscriptionService } from './subscriptions/subscriptionService';
import { planService } from './subscriptions/planService';
import { billingService } from './billing/billingService';
import { paymentService } from './payments/paymentService';
import { supportService } from './support/supportService';
import { dashboardService } from './dashboard/dashboardService';

const router = Router();

// Middleware: Verify Platform Auth
const requirePlatformAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // TODO: Verify token
  req.userId = 'platform-root'; // Mock for now
  next();
};

router.use(requirePlatformAuth);

// ============ DASHBOARD ============
router.get('/api/platform/dashboard/kpis', async (req: any, res: any) => {
  try {
    const kpis = await dashboardService.getKPIs();
    res.json(kpis);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/platform/dashboard/stats', async (req: any, res: any) => {
  try {
    const period = req.query.period || 'month';
    const stats = await dashboardService.getExtendedStats(period as any);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ TENANTS ============
router.get('/api/platform/tenants', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      status: req.query.status,
      search: req.query.search
    };

    const result = await tenantManagementService.listTenants(page, limit, filters);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/platform/tenants/:tenantId', async (req: any, res: any) => {
  try {
    const result = await tenantManagementService.getTenant360(req.params.tenantId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/tenants', async (req: any, res: any) => {
  try {
    const { businessName, email, country, createdBy } = req.body;

    const result = await tenantProvisioningService.provisionTenant({
      businessName,
      email,
      country,
      ownerName: email.split('@')[0],
      ownerEmail: email,
      planId: new mongoose.Types.ObjectId(req.body.planId || ''),
      createdBy: createdBy || req.userId
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/api/platform/tenants/:tenantId', async (req: any, res: any) => {
  try {
    const updated = await tenantManagementService.updateTenant(req.params.tenantId, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/tenants/:tenantId/lock', async (req: any, res: any) => {
  try {
    const locked = await tenantManagementService.lockTenant(req.params.tenantId, req.body.reason || 'Admin action');
    res.json(locked);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/tenants/:tenantId/unlock', async (req: any, res: any) => {
  try {
    const unlocked = await tenantManagementService.unlockTenant(req.params.tenantId);
    res.json(unlocked);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PLANS ============
router.get('/api/platform/plans', async (req: any, res: any) => {
  try {
    const plans = await planService.listPlans();
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/platform/plans/:planId', async (req: any, res: any) => {
  try {
    const plan = await planService.getPlan(req.params.planId);
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/plans', async (req: any, res: any) => {
  try {
    const plan = await planService.createPlan(req.body);
    res.status(201).json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SUBSCRIPTIONS ============
router.get('/api/platform/subscriptions', async (req: any, res: any) => {
  try {
    const subs = await subscriptionService.listSubscriptions({ status: req.query.status });
    res.json(subs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/platform/tenants/:tenantId/subscription', async (req: any, res: any) => {
  try {
    const sub = await subscriptionService.getTenantSubscription(req.params.tenantId);
    res.json(sub);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/subscriptions', async (req: any, res: any) => {
  try {
    const sub = await subscriptionService.createSubscription({
      tenantId: new mongoose.Types.ObjectId(req.body.tenantId),
      planId: new mongoose.Types.ObjectId(req.body.planId),
      billingCycle: req.body.billingCycle || 'monthly',
      trialDays: req.body.trialDays,
      createdBy: req.userId
    });
    res.status(201).json(sub);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/subscriptions/:subscriptionId/change-plan', async (req: any, res: any) => {
  try {
    const updated = await subscriptionService.changePlan(
      new mongoose.Types.ObjectId(req.params.subscriptionId),
      new mongoose.Types.ObjectId(req.body.newPlanId),
      req.userId
    );
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/subscriptions/:subscriptionId/renew', async (req: any, res: any) => {
  try {
    const renewed = await subscriptionService.forceRenewal(
      new mongoose.Types.ObjectId(req.params.subscriptionId),
      req.userId
    );
    res.json(renewed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ INVOICES ============
router.get('/api/platform/invoices', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await billingService.listInvoices({ status: req.query.status }, page, limit);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/platform/invoices/:invoiceId', async (req: any, res: any) => {
  try {
    const invoice = await billingService.getInvoice(new mongoose.Types.ObjectId(req.params.invoiceId));
    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/invoices/generate', async (req: any, res: any) => {
  try {
    const invoices = await billingService.generateMonthlyInvoices();
    res.json({ generated: invoices.length, invoices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/invoices/:invoiceId/void', async (req: any, res: any) => {
  try {
    const voided = await billingService.voidInvoice(
      new mongoose.Types.ObjectId(req.params.invoiceId),
      req.userId
    );
    res.json(voided);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PAYMENTS ============
router.get('/api/platform/payments', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await paymentService.listPayments({ status: req.query.status }, page, limit);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/payments', async (req: any, res: any) => {
  try {
    const payment = await paymentService.recordPayment({
      tenantId: new mongoose.Types.ObjectId(req.body.tenantId),
      invoiceId: new mongoose.Types.ObjectId(req.body.invoiceId),
      amount: req.body.amount,
      paymentMethod: req.body.paymentMethod,
      transactionId: req.body.transactionId,
      receivedBy: req.userId
    });
    res.status(201).json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/payments/:paymentId/clear', async (req: any, res: any) => {
  try {
    const cleared = await paymentService.clearPayment(
      new mongoose.Types.ObjectId(req.params.paymentId),
      req.userId
    );
    res.json(cleared);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/platform/payments/outstanding', async (req: any, res: any) => {
  try {
    const outstanding = await paymentService.getOutstandingPayments();
    res.json(outstanding);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SUPPORT TICKETS ============
router.get('/api/platform/tickets', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await supportService.listTickets(
      { status: req.query.status, priority: req.query.priority },
      page,
      limit
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/tickets', async (req: any, res: any) => {
  try {
    const ticket = await supportService.createTicket({
      tenantId: new mongoose.Types.ObjectId(req.body.tenantId),
      subject: req.body.subject,
      description: req.body.description,
      priority: req.body.priority || 'medium',
      category: req.body.category,
      reportedBy: req.userId
    });
    res.status(201).json(ticket);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/tickets/:ticketId/assign', async (req: any, res: any) => {
  try {
    const assigned = await supportService.assignTicket(
      new mongoose.Types.ObjectId(req.params.ticketId),
      req.body.assignedTo,
      req.userId
    );
    res.json(assigned);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/tickets/:ticketId/comment', async (req: any, res: any) => {
  try {
    const updated = await supportService.addComment(
      new mongoose.Types.ObjectId(req.params.ticketId),
      req.body.comment,
      req.userId
    );
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/tickets/:ticketId/resolve', async (req: any, res: any) => {
  try {
    const resolved = await supportService.resolveTicket(
      new mongoose.Types.ObjectId(req.params.ticketId),
      req.body.resolution,
      req.userId
    );
    res.json(resolved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/platform/tickets/:ticketId/close', async (req: any, res: any) => {
  try {
    const closed = await supportService.closeTicket(
      new mongoose.Types.ObjectId(req.params.ticketId),
      req.userId
    );
    res.json(closed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/platform/tickets/overdue', async (req: any, res: any) => {
  try {
    const overdue = await supportService.getOverdueTickets();
    res.json(overdue);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
