import React, { useState } from "react";
import {
  useGenerateAllocationPlan,
  useGetZones,
  useGetResourceMetrics,
  useGetAllocationActions,
  useGetAllocationStats,
  useExecuteAllocationAction,
} from "../../hooks/useResourceAllocation";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const ResourceAllocationDashboard: React.FC = () => {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const { data: zones = [], isLoading: zonesLoading } = useGetZones();
  const { data: metrics, isLoading: metricsLoading } = useGetResourceMetrics();
  const { data: actions = [], isLoading: actionsLoading } = useGetAllocationActions();
  const { data: stats, isLoading: statsLoading } = useGetAllocationStats();
  const generatePlan = useGenerateAllocationPlan();
  const executeAction = useExecuteAllocationAction();

  if (zonesLoading || metricsLoading || actionsLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  const handleGeneratePlan = () => {
    generatePlan.mutate({ horizon: 4 });
  };

  const handleExecuteAction = (actionId: string) => {
    executeAction.mutate(
      { actionId },
      {
        onSuccess: () => {
          // Toast notification
        },
      }
    );
  };

  const pendingActions = actions.filter((a: any) => a.status === "pending");
  const completedActions = actions.filter((a: any) => a.status === "completed");

  const selectedZoneData = selectedZone
    ? zones.find((z: any) => z.zoneId === selectedZone)
    : zones[0];

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Resource Allocation & Capacity Planning
        </h1>
        <button
          onClick={handleGeneratePlan}
          disabled={generatePlan.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {generatePlan.isPending ? "Generating..." : "Generate Plan"}
        </button>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Vehicles</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.totalVehicles}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {metrics.activeVehicles} active • {metrics.idleVehicles} idle
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Utilization</div>
            <div className="text-3xl font-bold text-green-600">
              {metrics.utilizationRate}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Avg rides: {metrics.avgRidesPerDay}/day
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Revenue</div>
            <div className="text-3xl font-bold text-blue-600">
              ₹{metrics.avgRevenuePerVehicle}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">per vehicle/day</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Fleet Health</div>
            <div className="text-3xl font-bold text-purple-600">
              {metrics.fleetHealthScore}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Profit margin
            </div>
          </div>
        </div>
      )}

      {/* Zone Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Zone Overview</h2>
            </div>
            <div className="p-4 space-y-3">
              {zones.map((zone: any) => (
                <div
                  key={zone.zoneId}
                  onClick={() => setSelectedZone(zone.zoneId)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                    selectedZone === zone.zoneId
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {zone.name}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                        zone.priority
                      )}`}
                    >
                      {zone.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Demand:</span>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {zone.demand}/hr
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Supply:</span>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {zone.supply}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Ratio:</span>
                      <div
                        className={`font-semibold ${
                          zone.imbalanceRatio > 1.5
                            ? "text-red-600"
                            : zone.imbalanceRatio > 1.2
                            ? "text-orange-600"
                            : "text-green-600"
                        }`}
                      >
                        {zone.imbalanceRatio.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Zone Details */}
        {selectedZoneData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">
              {selectedZoneData.name}
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Current Demand:</span>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedZoneData.demand} rides/hr
                </div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Current Supply:</span>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedZoneData.supply} vehicles
                </div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Optimal Supply:</span>
                <div className="text-lg font-semibold text-green-600">
                  {selectedZoneData.optimalSupply} vehicles
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Imbalance Score
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      selectedZoneData.imbalanceRatio > 1.5
                        ? "bg-red-600"
                        : selectedZoneData.imbalanceRatio > 1.2
                        ? "bg-orange-600"
                        : "bg-green-600"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (selectedZoneData.imbalanceRatio / 2) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Allocation Actions ({pendingActions.length} pending)
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {actions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No allocation actions. Generate a plan to see recommendations.
            </div>
          ) : (
            actions.map((action: any) => (
              <div key={action.actionId} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">
                        {action.type === "rebalance" ? "🚗" : "📍"}
                      </span>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {action.type.charAt(0).toUpperCase() +
                          action.type.slice(1)}{" "}
                        {action.resourceType}s
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                          action.priority
                        )}`}
                      >
                        {action.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Move {action.quantity} {action.resourceType}s from{" "}
                      {action.source || "pool"} to {action.destination} (ETA:{" "}
                      {action.eta} min)
                    </p>
                    <div className="flex gap-4 text-xs">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Cost:</span>
                        <span className="ml-1 font-semibold text-gray-900 dark:text-white">
                          ₹{action.cost}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Benefit:</span>
                        <span className="ml-1 font-semibold text-green-600">
                          ₹{action.expectedBenefit}
                        </span>
                      </div>
                    </div>
                  </div>
                  {action.status === "pending" && (
                    <button
                      onClick={() => handleExecuteAction(action.actionId)}
                      disabled={executeAction.isPending}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 ml-4"
                    >
                      Execute
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Plans</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.totalPlans}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Pending Actions</div>
            <div className="text-3xl font-bold text-orange-600">
              {stats.pendingActions}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Revenue Gain</div>
            <div className="text-3xl font-bold text-green-600">
              ₹{stats.totalRevenueOpportunity.toLocaleString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Cost Savings</div>
            <div className="text-3xl font-bold text-blue-600">
              ₹{stats.totalCostSavings.toLocaleString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Confidence</div>
            <div className="text-3xl font-bold text-purple-600">
              {stats.avgConfidence}%
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Utilization Trend</div>
            <div className="text-3xl font-bold text-indigo-600">
              +{stats.utilizationTrend}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
