import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Car } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_CLASS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  tentatively_held: "bg-amber-100 text-amber-800",
  assigned: "bg-blue-100 text-blue-800",
  on_trip: "bg-blue-100 text-blue-800",
  maintenance: "bg-amber-100 text-amber-800",
  breakdown: "bg-red-100 text-red-800",
  document_expired: "bg-red-100 text-red-800",
  inactive: "bg-gray-100 text-gray-600",
};

function emptyForm() {
  return { registrationNumber: "", make: "", vehicleModel: "", category: "sedan", seatingCapacity: "" };
}

export default function VendorVehicles({ vendorId }: { vendorId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const formData = { ...form };
  const { save: autoSave } = useFormAutoSave(`vendor-vehicle-${vendorId}`, formData, 2000);
  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  const { data: vehicles, isLoading } = useQuery<any[]>({ queryKey: [`/api/vendors/${vendorId}/vehicles`] });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.registrationNumber.trim()) throw new Error("Registration number is required");
      if (!form.vehicleModel.trim()) throw new Error("Vehicle model is required");
      return (await apiRequest("POST", `/api/vendors/${vendorId}/vehicles`, {
        ...form, seatingCapacity: form.seatingCapacity ? Number(form.seatingCapacity) : undefined,
      })).json();
    },
    onSuccess: (vehicle: any) => {
      toast({ title: `Vehicle added: ${vehicle.vehicleCode}` });
      setShowAdd(false);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/${vendorId}/vehicles`] });
    },
    onError: (err: any) => toast({ title: "Could not add vehicle", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700">{(vehicles || []).length} vehicle{(vehicles || []).length === 1 ? "" : "s"}</Label>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5 mr-1" />Add Vehicle</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 py-4 text-center">Loading...</p>
      ) : !vehicles || vehicles.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <Car className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm">No vehicles yet for this vendor.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Registration</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v: any) => (
                <TableRow key={v._id}>
                  <TableCell className="font-mono text-xs">{v.vehicleCode}</TableCell>
                  <TableCell className="font-medium">{v.registrationNumber}</TableCell>
                  <TableCell>{v.make ? `${v.make} ` : ""}{v.vehicleModel}</TableCell>
                  <TableCell className="capitalize">{v.category}</TableCell>
                  <TableCell><Badge className={STATUS_CLASS[v.status] || "bg-gray-100 text-gray-600"}>{v.status.replace(/_/g, ' ')}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Vendor Vehicle</DialogTitle></DialogHeader>
          <FormSubmitStatus
            status={createMutation.isPending ? "loading" : createMutation.isSuccess ? "success" : createMutation.isError ? "error" : "idle"}
            successMessage="Vehicle added successfully!"
            errorMessage={(createMutation.error as any)?.message}
          />
          <div className="space-y-3">
            <div>
              <Label>Registration Number</Label>
              <Input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="e.g. MP09AB1234" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Make</Label>
                <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="e.g. Maruti" />
              </div>
              <div>
                <Label>Model</Label>
                <Input value={form.vehicleModel} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} placeholder="e.g. Swift Dzire" />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <Label>Seating Capacity</Label>
                <Input type="number" value={form.seatingCapacity} onChange={(e) => setForm({ ...form, seatingCapacity: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>Add Vehicle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
