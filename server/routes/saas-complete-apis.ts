import express from "express";
import { authenticateUser, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage-mongodb";
import mongoose from "mongoose";

// Platform root middleware
const requirePlatformRoot = (req: AuthRequest, res: any, next: any) => {
  if (!req.user?.platformRole) {
    return res.status(403).json({ message: 'Platform root access required' });
  }
  next();
};

const router = express.Router();

// ============================================================================
// BILLING & INVOICES MANAGEMENT
// ============================================================================

/**
 * GET /api/saas/tenants/:id/invoices
 * List tenant invoices with pagination
 */
router.get('/tenants/:id/invoices', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { Invoice } = await import("../models");

    const filter: any = { tenantId: req.params.id };
    if (status) filter.status = status;

    const total = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .skip(skip)
      .limit(parseInt(limit as string))
      .sort({ createdAt: -1 });

    res.json({
      message: 'Invoices fetched successfully',
      data: invoices,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Failed to fetch invoices', error: error.message });
  }
});

/**
 * POST /api/saas/tenants/:id/invoice/generate
 * Generate monthly invoice for tenant
 */
router.post('/tenants/:id/invoice/generate', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { tenantId } = req.params;
    const { billingPeriod } = req.body;

    const { Tenant, Subscription, Plan, Invoice } = await import("../models");

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const subscription = await Subscription.findOne({ tenantId }).populate('planId');
    if (!subscription) return res.status(404).json({ message: 'No subscription found' });

    const plan = subscription.planId;

    // Get pricing for billing cycle
    const pricing = plan.pricing[subscription.billingCycle] || plan.pricing.monthly || 0;
    const taxPercent = 18; // Default GST
    const subtotal = pricing;
    const tax = subtotal * (taxPercent / 100);
    const total = subtotal + tax;

    // Generate unique invoice number
    const lastInvoice = await Invoice.findOne({ tenantId }).sort({ createdAt: -1 });
    const invoiceNum = lastInvoice
      ? `INV-${tenantId.slice(0, 4)}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(parseInt(lastInvoice.invoiceNumber?.split('-').pop() || '0') + 1).padStart(5, '0')}`
      : `INV-${tenantId.slice(0, 4)}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-00001`;

    const invoice = new Invoice({
      invoiceNumber: invoiceNum,
      tenantId,
      planId: plan._id,
      billingPeriod: billingPeriod || `${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      subtotal,
      tax,
      total,
      paid: 0,
      outstanding: total,
      status: 'ISSUED',
      createdAt: new Date(),
    });

    await invoice.save();

    res.status(201).json({
      message: 'Invoice generated successfully',
      data: invoice,
    });
  } catch (error: any) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ message: 'Failed to generate invoice', error: error.message });
  }
});

/**
 * GET /api/saas/invoices/:invoiceId
 * Get single invoice
 */
router.get('/invoices/:invoiceId', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { Invoice } = await import("../models");
    const invoice = await Invoice.findById(req.params.invoiceId).populate('tenantId planId');

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    res.json({
      message: 'Invoice fetched successfully',
      data: invoice,
    });
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ message: 'Failed to fetch invoice', error: error.message });
  }
});

/**
 * PUT /api/saas/invoices/:invoiceId
 * Update invoice
 */
router.put('/invoices/:invoiceId', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { Invoice } = await import("../models");
    const { status, notes } = req.body;

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.invoiceId,
      {
        ...(status && { status }),
        ...(notes && { notes }),
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    res.json({
      message: 'Invoice updated successfully',
      data: invoice,
    });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ message: 'Failed to update invoice', error: error.message });
  }
});

/**
 * GET /api/saas/billing/revenue
 * Get monthly SaaS revenue report
 */
router.get('/billing/revenue', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { Invoice } = await import("../models");

    // Get last 12 months of invoices
    const invoices = await Invoice.find({
      status: 'PAID',
      createdAt: {
        $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      },
    }).sort({ createdAt: 1 });

    // Group by month
    const monthlyRevenue: any = {};
    invoices.forEach((invoice: any) => {
      const month = invoice.createdAt.toISOString().slice(0, 7);
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + invoice.total;
    });

    const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + inv.total, 0);
    const avgRevenue = invoices.length > 0 ? totalRevenue / invoices.length : 0;

    res.json({
      message: 'Revenue report fetched successfully',
      data: {
        totalRevenue,
        avgRevenue,
        invoiceCount: invoices.length,
        monthlyRevenue,
      },
    });
  } catch (error: any) {
    console.error('Error fetching revenue:', error);
    res.status(500).json({ message: 'Failed to fetch revenue', error: error.message });
  }
});

/**
 * GET /api/saas/billing/outstanding
 * Get outstanding invoices
 */
router.get('/billing/outstanding', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { Invoice } = await import("../models");

    const outstanding = await Invoice.find({
      status: { $in: ['ISSUED', 'OVERDUE', 'PARTIAL'] },
    }).sort({ dueDate: 1 });

    const totalOutstanding = outstanding.reduce((sum: number, inv: any) => sum + inv.outstanding, 0);

    res.json({
      message: 'Outstanding invoices fetched successfully',
      data: {
        count: outstanding.length,
        totalOutstanding,
        invoices: outstanding,
      },
    });
  } catch (error: any) {
    console.error('Error fetching outstanding:', error);
    res.status(500).json({ message: 'Failed to fetch outstanding', error: error.message });
  }
});

// ============================================================================
// PAYMENTS MANAGEMENT
// ============================================================================

/**
 * POST /api/saas/tenants/:id/payment
 * Record payment
 */
router.post('/tenants/:id/payment', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { tenantId } = req.params;
    const { invoiceId, amount, method, reference, notes } = req.body;

    if (!invoiceId || !amount || !method) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const { Invoice, Payment } = await import("../models");

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const payment = new Payment({
      invoiceId,
      tenantId,
      amount,
      method,
      reference,
      notes,
      status: 'COMPLETED',
      createdAt: new Date(),
    });

    await payment.save();

    // Update invoice
    const newPaid = invoice.paid + amount;
    const newOutstanding = Math.max(0, invoice.total - newPaid);
    const newStatus = newOutstanding === 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'ISSUED';

    await Invoice.findByIdAndUpdate(invoiceId, {
      paid: newPaid,
      outstanding: newOutstanding,
      status: newStatus,
    });

    res.status(201).json({
      message: 'Payment recorded successfully',
      data: payment,
    });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    res.status(500).json({ message: 'Failed to record payment', error: error.message });
  }
});

/**
 * GET /api/saas/tenants/:id/payments
 * List tenant payments
 */
router.get('/tenants/:id/payments', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { Payment } = await import("../models");

    const total = await Payment.countDocuments({ tenantId: req.params.id });
    const payments = await Payment.find({ tenantId: req.params.id })
      .skip(skip)
      .limit(parseInt(limit as string))
      .sort({ createdAt: -1 });

    res.json({
      message: 'Payments fetched successfully',
      data: payments,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ message: 'Failed to fetch payments', error: error.message });
  }
});

// ============================================================================
// RENEWALS MANAGEMENT
// ============================================================================

/**
 * POST /api/saas/tenants/:id/renewal
 * Renew subscription
 */
router.post('/tenants/:id/renewal', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { tenantId } = req.params;
    const { Subscription } = await import("../models");

    const subscription = await Subscription.findOne({ tenantId });
    if (!subscription) return res.status(404).json({ message: 'Subscription not found' });

    // Calculate new renewal date
    const newRenewalDate = new Date(subscription.renewalDate);
    if (subscription.billingCycle === 'monthly') newRenewalDate.setMonth(newRenewalDate.getMonth() + 1);
    else if (subscription.billingCycle === 'quarterly') newRenewalDate.setMonth(newRenewalDate.getMonth() + 3);
    else if (subscription.billingCycle === 'halfYearly') newRenewalDate.setMonth(newRenewalDate.getMonth() + 6);
    else if (subscription.billingCycle === 'annual') newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1);

    subscription.renewalDate = newRenewalDate;
    subscription.status = 'ACTIVE';
    subscription.updatedAt = new Date();

    await subscription.save();

    res.json({
      message: 'Subscription renewed successfully',
      data: subscription,
    });
  } catch (error: any) {
    console.error('Error renewing subscription:', error);
    res.status(500).json({ message: 'Failed to renew subscription', error: error.message });
  }
});

/**
 * GET /api/saas/tenants/:id/renewal-status
 * Check renewal eligibility
 */
router.get('/tenants/:id/renewal-status', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { Subscription, Invoice } = await import("../models");

    const subscription = await Subscription.findOne({ tenantId: req.params.id });
    if (!subscription) return res.status(404).json({ message: 'Subscription not found' });

    // Check for outstanding invoices
    const outstanding = await Invoice.countDocuments({
      tenantId: req.params.id,
      status: { $in: ['ISSUED', 'OVERDUE', 'PARTIAL'] },
    });

    const daysUntilRenewal = Math.floor((subscription.renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const canRenew = outstanding === 0 && daysUntilRenewal <= 30;

    res.json({
      message: 'Renewal status fetched',
      data: {
        subscription,
        outstandingInvoices: outstanding,
        daysUntilRenewal,
        canRenew,
      },
    });
  } catch (error: any) {
    console.error('Error checking renewal status:', error);
    res.status(500).json({ message: 'Failed to check renewal status', error: error.message });
  }
});

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

/**
 * POST /api/saas/tickets
 * Create support ticket
 */
router.post('/tickets', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { tenantId, title, description, category, priority } = req.body;

    if (!tenantId || !title || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const { SupportTicket } = await import("../models");

    const ticket = new SupportTicket({
      ticketNumber: `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      title,
      description,
      category: category || 'general',
      priority: priority || 'medium',
      status: 'OPEN',
      createdAt: new Date(),
    });

    await ticket.save();

    res.status(201).json({
      message: 'Ticket created successfully',
      data: ticket,
    });
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ message: 'Failed to create ticket', error: error.message });
  }
});

