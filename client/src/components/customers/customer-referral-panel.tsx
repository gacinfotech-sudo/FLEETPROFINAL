import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Share2, Users, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";

interface Props {
  customerId: string;
}

const STATUS_LABEL: Record<string, string> = {
  captured: "Captured", booking_confirmed: "Booking Confirmed", booking_completed: "Booking Completed",
  invalid: "Invalid", duplicate: "Duplicate", self_referral: "Self-Referral",
  cancelled: "Cancelled", reversed: "Reversed", fraud_review: "Fraud Review",
};
const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  captured: "secondary", booking_confirmed: "outline", booking_completed: "default",
  invalid: "destructive", duplicate: "destructive", self_referral: "destructive",
  cancelled: "destructive", reversed: "destructive", fraud_review: "destructive",
};

// Customer 360°'s Referral Summary section (spec §27) — reads the same
// Referral rows and referral code the Add Booking form's capture flow
// and referralService.ts already produce; this panel is display + share
// only, no separate referral logic of its own.
export default function CustomerReferralPanel({ customerId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: customer } = useQuery<any>({ queryKey: [`/api/customers/${customerId}`] });
  const { data: referrals } = useQuery<any[]>({ queryKey: [`/api/customers/${customerId}/referrals`] });

  // Form data for auto-save
  const formData = {
    customerId,
    referralCode: customer?.referralCode || "",
    copied,
  };

  const { save: autoSave } = useFormAutoSave("customer-referral-panel", formData, 2000);

  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  const generateCodeMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/customers/${customerId}/referral-code`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
      toast({ title: "Referral code ready" });
    },
    onError: (error: any) => toast({ title: "Could not generate referral code", description: error.message, variant: "destructive" }),
  });

  const rows = referrals || [];
  // Referred-by-this-customer rows only — a customer's own "I was
  // referred by someone" row (if any) lists them as referredCustomerId,
  // not referrerCustomerId, and belongs to the OTHER person's summary.
  const asReferrer = rows.filter((r: any) => r.referrerCustomerId?._id === customerId || r.referrerCustomerId === customerId);
  const confirmed = asReferrer.filter((r: any) => ["booking_confirmed", "booking_completed"].includes(r.status)).length;
  const completed = asReferrer.filter((r: any) => r.status === "booking_completed").length;
  const invalid = asReferrer.filter((r: any) => ["invalid", "duplicate", "self_referral", "fraud_review"].includes(r.status)).length;
  const rewardsEarnedCount = asReferrer.reduce((sum: number, r: any) => sum + (r.rewardsIssued?.registered ? 1 : 0) + (r.rewardsIssued?.bookingCompleted ? 1 : 0), 0);

  const referralCode: string | undefined = customer?.referralCode;
  const shareText = referralCode
    ? `Refer a friend to ${customer?.name ? "us" : "FleetPro"} and both of you benefit! Use my referral code ${referralCode} when booking.`
    : "";
  const whatsappShareUrl = referralCode ? `https://wa.me/?text=${encodeURIComponent(shareText)}` : undefined;

  const copyCode = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Users className="h-5 w-5 text-emerald-600" /> Referral Program</CardTitle>
        <FormSubmitStatus status={generateCodeMutation.isPending ? "loading" : generateCodeMutation.isSuccess ? "success" : generateCodeMutation.isError ? "error" : "idle"} successMessage="Referral code generated" errorMessage="Failed to generate code" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-white border p-3 flex items-center justify-between gap-3 flex-wrap">
          {referralCode ? (
            <>
              <div>
                <p className="text-xs text-gray-500">Referral Code</p>
                <p className="text-lg font-bold tracking-wider text-emerald-700">{referralCode}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyCode}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                {whatsappShareUrl && (
                  <Button size="sm" asChild>
                    <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer">
                      <Share2 className="h-4 w-4 mr-1" /> Share on WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">No referral code yet.</p>
              <Button size="sm" disabled={generateCodeMutation.isPending} onClick={() => generateCodeMutation.mutate()}>
                {generateCodeMutation.isPending ? "Generating..." : "Generate Referral Code"}
              </Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-white border p-2">
            <p className="text-lg font-bold text-emerald-700">{asReferrer.length}</p>
            <p className="text-[11px] text-gray-500">Total Referrals</p>
          </div>
          <div className="rounded-lg bg-white border p-2">
            <p className="text-lg font-bold text-emerald-700">{confirmed}</p>
            <p className="text-[11px] text-gray-500">Confirmed</p>
          </div>
          <div className="rounded-lg bg-white border p-2">
            <p className="text-lg font-bold text-emerald-700">{completed}</p>
            <p className="text-[11px] text-gray-500">Completed</p>
          </div>
          <div className="rounded-lg bg-white border p-2">
            <p className="text-lg font-bold text-emerald-700">{rewardsEarnedCount}</p>
            <p className="text-[11px] text-gray-500">Rewards Earned</p>
          </div>
        </div>
        {invalid > 0 && (
          <p className="text-xs text-red-600">{invalid} referral{invalid === 1 ? "" : "s"} flagged invalid/duplicate/self-referral.</p>
        )}

        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Referral history</p>
          {asReferrer.length === 0 ? (
            <p className="text-sm text-gray-500 rounded-lg border bg-white p-3">No referrals yet.</p>
          ) : (
            <div className="rounded-lg border bg-white divide-y max-h-44 overflow-y-auto">
              {asReferrer.map((r: any) => (
                <div key={r._id} className="flex justify-between items-center gap-3 p-2.5 text-sm">
                  <div className="min-w-0">
                    {/* referrerDisplaySnapshot is THIS customer's own name
                        (they're the referrer on every row in this list) —
                        never a fallback for who was referred. Until a real
                        Customer record exists on the referred side
                        (referredCustomerId), there's nothing more specific
                        to show than that a referral is pending. */}
                    <p className="font-medium truncate">{r.referredCustomerId?.name || "Referred contact (pending)"}</p>
                    <p className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={STATUS_BADGE[r.status] || "secondary"}>{STATUS_LABEL[r.status] || r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
