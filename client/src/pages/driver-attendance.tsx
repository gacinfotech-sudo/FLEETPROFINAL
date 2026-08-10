import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_BADGE: Record<string, { label: string; variant: any }> = {
  present: { label: "Present", variant: "default" },
  on_duty: { label: "On Duty", variant: "default" },
  late: { label: "Late", variant: "destructive" },
  absent: { label: "Absent", variant: "destructive" },
  weekly_off: { label: "Weekly Off", variant: "secondary" },
  paid_leave: { label: "Paid Leave", variant: "secondary" },
  unpaid_leave: { label: "Unpaid Leave", variant: "secondary" },
  half_day: { label: "Half Day", variant: "secondary" },
  not_scheduled: { label: "Not Scheduled", variant: "outline" },
};

export default function DriverAttendancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [markingDriver, setMarkingDriver] = useState<any>(null);
  const [manualStatus, setManualStatus] = useState("present");

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/attendance/daily?date=${date}`],
  });

  const drivers: any[] = (data as any)?.drivers || [];

  const markMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/drivers/${markingDriver.driverId}/attendance`, {
        date, status: manualStatus,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/attendance/daily?date=${date}`] });
      toast({ title: "Attendance marked" });
      setMarkingDriver(null);
    },
    onError: (err: any) => toast({ title: "Could not mark attendance", description: err.message, variant: "destructive" }),
  });

  const stats = {
    present: drivers.filter((d: any) => d.status === 'present' || d.status === 'on_duty').length,
    late: drivers.filter((d: any) => d.status === 'late').length,
    absent: drivers.filter((d: any) => d.status === 'absent').length,
    onLeave: drivers.filter((d: any) => d.status === 'paid_leave' || d.status === 'unpaid_leave' || d.status === 'weekly_off').length,
  };

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="gradient-header bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">📋 Driver Attendance</h1>
            <p className="text-purple-100 mt-1">Auto-marked on trip start • Manual override for non-duty days</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <Label className="text-xs text-white">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 bg-white/10 border-white/30 text-white" />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="stat-card card-hover bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">✅ PRESENT</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{stats.present}</p>
              <p className="text-xs text-gray-500 mt-1">On duty</p>
            </CardContent>
          </Card>
          <Card className="stat-card card-hover bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">⏱️ LATE</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.late}</p>
              <p className="text-xs text-gray-500 mt-1">Delayed arrival</p>
            </CardContent>
          </Card>
          <Card className="stat-card card-hover bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">❌ ABSENT</p>
              <p className="text-2xl font-bold text-red-600 mt-2">{stats.absent}</p>
              <p className="text-xs text-gray-500 mt-1">Not marked</p>
            </CardContent>
          </Card>
          <Card className="stat-card card-hover bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">🏖️ ON LEAVE</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{stats.onLeave}</p>
              <p className="text-xs text-gray-500 mt-1">Leave approved</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{drivers.length} driver{drivers.length === 1 ? "" : "s"}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : isError ? (
            <p className="text-sm text-red-600">Failed to load attendance.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Driver</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Check-in</TableCell>
                  <TableCell>Late</TableCell>
                  <TableCell>Current Duty</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((d) => {
                  const badge = STATUS_BADGE[d.status] || STATUS_BADGE.not_scheduled;
                  return (
                    <TableRow key={d.driverId}>
                      <TableCell className="font-medium">{d.driverName}</TableCell>
                      <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                      <TableCell>{d.actualCheckIn ? new Date(d.actualCheckIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-"}</TableCell>
                      <TableCell>{d.lateDurationMinutes ? `${d.lateDurationMinutes} min` : "-"}</TableCell>
                      <TableCell className="text-sm">
                        {d.currentBooking ? `${d.currentBooking.bookingId} — ${d.currentBooking.customerName}` : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{d.source}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => { setMarkingDriver(d); setManualStatus(d.status === "not_scheduled" ? "present" : d.status); }}>
                          Mark
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!markingDriver} onOpenChange={(v) => { if (!v) setMarkingDriver(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark Attendance — {markingDriver?.driverName}</DialogTitle></DialogHeader>
          <div>
            <Label>Status</Label>
            <Select value={manualStatus} onValueChange={setManualStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
                <SelectItem value="weekly_off">Weekly Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkingDriver(null)}>Cancel</Button>
            <Button disabled={markMutation.isPending} onClick={() => markMutation.mutate()}>
              {markMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
