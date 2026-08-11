// Operations → Booking End Reminders (spec §11, §62): tenant-configurable
// escalation stages, separately for Self Drive and With Driver, plus grace,
// turnaround buffer, timezone, and the internal WhatsApp number. Owner-only
// (server enforces role too).

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Stage {
  minutesBefore: number;
  enabled: boolean;
  whatsappInternal?: boolean;
  whatsappCustomer?: boolean;
  whatsappDriver?: boolean;
}

interface SettingsResponse {
  policy: {
    timezone: string;
    graceMinutes: number;
    turnaroundBufferMinutes: number;
    selfDriveStages: Stage[];
    withDriverStages: Stage[];
    whatsappInternalPhone?: string;
  };
}

function StageEditor({ title, stages, mode, onChange }: {
  title: string;
  stages: Stage[];
  mode: "self_drive" | "with_driver";
  onChange: (stages: Stage[]) => void;
}) {
  const update = (i: number, patch: Partial<Stage>) => {
    const next = stages.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      <div className="space-y-1.5">
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-sm rounded-md border border-gray-100 px-2 py-1.5 flex-wrap">
            <Switch checked={s.enabled} onCheckedChange={(v) => update(i, { enabled: v })} />
            <span className="w-24 font-medium">{s.minutesBefore >= 60 ? `${s.minutesBefore / 60}h before` : `${s.minutesBefore}m before`}</span>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={!!s.whatsappInternal} onChange={(e) => update(i, { whatsappInternal: e.target.checked })} />
              WhatsApp staff
            </label>
            {mode === "self_drive" ? (
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={!!s.whatsappCustomer} onChange={(e) => update(i, { whatsappCustomer: e.target.checked })} />
                WhatsApp customer
              </label>
            ) : (
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={!!s.whatsappDriver} onChange={(e) => update(i, { whatsappDriver: e.target.checked })} />
                WhatsApp driver
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReminderSettingsDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery<SettingsResponse>({
    queryKey: ["/api/tenant/operations-settings"],
    enabled: open,
  });

  const [selfDriveStages, setSelfDriveStages] = useState<Stage[]>([]);
  const [withDriverStages, setWithDriverStages] = useState<Stage[]>([]);
  const [graceMinutes, setGraceMinutes] = useState("15");
  const [turnaround, setTurnaround] = useState("60");
  const [waPhone, setWaPhone] = useState("");
  const [realertMinutes, setRealertMinutes] = useState("30");
  const [reviewUrl, setReviewUrl] = useState("");
  const [sdTemplates, setSdTemplates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.policy) {
      setSelfDriveStages(data.policy.selfDriveStages);
      setWithDriverStages(data.policy.withDriverStages);
      setGraceMinutes(String(data.policy.graceMinutes));
      setTurnaround(String(data.policy.turnaroundBufferMinutes));
      setWaPhone(data.policy.whatsappInternalPhone || "");
      setRealertMinutes(String((data.policy as any).overdueRealertMinutes ?? 30));
      setReviewUrl((data.policy as any).googleReviewUrl || "");
      setSdTemplates(((data as any).raw?.sdTemplates as Record<string, string>) || {});
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/tenant/operations-settings", {
        operationsSettings: {
          graceMinutes: Number(graceMinutes),
          turnaroundBufferMinutes: Number(turnaround),
          whatsappInternalPhone: waPhone,
          overdueRealertMinutes: Number(realertMinutes),
          googleReviewUrl: reviewUrl.trim(),
          sdTemplates,
          selfDriveStages,
          withDriverStages,
        },
      });
      toast({ title: "Reminder settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/operations-settings"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to save settings", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="reminder-settings-dialog">
        <DialogHeader>
          <DialogTitle>Booking End Reminders</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <p className="text-xs text-gray-500">
            Controlled escalation before each booking's scheduled end. The engine fires the most imminent enabled
            stage — acknowledged alerts don't repeat, and critical overdue alerts stay visible until resolved.
          </p>
          <StageEditor title="Self Drive" mode="self_drive" stages={selfDriveStages} onChange={setSelfDriveStages} />
          <StageEditor title="With Driver" mode="with_driver" stages={withDriverStages} onChange={setWithDriverStages} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="grace">Overdue grace (minutes)</Label>
              <Input id="grace" type="number" min="0" value={graceMinutes} onChange={(e) => setGraceMinutes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="turnaround">Turnaround buffer (minutes)</Label>
              <Input id="turnaround" type="number" min="0" value={turnaround} onChange={(e) => setTurnaround(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-phone">Internal WhatsApp number (staff reminders)</Label>
              <Input id="wa-phone" value={waPhone} onChange={(e) => setWaPhone(e.target.value)} placeholder="98xxxxxxxx" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="realert">Overdue re-alert (minutes after acknowledge)</Label>
              <Input id="realert" type="number" min="5" value={realertMinutes} onChange={(e) => setRealertMinutes(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="review-url">Google review link (this company's page — used by review requests)</Label>
              <Input id="review-url" type="url" value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} placeholder="https://g.page/r/.../review" data-testid="settings-review-url" />
            </div>
          </div>

          <details className="rounded-md border border-gray-200 p-3">
            <summary className="text-sm font-semibold cursor-pointer">Customer WhatsApp templates (Self Drive)</summary>
            <p className="text-[11px] text-gray-500 mt-1 mb-2">
              Placeholders: {"{{customerName}} {{vehicle}} {{bookingCode}} {{endTime}} {{balance}} {{refundAmount}} {{kmOut}} {{fuelOut}} {{companyName}}"} — leave blank for the built-in default.
            </p>
            <div className="space-y-2">
              {[
                ["handover_details", "Handover Details"],
                ["return_reminder", "Return Reminder"],
                ["overdue_reminder", "Overdue Reminder"],
                ["extension_payment_request", "Extension Payment Request"],
                ["refund_confirmation", "Refund Confirmation"],
              ].map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <textarea
                    className="w-full text-xs rounded-md border border-gray-200 p-2 min-h-[48px]"
                    value={sdTemplates[key] || ""}
                    onChange={(e) => setSdTemplates({ ...sdTemplates, [key]: e.target.value })}
                    placeholder="(default template)"
                  />
                </div>
              ))}
            </div>
          </details>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} data-testid="save-reminder-settings">{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
