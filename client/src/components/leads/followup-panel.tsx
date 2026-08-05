import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const FOLLOWUP_TYPES = ["Call", "WhatsApp", "Email", "Meeting", "Quotation Follow-up", "Customer Decision", "Price Negotiation", "Payment Follow-up", "Future Travel Requirement", "Custom"];
const OUTCOMES = ["connected", "no_answer", "callback_requested", "quotation_requested", "negotiation", "confirmed", "not_interested", "postponed", "lost"];

const OUTCOME_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary", connected: "default", no_answer: "outline", callback_requested: "outline",
  quotation_requested: "outline", negotiation: "outline", confirmed: "default",
  not_interested: "destructive", postponed: "outline", lost: "destructive",
};

function isOverdue(scheduledAt: string) {
  return new Date(scheduledAt).getTime() < Date.now();
}

export default function FollowUpPanel({ leadId }: { leadId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [type, setType] = useState("Call");
  const [scheduledAt, setScheduledAt] = useState("");
  const [purpose, setPurpose] = useState("");
  const [completing, setCompleting] = useState<any>(null);
  const [outcome, setOutcome] = useState("connected");
  const [customerResponse, setCustomerResponse] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");

  const { data: followUps = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/leads/${leadId}/followups`],
    queryFn: async () => (await apiRequest("GET", `/api/leads/${leadId}/followups`)).json(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/followups`] });

  const createMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/leads/${leadId}/followups`, { type, scheduledAt, purpose })).json(),
    onSuccess: () => {
      invalidate();
      setShowNew(false);
      setPurpose("");
      setScheduledAt("");
      toast({ variant: "success", title: "Follow-up scheduled" });
    },
    onError: (error: any) => toast({ title: "Could not schedule follow-up", description: error.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = { outcome, customerResponse };
      if (nextFollowUpAt) body.nextFollowUpAt = nextFollowUpAt;
      return (await apiRequest("POST", `/api/followups/${completing._id}/complete`, body)).json();
    },
    onSuccess: () => {
      invalidate();
      setCompleting(null);
      setCustomerResponse("");
      setNextFollowUpAt("");
      toast({ variant: "success", title: "Follow-up completed" });
    },
    onError: (error: any) => toast({ title: "Could not complete follow-up", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-gray-700">Follow-ups</h3>
        <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>Schedule Follow-up</Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse h-12 bg-gray-100 rounded-lg" />
      ) : followUps.length === 0 ? (
        <p className="text-sm text-gray-500">No follow-ups scheduled.</p>
      ) : (
        <div className="space-y-2">
          {followUps.map((f: any) => (
            <Card key={f._id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {f.type}
                    {f.outcome === "pending" && isOverdue(f.scheduledAt) && <Badge variant="destructive" className="ml-2 text-xs">Overdue</Badge>}
                  </div>
                  <div className="text-xs text-gray-500">{new Date(f.scheduledAt).toLocaleString("en-IN")}{f.purpose ? ` — ${f.purpose}` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={OUTCOME_BADGE[f.outcome] || "secondary"} className="capitalize text-xs">{f.outcome.replace(/_/g, " ")}</Badge>
                  {f.outcome === "pending" && <Button size="sm" variant="ghost" onClick={() => setCompleting(f)}>Complete</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fu-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="fu-type"><SelectValue /></SelectTrigger>
                <SelectContent>{FOLLOWUP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fu-scheduled">Scheduled At</Label>
              <Input id="fu-scheduled" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fu-purpose">Purpose</Label>
              <Textarea id="fu-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Follow up on quotation QUO-0001" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button disabled={!scheduledAt || createMutation.isPending} onClick={() => createMutation.mutate()}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completing} onOpenChange={(open) => !open && setCompleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fu-outcome">Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger id="fu-outcome"><SelectValue /></SelectTrigger>
                <SelectContent>{OUTCOMES.map((o) => <SelectItem key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fu-response">Customer Response</Label>
              <Textarea id="fu-response" value={customerResponse} onChange={(e) => setCustomerResponse(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fu-next">Schedule Next Follow-up (optional)</Label>
              <Input id="fu-next" type="datetime-local" value={nextFollowUpAt} onChange={(e) => setNextFollowUpAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleting(null)}>Cancel</Button>
            <Button disabled={completeMutation.isPending} onClick={() => completeMutation.mutate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
