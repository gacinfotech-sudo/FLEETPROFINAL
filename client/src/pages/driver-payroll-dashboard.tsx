import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";

export default function DriverPayrollDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [payoutMonth, setPayoutMonth] = useState(new Date().toISOString().slice(0, 7));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payrollData, isLoading } = useQuery({
    queryKey: ["/api/payroll/summary", payoutMonth],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/payroll/summary?month=${payoutMonth}`);
      return response.json();
    },
  });

  const { data: driverDetails } = useQuery({
    queryKey: ["/api/payroll/driver", selectedDriver],
    queryFn: async () => {
      if (!selectedDriver) return null;
      const response = await apiRequest("GET", `/api/payroll/driver/${selectedDriver}`);
      return response.json();
    },
    enabled: !!selectedDriver,
  });

  const initiatePayoutMutation = useMutation({
    mutationFn: async (driverId: string) => {
      const response = await apiRequest("POST", `/api/payroll/initiate-payout`, {
        driverId,
        month: payoutMonth,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary"] });
      toast({ title: "Payout initiated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const earningsTrend = payrollData?.earningsTrend || [];
  const drivers = payrollData?.drivers || [];
  const summary = payrollData?.summary || {};

  const commissionStructure = [
    { name: "Base Commission", value: 40, color: "#3b82f6" },
    { name: "Performance Bonus", value: 35, color: "#10b981" },
    { name: "Rating Incentive", value: 15, color: "#f59e0b" },
    { name: "Loyalty Rewards", value: 10, color: "#8b5cf6" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
            💰 Driver Payroll & Earnings
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Real-time earnings tracking, commission breakdown, and payout management
          </p>
        </div>

        {/* Month Selector */}
        <div className="mb-6 flex gap-3 items-end">
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">📅 Select Month</label>
            <input
              type="month"
              value={payoutMonth}
              onChange={(e) => setPayoutMonth(e.target.value)}
              className="mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>
          <Button className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600">
            📊 Export Report
          </Button>
        </div>

        {/* Summary Cards */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Drivers</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{drivers.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 border-green-200 dark:border-green-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Earnings</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                  ₹{(summary.totalEarnings / 100000).toFixed(1)}L
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This month</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Avg Per Driver</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                  ₹{(summary.avgPerDriver || 0).toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Monthly average</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 border-amber-200 dark:border-amber-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Pending Payouts</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">{summary.pendingPayouts || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Awaiting processing</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 border-red-200 dark:border-red-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Deductions</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                  ₹{(summary.totalDeductions || 0).toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Taxes & fees</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">📈 Overview</TabsTrigger>
            <TabsTrigger value="drivers">👥 Drivers</TabsTrigger>
            <TabsTrigger value="commissions">🎯 Commissions</TabsTrigger>
            <TabsTrigger value="payouts">💳 Payouts</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📊 Earnings Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {earningsTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={earningsTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => `₹${value.toLocaleString("en-IN")}`} />
                      <Legend />
                      <Line type="monotone" dataKey="earnings" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="bonus" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-8 text-gray-500">No earnings data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Driver Earnings Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell>Driver</TableCell>
                        <TableCell>Trips</TableCell>
                        <TableCell>Rating</TableCell>
                        <TableCell>Earnings</TableCell>
                        <TableCell>Bonus</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drivers.map((driver: any) => (
                        <TableRow key={driver.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <TableCell>
                            <button
                              onClick={() => setSelectedDriver(driver.id)}
                              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {driver.name}
                            </button>
                          </TableCell>
                          <TableCell>{driver.trips}</TableCell>
                          <TableCell>
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              ⭐ {driver.rating}/5
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">₹{driver.earnings?.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-green-600 dark:text-green-400 font-semibold">
                            +₹{driver.bonus?.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                driver.payoutStatus === "completed"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                  : driver.payoutStatus === "pending"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300"
                              }
                            >
                              {driver.payoutStatus === "completed" ? "✅ Paid" : "⏳ Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => initiatePayoutMutation.mutate(driver.id)}
                              disabled={driver.payoutStatus === "completed" || initiatePayoutMutation.isPending}
                              className="text-xs"
                            >
                              Payout
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">💰 Commission Structure</CardTitle>
                </CardHeader>
                <CardContent>
                  {commissionStructure.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={commissionStructure} cx="50%" cy="50%" labelLine={false} label={(entry) => entry.name} outerRadius={80} fill="#8884d8" dataKey="value">
                          {commissionStructure.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No commission data</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📋 Commission Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {commissionStructure.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">of total earnings</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{item.value}%</p>
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                          <div className="h-full" style={{ width: `${item.value}%`, backgroundColor: item.color }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💳 Payout History & Scheduling</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {drivers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {drivers.map((driver: any) => (
                        <div
                          key={driver.id}
                          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gradient-to-br from-gray-50 to-gray-50 dark:from-slate-800/50 dark:to-slate-800/30"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">{driver.name}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Earnings: <span className="font-bold text-green-600 dark:text-green-400">₹{driver.earnings?.toLocaleString("en-IN")}</span>
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Bonus: <span className="font-bold text-blue-600 dark:text-blue-400">₹{driver.bonus?.toLocaleString("en-IN")}</span>
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                Last Payout: {driver.lastPayoutDate || "Never"}
                              </p>
                            </div>
                            <Badge
                              className={
                                driver.payoutStatus === "completed"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                              }
                            >
                              {driver.payoutStatus === "completed" ? "✅ Paid" : "⏳ Pending"}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => initiatePayoutMutation.mutate(driver.id)}
                            disabled={driver.payoutStatus === "completed" || initiatePayoutMutation.isPending}
                            className="w-full mt-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-xs"
                          >
                            {initiatePayoutMutation.isPending ? "Processing..." : "💳 Process Payout"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No drivers available for payout</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Driver Details Modal-like View */}
        {selectedDriver && driverDetails && (
          <Card className="mt-8 border-2 border-blue-200 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">👤 {driverDetails.name} - Detailed Payroll</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setSelectedDriver(null)}>
                  ✕ Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Total Trips</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{driverDetails.totalTrips}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Base Earnings</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">₹{driverDetails.baseEarnings?.toLocaleString("en-IN")}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Bonuses</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">₹{driverDetails.bonuses?.toLocaleString("en-IN")}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Net After Tax</p>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">₹{driverDetails.netEarnings?.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
