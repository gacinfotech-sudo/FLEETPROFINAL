import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, User, Phone, Mail, CheckCircle, AlertCircle } from "lucide-react";

export default function ManagerClientAssignmentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [selectedClientType, setSelectedClientType] = useState<"corporate" | "vendor">("corporate");
  const [formData, setFormData] = useState({
    managerId: "",
    clientId: "",
    clientType: "corporate",
    startDate: new Date().toISOString().split("T")[0],
    primaryContact: true,
  });

  const { data: managers = [], isLoading: managersLoading } = useQuery({
    queryKey: ["/api/drivers"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/drivers`, { credentials: "include" });
        if (!res.ok) {
          console.error('Failed to fetch drivers:', res.status);
          return [];
        }
        const drivers = await res.json();
        console.log('Drivers fetched:', drivers);
        return Array.isArray(drivers) ? drivers : [];
      } catch (e) {
        console.error('Error fetching drivers:', e);
        return [];
      }
    },
    refetchInterval: 15000,
  });

  const { data: corporateClients = [] } = useQuery({
    queryKey: ["/api/corporate-clients"],
    refetchInterval: 15000,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["/api/vendors"],
    refetchInterval: 15000,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["/api/manager-client-assignments", selectedClientType],
    queryFn: async () => {
      const res = await fetch(`/api/manager-client-assignments?clientType=${selectedClientType}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  const assignManagerMutation = useMutation({
    mutationFn: async () => {
      if (!formData.managerId || !formData.clientId) {
        throw new Error("Manager and client required");
      }
      return (
        await apiRequest("POST", "/api/manager-client-assignments", {
          managerId: formData.managerId,
          clientId: formData.clientId,
          clientType: formData.clientType,
          startDate: formData.startDate,
          primaryContact: formData.primaryContact,
        })
      ).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager-client-assignments"] });
      toast({ title: "Success", description: "Manager assigned to client" });
      setShowAssignForm(false);
      setFormData({
        managerId: "",
        clientId: "",
        clientType: "corporate",
        startDate: new Date().toISOString().split("T")[0],
        primaryContact: true,
      });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return (await apiRequest("DELETE", `/api/manager-client-assignments/${assignmentId}`, {})).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager-client-assignments"] });
      toast({ title: "Success", description: "Assignment removed" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const getManagerName = (id: string) => {
    const manager = managers.find((m: any) => m._id === id);
    return manager?.name || "Unknown Manager";
  };

  const getManagerContact = (id: string) => {
    const manager = managers.find((m: any) => m._id === id);
    return manager;
  };

  const getClientName = (id: string, type: string) => {
    if (type === "corporate") {
      const client = corporateClients.find((c: any) => c._id === id);
      return client?.companyName || "Unknown Client";
    } else {
      const vendor = vendors.find((v: any) => v._id === id);
      return vendor?.companyName || "Unknown Vendor";
    }
  };

  const getClientContact = (id: string, type: string) => {
    if (type === "corporate") {
      const client = corporateClients.find((c: any) => c._id === id);
      return client;
    } else {
      const vendor = vendors.find((v: any) => v._id === id);
      return vendor;
    }
  };

  const assignmentsByManager = assignments.reduce((acc: any, assignment: any) => {
    const managerId = assignment.managerId;
    if (!acc[managerId]) {
      acc[managerId] = [];
    }
    acc[managerId].push(assignment);
    return acc;
  }, {});

  const assignmentsByClient = assignments.reduce((acc: any, assignment: any) => {
    const clientId = assignment.clientId;
    if (!acc[clientId]) {
      acc[clientId] = [];
    }
    acc[clientId].push(assignment);
    return acc;
  }, {});

  const primaryContactCount = assignments.filter((a: any) => a.primaryContact).length;

  return (
    <div className="space-y-6">
      <div className="gradient-header bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">👥 Manager Assignments</h1>
            <p className="text-indigo-100 mt-1">Assign managers to corporate clients & vendors for handling</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{assignments.length}</p>
            <p className="text-indigo-100">Total Assignments</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total Assignments</p>
            <p className="text-3xl font-bold text-blue-600">{assignments.length}</p>
            <p className="text-xs text-gray-500 mt-1">Active manager-client links</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Managers Active</p>
            <p className="text-3xl font-bold text-green-600">{Object.keys(assignmentsByManager).length}</p>
            <p className="text-xs text-gray-500 mt-1">With assigned clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Clients Managed</p>
            <p className="text-3xl font-bold text-purple-600">{Object.keys(assignmentsByClient).length}</p>
            <p className="text-xs text-gray-500 mt-1">With assigned managers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Primary Contacts</p>
            <p className="text-3xl font-bold text-orange-600">{primaryContactCount}</p>
            <p className="text-xs text-gray-500 mt-1">Main contacts assigned</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => setSelectedClientType("corporate")}
          variant={selectedClientType === "corporate" ? "default" : "outline"}
          className={selectedClientType === "corporate" ? "bg-indigo-600" : ""}
        >
          🏢 Corporate Clients
        </Button>
        <Button
          onClick={() => setSelectedClientType("vendor")}
          variant={selectedClientType === "vendor" ? "default" : "outline"}
          className={selectedClientType === "vendor" ? "bg-indigo-600" : ""}
        >
          🚗 Vendors
        </Button>
      </div>

      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignments">All Assignments ({assignments.length})</TabsTrigger>
          <TabsTrigger value="by-manager">By Manager ({Object.keys(assignmentsByManager).length})</TabsTrigger>
          <TabsTrigger value="by-client">By Client ({Object.keys(assignmentsByClient).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Manager-Client Assignments</CardTitle>
                <Dialog open={showAssignForm} onOpenChange={setShowAssignForm}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                      <Plus className="w-4 h-4 mr-2" /> Assign Manager
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Assign Manager to {selectedClientType === "corporate" ? "Corporate Client" : "Vendor"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Select Manager</Label>
                        {managersLoading ? (
                          <p className="text-sm text-gray-500">Loading managers...</p>
                        ) : managers.length === 0 ? (
                          <p className="text-sm text-gray-500">No managers available. Create users first.</p>
                        ) : (
                          <Select value={formData.managerId} onValueChange={(v) => setFormData({ ...formData, managerId: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose manager..." />
                            </SelectTrigger>
                            <SelectContent>
                              {managers.map((manager: any) => (
                                <SelectItem key={manager._id} value={manager._id}>
                                  {manager.name} ({manager.email || 'no-email'})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div>
                        <Label>
                          Select {selectedClientType === "corporate" ? "Corporate Client" : "Vendor"}
                        </Label>
                        <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose client..." />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedClientType === "corporate"
                              ? corporateClients.map((client: any) => (
                                  <SelectItem key={client._id} value={client._id}>
                                    {client.companyName} ({client.companyCode})
                                  </SelectItem>
                                ))
                              : vendors.map((vendor: any) => (
                                  <SelectItem key={vendor._id} value={vendor._id}>
                                    {vendor.companyName}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Assignment Start Date</Label>
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.primaryContact}
                          onChange={(e) => setFormData({ ...formData, primaryContact: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <Label className="cursor-pointer">Mark as Primary Contact for this client</Label>
                      </div>

                      <Button
                        onClick={() => assignManagerMutation.mutate()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                        disabled={!formData.managerId || !formData.clientId}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Assign Manager
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No assignments yet. Assign a manager to get started.</p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment: any) => {
                    const manager = getManagerContact(assignment.managerId);
                    const client = getClientContact(assignment.clientId, assignment.clientType);

                    return (
                      <div key={assignment._id} className="border rounded-lg p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Manager Info */}
                          <div className="border-r pr-4">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                              <User className="w-5 h-5 text-blue-600" />
                              {manager?.name || "Unknown Manager"}
                            </h3>
                            <div className="mt-2 space-y-1 text-sm text-gray-600">
                              {manager?.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4" /> {manager.email}
                                </div>
                              )}
                              {manager?.primaryMobile && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4" /> {manager.primaryMobile}
                                </div>
                              )}
                              {manager?.role && (
                                <div className="flex items-center gap-2">
                                  🎯 Role: {manager.role}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Client Info */}
                          <div className="pl-4">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                              {assignment.clientType === "corporate" ? "🏢" : "🚗"}
                              {client?.companyName || "Unknown Client"}
                            </h3>
                            <div className="mt-2 space-y-1 text-sm text-gray-600">
                              {client?.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4" /> {client.email}
                                </div>
                              )}
                              {client?.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4" /> {client.phone}
                                </div>
                              )}
                              {client?.contactPerson && (
                                <div className="flex items-center gap-2">
                                  👤 {client.contactPerson}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm border-t pt-3">
                          <div>
                            <p className="text-gray-600">Type</p>
                            <p className="font-medium capitalize">{assignment.clientType}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Role</p>
                            <Badge className={assignment.primaryContact ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}>
                              {assignment.primaryContact ? "🎯 Primary" : "📞 Support"}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-gray-600">Assigned Date</p>
                            <p className="font-medium">{new Date(assignment.startDate).toLocaleDateString("en-IN")}</p>
                          </div>
                          <div className="text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm("Remove this manager assignment?")) {
                                  removeAssignmentMutation.mutate(assignment._id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-manager">
          <Card>
            <CardHeader>
              <CardTitle>Assignments by Manager</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(assignmentsByManager).length === 0 ? (
                <p className="text-gray-500 text-center py-6">No managers assigned yet</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(assignmentsByManager).map(([managerId, managerAssignments]: [string, any]) => {
                    const manager = getManagerContact(managerId);
                    return (
                      <div key={managerId} className="border rounded-lg p-4">
                        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                          <User className="w-5 h-5 text-blue-600" />
                          {manager?.name}
                        </h3>
                        <div className="ml-8 space-y-2">
                          {managerAssignments.map((assignment: any) => (
                            <div key={assignment._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {assignment.clientType === "corporate" ? "🏢" : "🚗"} {getClientName(assignment.clientId, assignment.clientType)}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {assignment.primaryContact ? "🎯 Primary Contact" : "📞 Support Contact"}
                                </p>
                              </div>
                              <Badge variant="outline">{assignment.clientType}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-client">
          <Card>
            <CardHeader>
              <CardTitle>Assignments by Client</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(assignmentsByClient).length === 0 ? (
                <p className="text-gray-500 text-center py-6">No clients assigned yet</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(assignmentsByClient).map(([clientId, clientAssignments]: [string, any]) => {
                    const firstAssignment = clientAssignments[0];
                    const client = getClientContact(clientId, firstAssignment.clientType);
                    return (
                      <div key={clientId} className="border rounded-lg p-4">
                        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                          {firstAssignment.clientType === "corporate" ? "🏢" : "🚗"}
                          {client?.companyName}
                        </h3>
                        <div className="ml-8 space-y-2">
                          {clientAssignments.map((assignment: any) => {
                            const manager = getManagerContact(assignment.managerId);
                            return (
                              <div key={assignment._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex-1">
                                  <p className="font-medium">👤 {manager?.name}</p>
                                  <p className="text-sm text-gray-600">
                                    {assignment.primaryContact ? "🎯 Primary Contact" : "📞 Support Contact"}
                                  </p>
                                </div>
                                <Badge className={assignment.primaryContact ? "bg-orange-100 text-orange-800" : ""}>
                                  {manager?.role || "User"}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
