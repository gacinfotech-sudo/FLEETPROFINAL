// STEP 41: Mobile API Optimization Service
// Reduce payload sizes, optimize response times

import mongoose from 'mongoose';

export class MobileOptimizationService {
  // Compress tenant response for mobile
  async compressTenant(tenant: any) {
    return {
      id: tenant._id,
      name: tenant.businessName,
      email: tenant.email,
      status: tenant.isActive ? 'active' : 'inactive',
      createdAt: tenant.createdAt
    };
  }

  // Compress subscription for mobile
  async compressSubscription(sub: any) {
    return {
      id: sub._id,
      status: sub.status,
      plan: sub.planId?.name,
      nextBilling: sub.nextBillingDate,
      price: sub.priceSnapshot
    };
  }

  // Compress invoice for mobile
  async compressInvoice(invoice: any) {
    return {
      id: invoice._id,
      number: invoice.invoiceNumber,
      amount: invoice.total,
      outstanding: invoice.outstanding,
      status: invoice.status,
      dueDate: invoice.dueDate
    };
  }

  // Compress ticket for mobile
  async compressTicket(ticket: any) {
    return {
      id: ticket._id,
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      sla: ticket.slaDeadline,
      comments: ticket.comments?.length || 0
    };
  }

  // Batch endpoint (get multiple resources in one call)
  async getBatch(resources: Array<{ type: string; id: string }>) {
    try {
      const results: any = {};

      for (const resource of resources) {
        if (resource.type === 'subscription') {
          // Get subscription with minimal data
          const sub = await mongoose.connection.collection('subscriptions').findOne(
            { _id: new mongoose.Types.ObjectId(resource.id) }
          );
          if (sub) results[resource.id] = await this.compressSubscription(sub);
        } else if (resource.type === 'invoice') {
          const invoice = await mongoose.connection.collection('platform_invoices').findOne(
            { _id: new mongoose.Types.ObjectId(resource.id) }
          );
          if (invoice) results[resource.id] = await this.compressInvoice(invoice);
        } else if (resource.type === 'ticket') {
          const ticket = await mongoose.connection.collection('support_tickets').findOne(
            { _id: new mongoose.Types.ObjectId(resource.id) }
          );
          if (ticket) results[resource.id] = await this.compressTicket(ticket);
        }
      }

      return results;
    } catch (error) {
      console.error('Get batch failed:', error);
      throw error;
    }
  }

  // Get dashboard KPIs (minimal for mobile)
  async getDashboardKPIsMobile() {
    try {
      const Tenant = mongoose.model('Tenant');
      const Subscription = mongoose.model('Subscription');
      const PlatformPayment = mongoose.model('PlatformPayment');

      const [totalTenants, activeTenants, monthlyRevenue] = await Promise.all([
        Tenant.countDocuments(),
        Subscription.countDocuments({ status: 'active' }),
        PlatformPayment.aggregate([
          {
            $match: {
              status: 'cleared',
              paymentDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
      ]);

      return {
        total: totalTenants,
        active: activeTenants,
        revenue: monthlyRevenue[0]?.total || 0
      };
    } catch (error) {
      console.error('Get dashboard KPIs mobile failed:', error);
      throw error;
    }
  }

  // Calculate response size
  getPayloadSize(data: any): number {
    return JSON.stringify(data).length;
  }
}

export const mobileOptimizationService = new MobileOptimizationService();
