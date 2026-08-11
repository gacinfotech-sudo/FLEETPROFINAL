// TASK-ROOT-SUPPORT-03 — Root Support Center: ticket list + create + status
// lifecycle transitions.
//
// Not wired into client/src/App.tsx or the sidebar by this task (both are
// Integrator-only shared files) — see this task's report for the exact
// proposed <Route> and sidebar nav entry.
//
// Talks to /api/root/support/tickets (new, additive — see
// server/root/routes/support.ts). Requires an authenticated platform-role
// session; a tenant-scoped session gets 403 from the API (proven in
// server/root/routes/support.test.ts) and this page surfaces that as a
// plain error state rather than assuming success.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, LifeBuoy } from "lucide-react";

const STATUSES = [
  "NEW",
  "INVESTIGATING",
  "WAITING_TENANT",
  "WAITING_EXTERNAL_PROVIDER",
  "FIX_IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const MODULES = [
  "booking",
  "customer",
  "driver",
  "vehicle",
  "vendor",
  "payment",
  "gps",
  "telephony",
  "whatsapp",
  "dashboard",
  "auth",
  "other",
] as const;

const SEVERITY_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  LOW: "secondary",
  MEDIUM: "outline",
  HIGH: "default",
  CRITICAL: "destructive",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ["INVESTIGATING"],
  INVESTIGATING: ["WAITING_TENANT", "WAITING_EXTERNAL_PROVIDER", "FIX_IN_PROGRESS", "RESOLVED"],
  WAITING_TENANT: ["INVESTIGATING", "RESOLVED"],
  WAITING_EXTERNAL_PROVIDER: ["INVESTIGATING", "RESOLVED"],
  FIX_IN_PROGRESS: ["INVESTIGATING", "RESOLVED"],
  RESOLVED: ["CLOSED", "INVESTIGATING"],
  CLOSED: ["INVESTIGATING"],
};

interface SupportTicket {
  _id: string;
  ticketId: string;
  tenantId: string;
  module: string;
  severity: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  assignedAgent?: { userId: string; name?: string };
  timeline: Array<{ status: string; note?: string; changedBy: string; changedAt: string }>;
  createdAt: string;
}

export default function SupportTicketsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [transitionNote, setTransitionNote] = useState("");

  const [form, setForm] = useState({
    tenantId: "",
    module: "booking",
    severity: "MEDIUM",
    category: "",
    subject: "",
    description: "",
  });

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (severityFilter) params.set("severity", severityFilter);
  const queryString = params.toString();

  const { data, isLoading, error } = useQuery<{ tickets: SupportTicket[]; total: number }>({
    queryKey: [`/api/root/support/tickets${queryString ? `?${queryString}` : ""}`],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/root/support/tickets", form);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Ticket created" });
      setShowCreate(false);
      setForm({ tenantId: "", module: "booking", severity: "MEDIUM", category: "", subject: "", description: "" });
      queryClient.invalidateQueries({ queryKey: [`/api/root/support/tickets${queryString ? `?${queryString}` : ""}`] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create ticket", description: String(err.message ?? err), variant: "destructive" });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const res = await apiRequest("PATCH", `/api/root/support/tickets/${id}`, { status, note });
      return res.json();
    },
    onSuccess: (body) => {
      toast({ title: "Ticket updated" });
      setSelectedTicket(body.ticket);
      setTransitionNote("");
      queryClient.invalidateQueries({ queryKey: [`/api/root/support/tickets${queryString ? `?${queryString}` : ""}`] });
    },
    onError: (err: any) => {
      toast({ title: "Transition rejected", description: String(err.message ?? err), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6" data-testid="page-root-support-tickets">
      {/* Beautiful Gradient Header */}
      <div className="gradient-header bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">🆘 Support Center</h1>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold" data-testid="button-new-ticket">
                <Plus className="h-4 w-4 mr-2" /> New Ticket
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tenant ID</Label>
                <Input
                  data-testid="input-ticket-tenant-id"
                  value={form.tenantId}
                  onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                  placeholder="Mongo ObjectId of the tenant"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Module</Label>
                  <Select value={form.module} onValueChange={(v) => setForm({ ...form, module: v })}>
                    <SelectTrigger data-testid="select-ticket-module">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODULES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severity</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger data-testid="select-ticket-severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  data-testid="input-ticket-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div>
                <Label>Subject</Label>
                <Input
                  data-testid="input-ticket-subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  data-testid="input-ticket-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                data-testid="button-submit-ticket"
                disabled={!form.tenantId || !form.category || !form.subject || !form.description || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Create Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-6">

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-56" data-testid="select-filter-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter || "all"} onValueChange={(v) => setSeverityFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-56" data-testid="select-filter-severity">
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {error ? (
            <div className="text-destructive text-sm" data-testid="text-tickets-error">
              Failed to load support tickets: {String((error as any).message ?? error)}
            </div>
          ) : isLoading ? (
            <div className="text-muted-foreground text-sm">Loading tickets…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.tickets ?? []).map((ticket) => (
                  <TableRow
                    key={ticket._id}
                    className="cursor-pointer hover:bg-muted/50"
                    data-testid={`row-ticket-${ticket.ticketId}`}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <TableCell className="font-mono text-sm">{ticket.ticketId}</TableCell>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell>{ticket.module}</TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_BADGE_VARIANT[ticket.severity] ?? "outline"}>{ticket.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ticket.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>{new Date(ticket.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {(data?.tickets ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No support tickets match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedTicket.ticketId} — {selectedTicket.subject}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant="outline">{selectedTicket.status.replace(/_/g, " ")}</Badge>
                </div>

                <div>
                  <Label>Timeline</Label>
                  <div className="space-y-1 mt-1 max-h-40 overflow-y-auto">
                    {selectedTicket.timeline.map((entry, i) => (
                      <div key={i} className="text-xs text-muted-foreground">
                        <span className="font-medium">{entry.status}</span> — {entry.changedBy} —{" "}
                        {new Date(entry.changedAt).toLocaleString()}
                        {entry.note ? ` — ${entry.note}` : ""}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Transition note (optional)</Label>
                  <Textarea
                    data-testid="input-transition-note"
                    value={transitionNote}
                    onChange={(e) => setTransitionNote(e.target.value)}
                    rows={2}
                  />
                  <div className="flex flex-wrap gap-2">
                    {(STATUS_TRANSITIONS[selectedTicket.status] ?? []).map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        data-testid={`button-transition-${next}`}
                        disabled={transitionMutation.isPending}
                        onClick={() =>
                          transitionMutation.mutate({ id: selectedTicket._id, status: next, note: transitionNote || undefined })
                        }
                      >
                        Move to {next.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
