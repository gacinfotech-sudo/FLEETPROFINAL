import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CalendarClock, Wallet, Radio } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtMoney(n?: number) {
  if (!n) return "₹0";
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function DailyOperationsPopup() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  // Guards against React re-render/navigation re-opening this — the
  // localStorage check only ever runs once per mount, not on every render.
  const checked = useRef(false);

  const storageKey = user ? `fleetpro_daily_popup_dismissed_${user.userId}_${todayKey()}` : null;

  useEffect(() => {
    if (checked.current || !user || !storageKey) return;
    checked.current = true;
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) {
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Only fetch the summary once we've actually decided to show the popup
  // — no reason to hit the API on every dashboard load for a user who
  // already dismissed it today.
  const summaryQuery = useQuery({
    queryKey: ["/api/operations/daily-summary"],
    enabled: open,
  });

  const dismissForToday = () => {
    if (storageKey) localStorage.setItem(storageKey, "1");
    setOpen(false);
  };

  const data: any = summaryQuery.data || {};
  const counts = data.counts || {};

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismissForToday(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Today's Operations</DialogTitle>
          <DialogDescription>
            {data.date ? new Date(data.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{counts.today ?? "-"}</div>
              <div className="text-xs text-gray-600">Today</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-700">{counts.tomorrow ?? "-"}</div>
              <div className="text-xs text-gray-600">Tomorrow</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-700">{counts.dayAfterTomorrow ?? "-"}</div>
              <div className="text-xs text-gray-600">Day After</div>
            </div>
          </div>

          {data.earliestPickup && (
            <div className="text-sm text-gray-700 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-blue-600" />
              Earliest pickup today: <strong>{data.earliestPickup.pickupTime}</strong> — {data.earliestPickup.customerName}
            </div>
          )}

          <div className="space-y-2">
            {counts.startDue > 0 && (
              <div className="flex items-center justify-between text-sm p-2 bg-amber-50 rounded">
                <span className="flex items-center gap-2"><Radio className="w-4 h-4 text-amber-600" />Trips due to start now</span>
                <Badge variant="secondary">{counts.startDue}</Badge>
              </div>
            )}
            {counts.startDelayed > 0 && (
              <div className="flex items-center justify-between text-sm p-2 bg-red-50 rounded">
                <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" />Trips delayed to start</span>
                <Badge variant="destructive">{counts.startDelayed}</Badge>
              </div>
            )}
            {counts.unassigned > 0 && (
              <div className="flex items-center justify-between text-sm p-2 bg-amber-50 rounded">
                <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" />Bookings missing driver/vehicle</span>
                <Badge variant="secondary">{counts.unassigned}</Badge>
              </div>
            )}
            {counts.paymentDues > 0 && (
              <div className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="flex items-center gap-2"><Wallet className="w-4 h-4 text-gray-600" />Payment collection due</span>
                <Badge variant="outline">{counts.paymentDues} bookings · {fmtMoney(counts.totalDueAmount)}</Badge>
              </div>
            )}
            {!counts.startDue && !counts.startDelayed && !counts.unassigned && !counts.paymentDues && (
              <p className="text-sm text-gray-500 text-center py-2">Nothing needs immediate attention. Good morning!</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={dismissForToday} className="w-full sm:w-auto">
            Dismiss for Today
          </Button>
          <Button
            onClick={() => { dismissForToday(); setLocation("/dashboard/live-bookings"); }}
            className="w-full sm:w-auto"
          >
            View All Operations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
