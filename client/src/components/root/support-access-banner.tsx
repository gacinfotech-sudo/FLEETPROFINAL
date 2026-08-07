// TASK-ROOT-SECURITY-05 — permanent Support Access mode banner.
//
// Renders nothing unless the server-side session (not client state) reports
// an active Support Access grant — see server/root/routes/security.ts,
// GET /api/root/support-access/status, which reads from `req.session`
// (express-session + the existing MongoStore). A tenant-scoped client cannot
// forge this: the banner's visibility and content are entirely
// server-derived, polled on an interval, not a one-time client flag that
// could be spoofed by, e.g., editing local component state.
//
// NOT MOUNTED by this task — client/src/App.tsx is Integrator-only (shared
// application shell). Proposed integration: render <SupportAccessBanner />
// once, near the top of the authenticated app shell, so it's visible on
// every route while active. See this task's report.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SupportAccessStatus {
  active: boolean;
  tenantId?: string;
  actorUserId?: string;
  actorPlatformRole?: string;
  reason?: string;
  ticketReference?: string;
  enteredAt?: string;
  readOnly?: boolean;
}

const SUPPORT_ACCESS_STATUS_QUERY_KEY = ["/api/root/support-access/status"];

export default function SupportAccessBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Polled, not fetched once — this is live, server-derived state that can
  // change from another tab/action (e.g. an auto-timeout added later), so
  // the banner must not go stale.
  const { data } = useQuery<SupportAccessStatus>({
    queryKey: SUPPORT_ACCESS_STATUS_QUERY_KEY,
    refetchInterval: 15_000,
  });

  const exitMutation = useMutation({
    mutationFn: async () => {
      if (!data?.tenantId) return;
      await apiRequest("POST", `/api/root/tenants/${data.tenantId}/support-access/exit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPPORT_ACCESS_STATUS_QUERY_KEY });
      toast({ title: "Support Access exited" });
    },
    onError: () => {
      toast({ title: "Failed to exit Support Access mode", variant: "destructive" });
    },
  });

  if (!data?.active) return null;

  return (
    <div
      role="status"
      data-testid="support-access-banner"
      className="sticky top-0 z-[100] flex w-full flex-wrap items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow-md"
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          SUPPORT ACCESS MODE — Viewing tenant: <strong data-testid="text-support-access-tenant">{data.tenantId}</strong>
          {" · "}Actor: <strong data-testid="text-support-access-actor">{data.actorUserId}</strong>
          {data.readOnly ? " · Read-only" : ""}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-950/40 bg-amber-100 text-amber-950 hover:bg-amber-200"
        onClick={() => exitMutation.mutate()}
        disabled={exitMutation.isPending}
        data-testid="button-exit-support-access"
      >
        Exit Support Access
      </Button>
    </div>
  );
}
