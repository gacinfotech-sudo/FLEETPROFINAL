import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, CreditCard, TrendingUp } from "lucide-react";

export default function VendorPaymentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState<any>({
    paymentDate: new Date().toISOString().split("T")[0],
    amount: 0,
    paymentMode: "bank_transfer",
    referenceNumber: "",
    description: "",
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["/api/vendors"],
    refetchInterval: 15000,
  });

  const { data: payments = [] } = useQuery({
    queryKey: selectedVendor ? [`/api/vendors/${selectedVendor._id}/payments`] : [],
    refetchInterval: 15000,
  });

  const { data: balance = {} } = useQuery({
    queryKey: selectedVendor ? [`/api/vendors/${selectedVendor._id}/balance`] : [],
  });

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVendor) throw new Error("Select a vendor first");
      return (await apiRequest("POST", `/api/vendors/${selectedVendor._id}/payments`, paymentData)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/${selectedVendor._id}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/${selectedVendor._id}/balance`] });
      toast({ title: "Success", description: "Payment recorded" });
      setShowPaymentForm(false);
      setPaymentData({ paymentDate: new Date().toISOString().split("T")[0], amount: 0, paymentMode: "bank_transfer", referenceNumber: "", description: "" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const filteredVendors = vendors.filter((v: any) => v.status === "active").sort((a: any, b: any) => a.companyName.localeCompare(b.companyName));

  return (
    <div className="space-y-6">
      <div className="gradient-header bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">💳 Vendor Payments</h1>
            <p className="text-green-100 mt-1">Track and record vendor payments</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Vendors</p>
                <p className="text-3xl font-bold text-green-600">{filteredVendors.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Payments</p>
                <p className="text-3xl font-bold text-blue-600">{payments.length}</p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-gray-600">Outstanding Balance</p>
              <p className="text-3xl font-bold text-orange-600">₹{(balance.outstandingBalance || 0).toLocaleString("en-IN")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Select Vendor to View Payments</CardTitle>
            {selectedVendor && (
              <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" /> Record Payment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Payment - {selectedVendor.companyName}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Payment Date *</Label>
                      <Input type="date" value={paymentData.paymentDate} onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })} />
                    </div>
                    <div>
                      <Label>Amount (₹) *</Label>
                      <Input type="number" value={paymentData.amount} onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label>Payment Mode *</Label>
                      <select className="w-full border rounded px-3 py-2" value={paymentData.paymentMode} onChange={(e) => setPaymentData({ ...paymentData, paymentMode: e.target.value })}>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cash">Cash</option>
                        <option value="cheque">Cheque</option>
                        <option value="upi">UPI</option>
                      </select>
                    </div>
                    <div>
                      <Label>Reference Number</Label>
                      <Input value={paymentData.referenceNumber} onChange={(e) => setPaymentData({ ...paymentData, referenceNumber: e.target.value })} placeholder="UTR/Cheque No./Txn ID" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input value={paymentData.description} onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })} placeholder="Payment notes" />
                    </div>
                    <Button onClick={() => createPaymentMutation.mutate()} className="w-full bg-green-600 hover:bg-green-700">
                      Record Payment
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredVendors.map((vendor: any) => (
                <button
                  key={vendor._id}
                  onClick={() => setSelectedVendor(vendor)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedVendor?._id === vendor._id
                      ? "border-green-600 bg-green-50"
                      : "border-gray-200 hover:border-green-400 hover:bg-green-50"
                  }`}
                >
                  <p className="font-medium text-gray-900">{vendor.companyName}</p>
                  <p className="text-xs text-gray-600">{vendor.primaryMobile}</p>
                </button>
              ))}
            </div>

            {selectedVendor && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold mb-4">Payment History - {selectedVendor.companyName}</h3>
                {payments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No payments recorded</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Mode</TableCell>
                          <TableCell>Reference</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment: any) => (
                          <TableRow key={payment._id}>
                            <TableCell>{new Date(payment.paymentDate).toLocaleDateString("en-IN")}</TableCell>
                            <TableCell className="font-semibold">₹{payment.amount.toLocaleString("en-IN")}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{payment.paymentMode}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{payment.referenceNumber || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={payment.status === "completed" ? "default" : "secondary"}>
                                {payment.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
