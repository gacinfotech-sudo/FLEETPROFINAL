import React, { useState } from "react";
import {
  useGetMetrics,
  useGetAlerts,
  useResolveAlert,
  useGetAuditLogs,
  useGetConfigurations,
  useUpdateConfiguration,
  useGenerateReport,
  useGetReport,
  useCreateAlert,
} from "../../hooks/useAdminDashboard";

type TabType = "metrics" | "alerts" | "audit" | "config" | "reports";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("metrics");
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [selectedReportId, setSelectedReportId] = useState<string>("");

  const metricsQuery = useGetMetrics();
  const alertsQuery = useGetAlerts();
  const auditLogsQuery = useGetAuditLogs();
  const configQuery = useGetConfigurations();
  const resolveAlertMut = useResolveAlert();
  const generateReportMut = useGenerateReport();
  const reportQuery = useGetReport(selectedReportId);

  const handleResolveAlert = (alertId: string) => {
    resolveAlertMut.mutate({
      alertId,
      resolution: "Resolved by admin",
    });
  };

  const handleGenerateReport = () => {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    generateReportMut.mutate({
      title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
      type: reportType,
      generatedBy: "admin_001",
      periodStart: start.toISOString(),
      periodEnd: now.toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-blue-900 dark:to-cyan-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-cyan-400">
            📊 Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            System metrics, alerts, audit logs, and operations management
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-3 mb-8 border-b border-gray-200 dark:border-gray-700">
          {(["metrics", "alerts", "audit", "config", "reports"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-semibold rounded-t-lg transition-all ${
                activeTab === tab
                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                  : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-slate-800/50"
              }`}
            >
              {tab === "metrics" && "📈 Metrics"}
              {tab === "alerts" && "🚨 Alerts"}
              {tab === "audit" && "📋 Audit Logs"}
              {tab === "config" && "⚙️ Configuration"}
              {tab === "reports" && "📑 Reports"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
          {/* Metrics Tab */}
          {activeTab === "metrics" && (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                📈 System Metrics
              </h2>
              {metricsQuery.isLoading ? (
                <div className="text-center py-12">Loading metrics...</div>
              ) : metricsQuery.data ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Users */}
                  <div className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                          Total Users
                        </p>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                          {metricsQuery.data.totalUsers?.toLocaleString()}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                          24h Active: {metricsQuery.data.activeUsers24h?.toLocaleString()}
                        </p>
                      </div>
                      <span className="text-4xl">👥</span>
                    </div>
                  </div>

                  {/* Rides */}
                  <div className="bg-gradient-to-br from-emerald-100 to-green-50 dark:from-emerald-900/30 dark:to-green-800/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-700">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                          Rides Completed
                        </p>
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                          {metricsQuery.data.totalRidesCompleted?.toLocaleString()}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                          Today: {metricsQuery.data.todayRides?.toLocaleString()}
                        </p>
                      </div>
                      <span className="text-4xl">🚗</span>
                    </div>
                  </div>

                  {/* Revenue */}
                  <div className="bg-gradient-to-br from-amber-100 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-800/20 rounded-xl p-6 border border-amber-200 dark:border-amber-700">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                          Total Revenue
                        </p>
                        <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                          ₹{(metricsQuery.data.totalRevenue / 100000).toFixed(1)}L
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                          Today: ₹{metricsQuery.data.todayRevenue?.toLocaleString()}
                        </p>
                      </div>
                      <span className="text-4xl">💰</span>
                    </div>
                  </div>

                  {/* Uptime */}
                  <div className="bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/30 dark:to-emerald-800/20 rounded-xl p-6 border border-green-200 dark:border-green-700">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                          System Uptime
                        </p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                          {metricsQuery.data.systemUptime?.toFixed(2)}%
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                          Excellent availability
                        </p>
                      </div>
                      <span className="text-4xl">✅</span>
                    </div>
                  </div>

                  {/* API Response */}
                  <div className="bg-gradient-to-br from-purple-100 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                          Avg Response Time
                        </p>
                        <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                          {metricsQuery.data.apiResponseTime?.toFixed(0)}ms
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                          Fast performance
                        </p>
                      </div>
                      <span className="text-4xl">⚡</span>
                    </div>
                  </div>

                  {/* Error Rate */}
                  <div className="bg-gradient-to-br from-red-100 to-orange-50 dark:from-red-900/30 dark:to-orange-800/20 rounded-xl p-6 border border-red-200 dark:border-red-700">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                          Error Rate
                        </p>
                        <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                          {metricsQuery.data.errorRate?.toFixed(2)}%
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                          Monitor and improve
                        </p>
                      </div>
                      <span className="text-4xl">⚠️</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">Failed to load metrics</div>
              )}
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === "alerts" && (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                🚨 Active Alerts
              </h2>
              {alertsQuery.isLoading ? (
                <div className="text-center py-12">Loading alerts...</div>
              ) : alertsQuery.data && alertsQuery.data.length > 0 ? (
                <div className="space-y-4">
                  {alertsQuery.data.map((alert: any) => (
                    <div
                      key={alert.alertId}
                      className={`p-4 rounded-lg border-l-4 ${
                        alert.severity === "critical"
                          ? "bg-red-50 dark:bg-red-900/20 border-red-500"
                          : alert.severity === "high"
                          ? "bg-orange-50 dark:bg-orange-900/20 border-orange-500"
                          : alert.severity === "medium"
                          ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500"
                          : "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {alert.title}
                          </h3>
                          <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                            {alert.description}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                              {alert.affectedSystem}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                alert.severity === "critical"
                                  ? "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-200"
                                  : alert.severity === "high"
                                  ? "bg-orange-200 dark:bg-orange-800 text-orange-900 dark:text-orange-200"
                                  : alert.severity === "medium"
                                  ? "bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-200"
                                  : "bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-200"
                              }`}
                            >
                              {alert.severity}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleResolveAlert(alert.alertId)}
                          disabled={resolveAlertMut.isPending}
                          className="ml-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          ✓ Resolve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">✅ No active alerts</div>
              )}
            </div>
          )}

          {/* Audit Logs Tab */}
          {activeTab === "audit" && (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                📋 Audit Logs
              </h2>
              {auditLogsQuery.isLoading ? (
                <div className="text-center py-12">Loading audit logs...</div>
              ) : auditLogsQuery.data && auditLogsQuery.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                          Admin
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                          Action
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                          Entity
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogsQuery.data.map((log: any) => (
                        <tr
                          key={log.auditId}
                          className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                            {log.adminId}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 rounded-full text-xs font-semibold">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                            {log.entityType}: {log.entityId}
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">No audit logs found</div>
              )}
            </div>
          )}

          {/* Configuration Tab */}
          {activeTab === "config" && (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                ⚙️ System Configuration
              </h2>
              {configQuery.isLoading ? (
                <div className="text-center py-12">Loading configurations...</div>
              ) : configQuery.data && configQuery.data.length > 0 ? (
                <div className="space-y-4">
                  {configQuery.data.map((config: any) => (
                    <div
                      key={config.configId}
                      className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            Category
                          </label>
                          <p className="text-gray-900 dark:text-white font-semibold mt-1">
                            {config.category}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            Key
                          </label>
                          <p className="text-gray-900 dark:text-white font-semibold mt-1">
                            {config.key}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            Value
                          </label>
                          <p className="text-gray-900 dark:text-white font-semibold mt-1">
                            {String(config.value)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">No configurations found</div>
              )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === "reports" && (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                📑 Generate Reports
              </h2>

              <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  📊 Generate New Report
                </h3>
                <div className="flex gap-4 items-end">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Report Type
                    </label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value as any)}
                      className="mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <button
                    onClick={handleGenerateReport}
                    disabled={generateReportMut.isPending}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                  >
                    {generateReportMut.isPending ? "Generating..." : "Generate"}
                  </button>
                </div>
              </div>

              {reportQuery.data && (
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg p-6 border border-emerald-200 dark:border-emerald-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    {reportQuery.data.title}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Summary
                      </label>
                      <div className="mt-2 space-y-2 text-sm">
                        <p className="text-gray-700 dark:text-gray-300">
                          Rides: {reportQuery.data.sections?.summary?.totalRides}
                        </p>
                        <p className="text-gray-700 dark:text-gray-300">
                          Revenue: ₹{reportQuery.data.sections?.summary?.totalRevenue?.toLocaleString()}
                        </p>
                        <p className="text-gray-700 dark:text-gray-300">
                          Satisfaction: {reportQuery.data.sections?.summary?.customerSatisfaction?.toFixed(1)}/5
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Performance
                      </label>
                      <div className="mt-2 space-y-2 text-sm">
                        <p className="text-gray-700 dark:text-gray-300">
                          Uptime: {reportQuery.data.sections?.performance?.uptime?.toFixed(2)}%
                        </p>
                        <p className="text-gray-700 dark:text-gray-300">
                          Errors: {reportQuery.data.sections?.performance?.errorRate?.toFixed(2)}%
                        </p>
                        <p className="text-gray-700 dark:text-gray-300">
                          Response: {reportQuery.data.sections?.performance?.avgResponseTime?.toFixed(0)}ms
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
