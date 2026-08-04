import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS = ['pending', 'contacted', 'follow_up_required', 'resolved', 'closed', 'no_response', 'do_not_contact'];

function deriveDisplayStatus(task: any): { label: string; className: string } {
  if (task.status !== 'pending') {
    const map: Record<string, { label: string; className: string }> = {
      contacted: { label: "Contacted", className: "bg-blue-100 text-blue-800" },
      follow_up_required: { label: "Follow-up Required", className: "bg-yellow-100 text-yellow-800" },
      resolved: { label: "Resolved", className: "bg-green-100 text-green-800" },
      closed: { label: "Closed", className: "bg-gray-100 text-gray-600" },
      no_response: { label: "No Response", className: "bg-orange-100 text-orange-800" },
      do_not_contact: { label: "Do Not Contact", className: "bg-red-100 text-red-800" },
    };
    return map[task.status] || { label: task.status, className: "bg-gray-100 text-gray-600" };
  }
  // "Due Today" / "Overdue" are derived from dueDate, not stored — the
  // stored status stays 'pending' until someone actually acts on it.
  const due = new Date(task.dueDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due.getTime() < today.getTime()) return { label: "Overdue", className: "bg-red-100 text-red-800" };
  if (due.getTime() === today.getTime()) return { label: "Due Today", className: "bg-amber-100 text-amber-800" };
  return { label: "Pending", className: "bg-gray-100 text-gray-600" };
}

export default function AfterSalesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/follow-ups", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/follow-ups${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch follow-up tasks");
      return res.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) =>
      (await apiRequest("PUT", `/api/follow-ups/${taskId}`, { status })).json(),
    onSuccess: () => {
      toast({ title: "Task updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/follow-ups"] });
    },
    onError: (err: any) => toast({ title: "Could not update task", description: err.message, variant: "destructive" }),
  });

  const tasks = data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">After-Sales</h1>
          <p className="text-sm text-gray-500">Auto-created for every completed trip — confirm safe completion, ask for feedback, follow up.</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{tasks.length} task{tasks.length === 1 ? "" : "s"}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>
          ) : tasks.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p>No follow-up tasks</p>
              <p className="text-sm">Tasks are created automatically when a booking is completed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((t: any) => {
                    const display = deriveDisplayStatus(t);
                    return (
                      <TableRow key={t._id}>
                        <TableCell className="font-medium">{t.customerId?.name || "-"}</TableCell>
                        <TableCell>{t.taskType}</TableCell>
                        <TableCell className="capitalize">{t.priority}</TableCell>
                        <TableCell>{new Date(t.dueDate).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell><Badge className={display.className}>{display.label}</Badge></TableCell>
                        <TableCell>
                          {!['resolved', 'closed'].includes(t.status) && (
                            <Select value={t.status} onValueChange={(status) => updateStatus.mutate({ taskId: t._id, status })}>
                              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
