// TASK-ROOT-SALES-CONFIG-04 — Sales / Onboarding CRM: pipeline board.
//
// Not wired into client/src/App.tsx or the sidebar nav (both Integrator-only
// shared files) — see this task's report for the proposed route path
// ("/root/sales") and nav entry. Talks to the routes proposed in
// server/root/routes/sales.ts (also not yet mounted — see report).

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, ArrowRight } from "lucide-react";

const STAGES = [
  "PROSPECT", "DEMO_SCHEDULED", "TRIAL_CREATED", "TRIAL_ACTIVE",
  "NEGOTIATION", "WON", "TENANT_CREATED", "ONBOARDING", "LIVE", "LOST",
] as const;
type Stage = (typeof STAGES)[number];

const NEXT_STAGE: Partial<Record<Stage, Stage>> = {
  PROSPECT: "DEMO_SCHEDULED",
  DEMO_SCHEDULED: "TRIAL_CREATED",
  TRIAL_CREATED: "TRIAL_ACTIVE",
  TRIAL_ACTIVE: "NEGOTIATION",
  NEGOTIATION: "WON",
  ONBOARDING: "LIVE",
};

interface Prospect {
  _id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  stage: Stage;
  dealValueMonthlyUsd?: number;
  assignedTo?: string;
  tenantId?: string;
}

export default function SalesPipeline() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProspect, setNewProspect] = useState({ companyName: "", contactName: "", contactEmail: "" });

  const { data: prospects = [], isLoading } = useQuery<Prospect[]>({
    queryKey: ["/api/root/sales/prospects"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newProspect) => {
      const res = await apiRequest("POST", "/api/root/sales/prospects", data);
      if (!res.ok) throw new Error((await res.json()).message || "Failed to create prospect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/root/sales/prospects"] });
      setShowCreateForm(false);
      setNewProspect({ companyName: "", contactName: "", contactEmail: "" });
      toast({ title: "Prospect created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const advanceStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const res = await apiRequest("PATCH", `/api/root/sales/prospects/${id}`, { stage });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to update stage");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/root/sales/prospects"] });
      toast({ title: "Stage updated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createTenantMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/root/sales/prospects/${id}/create-tenant`, {});
      if (!res.ok) throw new Error((await res.json()).message || "Failed to create tenant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/root/sales/prospects"] });
      toast({ title: "Tenant created", description: "The prospect has moved to TENANT_CREATED." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const byStage = STAGES.reduce<Record<Stage, Prospect[]>>((acc, stage) => {
    acc[stage] = prospects.filter((p) => p.stage === stage);
    return acc;
  }, {} as Record<Stage, Prospect[]>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales &amp; Onboarding Pipeline</h1>
          <p className="text-muted-foreground">Prospects from first contact through to a live tenant.</p>
        </div>
        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-prospect"><Plus className="w-4 h-4 mr-2" />New Prospect</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Prospect</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Company name</Label>
                <Input value={newProspect.companyName} onChange={(e) => setNewProspect({ ...newProspect, companyName: e.target.value })} />
              </div>
              <div>
                <Label>Contact name</Label>
                <Input value={newProspect.contactName} onChange={(e) => setNewProspect({ ...newProspect, contactName: e.target.value })} />
              </div>
              <div>
                <Label>Contact email</Label>
                <Input type="email" value={newProspect.contactEmail} onChange={(e) => setNewProspect({ ...newProspect, contactEmail: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate(newProspect)} disabled={createMutation.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading prospects…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {STAGES.filter((s) => s !== "LOST").map((stage) => (
            <Card key={stage} data-testid={`column-${stage}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{stage.replace(/_/g, " ")}</span>
                  <Badge variant="secondary">{byStage[stage].length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {byStage[stage].map((p) => (
                  <div key={p._id} className="rounded border p-2 text-sm space-y-1" data-testid={`prospect-${p._id}`}>
                    <div className="font-medium flex items-center gap-1"><Building2 className="w-3 h-3" />{p.companyName}</div>
                    <div className="text-xs text-muted-foreground">{p.contactName}</div>
                    {stage === "WON" && (
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full mt-1"
                        onClick={() => createTenantMutation.mutate(p._id)}
                        disabled={createTenantMutation.isPending}
                        data-testid={`button-create-tenant-${p._id}`}
                      >
                        Create Tenant
                      </Button>
                    )}
                    {NEXT_STAGE[stage] && stage !== "WON" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-1"
                        onClick={() => advanceStageMutation.mutate({ id: p._id, stage: NEXT_STAGE[stage]! })}
                        disabled={advanceStageMutation.isPending}
                      >
                        <ArrowRight className="w-3 h-3 mr-1" />{NEXT_STAGE[stage]!.replace(/_/g, " ")}
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
