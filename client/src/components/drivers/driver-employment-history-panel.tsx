import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Plus, CheckCircle2, XCircle, Trash2, FileText, ExternalLink } from "lucide-react";
import { verificationBadgeClass } from "./driver-domain-constants";

interface Props {
  driverId: string;
}

const emptyForm = {
  employerName: "", role: "", startDate: "", endDate: "",
  supervisorName: "", supervisorMobile: "",
  experienceLetterLink: "", experienceCertificateLink: "",
  contactForVerification: "", notes: "",
};

export default function DriverEmploymentHistoryPanel({ driverId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const historyQuery = useQuery<any>({ queryKey: [`/api/drivers/${driverId}/employment-history`] });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/drivers/${driverId}/employment-history`] });

  const addMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/drivers/${driverId}/employment-history`, form)).json(),
    onSuccess: () => { toast({ title: "Employment history entry added" }); setForm(emptyForm); setShowAddForm(false); invalidate(); },
    onError: (err: any) => toast({ title: "Could not add entry", description: err.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ entryId, status }: { entryId: string; status: string }) =>
      (await apiRequest("POST", `/api/drivers/${driverId}/employment-history/${entryId}/verification`, { status })).json(),
    onSuccess: () => { toast({ title: "Verification status updated" }); invalidate(); },
    onError: (err: any) => toast({ title: "Could not update verification", description: err.message, variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (entryId: string) =>
      (await apiRequest("DELETE", `/api/drivers/${driverId}/employment-history/${entryId}`, { reason: "Removed from Driver 360 view" })).json(),
    onSuccess: () => { toast({ title: "Entry deactivated" }); invalidate(); },
    onError: (err: any) => toast({ title: "Could not deactivate entry", description: err.message, variant: "destructive" }),
  });

  if (historyQuery.isLoading) return <p className="text-sm text-gray-500">Loading employment history…</p>;
  if (historyQuery.isError) {
    return (
      <p className="text-sm text-gray-500">
        Employment history is not available yet — this feature depends on TASK-DRIVER-DOMAIN-02's
        employment-history API, which isn't mounted on this server build.
      </p>
    );
  }

  const data = historyQuery.data;
  const entries: any[] = Array.isArray(data) ? data : (data?.entries ?? []);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Previous Employment</h3>
          <p className="text-xs text-gray-500">Feeds the Employment Verification lifecycle stage.</p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm((v) => !v)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" /> Add Entry
        </Button>
      </div>

      {showAddForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Employer Name</Label>
              <Input value={form.employerName} onChange={(e) => setForm((f) => ({ ...f, employerName: e.target.value }))} />
            </div>
            <div>
              <Label>Role</Label>
              <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div>
              <Label>Supervisor</Label>
              <Input value={form.supervisorName} onChange={(e) => setForm((f) => ({ ...f, supervisorName: e.target.value }))} placeholder="Supervisor's name" />
            </div>
            <div>
              <Label>Supervisor Mobile</Label>
              <Input type="tel" value={form.supervisorMobile} onChange={(e) => setForm((f) => ({ ...f, supervisorMobile: e.target.value }))} placeholder="+91…" />
            </div>
            <div>
              <Label>Experience Letter</Label>
              <Input value={form.experienceLetterLink} onChange={(e) => setForm((f) => ({ ...f, experienceLetterLink: e.target.value }))} placeholder="Upload / Drive link" />
            </div>
            <div>
              <Label>Experience Certificate</Label>
              <Input value={form.experienceCertificateLink} onChange={(e) => setForm((f) => ({ ...f, experienceCertificateLink: e.target.value }))} placeholder="Upload / Drive link" />
            </div>
            <div className="sm:col-span-2">
              <Label>Employer Reference</Label>
              <Input value={form.contactForVerification} onChange={(e) => setForm((f) => ({ ...f, contactForVerification: e.target.value }))} placeholder="Phone/email of a reference at this employer" />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button
              type="button" size="sm"
              disabled={!form.employerName || !form.startDate || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? "Saving…" : "Save Entry"}
            </Button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No previous employment recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry: any) => (
            <div key={entry._id || entry.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium truncate">{entry.employerName}</p>
                  {entry.role && <Badge variant="outline">{entry.role}</Badge>}
                  <Badge variant="outline" className={verificationBadgeClass(entry.verificationStatus)}>{entry.verificationStatus || "unverified"}</Badge>
                  {entry.isActive === false && <Badge variant="destructive">Inactive</Badge>}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {entry.startDate ? new Date(entry.startDate).toLocaleDateString() : "?"} – {entry.endDate ? new Date(entry.endDate).toLocaleDateString() : "Present"}
                </p>
                {(entry.supervisorName || entry.supervisorMobile) && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    Supervisor: {entry.supervisorName || "—"}{entry.supervisorMobile ? ` · ${entry.supervisorMobile}` : ""}
                  </p>
                )}
                {(entry.experienceLetterLink || entry.experienceCertificateLink) && (
                  <div className="flex flex-wrap gap-3 mt-1">
                    {entry.experienceLetterLink && (
                      <a href={entry.experienceLetterLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Experience Letter <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {entry.experienceCertificateLink && (
                      <a href={entry.experienceCertificateLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Experience Certificate <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
              {entry.isActive !== false && (
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" title="Mark verified" onClick={() => verifyMutation.mutate({ entryId: entry._id || entry.id, status: "verified" })}>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Mark rejected" onClick={() => verifyMutation.mutate({ entryId: entry._id || entry.id, status: "rejected" })}>
                    <XCircle className="h-4 w-4 text-red-600" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Deactivate" onClick={() => deactivateMutation.mutate(entry._id || entry.id)}>
                    <Trash2 className="h-4 w-4 text-gray-500" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
