// Shared client-side helpers for the ONE canonical Driver Leave source
// (/api/driver-leaves). Every leave view — Leave Calendar, Today-on-Leave
// strips, Driver 360 tab — derives from these records; nothing keeps its
// own leave state.

export interface LeaveRecord {
  _id: string;
  driverId: any; // populated driver document (or bare id if not populated)
  startDate: string;
  endDate: string;
  leaveType: string;
  dayPart?: "full" | "first_half" | "second_half";
  reason?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedBy?: { userId: string; role: string };
  approvedBy?: { userId: string; role: string };
  approvalNote?: string;
  conflictingBookings?: string[];
  createdAt?: string;
}

export const LEAVE_TYPE_LABEL: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  medical: "Medical",
  emergency: "Emergency",
  weekly_off: "Weekly Off",
  comp_off: "Comp Off",
  other: "Other",
};

export const DAY_PART_LABEL: Record<string, string> = {
  full: "Full Day",
  first_half: "First Half",
  second_half: "Second Half",
};

// Status pill classes — existing FleetPro semantics (green approved, amber
// pending, red destructive, gray neutral). Text label always accompanies
// the color, so color is never the only indicator.
export const LEAVE_STATUS_STYLE: Record<string, { label: string; pill: string; dot: string }> = {
  approved: { label: "Approved", pill: "bg-green-100 text-green-800", dot: "bg-green-500" },
  pending: { label: "Pending", pill: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  rejected: { label: "Rejected", pill: "bg-red-100 text-red-700", dot: "bg-red-500" },
  cancelled: { label: "Cancelled", pill: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
};

export function driverOf(l: LeaveRecord): { id: string; name: string; phone?: string } {
  const d = l.driverId;
  if (d && typeof d === "object") return { id: d._id || d.id, name: d.name || "Unknown driver", phone: d.phone };
  return { id: String(d), name: "Unknown driver" };
}

// Local-midnight day key — leave ranges are calendar-date based, and all
// comparisons must happen in the viewer's (tenant office) local time.
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function atMidnight(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

// A multi-day leave is ONE record spanning [startDate, endDate] inclusive;
// this is the single place that decides whether it covers a calendar day.
export function leaveCoversDay(l: LeaveRecord, day: Date): boolean {
  const d = atMidnight(day).getTime();
  const s = atMidnight(new Date(l.startDate)).getTime();
  const e = atMidnight(new Date(l.endDate)).getTime();
  return d >= s && d <= e;
}

export function leavesOnDay(leaves: LeaveRecord[], day: Date, statuses: string[] = ["approved", "pending"]): LeaveRecord[] {
  return leaves.filter((l) => statuses.includes(l.status) && leaveCoversDay(l, day));
}

export function fmtDate(d?: string | Date) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateShort(d?: string | Date) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function fmtRange(l: LeaveRecord): string {
  const s = atMidnight(new Date(l.startDate)).getTime();
  const e = atMidnight(new Date(l.endDate)).getTime();
  return s === e ? fmtDate(l.startDate) : `${fmtDateShort(l.startDate)} – ${fmtDate(l.endDate)}`;
}

export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}
