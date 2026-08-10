// Self Drive operations hub (spec §12, §30-§31): Active / Upcoming /
// Overdue / Returned / Refund Pending / Refund Completed, with the refund
// queue as a real operational table (SLA-aged, filterable) — every row is
// canonical Booking + SelfDriveTrip data, actions open canonical flows.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, MessageCircle, IndianRupee, Download, Car } from "lucide-react";
import { useBookingWorkspace } from "@/components/booking/booking-workspace-context";
import ProcessRefundDialog from "@/components/self-drive/process-refund-dialog";
import type { LiveVehicleCard } from "@/pages/live-operations";

const money = (n?: number | null) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

const SLA_BADGE: Record<string, string> = {
  normal: "bg-gray-100 text-gray-700",
  attention: "bg-amber-100 text-amber-800",
  urgent: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

type SdTab = "active" | "upcoming" | "overdue" | "returned" | "refund_pending" | "refund_completed" | "reports";

const TABS: { key: SdTab; label: string }[] = [
  { key: "active", label: "Active Self Drive" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue Returns" },
  { key: "returned", label: "Returned" },
  { key: "refund_pending", label: "Refund Pending" },
  { key: "refund_completed", label: "Refund Completed" },
  { key: "reports", label: "Reports" },
];

function agoLabel(hours: number): string {
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  if (hours >= 1) return `${Math.floor(hours)}h`;
  return `${Math.round(hours * 60)} min`;
}

export default function SelfDrivePage() {
  const { openBooking } = useBookingWorkspace();
  const [tab, setTab] = useState<SdTab>("active");
  const [search, setSearch] = useState("");
  const [refunding, setRefunding] = useState<{ bookingId: string; bookingCode?: string | null; customerName?: string | null } | null>(null);

  const { data: live } = useQuery<{ cards: LiveVehicleCard[] }>({
    queryKey: ["/api/operations/live-vehicles"],
    refetchInterval: 30000,
  });
  const { data: openRefunds } = useQuery<{ rows: any[] }>({
    queryKey: ["/api/operations/self-drive/refunds?status=open"],
    refetchInterval: 30000,
  });
  const { data: closedRefunds } = useQuery<{ rows: any[] }>({
    queryKey: ["/api/operations/self-drive/refunds?status=closed"],
    enabled: tab === "refund_completed" || tab === "returned",
  });
  const { data: upcoming } = useQuery<any>({
    queryKey: ["/api/operations/live-bookings?startingWindow=tomorrow&endingWindow=today"],
    enabled: tab === "upcoming",
  });
  const [reportDays, setReportDays] = useState(30);
  const { data: report } = useQuery<any>({
    queryKey: [`/api/operations/self-drive/report?days=${reportDays}`],
    enabled: tab === "reports",
  });

  const sdCards = useMemo(() => (live?.cards ?? []).filter((c) => c.serviceMode === "self_drive"), [live]);

  const matches = (hay: (string | null | undefined)[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return hay.some((h) => (h || "").toLowerCase().includes(q));
  };

  const kpi = {
    active: sdCards.length,
    overdue: sdCards.filter((c) => c.runtimeStatus === "OVERDUE").length,
    refundPending: openRefunds?.rows?.length ?? 0,
    refundPendingAmount: (openRefunds?.rows ?? []).reduce((s, r) => s + (r.balance || 0), 0),
  };

  const exportCsv = (rows: any[], name: string) => {
    const header = ["Customer", "Phone", "Booking", "Vehicle", "Returned", "Deposit", "Deductions", "Refundable", "Refunded", "Balance", "PendingSince", "Status"];
    const lines = rows.map((r) => [
      r.customerName, r.customerPhone, r.bookingCode,
      r.vehicle ? `${r.vehicle.make || ""} ${r.vehicle.registrationNumber || ""}`.trim() : "",
      r.returnedAt ? new Date(r.returnedAt).toLocaleString("en-IN") : "",
      r.depositAmount, r.totalDeduction, r.refundable, r.refunded, r.balance,
      new Date(r.pendingSince).toLocaleString("en-IN"), r.refundStatus,
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const refundRows = (rows: any[] | undefined) => (rows ?? []).filter((r) => matches([r.customerName, r.customerPhone, r.bookingCode, r.vehicle?.registrationNumber]));

  const liveRows = (filter: (c: LiveVehicleCard) => boolean) =>
    sdCards.filter(filter).filter((c) => matches([c.customerName, c.customerPhone, c.bookingCode, c.vehicle?.registrationNumber]));

  const renderLiveTable = (rows: LiveVehicleCard[]) => (
    rows.length === 0 ? <Empty /> : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking</TableHead><TableHead>Customer</TableHead><TableHead>Vehicle</TableHead>
              <TableHead>Expected Return</TableHead><TableHead>Deposit</TableHead><TableHead>Balance</TableHead>
              <TableHead>Status</TableHead><TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openBooking(c.id)}>
                <TableCell className="font-mono text-xs text-blue-700">{c.bookingCode}</TableCell>
                <TableCell>{c.customerName}<span className="block text-xs text-gray-500">{c.customerPhone}</span></TableCell>
                <TableCell className="text-sm">{c.vehicle ? `${c.vehicle.make || ""} ${c.vehicle.registrationNumber || ""}` : "—"}</TableCell>
                <TableCell className="text-sm">{c.endAtLocal}
                  {c.timeRemainingMinutes !== null && c.timeRemainingMinutes < 0 && (
                    <span className="block text-xs text-red-700 font-medium">late {Math.abs(Math.round(c.timeRemainingMinutes / 60 * 10) / 10)}h</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{c.securityDepositAmount !== null ? money(c.securityDepositAmount) : "—"}</TableCell>
                <TableCell className={`text-sm ${c.balance > 0 ? "text-red-700 font-medium" : "text-emerald-700"}`}>{money(c.balance)}</TableCell>
                <TableCell><Badge variant="outline" className={c.runtimeStatus === "OVERDUE" ? "bg-red-100 text-red-800 border-red-200" : ""}>{c.runtimeStatus.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <a href={`tel:${c.customerPhone}`}><Button size="icon" variant="ghost" className="h-7 w-7"><Phone size={13} /></Button></a>
                    <a href={`https://wa.me/${(c.customerPhone || "").replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}`} target="_blank" rel="noreferrer"><Button size="icon" variant="ghost" className="h-7 w-7"><MessageCircle size={13} /></Button></a>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => openBooking(c.id)}>Open</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  const renderRefundTable = (rows: any[], showActions: boolean) => (
    rows.length === 0 ? <Empty /> : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead><TableHead>Booking</TableHead><TableHead>Vehicle</TableHead>
              <TableHead>Return</TableHead><TableHead>Deposit</TableHead><TableHead>Deduction</TableHead>
              <TableHead>Refundable</TableHead><TableHead>Refunded</TableHead><TableHead>Balance</TableHead>
              <TableHead>Pending</TableHead><TableHead>Status</TableHead>
              {showActions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.bookingId} data-testid={`refund-row-${r.bookingCode}`}>
                <TableCell>{r.customerName}<span className="block text-xs text-gray-500">{r.customerPhone}</span></TableCell>
                <TableCell className="font-mono text-xs"><button className="text-blue-700 hover:underline" onClick={() => openBooking(r.bookingId)}>{r.bookingCode}</button></TableCell>
                <TableCell className="text-sm">{r.vehicle ? `${r.vehicle.make || ""} ${r.vehicle.registrationNumber || ""}` : "—"}</TableCell>
                <TableCell className="text-sm">{r.returnedAt ? new Date(r.returnedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</TableCell>
                <TableCell>{money(r.depositAmount)}</TableCell>
                <TableCell className="text-red-700">{money(r.totalDeduction)}</TableCell>
                <TableCell>{money(r.refundable)}</TableCell>
                <TableCell className="text-emerald-700">{money(r.refunded)}</TableCell>
                <TableCell className="font-semibold">{money(r.balance)}</TableCell>
                <TableCell>
                  <Badge className={SLA_BADGE[r.slaLevel] || SLA_BADGE.normal} data-testid={`sla-${r.bookingCode}`}>{agoLabel(r.hoursPending)}</Badge>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{r.refundStatus.replace(/_/g, " ")}</Badge></TableCell>
                {showActions && (
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" className="h-7" onClick={() => setRefunding({ bookingId: r.bookingId, bookingCode: r.bookingCode, customerName: r.customerName })} data-testid={`process-refund-${r.bookingCode}`}>
                        <IndianRupee size={12} className="mr-0.5" />Refund
                      </Button>
                      <a href={`tel:${r.customerPhone}`}><Button size="icon" variant="ghost" className="h-7 w-7"><Phone size={13} /></Button></a>
                      <a href={`https://wa.me/${(r.customerPhone || "").replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}`} target="_blank" rel="noreferrer"><Button size="icon" variant="ghost" className="h-7 w-7"><MessageCircle size={13} /></Button></a>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => openBooking(r.bookingId)}>Open</Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  const upcomingRows = ((upcoming?.startingSoon ?? []) as any[])
    .filter((b) => b.bookingType === "self_drive")
    .filter((b) => matches([b.customerName, b.customerPhone, b.bookingId]));

  return (
    <div data-testid="self-drive-page" className="space-y-6">
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">🚗 Self Drive</h1>
        <p className="text-orange-100 mt-1">Active vehicles • Overdue returns • Security deposit refunds</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Input placeholder="Search customer / phone / booking / vehicle…" className="sm:w-80" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="sd-search" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active", value: kpi.active, tab: "active" as SdTab },
          { label: "Overdue", value: kpi.overdue, tab: "overdue" as SdTab, danger: kpi.overdue > 0 },
          { label: "Refunds Pending", value: kpi.refundPending, tab: "refund_pending" as SdTab, danger: kpi.refundPending > 0 },
          { label: "Refund Amount Due", value: money(kpi.refundPendingAmount), tab: "refund_pending" as SdTab },
        ].map((c: any) => (
          <button key={c.label} onClick={() => setTab(c.tab)} className={`rounded-lg border p-2.5 text-left ${c.danger ? "border-red-200 bg-red-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
            <div className={`text-lg font-bold truncate ${c.danger ? "text-red-700" : "text-gray-900"}`}>{c.value}</div>
            <div className="text-[11px] text-gray-500">{c.label}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as SdTab)}>
          <TabsList className="flex flex-wrap h-auto justify-start">
            {TABS.map((t) => <TabsTrigger key={t.key} value={t.key} data-testid={`sd-tab-${t.key}`}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        {(tab === "refund_pending" || tab === "refund_completed") && (
          <Button size="sm" variant="outline" onClick={() => exportCsv(tab === "refund_pending" ? refundRows(openRefunds?.rows) : refundRows(closedRefunds?.rows), `self-drive-refunds-${tab}`)}>
            <Download size={14} className="mr-1" />CSV
          </Button>
        )}
      </div>

      <Card><CardContent className="p-3 sm:p-4">
        {tab === "active" && renderLiveTable(liveRows((c) => c.runtimeStatus !== "OVERDUE"))}
        {tab === "overdue" && renderLiveTable(liveRows((c) => c.runtimeStatus === "OVERDUE"))}
        {tab === "upcoming" && (
          upcomingRows.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Customer</TableHead><TableHead>Pickup</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {upcomingRows.map((b: any) => (
                    <TableRow key={b.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openBooking(b.id)}>
                      <TableCell className="font-mono text-xs text-blue-700">{b.bookingId}</TableCell>
                      <TableCell>{b.customerName}</TableCell>
                      <TableCell className="text-sm">{b.pickupDate ? new Date(b.pickupDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"} {b.pickupTime || ""}</TableCell>
                      <TableCell><Badge variant="outline">{b.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="outline" className="h-7" onClick={(e) => { e.stopPropagation(); openBooking(b.id); }}>Open</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
        {tab === "reports" && (
          <div className="space-y-4" data-testid="sd-reports">
            <div className="flex items-center gap-2">
              {[7, 30, 90].map((d) => (
                <Button key={d} size="sm" variant={reportDays === d ? "default" : "outline"} onClick={() => setReportDays(d)}>Last {d} days</Button>
              ))}
              {report && (
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => {
                  const rows = [
                    ["Metric", "Value"],
                    ["Period (days)", report.periodDays], ["Bookings", report.bookings], ["Revenue", report.revenue],
                    ["Received", report.received], ["Extension Revenue", report.extensionRevenue],
                    ["Deposits Collected", report.depositsCollected], ["Late Charges", report.lateCharges],
                    ["Refunds Completed", report.refundsCompleted], ["Refunded Amount", report.refundsCompletedAmount],
                    ["Returns Completed", report.returnsCompleted],
                    ...Object.entries(report.deductionsByKind || {}).map(([k, v]) => [`Deduction: ${k}`, v]),
                  ].map((r) => r.join(",")).join("\n");
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
                  a.download = `self-drive-report-${reportDays}d.csv`;
                  a.click(); URL.revokeObjectURL(a.href);
                }}><Download size={14} className="mr-1" />CSV</Button>
              )}
            </div>
            {report ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    ["Bookings", report.bookings], ["Revenue", money(report.revenue)], ["Extension Revenue", money(report.extensionRevenue)],
                    ["Deposits Collected", money(report.depositsCollected)], ["Late Charges", money(report.lateCharges)],
                    ["Returns Completed", report.returnsCompleted], ["Refunds Completed", report.refundsCompleted],
                    ["Refunded Amount", money(report.refundsCompletedAmount)], ["Received", money(report.received)],
                  ].map(([label, value]: any) => (
                    <div key={label} className="rounded-lg border border-gray-200 p-2.5">
                      <div className="text-base font-bold truncate">{value}</div>
                      <div className="text-[11px] text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
                {Object.keys(report.deductionsByKind || {}).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-1.5">Deductions by type</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(report.deductionsByKind).map(([k, v]: any) => (
                        <Badge key={k} variant="outline" className="capitalize">{k}: {money(v)}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <Empty />}
          </div>
        )}
        {tab === "returned" && renderRefundTable(refundRows([...(openRefunds?.rows ?? []), ...(closedRefunds?.rows ?? [])]), true)}
        {tab === "refund_pending" && renderRefundTable(refundRows(openRefunds?.rows), true)}
        {tab === "refund_completed" && renderRefundTable(refundRows(closedRefunds?.rows), false)}
      </CardContent></Card>

      {refunding && (
        <ProcessRefundDialog
          bookingId={refunding.bookingId}
          bookingCode={refunding.bookingCode}
          customerName={refunding.customerName}
          onClose={() => setRefunding(null)}
          onDone={() => setRefunding(null)}
        />
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="text-center text-gray-500 py-10">
      <Car className="mx-auto mb-2 text-gray-300" size={36} />
      <p className="text-sm">Nothing here right now.</p>
    </div>
  );
}
