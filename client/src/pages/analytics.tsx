import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { TrendingUp, Calendar, Download, RefreshCw } from "lucide-react";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

// Mock data - replace with actual API calls
const mockRevenueData = [
  { month: "Jan", revenue: 45000, bookings: 120 },
  { month: "Feb", revenue: 52000, bookings: 135 },
  { month: "Mar", revenue: 48000, bookings: 128 },
  { month: "Apr", revenue: 61000, bookings: 155 },
  { month: "May", revenue: 55000, bookings: 142 },
  { month: "Jun", revenue: 67000, bookings: 168 },
];

const mockBookingTrends = [
  { date: "Jun 1", completed: 8, cancelled: 1, pending: 2 },
  { date: "Jun 5", completed: 12, cancelled: 1, pending: 3 },
  { date: "Jun 10", completed: 15, cancelled: 2, pending: 2 },
  { date: "Jun 15", completed: 18, cancelled: 1, pending: 4 },
  { date: "Jun 20", completed: 14, cancelled: 2, pending: 3 },
  { date: "Jun 25", completed: 16, cancelled: 1, pending: 2 },
  { date: "Jun 30", completed: 20, cancelled: 1, pending: 3 },
];

const mockVehicleUtilization = [
  { name: "High (80-100%)", value: 35, color: "#10b981" },
  { name: "Medium (50-80%)", value: 45, color: "#f59e0b" },
  { name: "Low (20-50%)", value: 15, color: "#ef4444" },
  { name: "Idle (<20%)", value: 5, color: "#9ca3af" },
];

const mockCustomerMetrics = [
  { name: "Total Customers", value: 1240, growth: 12.5 },
  { name: "Active Monthly", value: 856, growth: 8.3 },
  { name: "Repeat Customers", value: 542, growth: 15.2 },
  { name: "New Customers", value: 284, growth: -2.1 },
];

const mockDriverPerformance = [
  { driver: "Raj Kumar", rating: 4.8, trips: 124, revenue: 45000 },
  { driver: "Priya Singh", rating: 4.7, trips: 118, revenue: 42000 },
  { driver: "Amit Patel", rating: 4.6, trips: 112, revenue: 39000 },
  { driver: "Sneha Sharma", rating: 4.9, trips: 128, revenue: 48000 },
  { driver: "Vikas Gupta", rating: 4.5, trips: 105, revenue: 35000 },
];

export default function AnalyticsPage() {
  const { isLoading } = useQuery({ queryKey: ["/api/analytics/overview"] });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">📊 Analytics & Reports</h1>
            <p className="text-emerald-100 mt-1">Performance metrics, trends & insights</p>
          </div>
          <div className="flex gap-2">
            <Button className="bg-white text-emerald-600 hover:bg-emerald-50" size="sm">
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <Button className="bg-white text-emerald-600 hover:bg-emerald-50" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {mockCustomerMetrics.map((metric, idx) => (
          <Card key={idx} className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">{metric.name}</p>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-2xl font-bold text-blue-600">{metric.value.toLocaleString()}</p>
                <span className={`text-sm font-semibold ${metric.growth >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {metric.growth >= 0 ? "↑" : "↓"} {Math.abs(metric.growth)}%
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="revenue">Revenue & Bookings</TabsTrigger>
          <TabsTrigger value="bookings">Booking Trends</TabsTrigger>
          <TabsTrigger value="utilization">Vehicle Utilization</TabsTrigger>
        </TabsList>

        {/* Revenue Chart */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue & Booking Volume</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Monthly trend analysis (Last 6 months)</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mockRevenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Trends */}
        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Booking Status Trends</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Completed, cancelled, and pending bookings</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockBookingTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="cancelled" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pending" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vehicle Utilization */}
        <TabsContent value="utilization">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vehicle Utilization Rate</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Fleet usage efficiency breakdown</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mockVehicleUtilization}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {mockVehicleUtilization.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {mockVehicleUtilization.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.name}</span>
                        <Badge style={{ backgroundColor: item.color }}>{item.value}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Driver Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Driver Performance</CardTitle>
          <p className="text-sm text-gray-600 mt-1">Rating, trips & revenue by driver</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b-2 border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Driver Name</th>
                  <th className="text-center py-3 px-4 font-semibold">Rating</th>
                  <th className="text-center py-3 px-4 font-semibold">Trips</th>
                  <th className="text-right py-3 px-4 font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {mockDriverPerformance.map((driver, idx) => (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition">
                    <td className="py-3 px-4 font-medium">{driver.driver}</td>
                    <td className="text-center py-3 px-4">
                      <Badge className="bg-yellow-100 text-yellow-900">
                        ⭐ {driver.rating}
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-4">{driver.trips}</td>
                    <td className="text-right py-3 px-4 font-semibold">₹{driver.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card className="bg-emerald-50 border-emerald-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-900">Export Report</p>
                <p className="text-sm text-emerald-700">Download your analytics as PDF or Excel</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">PDF</Button>
              <Button variant="outline" size="sm">Excel</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
