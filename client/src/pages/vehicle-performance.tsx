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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Performance</h1>
          <p className="text-sm text-gray-500">Revenue, expenses and profit computed live from actual bookings and expense records.</p>
        </div>
        <div>
          <Label className="text-xs">Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
      </div>

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
