// Shared row-rendering table for every booking-queues tab. One component so
// Most Recent / Date Pending / Follow-up Due / Needs Attention / Tentative
// all render identically (only the underlying data differs).
//
// Every row is directly actionable (§3-§4, §66-§67): the booking code and
// the whole row open the ONE Unified Booking Workspace; a compact action
// area offers Open + the state-appropriate primary action (Set Date /
// Confirm) + a More menu — never a wall of buttons. Flags are quick-fix
// links that open the workspace focused on the section that fixes them
// (§59 — no dead flags), and allocation is shown as the precise two-axis
// truth ("Driver Assigned · Vehicle Pending"), not a contradictory
// status/flag pair.

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, CalendarPlus } from "lucide-react";
import { QueueBookingRow } from "./types";
import { useBookingWorkspace } from "@/components/booking/booking-workspace-context";
import { SetDateDialog } from "@/components/booking/schedule-editor";
import type { WorkspaceSection } from "@/lib/booking-state";

const REASON_META: Record<string, { label: string; className: string; focus: WorkspaceSection }> = {
  unallocated: { label: "Allocation Pending", className: "bg-red-100 text-red-800", focus: "allocation" },
  date_pending: { label: "Date Pending", className: "bg-amber-100 text-amber-800", focus: "schedule" },
  follow_up_due: { label: "Follow-up Due", className: "bg-blue-100 text-blue-800", focus: "followup" },
};

const PRE_CONFIRM = new Set(["enquiry", "quotation_sent", "tentative", "on_hold"]);

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
  /** Optional override for plain row clicks; row actions always use the
   *  Unified Booking Workspace regardless. */
  onRowClick?: (row: QueueBookingRow) => void;
}) {
  const { openBooking } = useBookingWorkspace();
  const [setDateRow, setSetDateRow] = useState<QueueBookingRow | null>(null);

  const openRow = (row: QueueBookingRow) => {
    if (onRowClick) onRowClick(row);
    else openBooking(row.id);
  };

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
            <TableHead>Status / Allocation</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Follow-up</TableHead>
            <TableHead>Flags</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => {
            const datePending = b.travelDateStatus === "not_decided";
            const canConfirm = PRE_CONFIRM.has(b.status);
            return (
              <TableRow key={b.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openRow(b)}>
                <TableCell className="font-medium">
                  <button
                    type="button"
                    className="text-blue-700 hover:underline font-mono text-xs"
                    onClick={(e) => { e.stopPropagation(); openBooking(b.id); }}
                  >
                    {b.bookingId}
                  </button>
                </TableCell>
                <TableCell>
                  <p>{b.customerName}</p>
                  <p className="text-xs text-gray-500">{b.customerPhone}</p>
                </TableCell>
                <TableCell>{b.pickupLocation} {b.dropoffLocation ? `→ ${b.dropoffLocation}` : ""}</TableCell>
                <TableCell>
                  {datePending ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-amber-700 border-amber-300"
                      onClick={(e) => { e.stopPropagation(); setSetDateRow(b); }}
                    >
                      <CalendarPlus className="w-3.5 h-3.5 mr-1" /> Set Date
                    </Button>
                  ) : b.travelDateStatus === "range" ? (
                    <button
                      type="button"
                      className="text-xs text-left hover:underline"
                      onClick={(e) => { e.stopPropagation(); openBooking(b.id, { focus: "schedule" }); }}
                    >
                      {fmtDate(b.tentativeStartDate)} – {fmtDate(b.tentativeEndDate)}
                      <span className="block text-amber-700">Range — confirm date</span>
                    </button>
                  ) : (
                    <>{fmtDate(b.pickupDate)}{b.pickupTime ? <span className="block text-xs text-gray-500">{b.pickupTime}</span> : null}</>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{b.status?.replace(/_/g, " ")}</Badge>
                  {b.allocation && !b.allocation.complete && (
                    <span className="block text-xs text-amber-700 mt-1">{b.allocation.label}</span>
                  )}
                  {b.allocation?.complete && b.allocation.label !== "Allocated" && (
                    <span className="block text-xs text-gray-500 mt-1">{b.allocation.label}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-gray-500">{fmtDateTime(b.lastActivityAt)}</TableCell>
                <TableCell className="text-xs">{b.followUpAt ? fmtDateTime(b.followUpAt) : "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(b.reasons || []).map((r) => {
                      const meta = REASON_META[r];
                      if (!meta) return <Badge key={r} className="bg-gray-100 text-gray-700">{r}</Badge>;
                      // "unallocated" gets the precise allocation label when
                      // the server sent one — never a blanket "Unallocated"
                      // beside a "Driver Assigned" status (§34).
                      const label = r === "unallocated" && b.allocation ? b.allocation.label : meta.label;
                      return (
                        <button key={r} type="button" onClick={(e) => { e.stopPropagation(); openBooking(b.id, { focus: meta.focus }); }}>
                          <Badge className={`${meta.className} hover:opacity-80`}>{label}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-7" onClick={() => openBooking(b.id)}>Open</Button>
                    {canConfirm && (
                      <Button size="sm" className="h-7" onClick={() => openBooking(b.id, { focus: "overview" })}>
                        Confirm
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSetDateRow(b)}>
                          {datePending ? "Set Travel Date" : "Change Date"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openBooking(b.id, { focus: "allocation" })}>
                          Assign Driver / Vehicle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openBooking(b.id, { focus: "allocation" })}>
                          Vendor / Outsource
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openBooking(b.id, { focus: "payments" })}>
                          Add Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openBooking(b.id, { focus: "followup" })}>
                          Follow-up
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openBooking(b.id, { focus: "timeline" })}>
                          Timeline
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <SetDateDialog
        booking={setDateRow ? { ...setDateRow, _id: setDateRow.id } : null}
        open={!!setDateRow}
        onOpenChange={(open) => { if (!open) setSetDateRow(null); }}
      />
    </div>
  );
}
