import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, AlertCircle, Plus, TrendingUp } from "lucide-react";

export default function DriverAttendanceAutoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [showManualMark, setShowManualMark] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [reason, setReason] = useState("");

  const { data: attendanceData = {} } = useQuery({
    queryKey: ["/api/drivers/attendance", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/drivers/attendance?date=${selectedDate}`, { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["/api/drivers"],
    refetchInterval: 15000,
  });

  const { data: todayBookings = [] } = useQuery({
    queryKey: ["/api/bookings/today"],
    refetchInterval: 15000,
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async (driverId: string) => {
      return (await apiRequest("POST", `/api/drivers/${driverId}/mark-attendance`, {
        date: selectedDate,
        status: "present",
        reason: reason || "Auto-marked from booking",
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/attendance", selectedDate] });
      toast({ title: "Success", description: "Attendance marked" });
      setShowManualMark(false);
      setReason("");
      setSelectedDriver(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const markAbsentMutation = useMutation({
    mutationFn: async (driverId: string) => {
      return (await apiRequest("POST", `/api/drivers/${driverId}/mark-attendance`, {
        date: selectedDate,
        status: "absent",
        reason: reason || "Manually marked absent",
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/attendance", selectedDate] });
      toast({ title: "Success", description: "Marked as absent" });
      setShowManualMark(false);
      setReason("");
      setSelectedDriver(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const getDriverAttendanceStatus = (driver: any) => {
    const attendance = attendanceData[driver._id];
    if (!attendance) {
      // Check if driver has booking today
      const hasBooking = todayBookings.some((b: any) => b.driverId === driver._id);
      return {
        status: hasBooking ? "auto_booked" : "unmarked",
        marked: hasBooking,
        reason: hasBooking ? "Auto-marked from booking" : "No booking",
      };
    }
    return {
      status: attendance.status,
      marked: true,
      markedAt: attendance.markedAt,
      reason: attendance.reason,
    };
  };

  const presentCount = drivers.filter((d: any) => getDriverAttendanceStatus(d).marked).length;
  const absentCount = Object.values(attendanceData).filter((a: any) => a.status === "absent").length;
  const totalDrivers = drivers.length;
  const markedCount = Object.keys(attendanceData).length;

  const autoMarkedCount = drivers.filter((d: any) => {
    const status = getDriverAttendanceStatus(d);
    return status.status === "auto_booked";
  }).length;

  return (
    <div className="space-y-6">
      <div className="gradient-header bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">📋 Driver Attendance</h1>
            <p className="text-cyan-100 mt-1">Auto-mark from bookings • Manual marking available</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{presentCount}/{totalDrivers}</p>
            <p className="text-cyan-100">Present Today</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Present</p>
            <p className="text-3xl font-bold text-green-600">{presentCount}</p>
            <p className="text-xs text-gray-500 mt-1">Marked present</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Auto-Marked</p>
            <p className="text-3xl font-bold text-blue-600">
              {autoMarkedCount}
              <span className="text-sm ml-1">🤖</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">From bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Absent</p>
            <p className="text-3xl font-bold text-red-600">{absentCount}</p>
            <p className="text-xs text-gray-500 mt-1">Marked absent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-3xl font-bold text-orange-600">{totalDrivers - markedCount}</p>
            <p className="text-xs text-gray-500 mt-1">Not marked yet</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border-2 border-gray-200 rounded-lg px-4 py-2"
        />
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Drivers ({totalDrivers})</TabsTrigger>
          <TabsTrigger value="auto">Auto-Marked ({autoMarkedCount})</TabsTrigger>
          <TabsTrigger value="present">Present ({presentCount})</TabsTrigger>
          <TabsTrigger value="absent">Absent ({absentCount})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({totalDrivers - markedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <AttendanceTable
            drivers={drivers}
            attendanceData={attendanceData}
            todayBookings={todayBookings}
            getDriverAttendanceStatus={getDriverAttendanceStatus}
            selectedDriver={selectedDriver}
            setSelectedDriver={setSelectedDriver}
            showManualMark={showManualMark}
            setShowManualMark={setShowManualMark}
            reason={reason}
            setReason={setReason}
            markAttendanceMutation={markAttendanceMutation}
            markAbsentMutation={markAbsentMutation}
          />
        </TabsContent>

        <TabsContent value="auto">
          <AttendanceTable
            drivers={drivers.filter((d: any) => getDriverAttendanceStatus(d).status === "auto_booked")}
            attendanceData={attendanceData}
            todayBookings={todayBookings}
            getDriverAttendanceStatus={getDriverAttendanceStatus}
            selectedDriver={selectedDriver}
            setSelectedDriver={setSelectedDriver}
            showManualMark={showManualMark}
            setShowManualMark={setShowManualMark}
            reason={reason}
            setReason={setReason}
            markAttendanceMutation={markAttendanceMutation}
            markAbsentMutation={markAbsentMutation}
          />
        </TabsContent>

        <TabsContent value="present">
          <AttendanceTable
            drivers={drivers.filter((d: any) => {
              const status = getDriverAttendanceStatus(d);
              return (status.status === "present" || status.status === "auto_booked") && status.marked;
            })}
            attendanceData={attendanceData}
            todayBookings={todayBookings}
            getDriverAttendanceStatus={getDriverAttendanceStatus}
            selectedDriver={selectedDriver}
            setSelectedDriver={setSelectedDriver}
            showManualMark={showManualMark}
            setShowManualMark={setShowManualMark}
            reason={reason}
            setReason={setReason}
            markAttendanceMutation={markAttendanceMutation}
            markAbsentMutation={markAbsentMutation}
          />
        </TabsContent>

        <TabsContent value="absent">
          <AttendanceTable
            drivers={drivers.filter((d: any) => getDriverAttendanceStatus(d).status === "absent")}
            attendanceData={attendanceData}
            todayBookings={todayBookings}
            getDriverAttendanceStatus={getDriverAttendanceStatus}
            selectedDriver={selectedDriver}
            setSelectedDriver={setSelectedDriver}
            showManualMark={showManualMark}
            setShowManualMark={setShowManualMark}
            reason={reason}
            setReason={setReason}
            markAttendanceMutation={markAttendanceMutation}
            markAbsentMutation={markAbsentMutation}
          />
        </TabsContent>

        <TabsContent value="pending">
          <AttendanceTable
            drivers={drivers.filter((d: any) => !getDriverAttendanceStatus(d).marked)}
            attendanceData={attendanceData}
            todayBookings={todayBookings}
            getDriverAttendanceStatus={getDriverAttendanceStatus}
            selectedDriver={selectedDriver}
            setSelectedDriver={setSelectedDriver}
            showManualMark={showManualMark}
            setShowManualMark={setShowManualMark}
            reason={reason}
            setReason={setReason}
            markAttendanceMutation={markAttendanceMutation}
            markAbsentMutation={markAbsentMutation}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AttendanceTable({
  drivers,
  attendanceData,
  todayBookings,
  getDriverAttendanceStatus,
  selectedDriver,
  setSelectedDriver,
  showManualMark,
  setShowManualMark,
  reason,
  setReason,
  markAttendanceMutation,
  markAbsentMutation,
}: any) {
  return (
    <Card>
      <CardContent className="p-6">
        {drivers.length === 0 ? (
          <p className="text-gray-500 text-center py-6">No drivers to display</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Driver Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Today's Booking</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver: any) => {
                  const attendanceStatus = getDriverAttendanceStatus(driver);
                  const hasBooking = todayBookings.some((b: any) => b.driverId === driver._id);
                  const booking = hasBooking ? todayBookings.find((b: any) => b.driverId === driver._id) : null;

                  return (
                    <TableRow key={driver._id}>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell>{driver.primaryMobile || "-"}</TableCell>
                      <TableCell>
                        {booking ? (
                          <Badge className="bg-green-100 text-green-800">
                            {booking.bookingId} - {booking.customerName}
                          </Badge>
                        ) : (
                          <span className="text-gray-500 text-sm">No booking</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {attendanceStatus.status === "auto_booked" ? (
                          <Badge className="bg-blue-100 text-blue-800">
                            <Clock className="w-3 h-3 mr-1" /> Auto-Marked
                          </Badge>
                        ) : attendanceStatus.status === "present" ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" /> Present
                          </Badge>
                        ) : attendanceStatus.status === "absent" ? (
                          <Badge variant="destructive">Absent</Badge>
                        ) : (
                          <Badge variant="outline">
                            <AlertCircle className="w-3 h-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{attendanceStatus.reason || "-"}</TableCell>
                      <TableCell>
                        {!attendanceStatus.marked && (
                          <Dialog open={showManualMark && selectedDriver?._id === driver._id} onOpenChange={setShowManualMark}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedDriver(driver)}
                              >
                                <Plus className="w-4 h-4 mr-1" /> Mark
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Mark Attendance - {driver.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Reason (Optional)</Label>
                                  <Textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g., On duty, Break, etc."
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => markAttendanceMutation.mutate(driver._id)}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" /> Mark Present
                                  </Button>
                                  <Button
                                    onClick={() => markAbsentMutation.mutate(driver._id)}
                                    variant="destructive"
                                    className="flex-1"
                                  >
                                    Mark Absent
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
