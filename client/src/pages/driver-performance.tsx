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

export default function DriverPerformancePage() {
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/reports/driver-performance?month=${month}`],
  });

  const drivers: any[] = (data as any)?.drivers || [];

  const stats = {
    totalTrips: drivers.reduce((sum: number, d: any) => sum + (d.tripsAssigned || 0), 0),
    completed: drivers.reduce((sum: number, d: any) => sum + (d.tripsCompleted || 0), 0),
    avgRating: drivers.length > 0 ? (drivers.reduce((sum: number, d: any) => sum + (d.rating || 0), 0) / drivers.length).toFixed(1) : 0,
  };

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">📊 Driver Performance</h1>
            <p className="text-indigo-100 mt-1">Live metrics from actual trips • Real-time driver ratings & stats</p>
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
          <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">👥 DRIVERS</p>
              <p className="text-2xl font-bold text-indigo-600 mt-2">{drivers.length}</p>
              <p className="text-xs text-gray-500 mt-1">Active this month</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">🚗 TRIPS</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{stats.totalTrips}</p>
              <p className="text-xs text-gray-500 mt-1">Total assigned</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">✅ COMPLETED</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{stats.completed}</p>
              <p className="text-xs text-gray-500 mt-1">Successfully done</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">⭐ AVG RATING</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.avgRating}</p>
              <p className="text-xs text-gray-500 mt-1">Average score</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{drivers.length} driver{drivers.length === 1 ? "" : "s"} with activity in {month}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : isError ? (
            <p className="text-sm text-red-600">Failed to load driver performance.</p>
          ) : drivers.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No driver activity in this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>Driver</TableCell>
                    <TableCell>Assigned</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Cancelled</TableCell>
                    <TableCell>No-shows</TableCell>
                    <TableCell>On-time %</TableCell>
                    <TableCell>Avg Delay</TableCell>
                    <TableCell>Kilometres</TableCell>
                    <TableCell>Revenue Handled</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((d) => (
                    <TableRow key={d.driverId}>
                      <TableCell className="font-medium">{d.driverName}</TableCell>
                      <TableCell>{d.totalAssignedTrips}</TableCell>
                      <TableCell>{d.completedTrips}</TableCell>
                      <TableCell>{d.cancelledDuties > 0 ? <Badge variant="destructive">{d.cancelledDuties}</Badge> : 0}</TableCell>
                      <TableCell>{d.noShows > 0 ? <Badge variant="destructive">{d.noShows}</Badge> : 0}</TableCell>
                      <TableCell>
                        {d.onTimeReportingPercentage === null ? (
                          <span className="text-gray-400 text-sm">No data</span>
                        ) : (
                          <Badge variant={d.onTimeReportingPercentage >= 90 ? "default" : d.onTimeReportingPercentage >= 70 ? "secondary" : "destructive"}>
                            {d.onTimeReportingPercentage}%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{d.averageDelayMinutes === null ? "-" : `${d.averageDelayMinutes} min`}</TableCell>
                      <TableCell>{d.totalKilometers.toLocaleString("en-IN")} km</TableCell>
                      <TableCell>{fmtMoney(d.revenueHandled)}</TableCell>
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
