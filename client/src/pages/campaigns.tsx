import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Megaphone, Plus, Send, Trash2, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  sending: { label: "Sending", className: "bg-amber-100 text-amber-800" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
};

const OFFER_TYPES = [
  { value: "announcement", label: "Announcement (no offer)" },
  { value: "discount_percent", label: "Discount % off" },
  { value: "discount_flat", label: "Flat ₹ off" },
  { value: "reward_bonus_points", label: "Bonus reward points" },
];

function emptyForm() {
  return {
    name: "", description: "", offerType: "announcement", offerValue: "",
    targetType: "segment" as "segment" | "tag", targetKey: "",
    messageTemplate: "Hi {{name}}, {{offer}} — book with us today!",
  };
}

export default function CampaignsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [viewingId, setViewingId] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery<any[]>({ queryKey: ["/api/campaigns"] });
  const { data: segments } = useQuery<any[]>({ queryKey: ["/api/customers/segments"] });
  const { data: tags } = useQuery<any[]>({ queryKey: ["/api/customers/tags"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Campaign name is required");
      if (!form.targetKey) throw new Error("Choose a target segment or tag");
      if (!form.messageTemplate.trim()) throw new Error("Message is required");
      return (await apiRequest("POST", "/api/campaigns", {
        ...form,
        offerValue: form.offerValue ? Number(form.offerValue) : undefined,
      })).json();
    },
    onSuccess: () => {
      toast({ title: "Campaign created as draft" });
      setShowCreate(false);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: (err: any) => toast({ title: "Could not create campaign", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/campaigns/${id}`)).json(),
    onSuccess: () => {
      toast({ title: "Campaign deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: (err: any) => toast({ title: "Could not delete", description: err.message, variant: "destructive" }),
  });

  const targetOptions = form.targetType === "segment"
    ? (segments || []).filter((s: any) => s.key !== "all").map((s: any) => ({ key: s.key, label: `${s.label} (${s.count})` }))
    : (tags || []).map((t: any) => ({ key: t.tag, label: `#${t.tag} (${t.count})` }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns & Offers</h1>
          <p className="text-sm text-gray-500">WhatsApp outreach to a customer segment or tag — consent and Do Not Contact are always enforced at send time.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />New Campaign</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{(campaigns || []).length} campaign{(campaigns || []).length === 1 ? "" : "s"}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Megaphone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p>No campaigns yet</p>
              <p className="text-sm">Create one to reach a customer segment or tag.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent / Failed</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c: any) => {
                    const badge = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
                    return (
                      <TableRow key={c._id} className="cursor-pointer hover:bg-gray-50" onClick={() => setViewingId(c._id)}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="capitalize">{c.targetType}: {c.targetKey.replace(/_/g, " ")}</TableCell>
                        <TableCell><Badge className={badge.className}>{badge.label}</Badge></TableCell>
                        <TableCell>{c.stats ? `${c.stats.sent} / ${c.stats.failed}` : "-"}</TableCell>
                        <TableCell>{new Date(c.createdAt).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {c.status === 'draft' && (
                            <Button size="sm" variant="ghost" className="text-red-600 h-7 px-2" onClick={() => deleteMutation.mutate(c._id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali Offer for Repeat Customers" />
            </div>
            <div>
              <Label>Description (internal)</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Offer Type</Label>
                <Select value={form.offerType} onValueChange={(v) => setForm({ ...form, offerType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OFFER_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.offerType !== "announcement" && (
                <div>
                  <Label>Offer Value</Label>
                  <Input type="number" value={form.offerValue} onChange={(e) => setForm({ ...form, offerValue: e.target.value })} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target Type</Label>
                <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v as any, targetKey: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="segment">Segment</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target</Label>
                <Select value={form.targetKey} onValueChange={(v) => setForm({ ...form, targetKey: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    {targetOptions.map((o: any) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>WhatsApp Message</Label>
              <Textarea rows={4} value={form.messageTemplate} onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })} />
              <p className="text-xs text-gray-500 mt-1">Use {"{{name}}"} for the customer's name and {"{{offer}}"} for the offer text.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>Save as Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewingId && <CampaignDetail campaignId={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
}

function CampaignDetail({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaign } = useQuery<any>({ queryKey: [`/api/campaigns/${campaignId}`] });
  const { data: preview } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/preview`],
    enabled: !!campaign && campaign.status === 'draft',
  });
  const { data: recipients } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/recipients`],
    enabled: !!campaign && campaign.status !== 'draft',
  });

  const sendMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/campaigns/${campaignId}/send`)).json(),
    onSuccess: (data: any) => {
      toast({ title: "Campaign sent", description: `${data.stats?.sent || 0} sent, ${data.stats?.failed || 0} failed, ${data.stats?.excludedOptedOut || 0} excluded (consent).` });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/recipients`] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: (err: any) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  if (!campaign) return null;
  const badge = STATUS_BADGE[campaign.status] || STATUS_BADGE.draft;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {campaign.name} <Badge className={badge.className}>{badge.label}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{campaign.messageTemplate}</div>
          <p className="text-sm text-gray-500 capitalize">Target: {campaign.targetType} — {campaign.targetKey.replace(/_/g, " ")}</p>

          {campaign.status === 'draft' && preview && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <Label className="text-xs text-gray-500">Eligible</Label>
                <p className="text-lg font-semibold text-green-700">{preview.eligible}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <Label className="text-xs text-gray-500">Excluded (Consent/DNC)</Label>
                <p className="text-lg font-semibold text-amber-700">{preview.excludedOptedOut}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <Label className="text-xs text-gray-500">Excluded (No Valid Phone)</Label>
                <p className="text-lg font-semibold text-red-700">{preview.excludedInvalidPhone}</p>
              </div>
            </div>
          )}

          {campaign.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-green-50 rounded-lg p-3"><Label className="text-xs text-gray-500">Sent</Label><p className="text-lg font-semibold text-green-700">{campaign.stats.sent}</p></div>
              <div className="bg-red-50 rounded-lg p-3"><Label className="text-xs text-gray-500">Failed</Label><p className="text-lg font-semibold text-red-700">{campaign.stats.failed}</p></div>
              <div className="bg-amber-50 rounded-lg p-3"><Label className="text-xs text-gray-500">Excluded (Consent)</Label><p className="text-lg font-semibold text-amber-700">{campaign.stats.excludedOptedOut}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><Label className="text-xs text-gray-500">Total Targeted</Label><p className="text-lg font-semibold">{campaign.stats.totalTargeted}</p></div>
            </div>
          )}

          {recipients && recipients.length > 0 && (
            <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
              {recipients.map((r: any) => (
                <div key={r._id} className="flex items-center justify-between p-2 text-sm">
                  <span>{r.customerId?.name || "Unknown"} <span className="text-gray-400">({r.phone})</span></span>
                  <Badge variant="outline" className="capitalize">{r.status.replace(/_/g, " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {campaign.status === 'draft' && (
            <Button disabled={sendMutation.isPending || !preview?.eligible} onClick={() => sendMutation.mutate()}>
              <Send className="w-4 h-4 mr-1.5" />Send to {preview?.eligible ?? "..."} customers
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
