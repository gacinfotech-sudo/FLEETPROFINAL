// TASK-ROOT-SALES-CONFIG-04 — Tenant Feature Flags page.
//
// Not wired into client/src/App.tsx or the sidebar nav (both Integrator-only
// shared files) — see this task's report for the proposed route path
// ("/root/tenants/:tenantId/features") and nav entry. Talks to the routes
// proposed in server/root/routes/features.ts (also not yet mounted — see
// report).

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const STATES = ["ENABLED", "DISABLED", "BETA", "TRIAL", "RESTRICTED"] as const;
type FlagState = (typeof STATES)[number];

interface FeatureFlagRow {
  feature: string;
  state: FlagState;
  source: "tenant_override" | "plan_default";
  updatedBy?: string;
  updatedAt?: string;
  reason?: string;
}

const STATE_COLORS: Record<FlagState, string> = {
  ENABLED: "bg-green-100 text-green-800",
  DISABLED: "bg-red-100 text-red-800",
  BETA: "bg-blue-100 text-blue-800",
  TRIAL: "bg-yellow-100 text-yellow-800",
  RESTRICTED: "bg-orange-100 text-orange-800",
};

export default function FeatureFlagsPage({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const { data: flags = [], isLoading } = useQuery<FeatureFlagRow[]>({
    queryKey: [`/api/root/tenants/${tenantId}/features`],
    enabled: !!tenantId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ feature, state }: { feature: string; state: FlagState }) => {
      const res = await apiRequest("PATCH", `/api/root/tenants/${tenantId}/features`, { feature, state, reason: reason || undefined });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to update feature flag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/root/tenants/${tenantId}/features`] });
      setReason("");
      toast({ title: "Feature flag updated", description: "Change recorded in the audit log." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tenant Feature Flags</h1>
        <p className="text-muted-foreground">
          Disabling a feature never deletes that module's data — only the flag state changes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change reason (applies to the next change made below)</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Reason</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional, recorded in the audit log" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Modules</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Change to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((row) => (
                  <TableRow key={row.feature} data-testid={`feature-row-${row.feature}`}>
                    <TableCell className="font-medium">{row.feature.replace(/_/g, " ")}</TableCell>
                    <TableCell><Badge className={STATE_COLORS[row.state]}>{row.state}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.source === "tenant_override" ? "Tenant override" : "Plan default"}</TableCell>
                    <TableCell>
                      <Select onValueChange={(value) => updateMutation.mutate({ feature: row.feature, state: value as FlagState })}>
                        <SelectTrigger className="w-40" data-testid={`select-state-${row.feature}`}>
                          <SelectValue placeholder="Change state" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
