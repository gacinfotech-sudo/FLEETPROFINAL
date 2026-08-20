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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Building2 } from "lucide-react";

export default function CorporateClientsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    companyName: "",
    companyCode: "",
    email: "",
    phone: "",
    contactPerson: "",
    paymentTerms: "monthly_invoice",
    creditLimit: 0,
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["/api/corporate-clients"],
    queryFn: async () => {
      const res = await fetch("/api/corporate-clients", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load clients");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return (await apiRequest("POST", "/api/corporate-clients", formData)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/corporate-clients"] });
      toast({ title: "Success", description: "Corporate client created" });
      setShowForm(false);
      setFormData({ companyName: "", companyCode: "", email: "", phone: "", contactPerson: "", paymentTerms: "monthly_invoice" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/corporate-clients/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/corporate-clients"] });
      toast({ title: "Success", description: "Client deactivated" });
    },
  });

  const filtered = clients.filter((c: any) =>
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.companyCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="gradient-header bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">🏢 Corporate Clients</h1>
            <p className="text-purple-100 mt-1">Manage corporate entities and billing</p>
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button className="bg-white text-purple-600 hover:bg-gray-100">
                <Plus className="w-4 h-4 mr-2" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Corporate Client</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Company Name *</Label>
                  <Input value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} />
                </div>
                <div>
                  <Label>Company Code *</Label>
                  <Input value={formData.companyCode} onChange={(e) => setFormData({ ...formData, companyCode: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <Input value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} />
                </div>
                <div>
                  <Label>Payment Terms</Label>
                  <select className="w-full border rounded px-3 py-2" value={formData.paymentTerms} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}>
                    <option value="monthly_invoice">Monthly Invoice</option>
                    <option value="weekly_settlement">Weekly Settlement</option>
                    <option value="daily_settlement">Daily Settlement</option>
                    <option value="advance_payment">Advance Payment</option>
                  </select>
                </div>
                <div>
                  <Label>Credit Limit (₹)</Label>
                  <Input type="number" value={formData.creditLimit} onChange={(e) => setFormData({ ...formData, creditLimit: parseInt(e.target.value) || 0 })} />
                </div>
                <Button onClick={() => createMutation.mutate()} className="w-full bg-purple-600 hover:bg-purple-700">
                  Create Client
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Input placeholder="Search by company name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Corporate Clients ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 py-6 text-center">No corporate clients found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>Company</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Payment Terms</TableCell>
                    <TableCell>Credit Limit</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client: any) => (
                    <TableRow key={client._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-purple-600" />
                          {client.companyName}
                        </div>
                      </TableCell>
                      <TableCell>{client.companyCode}</TableCell>
                      <TableCell>{client.contactPerson || "-"}</TableCell>
                      <TableCell className="text-sm">{client.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {client.paymentTerms?.replace(/_/g, " ") || "monthly"}
                        </Badge>
                      </TableCell>
                      <TableCell>₹{(client.creditLimit || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <Badge variant={client.status === "active" ? "default" : "secondary"}>
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(client._id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
