import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle, CalendarDays, CalendarOff, ChevronLeft, ChevronRight, ClipboardList, Plus, UserCheck, Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import TodayOnLeaveStrip from "@/components/drivers/leave/today-on-leave-strip";
import {
  DAY_PART_LABEL, LEAVE_STATUS_STYLE, LEAVE_TYPE_LABEL, LeaveRecord,
  atMidnight, dayKey, driverOf, fmtDate, fmtDateShort, fmtRange, initialsOf, leavesOnDay,
} from "@/components/drivers/leave/leave-domain";

type CalendarView = "month" | "week" | "list";

function todayStr(): string {
  return dayKey(new Date());
}

async function parseApiError(err: any) {
  const match = /^(\d+):\s*([\s\S]*)$/.exec(err.message || "");
  if (match) {
    try {
      const body = JSON.parse(match[2]);
      return { status: Number(match[1]), body };
    } catch { /* fall through */ }
  }
  return { status: 0, body: null };
}

const EMPTY_FORM = {
  driverId: "", startDate: "", endDate: "", leaveType: "unpaid",
  dayPart: "full", reason: "",
};

// Compact KPI tile — intentionally smaller than the Dashboard's KpiCard
// (this is a section header row, not the landing page hero).
function LeaveKpi({ icon: Icon, label, value, tone, testId }: {
  icon: any; label: string; value: number | string; tone: string; testId: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3.5 flex items-center gap-3" data-testid={testId}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold text-gray-900 leading-tight">{value}</div>
          <div className="text-xs text-gray-500 truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DriverLeavePage({ onOpenDriver }: { onOpenDriver?: (driver: any) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ----- calendar state -----
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState<Date>(atMidnight(new Date()));
  const [dayDetail, setDayDetail] = useState<Date | null>(null);

  // ----- filters -----
  const [search, setSearch] = useState("");
  const [filterDriver, setFilterDriver] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // ----- dialogs -----
  const [formOpen, setFormOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRecord | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [detailLeave, setDetailLeave] = useState<LeaveRecord | null>(null);
  const [conflict, setConflict] = useState<{ leave?: LeaveRecord; conflicts: any[]; mode: "approve" | "edit" } | null>(null);
  const [override, setOverride] = useState(false);

  // ----- data (single canonical sources) -----
  const driversQuery = useQuery({ queryKey: ["/api/drivers"] });
  const leavesQuery = useQuery({ queryKey: ["/api/driver-leaves"] });
  const dailyQuery = useQuery({ queryKey: [`/api/attendance/daily?date=${todayStr()}`] });

  const drivers: any[] = (driversQuery.data as any[]) || [];
  const allLeaves: LeaveRecord[] = (leavesQuery.data as LeaveRecord[]) || [];
  const daily: any[] = (dailyQuery.data as any)?.drivers || [];

  const invalidateLeaveViews = () => {
    // Leave feeds the calendar, Today-on-Leave, attendance derivation,
    // Driver 360 and the booking resource selector's availability checks —
    // invalidate them all so no view needs a manual refresh.
    queryClient.invalidateQueries({ queryKey: ["/api/driver-leaves"] });
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] || "").startsWith("/api/attendance/daily"),
    });
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] || "").includes("availability"),
    });
  };

  // ----- derived -----
  const today = atMidnight(new Date());

  const filteredLeaves = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allLeaves.filter((l) => {
      const d = driverOf(l);
      if (filterDriver !== "all" && d.id !== filterDriver) return false;
      if (filterType !== "all" && l.leaveType !== filterType) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (term && !(d.name.toLowerCase().includes(term) || (d.phone || "").includes(term))) return false;
      return true;
    });
  }, [allLeaves, search, filterDriver, filterType, filterStatus]);

  const todayOnLeave = leavesOnDay(allLeaves, today, ["approved"]);
  const upcoming = useMemo(() =>
    allLeaves
      .filter((l) => (l.status === "approved" || l.status === "pending") && atMidnight(new Date(l.startDate)) > today)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
  [allLeaves]);
  const pendingCount = allLeaves.filter((l) => l.status === "pending").length;
  // A driver counts as available today unless on leave or marked absent —
  // unmarked ("not_scheduled") drivers are still assignable.
  const availableToday = daily.filter((d) => !d.onLeave && d.status !== "absent").length;
  const onDutyToday = daily.filter((d) => d.status === "on_duty").length;

  // ----- mutations -----
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        startDate: form.startDate, endDate: form.endDate, leaveType: form.leaveType,
        dayPart: form.dayPart, reason: form.reason,
      };
      const res = editingLeave
        ? await apiRequest("PATCH", `/api/driver-leaves/${editingLeave._id}`, payload)
        : await apiRequest("POST", `/api/drivers/${form.driverId}/leave`, payload);
      return res.json();
    },
    onSuccess: () => {
      invalidateLeaveViews();
      toast({ title: editingLeave ? "Leave updated" : "Leave request created" });
      setFormOpen(false);
      setEditingLeave(null);
      setForm({ ...EMPTY_FORM });
    },
    onError: async (err: any) => {
      const { status, body } = await parseApiError(err);
      if (status === 409 && body?.code === "LEAVE_BOOKING_CONFLICT") {
        setConflict({ leave: editingLeave || undefined, conflicts: body.conflicts, mode: "edit" });
        return;
      }
      toast({ title: "Could not save leave", description: body?.message || err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ leaveId, withOverride }: { leaveId: string; withOverride: boolean }) => {
      try {
        const res = await apiRequest("POST", `/api/driver-leaves/${leaveId}/approve`, { override: withOverride });
        return res.json();
      } catch (err: any) {
        const { status, body } = await parseApiError(err);
        const e: any = new Error(body?.message || err.message);
        e.status = status; e.body = body;
        throw e;
      }
    },
    onSuccess: () => {
      invalidateLeaveViews();
      toast({ title: "Leave approved" });
      setConflict(null);
      setOverride(false);
      setDetailLeave(null);
    },
    onError: (err: any, vars) => {
      if (err.status === 409 && err.body?.code === "LEAVE_BOOKING_CONFLICT") {
        const leave = allLeaves.find((l) => l._id === vars.leaveId);
        setConflict({ leave, conflicts: err.body.conflicts, mode: "approve" });
        return;
      }
      toast({ title: "Could not approve leave", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (leaveId: string) => (await apiRequest("POST", `/api/driver-leaves/${leaveId}/reject`, {})).json(),
    onSuccess: () => {
      invalidateLeaveViews();
      toast({ title: "Leave rejected" });
      setDetailLeave(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (leaveId: string) => (await apiRequest("POST", `/api/driver-leaves/${leaveId}/cancel`, {})).json(),
    onSuccess: () => {
      invalidateLeaveViews();
      toast({ title: "Leave cancelled", description: "The driver is available for assignment again." });
      setDetailLeave(null);
    },
    onError: (err: any) => toast({ title: "Could not cancel leave", description: err.message, variant: "destructive" }),
  });

  // ----- calendar helpers -----
  const openAddLeave = (date?: Date) => {
    setEditingLeave(null);
    const d = date ? dayKey(date) : "";
    setForm({ ...EMPTY_FORM, startDate: d, endDate: d });
    setFormOpen(true);
  };

  const openEditLeave = (l: LeaveRecord) => {
    setEditingLeave(l);
    setForm({
      driverId: driverOf(l).id,
      startDate: dayKey(new Date(l.startDate)),
      endDate: dayKey(new Date(l.endDate)),
      leaveType: l.leaveType,
      dayPart: l.dayPart || "full",
      reason: l.reason || "",
    });
    setDetailLeave(null);
    setFormOpen(true);
  };

  const shift = (dir: -1 | 1) => {
    const next = new Date(anchor);
    if (view === "week") next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchor(atMidnight(next));
  };

  const monthLabel = anchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const weekStart = useMemo(() => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - d.getDay()); // week starts Sunday
    return atMidnight(d);
  }, [anchor]);
  const weekLabel = `${fmtDateShort(weekStart)} – ${fmtDate(new Date(weekStart.getTime() + 6 * 86400000))}`;

  const monthCells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      return atMidnight(d);
    });
  }, [anchor]);

  const weekCells = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => atMidnight(new Date(weekStart.getTime() + i * 86400000))),
  [weekStart]);

  const detailDriver = detailLeave ? driverOf(detailLeave) : null;
  const detailStyle = detailLeave ? (LEAVE_STATUS_STYLE[detailLeave.status] || LEAVE_STATUS_STYLE.pending) : null;
  const canEditDetail = detailLeave && (detailLeave.status === "pending" ||
    (detailLeave.status === "approved" && atMidnight(new Date(detailLeave.startDate)) > today));
  const canCancelDetail = detailLeave && (detailLeave.status === "pending" || detailLeave.status === "approved");

  const dayDetailLeaves = dayDetail ? leavesOnDay(filteredLeaves, dayDetail) : [];
  const dayDetailOnLeaveIds = new Set(dayDetailLeaves.filter((l) => l.status === "approved").map((l) => driverOf(l).id));

  const renderDayCell = (d: Date, inMonth: boolean) => {
    const entries = leavesOnDay(filteredLeaves, d);
    const isToday = dayKey(d) === dayKey(today);
    return (
      <button
        key={d.toISOString()}
        type="button"
        onClick={() => setDayDetail(d)}
        className={`min-h-[64px] sm:min-h-[86px] border border-gray-100 rounded-md p-1 sm:p-1.5 text-left align-top transition-colors hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${inMonth ? "bg-white" : "bg-gray-50/60"}`}
      >
        <div className={`text-[11px] sm:text-xs font-medium mb-0.5 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white" : inMonth ? "text-gray-700" : "text-gray-400"}`}>
          {d.getDate()}
        </div>
        {/* Desktop: up to 2 names; mobile: a compact count chip. */}
        <div className="hidden sm:block space-y-0.5">
          {entries.slice(0, 2).map((l) => {
            const st = LEAVE_STATUS_STYLE[l.status] || LEAVE_STATUS_STYLE.pending;
            return (
              <div key={l._id} className="flex items-center gap-1 text-[11px] leading-tight truncate">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
                <span className="truncate text-gray-700">{driverOf(l).name.split(" ")[0]}</span>
                {l.dayPart && l.dayPart !== "full" && <span className="text-gray-400">½</span>}
              </div>
            );
          })}
          {entries.length > 2 && <div className="text-[11px] text-blue-600 font-medium">+{entries.length - 2} more</div>}
        </div>
        {entries.length > 0 && (
          <div className="sm:hidden">
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
              {entries.length}
            </span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Driver Leave</h1>
          <p className="text-sm text-gray-500">Approved leave feeds directly into driver availability — a driver on leave never shows as assignable.</p>
        </div>
        <Button onClick={() => openAddLeave()} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto" data-testid="add-leave-button">
          <Plus className="w-4 h-4 mr-2" />
          Add Leave
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <LeaveKpi icon={CalendarOff} label="Today on Leave" value={todayOnLeave.length} tone="bg-blue-50 text-blue-600" testId="kpi-today-on-leave" />
        <LeaveKpi icon={CalendarDays} label="Upcoming Leave" value={upcoming.length} tone="bg-indigo-50 text-indigo-600" testId="kpi-upcoming" />
        <LeaveKpi icon={UserCheck} label="Available Drivers Today" value={dailyQuery.isLoading ? "…" : availableToday} tone="bg-green-50 text-green-600" testId="kpi-available" />
        <LeaveKpi icon={ClipboardList} label="Pending Requests" value={pendingCount} tone="bg-amber-50 text-amber-600" testId="kpi-pending" />
      </div>

      {/* Today on leave — before the calendar, always */}
      <TodayOnLeaveStrip maxEntries={4} />

      {/* Upcoming leave — compact, max 4 */}
      {upcoming.length > 0 && (
        <Card className="shadow-sm" data-testid="upcoming-leave">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900">Upcoming Leave</span>
              {upcoming.length > 4 && (
                <Button variant="ghost" size="sm" className="text-blue-600 h-7 px-2" onClick={() => { setView("list"); setFilterStatus("all"); }}>
                  View All
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {upcoming.slice(0, 4).map((l) => {
                const st = LEAVE_STATUS_STYLE[l.status] || LEAVE_STATUS_STYLE.pending;
                return (
                  <button key={l._id} type="button" onClick={() => setDetailLeave(l)}
                    className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-left">
                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                    <span className="text-sm font-medium text-gray-900">{driverOf(l).name}</span>
                    <span className="text-xs text-gray-500">{fmtRange(l)}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Search driver name / phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-56" />
        <Select value={filterDriver} onValueChange={setFilterDriver}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Driver" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drivers</SelectItem>
            {drivers.map((d: any) => <SelectItem key={d._id || d.id} value={d._id || d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="sm:w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(LEAVE_TYPE_LABEL).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(LEAVE_STATUS_STYLE).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Calendar */}
      <Card className="shadow-sm" data-testid="leave-calendar">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft size={16} /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => setAnchor(atMidnight(new Date()))}>Today</Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => shift(1)} aria-label="Next"><ChevronRight size={16} /></Button>
              <span className="ml-2 text-sm font-semibold text-gray-900" data-testid="calendar-label">
                {view === "week" ? weekLabel : monthLabel}
              </span>
            </div>
            <div className="flex rounded-lg border border-gray-200 p-0.5 self-start">
              {(["month", "week", "list"] as CalendarView[]).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs font-medium rounded-md capitalize ${view === v ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {view !== "list" && (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
                  <div key={w} className="text-[11px] font-medium text-gray-400 text-center">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {(view === "month" ? monthCells : weekCells).map((d) =>
                  renderDayCell(d, view === "week" || d.getMonth() === anchor.getMonth()))}
              </div>
            </>
          )}

          {view === "list" && (
            <div className="space-y-2">
              {filteredLeaves.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">No leave records match the current filters.</p>
              ) : (
                [...filteredLeaves]
                  .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                  .map((l) => {
                    const d = driverOf(l);
                    const st = LEAVE_STATUS_STYLE[l.status] || LEAVE_STATUS_STYLE.pending;
                    return (
                      <button key={l._id} type="button" onClick={() => setDetailLeave(l)}
                        className="w-full flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 text-left">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
                            {initialsOf(d.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{d.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {fmtRange(l)} · {LEAVE_TYPE_LABEL[l.leaveType] || l.leaveType}
                              {l.dayPart && l.dayPart !== "full" ? ` · ${DAY_PART_LABEL[l.dayPart]}` : ""}
                            </div>
                          </div>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${st.pill}`}>{st.label}</span>
                      </button>
                    );
                  })
              )}
            </div>
          )}

          {/* Legend — text labels, never color alone */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-100">
            {Object.entries(LEAVE_STATUS_STYLE).map(([k, s]) => (
              <span key={k} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="font-semibold text-gray-400">½</span><span>Half day</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Availability summary — real numbers from the daily report */}
      {daily.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={15} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-900">Driver Availability Today</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="flex justify-between sm:block"><span className="text-gray-500">Total Drivers</span><div className="font-semibold text-gray-900">{daily.length}</div></div>
              <div className="flex justify-between sm:block"><span className="text-gray-500">On Duty</span><div className="font-semibold text-gray-900">{onDutyToday}</div></div>
              <div className="flex justify-between sm:block"><span className="text-gray-500">Available</span><div className="font-semibold text-green-700">{availableToday}</div></div>
              <div className="flex justify-between sm:block"><span className="text-gray-500">On Leave</span><div className="font-semibold text-blue-700">{daily.filter((d) => d.onLeave).length}</div></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------- Day detail dialog ---------- */}
      <Dialog open={!!dayDetail} onOpenChange={(v) => { if (!v) setDayDetail(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dayDetail?.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1.5">Drivers on Leave ({dayDetailLeaves.length})</div>
              {dayDetailLeaves.length === 0 ? (
                <p className="text-sm text-gray-500">No leave scheduled for this date.</p>
              ) : (
                <div className="space-y-1.5">
                  {dayDetailLeaves.map((l) => {
                    const d = driverOf(l);
                    const st = LEAVE_STATUS_STYLE[l.status] || LEAVE_STATUS_STYLE.pending;
                    return (
                      <button key={l._id} type="button" onClick={() => { setDayDetail(null); setDetailLeave(l); }}
                        className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate">{d.name}</span>
                          <span className="text-xs text-gray-500">
                            {l.dayPart && l.dayPart !== "full" ? DAY_PART_LABEL[l.dayPart] : (LEAVE_TYPE_LABEL[l.leaveType] || l.leaveType)}
                          </span>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${st.pill}`}>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Drivers without approved leave this day: {Math.max(drivers.length - dayDetailOnLeaveIds.size, 0)} of {drivers.length}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayDetail(null)}>Close</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { const d = dayDetail!; setDayDetail(null); openAddLeave(d); }}>
              <Plus className="w-4 h-4 mr-1.5" />Add Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Add / Edit leave dialog ---------- */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); setEditingLeave(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingLeave ? "Edit Leave" : "Add Driver Leave"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Driver</Label>
              <Select value={form.driverId} onValueChange={(v) => setForm((f) => ({ ...f, driverId: v }))} disabled={!!editingLeave}>
                <SelectTrigger data-testid="leave-driver-select"><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d: any) => <SelectItem key={d._id || d.id} value={d._id || d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate && f.endDate < e.target.value ? e.target.value : f.endDate }))} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Leave Type</Label>
                <Select value={form.leaveType} onValueChange={(v) => setForm((f) => ({ ...f, leaveType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAVE_TYPE_LABEL).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Day</Label>
                <Select value={form.dayPart} onValueChange={(v) => setForm((f) => ({ ...f, dayPart: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DAY_PART_LABEL).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.dayPart !== "full" && (
              <p className="text-xs text-amber-600">Half-day leave still blocks booking assignment for the whole day — bookings have no half-day granularity yet.</p>
            )}
            <div>
              <Label>Reason</Label>
              <Textarea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); setEditingLeave(null); }}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!form.driverId || !form.startDate || !form.endDate || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              data-testid="leave-save-button"
            >
              {saveMutation.isPending ? "Saving..." : editingLeave ? "Save Changes" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Leave detail dialog ---------- */}
      <Dialog open={!!detailLeave} onOpenChange={(v) => { if (!v) setDetailLeave(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Leave Details</DialogTitle></DialogHeader>
          {detailLeave && detailDriver && detailStyle && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                  {initialsOf(detailDriver.name)}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{detailDriver.name}</div>
                  {detailDriver.phone && <div className="text-xs text-gray-500">{detailDriver.phone}</div>}
                </div>
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${detailStyle.pill}`}>{detailStyle.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border rounded-lg p-3 bg-gray-50/60">
                <div><span className="text-gray-500 block text-xs">Leave</span>{fmtRange(detailLeave)}</div>
                <div><span className="text-gray-500 block text-xs">Type</span>{LEAVE_TYPE_LABEL[detailLeave.leaveType] || detailLeave.leaveType}</div>
                <div><span className="text-gray-500 block text-xs">Day</span>{DAY_PART_LABEL[detailLeave.dayPart || "full"]}</div>
                <div><span className="text-gray-500 block text-xs">Created by</span>{detailLeave.requestedBy?.role || "—"}</div>
                {detailLeave.reason && <div className="col-span-2"><span className="text-gray-500 block text-xs">Reason</span>{detailLeave.reason}</div>}
                {detailLeave.approvedBy && (
                  <div className="col-span-2"><span className="text-gray-500 block text-xs">Decided by</span>{detailLeave.approvedBy.role}{detailLeave.approvalNote ? ` — ${detailLeave.approvalNote}` : ""}</div>
                )}
              </div>
              {detailLeave.conflictingBookings && detailLeave.conflictingBookings.length > 0 && (
                <div className="text-xs text-amber-600">
                  Approved with booking conflicts: {detailLeave.conflictingBookings.join(", ")} — replacement driver still needed.
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {detailLeave.status === "pending" && (
                  <>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate({ leaveId: detailLeave._id, withOverride: false })}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate(detailLeave._id)}>Reject</Button>
                  </>
                )}
                {canEditDetail && <Button size="sm" variant="outline" onClick={() => openEditLeave(detailLeave)}>Edit</Button>}
                {canCancelDetail && (
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(detailLeave._id)}>Cancel Leave</Button>
                )}
                {onOpenDriver && typeof detailLeave.driverId === "object" && (
                  <Button size="sm" variant="ghost" className="text-blue-600 ml-auto"
                    onClick={() => { const d = detailLeave.driverId; setDetailLeave(null); onOpenDriver(d); }}>
                    View Driver 360
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Booking conflict dialog (approve / edit override) ---------- */}
      <Dialog open={!!conflict} onOpenChange={(v) => { if (!v) { setConflict(null); setOverride(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />Driver leave conflict
            </DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTitle>This driver has confirmed bookings in this period</AlertTitle>
            <AlertDescription>
              <div className="space-y-1 text-xs mt-1">
                {conflict?.conflicts?.map((c: any) => (
                  <div key={c.id}>{c.bookingId} — {c.customerName} ({fmtDate(c.pickupDate)}, {c.status})</div>
                ))}
              </div>
              <p className="text-xs mt-2">Reassign these bookings to another driver, or proceed anyway — proceeding records them as needing action.</p>
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-2">
            <Checkbox id="leave-override" checked={override} onCheckedChange={(v) => setOverride(!!v)} />
            <Label htmlFor="leave-override" className="text-sm">Proceed anyway — I will assign a replacement driver</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConflict(null); setOverride(false); }}>Cancel</Button>
            <Button
              disabled={!override || approveMutation.isPending || saveMutation.isPending}
              onClick={() => {
                if (conflict?.mode === "approve" && conflict.leave) {
                  approveMutation.mutate({ leaveId: conflict.leave._id, withOverride: true });
                } else {
                  // edit-mode conflict: resubmit the PATCH with override set
                  const leaveId = conflict?.leave?._id || editingLeave?._id;
                  if (!leaveId) return;
                  apiRequest("PATCH", `/api/driver-leaves/${leaveId}`, {
                    startDate: form.startDate, endDate: form.endDate, leaveType: form.leaveType,
                    dayPart: form.dayPart, reason: form.reason, override: true,
                  }).then(() => {
                    invalidateLeaveViews();
                    toast({ title: "Leave updated with conflicts recorded" });
                    setConflict(null); setOverride(false); setFormOpen(false); setEditingLeave(null);
                  }).catch((err: any) => toast({ title: "Could not save leave", description: err.message, variant: "destructive" }));
                }
              }}
            >
              Proceed With Conflicts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
