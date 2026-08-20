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
import { Plus, Link2 } from "lucide-react";

export default function VendorCompanyAssignmentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    corporateClientId: "",
    assignmentType: "on_call",
    monthlyCapacity: 0,
    monthlyRate: 0,
    perTripRate: 0,
    startDate: new Date().toISOString().split("T")[0],
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["/api/vendors"],
    refetchInterval: 15000,
  });

  const { data: corporateClients = [] } = useQuery({
    queryKey: ["/api/corporate-clients"],
    refetchInterval: 15000,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: selectedVendor ? [`/api/vendors/${selectedVendor._id}/company-assignments`] : [],
    refetchInterval: 15000,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVendor) throw new Error("Select a vendor first");
      return (await apiRequest("POST", `/api/vendors/${selectedVendor._id}/company-assignments`, formData)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/${selectedVendor._id}/company-assignments`] });
      toast({ title: "Success", description: "Company assignment created" });
      setShowForm(false);
      setFormData({
        corporateClientId: "",
        assignmentType: "on_call",
        monthlyCapacity: 0,
        monthlyRate: 0,
        perTripRate: 0,
        startDate: new Date().toISOString().split("T")[0],
      });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const activeVendors = vendors.filter((v: any) => v.status === "active").sort((a: any, b: any) => a.companyName.localeCompare(b.companyName));

  return (
    <div className="space-y-6">
      <div className="gradient-header bg-gradient-to-r from-orange-600 to-amber-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">🔗 Vendor-Company Assignments</h1>
            <p className="text-orange-100 mt-1">Link vendors to companies and track relationships</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Select Vendor</CardTitle>
            {selectedVendor && (
              <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogTrigger asChild>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="w-4 h-4 mr-2" /> Assign Company
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Company to {selectedVendor.companyName}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Corporate Client *</Label>
                      <select
                        className="w-full border rounded px-3 py-2"
                        value={formData.corporateClientId}
                        onChange={(e) => setFormData({ ...formData, corporateClientId: e.target.value })}
                      >
                        <option value="">Select a client...</option>
                        {corporateClients.map((c: any) => (
                          <option key={c._id} value={c._id}>
                            {c.companyName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Assignment Type *</Label>
                      <select
                        className="w-full border rounded px-3 py-2"
                        value={formData.assignmentType}
                        onChange={(e) => setFormData({ ...formData, assignmentType: e.target.value })}
                      >
                        <option value="on_call">On Call</option>
                        <option value="monthly_attachment">Monthly Attachment</option>
                        <option value="weekly_contract">Weekly Contract</option>
                        <option value="daily_rate">Daily Rate</option>
                      </select>
                    </div>
                    {formData.assignmentType === "monthly_attachment" && (
                      <>
                        <div>
                          <Label>Monthly Capacity (trips)</Label>
                          <Input
                            type="number"
                            value={formData.monthlyCapacity}
                            onChange={(e) => setFormData({ ...formData, monthlyCapacity: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label>Monthly Rate (₹)</Label>
                          <Input
                            type="number"
                            value={formData.monthlyRate}
                            onChange={(e) => setFormData({ ...formData, monthlyRate: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </>
                    )}
                    {formData.assignmentType === "on_call" && (
                      <div>
                        <Label>Per Trip Rate (₹)</Label>
                        <Input
                          type="number"
                          value={formData.perTripRate}
                          onChange={(e) => setFormData({ ...formData, perTripRate: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    )}
                    <div>
                      <Label>Start Date *</Label>
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      />
                    </div>
                    <Button onClick={() => createAssignmentMutation.mutate()} className="w-full bg-orange-600 hover:bg-orange-700">
                      Create Assignment
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {activeVendors.map((vendor: any) => (
              <button
                key={vendor._id}
                onClick={() => setSelectedVendor(vendor)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedVendor?._id === vendor._id
                    ? "border-orange-600 bg-orange-50"
                    : "border-gray-200 hover:border-orange-400 hover:bg-orange-50"
                }`}
              >
                <p className="font-medium text-gray-900">{vendor.companyName}</p>
                <p className="text-xs text-gray-600">{vendor.primaryMobile}</p>
              </button>
            ))}
          </div>

          {selectedVendor && (
            <div className="pt-6 border-t">
              <h3 className="font-semibold mb-4">Company Assignments - {selectedVendor.companyName}</h3>
              {assignments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No company assignments</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell>Company</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Capacity/Rate</TableCell>
                        <TableCell>Start Date</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.map((assignment: any) => (
                        <TableRow key={assignment._id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Link2 className="w-4 h-4 text-orange-600" />
                              {assignment.companyName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {assignment.assignmentType.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assignment.assignmentType === "monthly_attachment"
                              ? `${assignment.monthlyCapacity} trips / ₹${assignment.monthlyRate?.toLocaleString("en-IN")}`
                              : assignment.assignmentType === "on_call"
                              ? `₹${assignment.perTripRate?.toLocaleString("en-IN")}/trip`
                              : "-"}
                          </TableCell>
                          <TableCell>{new Date(assignment.startDate).toLocaleDateString("en-IN")}</TableCell>
                          <TableCell>
                            <Badge variant={assignment.status === "active" ? "default" : "secondary"}>
                              {assignment.status}
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
        </CardContent>
      </Card>
    </div>
  );
}
