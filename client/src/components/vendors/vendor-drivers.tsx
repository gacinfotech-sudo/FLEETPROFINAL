import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, UserRound } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_CLASS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  tentatively_held: "bg-amber-100 text-amber-800",
  assigned: "bg-blue-100 text-blue-800",
  on_duty: "bg-blue-100 text-blue-800",
  on_leave: "bg-gray-100 text-gray-600",
  suspended: "bg-red-100 text-red-800",
  inactive: "bg-gray-100 text-gray-600",
  document_expired: "bg-red-100 text-red-800",
};

function emptyForm() {
  return { name: "", primaryMobile: "", alternateMobile: "", licenseNumber: "" };
}

export default function VendorDrivers({ vendorId }: { vendorId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const { data: drivers, isLoading } = useQuery<any[]>({ queryKey: [`/api/vendors/${vendorId}/drivers`] });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Driver name is required");
      if (!form.primaryMobile.trim()) throw new Error("Primary mobile is required");
      return (await apiRequest("POST", `/api/vendors/${vendorId}/drivers`, form)).json();
    },
    onSuccess: (driver: any) => {
      toast({ title: `Driver added: ${driver.driverCode}` });
      setShowAdd(false);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/${vendorId}/drivers`] });
    },
    onError: (err: any) => toast({ title: "Could not add driver", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700">{(drivers || []).length} driver{(drivers || []).length === 1 ? "" : "s"}</Label>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5 mr-1" />Add Driver</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 py-4 text-center">Loading...</p>
      ) : !drivers || drivers.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <UserRound className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm">No drivers yet for this vendor.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((d: any) => (
                <TableRow key={d._id}>
                  <TableCell className="font-mono text-xs">{d.driverCode}</TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.primaryMobile?.replace(/^91/, '')}</TableCell>
                  <TableCell><Badge className={STATUS_CLASS[d.status] || "bg-gray-100 text-gray-600"}>{d.status.replace(/_/g, ' ')}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Vendor Driver</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Primary Mobile</Label>
                <Input value={form.primaryMobile} onChange={(e) => setForm({ ...form, primaryMobile: e.target.value })} />
              </div>
              <div>
                <Label>Alternate Mobile</Label>
                <Input value={form.alternateMobile} onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>License Number</Label>
              <Input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>Add Driver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
