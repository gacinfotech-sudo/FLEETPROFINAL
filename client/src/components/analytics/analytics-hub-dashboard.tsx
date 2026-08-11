import React, { useState } from "react";
import {
  useGetTrends,
  useGetAnalyticsStats,
  useGetHealthReports,
  useGenerateInsights,
  useGenerateHealthReport,
  useGenerateBusinessIntelligence,
} from "../../hooks/useAnalytics";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const AnalyticsHubDashboard: React.FC = () => {
  const { data: trends = {}, isLoading: trendsLoading } = useGetTrends();
  const { data: stats, isLoading: statsLoading } = useGetAnalyticsStats();
  const { data: healthReports = [], isLoading: reportsLoading } = useGetHealthReports();
  const generateInsights = useGenerateInsights();
  const generateHealthReport = useGenerateHealthReport();
  const generateBI = useGenerateBusinessIntelligence();

  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);

  const handleGenerateInsights = () => {
    generateInsights.mutate({
      revenue: 52000,
      churn: 22,
      customerSatisfaction: 4.1,
      systemHealth: 82,
    });
  };

  const handleGenerateReport = () => {
    generateHealthReport.mutate({
      recommendations: 86,
      pricing: 84,
      dispatch: 88,
      maintenance: 81,
      driverIntelligence: 85,
      customerLtv: 82,
      anomalyDetection: 80,
    });
  };

  const handleGenerateBI = () => {
    generateBI.mutate("daily");
  };

  if (trendsLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  const trendEntries = Object.entries(trends);
  const selectedTrendData = selectedTrend
    ? (trends as any)[selectedTrend]
    : trendEntries[0]?.[1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Analytics & Intelligence Hub
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateInsights}
            disabled={generateInsights.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generateInsights.isPending ? "Generating..." : "Generate Insights"}
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={generateHealthReport.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {generateHealthReport.isPending ? "Generating..." : "Generate Report"}
          </button>
          <button
            onClick={handleGenerateBI}
            disabled={generateBI.isPending}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {generateBI.isPending ? "Generating..." : "Generate BI"}
          </button>
        </div>
      </div>

      {/* Stats KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Metrics Recorded</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.metricsRecorded}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Trends Analyzed</div>
            <div className="text-3xl font-bold text-blue-600">{stats.trendsAnalyzed}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Insights Generated</div>
            <div className="text-3xl font-bold text-orange-600">{stats.insightsGenerated}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Health Score</div>
            <div className="text-3xl font-bold text-green-600">
              {stats.averageHealthScore}%
            </div>
          </div>
        </div>
      )}

      {/* Trends Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Trends Analysis</h2>
            </div>
            <div className="p-4">
              {selectedTrendData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                        {selectedTrendData.metric}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Current trend: {selectedTrendData.trend.toUpperCase()}
                      </p>
                    </div>
                    <span
                      className={`text-2xl font-bold ${
                        selectedTrendData.trend === "uptrend"
                          ? "text-green-600"
                          : selectedTrendData.trend === "downtrend"
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {selectedTrendData.changePercent > 0 ? "↑" : "↓"}{" "}
                      {Math.abs(selectedTrendData.changePercent)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Day over Day</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedTrendData.dayOverDay.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Week over Week</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedTrendData.weekOverWeek.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Month over Month</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedTrendData.monthOverMonth.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">7-Day Forecast</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedTrendData.forecast7Day.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 p-3 rounded">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      Velocity: {selectedTrendData.velocity.toFixed(4)}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      Rate of change indicates momentum in this metric
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No trend data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Trend Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white">Select Metric</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {trendEntries.map(([name, _]) => (
              <button
                key={name}
                onClick={() => setSelectedTrend(name)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition ${
                  (selectedTrend || trendEntries[0]?.[0]) === name
                    ? "bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-600"
                    : ""
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Health Reports */}
      {!reportsLoading && healthReports.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Recent Health Reports
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {healthReports.slice(0, 3).map((report: any, idx: number) => (
              <div key={idx} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      System Health Report
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(report.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-3xl font-bold text-green-600">{report.overallHealth}%</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Performance:</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                      {report.performanceScore}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Efficiency:</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                      {report.efficiencyScore}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Risks & Opportunities */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Top Risks</h3>
            <div className="space-y-2">
              {stats.topRisks.length > 0 ? (
                stats.topRisks.map((risk: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-red-600 font-bold">⚠️</span>
                    <span className="text-gray-700 dark:text-gray-300">{risk}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No risks identified</p>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Top Opportunities</h3>
            <div className="space-y-2">
              {stats.topOpportunities.length > 0 ? (
                stats.topOpportunities.map((opp: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-green-600 font-bold">💡</span>
                    <span className="text-gray-700 dark:text-gray-300">{opp}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No opportunities identified
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
