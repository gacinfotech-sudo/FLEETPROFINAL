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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Driver Earnings Dashboard
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {driverId}
          </p>
        </div>
        <button
          onClick={() => setShowPayoutDialog(true)}
          className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
        >
          Request Payout
        </button>
      </div>

      {/* Key Metrics */}
      {profile && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total Lifetime
            </div>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(profile.totalLifetimeEarnings)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              This Month
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {formatCurrency(profile.currentMonthEarnings)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Pending
            </div>
            <div className="text-3xl font-bold text-orange-600">
              {formatCurrency(profile.totalPendingAmount)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Avg Per Ride
            </div>
            <div className="text-3xl font-bold text-purple-600">
              {formatCurrency(profile.avgEarningsPerRide)}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
        {["overview", "analytics", "payouts", "tax"].map((tab) => (
          <button
            key={tab}
            onClick={() =>
              setActiveTab(tab as "overview" | "analytics" | "payouts" | "tax")
            }
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === tab
                ? "text-green-600 border-b-2 border-green-600"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && profile && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profile Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Account Status
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Status
                  </span>
                  <span className={`font-semibold ${
                    profile.accountStatus === "active"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}>
                    {profile.accountStatus.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Rides Completed
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {profile.totalRidesCompleted}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Rating
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {profile.avgRating.toFixed(1)}/5 ⭐
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Bank Verified
                  </span>
                  <span
                    className={`font-semibold ${
                      profile.bankAccountVerified
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {profile.bankAccountVerified ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Tax Filing
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {profile.taxFilingStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Earnings Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Earnings Summary
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Avg Daily
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(profile.avgDailyEarnings)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    This Month Rides
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {profile.currentMonthRides}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Last Payout
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {profile.lastPayoutDate
                      ? new Date(profile.lastPayoutDate).toLocaleDateString()
                      : "Never"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Payouts
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₹{profile.totalPayoutsReceived.toLocaleString()}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Pending
                    </span>
                    <span className="font-bold text-orange-600">
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
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Earnings Breakdown
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded">
                <span className="text-xs text-blue-600 dark:text-blue-300">
                  Total Earnings
                </span>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(analytics.totalEarnings)}
                </div>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900 rounded">
                <span className="text-xs text-green-600 dark:text-green-300">
                  Incentives Earned
                </span>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(analytics.incentivesEarned)}
                </div>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900 rounded">
                <span className="text-xs text-red-600 dark:text-red-300">
                  Commissions
                </span>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(analytics.commissionsDeducted)}
                </div>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900 rounded">
                <span className="text-xs text-purple-600 dark:text-purple-300">
                  Rides Completed
                </span>
                <div className="text-2xl font-bold text-purple-600">
                  {analytics.totalRidesCompleted}
                </div>
              </div>
            </div>
          </div>

          {/* Top Earning Days */}
          {analytics.topEarningDays.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Top Earning Days
              </h2>
              <div className="space-y-2">
                {analytics.topEarningDays.map((day: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(day.date).toLocaleDateString()}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-bold text-gray-900 dark:text-white">
              Pending Payouts ({payouts.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {payouts.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No pending payouts
              </div>
            ) : (
              payouts.map((payout: any) => (
                <div key={payout.payoutId} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(payout.amount)}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Method: {payout.method.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Scheduled:{" "}
                        {new Date(payout.scheduledDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        payout.status === "completed"
                          ? "bg-green-100 text-green-800 dark:bg-green-900"
                          : payout.status === "processing"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900"
                      }`}
                    >
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
            Tax Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Taxable Income
              </span>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(taxSummary.taxableIncome)}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Estimated Tax (30%)
              </span>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(taxSummary.estimatedTax)}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Deductions Allowed
              </span>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(taxSummary.deductionsAllowed)}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Net Taxable Income
              </span>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(taxSummary.netTaxableIncome)}
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 rounded">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 Tax filing status and detailed deductions should be consulted
              with a tax professional for accurate filing.
            </p>
          </div>
        </div>
      )}

      {/* Payout Dialog */}
      {showPayoutDialog && profile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-md">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Request Payout
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Available Amount
                </label>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(profile.totalPendingAmount)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Payout Amount
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Payout Method
                </label>
                <select
                  value={payoutForm.method}
                  onChange={(e) =>
                    setPayoutForm({
                      ...payoutForm,
                      method: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="wallet">Wallet</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRequestPayout}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  Request
                </button>
                <button
                  onClick={() => setShowPayoutDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg font-medium hover:bg-gray-500"
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
