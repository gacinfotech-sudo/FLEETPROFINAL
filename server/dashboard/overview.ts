import type { Express } from "express";
import mongoose from "mongoose";
import { authenticateUser, requireTenant, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage-mongodb";
import { Booking, Vehicle, Driver, Customer, PaymentTransaction } from "../models/index";
import { GpsDevice } from "../gps/models/gpsDevice";
import { GpsConnection } from "../gps/models/gpsConnection";
import { RECEIPT_TYPES } from "../services/paymentLedger";
import { buildLiveOperations } from "../services/liveOperations";
import { buildPaymentDues } from "../services/paymentDues";

// Booking.status → the four operational groups the Dashboard's Booking
// Activity chart shows. Grouping mirrors the canonical enum in
// server/models/index.ts — every enum value maps to exactly one group so
// the chart's total always equals the tenant's real booking count.
const STATUS_GROUPS: Record<string, "pipeline" | "confirmed" | "running" | "completed" | "cancelled"> = {
  enquiry: "pipeline",
  quotation_sent: "pipeline",
  tentative: "pipeline",
  on_hold: "pipeline",
  upcoming: "pipeline",
  confirmed: "confirmed",
  vehicle_assigned: "confirmed",
  driver_assigned: "confirmed",
  ready_for_dispatch: "confirmed",
  trip_started: "running",
  ongoing: "running",
  extended: "running",
  return_pending: "running",
  live: "running",
  completed: "completed",
  payment_pending: "completed",
  closed: "completed",
  cancelled: "cancelled",
  no_show: "cancelled",
};

const ACTIVE_STATUSES = Object.entries(STATUS_GROUPS)
  .filter(([, g]) => g === "confirmed" || g === "running")
  .map(([s]) => s);

function localDayKey(d: Date): string {
  // Server-local day boundaries, consistent with /api/dashboard/finance-summary.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// One aggregated endpoint powering the redesigned Dashboard Overview:
// KPIs, revenue/collections trend, booking status distribution, fleet and
// driver status, attention items, recent customers, and GPS device health.
// Replaces the previous pattern of the dashboard page separately fetching
// the full /api/vehicles, /api/drivers and /api/bookings collections just
// to count them client-side.
export function registerDashboardOverviewRoute(app: Express) {
  app.get("/api/dashboard/overview", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;

      const periodStart = new Date();
      periodStart.setHours(0, 0, 0, 0);
      periodStart.setDate(periodStart.getDate() - (days - 1));
      const now = new Date();

      const [
        vehicleStatusRows,
        driverStatusRows,
        bookingStatusRows,
        revenueAllTimeRows,
        completedInPeriod,
        receiptsInPeriod,
        recentCustomers,
        bookings,
        gpsConnections,
        gpsDeviceRows,
      ] = await Promise.all([
        Vehicle.aggregate([
          { $match: { tenantId: tenantObjectId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Driver.aggregate([
          { $match: { tenantId: tenantObjectId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Booking.aggregate([
          { $match: { tenantId: tenantObjectId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        // All-time revenue: completed bookings only — the same definition
        // the Revenue Report (getRevenueReport) uses, so the KPI never
        // contradicts the page its "View Report" action opens.
        Booking.aggregate([
          { $match: { tenantId: tenantObjectId, status: "completed" } },
          { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } }, count: { $sum: 1 } } },
        ]),
        Booking.find({
          tenantId,
          status: "completed",
          createdAt: { $gte: periodStart, $lte: now },
        }).select("totalAmount createdAt").lean(),
        PaymentTransaction.find({
          tenantId,
          status: "completed",
          paymentType: { $in: Array.from(RECEIPT_TYPES) },
          receivedAt: { $gte: periodStart, $lte: now },
        }).select("amount receivedAt").lean(),
        Customer.find({ tenantId, isDeleted: { $ne: true } })
          .sort({ updatedAt: -1 })
          .limit(4)
          .select("name primaryMobile totalBookings lastBookingDate status")
          .lean(),
        // Full booking list is what the existing live-ops/payment-dues
        // services take as input (same as /api/operations/* endpoints).
        storage.getBookingsByTenant(tenantId),
        GpsConnection.find({ tenantId }).select("status enabled").lean(),
        GpsDevice.aggregate([
          { $match: { tenantId: tenantObjectId, status: { $ne: "removed" } } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
      ]);

      const countByStatus = (rows: Array<{ _id: string; count: number }>) =>
        Object.fromEntries(rows.map((r) => [r._id, r.count]));

      const vehicleCounts = countByStatus(vehicleStatusRows);
      const driverCounts = countByStatus(driverStatusRows);
      const bookingCounts = countByStatus(bookingStatusRows);

      const bookingGroups = { pipeline: 0, confirmed: 0, running: 0, completed: 0, cancelled: 0 };
      for (const [status, count] of Object.entries(bookingCounts)) {
        bookingGroups[STATUS_GROUPS[status] ?? "pipeline"] += count as number;
      }

      // Daily buckets covering every day of the period (zero-filled so the
      // chart x-axis never has gaps).
      const trendByDay = new Map<string, { date: string; revenue: number; collections: number }>();
      for (let i = 0; i < days; i++) {
        const d = new Date(periodStart);
        d.setDate(d.getDate() + i);
        const key = localDayKey(d);
        trendByDay.set(key, { date: key, revenue: 0, collections: 0 });
      }
      for (const b of completedInPeriod) {
        const key = localDayKey(new Date(b.createdAt as any));
        const bucket = trendByDay.get(key);
        if (bucket) bucket.revenue += (b as any).totalAmount || 0;
      }
      for (const t of receiptsInPeriod) {
        const key = localDayKey(new Date((t as any).receivedAt));
        const bucket = trendByDay.get(key);
        if (bucket) bucket.collections += (t as any).amount || 0;
      }
      const revenueTrend = Array.from(trendByDay.values());
      const periodRevenue = revenueTrend.reduce((s, r) => s + r.revenue, 0);
      const periodCollections = revenueTrend.reduce((s, r) => s + r.collections, 0);

      // Attention items — derived from the same canonical services the
      // Live Bookings and Payment Collection pages already use.
      const live = buildLiveOperations(bookings as any[], now);
      const dues = buildPaymentDues(bookings as any[], now);
      const totalDue = dues.reduce((s: number, d: any) => s + (d.remainingBalance || 0), 0);
      const maintenanceCount = vehicleCounts["maintenance"] || 0;
      const gpsOffline = (gpsDeviceRows.find((r: any) => r._id === "offline")?.count || 0) +
        (gpsDeviceRows.find((r: any) => r._id === "faulty")?.count || 0);

      const attention: Array<{ id: string; severity: "critical" | "warning"; label: string; detail: string; count: number; view: string }> = [];
      if (live.startDelayed.length > 0) attention.push({ id: "delayed-pickups", severity: "critical", label: "Delayed pickups", detail: "Trips past their scheduled start without dispatch", count: live.startDelayed.length, view: "live-bookings" });
      if (live.unassigned.length > 0) attention.push({ id: "unassigned-bookings", severity: "critical", label: "Unassigned bookings", detail: "Upcoming bookings missing a vehicle or driver", count: live.unassigned.length, view: "live-bookings" });
      if (live.completionOverdue.length > 0) attention.push({ id: "completion-overdue", severity: "critical", label: "Completion overdue", detail: "Trips past their scheduled return", count: live.completionOverdue.length, view: "live-bookings" });
      if (dues.length > 0) attention.push({ id: "payment-dues", severity: "warning", label: "Payments due", detail: `₹${totalDue.toLocaleString("en-IN")} outstanding across ${dues.length} booking${dues.length === 1 ? "" : "s"}`, count: dues.length, view: "payment-dues" });
      if (maintenanceCount > 0) attention.push({ id: "vehicles-maintenance", severity: "warning", label: "Vehicles in maintenance", detail: "Unavailable for booking until released", count: maintenanceCount, view: "fleet" });
      if (gpsOffline > 0) attention.push({ id: "gps-offline", severity: "warning", label: "GPS devices offline", detail: "Devices not reporting telemetry", count: gpsOffline, view: "gps-tracking" });
      attention.sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "critical" ? -1 : 1));

      const gpsConfigured = gpsConnections.some((c: any) => c.enabled || c.status === "connected");
      const gpsDeviceCounts = countByStatus(gpsDeviceRows as any);

      res.json({
        periodDays: days,
        kpis: {
          revenue: {
            allTime: revenueAllTimeRows[0]?.total || 0,
            period: periodRevenue,
            collectionsPeriod: periodCollections,
            completedTrips: revenueAllTimeRows[0]?.count || 0,
          },
          bookings: {
            total: Object.values(bookingCounts).reduce((s: number, c) => s + (c as number), 0),
            active: ACTIVE_STATUSES.reduce((s, st) => s + (bookingCounts[st] || 0), 0),
            pipeline: bookingGroups.pipeline,
          },
          vehicles: {
            total: Object.values(vehicleCounts).reduce((s: number, c) => s + (c as number), 0),
            available: vehicleCounts["available"] || 0,
            onTrip: vehicleCounts["on_trip"] || 0,
            maintenance: maintenanceCount,
            reserved: vehicleCounts["RESERVED"] || 0,
            assigned: vehicleCounts["ASSIGNED"] || 0,
          },
          drivers: {
            total: Object.values(driverCounts).reduce((s: number, c) => s + (c as number), 0),
            available: driverCounts["available"] || 0,
            onDuty: driverCounts["on_duty"] || 0,
            inactive: driverCounts["inactive"] || 0,
          },
        },
        revenueTrend,
        bookingGroups,
        attention: attention.slice(0, 4),
        attentionTotal: attention.length,
        recentCustomers,
        gps: {
          configured: gpsConfigured,
          online: gpsDeviceCounts["online"] || 0,
          offline: (gpsDeviceCounts["offline"] || 0) + (gpsDeviceCounts["faulty"] || 0),
          idle: (gpsDeviceCounts["assigned"] || 0) + (gpsDeviceCounts["unassigned"] || 0) + (gpsDeviceCounts["inactive"] || 0),
        },
      });
    } catch (error) {
      console.error("Dashboard overview error:", error);
      res.status(500).json({ message: "Failed to load dashboard overview" });
    }
  });
}
