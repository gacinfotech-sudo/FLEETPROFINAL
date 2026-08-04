// Monthly vehicle performance — same principle as driverPerformance.ts:
// every figure is computed live from actual bookings/expenses, nothing
// hand-entered or cached separately to drift out of sync.

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
}

export function buildVehiclePerformance(
  bookings: any[],
  expenses: any[],
  vehicles: any[],
  monthStart: Date,
  monthEnd: Date
): VehiclePerformanceSummary[] {
  const byVehicle = new Map<string, { trips: any[]; expenses: any[] }>();

  const vehicleIdOf = (v: any) => (v && typeof v === 'object' ? (v._id?.toString?.() || v._id) : v?.toString?.() || v);

  for (const b of bookings) {
    if (!b.vehicleId) continue;
    const pickup = new Date(b.pickupDate);
    if (pickup < monthStart || pickup >= monthEnd) continue;
    const vId = vehicleIdOf(b.vehicleId);
    if (!byVehicle.has(vId)) byVehicle.set(vId, { trips: [], expenses: [] });
    byVehicle.get(vId)!.trips.push(b);
  }

  for (const e of expenses) {
    if (!e.vehicleId) continue;
    const date = new Date(e.date);
    if (date < monthStart || date >= monthEnd) continue;
    const vId = vehicleIdOf(e.vehicleId);
    if (!byVehicle.has(vId)) byVehicle.set(vId, { trips: [], expenses: [] });
    byVehicle.get(vId)!.expenses.push(e);
  }

  const vehicleById = new Map(vehicles.map((v: any) => [v._id?.toString?.() || v._id, v]));
  const results: VehiclePerformanceSummary[] = [];

  for (const [vehicleId, { trips, expenses: vExpenses }] of byVehicle) {
    const vehicle = vehicleById.get(vehicleId);
    if (!vehicle) continue; // deleted/foreign vehicle reference — skip rather than show garbage

    let completedTrips = 0;
    let totalKilometers = 0;
    let totalRevenue = 0;
    for (const b of trips) {
      if (['completed', 'payment_pending', 'closed'].includes(b.status)) completedTrips++;
      totalKilometers += b.totalKilometers || 0;
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
    });
  }

  return results.sort((a, b) => b.netProfit - a.netProfit);
}
