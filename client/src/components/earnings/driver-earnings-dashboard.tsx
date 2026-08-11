import React, { useState } from "react";
import {
  useGetProfile,
  useGetAnalytics,
  useGetTaxSummary,
  useGetPendingPayouts,
  useRequestPayout,
} from "../../hooks/useDriverEarnings";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const DriverEarningsDashboard: React.FC = () => {
  const [driverId, setDriverId] = useState("driver_001");
  const [activeTab, setActiveTab] = useState<
    "overview" | "analytics" | "payouts" | "tax"
  >("overview");
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    amount: 0,
    method: "bank_transfer" as const,
  });

  const { data: profile, isLoading: profileLoading } = useGetProfile(driverId);
  const { data: analytics, isLoading: analyticsLoading } = useGetAnalytics(
    driverId
  );
  const { data: taxSummary } = useGetTaxSummary(driverId);
  const { data: payouts = [] } = useGetPendingPayouts(driverId);
  const requestPayout = useRequestPayout();

  if (profileLoading || analyticsLoading) {
    return <LoadingSpinner />;
  }

  const handleRequestPayout = () => {
    if (payoutForm.amount > 0) {
      requestPayout.mutate({
        driverId,
        amount: payoutForm.amount,
        method: payoutForm.method,
      });
      setShowPayoutDialog(false);
      setPayoutForm({ amount: 0, method: "bank_transfer" });
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 min-h-screen p-4 md:p-6 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            💰 Earnings Dashboard
          </h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {driverId}
          </p>
        </div>
        <button
          onClick={() => setShowPayoutDialog(true)}
          className="px-4 md:px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-sm md:text-base"
        >
          💳 Request Payout
        </button>
      </div>

      {/* Key Metrics */}
      {profile && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <div className="bg-gradient-to-br from-emerald-100 to-green-50 dark:from-green-900 dark:to-green-800 rounded-xl shadow-sm p-3 md:p-4 border border-green-200 dark:border-green-700">
            <div className="text-xs md:text-sm text-green-700 dark:text-green-200 font-medium">
              💎 Total Lifetime
            </div>
            <div className="text-lg md:text-3xl font-bold text-green-600 dark:text-green-300 mt-1 md:mt-2">
              {formatCurrency(profile.totalLifetimeEarnings)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-100 to-cyan-50 dark:from-blue-900 dark:to-blue-800 rounded-xl shadow-sm p-3 md:p-4 border border-blue-200 dark:border-blue-700">
            <div className="text-xs md:text-sm text-blue-700 dark:text-blue-200 font-medium">
              📅 This Month
            </div>
            <div className="text-lg md:text-3xl font-bold text-blue-600 dark:text-blue-300 mt-1 md:mt-2">
              {formatCurrency(profile.currentMonthEarnings)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-900 dark:to-orange-800 rounded-xl shadow-sm p-3 md:p-4 border border-orange-200 dark:border-orange-700">
            <div className="text-xs md:text-sm text-orange-700 dark:text-orange-200 font-medium">
              ⏳ Pending
            </div>
            <div className="text-lg md:text-3xl font-bold text-orange-600 dark:text-orange-300 mt-1 md:mt-2">
              {formatCurrency(profile.totalPendingAmount)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-100 to-pink-50 dark:from-purple-900 dark:to-purple-800 rounded-xl shadow-sm p-3 md:p-4 border border-purple-200 dark:border-purple-700">
            <div className="text-xs md:text-sm text-purple-700 dark:text-purple-200 font-medium">
              🎯 Avg Per Ride
            </div>
            <div className="text-lg md:text-3xl font-bold text-purple-600 dark:text-purple-300 mt-1 md:mt-2">
              {formatCurrency(profile.avgEarningsPerRide)}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 md:space-x-4 overflow-x-auto pb-2">
        {["overview", "analytics", "payouts", "tax"].map((tab) => (
          <button
            key={tab}
            onClick={() =>
              setActiveTab(tab as "overview" | "analytics" | "payouts" | "tax")
            }
            className={`px-3 md:px-4 py-2 font-medium text-xs md:text-sm rounded-lg transition-all duration-200 whitespace-nowrap ${
              activeTab === tab
                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && profile && (
        <div className="space-y-3 md:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {/* Profile Info */}
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-sm p-4 md:p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-base md:text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-4">
                👤 Account Status
              </h2>
              <div className="space-y-3 text-xs md:text-sm">
                <div className="flex justify-between items-center p-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">🎯 Status</span>
                  <span className={`font-bold px-3 py-1 rounded-full text-xs ${
                    profile.accountStatus === "active"
                      ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200"
                      : "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200"
                  }`}>
                    {profile.accountStatus.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">🚗 Rides</span>
                  <span className="font-bold text-blue-600 dark:text-blue-300">
                    {profile.totalRidesCompleted}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">⭐ Rating</span>
                  <span className="font-bold text-yellow-600 dark:text-yellow-300">
                    {profile.avgRating.toFixed(1)}/5
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">🏦 Bank</span>
                  <span
                    className={`font-bold px-3 py-1 rounded-full text-xs ${
                      profile.bankAccountVerified
                        ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200"
                        : "bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200"
                    }`}
                  >
                    {profile.bankAccountVerified ? "✓ Verified" : "⏳ Pending"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">📋 Tax</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-300 text-xs md:text-sm">
                    {profile.taxFilingStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Earnings Summary */}
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-sm p-4 md:p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-base md:text-lg font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent mb-4">
                💵 Earnings Summary
              </h2>
              <div className="space-y-3 text-xs md:text-sm">
                <div className="flex justify-between items-center p-2 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">📊 Avg Daily</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-300">
                    {formatCurrency(profile.avgDailyEarnings)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">🎯 Month Rides</span>
                  <span className="font-bold text-teal-600 dark:text-teal-300">
                    {profile.currentMonthRides}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">🗓️ Last Payout</span>
                  <span className="font-bold text-sky-600 dark:text-sky-300 text-xs">
                    {profile.lastPayoutDate
                      ? new Date(profile.lastPayoutDate).toLocaleDateString('en-IN', {day: '2-digit', month: 'short'})
                      : "Never"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">💸 Received</span>
                  <span className="font-bold text-violet-600 dark:text-violet-300">
                    ₹{(profile.totalPayoutsReceived / 100000).toFixed(1)}L
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t-2 border-orange-200 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-gray-300 font-bold">⏳ Pending</span>
                    <span className="font-bold text-lg text-orange-600 dark:text-orange-300">
                      {formatCurrency(profile.totalPendingAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && analytics && (
        <div className="space-y-3 md:space-y-4">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-sm p-4 md:p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-base md:text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-4">
              📊 Earnings Breakdown
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              <div className="p-3 md:p-4 bg-gradient-to-br from-blue-100 to-cyan-50 dark:from-blue-900/40 dark:to-cyan-900/40 rounded-xl border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-700 dark:text-blue-200 font-bold block mb-1">Total</span>
                <div className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-300">
                  {formatCurrency(analytics.totalEarnings)}
                </div>
              </div>
              <div className="p-3 md:p-4 bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/40 dark:to-emerald-900/40 rounded-xl border border-green-200 dark:border-green-700">
                <span className="text-xs text-green-700 dark:text-green-200 font-bold block mb-1">Bonus</span>
                <div className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-300">
                  {formatCurrency(analytics.incentivesEarned)}
                </div>
              </div>
              <div className="p-3 md:p-4 bg-gradient-to-br from-red-100 to-rose-50 dark:from-red-900/40 dark:to-rose-900/40 rounded-xl border border-red-200 dark:border-red-700">
                <span className="text-xs text-red-700 dark:text-red-200 font-bold block mb-1">Commission</span>
                <div className="text-lg md:text-2xl font-bold text-red-600 dark:text-red-300">
                  {formatCurrency(analytics.commissionsDeducted)}
                </div>
              </div>
              <div className="p-3 md:p-4 bg-gradient-to-br from-purple-100 to-pink-50 dark:from-purple-900/40 dark:to-pink-900/40 rounded-xl border border-purple-200 dark:border-purple-700">
                <span className="text-xs text-purple-700 dark:text-purple-200 font-bold block mb-1">Rides</span>
                <div className="text-lg md:text-2xl font-bold text-purple-600 dark:text-purple-300">
                  {analytics.totalRidesCompleted}
                </div>
              </div>
            </div>
          </div>

          {/* Top Earning Days */}
          {analytics.topEarningDays.length > 0 && (
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-sm p-4 md:p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-base md:text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-4">
                🏆 Top Earning Days
              </h2>
              <div className="space-y-2">
                {analytics.topEarningDays.map((day: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-100 dark:border-amber-700 hover:shadow-md transition-shadow">
                    <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 font-medium">
                      {new Date(day.date).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: '2-digit'})}
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-300">
                      {formatCurrency(day.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payouts Tab */}
      {activeTab === "payouts" && (
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 md:p-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
            <h2 className="font-bold text-lg">
              💳 Pending Payouts ({payouts.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {payouts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-2">✨</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No pending payouts</p>
              </div>
            ) : (
              payouts.map((payout: any) => (
                <div key={payout.payoutId} className="p-4 md:p-6 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-green-900/20 dark:hover:to-emerald-900/20 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        {formatCurrency(payout.amount)}
                      </h3>
                      <div className="space-y-1 mt-2 text-xs md:text-sm">
                        <p className="text-gray-600 dark:text-gray-400">
                          🏦 {payout.method.replace(/_/g, " ").toUpperCase()}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400">
                          📅 {new Date(payout.scheduledDate).toLocaleDateString('en-IN', {weekday: 'short', year: '2-digit', month: 'short', day: '2-digit'})}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap ${
                        payout.status === "completed"
                          ? "bg-gradient-to-r from-green-200 to-emerald-200 text-green-800 dark:from-green-800 dark:to-emerald-800 dark:text-green-200"
                          : payout.status === "processing"
                          ? "bg-gradient-to-r from-blue-200 to-cyan-200 text-blue-800 dark:from-blue-800 dark:to-cyan-800 dark:text-blue-200"
                          : "bg-gradient-to-r from-yellow-200 to-amber-200 text-yellow-800 dark:from-yellow-800 dark:to-amber-800 dark:text-yellow-200"
                      }`}
                    >
                      {payout.status === "completed" ? "✅ " : payout.status === "processing" ? "⏳ " : "🕐 "}
                      {payout.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tax Tab */}
      {activeTab === "tax" && taxSummary && (
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-sm p-4 md:p-6 border border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-base md:text-lg font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            📋 Tax Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-100 to-cyan-50 dark:from-blue-900/40 dark:to-cyan-900/40 rounded-xl border border-blue-200 dark:border-blue-700">
              <span className="text-xs text-blue-700 dark:text-blue-200 font-bold">💼 Taxable Income</span>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-300 mt-2">
                {formatCurrency(taxSummary.taxableIncome)}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-red-100 to-rose-50 dark:from-red-900/40 dark:to-rose-900/40 rounded-xl border border-red-200 dark:border-red-700">
              <span className="text-xs text-red-700 dark:text-red-200 font-bold">🔴 Est. Tax (30%)</span>
              <div className="text-2xl font-bold text-red-600 dark:text-red-300 mt-2">
                {formatCurrency(taxSummary.estimatedTax)}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/40 dark:to-emerald-900/40 rounded-xl border border-green-200 dark:border-green-700">
              <span className="text-xs text-green-700 dark:text-green-200 font-bold">✅ Deductions</span>
              <div className="text-2xl font-bold text-green-600 dark:text-green-300 mt-2">
                {formatCurrency(taxSummary.deductionsAllowed)}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-purple-100 to-pink-50 dark:from-purple-900/40 dark:to-pink-900/40 rounded-xl border border-purple-200 dark:border-purple-700">
              <span className="text-xs text-purple-700 dark:text-purple-200 font-bold">🎯 Net Taxable</span>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-300 mt-2">
                {formatCurrency(taxSummary.netTaxableIncome)}
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-xl border-l-4 border-blue-500 dark:border-blue-400">
            <p className="text-xs md:text-sm text-blue-900 dark:text-blue-100 font-medium leading-relaxed">
              💡 For accurate tax filing and detailed deductions, please consult with a tax professional or CA.
            </p>
          </div>
        </div>
      )}

      {/* Payout Dialog */}
      {showPayoutDialog && profile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                💳 Request Payout
              </h2>
              <button
                onClick={() => setShowPayoutDialog(false)}
                className="text-2xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 rounded-xl border border-green-200 dark:border-green-700">
                <label className="text-xs font-bold text-green-700 dark:text-green-200 block mb-2">
                  💰 Available Amount
                </label>
                <div className="text-3xl font-bold text-green-600 dark:text-green-300">
                  {formatCurrency(profile.totalPendingAmount)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                  💵 Payout Amount
                </label>
                <input
                  type="number"
                  value={payoutForm.amount}
                  onChange={(e) =>
                    setPayoutForm({
                      ...payoutForm,
                      amount: parseInt(e.target.value) || 0,
                    })
                  }
                  max={profile.totalPendingAmount}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:border-green-500 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 outline-none transition"
                  placeholder="Enter amount"
                />
                {payoutForm.amount > profile.totalPendingAmount && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">⚠️ Amount exceeds available balance</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                  🏦 Payout Method
                </label>
                <select
                  value={payoutForm.method}
                  onChange={(e) =>
                    setPayoutForm({
                      ...payoutForm,
                      method: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:border-green-500 outline-none transition"
                >
                  <option value="bank_transfer">🏦 Bank Transfer (2 days)</option>
                  <option value="upi">📱 UPI (Instant)</option>
                  <option value="wallet">👛 Wallet (1 day)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleRequestPayout}
                  disabled={payoutForm.amount <= 0 || payoutForm.amount > profile.totalPendingAmount}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ Request
                </button>
                <button
                  onClick={() => setShowPayoutDialog(false)}
                  className="flex-1 px-4 py-3 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-xl hover:bg-gray-400 dark:hover:bg-gray-500 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
