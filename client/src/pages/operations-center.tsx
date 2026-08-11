import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from "recharts";
import { Activity, MapPin, TrendingUp, AlertTriangle, Users, Navigation, Zap } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function OperationsCenter() {
  const [activeTab, setActiveTab] = useState("live");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const { data: opsData, isLoading, refetch } = useQuery({
    queryKey: ["/api/operations/center"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/operations/center`);
      return response.json();
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const liveStats = opsData?.stats || {};
  const activeBookings = opsData?.activeBookings || [];
  const activeDrivers = opsData?.activeDrivers || [];
  const revenueStream = opsData?.revenueStream || [];
  const performanceMetrics = opsData?.performanceMetrics || [];
  const alerts = opsData?.alerts || [];
  const heatmap = opsData?.heatmap || [];

  const getStatusColor = (status: string) => {
    if (status === "completed") return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    if (status === "in_progress") return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
    if (status === "delayed") return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300";
    return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300";
  };

  const getAlertColor = (severity: string) => {
    if (severity === "critical") return "border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20";
    if (severity === "high") return "border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20";
    if (severity === "medium") return "border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
    return "border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-50 dark:from-slate-900 dark:via-indigo-900 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-blue-400">
              🎛️ Real-Time Operations Center
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Live command center view • All systems monitored • Real-time decisions
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="text-xs"
            >
              {autoRefresh ? "🔄 Auto" : "⏸ Manual"}
            </Button>
            <Button size="sm" onClick={() => refetch()} className="text-xs">
              🔄 Refresh
            </Button>
          </div>
        </div>

        {/* Live Stats */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">🚗 Active Rides</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{liveStats.activeRides || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Live on platform</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 border-green-200 dark:border-green-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">👥 Online Drivers</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{liveStats.onlineDrivers || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ready for dispatch</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">💰 Live Revenue</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                  ₹{(liveStats.liveRevenue / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This hour</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 border-amber-200 dark:border-amber-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">⭐ Avg Rating</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">{liveStats.avgRating || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Platform average</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 border-red-200 dark:border-red-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">🚨 Active Alerts</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{alerts.length || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Need attention</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="live">🔴 Live Feeds</TabsTrigger>
            <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
            <TabsTrigger value="drivers">👥 Drivers</TabsTrigger>
            <TabsTrigger value="alerts">🚨 Alerts</TabsTrigger>
          </TabsList>

          {/* Live Feeds Tab */}
          <TabsContent value="live" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Bookings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🚗 Active Bookings (Live)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {activeBookings.length > 0 ? (
                      activeBookings.map((booking: any) => (
                        <div key={booking.id} className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white text-sm">#{booking.bookingId}</span>
                                <Badge className={`text-xs ${getStatusColor(booking.status)}`}>
                                  {booking.status === "in_progress" ? "🚗 Active" : booking.status === "completed" ? "✅ Done" : "⏳ Pending"}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                📍 {booking.pickupLocation} → {booking.dropoffLocation}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                👤 {booking.customerName} • 💰 ₹{booking.amount}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                ETA: {booking.eta} • Distance: {booking.distance}km
                              </p>
                            </div>
                            <span className="text-2xl ml-2">{booking.status === "in_progress" ? "🟢" : "🟡"}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-gray-500">No active bookings</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Revenue Stream */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">💰 Revenue Stream (Live)</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueStream.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={revenueStream}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No data</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📈 Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  {performanceMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={performanceMetrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="avgRating" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="completionRate" stroke="#3b82f6" strokeWidth={2} />
                        <Line type="monotone" dataKey="customerSatisfaction" stroke="#f59e0b" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No data</p>
                  )}
                </CardContent>
              </Card>

              {/* Heatmap Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🗺️ Geographic Heatmap</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {heatmap.length > 0 ? (
                      heatmap.map((zone: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800/50 rounded">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{zone.area}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  zone.density > 80
                                    ? "bg-red-500"
                                    : zone.density > 60
                                    ? "bg-orange-500"
                                    : zone.density > 40
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                }`}
                                style={{ width: `${zone.density}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold w-8">{zone.density}%</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-gray-500">No data</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">👥 Online Drivers (Real-Time)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {activeDrivers.length > 0 ? (
                    activeDrivers.map((driver: any) => (
                      <div
                        key={driver.id}
                        onClick={() => setSelectedDriver(driver.id)}
                        className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700 cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{driver.name}</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400">🆔 {driver.driverId}</p>
                          </div>
                          <span className={`text-2xl ${driver.status === "available" ? "🟢" : driver.status === "on_trip" ? "🔵" : "🟡"}`}></span>
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            📍 {driver.currentArea}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            ⭐ {driver.rating}/5 • 🚗 {driver.totalTrips} trips
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            📱 {driver.status === "available" ? "Available" : driver.status === "on_trip" ? "On Trip" : "Break"}
                          </p>
                          {driver.status === "on_trip" && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1">
                              💰 ₹{driver.earnings24h} earnings
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-gray-500">No drivers online</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🚨 Live Alert Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {alerts.length > 0 ? (
                    alerts.map((alert: any) => (
                      <div key={alert.id} className={`p-4 rounded-lg ${getAlertColor(alert.severity)}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white">{alert.title}</h3>
                              <Badge className={`text-xs font-bold ${
                                alert.severity === "critical" ? "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300" :
                                alert.severity === "high" ? "bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300" :
                                alert.severity === "medium" ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300" :
                                "bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                              }`}>
                                {alert.severity.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{alert.message}</p>
                            {alert.affectedEntities && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                Affected: {alert.affectedEntities}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <Button size="sm" className="ml-4 text-xs">
                            {alert.severity === "critical" ? "URGENT" : "Review"}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-gray-500">✅ No active alerts</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Driver Details */}
        {selectedDriver && (
          <Card className="mt-8 border-2 border-green-200 dark:border-green-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">🚗 Driver Live Tracking</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setSelectedDriver(null)}>
                  ✕ Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-slate-800 rounded border border-green-200 dark:border-green-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Status</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">Available</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded border border-green-200 dark:border-green-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Location</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Downtown</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded border border-green-200 dark:border-green-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Distance</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">2.3 km</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded border border-green-200 dark:border-green-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Rating</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">4.8/5</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">📍 Real-time Location</p>
                <div className="w-full h-40 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-700">
                  <p className="text-gray-600 dark:text-gray-400">Live map (map integration)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
