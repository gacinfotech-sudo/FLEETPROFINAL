// TASK-BOOKING-QUEUES-05 — the findability queues this task actually adds:
// Most Recent, Date Pending, Follow-up Due, Needs Attention, Tentative
// Bookings. Deliberately NOT added to live-bookings.tsx's existing TABS
// array (per this task's revision note — that file already has real,
// tested Unassigned-tab logic that must not regress); this is a new,
// standalone panel using the same Tabs/Table visual pattern for
// consistency. See this task's REPORT.md for the proposed one-line mount
// into dashboard.tsx.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { QueueTable } from "./queue-table";
import { QueueBookingRow } from "./types";

type QueueKey = "most-recent" | "date-pending" | "follow-up-due" | "needs-attention" | "tentative";

const QUEUE_TABS: { key: QueueKey; label: string; endpoint: string; defaultSort: "lastActivityAt" | "pickupDate" | "followUpAt" }[] = [
  { key: "most-recent", label: "Most Recent", endpoint: "/api/bookings/queues/most-recent", defaultSort: "lastActivityAt" },
  { key: "date-pending", label: "Date Pending", endpoint: "/api/bookings/queues/date-pending", defaultSort: "lastActivityAt" },
  { key: "follow-up-due", label: "Follow-up Due", endpoint: "/api/bookings/queues/follow-up-due", defaultSort: "followUpAt" },
  { key: "needs-attention", label: "Needs Attention", endpoint: "/api/bookings/queues/needs-attention", defaultSort: "lastActivityAt" },
  { key: "tentative", label: "Tentative Bookings", endpoint: "/api/bookings/queues/tentative", defaultSort: "lastActivityAt" },
];

export default function BookingQueuesPanel({ onRowClick }: { onRowClick?: (row: QueueBookingRow) => void }) {
  const [activeTab, setActiveTab] = useState<QueueKey>("needs-attention");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const active = QUEUE_TABS.find((t) => t.key === activeTab)!;
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  params.set("sortBy", active.defaultSort);
  params.set("order", order);
  const url = `${active.endpoint}?${params.toString()}`;

  const { data, isLoading, isError } = useQuery<{ items: QueueBookingRow[] }>({ queryKey: [url] });
  const rows = data?.items || [];

  // Counts for every tab's badge, fetched independently so switching tabs
  // doesn't lose the other tabs' counts (mirrors live-bookings.tsx's
  // single-fetch-then-slice pattern isn't reusable here since these are
  // five genuinely separate endpoints, not one bucketed response).
  const countQueries = QUEUE_TABS.map((t) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery<{ items: QueueBookingRow[] }>({ queryKey: [t.endpoint] })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking Queues</h1>
          <p className="text-sm text-gray-500">Find bookings that need action — sorted, searchable, de-duplicated.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search name, phone, booking ID, route" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={order} onValueChange={(v) => setOrder(v as "asc" | "desc")}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as QueueKey)}>
        <TabsList className="flex-wrap h-auto">
          {QUEUE_TABS.map((t, i) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              {countQueries[i].data ? <Badge variant="secondary" className="ml-2">{countQueries[i].data!.items.length}</Badge> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {QUEUE_TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {isError && activeTab === t.key ? (
                  <p className="text-sm text-red-600">Failed to load {t.label}.</p>
                ) : (
                  <QueueTable
                    rows={activeTab === t.key ? rows : []}
                    isLoading={activeTab === t.key && isLoading}
                    onRowClick={onRowClick}
                    emptyLabel={`No bookings in ${t.label}.`}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
