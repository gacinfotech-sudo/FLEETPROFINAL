import React, { useState } from "react";
import {
  useGetWorkflows,
  useGetAlerts,
  useGetRecommendations,
  useGetPlatformMetrics,
  useGetOrchestrationStats,
  useExecuteWorkflow,
  useAcknowledgeAlert,
} from "../../hooks/useOrchestration";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const OrchestrationDashboard: React.FC = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const { data: workflows = [], isLoading: workflowsLoading } = useGetWorkflows();
  const { data: alerts = [], isLoading: alertsLoading } = useGetAlerts();
  const { data: recommendations = [], isLoading: recsLoading } = useGetRecommendations();
  const { data: metrics, isLoading: metricsLoading } = useGetPlatformMetrics();
  const { data: stats, isLoading: statsLoading } = useGetOrchestrationStats();
  const executeWorkflow = useExecuteWorkflow();
  const acknowledgeAlert = useAcknowledgeAlert();

  if (
    workflowsLoading ||
    alertsLoading ||
    recsLoading ||
    metricsLoading ||
    statsLoading
  ) {
    return <LoadingSpinner />;
  }

  const handleExecuteWorkflow = (workflowId: string) => {
    executeWorkflow.mutate({ workflowId, context: {} });
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    acknowledgeAlert.mutate(alertId);
  };

  const criticalAlerts = alerts.filter((a: any) => a.severity === "critical");
  const activeRecommendations = recommendations.filter(
    (r: any) => r.status === "active"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Platform Orchestration & Decision Engine
        </h1>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm font-medium">
            14 Systems Integrated
          </span>
        </div>
      </div>

      {/* Platform Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Platform ROI
            </div>
            <div className="text-3xl font-bold text-green-600">
              {metrics.platformROI.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Current month
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Autonomy Level
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {metrics.autonomyLevel.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Auto-decision making
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Decision Latency
            </div>
            <div className="text-3xl font-bold text-purple-600">
              {metrics.averageDecisionLatency}ms
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Average
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Health Score
            </div>
            <div className="text-3xl font-bold text-green-600">
              {(
                Object.values(metrics.systemHealthScores).reduce(
                  (a: number, b: number) => a + b
                ) / Object.keys(metrics.systemHealthScores).length
              ).toFixed(0)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              All systems
            </div>
          </div>
        </div>
      )}

      {/* Orchestration Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Active Workflows
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.activeWorkflows}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Success Rate
            </div>
            <div className="text-3xl font-bold text-green-600">
              {stats.successRate.toFixed(0)}%
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Critical Alerts
            </div>
            <div className="text-3xl font-bold text-red-600">
              {stats.criticalAlerts}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Pending Decisions
            </div>
            <div className="text-3xl font-bold text-orange-600">
              {stats.pendingDecisions}
            </div>
          </div>
        </div>
      )}

      {/* Alerts & Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Critical Alerts ({criticalAlerts.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {criticalAlerts.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No critical alerts
              </div>
            ) : (
              criticalAlerts.map((alert: any) => (
                <div key={alert.alertId} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {alert.title}
                    </h3>
                    <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-xs font-medium">
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {alert.message}
                  </p>
                  {alert.status === "active" && (
                    <button
                      onClick={() => handleAcknowledgeAlert(alert.alertId)}
                      disabled={acknowledgeAlert.isPending}
                      className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Workflows */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Available Workflows ({workflows.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {workflows.map((wf: any) => (
              <div
                key={wf.workflowId}
                onClick={() => setSelectedWorkflow(wf.workflowId)}
                className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                  selectedWorkflow === wf.workflowId
                    ? "bg-blue-50 dark:bg-blue-900"
                    : ""
                }`}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {wf.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {wf.description}
                </p>
                <div className="mt-2 flex gap-2">
                  <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                    {wf.steps.length} steps
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExecuteWorkflow(wf.workflowId);
                    }}
                    disabled={executeWorkflow.isPending}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Execute
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Workflow Details */}
      {selectedWorkflow && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Workflow Steps
          </h2>
          {workflows
            .filter((w: any) => w.workflowId === selectedWorkflow)
            .map((wf: any) => (
              <div key={wf.workflowId} className="space-y-2">
                {wf.steps.map((step: any, idx: number) => (
                  <div
                    key={step.stepId}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600">{idx + 1}</span>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {step.systemName}: {step.action}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Timeout: {step.timeout}ms | Retries: {step.retryPolicy.maxRetries}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {/* Active Recommendations */}
      {activeRecommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Active Recommendations ({activeRecommendations.length})
          </h2>
          <div className="space-y-2">
            {activeRecommendations.slice(0, 5).map((rec: any) => (
              <div
                key={rec.recommendationId}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {rec.action}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      From {rec.sourceSystem} • ROI: {rec.estimatedROI}%
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      rec.priority === "critical"
                        ? "bg-red-100 text-red-800 dark:bg-red-900"
                        : rec.priority === "high"
                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900"
                    }`}
                  >
                    {rec.priority.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Health */}
      {metrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            System Health Scores
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(metrics.systemHealthScores).map(
              ([system, score]: [string, any]) => (
                <div key={system} className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                    {system}
                  </div>
                  <div
                    className={`text-xl font-bold ${
                      score >= 85
                        ? "text-green-600"
                        : score >= 70
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {score.toFixed(0)}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
