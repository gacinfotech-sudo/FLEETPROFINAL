// TASK-ROOT-SECURITY-05 — Root -> Audit Log.
//
// Reads GET /api/root/audit (server/root/routes/audit.ts), the canonical
// read surface for the generalized PlatformAuditEvent model this task owns
// (server/root/models/auditLog.ts). Every Wave-1 Root action that calls
// through `recordPlatformAuditEvent` (PII unmask, Support Access
// enter/exit, break-glass create/revoke, and — once other tasks wire up to
// this sink — tenant view, configuration change, root login) shows up here.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollText } from "lucide-react";

interface PlatformAuditEventRow {
  _id: string;
  tenantId?: string;
  userId: string;
  actorPlatformRole?: string;
  action: string;
  targetTenantId?: string;
  targetEntity?: string;
  reason?: string;
  correlationId?: string;
  createdAt: string;
}

interface AuditListResponse {
  events: PlatformAuditEventRow[];
  total: number;
  limit: number;
  skip: number;
}

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [skip, setSkip] = useState(0);
  const limit = 50;

  const params = new URLSearchParams();
  if (actionFilter.trim()) params.set("action", actionFilter.trim());
  if (userIdFilter.trim()) params.set("userId", userIdFilter.trim());
  params.set("limit", String(limit));
  params.set("skip", String(skip));

  const { data, isLoading, error } = useQuery<AuditListResponse>({
    queryKey: ["/api/root/audit", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/root/audit?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-6" data-testid="page-audit-log">
      {/* Beautiful Gradient Header */}
      <div className="gradient-header bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">📋 Platform Audit Log</h1>
        <p className="text-blue-100 mt-1">Immutable root events • Login, PII unmask, support access, break-glass</p>
      </div>

      <div className="p-6">
      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">Failed to load audit log.</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="audit-action-filter">Action</Label>
            <Input
              id="audit-action-filter"
              data-testid="input-audit-filter-action"
              value={actionFilter}
              onChange={(e) => {
                setSkip(0);
                setActionFilter(e.target.value);
              }}
              placeholder="e.g. pii.unmask"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-user-filter">Actor user ID</Label>
            <Input
              id="audit-user-filter"
              data-testid="input-audit-filter-user"
              value={userIdFilter}
              onChange={(e) => {
                setSkip(0);
                setUserIdFilter(e.target.value);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events {data ? `(${data.total})` : ""}</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (data?.events.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No audit events found.
                  </TableCell>
                </TableRow>
              )}
              {data?.events.map((event) => (
                <TableRow key={event._id} data-testid={`row-audit-${event._id}`}>
                  <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{event.userId}</TableCell>
                  <TableCell>
                    {event.actorPlatformRole ? <Badge variant="secondary">{event.actorPlatformRole}</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{event.action}</code>
                  </TableCell>
                  <TableCell>{event.targetEntity ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{event.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - limit))}
              data-testid="button-audit-prev-page"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data || skip + limit >= data.total}
              onClick={() => setSkip(skip + limit)}
              data-testid="button-audit-next-page"
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
