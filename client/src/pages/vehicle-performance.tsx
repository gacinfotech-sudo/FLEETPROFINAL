import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function fmtMoney(n?: number) {
  if (!n) return "₹0";
  return `₹${n.toLocaleString("en-IN")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function VehiclePerformancePage() {
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/reports/vehicle-performance?month=${month}`],
  });

  const vehicles: any[] = (data as any)?.vehicles || [];

  const stats = {
    totalTrips: vehicles.reduce((sum: number, v: any) => sum + (v.tripsAssigned || 0), 0),
    totalRevenue: vehicles.reduce((sum: number, v: any) => sum + (v.revenue || 0), 0),
    totalExpenses: vehicles.reduce((sum: number, v: any) => sum + (v.expenses || 0), 0),
  };
  stats.totalProfit = stats.totalRevenue - stats.totalExpenses;

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-teal-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">🚗 Vehicle Performance</h1>
            <p className="text-cyan-100 mt-1">Revenue & profitability metrics • Live from actual trips & expenses</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <Label className="text-xs text-white">Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40 bg-white/10 border-white/30 text-white" />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">🚗 VEHICLES</p>
              <p className="text-2xl font-bold text-cyan-600 mt-2">{vehicles.length}</p>
              <p className="text-xs text-gray-500 mt-1">Active this month</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">📊 TRIPS</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{stats.totalTrips}</p>
              <p className="text-xs text-gray-500 mt-1">Total completed</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">💰 REVENUE</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{fmtMoney(stats.totalRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">Total earned</p>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br ${stats.totalProfit >= 0 ? 'from-emerald-50 to-green-50 border-green-200' : 'from-red-50 to-rose-50 border-red-200'}`}>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">📈 PROFIT</p>
              <p className={`text-2xl font-bold mt-2 ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtMoney(stats.totalProfit)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Net profit</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} with activity in {month}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : isError ? (
            <p className="text-sm text-red-600">Failed to load vehicle performance.</p>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No vehicle activity in this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>Vehicle</TableCell>
                    <TableCell>Trips</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Kilometres</TableCell>
                    <TableCell>Revenue</TableCell>
                    <TableCell>Expenses</TableCell>
                    <TableCell>Net Profit</TableCell>
                    <TableCell>Profit / km</TableCell>
                    <TableCell>Customer Feedback</TableCell>
                    <TableCell>Damage Incidents</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v) => (
                    <TableRow key={v.vehicleId}>
                      <TableCell className="font-medium">{v.vehicleName} <span className="text-xs text-gray-500">({v.registrationNumber})</span></TableCell>
                      <TableCell>{v.totalTrips}</TableCell>
                      <TableCell>{v.completedTrips}</TableCell>
                      <TableCell>{v.totalKilometers.toLocaleString("en-IN")} km</TableCell>
                      <TableCell>{fmtMoney(v.totalRevenue)}</TableCell>
                      <TableCell className="text-red-600">{fmtMoney(v.totalExpenses)}</TableCell>
                      <TableCell>
                        <Badge variant={v.netProfit >= 0 ? "default" : "destructive"}>{fmtMoney(v.netProfit)}</Badge>
                      </TableCell>
                      <TableCell>{v.profitPerKm === null ? "-" : `₹${v.profitPerKm}/km`}</TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <p className="font-medium">Rating: {v.averageVehicleRating === null ? 'Not rated' : `${v.averageVehicleRating} / 5`}</p>
                          <p className="text-gray-500">Clean {v.cleanlinessRating ?? '-'} · Comfort {v.comfortRating ?? '-'} · AC {v.acRating ?? '-'}</p>
                          {v.verifiedVehicleIssueCount > 0 && <p className="text-red-600">{v.verifiedVehicleIssueCount} verified issue{v.verifiedVehicleIssueCount === 1 ? '' : 's'}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{v.damageIncidentCount > 0 ? <Badge variant="destructive">{v.damageIncidentCount}</Badge> : 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
