// Shared row-rendering table for every booking-queues tab. One component so
// Most Recent / Date Pending / Follow-up Due / Needs Attention / Tentative
// all render identically (only the underlying data differs) — the same
// "one shared table, many tabs" shape live-bookings.tsx already uses.

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { QueueBookingRow } from "./types";

const REASON_LABEL: Record<string, { label: string; className: string }> = {
  unallocated: { label: "Unallocated", className: "bg-red-100 text-red-800" },
  date_pending: { label: "Date Pending", className: "bg-amber-100 text-amber-800" },
  follow_up_due: { label: "Follow-up Due", className: "bg-blue-100 text-blue-800" },
};

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function QueueTable({ rows, isLoading, emptyLabel, onRowClick }: {
  rows: QueueBookingRow[];
  isLoading?: boolean;
  emptyLabel?: string;
  onRowClick?: (row: QueueBookingRow) => void;
}) {
  if (isLoading) return <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>;
  if (rows.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">{emptyLabel || "No bookings in this queue."}</p>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Pickup Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Follow-up</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.id} className={onRowClick ? "cursor-pointer hover:bg-gray-50" : undefined} onClick={() => onRowClick?.(b)}>
              <TableCell className="font-medium">{b.bookingId}</TableCell>
              <TableCell>
                <p>{b.customerName}</p>
                <p className="text-xs text-gray-500">{b.customerPhone}</p>
              </TableCell>
              <TableCell>{b.pickupLocation} {b.dropoffLocation ? `→ ${b.dropoffLocation}` : ""}</TableCell>
              <TableCell>
                {b.travelDateStatus === "not_decided" ? (
                  <span className="text-amber-700 text-xs font-medium">Not decided</span>
                ) : b.travelDateStatus === "range" ? (
                  <span className="text-xs">{fmtDate(b.tentativeStartDate)} – {fmtDate(b.tentativeEndDate)}</span>
                ) : (
                  fmtDate(b.pickupDate)
                )}
              </TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{b.status?.replace(/_/g, " ")}</Badge></TableCell>
              <TableCell className="text-xs text-gray-500">{fmtDateTime(b.lastActivityAt)}</TableCell>
              <TableCell className="text-xs">{b.followUpAt ? fmtDateTime(b.followUpAt) : "-"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(b.reasons || []).map((r) => {
                    const meta = REASON_LABEL[r] || { label: r, className: "bg-gray-100 text-gray-700" };
                    return <Badge key={r} className={meta.className}>{meta.label}</Badge>;
                  })}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
