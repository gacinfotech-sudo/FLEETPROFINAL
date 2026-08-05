import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

const TABS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "all", label: "All Pending" },
] as const;

export default function FollowUpsPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overdue");

  const { data: followUps = [], isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ["/api/followups", tab],
    queryFn: async () => (await apiRequest("GET", `/api/followups?due=${tab}`)).json(),
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Follow-ups</h1>
        <p className="text-sm text-gray-500">Pending sales follow-ups across all Leads. Open a lead from Leads to schedule or complete one.</p>
      </div>

      <Card>
        <CardHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              {TABS.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label} ({t.key === tab ? followUps.length : ""})</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-red-600">Couldn't load follow-ups.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="animate-pulse h-14 bg-gray-100 rounded-lg" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followUps.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-12">No follow-ups in this view.</TableCell></TableRow>
                  ) : (
                    followUps.map((f: any) => {
                      const lead = f.leadId || {};
                      const inquiry = lead.inquiryId || {};
                      return (
                        <TableRow key={f._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setLocation("/dashboard/leads")}>
                          <TableCell className="font-medium">{f.type}</TableCell>
                          <TableCell>{lead.leadNumber || "-"}</TableCell>
                          <TableCell>
                            <div className="font-medium">{inquiry.customerName || "-"}</div>
                            <div className="text-sm text-gray-500">{inquiry.primaryMobile || ""}</div>
                          </TableCell>
                          <TableCell>{new Date(f.scheduledAt).toLocaleString("en-IN")}</TableCell>
                          <TableCell><Badge variant={f.priority === "high" ? "destructive" : "secondary"} className="capitalize">{f.priority}</Badge></TableCell>
                          <TableCell>{f.purpose || "-"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
