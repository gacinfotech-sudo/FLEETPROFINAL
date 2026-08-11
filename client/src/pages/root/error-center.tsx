// TASK-ROOT-SUPPORT-03 — Root Observability / Error Center.
//
// Lists sanitized ErrorRecords (frontend runtime, API 4xx/5xx, DB failure,
// webhook/integration failure) captured via
// server/root/services/errorCaptureService.ts. Every field shown here has
// already been redacted server-side before storage — this page never
// receives raw payloads to begin with.
//
// Not wired into client/src/App.tsx or the sidebar by this task — see this
// task's report for the exact proposed <Route> and sidebar nav entry.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Search } from "lucide-react";

const SOURCES = ["frontend_runtime", "api_4xx", "api_5xx", "db_failure", "webhook_integration_failure"] as const;

const SOURCE_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  frontend_runtime: "secondary",
  api_4xx: "outline",
  api_5xx: "destructive",
  db_failure: "destructive",
  webhook_integration_failure: "destructive",
};

interface ErrorRecordRow {
  _id: string;
  errorId: string;
  correlationId: string;
  tenantId?: string;
  userId?: string;
  role?: string;
  module?: string;
  route?: string;
  httpMethod?: string;
  httpStatus?: number;
  source: string;
  sanitizedMessage: string;
  createdAt: string;
}

export default function ErrorCenterPage() {
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [selectedError, setSelectedError] = useState<ErrorRecordRow | null>(null);

  const params = new URLSearchParams();
  if (sourceFilter) params.set("source", sourceFilter);
  const queryString = params.toString();

  const { data, isLoading, error } = useQuery<{ errors: ErrorRecordRow[]; total: number }>({
    queryKey: [`/api/root/errors${queryString ? `?${queryString}` : ""}`],
  });

  return (
    <div className="space-y-6" data-testid="page-root-error-center">
      {/* Beautiful Gradient Header */}
      <div className="gradient-header bg-gradient-to-r from-rose-600 to-red-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">⚠️ Error Center</h1>
        <p className="text-rose-100 mt-1">Platform error aggregation • Track and resolve issues</p>
      </div>

      <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={sourceFilter || "all"} onValueChange={(v) => setSourceFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-72" data-testid="select-filter-source">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {error ? (
            <div className="text-destructive text-sm" data-testid="text-errors-error">
              Failed to load error records: {String((error as any).message ?? error)}
            </div>
          ) : isLoading ? (
            <div className="text-muted-foreground text-sm">Loading errors…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Error ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Module / Route</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Correlation ID</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.errors ?? []).map((err) => (
                  <TableRow
                    key={err._id}
                    className="cursor-pointer hover:bg-muted/50"
                    data-testid={`row-error-${err.errorId}`}
                    onClick={() => setSelectedError(err)}
                  >
                    <TableCell className="font-mono text-sm">{err.errorId}</TableCell>
                    <TableCell>
                      <Badge variant={SOURCE_BADGE_VARIANT[err.source] ?? "outline"}>{err.source.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      {err.module ?? "—"} {err.route ? `(${err.route})` : ""}
                    </TableCell>
                    <TableCell>
                      {err.httpMethod ?? ""} {err.httpStatus ?? ""}
                    </TableCell>
                    <TableCell className="max-w-sm truncate">{err.sanitizedMessage}</TableCell>
                    <TableCell className="font-mono text-xs">{err.correlationId}</TableCell>
                    <TableCell>{new Date(err.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {(data?.errors ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No error records match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
        <DialogContent className="max-w-2xl">
          {selectedError && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedError.errorId}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Message:</span> {selectedError.sanitizedMessage}
                </div>
                <div>
                  <span className="font-medium">Tenant:</span> {selectedError.tenantId ?? "—"}
                </div>
                <div>
                  <span className="font-medium">User / Role:</span> {selectedError.userId ?? "—"} / {selectedError.role ?? "—"}
                </div>
                <div>
                  <span className="font-medium">Route:</span> {selectedError.httpMethod ?? ""} {selectedError.route ?? "—"}{" "}
                  {selectedError.httpStatus ? `(${selectedError.httpStatus})` : ""}
                </div>
                <div>
                  <span className="font-medium">Correlation ID:</span>{" "}
                  <span className="font-mono">{selectedError.correlationId}</span>
                </div>
                <Link href={`/root/diagnostics?correlationId=${encodeURIComponent(selectedError.correlationId)}`}>
                  <Button size="sm" variant="outline" data-testid="button-open-diagnostics" className="mt-2">
                    <Search className="h-4 w-4 mr-2" /> Open Support Diagnostics for this trace
                  </Button>
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
