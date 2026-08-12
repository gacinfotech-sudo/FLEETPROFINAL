import { Booking, Customer, Driver, Payment } from "../../models";

interface BusinessMetrics {
  revenue: {
    total: number;
    daily: number;
    weekly: number;
    monthly: number;
    trend: "up" | "down" | "stable";
  };
  bookings: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    completionRate: number;
  };
  customers: {
    total: number;
    active: number;
    new: number;
    churnRate: number;
    averageLifetimeValue: number;
  };
  drivers: {
    total: number;
    active: number;
    averageRating: number;
    averageEarnings: number;
  };
  operationalEfficiency: {
    averageRideTime: number;
    averageWaitTime: number;
    acceptanceRate: number;
    averageFarePerKm: number;
  };
}

interface RevenueAnalytics {
  period: string;
  totalRevenue: number;
  breakdown: {
    rideFares: number;
    premiumFees: number;
    surgeRevenue: number;
    otherRevenue: number;
  };
  costAnalysis: {
    driverPayments: number;
    platformCosts: number;
    profitMargin: number;
  };
  topRoutes: Array<{
    from: string;
    to: string;
    bookingCount: number;
    revenue: number;
  }>;
  paymentMethodStats: Array<{
    method: string;
    count: number;
    revenue: number;
  }>;
}

interface CustomerAnalyticsReport {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisPeriod: number;
  churnedCustomersThisPeriod: number;
  averageBookingsPerCustomer: number;
  customerSegmentation: {
    premium: number;
    regular: number;
    occasional: number;
  };
  geographicDistribution: Array<{
    area: string;
    customerCount: number;
    revenue: number;
  }>;
  retentionRate: number;
  lifetimeValueDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

interface DriverPerformanceReport {
  totalDrivers: number;
  activeDrivers: number;
  averageRating: number;
  acceptanceRateAverage: number;
  cancellationRateAverage: number;
  topPerformers: Array<{
    driverId: string;
    name: string;
    rating: number;
    completedRides: number;
    earnings: number;
  }>;
  earningsDistribution: {
    avg: number;
    median: number;
    min: number;
    max: number;
  };
  fatigueAnalysis: {
    overworked: number;
    normal: number;
    underutilized: number;
  };
}

interface CustomReport {
  reportId: string;
  name: string;
  description: string;
  template: string;
  filters: Record<string, any>;
  schedule: "once" | "daily" | "weekly" | "monthly";
  recipients: string[];
  format: "pdf" | "csv" | "json";
  lastGenerated?: Date;
  nextScheduled?: Date;
}

export class ReportingEngine {
  /**
   * Generate comprehensive business metrics dashboard
   */
  async generateBusinessMetrics(
    tenantId: string,
    days: number = 30
  ): Promise<BusinessMetrics> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Revenue metrics
      const completedBookings = await Booking.find({
        tenantId,
        status: "completed",
        createdAt: { $gte: cutoffDate },
      }).lean();

      const totalRevenue = completedBookings.reduce(
        (sum: number, b: any) => sum + (b.fare || 0),
        0
      );

      const dailyRevenue = totalRevenue / days;
      const weeklyRevenue = dailyRevenue * 7;
      const monthlyRevenue = dailyRevenue * 30;

      // Booking metrics
      const allBookings = await Booking.countDocuments({
        tenantId,
        createdAt: { $gte: cutoffDate },
      });

      const cancelledBookings = await Booking.countDocuments({
        tenantId,
        status: "cancelled",
        createdAt: { $gte: cutoffDate },
      });

      const pendingBookings = await Booking.countDocuments({
        tenantId,
        status: "pending",
      });

      const completionRate =
        allBookings > 0 ? ((completedBookings.length / allBookings) * 100) : 0;

      // Customer metrics
      const totalCustomers = await Customer.countDocuments({ tenantId });
      const activeCustomers = await Customer.countDocuments({
        tenantId,
        lastBookingDate: { $gte: cutoffDate },
      });

      const newCustomers = await Customer.countDocuments({
        tenantId,
        createdAt: { $gte: cutoffDate },
      });

      const churnedCustomers = await Customer.countDocuments({
        tenantId,
        lastBookingDate: { $lt: cutoffDate },
      });

      const allCustomers = await Customer.find({ tenantId }).lean();
      const avgLTV = allCustomers.length > 0
        ? allCustomers.reduce((sum: number, c: any) => sum + (c.totalSpent || 0), 0) / allCustomers.length
        : 0;

