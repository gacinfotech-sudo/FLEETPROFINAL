import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bug, Plus, MessageCircle } from "lucide-react";

const SEVERITY_OPTIONS = [
  { value: "low", label: "🟢 Low", color: "bg-green-50 border-green-200" },
  { value: "medium", label: "🟡 Medium", color: "bg-yellow-50 border-yellow-200" },
  { value: "high", label: "🔴 High", color: "bg-red-50 border-red-200" },
  { value: "critical", label: "🔥 Critical", color: "bg-red-100 border-red-300" },
];

const MODULES = [
  "booking", "payments", "reports", "customer", "vehicle", "driver",
  "notifications", "settings", "dashboard", "other"
];

export default function TenantBugReportsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNewReport, setShowNewReport] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState("all");

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    severity: "medium",
    module: "other",
    steps: "",
    screenshotUrl: "",
    affectedData: "",
  });

  const { data: bugReports = [], isLoading } = useQuery({
    queryKey: ["/api/tenant/bug-reports"],
  });

  const createBugMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/tenant/bug-report", {
        ...formData,
        steps: formData.steps.split("\n").filter(s => s.trim()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/bug-reports"] });
      setFormData({
        title: "",
        description: "",
        severity: "medium",
        module: "other",
        steps: "",
        screenshotUrl: "",
        affectedData: "",
      });
      setShowNewReport(false);
      toast({ variant: "success", title: "Bug report submitted", description: "Our team will look into it shortly." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to submit report", description: error.message, variant: "destructive" });
    },
  });

  const filteredReports = bugReports.filter((report: any) =>
    filterSeverity === "all" || report.severity === filterSeverity
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header bg-gradient-to-r from-red-600 to-orange-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">🐛 Bug Reports</h1>
            <p className="text-red-100 mt-1">Report issues & track fixes • Help us improve</p>
          </div>
          <Dialog open={showNewReport} onOpenChange={setShowNewReport}>
            <DialogTrigger asChild>
              <Button className="bg-white text-red-600 hover:bg-red-50 font-semibold">
                <Plus className="w-4 h-4 mr-2" /> Report Bug
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Report a Bug</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Bug Title *</Label>
                  <Input
                    id="title"
                    placeholder="Booking page shows wrong total..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="severity">Severity *</Label>
                    <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
                      <SelectTrigger id="severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="module">Module *</Label>
                    <Select value={formData.module} onValueChange={(v) => setFormData({ ...formData, module: v })}>
                      <SelectTrigger id="module">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODULES.map(m => (
                          <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="What's the issue? What did you expect to happen?"
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="steps">Steps to Reproduce</Label>
                  <Textarea
                    id="steps"
                    placeholder="1. Click on Bookings&#10;2. Select a booking&#10;3. Click Edit..."
                    rows={3}
                    value={formData.steps}
                    onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="screenshot">Screenshot URL</Label>
                    <Input
                      id="screenshot"
                      placeholder="https://..."
                      value={formData.screenshotUrl}
                      onChange={(e) => setFormData({ ...formData, screenshotUrl: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="affectedData">Affected Data (IDs)</Label>
                    <Input
                      id="affectedData"
                      placeholder="Booking ID, Customer ID..."
                      value={formData.affectedData}
                      onChange={(e) => setFormData({ ...formData, affectedData: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowNewReport(false)}>Cancel</Button>
                  <Button
                    onClick={() => createBugMutation.mutate()}
                    disabled={!formData.title || !formData.description || createBugMutation.isPending}
                  >
                    {createBugMutation.isPending ? "Submitting..." : "Submit Report"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">📊 TOTAL REPORTS</p>
            <p className="text-2xl font-bold text-red-600 mt-2">{bugReports.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">🔥 CRITICAL</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">
              {bugReports.filter((r: any) => r.severity === "critical").length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-green-50 border-yellow-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">✅ RESOLVED</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">
              {bugReports.filter((r: any) => r.status === "resolved").length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">👁️ OPEN</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {bugReports.filter((r: any) => r.status === "open").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Button
          variant={filterSeverity === "all" ? "default" : "outline"}
          onClick={() => setFilterSeverity("all")}
          size="sm"
        >
          All
        </Button>
        {SEVERITY_OPTIONS.map(opt => (
          <Button
            key={opt.value}
            variant={filterSeverity === opt.value ? "default" : "outline"}
            onClick={() => setFilterSeverity(opt.value)}
            size="sm"
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Bug Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bug className="w-12 h-12 mx-auto opacity-20 mb-2" />
              <p className="font-medium">No bug reports yet</p>
              <p className="text-sm">Found an issue? Report it to help us improve!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responses</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report: any) => (
                    <TableRow key={report._id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{report.title}</TableCell>
                      <TableCell className="capitalize">{report.module}</TableCell>
                      <TableCell>
                        <Badge variant={
                          report.severity === "critical" ? "destructive" :
                          report.severity === "high" ? "default" :
                          "secondary"
                        }>
                          {report.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.status}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <MessageCircle className="w-4 h-4" />
                          {report.responses?.length || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline">View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
