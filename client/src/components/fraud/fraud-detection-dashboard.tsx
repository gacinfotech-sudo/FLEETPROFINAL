import React, { useState } from "react";
import {
  useGetFraudStats,
  useGetIncidents,
  useGetProfile,
  useAssessEntity,
} from "../../hooks/useFraudDetection";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const FraudDetectionDashboard: React.FC = () => {
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const { data: stats, isLoading: statsLoading } = useGetFraudStats();
  const { data: incidents = [], isLoading: incidentsLoading } = useGetIncidents();
  const { data: profile, isLoading: profileLoading } = useGetProfile(
    selectedProfile || ""
  );
  const assessEntity = useAssessEntity();

  if (statsLoading || incidentsLoading) {
    return <LoadingSpinner />;
  }

  const handleAssessEntity = (entityId: string) => {
    assessEntity.mutate({
      entityId,
      entityType: "customer",
      context: {},
    });
    setSelectedProfile(entityId);
  };

  const activeIncidents = incidents.filter(
    (i: any) => i.status !== "resolved" && i.status !== "dismissed"
  );
  const criticalIncidents = incidents.filter((i: any) => i.severity === "critical");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Fraud Detection & Prevention
        </h1>
        <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-sm font-medium">
          Active Monitoring
        </span>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Detection Accuracy
            </div>
            <div className="text-3xl font-bold text-green-600">
              {stats.detectionAccuracy.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Model confidence
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              False Positive Rate
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {stats.falsePositiveRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Over-flagging rate
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Fraud Prevention
            </div>
            <div className="text-3xl font-bold text-purple-600">
              ₹{(stats.fraudPrevention / 100000).toFixed(0)}L
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Value saved
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Response Time
            </div>
            <div className="text-3xl font-bold text-orange-600">
              {stats.lastDetectionTime}ms
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Detection latency
            </div>
          </div>
        </div>
      )}

      {/* Risk Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Profiles Tracked
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats?.totalProfiles}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Flagged Profiles
          </div>
          <div className="text-3xl font-bold text-red-600">
            {stats?.flaggedProfiles}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Active Incidents
          </div>
          <div className="text-3xl font-bold text-orange-600">
            {stats?.activeIncidents}
          </div>
        </div>
      </div>

      {/* Incidents */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Fraud Incidents ({activeIncidents.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
          {activeIncidents.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No active fraud incidents detected
            </div>
          ) : (
            activeIncidents.map((incident: any) => (
              <div key={incident.incidentId} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {incident.fraudType.replace(/_/g, " ").toUpperCase()}
                  </h3>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      incident.severity === "critical"
                        ? "bg-red-100 text-red-800 dark:bg-red-900"
                        : incident.severity === "high"
                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900"
                    }`}
                  >
                    {incident.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Entity: {incident.entityId}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Status: {incident.status}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  Est. Loss: ₹{incident.estimatedLoss.toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Profile Analysis */}
      {profileLoading ? (
        <LoadingSpinner />
      ) : profile ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Profile Analysis: {profile.entityId}
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                profile.riskLevel === "critical"
                  ? "bg-red-100 text-red-800 dark:bg-red-900"
                  : profile.riskLevel === "high"
                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900"
                  : profile.riskLevel === "medium"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900"
                  : "bg-green-100 text-green-800 dark:bg-green-900"
              }`}
            >
              Risk: {profile.riskLevel.toUpperCase()}
            </span>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Risk Score
              </span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.riskScore}/100
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  profile.riskScore >= 75
                    ? "bg-red-600"
                    : profile.riskScore >= 50
                    ? "bg-orange-600"
                    : profile.riskScore >= 25
                    ? "bg-yellow-600"
                    : "bg-green-600"
                }`}
                style={{ width: `${profile.riskScore}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-600 dark:text-gray-400">Flags:</span>
              <div className="font-semibold text-gray-900 dark:text-white">
                {profile.flags.length}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-600 dark:text-gray-400">Transactions:</span>
              <div className="font-semibold text-gray-900 dark:text-white">
                {profile.transactionHistory.length}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-600 dark:text-gray-400">Identity:</span>
              <div className="font-semibold text-gray-900 dark:text-white">
                {profile.verificationStatus.identity}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-600 dark:text-gray-400">MFA:</span>
              <div
                className={`font-semibold ${
                  profile.verificationStatus.mfaEnabled
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {profile.verificationStatus.mfaEnabled ? "Enabled" : "Disabled"}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Fraud Flags */}
      {profile && profile.flags.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Active Fraud Flags
          </h2>
          <div className="space-y-2">
            {profile.flags.map((flag: any) => (
              <div
                key={flag.flagId}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded border-l-4 border-red-600"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {flag.type.replace(/_/g, " ").toUpperCase()}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {flag.reason}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      flag.severity === "critical"
                        ? "bg-red-100 text-red-800 dark:bg-red-900"
                        : "bg-orange-100 text-orange-800 dark:bg-orange-900"
                    }`}
                  >
                    {flag.severity.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
