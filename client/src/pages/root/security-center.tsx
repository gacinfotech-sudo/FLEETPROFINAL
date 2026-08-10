// TASK-ROOT-SECURITY-05 — Root -> Security ("Security Command Center").
//
// Reads GET /api/root/security/events, which EXTENDS the existing
// GET /api/admin/security/stats precedent (server/routes.ts:1144) rather
// than replacing it — see server/root/routes/security.ts for the exact
// reuse of the same in-memory `loginAttempts` tracker
// (server/middleware/security.ts) that endpoint already surfaces.
//
// MFA status is shown as an explicit "Not yet implemented" placeholder —
// MFA is out of scope for this task and this wave (see
// ROOT-CONTROL-PLANE-MANIFEST.md and this task's report). This page must
// never render a fake "enabled"/green-check state for it.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, ShieldCheck, KeyRound, Users, AlertTriangle, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BreakGlassEventRow {
  id: string;
  scope: "platform" | "tenant";
  tenantId?: string;
  actorUserId: string;
  reason: string;
  ticketReference: string;
  durationMinutes: number;
  expiresAt: string;
  revokedAt?: string;
  active: boolean;
  createdAt: string;
}

interface SecurityEventsResponse {
  failedLogins: number;
  uniqueFailedIPs: number;
  suspiciousUsers: { userId: string; attempts: number }[];
  recentFailures: { userId: string; ip: string; timestamp: string; userAgent: string }[];
  activeSessions: number | null;
  breakGlassEvents: BreakGlassEventRow[];
  mfaStatus: "not_implemented";
}

const SECURITY_EVENTS_QUERY_KEY = ["/api/root/security/events"];

function StatCard({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: typeof ShieldAlert;
  label: string;
  value: string | number;
  testId: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <Icon className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <div className="text-2xl font-semibold" data-testid={testId}>
            {value}
          </div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SecurityCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [reason, setReason] = useState("");
  const [ticketReference, setTicketReference] = useState("");
  const [scope, setScope] = useState<"platform" | "tenant">("platform");
  const [tenantId, setTenantId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");

  const { data, isLoading, error } = useQuery<SecurityEventsResponse>({
    queryKey: SECURITY_EVENTS_QUERY_KEY,
    refetchInterval: 30_000,
  });

  const createBreakGlassMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/root/break-glass", {
        reason,
        ticketReference,
        scope,
        tenantId: scope === "tenant" ? tenantId : undefined,
        durationMinutes: Number(durationMinutes),
      });
    },
    onSuccess: () => {
      toast({ title: "Break-glass access granted", description: `Expires in ${durationMinutes} minute(s).` });
      setReason("");
      setTicketReference("");
      queryClient.invalidateQueries({ queryKey: SECURITY_EVENTS_QUERY_KEY });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to create break-glass event",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/root/break-glass/${id}/revoke`);
    },
    onSuccess: () => {
      toast({ title: "Break-glass access revoked" });
      queryClient.invalidateQueries({ queryKey: SECURITY_EVENTS_QUERY_KEY });
    },
  });

  return (
    <div className="space-y-6" data-testid="page-security-center">
      {/* Beautiful Gradient Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">🔒 Security Command Center</h1>
        <p className="text-red-100 mt-1">Break-glass access • Active sessions • Failed logins tracking</p>
      </div>

      <div className="p-6">
      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">Failed to load security events.</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShieldAlert} label="Failed logins (24h)" value={data?.failedLogins ?? (isLoading ? "…" : 0)} testId="stat-failed-logins" />
        <StatCard
          icon={AlertTriangle}
          label="Suspicious users"
          value={data?.suspiciousUsers.length ?? (isLoading ? "…" : 0)}
          testId="stat-suspicious-users"
        />
        <StatCard
          icon={Users}
          label="Active sessions"
          value={data?.activeSessions ?? (isLoading ? "…" : "N/A")}
          testId="stat-active-sessions"
        />
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <KeyRound className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <div className="text-2xl font-semibold" data-testid="stat-mfa-status">
                <Badge variant="secondary">Not yet implemented</Badge>
              </div>
              <div className="text-sm text-muted-foreground">MFA status</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suspicious login activity</CardTitle>
          <CardDescription>Users with 3+ failed attempts in the current window.</CardDescription>
        </CardHeader>
        <CardContent>
          {(data?.suspiciousUsers.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No suspicious activity detected.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Failed attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.suspiciousUsers.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>{row.userId}</TableCell>
                    <TableCell>{row.attempts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" aria-hidden="true" /> Break-glass access
          </CardTitle>
          <CardDescription>
            Time-boxed elevated access. Requires a reason, a ticket/incident reference, a scope, and a duration —
            auto-expires, no standing grant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="break-glass-reason">Reason</Label>
              <Textarea
                id="break-glass-reason"
                data-testid="input-break-glass-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is elevated access needed?"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="break-glass-ticket">Ticket / incident reference</Label>
              <Input
                id="break-glass-ticket"
                data-testid="input-break-glass-ticket"
                value={ticketReference}
                onChange={(e) => setTicketReference(e.target.value)}
                placeholder="INC-1234"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="break-glass-scope">Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as "platform" | "tenant")}>
                <SelectTrigger id="break-glass-scope" data-testid="select-break-glass-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform">Platform-wide</SelectItem>
                  <SelectItem value="tenant">Single tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "tenant" && (
              <div className="space-y-1">
                <Label htmlFor="break-glass-tenant">Tenant ID</Label>
                <Input
                  id="break-glass-tenant"
                  data-testid="input-break-glass-tenant"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="break-glass-duration">Duration (minutes)</Label>
              <Input
                id="break-glass-duration"
                data-testid="input-break-glass-duration"
                type="number"
                min={1}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
          </div>
          <Button
            data-testid="button-request-break-glass"
            onClick={() => createBreakGlassMutation.mutate()}
            disabled={!reason.trim() || !ticketReference.trim() || createBreakGlassMutation.isPending}
          >
            Request break-glass access
          </Button>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.breakGlassEvents ?? []).map((event) => (
                <TableRow key={event.id} data-testid={`row-break-glass-${event.id}`}>
                  <TableCell>{event.scope}</TableCell>
                  <TableCell>{event.actorUserId}</TableCell>
                  <TableCell className="max-w-xs truncate">{event.reason}</TableCell>
                  <TableCell>{event.ticketReference}</TableCell>
                  <TableCell>{new Date(event.expiresAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {event.active ? (
                      <Badge>Active</Badge>
                    ) : event.revokedAt ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <Badge variant="secondary">Expired</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {event.active && (
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-revoke-${event.id}`}
                        onClick={() => revokeMutation.mutate(event.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Recent failed-login events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.recentFailures ?? []).map((f, i) => (
                <TableRow key={i}>
                  <TableCell>{f.userId}</TableCell>
                  <TableCell>{f.ip}</TableCell>
                  <TableCell>{new Date(f.timestamp).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