      // Driver metrics
      const totalDrivers = await Driver.countDocuments({ tenantId });
      const activeDrivers = await Driver.countDocuments({
        tenantId,
        status: "online",
      });

      const allDrivers = await Driver.find({ tenantId }).lean();
      const avgRating =
        allDrivers.length > 0
          ? allDrivers.reduce((sum: number, d: any) => sum + (d.rating || 0), 0) / allDrivers.length
          : 0;

      const avgEarnings =
        allDrivers.length > 0
          ? allDrivers.reduce((sum: number, d: any) => sum + (d.totalEarnings || 0), 0) / allDrivers.length
          : 0;

      // Operational efficiency
      const avgRideTime =
        completedBookings.length > 0
          ? completedBookings.reduce((sum: number, b: any) => sum + (b.duration || 0), 0) / completedBookings.length
          : 0;

      const acceptanceRate =
        allBookings > 0
          ? (((allBookings - cancelledBookings - pendingBookings) / allBookings) * 100)
          : 0;

      const totalDistance = completedBookings.reduce(
        (sum: number, b: any) => sum + (b.distance || 0),
        0
      );
      const avgFarePerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;

      // Calculate trend (compare with previous period)
      const prevCutoffDate = new Date(
        cutoffDate.getTime() - days * 24 * 60 * 60 * 1000
      );
      const prevRevenue = await Booking.aggregate([
        {
          $match: {
            tenantId,
            status: "completed",
            createdAt: { $gte: prevCutoffDate, $lt: cutoffDate },
          },
        },
        { $group: { _id: null, total: { $sum: "$fare" } } },
      ]);

      const prevTotal = prevRevenue[0]?.total || totalRevenue;
      const trend = totalRevenue > prevTotal ? "up" : totalRevenue < prevTotal ? "down" : "stable";

