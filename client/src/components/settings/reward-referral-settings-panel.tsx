import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Gift } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";

interface Props {
  userRole: string;
}

const EVENT_LABELS: Record<string, { label: string; description: string }> = {
  "referral.registered": { label: "Successful Referral Registered", description: "Paid to the referrer the moment a referral is captured — before the referred person ever books anything." },
  "referral.booking_confirmed": { label: "Referred Booking Confirmed", description: "Optional — paid when the referred person's booking is confirmed (before it completes). 0 points disables this event." },
  "referral.booking_completed": { label: "Referred Booking Completed", description: "Paid to the referrer once the referred person's booking is fully completed." },
  "review.verified": { label: "Verified Review Submitted", description: "Paid once a customer's review is verified — regardless of star rating, so this recognizes honest participation, not just praise." },
};

// This project's own "no rule configured yet" == "using the shown
// defaults" convention (server/services/rewardService.ts /
// referralService.ts) — the form is always populated, never blank while
// waiting for a tenant to have customized anything.
export default function RewardReferralSettingsPanel({ userRole }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasAccess = userRole === "client" || userRole === "admin";

  const [ruleForm, setRuleForm] = useState<Record<string, any>>({});
  const [ruleLoaded, setRuleLoaded] = useState(false);
  const { data: rewardRule } = useQuery<any>({ queryKey: ["/api/reward-rules"], enabled: hasAccess });
  useEffect(() => { if (rewardRule && !ruleLoaded) { setRuleForm(rewardRule); setRuleLoaded(true); } }, [rewardRule, ruleLoaded]);

  const [eventForm, setEventForm] = useState<Record<string, any>>({});
  const [eventLoaded, setEventLoaded] = useState(false);
  const { data: eventRules } = useQuery<any[]>({ queryKey: ["/api/reward-event-rules"], enabled: hasAccess });
  useEffect(() => {
    if (eventRules && !eventLoaded) {
      const byKey: Record<string, any> = {};
      for (const r of eventRules) byKey[r.eventKey] = r;
      setEventForm(byKey);
      setEventLoaded(true);
    }
  }, [eventRules, eventLoaded]);

  // Auto-save rule form
  const { save: autoSaveRule } = useFormAutoSave("reward-referral-settings-rule", ruleForm, 2000);
  useEffect(() => {
    if (ruleLoaded) autoSaveRule();
  }, [ruleForm, autoSaveRule, ruleLoaded]);

  // Auto-save event form
  const { save: autoSaveEvent } = useFormAutoSave("reward-referral-settings-event", eventForm, 2000);
  useEffect(() => {
    if (eventLoaded) autoSaveEvent();
  }, [eventForm, autoSaveEvent, eventLoaded]);

  const saveRuleMutation = useMutation({
    mutationFn: async () => (await apiRequest("PUT", "/api/reward-rules", ruleForm)).json(),
    onSuccess: (result: any) => {
      toast({ title: "Booking reward rule saved" });
      setRuleForm(result);
      queryClient.invalidateQueries({ queryKey: ["/api/reward-rules"] });
    },
    onError: (error: any) => toast({ title: "Could not save reward rule", description: error.message, variant: "destructive" }),
  });

  const saveEventMutation = useMutation({
    mutationFn: async (eventKey: string) => {
      const row = eventForm[eventKey] || {};
      return (await apiRequest("PUT", `/api/reward-event-rules/${eventKey}`, {
        points: row.points, awardTiming: row.awardTiming, enabled: row.enabled,
        maximumPerCustomer: row.maximumPerCustomer, maximumPerMonth: row.maximumPerMonth,
      })).json();
    },
    onSuccess: (result: any) => {
      toast({ title: `${EVENT_LABELS[result.eventKey]?.label || result.eventKey} saved` });
      setEventForm((f) => ({ ...f, [result.eventKey]: result }));
      queryClient.invalidateQueries({ queryKey: ["/api/reward-event-rules"] });
    },
    onError: (error: any) => toast({ title: "Could not save event rule", description: error.message, variant: "destructive" }),
  });

  const setRule = (key: string, value: any) => setRuleForm((f) => ({ ...f, [key]: value }));
  const setEvent = (eventKey: string, key: string, value: any) => setEventForm((f) => ({ ...f, [eventKey]: { ...f[eventKey], [key]: value } }));

  if (!hasAccess) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-lg">
          <Gift className="text-emerald-600" size={20} />
          <span>Rewards and Referrals</span>
        </CardTitle>
        <p className="text-sm text-gray-500">
          Configure how customers earn and redeem points. Existing customer balances and ledger history are never
          affected by changing these rules — only new events use the updated values.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-medium text-gray-900 mb-1">Booking Rewards</h4>
          <p className="text-xs text-gray-500 mb-3">Points earned per completed booking, and the value/limits of redeeming them.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rrs-earningRatePerAmount">Points Earned</Label>
              <Input id="rrs-earningRatePerAmount" type="number" step="0.1" value={ruleForm.earningRatePerAmount ?? ""} onChange={(e) => setRule("earningRatePerAmount", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="rrs-earningRateBaseAmount">Per ₹ Spent</Label>
              <Input id="rrs-earningRateBaseAmount" type="number" step="1" value={ruleForm.earningRateBaseAmount ?? ""} onChange={(e) => setRule("earningRateBaseAmount", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="rrs-redemptionValuePerPoint">Redemption Value (₹ per point)</Label>
              <Input id="rrs-redemptionValuePerPoint" type="number" step="0.1" value={ruleForm.redemptionValuePerPoint ?? ""} onChange={(e) => setRule("redemptionValuePerPoint", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="rrs-minPointsToRedeem">Minimum Points to Redeem</Label>
              <Input id="rrs-minPointsToRedeem" type="number" step="1" value={ruleForm.minPointsToRedeem ?? ""} onChange={(e) => setRule("minPointsToRedeem", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="rrs-maxRedemptionPercentOfBooking">Max Redemption (% of Booking)</Label>
              <Input id="rrs-maxRedemptionPercentOfBooking" type="number" step="1" value={ruleForm.maxRedemptionPercentOfBooking ?? ""} onChange={(e) => setRule("maxRedemptionPercentOfBooking", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="rrs-expiryDays">Points Expire After (days, blank = never)</Label>
              <Input id="rrs-expiryDays" type="number" step="1" value={ruleForm.expiryDays ?? ""} onChange={(e) => setRule("expiryDays", e.target.value === "" ? undefined : Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="rrs-repeatBookingBonusPoints">Repeat-Booking Bonus Points</Label>
              <Input id="rrs-repeatBookingBonusPoints" type="number" step="0.5" value={ruleForm.repeatBookingBonusPoints ?? ""} onChange={(e) => setRule("repeatBookingBonusPoints", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="rrs-repeatBookingBonusThreshold">...After This Many Completed Bookings</Label>
              <Input id="rrs-repeatBookingBonusThreshold" type="number" step="1" value={ruleForm.repeatBookingBonusThreshold ?? ""} onChange={(e) => setRule("repeatBookingBonusThreshold", Number(e.target.value))} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button size="sm" disabled={saveRuleMutation.isPending} onClick={() => saveRuleMutation.mutate()}>
              {saveRuleMutation.isPending ? "Saving..." : "Save Booking Rewards"}
            </Button>
          </div>
        </div>

        <div className="border-t pt-6">
          <h4 className="font-medium text-gray-900 mb-1">Referral &amp; Review Events</h4>
          <p className="text-xs text-gray-500 mb-3">
            Independently configurable, fractional points allowed (e.g. 0.5). Each event's points accumulate
            separately in the customer's reward ledger — e.g. 0.5 + 0.5 + 0.5 = 1.5 across three different events.
          </p>
          <div className="space-y-3">
            {Object.keys(EVENT_LABELS).map((eventKey) => {
              const row = eventForm[eventKey] || {};
              return (
                <div key={eventKey} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{EVENT_LABELS[eventKey].label}</p>
                      <p className="text-xs text-gray-500">{EVENT_LABELS[eventKey].description}</p>
                    </div>
                    <Switch checked={row.enabled ?? true} onCheckedChange={(checked) => setEvent(eventKey, "enabled", checked)} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label htmlFor={`rrs-ev-${eventKey}-points`} className="text-xs">Points</Label>
                      <Input id={`rrs-ev-${eventKey}-points`} type="number" step="0.1" min={0} value={row.points ?? 0.5} onChange={(e) => setEvent(eventKey, "points", Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor={`rrs-ev-${eventKey}-maxPerCustomer`} className="text-xs">Max per Customer (lifetime)</Label>
                      <Input id={`rrs-ev-${eventKey}-maxPerCustomer`} type="number" step="1" placeholder="No limit" value={row.maximumPerCustomer ?? ""} onChange={(e) => setEvent(eventKey, "maximumPerCustomer", e.target.value === "" ? undefined : Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor={`rrs-ev-${eventKey}-maxPerMonth`} className="text-xs">Max per Month (tenant-wide)</Label>
                      <Input id={`rrs-ev-${eventKey}-maxPerMonth`} type="number" step="1" placeholder="No limit" value={row.maximumPerMonth ?? ""} onChange={(e) => setEvent(eventKey, "maximumPerMonth", e.target.value === "" ? undefined : Number(e.target.value))} />
                    </div>
                    <div className="flex items-end">
                      <Button id={`rrs-ev-${eventKey}-save`} size="sm" variant="outline" className="w-full" disabled={saveEventMutation.isPending} onClick={() => saveEventMutation.mutate(eventKey)}>
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
