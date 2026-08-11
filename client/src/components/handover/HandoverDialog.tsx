// Staff-facing "conduct a vehicle handover" dialog. Self-contained
// (client/src/components/handover/** is this task's exclusive ownership) —
// not wired into any existing staff page (dashboard.tsx / a vehicle
// management page) since those files are outside this task's ownership and
// not covered by the hard-scope exception (only client/src/pages/
// driver-portal.tsx is). See this task's report for the proposed,
// not-yet-applied integration point.
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import RemovableItemInventoryEditor from "./RemovableItemInventoryEditor";
import type { RemovableItemInventoryEntry, VehicleHandover } from "./types";

interface Props {
  vehicleId: string;
  driverId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (handover: VehicleHandover) => void;
}

export default function HandoverDialog({ vehicleId, driverId, open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [odometerReading, setOdometerReading] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [damageNoted, setDamageNoted] = useState("");
  const [inventory, setInventory] = useState<RemovableItemInventoryEntry[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);

  const formData = { odometerReading, fuelLevel, damageNoted, inventory };
  const { save: autoSave } = useFormAutoSave(`handover-form-${vehicleId}`, formData, 2000);

  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  const mutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("driverId", driverId);
      form.append("odometerReading", odometerReading);
      form.append("fuelLevel", fuelLevel);
      if (damageNoted) form.append("damageNoted", damageNoted);
      form.append("removableItemInventory", JSON.stringify(inventory));
      photos.forEach((file) => form.append("photos", file));
      const res = await apiRequest("POST", `/api/vehicles/${vehicleId}/handover`, form);
      return res.json();
    },
    onSuccess: (handover: VehicleHandover) => {
      toast({ title: "Handover recorded", description: "Driver must acknowledge it from the driver portal." });
      queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}/handovers`] });
      onCreated?.(handover);
      onOpenChange(false);
    },
    onError: (err: any) => toast({ title: "Could not record handover", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vehicle Handover</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="odometerReading">Odometer (km)</Label>
              <Input id="odometerReading" type="number" min={0} value={odometerReading} onChange={(e) => setOdometerReading(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fuelLevel">Fuel level (%)</Label>
              <Input id="fuelLevel" type="number" min={0} max={100} value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Removable item inventory</Label>
            <RemovableItemInventoryEditor value={inventory} onChange={setInventory} />
          </div>
          <div>
            <Label htmlFor="damageNoted">Damage noted (if any)</Label>
            <Textarea id="damageNoted" value={damageNoted} onChange={(e) => setDamageNoted(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="photos">Condition photos (optional)</Label>
            <Input id="photos" type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files || []))} />
          </div>
        </div>
        <FormSubmitStatus
          status={mutation.isPending ? "loading" : mutation.isSuccess ? "success" : mutation.isError ? "error" : "idle"}
          successMessage="Handover recorded!"
          errorMessage={(mutation.error as any)?.message || "Failed to record handover"}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={mutation.isPending || !odometerReading || !fuelLevel}
            onClick={() => mutation.mutate()}
          >
            Record Handover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
