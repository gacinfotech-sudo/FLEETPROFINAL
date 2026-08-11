import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Truck, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";

const NOT_ASSIGNABLE_STATUSES = new Set(["cancelled", "no_show", "completed", "closed"]);
const ADD_NEW = "__add_new__";

interface Props {
  booking: any;
}

export default function AssignVendorDialog({ booking }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState(booking.fulfilmentVendorId?._id || booking.fulfilmentVendorId || "");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [agreedRate, setAgreedRate] = useState(String(booking.vendorAgreedRate || ""));
  const [advancePaid, setAdvancePaid] = useState(String(booking.vendorAdvancePaid || ""));
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: "", primaryMobile: "" });
  const [newVehicle, setNewVehicle] = useState({ registrationNumber: "", vehicleModel: "", category: "sedan" });

  // Auto-save form data
  const formData = {
    vendorId,
    driverId,
    vehicleId,
    agreedRate,
    advancePaid,
    newDriver,
    newVehicle,
  };
  const { save: autoSave } = useFormAutoSave("assign-vendor-dialog", formData, 2000);
  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  const { data: vendors } = useQuery<any[]>({
    queryKey: ["/api/vendors", "active"],
    queryFn: async () => (await fetch("/api/vendors?status=active", { credentials: "include" })).json(),
    enabled: open,
  });
  const { data: drivers } = useQuery<any[]>({
    queryKey: [`/api/vendors/${vendorId}/drivers`],
    enabled: open && !!vendorId,
  });
  const { data: vehicles } = useQuery<any[]>({
    queryKey: [`/api/vendors/${vendorId}/vehicles`],
    enabled: open && !!vendorId,
  });

  const addDriverMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/vendors/${vendorId}/drivers`, newDriver)).json(),
    onSuccess: (driver: any) => {
      toast({ title: `Driver added: ${driver.driverCode}` });
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/${vendorId}/drivers`] });
      setDriverId(driver._id);
      setShowAddDriver(false);
      setNewDriver({ name: "", primaryMobile: "" });
    },
    onError: (err: any) => toast({ title: "Could not add driver", description: err.message, variant: "destructive" }),
  });
  const addVehicleMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/vendors/${vendorId}/vehicles`, newVehicle)).json(),
    onSuccess: (vehicle: any) => {
      toast({ title: `Vehicle added: ${vehicle.vehicleCode}` });
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/${vendorId}/vehicles`] });
      setVehicleId(vehicle._id);
      setShowAddVehicle(false);
      setNewVehicle({ registrationNumber: "", vehicleModel: "", category: "sedan" });
    },
    onError: (err: any) => toast({ title: "Could not add vehicle", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error("Select a vendor");
      return (await apiRequest("POST", `/api/bookings/${booking._id || booking.id}/assign-vendor`, {
        fulfilmentVendorId: vendorId,
        vendorDriverId: driverId || undefined,
        vendorVehicleId: vehicleId || undefined,
        vendorAgreedRate: agreedRate ? Number(agreedRate) : undefined,
        vendorAdvancePaid: advancePaid ? Number(advancePaid) : undefined,
      })).json();
    },
    onSuccess: () => {
      toast({ title: "Vendor assigned" });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setOpen(false);
    },
    onError: (err: any) => toast({ title: "Could not assign vendor", description: err.message, variant: "destructive" }),
  });

  const canAssign = !NOT_ASSIGNABLE_STATUSES.has(booking.status);

  return (
    <>
      <Button size="sm" variant="outline" disabled={!canAssign} title={!canAssign ? `Cannot assign a vendor to a ${booking.status} booking` : ""} onClick={() => setOpen(true)}>
        <Truck className="w-3.5 h-3.5 mr-1" />
        {booking.fulfilmentType === "vendor" ? "Reassign Vendor" : "Assign Vendor"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Vendor — {booking.bookingId}</DialogTitle>
            <DialogDescription>Vendor, driver, and vehicle availability are checked before this saves.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={(v) => { setVendorId(v); setDriverId(""); setVehicleId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select a vendor..." /></SelectTrigger>
                <SelectContent>
                  {(vendors || []).map((v: any) => <SelectItem key={v._id} value={v._id}>{v.companyName} ({v.vendorCode})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {vendorId && (
              <>
                <div>
                  <Label>Vendor Driver (Optional)</Label>
                  <Select value={driverId || undefined} onValueChange={(v) => v === ADD_NEW ? setShowAddDriver(true) : setDriverId(v)}>
                    <SelectTrigger><SelectValue placeholder="Not assigned" /></SelectTrigger>
                    <SelectContent>
                      {(drivers || []).map((d: any) => <SelectItem key={d._id} value={d._id}>{d.name} ({d.driverCode}) — {d.status}</SelectItem>)}
                      <SelectItem value={ADD_NEW}><span className="flex items-center gap-1 text-blue-600"><Plus className="w-3 h-3" />Add new driver to this vendor</span></SelectItem>
                    </SelectContent>
                  </Select>
                  {showAddDriver && (
                    <div className="mt-2 border rounded-lg p-3 space-y-2 bg-gray-50">
                      <Input placeholder="Driver name" value={newDriver.name} onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} />
                      <Input placeholder="Mobile number" value={newDriver.primaryMobile} onChange={(e) => setNewDriver({ ...newDriver, primaryMobile: e.target.value })} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowAddDriver(false)}>Cancel</Button>
                        <Button size="sm" disabled={addDriverMutation.isPending} onClick={() => addDriverMutation.mutate()}>Add Driver</Button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Vendor Vehicle (Optional)</Label>
                  <Select value={vehicleId || undefined} onValueChange={(v) => v === ADD_NEW ? setShowAddVehicle(true) : setVehicleId(v)}>
                    <SelectTrigger><SelectValue placeholder="Not assigned" /></SelectTrigger>
                    <SelectContent>
                      {(vehicles || []).map((v: any) => <SelectItem key={v._id} value={v._id}>{v.registrationNumber} — {v.vehicleModel} ({v.status})</SelectItem>)}
                      <SelectItem value={ADD_NEW}><span className="flex items-center gap-1 text-blue-600"><Plus className="w-3 h-3" />Add new vehicle to this vendor</span></SelectItem>
                    </SelectContent>
                  </Select>
                  {showAddVehicle && (
                    <div className="mt-2 border rounded-lg p-3 space-y-2 bg-gray-50">
                      <Input placeholder="Registration number" value={newVehicle.registrationNumber} onChange={(e) => setNewVehicle({ ...newVehicle, registrationNumber: e.target.value })} />
                      <Input placeholder="Model (e.g. Swift Dzire)" value={newVehicle.vehicleModel} onChange={(e) => setNewVehicle({ ...newVehicle, vehicleModel: e.target.value })} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowAddVehicle(false)}>Cancel</Button>
                        <Button size="sm" disabled={addVehicleMutation.isPending} onClick={() => addVehicleMutation.mutate()}>Add Vehicle</Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Vendor Agreed Rate (₹)</Label>
                    <Input type="number" value={agreedRate} onChange={(e) => setAgreedRate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Vendor Advance Paid (₹)</Label>
                    <Input type="number" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>

          <FormSubmitStatus
            status={assignMutation.isPending ? "loading" : assignMutation.isSuccess ? "success" : assignMutation.isError ? "error" : "idle"}
            successMessage="Vendor assigned!"
            errorMessage={(assignMutation.error as any)?.message}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={assignMutation.isPending || !vendorId} onClick={() => assignMutation.mutate()}>
              {assignMutation.isPending ? "Assigning..." : "Assign Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
