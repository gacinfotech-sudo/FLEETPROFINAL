import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";

export default function CorporateVehicleAttachmentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);
  const [formData, setFormData] = useState({
    clientId: "",
    vehicleId: "",
    attachmentType: "monthly_attachment",
    monthlyRate: 0,
    packageName: "",
    packageDetails: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    maxKmPerMonth: 5000,
    fuelIncluded: true,
    maintenanceIncluded: true,
  });

  const { data: corporateClients = [] } = useQuery({
    queryKey: ["/api/corporate-clients"],
    refetchInterval: 15000,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["/api/corporate-vehicle-attachments", selectedClient],
    queryFn: async () => {
      if (!selectedClient) return [];
      const res = await fetch(`/api/corporate-vehicle-attachments?clientId=${selectedClient}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const data = await res.json();

      // Fetch vehicle details if not stored in attachment
      const withDetails = await Promise.all(
        data.map(async (att: any) => {
          try {
            // If vehicle details not in attachment, fetch from vehicle 360
            if (!att.licensePlate && !att.vehicleNumber && att.vehicleId) {
              console.log('Fetching vehicle details for:', att.vehicleId);
              const vehicleRes = await fetch(`/api/vehicles/${att.vehicleId}/360`, { credentials: "include" });
              if (vehicleRes.ok) {
                const vehicle = await vehicleRes.json();
                console.log('Vehicle fetched:', vehicle);
                att.vehicleMake = vehicle.make || att.vehicleMake || 'Unknown';
                att.vehicleModel = vehicle.vehicleModel || att.vehicleModel || 'Model';
                att.licensePlate = vehicle.licensePlate || att.licensePlate || 'N/A';
                att.vehicleNumber = vehicle.vehicleNumber || att.vehicleNumber;
                att.regNumber = vehicle.regNumber || att.regNumber;
              }
            }
            return att;
          } catch (e) {
            console.error(`Failed to fetch vehicle details for ${att.vehicleId}:`, e);
            return att;
          }
        })
      );

      console.log('Attachments with details:', withDetails);
      return withDetails;
    },
    refetchInterval: 15000,
  });

  const { data: availableVehicles = [] } = useQuery({
    queryKey: ["/api/vehicles"],
    refetchInterval: 15000,
  });

  const addAttachmentMutation = useMutation({
    mutationFn: async () => {
      if (!formData.clientId) throw new Error("Please select a corporate client");
      if (!formData.vehicleId) throw new Error("Please select a vehicle");
      if (!formData.monthlyRate) throw new Error("Please enter monthly rate");

      return (
        await apiRequest("POST", "/api/corporate-vehicle-attachments", formData)
      ).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/corporate-vehicle-attachments", formData.clientId] });
      toast({ title: "Success", description: "Vehicle attached successfully" });
      setShowAddVehicle(false);
      setFormData({
        clientId: "",
        vehicleId: "",
        attachmentType: "monthly_attachment",
        monthlyRate: 0,
        packageName: "",
        packageDetails: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        maxKmPerMonth: 5000,
        fuelIncluded: true,
        maintenanceIncluded: true,
      });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      return (await apiRequest("DELETE", `/api/corporate-vehicle-attachments/${attachmentId}`, {})).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/corporate-vehicle-attachments", selectedClient] });
      toast({ title: "Success", description: "Vehicle removed from attachment" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updatePackageMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      return (
        await apiRequest("PUT", `/api/corporate-vehicle-attachments/${attachmentId}`, {
          packageName: formData.packageName,
          packageDetails: formData.packageDetails,
          maxKmPerMonth: formData.maxKmPerMonth,
          fuelIncluded: formData.fuelIncluded,
          maintenanceIncluded: formData.maintenanceIncluded,
        })
      ).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/corporate-vehicle-attachments", selectedClient] });
      toast({ title: "Success", description: "Package details updated" });
      setShowAddPackage(false);
      setSelectedAttachment(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const activeAttachments = attachments.filter((a: any) => a.status === "active").length;
  const totalVehicles = attachments.length;

  return (
    <div className="space-y-6">
      <div className="gradient-header bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">🚗 Corporate Vehicle Attachments</h1>
            <p className="text-purple-100 mt-1">Manage monthly attachments, packages & vehicle assignments</p>
          </div>
          {selectedClient && (
            <div className="text-right">
              <p className="text-4xl font-bold">{activeAttachments}/{totalVehicles}</p>
              <p className="text-purple-100">Active Attachments</p>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Label className="text-base font-semibold mb-2 block">Select Corporate Client</Label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a corporate client..." />
            </SelectTrigger>
            <SelectContent>
              {corporateClients.map((client: any) => (
                <SelectItem key={client._id} value={client._id}>
                  {client.companyName} ({client.companyCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedClient && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600">Active Attachments</p>
                <p className="text-3xl font-bold text-green-600">{activeAttachments}</p>
                <p className="text-xs text-gray-500 mt-1">Currently active</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600">Total Vehicles</p>
                <p className="text-3xl font-bold text-blue-600">{totalVehicles}</p>
                <p className="text-xs text-gray-500 mt-1">Attached vehicles</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600">Monthly Revenue</p>
                <p className="text-3xl font-bold text-purple-600">
                  ₹{attachments
                    .reduce((sum: number, a: any) => sum + (a.monthlyRate || 0), 0)
                    .toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-gray-500 mt-1">Total rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600">Avg Monthly KM</p>
                <p className="text-3xl font-bold text-orange-600">
                  {Math.round(
                    attachments.reduce((sum: number, a: any) => sum + (a.maxKmPerMonth || 0), 0) / Math.max(totalVehicles, 1)
                  ).toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-gray-500 mt-1">Per vehicle</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="attachments" className="space-y-4">
            <TabsList>
              <TabsTrigger value="attachments">Attachments ({totalVehicles})</TabsTrigger>
              <TabsTrigger value="packages">Package Management</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="attachments">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Vehicle Attachments</CardTitle>
                    <Dialog open={showAddVehicle} onOpenChange={setShowAddVehicle}>
                      <DialogTrigger asChild>
                        <Button className="bg-purple-600 hover:bg-purple-700">
                          <Plus className="w-4 h-4 mr-2" /> Add Vehicle
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Add Vehicle to Monthly Attachment</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>🏢 Select Corporate Client *</Label>
                            <Select value={formData.clientId || selectedClient} onValueChange={(v) => setFormData({ ...formData, clientId: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose client..." />
                              </SelectTrigger>
                              <SelectContent>
                                {corporateClients.map((client: any) => (
                                  <SelectItem key={client._id} value={client._id}>
                                    {client.companyName} ({client.companyCode})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>🚗 Select Vehicle *</Label>
                            <Select value={formData.vehicleId} onValueChange={(v) => setFormData({ ...formData, vehicleId: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose vehicle..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableVehicles && availableVehicles.length > 0 ? (
                                  availableVehicles
                                    .filter((v: any) => !attachments.some((a: any) => a.vehicleId === v._id))
                                    .map((vehicle: any) => {
                                      const licensePlate = vehicle.licensePlate || vehicle.regNumber || vehicle.vehicleNumber || vehicle.registrationNumber || vehicle._id;
                                      const fullModel = vehicle.vehicleModel ? `${vehicle.make} ${vehicle.vehicleModel}` : (vehicle.make || 'Unknown Make');
                                      const label = `${licensePlate} (${fullModel})`;
                                      return (
                                        <SelectItem key={vehicle._id} value={vehicle._id}>
                                          {label}
                                        </SelectItem>
                                      );
                                    })
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">No vehicles available</div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Monthly Rate (₹)</Label>
                              <Input
                                type="number"
                                value={formData.monthlyRate}
                                onChange={(e) => setFormData({ ...formData, monthlyRate: Number(e.target.value) })}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <Label>Attachment Type</Label>
                              <Select
                                value={formData.attachmentType}
                                onValueChange={(v) => setFormData({ ...formData, attachmentType: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthly_attachment">Monthly Attachment</SelectItem>
                                  <SelectItem value="weekly_contract">Weekly Contract</SelectItem>
                                  <SelectItem value="daily_rate">Daily Rate</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Start Date</Label>
                              <Input
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>End Date (Optional)</Label>
                              <Input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Max KM/Month</Label>
                              <Input
                                type="number"
                                value={formData.maxKmPerMonth}
                                onChange={(e) => setFormData({ ...formData, maxKmPerMonth: Number(e.target.value) })}
                                placeholder="5000"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={formData.fuelIncluded}
                                onChange={(e) => setFormData({ ...formData, fuelIncluded: e.target.checked })}
                                className="w-4 h-4"
                              />
                              <Label className="cursor-pointer">⛽ Fuel Included</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={formData.maintenanceIncluded}
                                onChange={(e) => setFormData({ ...formData, maintenanceIncluded: e.target.checked })}
                                className="w-4 h-4"
                              />
                              <Label className="cursor-pointer">🔧 Maintenance Included</Label>
                            </div>
                          </div>

                          <Button
                            onClick={() => addAttachmentMutation.mutate()}
                            className="w-full bg-purple-600 hover:bg-purple-700"
                            disabled={!formData.clientId || !formData.vehicleId || !formData.monthlyRate}
                          >
                            <Plus className="w-4 h-4 mr-2" /> Attach Vehicle
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {attachments.length === 0 ? (
                    <p className="text-gray-500 text-center py-6">No vehicles attached. Add one to get started.</p>
                  ) : (
                    <div className="space-y-3">
                      {attachments.map((attachment: any) => (
                        <div key={attachment._id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg">
                                  {attachment.licensePlate || attachment.vehicleNumber || attachment.regNumber || attachment.registrationNumber || "Unknown"}
                                </h3>
                                <Badge className={attachment.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                                  {attachment.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {attachment.vehicleModel && attachment.vehicleMake ? `${attachment.vehicleMake} ${attachment.vehicleModel}` : (attachment.vehicleMake || "Unknown Make")}
                              </p>

                              {attachment.driver && (
                                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <div>
                                    <p className="text-gray-600">Driver</p>
                                    <p className="font-medium">{attachment.driver.name}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">Rating ⭐</p>
                                    <p className="font-medium">{(attachment.driver.avgRating || 0).toFixed(1)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">On-Time 🎯</p>
                                    <p className="font-medium">{(attachment.driver.onTimePercentage || 0).toFixed(0)}%</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">Safety 🛡️</p>
                                    <p className="font-medium">{(attachment.driver.safetyScore || 0).toFixed(1)}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-purple-600">₹{attachment.monthlyRate?.toLocaleString("en-IN")}</p>
                              <p className="text-xs text-gray-600">/month</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 text-sm border-t pt-3">
                            <div>
                              <p className="text-gray-600">Type</p>
                              <p className="font-medium capitalize">{attachment.attachmentType?.replace(/_/g, " ")}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Max KM/Month</p>
                              <p className="font-medium">{attachment.maxKmPerMonth?.toLocaleString("en-IN")} km</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Validity</p>
                              <p className="font-medium">{new Date(attachment.startDate).toLocaleDateString("en-IN")} onwards</p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Dialog open={showAddPackage && selectedAttachment?._id === attachment._id} onOpenChange={setShowAddPackage}>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedAttachment(attachment);
                                    setFormData({
                                      ...formData,
                                      packageName: attachment.packageName || "",
                                      packageDetails: attachment.packageDetails || "",
                                      maxKmPerMonth: attachment.maxKmPerMonth || 5000,
                                      fuelIncluded: attachment.fuelIncluded !== false,
                                      maintenanceIncluded: attachment.maintenanceIncluded !== false,
                                    });
                                  }}
                                >
                                  <Edit className="w-4 h-4 mr-1" /> Package Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Manage Package - {attachment.licensePlate || attachment.vehicleNumber || attachment.registrationNumber || "Vehicle"}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Package Name</Label>
                                    <Input
                                      value={formData.packageName}
                                      onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                                      placeholder="e.g., Premium Package, Executive Plan"
                                    />
                                  </div>

                                  <div>
                                    <Label>Package Details</Label>
                                    <Textarea
                                      value={formData.packageDetails}
                                      onChange={(e) => setFormData({ ...formData, packageDetails: e.target.value })}
                                      placeholder="Describe package features, services, inclusions..."
                                      rows={4}
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Max KM/Month</Label>
                                      <Input
                                        type="number"
                                        value={formData.maxKmPerMonth}
                                        onChange={(e) => setFormData({ ...formData, maxKmPerMonth: Number(e.target.value) })}
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={formData.fuelIncluded}
                                        onChange={(e) => setFormData({ ...formData, fuelIncluded: e.target.checked })}
                                        className="w-4 h-4"
                                      />
                                      <Label className="cursor-pointer">⛽ Fuel Included</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={formData.maintenanceIncluded}
                                        onChange={(e) => setFormData({ ...formData, maintenanceIncluded: e.target.checked })}
                                        className="w-4 h-4"
                                      />
                                      <Label className="cursor-pointer">🔧 Maintenance Included</Label>
                                    </div>
                                  </div>

                                  <Button
                                    onClick={() => updatePackageMutation.mutate(attachment._id)}
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" /> Update Package
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm("Remove this vehicle from attachment?")) {
                                  removeAttachmentMutation.mutate(attachment._id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="packages">
              <Card>
                <CardHeader>
                  <CardTitle>Package Details Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  {attachments.length === 0 ? (
                    <p className="text-gray-500 text-center py-6">No packages configured</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableCell>Vehicle</TableCell>
                            <TableCell>Package Name</TableCell>
                            <TableCell>Max KM/Month</TableCell>
                            <TableCell>Fuel</TableCell>
                            <TableCell>Maintenance</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attachments.map((attachment: any) => (
                            <TableRow key={attachment._id}>
                              <TableCell className="font-medium">{attachment.licensePlate || attachment.vehicleNumber || attachment.registrationNumber || "Unknown"}</TableCell>
                              <TableCell>{attachment.packageName || "-"}</TableCell>
                              <TableCell>{attachment.maxKmPerMonth?.toLocaleString("en-IN")} km</TableCell>
                              <TableCell>{attachment.fuelIncluded ? "✅ Included" : "❌ Extra"}</TableCell>
                              <TableCell>{attachment.maintenanceIncluded ? "✅ Included" : "❌ Extra"}</TableCell>
                              <TableCell>
                                <Badge className={attachment.status === "active" ? "bg-green-100 text-green-800" : ""}>
                                  {attachment.status}
                                </Badge>
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

            <TabsContent value="summary">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Revenue Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between p-4 bg-purple-50 rounded-lg">
                        <span>Total Monthly Revenue</span>
                        <span className="font-bold text-purple-600">
                          ₹{attachments.reduce((sum: number, a: any) => sum + (a.monthlyRate || 0), 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between p-4 bg-blue-50 rounded-lg">
                        <span>Total KM Capacity/Month</span>
                        <span className="font-bold text-blue-600">
                          {attachments.reduce((sum: number, a: any) => sum + (a.maxKmPerMonth || 0), 0).toLocaleString("en-IN")} km
                        </span>
                      </div>
                      <div className="flex justify-between p-4 bg-green-50 rounded-lg">
                        <span>Vehicles with Fuel Included</span>
                        <span className="font-bold text-green-600">{attachments.filter((a: any) => a.fuelIncluded).length}</span>
                      </div>
                      <div className="flex justify-between p-4 bg-orange-50 rounded-lg">
                        <span>Vehicles with Maintenance Included</span>
                        <span className="font-bold text-orange-600">
                          {attachments.filter((a: any) => a.maintenanceIncluded).length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
