import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, AlertCircle, RefreshCw, Users, DollarSign, Zap, Calendar, Target } from "lucide-react";

interface TenantDashboardStats {
  periodDays: number;
  metrics: {
    bookings: number;
    revenue: number;
    customers: number;
    drivers: number;
    vehicles: number;
    bookingCompletionRate: number;
    avgRevenuePerBooking: number;
    customerRetention: number;
  };
  performanceKpis: {
    bookingsThisMonth: number;
    revenueThisMonth: number;
    bookingsLastMonth: number;
    revenueLastMonth: number;
    growthRate: number;
  };
  recentBookings: Array<{
    _id: string;
    bookingId: string;
    pickupLocation: string;
    dropoffLocation: string;
    status: string;
    totalAmount: number;
    customerName: string;
    createdAt: string;
    completedAt?: string;
  }>;
  topCustomers: Array<{
    _id: string;
    name: string;
    primaryMobile?: string;
    totalBookings: number;
    totalSpent: number;
    lastBookingDate?: string;
    status: string;
  }>;
  bookingTrend: Array<{
    date: string;
    completed: number;
    pending: number;
  }>;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
  }>;
  customerSegments: Array<{
    segment: string;
    count: number;
  }>;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  payment_pending: "#f59e0b",
  cancelled: "#ef4444",
  confirmed: "#3b82f6",
  upcoming: "#8b5cf6",
};

export default function TenantDashboard360() {
  const { data, isLoading, error, refetch } = useQuery<TenantDashboardStats>({
    queryKey: ["/api/tenant/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Failed to load tenant dashboard</span>
          </div>
          <p className="text-sm mb-3">{(error as Error)?.message || "Unknown error"}</p>
          <Button size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  const growthTrend = data.performanceKpis.growthRate >= 0 ? "up" : "down";
  const growthColor = growthTrend === "up" ? "text-green-600" : "text-red-600";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="gradient-header bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">📊 Tenant Dashboard 360</h1>
            <p className="text-purple-100 mt-1">Your business performance at a glance</p>
          </div>
          <Button
            onClick={() => refetch()}
            className="bg-white text-purple-600 hover:bg-purple-50 font-semibold"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="stat-card card-hover bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">📅 BOOKINGS</p>
                <p className="text-2xl font-bold text-blue-600 mt-2">{data.metrics.bookings.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Total bookings</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-300 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card card-hover bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">💰 REVENUE</p>
                <p className="text-2xl font-bold text-green-600 mt-2">₹{(data.metrics.revenue / 100000).toFixed(1)}L</p>
                <p className="text-xs text-gray-500 mt-1">Total revenue</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-300 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card card-hover bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">👥 CUSTOMERS</p>
                <p className="text-2xl font-bold text-purple-600 mt-2">{data.metrics.customers.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Active customers</p>
              </div>
              <Users className="w-8 h-8 text-purple-300 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card card-hover bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">🚗 DRIVERS</p>
                <p className="text-2xl font-bold text-amber-600 mt-2">{data.metrics.drivers}</p>
                <p className="text-xs text-gray-500 mt-1">Total drivers</p>
              </div>
              <Zap className="w-8 h-8 text-amber-300 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card card-hover bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">🚙 VEHICLES</p>
                <p className="text-2xl font-bold text-red-600 mt-2">{data.metrics.vehicles}</p>
                <p className="text-xs text-gray-500 mt-1">Total vehicles</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-300 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">Completion Rate</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-blue-600">{data.metrics.bookingCompletionRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Percentage of completed bookings</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <CardTitle className="text-lg">Avg Revenue/Booking</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-green-600">₹{(data.metrics.avgRevenuePerBooking / 1000).toFixed(1)}K</p>
              <p className="text-sm text-gray-600">Average per booking</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg">Customer Retention</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-purple-600">{data.metrics.customerRetention.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Repeat customer rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">This Month</p>
              <p className="text-2xl font-bold text-blue-600 mb-1">₹{(data.performanceKpis.revenueThisMonth / 100000).toFixed(1)}L</p>
              <p className="text-xs text-gray-500">{data.performanceKpis.bookingsThisMonth} bookings</p>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-2">Last Month</p>
              <p className="text-2xl font-bold text-gray-600 mb-1">₹{(data.performanceKpis.revenueLastMonth / 100000).toFixed(1)}L</p>
              <p className="text-xs text-gray-500">{data.performanceKpis.bookingsLastMonth} bookings</p>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-2">Growth Rate</p>
              <p className={`text-2xl font-bold ${growthColor}`}>{Math.abs(data.performanceKpis.growthRate).toFixed(1)}% {growthTrend === "up" ? "📈" : "📉"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => `₹${(value / 100000).toFixed(1)}L`} />
                <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Booking Trends (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.bookingTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Customer Segments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Segments</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.customerSegments}
                  dataKey="count"
                  nameKey="segment"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {data.customerSegments.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentBookings.map((booking) => (
                  <TableRow key={booking._id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{booking.bookingId}</TableCell>
                    <TableCell>{booking.customerName}</TableCell>
                    <TableCell className="text-sm">
                      {booking.pickupLocation} → {booking.dropoffLocation || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          color: STATUS_COLORS[booking.status] || '#666',
                          borderColor: STATUS_COLORS[booking.status] || '#ccc'
                        }}
                      >
                        {booking.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">₹{(booking.totalAmount / 1000).toFixed(1)}K</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {data.recentBookings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-6">
                      No bookings found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Booking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topCustomers.map((customer) => (
                  <TableRow key={customer._id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-right">{customer.totalBookings}</TableCell>
                    <TableCell className="text-right font-medium">₹{(customer.totalSpent / 100000).toFixed(1)}L</TableCell>
                    <TableCell>
                      <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {customer.lastBookingDate ? new Date(customer.lastBookingDate).toLocaleDateString() : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
                {data.topCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                      No customers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
