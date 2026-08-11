// The ONE date-certainty editor. Used in two shells — the Unified Booking
// Workspace's Schedule section, and the compact "Set Date" dialog opened
// straight from a Booking Queue row — but there is exactly one form, one
// save path, one set of rules. Saving goes through the canonical
// PUT /api/bookings/:id (which revalidates driver/vehicle availability on
// any schedule change) or, when an already-confirmed date is being moved,
// POST /api/bookings/:id/reschedule so rescheduleHistory is preserved.
//
// It never invents a date: 'not_decided' stays a first-class state and a
// range stays a range (§5/§7 — "Do not force today's date into an
// unknown-date booking").

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { invalidateBookingViews, resolveTravelDateStatus, deriveAllocation } from "@/lib/booking-state";

function toDateInput(d?: string | Date | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface ScheduleEditorProps {
  booking: any;
  /** compact = the quick Set Date dialog; full also edits return date/time */
  compact?: boolean;
  onSaved?: () => void;
}

export function ScheduleEditor({ booking, compact, onSaved }: ScheduleEditorProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bookingId = booking._id || booking.id;

  const currentStatus = resolveTravelDateStatus(booking);
  const [dateStatus, setDateStatus] = useState<"confirmed" | "range" | "not_decided">(currentStatus);
  const [pickupDate, setPickupDate] = useState(toDateInput(booking.pickupDate));
  const [pickupTime, setPickupTime] = useState(booking.pickupTime || "");
  const [returnDate, setReturnDate] = useState(toDateInput(booking.returnDate));
  const [returnTime, setReturnTime] = useState(booking.returnTime || "");
  const [rangeStart, setRangeStart] = useState(toDateInput(booking.tentativeStartDate));
  const [rangeEnd, setRangeEnd] = useState(toDateInput(booking.tentativeEndDate));
  const [conflicts, setConflicts] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const alloc = deriveAllocation(booking);
  const hadConfirmedDate = currentStatus === "confirmed" && !!booking.pickupDate;
  const isAdmin = user && ["admin", "client"].includes((user as any).role);

  const save = useMutation({
    mutationFn: async (opts: { override?: boolean } = {}) => {
      // Moving an existing confirmed date to another confirmed date is a
      // reschedule — history must be preserved (§60). Everything else
      // (setting a first date, switching certainty mode, editing a range)
      // is a canonical partial update.
      if (hadConfirmedDate && dateStatus === "confirmed") {
        const res = await apiRequest("POST", `/api/bookings/${bookingId}/reschedule`, {
          newPickupDate: pickupDate,
          newPickupTime: pickupTime || undefined,
          newReturnDate: returnDate || undefined,
          newReturnTime: returnTime || undefined,
          ...(opts.override ? { override: true, reason: overrideReason } : {}),
        });
        return res.json();
      }
      const body: any = { travelDateStatus: dateStatus };
      if (dateStatus === "confirmed") {
        body.pickupDate = pickupDate;
        if (pickupTime) body.pickupTime = pickupTime;
        if (returnDate) body.returnDate = returnDate;
        if (returnTime) body.returnTime = returnTime;
      } else if (dateStatus === "range") {
        body.tentativeStartDate = rangeStart;
        body.tentativeEndDate = rangeEnd;
      }
      if (opts.override) {
        body.override = true;
        body.overrideReason = overrideReason;
      }
      const res = await apiRequest("PUT", `/api/bookings/${bookingId}`, body);
      return res.json();
    },
    onSuccess: (updated: any) => {
      setConflicts(null);
      invalidateBookingViews(queryClient, { customerId: updated?.customerId ? String(updated.customerId) : undefined });
      toast({ title: dateStatus === "confirmed" ? "Travel date set" : "Schedule updated" });
      onSaved?.();
    },
    onError: async (err: any) => {
      // apiRequest throws with the response text; availability conflicts
      // come back as 409 AVAILABILITY_CONFLICT with details (§49).
      const message = err?.message || "Failed to save schedule";
      // apiRequest throws `Error("<status>: <body text>")` — a 409 here is
      // an availability/safety conflict payload from the canonical PUT or
      // reschedule route.
      if (message.startsWith("409:") || message.includes("AVAILABILITY_CONFLICT")) {
        setConflicts({ message });
      } else {
        toast({ title: "Could not save schedule", description: message, variant: "destructive" });
      }
    },
  });

  const valid =
    dateStatus === "not_decided" ||
    (dateStatus === "confirmed" && !!pickupDate) ||
    (dateStatus === "range" && !!rangeStart && !!rangeEnd && rangeEnd >= rangeStart);

  return (
    <div className="space-y-4">
      <RadioGroup value={dateStatus} onValueChange={(v) => setDateStatus(v as any)} className="flex flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="confirmed" id="ds-confirmed" />
          <Label htmlFor="ds-confirmed">Confirmed date</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="range" id="ds-range" />
          <Label htmlFor="ds-range">Date range (tentative)</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="not_decided" id="ds-nd" />
          <Label htmlFor="ds-nd">Not decided yet</Label>
        </div>
      </RadioGroup>

      {dateStatus === "confirmed" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="se-pickup-date">Travel Date</Label>
            <Input id="se-pickup-date" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="se-pickup-time">Pickup Time</Label>
            <Input id="se-pickup-time" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
          </div>
          {!compact && (
            <>
              <div>
                <Label htmlFor="se-return-date">Return Date</Label>
                <Input id="se-return-date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="se-return-time">Return Time</Label>
                <Input id="se-return-time" type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
              </div>
            </>
          )}
        </div>
      )}

      {dateStatus === "range" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="se-range-start">From</Label>
            <Input id="se-range-start" type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="se-range-end">To</Label>
            <Input id="se-range-end" type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </div>
        </div>
      )}

      {dateStatus === "not_decided" && (
        <p className="text-sm text-gray-500">
          Booking stays valid with no date. It will appear in the Date Pending queue until a date is chosen.
        </p>
      )}

      {conflicts && (
        <Alert variant="destructive">
          <AlertTitle>Assigned resources are not available on the new date</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-sm">
              {alloc.driverAssigned || alloc.vehicleAssigned
                ? "The currently assigned driver/vehicle conflicts with this schedule. Change the allocation, or (admin) override with a reason."
                : conflicts.message}
            </p>
            {isAdmin && (
              <div className="space-y-2">
                <Input
                  placeholder="Override reason (required)"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!overrideReason.trim() || save.isPending}
                  onClick={() => save.mutate({ override: true })}
                >
                  Override and Save
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button disabled={!valid || save.isPending} onClick={() => save.mutate({})}>
          {save.isPending ? "Saving..." : "Save Schedule"}
        </Button>
      </div>
    </div>
  );
}

/** Compact Set Date dialog — the queue row's [Set Date] action (§5-§6). */
export function SetDateDialog({ booking, open, onOpenChange }: {
  booking: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!booking) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Travel Date — {booking.bookingId}</DialogTitle>
        </DialogHeader>
        <ScheduleEditor booking={booking} compact onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
