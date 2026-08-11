import React, { useState } from "react";
import {
  useGetSafetyMetrics,
  useGetPendingInvestigations,
  useGetDriverSafetyProfile,
  useReportIncident,
  useResolveIncident,
} from "../../hooks/useSafetyIncidents";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const SafetyIncidentsDashboard: React.FC = () => {
  const [driverId, setDriverId] = useState("driver_001");
  const [activeTab, setActiveTab] = useState<"overview" | "incidents" | "investigations" | "report">("overview");
  const [showReportDialog, setShowReportDialog] = useState(false);

  const { data: metrics, isLoading: metricsLoading } = useGetSafetyMetrics();
  const { data: pending = [] } = useGetPendingInvestigations();
  const { data: profile } = useGetDriverSafetyProfile(driverId);
  const reportIncident = useReportIncident();
  const resolveIncident = useResolveIncident();

  if (metricsLoading) {
    return <LoadingSpinner />;
  }

  const handleReportIncident = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    reportIncident.mutate({
      vehicleId: formData.get("vehicleId") as string,
      driverId: formData.get("driverId") as string,
      type: formData.get("type") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      reportedBy: "admin",
      injuries: (formData.get("injuries") as string) === "true",
      damageEstimate: formData.get("damageEstimate") ? parseInt(formData.get("damageEstimate") as string) : undefined,
    });
    (e.target as HTMLFormElement).reset();
    setShowReportDialog(false);
  };

  const getSafetyStatusColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getSafetyStatusBg = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-900/40";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900/40";
    return "bg-red-100 dark:bg-red-900/40";
  };

  return (
    <div className="space-y-4 bg-gradient-to-b from-red-50 via-orange-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 min-h-screen p-4 md:p-6 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            🚨 Safety & Incidents
          </h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Risk Management & Investigation
          </p>
        </div>
        <button
          onClick={() => setShowReportDialog(true)}
          className="px-4 md:px-6 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-sm md:text-base"
        >
          📋 Report Incident
        </button>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
          <div className="p-3 md:p-4 bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/40 dark:to-red-900/20 rounded-xl border border-red-200 dark:border-red-700">
            <span className="text-xs text-red-700 dark:text-red-300 font-bold">🚨 Critical</span>
            <div className="text-2xl font-bold text-red-600 dark:text-red-300 mt-1">
              {metrics.criticalIncidents}
            </div>
          </div>
          <div className="p-3 md:p-4 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-700">
            <span className="text-xs text-orange-700 dark:text-orange-300 font-bold">🚗 Accidents</span>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-300 mt-1">
              {metrics.accidents}
            </div>
          </div>
          <div className="p-3 md:p-4 bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-900/40 dark:to-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700">
            <span className="text-xs text-yellow-700 dark:text-yellow-300 font-bold">⚠️ Violations</span>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-300 mt-1">
              {metrics.violations}
            </div>
          </div>
          <div className="p-3 md:p-4 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
            <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">📊 Index</span>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-300 mt-1">
              {metrics.safetyIndex}/100
            </div>
          </div>
          <div className="p-3 md:p-4 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
            <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">💰 Damage</span>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-300 mt-1">
              ₹{(metrics.estimatedDamage / 100000).toFixed(1)}L
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 md:space-x-4 overflow-x-auto pb-2">
        {["overview", "incidents", "investigations", "report"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-3 md:px-4 py-2 font-medium text-xs md:text-sm rounded-lg transition-all duration-200 whitespace-nowrap ${
              activeTab === tab
                ? "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {tab === "overview" && "📊 Overview"}
            {tab === "incidents" && "📋 Incidents"}
            {tab === "investigations" && "🔍 Investigations"}
            {tab === "report" && "📝 Report"}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && profile && (
        <div className="space-y-4">
          <div className={`${getSafetyStatusBg(profile.safetyScore)} rounded-2xl shadow-sm p-4 md:p-6 border border-gray-200 dark:border-gray-700`}>
            <div className="flex justify-between items-start mb-4">
              <h2 className={`text-lg font-bold ${getSafetyStatusColor(profile.safetyScore)}`}>
                👤 Driver Safety Profile
              </h2>
              <span className={`px-4 py-2 rounded-full text-sm font-bold text-white ${
                profile.status === "safe" ? "bg-green-600" :
                profile.status === "caution" ? "bg-yellow-600" :
                "bg-red-600"
              }`}>
                {profile.status.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">Score</span>
                <div className={`text-2xl font-bold mt-1 ${getSafetyStatusColor(profile.safetyScore)}`}>
                  {profile.safetyScore}/100
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">Incidents</span>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-300 mt-1">
                  {profile.incidentCount}
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">Violations</span>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-300 mt-1">
                  {profile.violationCount}
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">Accidents</span>
                <div className="text-2xl font-bold text-red-600 dark:text-red-300 mt-1">
                  {profile.accidentCount}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📈 Safety Trends</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Issues</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-300">
                  {profile.incidentCount + profile.violationCount}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Training Status</span>
                <span className={`text-lg font-bold ${profile.trainingRequired ? "text-orange-600 dark:text-orange-300" : "text-green-600 dark:text-green-300"}`}>
                  {profile.trainingRequired ? "Required" : "Compliant"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Investigations Tab */}
      {activeTab === "investigations" && (
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 md:p-6 bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <h2 className="font-bold text-lg">🔍 Pending Investigations ({pending.length})</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {pending.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No pending investigations
              </div>
            ) : (
              pending.map((incident: any) => (
                <div key={incident.incidentId} className="p-4 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 dark:hover:from-orange-900/20 dark:hover:to-red-900/20">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">{incident.title}</h3>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Type: {incident.type.toUpperCase()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap text-white ${
                      incident.severity === "critical" ? "bg-red-600" :
                      incident.severity === "high" ? "bg-orange-600" :
                      "bg-yellow-600"
                    }`}>
                      {incident.severity.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-6">
              📋 Report Incident
            </h2>
            <form onSubmit={handleReportIncident} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-900 dark:text-white mb-1">
                  Vehicle ID
                </label>
                <input
                  type="text"
                  name="vehicleId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 dark:text-white mb-1">
                  Driver ID
                </label>
                <input
                  type="text"
                  name="driverId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 dark:text-white mb-1">
                  Type
                </label>
                <select
                  name="type"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="violation">Violation</option>
                  <option value="accident">Accident</option>
                  <option value="near_miss">Near Miss</option>
                  <option value="safety_concern">Safety Concern</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 dark:text-white mb-1">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 dark:text-white mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-lg hover:shadow-lg"
                >
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
