import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarPlus, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const EXTENDABLE_STATUSES = ["confirmed", "vehicle_assigned", "driver_assigned", "ready_for_dispatch",
  "trip_started", "ongoing", "extended", "return_pending"];

interface Props {
  booking: any;
}

function fmtMoney(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function toDateInputValue(d?: string) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default function ExtendBookingDialog({ booking }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [conflict, setConflict] = useState<any>(null);
  const [override, setOverride] = useState(false);

  const [newReturnDate, setNewReturnDate] = useState(toDateInputValue(booking.returnDate) || toDateInputValue(booking.pickupDate));
  const [newReturnTime, setNewReturnTime] = useState(booking.returnTime || "");
  const [destinations, setDestinations] = useState("");
  const [reason, setReason] = useState("");
  const [charges, setCharges] = useState({
    additionalDays: 0,
    additionalDaysCharge: 0,
    extraKmCharge: 0,
    driverAllowance: 0,
    nightHalt: 0,
    routeCharge: 0,
    discount: 0,
  });

  const setCharge = (key: keyof typeof charges, value: string) => {
    setCharges((prev) => ({ ...prev, [key]: value === "" ? 0 : Number(value) }));
  };

  const extensionTotal = Math.max(0,
    charges.additionalDaysCharge + charges.extraKmCharge + charges.driverAllowance + charges.nightHalt + charges.routeCharge - charges.discount
  );
  const revisedTotal = (booking.totalAmount || 0) + extensionTotal;
  const revisedBalance = Math.max(0, revisedTotal - (booking.advanceReceived || 0));

  const extendMutation = useMutation({
    mutationFn: async (withOverride: boolean) => {
      const addedDestinations = destinations.split(",").map((d) => d.trim()).filter(Boolean);
      // apiRequest throws a generic Error("<status>: <rawBody>") on any
      // non-2xx response — it never hands back the Response object for a
      // caller to inspect, so a 409 with structured conflict data has to
      // be recovered by parsing that error message back apart here.
      try {
        const res = await apiRequest("POST", `/api/bookings/${booking._id || booking.id}/extend`, {
          newReturnDate,
          newReturnTime,
          addedDestinations,
          reason,
          charges,
          override: withOverride,
        });
        return res.json();
      } catch (err: any) {
        const match = /^(\d+):\s*([\s\S]*)$/.exec(err.message || "");
        if (match) {
          const status = Number(match[1]);
          let body: any = null;
          try { body = JSON.parse(match[2]); } catch { /* not JSON, leave null */ }
          const structuredError: any = new Error(body?.message || err.message);
          structuredError.status = status;
          structuredError.body = body;
          throw structuredError;
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Booking extended", description: `New return: ${newReturnDate} ${newReturnTime}. Revised total ${fmtMoney(revisedTotal)}.` });
      setOpen(false);
      setConflict(null);
      setOverride(false);
    },
    onError: (err: any) => {
      if (err.status === 409 && err.body?.code === "AVAILABILITY_CONFLICT") {
        setConflict(err.body.conflicts);
        return;
      }
      toast({ title: "Could not extend booking", description: err.message, variant: "destructive" });
    },
  });

  const canExtend = EXTENDABLE_STATUSES.includes(booking.status);

  return (
    <>
      <Button size="sm" variant="outline" disabled={!canExtend} title={!canExtend ? `Cannot extend a ${booking.status} booking` : ""} onClick={() => setOpen(true)}>
        <CalendarPlus className="w-3.5 h-3.5 mr-1" />
        Extend Booking
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setConflict(null); setOverride(false); } }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extend Booking — {booking.bookingId}</DialogTitle>
            <DialogDescription>
              Current: {booking.pickupLocation} → {booking.dropoffLocation || "—"}, ends {toDateInputValue(booking.returnDate) || toDateInputValue(booking.pickupDate)} {booking.returnTime || ""}.
              Total {fmtMoney(booking.totalAmount)}, advance {fmtMoney(booking.advanceReceived)}, balance {fmtMoney((booking.totalAmount || 0) - (booking.advanceReceived || 0))}.
            </DialogDescription>
          </DialogHeader>

          {conflict && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Not feasible — driver or vehicle unavailable</AlertTitle>
              <AlertDescription>
                <div className="space-y-1 text-xs mt-1">
                  {conflict.vehicle?.map((c: any) => <div key={c.id}>Vehicle conflict: {c.bookingId} ({c.customerName}, {c.status})</div>)}
                  {conflict.driverBookings?.map((c: any) => <div key={c.id}>Driver conflict: {c.bookingId} ({c.customerName}, {c.status})</div>)}
                  {conflict.driverLeave?.map((c: any, i: number) => <div key={i}>Driver on leave: {toDateInputValue(c.startDate)} – {toDateInputValue(c.endDate)}</div>)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Checkbox id="override" checked={override} onCheckedChange={(v) => setOverride(!!v)} />
                  <Label htmlFor="override" className="text-xs">Override and extend anyway (manager decision)</Label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>New Return Date</Label>
              <Input type="date" value={newReturnDate} onChange={(e) => setNewReturnDate(e.target.value)} />
            </div>
            <div>
              <Label>New Return Time</Label>
              <Input type="time" value={newReturnTime} onChange={(e) => setNewReturnTime(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Added Destinations (comma separated)</Label>
              <Input placeholder="e.g. Maheshwar" value={destinations} onChange={(e) => setDestinations(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Reason</Label>
              <Textarea placeholder="Why is this booking being extended?" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2">Extension Pricing</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Additional Days (count)</Label>
                <Input type="number" min={0} value={charges.additionalDays} onChange={(e) => setCharge("additionalDays", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Additional Days Charge (₹)</Label>
                <Input type="number" min={0} value={charges.additionalDaysCharge} onChange={(e) => setCharge("additionalDaysCharge", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Extra KM Charge (₹)</Label>
                <Input type="number" min={0} value={charges.extraKmCharge} onChange={(e) => setCharge("extraKmCharge", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Driver Allowance (₹)</Label>
                <Input type="number" min={0} value={charges.driverAllowance} onChange={(e) => setCharge("driverAllowance", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Night Halt (₹)</Label>
                <Input type="number" min={0} value={charges.nightHalt} onChange={(e) => setCharge("nightHalt", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Route Charge (₹)</Label>
                <Input type="number" min={0} value={charges.routeCharge} onChange={(e) => setCharge("routeCharge", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Discount (₹)</Label>
                <Input type="number" min={0} value={charges.discount} onChange={(e) => setCharge("discount", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Extension Total</span><strong>{fmtMoney(extensionTotal)}</strong></div>
            <div className="flex justify-between"><span>Revised Booking Total</span><strong>{fmtMoney(revisedTotal)}</strong></div>
            <div className="flex justify-between"><span>Amount Already Received</span><span>{fmtMoney(booking.advanceReceived)}</span></div>
            <div className="flex justify-between text-red-600"><span>Revised Balance</span><strong>{fmtMoney(revisedBalance)}</strong></div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={extendMutation.isPending || !newReturnDate || (!!conflict && !override)}
              onClick={() => extendMutation.mutate(override)}
            >
              {extendMutation.isPending ? "Extending..." : conflict ? "Extend Anyway" : "Confirm Extension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
