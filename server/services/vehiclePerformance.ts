// Monthly vehicle performance — same principle as driverPerformance.ts:
// every figure is computed live from actual bookings/expenses, nothing
// hand-entered or cached separately to drift out of sync.

import { bookingKilometers } from './vehicleFeedbackService';

const vehicleIssueCategories = new Set(['vehicle_problem', 'vehicle_cleanliness', 'vehicle_breakdown', 'ac_problem', 'wrong_vehicle', 'self_drive_issue']);

export interface VehiclePerformanceSummary {
  vehicleId: string;
  vehicleName: string;
  registrationNumber: string;
  totalTrips: number;
  completedTrips: number;
  totalKilometers: number;
  totalRevenue: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  netProfit: number;
  revenuePerKm: number | null;
  profitPerKm: number | null;
  damageIncidentCount: number;
  averageVehicleRating: number | null;
  cleanlinessRating: number | null;
  comfortRating: number | null;
  acRating: number | null;
  verifiedVehicleIssueCount: number;
}

export function buildVehiclePerformance(
  bookings: any[],
  expenses: any[],
  vehicles: any[],
  monthStart: Date,
  monthEnd: Date,
  feedback: any[] = [],
  complaints: any[] = []
): VehiclePerformanceSummary[] {
  const byVehicle = new Map<string, { trips: any[]; expenses: any[]; feedback: any[]; complaints: any[] }>();
  const bookingVehicle = new Map<string, string>();

  const vehicleIdOf = (v: any) => (v && typeof v === 'object' ? (v._id?.toString?.() || v._id) : v?.toString?.() || v);

  for (const b of bookings) {
    if (!b.vehicleId) continue;
    const pickup = new Date(b.pickupDate);
    if (pickup < monthStart || pickup >= monthEnd) continue;
    const vId = vehicleIdOf(b.vehicleId);
    if (!byVehicle.has(vId)) byVehicle.set(vId, { trips: [], expenses: [], feedback: [], complaints: [] });
    byVehicle.get(vId)!.trips.push(b);
    bookingVehicle.set(vehicleIdOf(b._id), vId);
  }

  for (const e of expenses) {
    if (!e.vehicleId) continue;
    const date = new Date(e.date);
    if (date < monthStart || date >= monthEnd) continue;
    const vId = vehicleIdOf(e.vehicleId);
    if (!byVehicle.has(vId)) byVehicle.set(vId, { trips: [], expenses: [], feedback: [], complaints: [] });
    byVehicle.get(vId)!.expenses.push(e);
  }

  for (const row of feedback) {
    const bookingId = vehicleIdOf(row.bookingId);
    if (!bookingVehicle.has(bookingId)) continue;
    const vId = row.vehicleId ? vehicleIdOf(row.vehicleId) : bookingVehicle.get(bookingId)!;
    if (!byVehicle.has(vId)) byVehicle.set(vId, { trips: [], expenses: [], feedback: [], complaints: [] });
    byVehicle.get(vId)!.feedback.push(row);
  }

  for (const row of complaints) {
    const bookingId = vehicleIdOf(row.bookingId);
    if (!bookingVehicle.has(bookingId)) continue;
    const vId = row.vehicleId ? vehicleIdOf(row.vehicleId) : bookingVehicle.get(bookingId)!;
    if (!byVehicle.has(vId)) byVehicle.set(vId, { trips: [], expenses: [], feedback: [], complaints: [] });
    byVehicle.get(vId)!.complaints.push(row);
  }

  const vehicleById = new Map(vehicles.map((v: any) => [v._id?.toString?.() || v._id, v]));
  const results: VehiclePerformanceSummary[] = [];

  for (const [vehicleId, { trips, expenses: vExpenses, feedback: vFeedback, complaints: vComplaints }] of byVehicle) {
    const vehicle = vehicleById.get(vehicleId);
    if (!vehicle) continue; // deleted/foreign vehicle reference — skip rather than show garbage

    let completedTrips = 0;
    let totalKilometers = 0;
    let totalRevenue = 0;
    for (const b of trips) {
      if (['completed', 'payment_pending', 'closed'].includes(b.status)) completedTrips++;
      totalKilometers += bookingKilometers(b);
      totalRevenue += b.totalAmount || 0;
    }

    const expensesByCategory: Record<string, number> = {};
    let totalExpenses = 0;
    let damageIncidentCount = 0;
    for (const e of vExpenses) {
      const cat = e.category || 'other';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (e.amount || 0);
      totalExpenses += e.amount || 0;
      if (cat === 'damage') damageIncidentCount++;
    }

    const netProfit = totalRevenue - totalExpenses;
    const avg = (field: string) => {
      const values = vFeedback.map((row) => Number(row[field])).filter((value) => value >= 1 && value <= 5);
      return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
    };

    results.push({
      vehicleId,
      vehicleName: [vehicle.make, vehicle.vehicleModel].filter(Boolean).join(' '),
      registrationNumber: vehicle.licensePlate || '-',
      totalTrips: trips.length,
      completedTrips,
      totalKilometers,
      totalRevenue,
      totalExpenses,
      expensesByCategory,
      netProfit,
      revenuePerKm: totalKilometers > 0 ? Math.round((totalRevenue / totalKilometers) * 100) / 100 : null,
      profitPerKm: totalKilometers > 0 ? Math.round((netProfit / totalKilometers) * 100) / 100 : null,
      damageIncidentCount,
      averageVehicleRating: avg('vehicleRating'),
      cleanlinessRating: avg('vehicleCleanlinessRating'),
      comfortRating: avg('vehicleComfortRating'),
      acRating: avg('vehicleAcRating'),
      verifiedVehicleIssueCount: vComplaints.filter((row) => row.responsibleParty === 'vehicle' && vehicleIssueCategories.has(row.category)).length
        + vFeedback.filter((row) => row.vehicleIssueReported || row.breakdownOccurred).length,
    });
  }

  return results.sort((a, b) => b.netProfit - a.netProfit);
}
