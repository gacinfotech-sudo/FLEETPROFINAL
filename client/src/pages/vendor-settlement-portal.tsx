import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { Calendar, Download, AlertCircle, CheckCircle, Clock } from "lucide-react";

export default function VendorSettlementPortal() {
  const [activeTab, setActiveTab] = useState("overview");
  const [settlementMonth, setSettlementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settlementData, isLoading } = useQuery({
    queryKey: ["/api/vendors/settlement", settlementMonth],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/vendors/settlement?month=${settlementMonth}`);
      return response.json();
    },
  });

  const { data: vendorDetails } = useQuery({
    queryKey: ["/api/vendors/settlement", selectedVendor],
    queryFn: async () => {
      if (!selectedVendor) return null;
      const response = await apiRequest("GET", `/api/vendors/settlement/${selectedVendor}`);
      return response.json();
    },
    enabled: !!selectedVendor,
  });

  const initiatePaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiRequest("POST", `/api/vendors/settlement/initiate-payment`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/settlement"] });
      toast({ title: "Payment initiated successfully" });
      setShowPaymentForm(false);
      setPaymentAmount("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      const response = await apiRequest("POST", `/api/vendors/settlement/generate-invoice`, { vendorId, month: settlementMonth });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice generated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const vendors = settlementData?.vendors || [];
  const summary = settlementData?.summary || {};
  const settlementTrend = settlementData?.settlementTrend || [];
  const paymentMetrics = settlementData?.paymentMetrics || [];

  const settlementStatusColors = {
    completed: "#10b981",
    pending: "#f59e0b",
    overdue: "#ef4444",
    cancelled: "#6b7280",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50 dark:from-slate-900 dark:via-emerald-900 dark:to-cyan-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-cyan-400">
            🏢 Vendor Settlement Portal
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Payment reconciliation, invoicing, and settlement management
          </p>
        </div>

        {/* Month Selector */}
        <div className="mb-6 flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">📅 Settlement Period</label>
            <input
              type="month"
              value={settlementMonth}
              onChange={(e) => setSettlementMonth(e.target.value)}
              className="mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>
          <Button className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600">
            📊 Export Settlements
          </Button>
          <Button variant="outline">
            📅 Settlement Calendar
          </Button>
        </div>

        {/* Summary Cards */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Vendors</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{vendors.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 border-green-200 dark:border-green-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Outstanding</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                  ₹{(summary.totalOutstanding / 100000).toFixed(1)}L
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pending payment</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Avg Settlement</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                  ₹{(summary.avgPerVendor || 0).toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Per vendor</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 border-amber-200 dark:border-amber-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Settled This Month</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                  ₹{(summary.settledThisMonth / 100000).toFixed(1)}L
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Already paid</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 border-red-200 dark:border-red-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Overdue</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">{summary.overdueCount || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Vendors awaiting payment</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">📈 Overview</TabsTrigger>
            <TabsTrigger value="vendors">🏢 Vendors</TabsTrigger>
            <TabsTrigger value="invoices">📄 Invoices</TabsTrigger>
            <TabsTrigger value="calendar">📅 Calendar</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📊 Settlement Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {settlementTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={settlementTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => `₹${value.toLocaleString("en-IN")}`} />
                        <Legend />
                        <Line type="monotone" dataKey="outstanding" stroke="#ef4444" strokeWidth={2} />
                        <Line type="monotone" dataKey="settled" stroke="#10b981" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No settlement data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">💳 Payment Methods Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={paymentMetrics} cx="50%" cy="50%" labelLine={false} label={(entry) => entry.method} outerRadius={80} fill="#8884d8" dataKey="value">
                          {paymentMetrics.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={["#3b82f6", "#10b981", "#f59e0b", "#ef4444"][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `₹${value.toLocaleString("en-IN")}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No payment data</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Vendors Tab */}
          <TabsContent value="vendors">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vendor Settlement Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell>Vendor</TableCell>
                        <TableCell>Services</TableCell>
                        <TableCell>Outstanding</TableCell>
                        <TableCell>Settled</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendors.map((vendor: any) => (
                        <TableRow key={vendor.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <TableCell>
                            <button
                              onClick={() => setSelectedVendor(vendor.id)}
                              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              {vendor.name}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {vendor.serviceCount} services
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-red-600 dark:text-red-400">
                            ₹{vendor.outstanding?.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-green-600 dark:text-green-400">
                            ₹{vendor.settled?.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${
                                vendor.status === "settled"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                  : vendor.status === "overdue"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                  : vendor.status === "pending"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300"
                              }`}
                            >
                              {vendor.status === "settled" ? "✅" : vendor.status === "overdue" ? "🔴" : vendor.status === "pending" ? "⏳" : "❓"}{" "}
                              {vendor.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedVendor(vendor.id);
                                setShowPaymentForm(true);
                              }}
                              disabled={vendor.outstanding === 0}
                              className="text-xs"
                            >
                              💳 Pay
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

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📄 Settlement Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vendors.length > 0 ? (
                    vendors.map((vendor: any) => (
                      <div key={vendor.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{vendor.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Outstanding: <span className="font-bold text-red-600 dark:text-red-400">₹{vendor.outstanding?.toLocaleString("en-IN")}</span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Invoice Period: {settlementMonth}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateInvoiceMutation.mutate(vendor.id)}
                            disabled={generateInvoiceMutation.isPending}
                            className="text-xs"
                          >
                            📄 Generate
                          </Button>
                          <Button size="sm" className="text-xs bg-emerald-500 hover:bg-emerald-600">
                            <Download className="w-3 h-3 mr-1" /> Download
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-gray-500">No invoices available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📅 Settlement Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-50 dark:from-green-900/20 dark:to-green-800/10 rounded-lg border border-green-200 dark:border-green-700">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-1" />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">Settlement Completed</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {summary.completedCount || 0} vendors settled • ₹{(summary.settledThisMonth || 0).toLocaleString("en-IN")}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Next settlement: 05-{new Date().getMonth() + 1 === 12 ? 1 : new Date().getMonth() + 2}-{new Date().getFullYear()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-50 dark:from-amber-900/20 dark:to-amber-800/10 rounded-lg border border-amber-200 dark:border-amber-700">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-1" />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">Pending Settlements</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {summary.pendingCount || 0} vendors awaiting • ₹{(summary.totalOutstanding || 0).toLocaleString("en-IN")}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Auto-settle: Enabled</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-red-50 to-red-50 dark:from-red-900/20 dark:to-red-800/10 rounded-lg border border-red-200 dark:border-red-700">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-1" />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">Overdue Settlements</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {summary.overdueCount || 0} vendors overdue • Requires immediate action
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Escalation: Email sent to all</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Automated Settlement Config</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Settlement Frequency</label>
                        <Select defaultValue="monthly">
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Bi-weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Settlement Day</label>
                        <Input type="number" min="1" max="31" defaultValue="5" className="mt-1" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-Payment Method</label>
                        <Select defaultValue="upi">
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="neft">NEFT</SelectItem>
                            <SelectItem value="rtgs">RTGS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                        💾 Save Settings
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Payment Form Modal */}
        {showPaymentForm && selectedVendor && (
          <Card className="mt-8 border-2 border-emerald-200 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">💳 Initiate Payment</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setShowPaymentForm(false)}>
                  ✕ Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Vendor</label>
                  <p className="mt-2 p-3 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                    {vendors.find((v: any) => v.id === selectedVendor)?.name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Outstanding Amount</label>
                  <p className="mt-2 p-3 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-gray-700 text-red-600 dark:text-red-400 font-bold text-lg">
                    ₹{vendors.find((v: any) => v.id === selectedVendor)?.outstanding?.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Payment Amount</label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Payment Method</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="neft">NEFT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Remarks (Optional)</label>
                <Input placeholder="Payment reference or notes" className="mt-2" />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowPaymentForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    initiatePaymentMutation.mutate({
                      vendorId: selectedVendor,
                      amount: parseFloat(paymentAmount),
                      method: paymentMethod,
                      month: settlementMonth,
                    })
                  }
                  disabled={!paymentAmount || initiatePaymentMutation.isPending}
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
                >
                  {initiatePaymentMutation.isPending ? "Processing..." : "💳 Confirm Payment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
