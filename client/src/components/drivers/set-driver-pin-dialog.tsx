import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";

interface Props {
  driverId: string;
  driverName: string;
}

// Staff-only control for the driver portal's login PIN (server/middleware/
// driverAuth.ts) — a driver never sets or sees their own PIN hash.
export default function SetDriverPinDialog({ driverId, driverName }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");

  const setPinMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/drivers/${driverId}/set-login-pin`, { pin })).json(),
    onSuccess: () => {
      toast({ title: "Login PIN set", description: `${driverName} can now log in to the driver portal with this PIN. Any previous session was signed out.` });
      setOpen(false);
      setPin("");
    },
    onError: (err: any) => toast({ title: "Could not set PIN", description: err.message, variant: "destructive" }),
  });

  const formData = { pin };
  const { save: autoSave } = useFormAutoSave(`driver-pin-${driverId}`, formData, 2000);
  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Set Login PIN
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Set Driver Portal PIN</DialogTitle></DialogHeader>
          <FormSubmitStatus
            status={setPinMutation.isPending ? "loading" : setPinMutation.isSuccess ? "success" : setPinMutation.isError ? "error" : "idle"}
            successMessage="PIN saved!"
            errorMessage={(setPinMutation.error as any)?.message}
          />
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {driverName} will use their registered phone number plus this PIN to log in to the driver portal at /driver-login.
            </p>
            <div>
              <Label htmlFor="new-driver-pin">New PIN (4-6 digits)</Label>
              <Input
                id="new-driver-pin" type="password" inputMode="numeric" maxLength={6}
                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!/^\d{4,6}$/.test(pin) || setPinMutation.isPending} onClick={() => setPinMutation.mutate()}>
              {setPinMutation.isPending ? "Saving..." : "Set PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
