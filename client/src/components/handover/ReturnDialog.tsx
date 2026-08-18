// Staff-facing "conduct a vehicle return" dialog — the counterpart to
// HandoverDialog.tsx. See that file's header comment re: not being wired
// into any existing staff page yet (out of this task's ownership).
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import RemovableItemInventoryEditor from "./RemovableItemInventoryEditor";
import type { RemovableItemInventoryEntry, VehicleHandover } from "./types";

interface Props {
  vehicleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (handover: VehicleHandover) => void;
}

export default function ReturnDialog({ vehicleId, open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [odometerReading, setOdometerReading] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [expectedTripDistanceKm, setExpectedTripDistanceKm] = useState("");
  const [damageNoted, setDamageNoted] = useState("");
  const [inventory, setInventory] = useState<RemovableItemInventoryEntry[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [result, setResult] = useState<VehicleHandover | null>(null);

  const formData = { odometerReading, fuelLevel, expectedTripDistanceKm, damageNoted, inventory };
  const { save: autoSave } = useFormAutoSave(`return-form-${vehicleId}`, formData, 2000);

  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  const mutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("odometerReading", odometerReading);
      form.append("fuelLevel", fuelLevel);
      if (expectedTripDistanceKm) form.append("expectedTripDistanceKm", expectedTripDistanceKm);
      if (damageNoted) form.append("damageNoted", damageNoted);
      form.append("removableItemInventory", JSON.stringify(inventory));
      photos.forEach((file) => form.append("photos", file));
      const res = await apiRequest("POST", `/api/vehicles/${vehicleId}/return`, form);
      return res.json();
    },
    onSuccess: (handover: VehicleHandover) => {
      queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}/handovers`] });
      onCreated?.(handover);
      if (handover.status === 'disputed') {
        // Deliberately do NOT close the dialog / show a blocking error —
        // the return already succeeded (201). This surfaces the flags for
        // staff awareness only. See TASK-VEHICLE-HANDOVER-05's acceptance
        // criterion: a flagged return is never a rejection.
        setResult(handover);
        toast({ title: "Vehicle returned — flagged for review", description: `${handover.flags.length} discrepancy(ies) recorded.` });
      } else {
        toast({ title: "Vehicle returned" });
        onOpenChange(false);
      }
    },
    onError: (err: any) => toast({ title: "Could not record return", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vehicle Return</DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              <span>Return recorded. {result.flags.length} item(s) flagged for office review — this did not block the return.</span>
            </div>
            <ul className="space-y-1 text-sm">
              {result.flags.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{f.type.replace(/_/g, ' ')}</Badge>
                  {f.description}
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button onClick={() => { setResult(null); onOpenChange(false); }}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ret-odometerReading">Odometer (km)</Label>
                  <Input id="ret-odometerReading" type="number" min={0} value={odometerReading} onChange={(e) => setOdometerReading(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ret-fuelLevel">Fuel level (%)</Label>
                  <Input id="ret-fuelLevel" type="number" min={0} max={100} value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="expectedTripDistanceKm">Expected trip distance (km, optional)</Label>
                <Input id="expectedTripDistanceKm" type="number" min={0} value={expectedTripDistanceKm} onChange={(e) => setExpectedTripDistanceKm(e.target.value)} />
              </div>
              <div>
                <Label>Removable item inventory (compared against handover)</Label>
                <RemovableItemInventoryEditor value={inventory} onChange={setInventory} />
              </div>
              <div>
                <Label htmlFor="ret-damageNoted">New damage noted (if any)</Label>
                <Textarea id="ret-damageNoted" value={damageNoted} onChange={(e) => setDamageNoted(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ret-photos">Condition photos (optional)</Label>
                <Input id="ret-photos" type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files || []))} />
              </div>
            </div>
            <FormSubmitStatus
              status={mutation.isPending ? "loading" : mutation.isSuccess ? "success" : mutation.isError ? "error" : "idle"}
              successMessage="Vehicle return recorded!"
              errorMessage={(mutation.error as any)?.message || "Failed to record return"}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={mutation.isPending || !odometerReading || !fuelLevel} onClick={() => mutation.mutate()}>
                Record Return
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
