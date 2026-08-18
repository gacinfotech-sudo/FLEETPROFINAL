import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Clock, Zap, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface BookingStatus {
  id: string;
  bookingId: string;
  status: "created" | "assigned" | "confirmed" | "in_progress" | "completed" | "payment_pending" | "paid" | "cancelled";
  customerName: string;
  pickupLocation: string;
  dropoffLocation: string;
  createdAt: string;
  estimatedPickupTime: string;
  assignedVehicle?: string;
  assignedDriver?: string;
  totalAmount?: number;
  progress: number;
  nextAction?: string;
  urgency: "critical" | "high" | "medium" | "low";
}

interface BookingStatusDashboardProps {
  bookings?: BookingStatus[];
  onTakeAction?: (bookingId: string, action: string) => void;
}

const STATUS_DETAILS: Record<string, { icon: any; color: string; label: string }> = {
  created: {
    icon: <Zap className="h-5 w-5" />,
    color: "bg-blue-50 border-blue-200",
    label: "Created",
  },
  assigned: {
    icon: <AlertCircle className="h-5 w-5" />,
    color: "bg-yellow-50 border-yellow-200",
    label: "Assigned",
  },
  confirmed: {
    icon: <Clock className="h-5 w-5" />,
    color: "bg-purple-50 border-purple-200",
    label: "Confirmed",
  },
  in_progress: {
    icon: <TrendingUp className="h-5 w-5" />,
    color: "bg-green-50 border-green-200",
    label: "In Progress",
  },
  completed: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: "bg-emerald-50 border-emerald-200",
    label: "Completed",
  },
  payment_pending: {
    icon: <AlertTriangle className="h-5 w-5" />,
    color: "bg-orange-50 border-orange-200",
    label: "Payment Pending",
  },
  paid: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: "bg-green-50 border-green-200",
    label: "Paid",
  },
  cancelled: {
    icon: <AlertCircle className="h-5 w-5" />,
    color: "bg-red-50 border-red-200",
    label: "Cancelled",
  },
};

const URGENCY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-gray-100 text-gray-800 border-gray-300",
};

const NEXT_ACTIONS: Record<string, string> = {
  created: "Assign Vehicle",
  assigned: "Confirm Booking",
  confirmed: "Start Trip",
  in_progress: "Complete Trip",
  completed: "Collect Payment",
  payment_pending: "Collect Payment",
  paid: "Close Booking",
};

export default function BookingStatusDashboard({
  bookings = [],
  onTakeAction,
}: BookingStatusDashboardProps) {
  const [sortBy, setSortBy] = useState<"urgency" | "created" | "status">("urgency");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Sort bookings
  const sortedBookings = [...bookings]
    .filter((b) => !filterStatus || b.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === "urgency") {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      } else if (sortBy === "created") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        const statusOrder = {
          created: 0,
          assigned: 1,
          confirmed: 2,
          in_progress: 3,
          completed: 4,
          payment_pending: 5,
          paid: 6,
          cancelled: 7,
        };
        return statusOrder[a.status as keyof typeof statusOrder] -
          statusOrder[b.status as keyof typeof statusOrder];
      }
    });

  // Calculate stats
  const stats = {
    total: bookings.length,
    critical: bookings.filter((b) => b.urgency === "critical").length,
    inProgress: bookings.filter((b) => b.status === "in_progress").length,
    completedToday: bookings.filter((b) => b.status === "completed").length,
    pendingPayment: bookings.filter((b) => b.status === "payment_pending").length,
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Active</p>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">bookings</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">🚨 Critical</p>
              <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
              <p className="text-xs text-gray-500 mt-1">need action</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-3xl font-bold text-green-600">{stats.inProgress}</p>
              <p className="text-xs text-gray-500 mt-1">active trips</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-purple-600">{stats.completedToday}</p>
              <p className="text-xs text-gray-500 mt-1">today</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">💰 Payment Pending</p>
              <p className="text-3xl font-bold text-orange-600">{stats.pendingPayment}</p>
              <p className="text-xs text-gray-500 mt-1">awaiting</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-2">
          <Button
            variant={sortBy === "urgency" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("urgency")}
          >
            Sort by Urgency
          </Button>
          <Button
            variant={sortBy === "created" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("created")}
          >
            Sort by Date
          </Button>
          <Button
            variant={sortBy === "status" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("status")}
          >
            Sort by Status
          </Button>
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant={!filterStatus ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(null)}
          >
            All ({bookings.length})
          </Button>
          <Button
            variant={filterStatus === "in_progress" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus("in_progress")}
          >
            Active ({stats.inProgress})
          </Button>
          <Button
            variant={filterStatus === "payment_pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus("payment_pending")}
          >
            Payment ({stats.pendingPayment})
          </Button>
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-3">
        {sortedBookings.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <p className="text-gray-600">No bookings to display</p>
            </CardContent>
          </Card>
        ) : (
          sortedBookings.map((booking) => {
            const statusDetail = STATUS_DETAILS[booking.status];

            return (
              <Card key={booking.id} className={`border-2 ${statusDetail.color}`}>
                <CardContent className="pt-6">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="text-2xl mt-1">{statusDetail.icon}</div>
                      <div>
                        <p className="font-semibold text-gray-900">{booking.bookingId}</p>
                        <p className="text-sm text-gray-600">{booking.customerName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={URGENCY_COLORS[booking.urgency]}>
                        {booking.urgency.charAt(0).toUpperCase() + booking.urgency.slice(1)}
                      </Badge>
                      <Badge variant="outline">{statusDetail.label}</Badge>
                    </div>
                  </div>

                  {/* Route Info */}
                  <div className="mb-4 p-3 bg-white rounded border">
                    <p className="text-sm text-gray-600">
                      📍 {booking.pickupLocation} <span className="text-gray-400">→</span>{" "}
                      {booking.dropoffLocation}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Pickup: {new Date(booking.estimatedPickupTime).toLocaleTimeString()}
                    </p>
                  </div>

                  {/* Vehicle & Driver Info */}
                  {booking.assignedVehicle && (
                    <div className="mb-4 p-3 bg-white rounded border text-sm">
                      <p className="text-gray-600">
                        🚗 {booking.assignedVehicle}
                        {booking.assignedDriver && ` • 👨‍✈️ ${booking.assignedDriver}`}
                      </p>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">{booking.progress}%</span>
                    </div>
                    <Progress value={booking.progress} className="h-2" />
                  </div>

                  {/* Amount Info */}
                  {booking.totalAmount && (
                    <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm">
                        <span className="text-gray-600">Total Amount:</span>{" "}
                        <span className="font-bold text-lg text-blue-600">
                          ₹{booking.totalAmount}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {booking.nextAction && (
                      <Button
                        onClick={() =>
                          onTakeAction?.(booking.bookingId, booking.nextAction!)
                        }
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        ✓ {booking.nextAction}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
