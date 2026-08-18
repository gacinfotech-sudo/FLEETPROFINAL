// STEP 11: Platform Dashboard Service
// Real KPIs from canonical Tenant data

import { Tenant } from '../../models';
import { Subscription } from '../models/Subscription';
import { PlatformInvoice } from '../models/PlatformInvoice';
import { PlatformPayment } from '../models/PlatformPayment';
import { SupportTicket } from '../models/SupportTicket';

export class DashboardService {
  async getKPIs() {
    try {
      // Count tenants by status
      const totalTenants = await Tenant.countDocuments();

      const subscriptions = await Subscription.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const statusMap = {};
      subscriptions.forEach(s => {
        statusMap[s._id] = s.count;
      });

      const activeTenants = statusMap['active'] || 0;
      const trialTenants = statusMap['trial'] || 0;
      const lockedTenants = statusMap['locked'] || 0;
      const suspendedTenants = statusMap['suspended'] || 0;

      // Monthly revenue (cleared payments this month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      const revenue = await PlatformPayment.aggregate([
        {
          $match: {
            status: 'cleared',
            paymentDate: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const monthlyRevenue = revenue[0]?.total || 0;

      // Outstanding payments
      const outstanding = await PlatformInvoice.aggregate([
        {
          $match: { status: { $in: ['issued', 'partial', 'overdue'] } }
        },
        { $group: { _id: null, total: { $sum: '$outstanding' } } }
      ]);

      const paymentsDue = outstanding[0]?.total || 0;

      // Pending invoices
      const invoicesPending = await PlatformInvoice.countDocuments({
        status: { $in: ['draft', 'issued', 'partial'] }
      });

      // Open support tickets
      const supportTicketsOpen = await SupportTicket.countDocuments({
        status: { $in: ['open', 'assigned', 'in_progress'] }
      });

      return {
        totalTenants,
        activeTenants,
        trialTenants,
        tenantsByStatus: {
          active: activeTenants,
          trial: trialTenants,
          locked: lockedTenants,
          suspended: suspendedTenants
        },
        monthlyRevenue,
        paymentsDue,
        invoicesPending,
        supportTicketsOpen,
        systemHealth: 'healthy',
        lastInvoiceDate: new Date()
      };
    } catch (error) {
      console.error('Dashboard KPI fetch failed:', error);
      throw error;
    }
  }

  async getExtendedStats(period: 'month' | 'quarter' | 'year' = 'month') {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    // Revenue trend
    const revenueTrend = await PlatformPayment.aggregate([
      {
        $match: {
          status: 'cleared',
          paymentDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } }
          },
          revenue: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    // Tenant growth
    const tenantGrowth = await Tenant.aggregate([
      {
        $match: { createdAt: { $gte: startDate, $lte: endDate } }
      },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
          },
          newTenants: { $sum: 1 }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    return {
      revenueTrend,
      tenantGrowth,
      period
    };
  }
}

export const dashboardService = new DashboardService();
