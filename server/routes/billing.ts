import { Router, Response } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../middleware/auth';
import { storage } from '../storage-mongodb';
import BillingScheduler from '../services/billing-scheduler';
import { ObjectId } from 'mongodb';

const router = Router();

/**
 * GET /api/billing/invoices
 * Get tenant's invoices (FIXED P0-001: Persistence)
 */
router.get('/invoices', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const invoices = await storage.getInvoicesByTenant(req.tenantId!, limit, offset);

    const data = invoices.map(inv => ({
      id: inv._id,
      invoiceNumber: inv.invoiceNumber || 'draft',
      status: inv.status,
      amount: inv.totalAmount,
      amountReceived: inv.amountReceived,
      balanceDue: inv.balanceDue,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.invoiceDate ? new Date(inv.invoiceDate.getTime() + 30*24*60*60*1000) : null,
    }));

    res.json({
      success: true,
      data: {
        invoices: data,
        count: invoices.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/billing/invoices/:id
 * Get single invoice details
 */
router.get('/invoices/:id', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await storage.getInvoice(req.params.id);

    if (!invoice || invoice.tenantId.toString() !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({
      success: true,
      data: { invoice },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch invoice' });
  }
});

/**
 * GET /api/billing/ledger
 * Get billing ledger entries (FIXED P0-001: Persistence)
 */
router.get('/ledger', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const ledger = await storage.getBillingLedger(req.tenantId!);
    const outstanding = await storage.getTenantOutstanding(req.tenantId!);

    const lastPayment = ledger.find(entry => entry.type === 'payment');

    res.json({
      success: true,
      data: {
        entries: ledger,
        outstanding,
        lastPayment: lastPayment || null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching billing ledger:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch billing ledger' });
  }
});

/**
 * POST /api/billing/payment
 * Record payment (FIXED P0-001: Persistence)
 */
router.post('/payment', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, method = 'bank_transfer', reference, invoiceId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid amount required' });
    }

    // Get subscription to link payment
    const subscription = await storage.getSubscriptionByTenant(req.tenantId!);
    if (!subscription) {
      return res.status(400).json({ success: false, error: 'No active subscription found' });
    }

    // Create payment record
    const payment = await storage.createPayment({
      tenantId: req.tenantId,
      invoiceId,
      subscriptionId: subscription._id,
      amount,
      method,
      reference,
      status: 'completed',
    });

    // If invoice specified, update it
    if (invoiceId) {
      const invoice = await storage.getInvoice(invoiceId);
      if (invoice) {
        const newAmountReceived = (invoice.amountReceived || 0) + amount;
        const newBalanceDue = Math.max(0, (invoice.balanceDue || 0) - amount);
        const newStatus = newBalanceDue === 0 ? 'finalized' : invoice.status;

        await storage.updateInvoice(invoiceId, {
          amountReceived: newAmountReceived,
          balanceDue: newBalanceDue,
          status: newStatus,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: { payment, id: payment._id },
    });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, error: 'Failed to process payment' });
  }
});

/**
 * POST /api/billing/invoice/:invoiceId/pay
 * Pay specific invoice
 */
router.post('/invoice/:invoiceId/pay', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, method = 'bank_transfer', reference } = req.body;

    const invoice = await storage.getInvoice(req.params.invoiceId);
    if (!invoice || invoice.tenantId.toString() !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    if (!amount || amount <= 0 || amount > invoice.balanceDue) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount' });
    }

    // Record payment
    const payment = await storage.createPayment({
      tenantId: req.tenantId,
      invoiceId: req.params.invoiceId,
      amount,
      method,
      reference,
      status: 'completed',
    });

    // Update invoice
    const newAmountReceived = (invoice.amountReceived || 0) + amount;
    const newBalanceDue = Math.max(0, (invoice.balanceDue || 0) - amount);

    await storage.updateInvoice(req.params.invoiceId, {
      amountReceived: newAmountReceived,
      balanceDue: newBalanceDue,
      status: newBalanceDue === 0 ? 'finalized' : invoice.status,
    });

    res.json({
      success: true,
      message: 'Invoice payment recorded',
      data: {
        payment,
        invoice: {
          balanceDue: newBalanceDue,
          amountReceived: newAmountReceived,
          status: newBalanceDue === 0 ? 'finalized' : invoice.status,
        },
      },
    });
  } catch (error: any) {
    console.error('Error paying invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to pay invoice' });
  }
});

