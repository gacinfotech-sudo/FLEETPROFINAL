import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Phone, ShieldAlert, Plus, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import {
  CONTACT_CATEGORIES, CONTACT_CATEGORY_LABELS, DEFAULT_CONTACT_THRESHOLD,
  verificationBadgeClass, type ContactCategory,
} from "./driver-domain-constants";

interface Props {
  driverId: string;
}

const emptyForm = {
  fullName: "", relationship: "", contactCategory: "" as ContactCategory | "",
  primaryMobile: "", alternateMobile: "", address: "", occupation: "",
  preferredLanguage: "", emergencyPriority: 1, notes: "",
  consentStatus: "not_requested", notificationStatus: "not_notified",
};

export default function DriverContactsPanel({ driverId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const contactsQuery = useQuery<any>({ queryKey: [`/api/drivers/${driverId}/contacts`] });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/drivers/${driverId}/contacts`] });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/drivers/${driverId}/contacts`, {
        ...form,
        emergencyPriority: Number(form.emergencyPriority) || 1,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Contact added" });
      setForm(emptyForm);
      setShowAddForm(false);
      invalidate();
    },
    onError: (err: any) => {
      const message = String(err.message || "");
      if (message.includes("DUPLICATE_CONTACT_PHONE")) {
        toast({ title: "Duplicate phone number", description: "This phone number is already used by another contact for this driver.", variant: "destructive" });
      } else if (message.includes("CONTACT_POLICY_VIOLATION")) {
        toast({ title: "Contact policy requires more detail", description: "Beyond the default contact limit, a stated business purpose and explicit consent/notification status are required — see tenant contact policy.", variant: "destructive" });
      } else {
        toast({ title: "Could not add contact", description: err.message, variant: "destructive" });
      }
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ contactId, status }: { contactId: string; status: string }) =>
      (await apiRequest("POST", `/api/drivers/${driverId}/contacts/${contactId}/verification`, { status })).json(),
    onSuccess: () => { toast({ title: "Verification status updated" }); invalidate(); },
    onError: (err: any) => toast({ title: "Could not update verification", description: err.message, variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (contactId: string) =>
      (await apiRequest("DELETE", `/api/drivers/${driverId}/contacts/${contactId}`, { reason: "Removed from Driver 360 view" })).json(),
    onSuccess: () => { toast({ title: "Contact deactivated" }); invalidate(); },
    onError: (err: any) => toast({ title: "Could not deactivate contact", description: err.message, variant: "destructive" }),
  });

  if (contactsQuery.isLoading) return <p className="text-sm text-gray-500">Loading contacts…</p>;
  if (contactsQuery.isError) {
    return (
      <p className="text-sm text-gray-500">
        Emergency contacts &amp; references are not available yet — this feature depends on
        TASK-DRIVER-DOMAIN-02's contact API, which isn't mounted on this server build.
      </p>
    );
  }

  const data = contactsQuery.data || {};
  const contacts: any[] = Array.isArray(data) ? data : (data.contacts ?? []);
  const fullListAccess: boolean = Array.isArray(data) ? true : data.fullListAccess !== false;

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Emergency Contacts &amp; References</h3>
          <p className="text-xs text-gray-500">
            {contacts.length} / {DEFAULT_CONTACT_THRESHOLD} PROFILE TARGET — all contacts remain optional; 2 emergency contacts and 2 verified references are recommended before Approved, not required to save.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm((v) => !v)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" /> Add Contact
        </Button>
      </div>

      {!fullListAccess && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex gap-2 text-sm text-amber-800">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Showing only the top-priority emergency contact. Viewing the full contact list requires the Driver Contacts (Full) permission.</p>
        </div>
      )}

      {showAddForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Full Name</Label>
              <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div>
              <Label>Relationship</Label>
              <Input value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))} placeholder="e.g. Brother" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.contactCategory} onValueChange={(v) => setForm((f) => ({ ...f, contactCategory: v as ContactCategory }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CONTACT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CONTACT_CATEGORY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Emergency Priority (1 = call first)</Label>
              <Input type="number" min={1} value={form.emergencyPriority} onChange={(e) => setForm((f) => ({ ...f, emergencyPriority: Number(e.target.value) || 1 }))} />
            </div>
            <div>
              <Label>Primary Mobile</Label>
              <Input value={form.primaryMobile} onChange={(e) => setForm((f) => ({ ...f, primaryMobile: e.target.value }))} />
            </div>
            <div>
              <Label>Alternate Mobile</Label>
              <Input value={form.alternateMobile} onChange={(e) => setForm((f) => ({ ...f, alternateMobile: e.target.value }))} />
            </div>
            <div>
              <Label>Occupation</Label>
              <Input value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} />
            </div>
            <div>
              <Label>Preferred Language</Label>
              <Input value={form.preferredLanguage} onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Up to {DEFAULT_CONTACT_THRESHOLD} contacts per driver — this is a profile target, not a requirement to save.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button
              type="button" size="sm"
              disabled={!form.fullName || !form.primaryMobile || !form.contactCategory || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? "Saving…" : "Save Contact"}
            </Button>
          </div>
        </div>
      )}

      {contacts.length === 0 ? (
        <p className="text-sm text-gray-500">No contacts recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c: any) => (
            <div key={c._id || c.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium truncate">{c.fullName}</p>
                  <Badge variant="outline" className="shrink-0">{CONTACT_CATEGORY_LABELS[c.contactCategory as ContactCategory] || c.contactCategory}</Badge>
                  <Badge variant="outline" className={`shrink-0 ${verificationBadgeClass(c.referenceVerificationStatus)}`}>
                    {c.referenceVerificationStatus || "unverified"}
                  </Badge>
                  <Badge variant="outline" className="shrink-0">Priority {c.emergencyPriority}</Badge>
                  {c.isActive === false && <Badge variant="destructive" className="shrink-0">Inactive</Badge>}
                </div>
                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1"><Phone className="h-3.5 w-3.5" /> {c.primaryMobile}{c.alternateMobile ? ` / ${c.alternateMobile}` : ""}</p>
                {c.relationship && <p className="text-xs text-gray-500">{c.relationship}</p>}
              </div>
              {fullListAccess && c.isActive !== false && (
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" title="Mark verified" onClick={() => verifyMutation.mutate({ contactId: c._id || c.id, status: "verified" })}>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Mark rejected" onClick={() => verifyMutation.mutate({ contactId: c._id || c.id, status: "rejected" })}>
                    <XCircle className="h-4 w-4 text-red-600" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Deactivate" onClick={() => deactivateMutation.mutate(c._id || c.id)}>
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
