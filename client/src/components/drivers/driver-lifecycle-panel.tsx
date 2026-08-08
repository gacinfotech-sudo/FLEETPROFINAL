import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { GitBranch, ShieldCheck, ShieldX, History } from "lucide-react";
import {
  DEFAULT_LIFECYCLE_STAGE, LIFECYCLE_STAGE_LABELS, ONBOARDING_CHAIN,
  getValidNextStages, lifecycleStageBadgeClass, type LifecycleStage,
} from "./driver-domain-constants";

interface Props {
  driverId: string;
}

export default function DriverLifecyclePanel({ driverId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetStage, setTargetStage] = useState<LifecycleStage | "">("");
  const [reason, setReason] = useState("");

  const stageQuery = useQuery<any>({ queryKey: [`/api/drivers/${driverId}/lifecycle-stage`] });
  const eligibilityQuery = useQuery<any>({ queryKey: [`/api/drivers/${driverId}/assignment-eligibility`] });
  const auditQuery = useQuery<any>({ queryKey: [`/api/drivers/${driverId}/audit-log`] });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/drivers/${driverId}/lifecycle-stage`] });
    queryClient.invalidateQueries({ queryKey: [`/api/drivers/${driverId}/assignment-eligibility`] });
    queryClient.invalidateQueries({ queryKey: [`/api/drivers/${driverId}/audit-log`] });
  };

  const transitionMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/drivers/${driverId}/lifecycle-stage`, { lifecycleStage: targetStage, reason })).json(),
    onSuccess: (result: any) => {
      toast({ title: "Lifecycle stage updated", description: `${LIFECYCLE_STAGE_LABELS[result.previousStage as LifecycleStage] || result.previousStage} → ${LIFECYCLE_STAGE_LABELS[result.newStage as LifecycleStage] || result.newStage}` });
      setTargetStage(""); setReason("");
      invalidateAll();
    },
    onError: (err: any) => {
      const message = String(err.message || "");
      if (message.includes("INVALID_LIFECYCLE_TRANSITION")) {
        toast({ title: "Invalid transition", description: "That stage cannot be reached directly from the current stage.", variant: "destructive" });
      } else {
        toast({ title: "Could not update lifecycle stage", description: err.message, variant: "destructive" });
      }
    },
  });

  if (stageQuery.isLoading) return <p className="text-sm text-gray-500">Loading lifecycle stage…</p>;
  if (stageQuery.isError) {
    return (
      <p className="text-sm text-gray-500">
        Lifecycle stage is not available yet — this feature depends on TASK-DRIVER-DOMAIN-02's
        lifecycle API, which isn't mounted on this server build. Every driver defaults to
        <strong> {LIFECYCLE_STAGE_LABELS[DEFAULT_LIFECYCLE_STAGE]}</strong> until it is.
      </p>
    );
  }

  const currentStage: LifecycleStage = stageQuery.data?.lifecycleStage || DEFAULT_LIFECYCLE_STAGE;
  const nextStages = getValidNextStages(currentStage);
  const chainIndex = ONBOARDING_CHAIN.indexOf(currentStage);
  const eligibility = eligibilityQuery.data;
  const auditEntries: any[] = Array.isArray(auditQuery.data) ? auditQuery.data.slice(0, 5) : [];

  return (
    <div className="space-y-5 min-w-0">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><GitBranch className="h-4 w-4" /> Lifecycle Stage</h3>
        <div className="flex items-center gap-2 mt-2">
          <Badge className={lifecycleStageBadgeClass(currentStage)} variant="outline">{LIFECYCLE_STAGE_LABELS[currentStage]}</Badge>
          {!eligibilityQuery.isError && eligibility && (
            eligibility.eligible ? (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Eligible for assignment
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1">
                <ShieldX className="h-3 w-3" /> Not eligible{eligibility.reason ? `: ${eligibility.reason}` : ""}
              </Badge>
            )
          )}
        </div>

        {chainIndex >= 0 && (
          <div className="mt-3 overflow-x-auto">
            <div className="flex items-center gap-1 w-max">
              {ONBOARDING_CHAIN.map((stage, i) => (
                <div key={stage} className="flex items-center">
                  <div
                    className={`h-2.5 w-8 rounded-full ${i <= chainIndex ? "bg-blue-500" : "bg-gray-200"}`}
                    title={LIFECYCLE_STAGE_LABELS[stage]}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-lg p-3 space-y-2">
        <Label>Transition to a new stage</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={targetStage} onValueChange={(v) => setTargetStage(v as LifecycleStage)}>
            <SelectTrigger className="sm:w-64"><SelectValue placeholder={nextStages.length ? "Select next stage" : "No further transitions available"} /></SelectTrigger>
            <SelectContent>
              {nextStages.map((s) => <SelectItem key={s} value={s}>{LIFECYCLE_STAGE_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)}
            className="min-h-[40px] sm:flex-1"
          />
          <Button
            disabled={!targetStage || transitionMutation.isPending}
            onClick={() => transitionMutation.mutate()}
            className="shrink-0"
          >
            {transitionMutation.isPending ? "Saving…" : "Transition"}
          </Button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><History className="h-4 w-4" /> Recent Lifecycle &amp; Verification Events</h4>
        {auditQuery.isError ? (
          <p className="text-sm text-gray-500">Audit history requires the Manage Drivers permission.</p>
        ) : auditEntries.length === 0 ? (
          <p className="text-sm text-gray-500">No recorded events yet.</p>
        ) : (
          <div className="space-y-1.5">
            {auditEntries.map((entry: any, i: number) => (
              <div key={entry._id || entry.id || i} className="text-sm border rounded-md p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="capitalize">{String(entry.action || "").replace(/_/g, " ")}</span>
                <span className="text-xs text-gray-500">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
