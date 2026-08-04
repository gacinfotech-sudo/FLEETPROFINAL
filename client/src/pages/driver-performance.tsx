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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Driver Performance</h1>
          <p className="text-sm text-gray-500">Computed live from actual booking records — every number here traces back to a real trip.</p>
        </div>
        <div>
          <Label className="text-xs">Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
      </div>

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
