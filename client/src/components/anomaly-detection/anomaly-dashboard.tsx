import React, { useState } from "react";
import {
  useDetectAnomalies,
  useGetActiveAnomalies,
  useResolveAnomaly,
  useGetIncidents,
  useGetAnomalyStats,
  useRecordMetric,
} from "../../hooks/useAnomalyDetection";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { ErrorAlert } from "../common/ErrorAlert";

interface AnomalyWithMetrics {
  id: string;
  ruleId: string;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  metricValue: number;
  expectedValue: number;
  deviation: number;
  detectedAt: Date;
  status: string;
  relatedAnomalies?: string[];
}

export const AnomalyDashboard: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);

  const { data: activeAnomalies = [], isLoading: anomaliesLoading } = useGetActiveAnomalies();
  const { data: stats, isLoading: statsLoading } = useGetAnomalyStats();
  const { data: incidents = [], isLoading: incidentsLoading } = useGetIncidents("open");
  const resolveAnomaly = useResolveAnomaly();
  const detectAnomalies = useDetectAnomalies();

  const filteredAnomalies = activeAnomalies.filter((anomaly: AnomalyWithMetrics) => {
    if (selectedCategory && anomaly.category !== selectedCategory) return false;
    if (selectedSeverity && anomaly.severity !== selectedSeverity) return false;
    return true;
  });

  const handleResolveAnomaly = (anomalyId: string) => {
    resolveAnomaly.mutate(
      {
        anomalyId,
        resolution: "Manually resolved by operator",
      },
      {
        onSuccess: () => {
          // Toast notification would go here
        },
      }
    );
  };

  const handleTestDetection = () => {
    const testMetrics = {
      acceptanceRate: 65,
      averageRating: 3.2,
      offlinePercentage: 50,
      complaintRate: 8.5,
      churnRate: 30,
      surgePricingActive: 4,
      bookingRate: 25,
      avgWaitTime: 1200,
      fleetHealthScore: 55,
      hourlyRevenue: 45000,
      operatingMargin: 12,
    };

    detectAnomalies.mutate({ metrics: testMetrics });
  };

  if (anomaliesLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  const categoryOptions = ["driver", "customer", "pricing", "demand", "dispatch", "maintenance", "operations"];
  const severityOptions = ["info", "warning", "critical"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Anomaly Detection & Auto-Response
        </h1>
        <button
          onClick={handleTestDetection}
          disabled={detectAnomalies.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {detectAnomalies.isPending ? "Testing..." : "Run Test"}
        </button>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Detected</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.totalDetected}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
            <div className="text-3xl font-bold text-orange-600">{stats.activeAnomalies}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Critical</div>
            <div className="text-3xl font-bold text-red-600">{stats.criticalAnomalies}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Resolution Rate</div>
            <div className="text-3xl font-bold text-green-600">{stats.resolutionRate}%</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={selectedCategory || ""}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Severity
            </label>
            <select
              value={selectedSeverity || ""}
              onChange={(e) => setSelectedSeverity(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Severities</option>
              {severityOptions.map((sev) => (
                <option key={sev} value={sev}>
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Anomalies */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Active Anomalies ({filteredAnomalies.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredAnomalies.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No anomalies detected. System running normally.
            </div>
          ) : (
            filteredAnomalies.map((anomaly: AnomalyWithMetrics) => (
              <div key={anomaly.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {anomaly.title}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          anomaly.severity === "critical"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : anomaly.severity === "warning"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        }`}
                      >
                        {anomaly.severity.toUpperCase()}
                      </span>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        {anomaly.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {anomaly.description}
                    </p>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Metric Value:</span>
                        <span className="font-mono text-gray-900 dark:text-white ml-1">
                          {anomaly.metricValue.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Expected:</span>
                        <span className="font-mono text-gray-900 dark:text-white ml-1">
                          {anomaly.expectedValue.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Deviation:</span>
                        <span className="font-mono text-gray-900 dark:text-white ml-1">
                          {anomaly.deviation.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {anomaly.relatedAnomalies && anomaly.relatedAnomalies.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        🔗 Related: {anomaly.relatedAnomalies.join(", ")}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleResolveAnomaly(anomaly.id)}
                    disabled={resolveAnomaly.isPending}
                    className="ml-4 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Incidents */}
      {incidents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Open Incidents ({incidents.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {incidents.map((incident: any) => (
              <div key={incident.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Incident {incident.id.slice(-8)}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {incident.anomalies.length} related anomalies
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      incident.severity === "critical"
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                    }`}
                  >
                    {incident.severity.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Breakdown */}
      {stats && Object.keys(stats.anomaliesByCategory).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">By Category</h3>
            <div className="space-y-2">
              {Object.entries(stats.anomaliesByCategory).map(([cat, count]: [string, any]) => (
                <div key={cat} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">By Severity</h3>
            <div className="space-y-2">
              {Object.entries(stats.anomaliesBySeverity).map(([sev, count]: [string, any]) => (
                <div key={sev} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
