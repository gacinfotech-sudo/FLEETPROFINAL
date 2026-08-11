// Dashboard → Live Operations summary (spec §3): compact real-data counts
// plus at most 4 most-urgent live cards, then [View All]. Reads the same
// bounded /api/operations/live-vehicles the full page uses — no separate
// aggregation path to drift.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Radio, ArrowRight } from "lucide-react";
import { money, humanizeMinutes, type LiveVehicleCard } from "@/pages/live-operations";

const URGENCY: Record<string, number> = { OVERDUE: 0, RETURN_DUE: 1, ENDING_SOON: 2, END_TIME_PENDING: 3, RUNNING: 4 };

export default function LiveOperationsSummary({ onViewAll }: { onViewAll: () => void }) {
  const { data } = useQuery<{ summary: any; cards: LiveVehicleCard[] }>({
    queryKey: ["/api/operations/live-vehicles"],
    refetchInterval: 60000,
  });
  // Self-drive money KPIs (deposit held / refunds pending) — small bounded
  // aggregate, refreshed at the same cadence.
  const { data: sdKpis } = useQuery<{ refundPendingCount: number; refundPendingAmount: number; depositHeld: number; refundedToday: number }>({
    queryKey: ["/api/operations/self-drive/kpis"],
    refetchInterval: 60000,
  });

  const urgent = useMemo(() => {
    const cards = data?.cards ?? [];
    return [...cards]
      .sort((a, b) => (URGENCY[a.runtimeStatus] - URGENCY[b.runtimeStatus]) || ((a.timeRemainingMinutes ?? 1e9) - (b.timeRemainingMinutes ?? 1e9)))
      .slice(0, 4);
  }, [data]);

  const s = data?.summary ?? { vehiclesRunning: 0, selfDrive: 0, withDriver: 0, endingSoon: 0, overdue: 0, needsAttention: 0, balanceDue: 0 };
  if (s.vehiclesRunning === 0 && !(sdKpis && sdKpis.refundPendingCount > 0)) return null;

  return (
    <Card data-testid="dashboard-live-operations">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        {/* Titled "Vehicles on Booking", NOT "Live Operations" — the classic
            dashboard already has a "Live Operations" section (routes to
            live-bookings) and ui-shell-redesign.spec.ts asserts on that
            exact title; two cards with the same name would be ambiguous for
            users and tests alike. */}
        <CardTitle className="text-base flex items-center gap-2">
          <Radio size={16} className="text-emerald-600" /> Vehicles on Booking
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onViewAll} data-testid="live-ops-view-all">
          View All <ArrowRight size={14} className="ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center">
          {[
            { label: "Running", value: s.vehiclesRunning },
            { label: "Self Drive", value: s.selfDrive },
            { label: "With Driver", value: s.withDriver },
            { label: "Ending Soon", value: s.endingSoon, warn: s.endingSoon > 0 },
            { label: "Overdue", value: s.overdue, danger: s.overdue > 0 },
            { label: "Balance Due", value: money(s.balanceDue) },
            ...(sdKpis ? [
              { label: "Deposit Held", value: money(sdKpis.depositHeld) },
              { label: "Refunds Pending", value: sdKpis.refundPendingCount > 0 ? `${sdKpis.refundPendingCount} · ${money(sdKpis.refundPendingAmount)}` : "0", danger: sdKpis.refundPendingCount > 0 },
            ] : []),
          ].map((c: any) => (
            <div key={c.label} className={`rounded-md p-2 min-w-0 ${c.danger ? "bg-red-50" : c.warn ? "bg-amber-50" : "bg-gray-50"}`}>
              <div className={`text-base font-bold truncate ${c.danger ? "text-red-700" : c.warn ? "text-amber-700" : "text-gray-900"}`}>{c.value}</div>
              <div className="text-[10px] text-gray-500 leading-tight">{c.label}</div>
            </div>
          ))}
        </div>
        {urgent.length > 0 && (
          <div className="divide-y divide-gray-100">
            {urgent.map((c) => (
              <div key={c.id} className="py-2 flex items-center gap-2 text-sm flex-wrap">
                <Badge variant="outline" className={
                  c.runtimeStatus === "OVERDUE" ? "bg-red-100 text-red-800 border-red-200" :
                  c.runtimeStatus === "RETURN_DUE" || c.runtimeStatus === "ENDING_SOON" ? "bg-amber-100 text-amber-800 border-amber-200" :
                  "bg-gray-100 text-gray-700"
                }>
                  {c.runtimeStatus.replace(/_/g, " ")}
                </Badge>
                <span className="font-medium">{c.vehicle ? [c.vehicle.make, c.vehicle.model].filter(Boolean).join(" ") : c.vendorVehicle}</span>
                <span className="text-gray-500">· {c.customerName} · {c.serviceMode === "self_drive" ? "Self Drive" : "With Driver"}</span>
                <span className="ml-auto text-gray-600">
                  {c.endTimePending ? "END TIME PENDING" :
                    c.timeRemainingMinutes !== null && c.timeRemainingMinutes < 0
                      ? `late ${humanizeMinutes(c.timeRemainingMinutes)}`
                      : c.timeRemainingMinutes !== null ? `${humanizeMinutes(c.timeRemainingMinutes)} left` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