/**
 * GET /api/admin/billing/overview
 * Admin billing overview (FIXED P2-002: Renewal metrics)
 */
router.get('/admin/overview', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.platformRole !== 'PLATFORM_ROOT' && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    // Get all subscriptions
    const subscriptions = await storage.listSubscriptions({ status: 'ACTIVE' });

    // Calculate MRR (Monthly Recurring Revenue)
    let totalMRR = 0;
    const renewalsThisMonth = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    for (const sub of subscriptions) {
      const plan = (sub.planId as any);
      if (plan?.pricing?.monthly) {
        totalMRR += plan.pricing.monthly;
      }

      if (sub.renewalDate >= today && sub.renewalDate <= thirtyDaysLater) {
        renewalsThisMonth.push({
          tenantId: sub.tenantId,
          planName: plan?.name || 'Unknown',
          renewalDate: sub.renewalDate,
        });
      }
    }

    // Get all outstanding invoices
    const outstandingInvoices = await storage.listInvoices({
      status: { $in: ['draft', 'finalized'] },
    });

    let totalOutstanding = 0;
    const overdueTenants = [];

    for (const invoice of outstandingInvoices) {
      if (invoice.balanceDue && invoice.balanceDue > 0) {
        totalOutstanding += invoice.balanceDue;

        // Check if overdue (past 30 days)
        const dueDate = new Date(invoice.invoiceDate);
        dueDate.setDate(dueDate.getDate() + 30);

        if (dueDate < today) {
          overdueTenants.push({
            tenantId: invoice.tenantId,
            invoiceNumber: invoice.invoiceNumber,
            balanceDue: invoice.balanceDue,
            daysOverdue: Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)),
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        totalMRR,
        totalOutstanding,
        renewalsThisMonth: renewalsThisMonth.length,
        overdueTenants: overdueTenants.length,
        activeSubscriptions: subscriptions.length,
        details: {
          renewals: renewalsThisMonth,
          overdue: overdueTenants,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching billing overview:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch billing overview' });
  }
});

/**
 * GET /api/admin/billing/invoices
 * Admin: List all invoices
 */
router.get('/admin/invoices', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.platformRole !== 'PLATFORM_ROOT') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const invoices = await storage.listInvoices();

    res.json({
      success: true,
      data: {
        invoices: invoices.map(inv => ({
          id: inv._id,
          tenantId: inv.tenantId,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          amount: inv.totalAmount,
          balanceDue: inv.balanceDue,
          invoiceDate: inv.invoiceDate,
        })),
        count: invoices.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

/**
 * POST /api/admin/billing/invoices
 * Admin: Create invoice manually
 */
router.post('/admin/invoices', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.platformRole !== 'PLATFORM_ROOT') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { tenantId, amount, description } = req.body;

    if (!tenantId || !amount) {
      return res.status(400).json({ success: false, error: 'tenantId and amount required' });
    }

    const invoice = await storage.createInvoice({
      tenantId,
      customerId: tenantId,
      totalAmount: amount,
      balanceDue: amount,
      serviceDescription: description || 'Manual Invoice',
      status: 'draft',
      createdBy: { userId: req.userId!, role: req.user?.platformRole || 'ADMIN' },
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created',
      data: { invoice },
    });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
});

/**
 * GET /api/admin/billing/renewals/upcoming
 * Admin: Get upcoming subscription renewals (next 30 days)
 */
router.get('/admin/renewals/upcoming', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.platformRole !== 'PLATFORM_ROOT') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const renewals = await BillingScheduler.getUpcomingRenewals();

    res.json({
      success: true,
      data: {
        renewals,
        count: renewals.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching renewals:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch renewals' });
  }
});

/**
 * POST /api/admin/billing/scheduler/trigger
 * Admin: Manually trigger billing scheduler (for testing/reconciliation)
 */
router.post('/admin/scheduler/trigger', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.platformRole !== 'PLATFORM_ROOT') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    await BillingScheduler.triggerManual();

    res.json({
      success: true,
      message: 'Billing scheduler triggered manually',
    });
  } catch (error: any) {
    console.error('Error triggering scheduler:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger scheduler' });
  }
});

export default router;
