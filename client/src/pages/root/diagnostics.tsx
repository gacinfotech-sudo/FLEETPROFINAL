// TASK-ROOT-SUPPORT-03 — Support Diagnostics.
//
// Given a correlation ID, reconstructs the failed-workflow trace from
// every ErrorRecord sharing that ID (GET /api/root/diagnostics/:correlationId
// — see server/root/routes/errors.ts). Reads from ErrorRecord only; no
// separate capture mechanism, per this task's scope.
//
// Not wired into client/src/App.tsx or the sidebar by this task — see this
// task's report for the exact proposed <Route> and sidebar nav entry.
// Accepts an optional `?correlationId=` query param so the Error Center
// page's "Open Support Diagnostics for this trace" link can deep-link here.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface DiagnosticsEvent {
  errorId: string;
  source: string;
  sanitizedMessage: string;
  module?: string;
  actionAttempted?: string;
  stepReached?: string;
  validationFailure?: string;
  apiResponseSnapshot?: string;
  retryCount?: number;
  lastSuccessfulStep?: string;
  createdAt: string;
}

interface DiagnosticsTrace {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  role?: string;
  module?: string;
  actionAttempted?: string;
  stepReached?: string;
  validationFailure?: string;
  apiResponseSnapshot?: string;
  retryCount?: number;
  lastSuccessfulStep?: string;
  firstEventAt: string;
  lastEventAt: string;
  events: DiagnosticsEvent[];
}

function fieldFromLocation(name: string): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get(name) ?? "";
}

export default function DiagnosticsPage() {
  const [correlationIdInput, setCorrelationIdInput] = useState(() => fieldFromLocation("correlationId"));
  const [searchedId, setSearchedId] = useState(() => fieldFromLocation("correlationId"));

  useEffect(() => {
    const fromUrl = fieldFromLocation("correlationId");
    if (fromUrl) {
      setCorrelationIdInput(fromUrl);
      setSearchedId(fromUrl);
    }
  }, []);

  const { data, isLoading, error, isFetched } = useQuery<{ trace: DiagnosticsTrace }>({
    queryKey: [`/api/root/diagnostics/${encodeURIComponent(searchedId)}`],
    enabled: !!searchedId,
  });

  return (
    <div className="space-y-6" data-testid="page-root-diagnostics">
      {/* Beautiful Gradient Header */}
      <div className="gradient-header bg-gradient-to-r from-amber-600 to-orange-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">🔍 Support Diagnostics</h1>
        <p className="text-amber-100 mt-1">Reconstruct failed workflows • Trace correlation IDs</p>
      </div>

      <div className="p-6">

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Look up a failed workflow by Correlation ID</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            data-testid="input-correlation-id"
            value={correlationIdInput}
            onChange={(e) => setCorrelationIdInput(e.target.value)}
            placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
            className="max-w-md"
          />
          <Button data-testid="button-search-correlation-id" onClick={() => setSearchedId(correlationIdInput.trim())}>
            Reconstruct Trace
          </Button>
        </CardContent>
      </Card>

      {isLoading && <div className="text-muted-foreground text-sm">Reconstructing trace…</div>}

      {error && (
        <div className="text-destructive text-sm" data-testid="text-diagnostics-error">
          {(error as any).message?.includes("404")
            ? "No diagnostics trace found for this correlation ID."
            : `Failed to load diagnostics trace: ${String((error as any).message ?? error)}`}
        </div>
      )}

      {isFetched && !error && data?.trace && (
        <div className="space-y-4" data-testid="diagnostics-trace-result">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reconstructed Trace</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium">Tenant:</span> {data.trace.tenantId ?? "—"}
              </div>
              <div>
                <span className="font-medium">User / Role:</span> {data.trace.userId ?? "—"} / {data.trace.role ?? "—"}
              </div>
              <div>
                <span className="font-medium">Module:</span> {data.trace.module ?? "—"}
              </div>
              <div>
                <span className="font-medium">Action attempted:</span> {data.trace.actionAttempted ?? "—"}
              </div>
              <div>
                <span className="font-medium">Step reached:</span> {data.trace.stepReached ?? "—"}
              </div>
              <div>
                <span className="font-medium">Last successful step:</span> {data.trace.lastSuccessfulStep ?? "—"}
              </div>
              <div>
                <span className="font-medium">Retry count:</span> {data.trace.retryCount ?? 0}
              </div>
              <div>
                <span className="font-medium">Correlation ID:</span>{" "}
                <span className="font-mono text-xs">{data.trace.correlationId}</span>
              </div>
              {data.trace.validationFailure && (
                <div className="col-span-2">
                  <span className="font-medium">Validation failure:</span> {data.trace.validationFailure}
                </div>
              )}
              {data.trace.apiResponseSnapshot && (
                <div className="col-span-2">
                  <span className="font-medium">API response:</span>{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{data.trace.apiResponseSnapshot}</code>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Sequence ({data.trace.events.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.trace.events.map((event, i) => (
                <div key={event.errorId} className="border-l-2 border-muted pl-4 pb-2" data-testid={`diagnostics-event-${i}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{event.source.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-sm mt-1">{event.sanitizedMessage}</div>
                  {event.stepReached && (
                    <div className="text-xs text-muted-foreground mt-1">Step: {event.stepReached}</div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
