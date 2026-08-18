// Extend Booking — the ONE canonical extension flow (spec §28-32), used
// from Live Operations cards and alerts. Calls the existing
// POST /api/bookings/:id/extend, which snapshots pricing, revalidates
// availability server-side for the full extended window, appends to
// extensionHistory, and reschedules booking-end reminders.

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LiveVehicleCard } from "@/pages/live-operations";
import { money } from "@/pages/live-operations";

interface Conflict {
  bookingId: string;
  customerName: string;
  pickupDate?: string;
  pickupTime?: string;
  status: string;
}

export default function ExtendBookingDialog({ card, onClose, onDone }: {
  card: LiveVehicleCard;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const isSelfDrive = card.serviceMode === "self_drive";
  const currentEnd = card.endAt ? new Date(card.endAt) : null;

  const defaultDate = currentEnd ? currentEnd.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [newReturnDate, setNewReturnDate] = useState(defaultDate);
  const [newReturnTime, setNewReturnTime] = useState(
    currentEnd ? `${String(currentEnd.getHours()).padStart(2, "0")}:${String(currentEnd.getMinutes()).padStart(2, "0")}` : "18:00"
  );
  const [additionalCharge, setAdditionalCharge] = useState("");
  const [extraKmCharge, setExtraKmCharge] = useState("");
  const [driverAllowance, setDriverAllowance] = useState("");
  const [discount, setDiscount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<{ vehicle?: Conflict[]; driverBookings?: Conflict[]; driverLeave?: any[] } | null>(null);

  const extensionTotal =
    (Number(additionalCharge) || 0) + (Number(extraKmCharge) || 0) + (Number(driverAllowance) || 0) - (Number(discount) || 0);

  const submit = async () => {
    if (!newReturnDate) return;
    setSubmitting(true);
    setConflicts(null);
    try {
      await apiRequest("POST", `/api/bookings/${card.id}/extend`, {
        newReturnDate,
        newReturnTime,
        reason: reason || undefined,
        charges: {
          additionalDaysCharge: Number(additionalCharge) || 0,
          extraKmCharge: Number(extraKmCharge) || 0,
          driverAllowance: Number(driverAllowance) || 0,
          discount: Number(discount) || 0,
        },
      });
      toast({ title: "Booking extended", description: `${card.bookingCode} → ${newReturnDate} ${newReturnTime}` });
      onDone();
    } catch (err: any) {
      // apiRequest throws Error("<status>: <rawBody>") on any non-2xx — it
      // never returns the Response for inspection, so the 409 availability
      // conflict has to be recovered by parsing the message (same recovery
      // as the workspace's extend dialog).
      const match = /^(\d+):\s*([\s\S]*)$/.exec(err?.message || "");
      if (match && Number(match[1]) === 409) {
        let body: any = null;
        try { body = JSON.parse(match[2]); } catch { /* not JSON */ }
        if (body?.code === "AVAILABILITY_CONFLICT") {
          setConflicts(body.conflicts || {});
          return;
        }
      }
      toast({ title: "Extension failed", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const conflictRows: Conflict[] = [...(conflicts?.vehicle || []), ...(conflicts?.driverBookings || [])];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extend {card.bookingCode}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600 bg-gray-50 rounded-md p-2.5">
            <div><span className="text-gray-500">Current end:</span> <span className="font-medium">{card.endAtLocal}</span></div>
            <div><span className="text-gray-500">Customer:</span> {card.customerName} · <span className="text-gray-500">Total:</span> {money(card.totalAmount)} · <span className="text-gray-500">Balance:</span> {money(card.balance)}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ext-date">New End Date*</Label>
              <Input id="ext-date" type="date" value={newReturnDate} onChange={(e) => setNewReturnDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-time">New End Time</Label>
              <Input id="ext-time" type="time" value={newReturnTime} onChange={(e) => setNewReturnTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-charge">Additional Fare (₹)</Label>
              <Input id="ext-charge" type="number" min="0" value={additionalCharge} onChange={(e) => setAdditionalCharge(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-km">Extra KM Charge (₹)</Label>
              <Input id="ext-km" type="number" min="0" value={extraKmCharge} onChange={(e) => setExtraKmCharge(e.target.value)} placeholder="0" />
            </div>
            {!isSelfDrive && (
              <div className="space-y-1.5">
                <Label htmlFor="ext-da">Driver Allowance (₹)</Label>
                <Input id="ext-da" type="number" min="0" value={driverAllowance} onChange={(e) => setDriverAllowance(e.target.value)} placeholder="0" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ext-disc">Discount (₹)</Label>
              <Input id="ext-disc" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ext-reason">Reason / Notes</Label>
            <Textarea id="ext-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer requested 3 more hours…" className="min-h-[60px]" />
          </div>

          <div className="text-sm bg-blue-50 text-blue-900 rounded-md p-2.5">
            Extension amount: <span className="font-semibold">{money(Math.max(0, extensionTotal))}</span>
            {" · "}Revised total: <span className="font-semibold">{money(card.totalAmount + Math.max(0, extensionTotal))}</span>
          </div>

          {conflicts && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2" data-testid="extension-conflict">
              <div className="flex items-center gap-2 font-semibold text-red-800">
                <AlertTriangle size={16} /> EXTENSION NOT CURRENTLY AVAILABLE
              </div>
              {conflictRows.map((c, i) => (
                <div key={i} className="text-sm text-red-800">
                  Next booking: <span className="font-medium">{c.bookingId}</span> ({c.customerName})
                  {c.pickupDate && <> — {new Date(c.pickupDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{c.pickupTime ? ` ${c.pickupTime}` : ""}</>}
                </div>
              ))}
              {(conflicts.driverLeave?.length || 0) > 0 && (
                <div className="text-sm text-red-800">Driver has approved leave in the extended window.</div>
              )}
              <div className="text-xs text-red-700">
                Options: choose a shorter extension, keep the current end, or open the next booking to move it to another vehicle. The next booking is never changed silently.
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Keep Current End</Button>
            <Button onClick={submit} disabled={submitting || !newReturnDate} data-testid="confirm-extension">
              {submitting ? "Checking availability…" : "Confirm Extension"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
