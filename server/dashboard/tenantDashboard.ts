import type { Express } from "express";
import mongoose from "mongoose";
import { authenticateUser, requireTenant, type AuthRequest } from "../middleware/auth";
import { Booking, Vehicle, Driver, Customer, PaymentTransaction } from "../models/index";
import { RECEIPT_TYPES } from "../services/paymentLedger";

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function registerTenantDashboardRoute(app: Express) {
  app.get("/api/tenant/dashboard", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      // Month boundaries
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const lastMonthEnd = new Date(thisMonthStart);
      lastMonthEnd.setDate(0);
      lastMonthEnd.setHours(23, 59, 59, 999);

      const lastMonthStart = new Date(lastMonthEnd);
      lastMonthStart.setDate(1);
      lastMonthStart.setHours(0, 0, 0, 0);

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      twelveMonthsAgo.setDate(1);
      twelveMonthsAgo.setHours(0, 0, 0, 0);

      const [
        totalBookings,
        totalRevenue,
        totalCustomers,
        totalDrivers,
        totalVehicles,
        completedBookings,
        recentBookings,
        topCustomers,
        thisMonthBookings,
        thisMonthRevenue,
        lastMonthBookings,
        lastMonthRevenue,
        bookingsByMonth,
        dailyBookingsTrend,
        recentPayments,
        allCustomers,
      ] = await Promise.all([
        // Total bookings count
        Booking.countDocuments({ tenantId }),

        // Total revenue from completed bookings
        Booking.aggregate([
          { $match: { tenantId: tenantObjectId, status: "completed" } },
          { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } } } },
        ]),

        // Total unique customers
        Customer.countDocuments({ tenantId, isDeleted: { $ne: true } }),

        // Total drivers
        Driver.countDocuments({ tenantId }),

        // Total vehicles
        Vehicle.countDocuments({ tenantId }),

        // Completed bookings for completion rate
        Booking.countDocuments({ tenantId, status: "completed" }),

        // Recent bookings
        Booking.find({ tenantId })
          .select("bookingId pickupLocation dropoffLocation status totalAmount customerName createdAt completedAt")
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),

        // Top customers by spend
        Booking.aggregate([
          { $match: { tenantId: tenantObjectId, status: "completed" } },
          {
            $group: {
              _id: "$customerId",
              totalSpent: { $sum: { $ifNull: ["$totalAmount", 0] } },
              totalBookings: { $sum: 1 },
              lastBookingDate: { $max: "$createdAt" },
              customerName: { $first: "$customerName" },
            },
          },
          { $sort: { totalSpent: -1 } },
          { $limit: 10 },
        ]),

        // This month bookings
        Booking.countDocuments({
          tenantId,
          createdAt: { $gte: thisMonthStart, $lte: now },
        }),

        // This month revenue
        Booking.aggregate([
          {
            $match: {
              tenantId: tenantObjectId,
              status: "completed",
              createdAt: { $gte: thisMonthStart, $lte: now },
            },
          },
          { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } } } },
        ]),

        // Last month bookings
        Booking.countDocuments({
          tenantId,
          createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        }),

        // Last month revenue
        Booking.aggregate([
          {
            $match: {
              tenantId: tenantObjectId,
              status: "completed",
              createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
            },
          },
          { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } } } },
        ]),

        // Revenue by month (last 12 months)
        Booking.aggregate([
          {
            $match: {
              tenantId: tenantObjectId,
              status: "completed",
              createdAt: { $gte: twelveMonthsAgo },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
              },
              revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),

        // Daily booking trends (last 30 days)
        Booking.aggregate([
          {
            $match: {
              tenantId: tenantObjectId,
              createdAt: { $gte: thirtyDaysAgo, $lte: now },
            },
          },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                status: "$status",
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.date": 1 } },
        ]),

        // Recent payments
        PaymentTransaction.find({
          tenantId,
          status: "completed",
          receivedAt: { $gte: lastMonthStart },
        })
          .select("amount receivedAt")
          .lean(),

        // All customers for segmentation
        Customer.find({ tenantId, isDeleted: { $ne: true } })
          .select("totalBookings status")
          .lean(),
      ]);

      // Calculate metrics
      const totalBookingsCount = totalBookings || 0;
      const totalRevenueAmount = totalRevenue[0]?.total || 0;
      const completedBookingsCount = completedBookings || 0;

      const bookingCompletionRate =
        totalBookingsCount > 0
          ? (completedBookingsCount / totalBookingsCount) * 100
          : 0;

      const avgRevenuePerBooking =
        completedBookingsCount > 0
          ? totalRevenueAmount / completedBookingsCount
          : 0;

      // Customer retention: repeat customers / total customers
      const repeatCustomers = allCustomers.filter((c: any) => c.totalBookings > 1).length;
      const customerRetention =
        totalCustomers > 0
          ? (repeatCustomers / totalCustomers) * 100
          : 0;

      // Growth rate calculation
      const thisMonthBookingsCount = thisMonthBookings || 0;
      const thisMonthRevenueAmount = thisMonthRevenue[0]?.total || 0;
      const lastMonthBookingsCount = lastMonthBookings || 0;
      const lastMonthRevenueAmount = lastMonthRevenue[0]?.total || 0;

      let growthRate = 0;
      if (lastMonthRevenueAmount > 0) {
        growthRate =
          ((thisMonthRevenueAmount - lastMonthRevenueAmount) /
            lastMonthRevenueAmount) *
          100;
      } else if (thisMonthRevenueAmount > 0) {
        growthRate = 100;
      }

      // Build revenue by month chart
      const revenueByMonthChart = bookingsByMonth.map((row: any) => {
        const month = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
        return {
          month,
          revenue: row.revenue,
        };
      });

      // Build daily booking trend
      const dailyMap = new Map<string, { completed: number; pending: number }>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(thirtyDaysAgo);
        d.setDate(d.getDate() + i);
        const key = localDayKey(d);
        dailyMap.set(key, { completed: 0, pending: 0 });
      }

      for (const row of dailyBookingsTrend) {
        const key = row._id.date;
        const bucket = dailyMap.get(key);
        if (bucket) {
          if (row._id.status === "completed") {
            bucket.completed = row.count;
          } else {
            bucket.pending += row.count;
          }
        }
      }

      const bookingTrend = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      }));

      // Customer segmentation: by booking count
      const segmentMap = new Map<string, number>();
      for (const customer of allCustomers) {
        const totalBooks = customer.totalBookings || 0;
        let segment = "One-time";
        if (totalBooks > 10) {
          segment = "Gold (10+ bookings)";
        } else if (totalBooks > 5) {
          segment = "Silver (5-10 bookings)";
        } else if (totalBooks > 1) {
          segment = "Bronze (2-5 bookings)";
        }
        segmentMap.set(segment, (segmentMap.get(segment) || 0) + 1);
      }

      const customerSegments = Array.from(segmentMap.entries()).map(([segment, count]) => ({
        segment,
        count,
      }));

      res.json({
        periodDays: 30,
        metrics: {
          bookings: totalBookingsCount,
          revenue: totalRevenueAmount,
          customers: totalCustomers || 0,
          drivers: totalDrivers || 0,
          vehicles: totalVehicles || 0,
          bookingCompletionRate: Math.round(bookingCompletionRate * 100) / 100,
          avgRevenuePerBooking: Math.round(avgRevenuePerBooking),
          customerRetention: Math.round(customerRetention * 100) / 100,
        },
        performanceKpis: {
          bookingsThisMonth: thisMonthBookingsCount,
          revenueThisMonth: thisMonthRevenueAmount,
          bookingsLastMonth: lastMonthBookingsCount,
          revenueLastMonth: lastMonthRevenueAmount,
          growthRate: Math.round(growthRate * 100) / 100,
        },
        recentBookings: recentBookings.map((b: any) => ({
          _id: b._id,
          bookingId: b.bookingId || "N/A",
          pickupLocation: b.pickupLocation || "Unknown",
          dropoffLocation: b.dropoffLocation || "Unknown",
          status: b.status || "unknown",
          totalAmount: b.totalAmount || 0,
          customerName: b.customerName || "Unknown",
          createdAt: b.createdAt,
          completedAt: b.completedAt,
        })),
        topCustomers: topCustomers.map((c: any) => ({
          _id: c._id,
          name: c.customerName || "Unknown",
          totalBookings: c.totalBookings || 0,
          totalSpent: c.totalSpent || 0,
          lastBookingDate: c.lastBookingDate,
          status: c.totalBookings > 1 ? "active" : "occasional",
        })),
        bookingTrend,
        revenueByMonth: revenueByMonthChart,
        customerSegments,
      });
    } catch (error) {
      console.error("Tenant dashboard error:", error);
      res.status(500).json({ message: "Failed to load tenant dashboard" });
    }
  });
}