/**
 * GET /api/saas/tickets
 * List support tickets
 */
router.get('/tickets', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { page = 1, limit = 20, status, priority } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { SupportTicket } = await import("../models");

    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const total = await SupportTicket.countDocuments(filter);
    const tickets = await SupportTicket.find(filter)
      .skip(skip)
      .limit(parseInt(limit as string))
      .sort({ createdAt: -1 });

    res.json({
      message: 'Tickets fetched successfully',
      data: tickets,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      },
    });
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ message: 'Failed to fetch tickets', error: error.message });
  }
});

/**
 * PUT /api/saas/tickets/:id
 * Update ticket
 */
router.put('/tickets/:id', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { SupportTicket } = await import("../models");
    const { status, priority, notes } = req.body;

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(notes && { notes }),
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    res.json({
      message: 'Ticket updated successfully',
      data: ticket,
    });
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ message: 'Failed to update ticket', error: error.message });
  }
});

// ============================================================================
// AUDIT LOGS
// ============================================================================

/**
 * GET /api/saas/audit
 * List audit logs
 */
router.get('/audit', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { page = 1, limit = 50, action } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { AuditLog } = await import("../models");

    const filter: any = {};
    if (action) filter.action = action;

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .skip(skip)
      .limit(parseInt(limit as string))
      .sort({ createdAt: -1 });

    res.json({
      message: 'Audit logs fetched successfully',
      data: logs,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      },
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs', error: error.message });
  }
});

export default router;