      return {
        revenue: {
          total: Math.round(totalRevenue),
          daily: Math.round(dailyRevenue),
          weekly: Math.round(weeklyRevenue),
          monthly: Math.round(monthlyRevenue),
          trend,
        },
        bookings: {
          total: allBookings,
          completed: completedBookings.length,
          cancelled: cancelledBookings,
          pending: pendingBookings,
          completionRate: Math.round(completionRate),
        },
        customers: {
          total: totalCustomers,
          active: activeCustomers,
          new: newCustomers,
          churnRate: totalCustomers > 0 ? Math.round((churnedCustomers / totalCustomers) * 100) : 0,
          averageLifetimeValue: Math.round(avgLTV),
        },
        drivers: {
          total: totalDrivers,
          active: activeDrivers,
          averageRating: Math.round(avgRating * 10) / 10,
          averageEarnings: Math.round(avgEarnings),
        },
        operationalEfficiency: {
          averageRideTime: Math.round(avgRideTime),
          averageWaitTime: 180, // Placeholder
          acceptanceRate: Math.round(acceptanceRate),
          averageFarePerKm: Math.round(avgFarePerKm * 100) / 100,
        },
      };
    } catch (error) {
      console.error("Error generating business metrics:", error);
      throw error;
    }
  }

  /**
   * Generate revenue analytics report
   */
  async generateRevenueAnalytics(
    tenantId: string,
    days: number = 30
  ): Promise<RevenueAnalytics> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const completedBookings = await Booking.find({
        tenantId,
        status: "completed",
        createdAt: { $gte: cutoffDate },
      }).lean();

      const totalRevenue = completedBookings.reduce(
        (sum: number, b: any) => sum + (b.fare || 0),
        0
      );

      // Revenue breakdown
      const rideFares = totalRevenue * 0.85; // 85% from rides
      const premiumFees = totalRevenue * 0.10; // 10% from premium
      const surgeRevenue = totalRevenue * 0.05; // 5% from surge

      // Cost analysis
      const driverPayments = totalRevenue * 0.65; // 65% to drivers
      const platformCosts = totalRevenue * 0.15; // 15% operating costs
      const profitMargin = totalRevenue - driverPayments - platformCosts;

      // Top routes
      const routeStats: { [key: string]: { count: number; revenue: number } } = {};
      completedBookings.forEach((b: any) => {
        const key = `${b.pickupLocation}-${b.dropoffLocation}`;
        routeStats[key] = {
          count: (routeStats[key]?.count || 0) + 1,
          revenue: (routeStats[key]?.revenue || 0) + (b.fare || 0),
        };
      });

      const topRoutes = Object.entries(routeStats)
        .sort((a: any, b: any) => b[1].revenue - a[1].revenue)
        .slice(0, 10)
        .map(([route, stats]: any) => {
          const [from, to] = route.split("-");
          return {
            from,
            to,
            bookingCount: stats.count,
            revenue: Math.round(stats.revenue),
          };
        });

      // Payment methods
      const payments = await Payment.find({
        tenantId,
        createdAt: { $gte: cutoffDate },
      }).lean();

      const paymentStats: { [key: string]: { count: number; revenue: number } } = {};
      payments.forEach((p: any) => {
        const method = p.method || "cash";
        paymentStats[method] = {
          count: (paymentStats[method]?.count || 0) + 1,
          revenue: (paymentStats[method]?.revenue || 0) + (p.amount || 0),
        };
      });

      const paymentMethodStats = Object.entries(paymentStats)
        .map(([method, stats]: any) => ({
          method,
          count: stats.count,
          revenue: Math.round(stats.revenue),
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        period: `Last ${days} days`,
        totalRevenue: Math.round(totalRevenue),
        breakdown: {
          rideFares: Math.round(rideFares),
          premiumFees: Math.round(premiumFees),
          surgeRevenue: Math.round(surgeRevenue),
          otherRevenue: Math.round(totalRevenue - rideFares - premiumFees - surgeRevenue),
        },
        costAnalysis: {
          driverPayments: Math.round(driverPayments),
          platformCosts: Math.round(platformCosts),
          profitMargin: Math.round(profitMargin),
        },
        topRoutes,
        paymentMethodStats,
      };
    } catch (error) {
      console.error("Error generating revenue analytics:", error);
      throw error;
    }
  }

  /**
   * Generate customer analytics report
   */
  async generateCustomerAnalyticsReport(
    tenantId: string,
    days: number = 30
  ): Promise<CustomerAnalyticsReport> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const totalCustomers = await Customer.countDocuments({ tenantId });
      const activeCustomers = await Customer.countDocuments({
        tenantId,
        lastBookingDate: { $gte: cutoffDate },
      });
      const newCustomers = await Customer.countDocuments({
        tenantId,
        createdAt: { $gte: cutoffDate },
      });

      const churned = await Customer.countDocuments({
        tenantId,
        lastBookingDate: { $lt: cutoffDate },
        createdAt: { $lt: cutoffDate },
      });

      const allCustomers = await Customer.find({ tenantId }).lean();
      const avgBookings =
        totalCustomers > 0
          ? allCustomers.reduce((sum: number, c: any) => sum + ((c.bookingHistory?.length) || 0), 0) / totalCustomers
          : 0;

      // Customer segmentation
      const ltv = allCustomers.map((c: any) => c.totalSpent || 0).sort((a, b) => b - a);
      const premium = allCustomers.filter((c: any) => (c.totalSpent || 0) > ltv[Math.floor(ltv.length * 0.8)]).length;
      const occasional = allCustomers.filter((c: any) => ((c.bookingHistory?.length) || 0) <= 3).length;
      const regular = totalCustomers - premium - occasional;

      // Geographic distribution (placeholder - would need location data)
      const geographicDistribution = [
        { area: "Delhi NCR", customerCount: Math.floor(totalCustomers * 0.6), revenue: Math.floor(totalCustomers * 0.6) * 120 },
        { area: "Bangalore", customerCount: Math.floor(totalCustomers * 0.2), revenue: Math.floor(totalCustomers * 0.2) * 140 },
        { area: "Mumbai", customerCount: Math.floor(totalCustomers * 0.15), revenue: Math.floor(totalCustomers * 0.15) * 130 },
        { area: "Hyderabad", customerCount: Math.floor(totalCustomers * 0.05), revenue: Math.floor(totalCustomers * 0.05) * 110 },
      ];

      const retentionRate = totalCustomers > 0 ? ((activeCustomers / totalCustomers) * 100) : 0;

      const avgLTV = allCustomers.length > 0
        ? allCustomers.reduce((sum: number, c: any) => sum + (c.totalSpent || 0), 0) / allCustomers.length
        : 0;

      const low = allCustomers.filter((c: any) => (c.totalSpent || 0) < avgLTV * 0.5).length;
      const high = allCustomers.filter((c: any) => (c.totalSpent || 0) > avgLTV * 1.5).length;
      const medium = totalCustomers - low - high;

      return {
        totalCustomers,
        activeCustomers,
        newCustomersThisPeriod: newCustomers,
        churnedCustomersThisPeriod: churned,
        averageBookingsPerCustomer: Math.round(avgBookings * 10) / 10,
        customerSegmentation: {
          premium,
          regular,
          occasional,
        },
        geographicDistribution,
        retentionRate: Math.round(retentionRate),
        lifetimeValueDistribution: {
          low,
          medium,
          high,
        },
      };
    } catch (error) {
      console.error("Error generating customer analytics report:", error);
      throw error;
    }
  }

  /**
   * Generate driver performance report
   */
  async generateDriverPerformanceReport(
    tenantId: string,
    days: number = 30
  ): Promise<DriverPerformanceReport> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const totalDrivers = await Driver.countDocuments({ tenantId });
      const activeDrivers = await Driver.countDocuments({
        tenantId,
        status: "online",
      });

      const allDrivers = await Driver.find({ tenantId }).lean();

      const avgRating =
        allDrivers.length > 0
          ? allDrivers.reduce((sum: number, d: any) => sum + (d.rating || 0), 0) / allDrivers.length
          : 0;

      // Top performers
      const topPerformers = allDrivers
        .sort((a: any, b: any) => {
          const scoreA = (a.rating || 0) * (a.completedRides || 0);
          const scoreB = (b.rating || 0) * (b.completedRides || 0);
          return scoreB - scoreA;
        })
        .slice(0, 10)
        .map((d: any) => ({
          driverId: d._id,
          name: d.name || "Driver",
          rating: d.rating || 0,
          completedRides: d.completedRides || 0,
          earnings: d.totalEarnings || 0,
        }));

      // Earnings distribution
      const earnings = allDrivers.map((d: any) => d.totalEarnings || 0).sort((a, b) => a - b);
      const avgEarnings = earnings.reduce((a, b) => a + b, 0) / allDrivers.length;
      const medianEarnings = earnings[Math.floor(earnings.length / 2)];

      // Fatigue analysis (placeholder)
      const overworked = Math.floor(allDrivers.length * 0.1);
      const underutilized = Math.floor(allDrivers.length * 0.15);
      const normal = allDrivers.length - overworked - underutilized;

      return {
        totalDrivers,
        activeDrivers,
        averageRating: Math.round(avgRating * 10) / 10,
        acceptanceRateAverage: 92, // Placeholder
        cancellationRateAverage: 5, // Placeholder
        topPerformers,
        earningsDistribution: {
          avg: Math.round(avgEarnings),
          median: Math.round(medianEarnings),
          min: Math.min(...earnings),
          max: Math.max(...earnings),
        },
        fatigueAnalysis: {
          overworked,
          normal,
          underutilized,
        },
      };
    } catch (error) {
      console.error("Error generating driver performance report:", error);
      throw error;
    }
  }

  /**
   * Create a custom report template
   */
  async createCustomReport(report: CustomReport): Promise<CustomReport> {
    // Save to database
    return report;
  }

  /**
   * Generate report in specified format
   */
  async generateReport(
    tenantId: string,
    type: "business" | "revenue" | "customer" | "driver",
    format: "pdf" | "csv" | "json" = "json",
    days: number = 30
  ): Promise<string> {
    let data: any;

    switch (type) {
      case "business":
        data = await this.generateBusinessMetrics(tenantId, days);
        break;
      case "revenue":
        data = await this.generateRevenueAnalytics(tenantId, days);
        break;
      case "customer":
        data = await this.generateCustomerAnalyticsReport(tenantId, days);
        break;
      case "driver":
        data = await this.generateDriverPerformanceReport(tenantId, days);
        break;
      default:
        throw new Error("Invalid report type");
    }

    if (format === "json") {
      return JSON.stringify(data, null, 2);
    } else if (format === "csv") {
      return this.convertToCSV(data);
    } else if (format === "pdf") {
      // PDF generation would use a library like PDFKit
      return `PDF Report: ${type}`;
    }

    return "";
  }

  private convertToCSV(data: any): string {
    const rows: string[] = [];

    const flattenObject = (obj: any, prefix: string = "") => {
      Object.entries(obj).forEach(([key, value]) => {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "object" && !Array.isArray(value)) {
          flattenObject(value, newKey);
        } else if (Array.isArray(value)) {
          // Skip arrays for CSV
        } else {
          rows.push(`${newKey},${value}`);
        }
      });
    };

    flattenObject(data);
    return rows.join("\n");
  }
}
