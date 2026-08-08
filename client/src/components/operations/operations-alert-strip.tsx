// Persistent top operational alert strip + controlled popup + notification
// center (spec §4, §45-47).
//
// - Strip: compact one-liner ("3 bookings ending soon · 1 OVERDUE — View"),
//   with the single most critical alert detailed. Never covers the UI.
// - Popup: opens once per newly-seen URGENT/CRITICAL unacknowledged alert
//   (session-side seen-set); acknowledging persists server-side, so a page
//   refresh or another device never re-pops an acknowledged alert (§49).
// - Sheet: full notification center with acknowledge/snooze/contact log.
//
// State (ack/snooze/contact) always lives server-side on OperationsAlert.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertTriangle, Bell, Check, Clock3, PhoneCall, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface OperationsAlertRow {
  _id: string;
  kind: string;
  stageKey?: string;
  serviceMode: "self_drive" | "with_driver";
  priority: "info" | "attention" | "urgent" | "critical";
  title: string;
  body: string;
  status: "active" | "acknowledged" | "snoozed" | "resolved";
  createdAt: string;
  acknowledgedBy?: { userId: string; name?: string };
  contactLog?: { at: string; userName?: string; action: string; note?: string }[];
  whatsapp?: { target: string; status: string; error?: string }[];
  bookingId?: { _id: string; bookingId: string; customerName: string; customerPhone?: string } | string | null;
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, urgent: 1, attention: 2, info: 3 };

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-600 text-white",
  urgent: "bg-orange-500 text-white",
  attention: "bg-amber-400 text-amber-950",
  info: "bg-slate-200 text-slate-700",
};

function bookingOf(alert: OperationsAlertRow) {
  return alert.bookingId && typeof alert.bookingId === "object" ? alert.bookingId : null;
}

