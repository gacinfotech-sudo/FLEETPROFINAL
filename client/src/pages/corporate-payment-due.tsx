import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";

export default function CorporatePaymentDuePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split("T")[0].slice(0, 7));
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  const { data: corporateClients = [] } = useQuery({
    queryKey: ["/api/corporate-clients"],
    refetchInterval: 15000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["/api/corporate-invoices", selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/corporate-invoices?month=${selectedMonth}`, { credentials: "include" });
      if (!res.ok) return [];
      const invoices = await res.json();

      // Fetch Vehicle 360 details for vehicles in invoices
      const invoicesWithDetails = await Promise.all(
        invoices.map(async (inv: any) => {
          try {
            if (inv.vehicleIds && inv.vehicleIds.length > 0) {
              const vehicleDetails = await Promise.all(
                inv.vehicleIds.map(async (vid: string) => {
                  try {
                    const vehicleRes = await fetch(`/api/vehicles/${vid}/360`, { credentials: "include" });
                    if (!vehicleRes.ok) return null;
                    const vehicle = await vehicleRes.json();

                    // Fetch Driver 360 details if driver exists
                    let driverDetails = vehicle.assignedDriver;
                    if (vehicle.assignedDriver && vehicle.assignedDriver._id) {
                      try {
                        const driverRes = await fetch(`/api/drivers/${vehicle.assignedDriver._id}/360`, { credentials: "include" });
                        if (driverRes.ok) {
                          const driver360 = await driverRes.json();
                          driverDetails = {
                            ...vehicle.assignedDriver,
                            ...driver360,
                            completedTrips: driver360.tripMetrics?.completedTrips || 0,
                            avgRating: driver360.performanceMetrics?.avgRating || 0,
                            onTimePercentage: driver360.performanceMetrics?.onTimePercentage || 0,
                            safetyScore: driver360.performanceMetrics?.safetyScore || 0,
                          };
                        }
                      } catch (e) {
                        console.error(`Failed to fetch Driver 360:`, e);
                      }
                    }

                    return { ...vehicle, assignedDriver: driverDetails };
                  } catch (e) {
                    return null;
                  }
                })
              );
              return {
                ...inv,
                vehicleDetails: vehicleDetails.filter(Boolean),
              };
            }
          } catch (e) {
            console.error(`Failed to fetch vehicle details for invoice ${inv._id}:`, e);
          }
          return inv;
        })
      );

      return invoicesWithDetails;
    },
    refetchInterval: 15000,
  });

  const { data: pendingPayments = [] } = useQuery({
    queryKey: ["/api/corporate-payments-due"],
    refetchInterval: 15000,
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (clientId: string) => {
      return (await apiRequest("POST", `/api/corporate-clients/${clientId}/generate-invoice`, { month: selectedMonth })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/corporate-invoices", selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ["/api/corporate-payments-due"] });
      toast({ title: "Success", description: "Invoice generated" });
      setShowInvoiceForm(false);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return (await apiRequest("POST", `/api/corporate-invoices/${invoiceId}/mark-paid`, {})).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/corporate-invoices", selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ["/api/corporate-payments-due"] });
      toast({ title: "Success", description: "Payment recorded" });
    },
  });

  const totalDue = pendingPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalCollected = invoices.filter((inv: any) => inv.status === "paid").reduce((sum: number, inv: any) => sum + (inv.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="gradient-header bg-gradient-to-r from-red-600 to-orange-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">💰 Corporate Payments Due</h1>
            <p className="text-red-100 mt-1">Track monthly invoices and collections from corporate clients</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total Due This Month</p>
            <p className="text-3xl font-bold text-red-600">₹{totalDue.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Collected This Month</p>
            <p className="text-3xl font-bold text-green-600">₹{totalCollected.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Pending Invoices</p>
            <p className="text-3xl font-bold text-orange-600">{invoices.filter((inv: any) => inv.status === "pending").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Active Clients</p>
            <p className="text-3xl font-bold text-blue-600">{corporateClients.filter((c: any) => c.status === "active").length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Monthly Invoices</TabsTrigger>
          <TabsTrigger value="pending">Pending Payments</TabsTrigger>
          <TabsTrigger value="statement">Monthly Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Monthly Invoices</CardTitle>
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-40 mt-2"
                  />
                </div>
                <Dialog open={showInvoiceForm} onOpenChange={setShowInvoiceForm}>
                  <DialogTrigger asChild>
                    <Button className="bg-red-600 hover:bg-red-700">
                      <Plus className="w-4 h-4 mr-2" /> Generate Invoice
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Generate Monthly Invoice</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">Select corporate client to generate invoice for {selectedMonth}</p>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {corporateClients.filter((c: any) => c.status === "active").map((client: any) => (
                          <Button
                            key={client._id}
                            onClick={() => generateInvoiceMutation.mutate(client._id)}
                            variant="outline"
                            className="w-full justify-start"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            {client.companyName}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No invoices for {selectedMonth}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell>Company</TableCell>
                        <TableCell>Invoice Amount</TableCell>
                        <TableCell>Vehicles</TableCell>
                        <TableCell>Period</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice: any) => (
                        <TableRow key={invoice._id}>
                          <TableCell className="font-medium">{invoice.companyName}</TableCell>
                          <TableCell className="font-bold">₹{invoice.totalAmount?.toLocaleString("en-IN")}</TableCell>
                          <TableCell>{invoice.vehicleCount || 0}</TableCell>
                          <TableCell>{selectedMonth}</TableCell>
                          <TableCell>
                            <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {invoice.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => recordPaymentMutation.mutate(invoice._id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" /> Mark Paid
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingPayments.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No pending payments</p>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.map((payment: any) => (
                    <div key={payment._id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{payment.companyName}</p>
                        <p className="text-sm text-gray-600">Due: {new Date(payment.dueDate).toLocaleDateString("en-IN")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">₹{payment.amount?.toLocaleString("en-IN")}</p>
                        <Badge variant="destructive">Overdue</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statement">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Statement Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Invoiced</p>
                    <p className="text-2xl font-bold text-blue-600">₹{(totalDue + totalCollected).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Collection Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {((totalCollected / (totalDue + totalCollected)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
