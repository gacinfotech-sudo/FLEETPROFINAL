import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Gift, Users, TrendingUp, IndianRupee, Clock, RefreshCcw, Star,
  AlertTriangle, UserPlus, Award,
} from "lucide-react";

interface DashboardData {
  totalPointsIssued: number;
  pointsRedeemed: number;
  pointsReversed: number;
  pointsExpiringSoon: number;
  pointsPendingReferral: number;
  activeReferrers: number;
  newReferralsThisMonth: number;
  referralBookings: number;
  referralRevenue: number;
  topReferrers: { customerId: string; name: string; primaryMobile?: string; referralCount: number }[];
  verifiedReviews: number;
  reviewRewardPoints: number;
  suspiciousReferrals: number;
}

type FilterKind =
  | { kind: "referral"; status?: string; label: string }
  | { kind: "transaction"; transactionType?: string; expiringWithinDays?: number; label: string }
  | null;

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  captured: "secondary", booking_confirmed: "outline", booking_completed: "default",
  invalid: "destructive", duplicate: "destructive", self_referral: "destructive",
  cancelled: "destructive", reversed: "destructive", fraud_review: "destructive",
};

// Every metric card is clickable (spec §29) — sets `filter`, which loads
// and renders a real, filtered table of the underlying Referral or
// RewardTransaction rows below the grid. No card shows a number without
// a way to see exactly which records it's made of.
export default function RewardsReferralsDashboard() {
  const [filter, setFilter] = useState<FilterKind>(null);

  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ["/api/rewards-referral-dashboard"] });

  const { data: referralRows } = useQuery<any[]>({
    queryKey: ["/api/referrals", filter?.kind === "referral" ? filter.status : undefined],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter?.kind === "referral" && filter.status) params.set("status", filter.status);
      const res = await fetch(`/api/referrals?${params.toString()}`, { credentials: "include" });
      return res.json();
    },
    enabled: filter?.kind === "referral",
  });

  const { data: transactionRows } = useQuery<any[]>({
    queryKey: ["/api/reward-transactions", filter?.kind === "transaction" ? filter.transactionType : undefined, filter?.kind === "transaction" ? filter.expiringWithinDays : undefined],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter?.kind === "transaction") {
        if (filter.transactionType) params.set("transactionType", filter.transactionType);
        if (filter.expiringWithinDays) params.set("expiringWithinDays", String(filter.expiringWithinDays));
      }
      const res = await fetch(`/api/reward-transactions?${params.toString()}`, { credentials: "include" });
      return res.json();
    },
    enabled: filter?.kind === "transaction",
  });

  const cards: { key: string; label: string; value: string; icon: any; color: string; onClick: FilterKind }[] = data ? [
    { key: "issued", label: "Total Points Issued", value: String(data.totalPointsIssued), icon: Gift, color: "text-emerald-600",
      onClick: { kind: "transaction", transactionType: "booking_reward,repeat_booking_bonus,referral_bonus,review_bonus,campaign_reward,manual_credit", label: "Points Issued" } },
    { key: "pending", label: "Points Pending", value: String(data.pointsPendingReferral), icon: Clock, color: "text-amber-600",
      onClick: { kind: "referral", status: "captured", label: "Referrals Awaiting Booking Completion" } },
    { key: "redeemed", label: "Points Redeemed", value: String(data.pointsRedeemed), icon: IndianRupee, color: "text-blue-600",
      onClick: { kind: "transaction", transactionType: "redemption", label: "Redemptions" } },
    { key: "expiring", label: "Points Expiring (30d)", value: String(data.pointsExpiringSoon), icon: AlertTriangle, color: "text-orange-600",
      onClick: { kind: "transaction", expiringWithinDays: 30, label: "Points Expiring Within 30 Days" } },
    { key: "reversed", label: "Reversed Rewards", value: String(data.pointsReversed), icon: RefreshCcw, color: "text-red-600",
      onClick: { kind: "transaction", transactionType: "reversal", label: "Reversed Transactions" } },
    { key: "activeReferrers", label: "Active Referrers", value: String(data.activeReferrers), icon: Users, color: "text-emerald-600",
      onClick: { kind: "referral", label: "All Referrals" } },
    { key: "newReferrals", label: "New Referrals (This Month)", value: String(data.newReferralsThisMonth), icon: UserPlus, color: "text-emerald-600",
      onClick: { kind: "referral", label: "All Referrals" } },
    { key: "referralBookings", label: "Referral Bookings", value: String(data.referralBookings), icon: TrendingUp, color: "text-purple-600",
      onClick: { kind: "referral", status: "booking_confirmed", label: "Referrals With a Linked Booking" } },
    { key: "referralRevenue", label: "Referral Revenue", value: `₹${data.referralRevenue.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-purple-600", onClick: null },
    { key: "verifiedReviews", label: "Verified Reviews", value: String(data.verifiedReviews), icon: Star, color: "text-amber-600", onClick: null },
    { key: "reviewRewards", label: "Review Rewards", value: String(data.reviewRewardPoints), icon: Award, color: "text-amber-600",
      onClick: { kind: "transaction", transactionType: "review_bonus", label: "Review Reward Transactions" } },
    { key: "suspicious", label: "Suspicious Referrals", value: String(data.suspiciousReferrals), icon: AlertTriangle, color: "text-red-600",
      onClick: { kind: "referral", status: "self_referral,duplicate,fraud_review", label: "Suspicious Referrals" } },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Rewards &amp; Referrals</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="animate-pulse h-24 bg-gray-100 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map((card) => {
            const Icon = card.icon;
            const isActive = filter && card.onClick && JSON.stringify(filter) === JSON.stringify(card.onClick);
            return (
              <button
                key={card.key}
                type="button"
                disabled={!card.onClick}
                onClick={() => card.onClick && setFilter(card.onClick)}
                className={`text-left rounded-lg border bg-white p-4 transition-all ${
                  card.onClick ? "hover:shadow-md hover:border-gray-300 cursor-pointer" : "cursor-default"
                } ${isActive ? "ring-2 ring-emerald-500 border-emerald-500" : ""}`}
              >
                <Icon className={`h-5 w-5 mb-2 ${card.color}`} />
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {data && data.topReferrers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead className="text-right">Referrals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topReferrers.map((r) => (
                  <TableRow key={r.customerId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-gray-500">{r.primaryMobile || "-"}</TableCell>
                    <TableCell className="text-right font-semibold">{r.referralCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {filter && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{filter.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {filter.kind === "referral" ? (
              (referralRows || []).length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">No matching referrals.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Referrer</TableHead>
                        <TableHead>Referred</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(filter.status ? (referralRows || []).filter((r: any) => filter.status!.split(",").includes(r.status)) : referralRows || []).map((r: any) => (
                        <TableRow key={r._id}>
                          <TableCell>{r.referrerCustomerId?.name || r.referrerDisplaySnapshot?.name || "-"}</TableCell>
                          <TableCell>{r.referredCustomerId?.name || "Pending"}</TableCell>
                          <TableCell className="capitalize">{(r.source || "").replace(/_/g, " ")}</TableCell>
                          <TableCell><Badge variant={STATUS_BADGE[r.status] || "secondary"}>{r.status.replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell className="text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : (
              (transactionRows || []).length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">No matching transactions.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(transactionRows || []).map((t: any) => (
                        <TableRow key={t._id}>
                          <TableCell>{t.customerId?.name || "-"}</TableCell>
                          <TableCell className="capitalize">{(t.transactionType || "").replace(/_/g, " ")}</TableCell>
                          <TableCell className={`text-right font-semibold ${t.points >= 0 ? "text-green-600" : "text-red-600"}`}>{t.points >= 0 ? "+" : ""}{t.points}</TableCell>
                          <TableCell className="text-gray-500 truncate max-w-[200px]">{t.reason || "-"}</TableCell>
                          <TableCell className="text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
