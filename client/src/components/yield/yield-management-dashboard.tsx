import React, { useState } from "react";
import {
  useGenerateOptimizationPlan,
  useAnalyzeProfitability,
  useGetYieldStats,
  useGetRevenueForecasts,
  useCreateBundles,
  useAllocateInventory,
} from "../../hooks/useYieldManagement";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const YieldManagementDashboard: React.FC = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<string>("balanced");
  const { data: stats, isLoading: statsLoading } = useGetYieldStats();
  const { data: forecasts, isLoading: forecastsLoading } = useGetRevenueForecasts();
  const generatePlan = useGenerateOptimizationPlan();
  const analyzeProfitability = useAnalyzeProfitability();
  const createBundles = useCreateBundles();
  const allocateInventory = useAllocateInventory();

  if (statsLoading || forecastsLoading) {
    return <LoadingSpinner />;
  }

  const handleGeneratePlan = () => {
    generatePlan.mutate({ strategy: selectedStrategy as any });
  };

  const strategyDescriptions: Record<string, string> = {
    balanced: "Optimize for sustainable growth & profitability",
    maximize_revenue: "Focus on maximum revenue generation",
    maximize_profit: "Maximize profit margins & efficiency",
    maximize_utilization: "Maximize fleet utilization & market share",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Yield Management & Revenue Optimization
        </h1>
        <button
          onClick={handleGeneratePlan}
          disabled={generatePlan.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {generatePlan.isPending ? "Generating..." : "Optimize"}
        </button>
      </div>

      {/* Strategy Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Select Optimization Strategy
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(strategyDescriptions).map(([key, desc]) => (
            <button
              key={key}
              onClick={() => setSelectedStrategy(key)}
              className={`p-3 rounded-lg border-2 transition text-left text-sm ${
                selectedStrategy === key
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="font-semibold text-gray-900 dark:text-white">
                {key.replace(/_/g, " ").toUpperCase()}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Revenue</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              ₹{(stats.totalPotentialRevenue * 0.65).toLocaleString()}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {stats.revenueGrowthRate}% growth rate
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Potential Revenue</div>
            <div className="text-3xl font-bold text-green-600">
              ₹{stats.totalPotentialRevenue.toLocaleString()}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Opportunity: ₹{stats.opportunitySize.toLocaleString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Revenue Streams</div>
            <div className="text-3xl font-bold text-blue-600">
              {stats.totalRevenueStreams}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Active sources
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Profit Margin</div>
            <div className="text-3xl font-bold text-purple-600">
              {stats.profitMarginTrend}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Current trend
            </div>
          </div>
        </div>
      )}

      {/* Revenue Streams */}
      {forecasts && Object.entries(forecasts).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              7-Day Revenue Forecast
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {Object.entries(forecasts).map(([streamName, forecast]: [string, any]) => (
              <div
                key={streamName}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {streamName}
                </h3>
                <div className="flex justify-between text-xs">
                  {forecast.slice(0, 4).map((value: number, idx: number) => (
                    <div key={idx} className="text-center">
                      <div
                        className="w-8 h-12 bg-blue-200 dark:bg-blue-700 rounded mb-1"
                        style={{
                          height: `${(value / 100000) * 48}px`,
                          minHeight: "8px",
                        }}
                      />
                      <div className="text-gray-600 dark:text-gray-400">
                        Day {idx + 1}
                      </div>
                    </div>
                  ))}
                  <span className="text-gray-500 dark:text-gray-400">...</span>
                </div>
                <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Week total: ₹
                  {forecast.reduce((a: number, b: number) => a + b, 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => analyzeProfitability.mutate()}
          disabled={analyzeProfitability.isPending}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition text-left"
        >
          <div className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            📊 Profitability Analysis
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {analyzeProfitability.isPending ? "Analyzing..." : "Segment & zone breakdown"}
          </div>
        </button>
        <button
          onClick={() => createBundles.mutate()}
          disabled={createBundles.isPending}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition text-left"
        >
          <div className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            📦 Bundle Offers
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {createBundles.isPending ? "Creating..." : "Generate promotional bundles"}
          </div>
        </button>
        <button
          onClick={() => allocateInventory.mutate()}
          disabled={allocateInventory.isPending}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition text-left"
        >
          <div className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            🎯 Inventory Allocation
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {allocateInventory.isPending ? "Allocating..." : "Optimize vehicle & driver placement"}
          </div>
        </button>
      </div>

      {/* Recommendations */}
      {stats && stats.recommendedStrategies.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Strategic Recommendations
          </h2>
          <div className="space-y-2">
            {stats.recommendedStrategies.map((strategy, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-xl">💡</span>
                <p className="text-sm text-gray-700 dark:text-gray-300">{strategy}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Actions */}
      {stats && stats.nextActions.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 rounded-lg shadow p-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Next Actions
          </h2>
          <ol className="space-y-2">
            {stats.nextActions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                <span className="font-bold text-blue-600 dark:text-blue-400">{idx + 1}.</span>
                <span>{action}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
