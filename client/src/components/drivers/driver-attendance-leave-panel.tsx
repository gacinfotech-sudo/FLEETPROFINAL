import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  DAY_PART_LABEL, LEAVE_STATUS_STYLE, LEAVE_TYPE_LABEL, LeaveRecord,
  atMidnight, dayKey, fmtRange, leaveCoversDay,
} from "./leave/leave-domain";

// Driver 360 "Attendance & Leave" tab — reads the SAME canonical sources
// as the Leave Calendar page (/api/driver-leaves, /api/attendance/daily),
// so staff never leave the 360 view to check leave history and the two
// screens can never disagree.
export default function DriverAttendanceLeavePanel({ driverId }: { driverId: string }) {
  const leavesQuery = useQuery({ queryKey: [`/api/driver-leaves?driverId=${driverId}`] });
  const dailyQuery = useQuery({ queryKey: [`/api/attendance/daily?date=${dayKey(new Date())}`] });

  const leaves = (leavesQuery.data as LeaveRecord[]) || [];
  const todayRow = ((dailyQuery.data as any)?.drivers || []).find((d: any) => d.driverId === driverId);

  const today = atMidnight(new Date());
  const currentLeave = leaves.find((l) => l.status === "approved" && leaveCoversDay(l, today));
  const upcoming = leaves
    .filter((l) => (l.status === "approved" || l.status === "pending") && atMidnight(new Date(l.startDate)) > today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const history = [...leaves].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <div className="space-y-5">
      {/* Today */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="border rounded-lg p-3 bg-gray-50/60">
          <div className="text-xs text-gray-500 mb-1">Today's Attendance</div>
          {dailyQuery.isLoading ? (
            <span className="text-sm text-gray-400">Loading…</span>
          ) : (
            <Badge variant={todayRow?.status === "absent" ? "destructive" : "secondary"} className="capitalize">
              {(todayRow?.status || "not scheduled").replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        <div className="border rounded-lg p-3 bg-gray-50/60">
          <div className="text-xs text-gray-500 mb-1">Leave Status</div>
          {currentLeave ? (
            <span className="text-sm font-medium text-blue-700">
              On leave until {fmtRange(currentLeave)} ({LEAVE_TYPE_LABEL[currentLeave.leaveType] || currentLeave.leaveType})
            </span>
          ) : (
            <span className="text-sm text-gray-700">Not on leave today</span>
          )}
        </div>
      </div>

      {/* Upcoming */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Upcoming Leave</h4>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming leave scheduled.</p>
        ) : (
          <div className="space-y-1.5">
            {upcoming.slice(0, 4).map((l) => {
              const st = LEAVE_STATUS_STYLE[l.status] || LEAVE_STATUS_STYLE.pending;
              return (
                <div key={l._id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <span>
                    {fmtRange(l)} · {LEAVE_TYPE_LABEL[l.leaveType] || l.leaveType}
                    {l.dayPart && l.dayPart !== "full" ? ` · ${DAY_PART_LABEL[l.dayPart]}` : ""}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.pill}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Leave History</h4>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">No leave records for this driver yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {history.map((l) => {
              const st = LEAVE_STATUS_STYLE[l.status] || LEAVE_STATUS_STYLE.pending;
              return (
                <div key={l._id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span>{fmtRange(l)} · {LEAVE_TYPE_LABEL[l.leaveType] || l.leaveType}</span>
                    {l.reason && <div className="text-xs text-gray-500 truncate">{l.reason}</div>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${st.pill}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Leave is managed from Drivers → Leave Calendar; approved leave automatically blocks booking assignment for those dates.
      </p>
    </div>
  );
}