export default function OperationsAlertStrip({ onViewAll, onOpenBooking }: {
  onViewAll: () => void;
  onOpenBooking: (bookingId: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dismissedStrip, setDismissedStrip] = useState(false);
  const [popupAlert, setPopupAlert] = useState<OperationsAlertRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  const { data: alerts = [] } = useQuery<OperationsAlertRow[]>({
    queryKey: ["/api/operations/alerts?status=open"],
    refetchInterval: 30000,
  });

  const open = useMemo(
    () => alerts
      .filter((a) => a.status === "active" || a.status === "acknowledged")
      .sort((a, b) => (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || (b.createdAt > a.createdAt ? 1 : -1)),
    [alerts]
  );
  const unacked = open.filter((a) => a.status === "active");
  const top = open[0];

  // Controlled popup: only for a not-yet-seen, unacknowledged urgent+
  // alert; one at a time; never re-pops after acknowledge (server state).
  useEffect(() => {
    if (popupAlert) return;
    const candidate = unacked.find(
      (a) => (a.priority === "critical" || a.priority === "urgent") && !seenRef.current.has(a._id)
    );
    if (candidate) {
      seenRef.current.add(candidate._id);
      setPopupAlert(candidate);
    }
  }, [unacked, popupAlert]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/operations/alerts?status=open"] });

  const act = useMutation({
    mutationFn: async ({ id, action, payload }: { id: string; action: "acknowledge" | "snooze" | "contact"; payload?: any }) => {
      const res = await apiRequest("POST", `/api/operations/alerts/${id}/${action}`, payload || {});
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err: any) => toast({ title: "Alert action failed", description: err?.message, variant: "destructive" }),
  });

  if (open.length === 0) return null;

  const endingSoonCount = open.filter((a) => a.kind === "ending_soon" || a.kind === "return_due").length;
  const overdueCount = open.filter((a) => a.kind === "overdue").length;
  const paymentCount = open.filter((a) => a.kind === "payment_due").length;
  const parts: string[] = [];
  if (endingSoonCount) parts.push(`${endingSoonCount} ending soon`);
  if (overdueCount) parts.push(`${overdueCount} OVERDUE`);
  if (paymentCount) parts.push(`${paymentCount} payment due`);

  const topBooking = top ? bookingOf(top) : null;

  return (
    <>
      {!dismissedStrip && (
        <div
          data-testid="operations-alert-strip"
          className={`mb-4 rounded-lg border px-3 py-2 flex items-center gap-3 flex-wrap ${
            overdueCount > 0 ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"
          }`}
        >
          <AlertTriangle size={16} className={overdueCount > 0 ? "text-red-600 shrink-0" : "text-amber-600 shrink-0"} />
          <div className="text-sm min-w-0 flex-1">
            <span className="font-semibold">{parts.join(" · ") || `${open.length} operational alert${open.length > 1 ? "s" : ""}`}</span>
            {top && (top.priority === "critical" || top.priority === "urgent") && (
              <span className="text-gray-700"> — {top.title}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {topBooking && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => onOpenBooking(topBooking._id)}>Open</Button>
            )}
            <Button size="sm" variant="outline" className="h-7" onClick={onViewAll} data-testid="alert-strip-view">View</Button>
            <NotificationSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              alerts={open}
              onAck={(id) => act.mutate({ id, action: "acknowledge" })}
              onSnooze={(id) => act.mutate({ id, action: "snooze", payload: { minutes: 30 } })}
              onContact={(id, action) => act.mutate({ id, action: "contact", payload: { action } })}
              onOpenBooking={onOpenBooking}
            />
            <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => setDismissedStrip(true)} aria-label="Hide alert strip">
              <X size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Urgent-alert popup — deliberately NON-modal (spec §13/§47: never
          block all work). A fixed corner card the user can act on or
          ignore; acknowledged state persists server-side so it never
          re-pops after refresh or on another device. */}
      {popupAlert && (
        <div
          data-testid="operations-alert-popup"
          role="alertdialog"
          aria-label={popupAlert.title}
          className={`fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-96 rounded-lg border-2 bg-white shadow-xl p-4 space-y-2 ${
            popupAlert.priority === "critical" ? "border-red-400" : "border-orange-300"
          }`}
        >
          <div className="flex items-start gap-2">
            <Badge className={PRIORITY_BADGE[popupAlert.priority]}>{popupAlert.priority.toUpperCase()}</Badge>
            <span className="font-semibold text-sm text-gray-900 min-w-0">{popupAlert.title}</span>
            <button className="ml-auto text-gray-400 hover:text-gray-600" aria-label="Dismiss popup" onClick={() => setPopupAlert(null)}>
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-line">{popupAlert.body}</p>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {bookingOf(popupAlert)?.customerPhone && (
              <Button variant="outline" size="sm" asChild
                onClick={() => act.mutate({ id: popupAlert._id, action: "contact", payload: { action: "called_customer" } })}>
                <a href={`tel:${bookingOf(popupAlert)!.customerPhone}`}><PhoneCall size={14} className="mr-1" />Call</a>
              </Button>
            )}
            {bookingOf(popupAlert) && (
              <Button variant="outline" size="sm" onClick={() => { onOpenBooking(bookingOf(popupAlert)!._id); setPopupAlert(null); }}>
                Open Booking
              </Button>
            )}
            {popupAlert.priority !== "critical" && (
              <Button variant="outline" size="sm"
                onClick={() => { act.mutate({ id: popupAlert._id, action: "snooze", payload: { minutes: 30 } }); setPopupAlert(null); }}>
                <Clock3 size={14} className="mr-1" />Snooze 30m
              </Button>
            )}
            <Button size="sm" data-testid="popup-acknowledge"
              onClick={() => { act.mutate({ id: popupAlert._id, action: "acknowledge" }); setPopupAlert(null); }}>
              <Check size={14} className="mr-1" />Acknowledge
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function NotificationSheet({ open, onOpenChange, alerts, onAck, onSnooze, onContact, onOpenBooking }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  alerts: OperationsAlertRow[];
  onAck: (id: string) => void;
  onSnooze: (id: string) => void;
  onContact: (id: string, action: string) => void;
  onOpenBooking: (bookingId: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-7" data-testid="alert-center-trigger">
          <Bell size={13} className="mr-1" />{alerts.filter((a) => a.status === "active").length}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Operations Alerts</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          {alerts.length === 0 && <p className="text-sm text-gray-500">No open alerts.</p>}
          {alerts.map((a) => {
            const booking = bookingOf(a);
            return (
              <div key={a._id} className="rounded-lg border border-gray-200 p-3 space-y-1.5" data-testid={`alert-row-${a.kind}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={PRIORITY_BADGE[a.priority]}>{a.priority.toUpperCase()}</Badge>
                  {a.status === "acknowledged" && (
                    <Badge variant="outline" className="text-[10px]">
                      ACK{a.acknowledgedBy?.name ? ` · ${a.acknowledgedBy.name}` : ""}
                    </Badge>
                  )}
                  <span className="text-[11px] text-gray-400 ml-auto">{new Date(a.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                </div>
                <div className="text-sm font-medium text-gray-900">{a.title}</div>
                <div className="text-xs text-gray-600 whitespace-pre-line">{a.body}</div>
                {(a.whatsapp?.length || 0) > 0 && (
                  <div className="text-[11px] text-gray-500">
                    WhatsApp: {a.whatsapp!.map((w, i) => (
                      <span key={i} className={w.status === "FAILED" ? "text-red-600" : w.status === "SENT" ? "text-emerald-600" : ""}>
                        {w.target} {w.status}{w.error ? ` (${w.error})` : ""}{i < a.whatsapp!.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                )}
                {(a.contactLog?.length || 0) > 0 && (
                  <div className="text-[11px] text-gray-500 space-y-0.5">
                    {a.contactLog!.slice(-3).map((c, i) => (
                      <div key={i}>
                        {new Date(c.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} — {c.userName || "user"} — {c.action.replace(/_/g, " ")}{c.note ? `: ${c.note}` : ""}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {booking && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { onOpenBooking(booking._id); onOpenChange(false); }}>
                      Open {booking.bookingId}
                    </Button>
                  )}
                  {a.status === "active" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAck(a._id)}>Acknowledge</Button>
                  )}
                  {a.priority !== "critical" && a.status !== "snoozed" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSnooze(a._id)}>Snooze 30m</Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onContact(a._id, "called_customer")}>Called Customer</Button>
                  {a.serviceMode === "with_driver" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onContact(a._id, "called_driver")}>Called Driver</Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onContact(a._id, "extension_discussed")}>Extension Discussed</Button>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
