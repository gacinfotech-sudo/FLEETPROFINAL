import React, { useState } from "react";
import {
  useGetAllTrainingJobs,
  useGetAllDeployedModels,
  useGetMLStats,
  useDeployModel,
  useStartTraining,
} from "../../hooks/useMLModels";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const MLPipelineDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"training" | "models" | "stats">("training");
  const { data: trainingJobs = [], isLoading: jobsLoading } = useGetAllTrainingJobs();
  const { data: deployedModels = [], isLoading: modelsLoading } = useGetAllDeployedModels();
  const { data: stats, isLoading: statsLoading } = useGetMLStats();
  const deployModel = useDeployModel();
  const startTraining = useStartTraining();

  if (jobsLoading || modelsLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  const handleDeployModel = (modelId: string, jobId: string) => {
    deployModel.mutate(
      { modelId, trainingJobId: jobId },
      {
        onSuccess: () => {
          // Toast notification
        },
      }
    );
  };

  const completedJobs = trainingJobs.filter((j: any) => j.status === "completed");
  const runningJobs = trainingJobs.filter((j: any) => j.status === "running");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          ML Model Pipeline
        </h1>
        <button
          onClick={() =>
            startTraining.mutate({
              modelId: "model_churn_v1",
              datasetConfig: {
                size: 10000,
                features: ["feature1", "feature2"],
                targetVariable: "target",
                timeRange: {
                  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                  end: new Date(),
                },
                splitRatio: { train: 0.7, validation: 0.15, test: 0.15 },
              },
            })
          }
          disabled={startTraining.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {startTraining.isPending ? "Starting..." : "Start Training"}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Jobs</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.totalJobs}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Running</div>
            <div className="text-3xl font-bold text-orange-600">{stats.runningJobs}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Deployed</div>
            <div className="text-3xl font-bold text-green-600">{stats.deployedModels}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Accuracy</div>
            <div className="text-3xl font-bold text-blue-600">
              {(stats.avgModelAccuracy * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("training")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === "training"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400"
          }`}
        >
          Training Jobs ({trainingJobs.length})
        </button>
        <button
          onClick={() => setActiveTab("models")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === "models"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400"
          }`}
        >
          Deployed Models ({deployedModels.length})
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === "stats"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400"
          }`}
        >
          Statistics
        </button>
      </div>

      {/* Training Jobs Tab */}
      {activeTab === "training" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Running Jobs ({runningJobs.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {runningJobs.length === 0 ? (
                <div className="p-4 text-gray-500 dark:text-gray-400">
                  No running jobs
                </div>
              ) : (
                runningJobs.map((job: any) => (
                  <div key={job.jobId} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {job.modelConfig.name}
                      </h3>
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded text-xs font-medium">
                        {job.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Progress: {job.progress}% | Algorithm: {job.modelConfig.algorithm}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Completed Jobs ({completedJobs.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {completedJobs.length === 0 ? (
                <div className="p-4 text-gray-500 dark:text-gray-400">
                  No completed jobs
                </div>
              ) : (
                completedJobs.slice(0, 5).map((job: any) => (
                  <div key={job.jobId} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {job.modelConfig.name}
                      </h3>
                      <button
                        onClick={() => handleDeployModel(job.modelId, job.jobId)}
                        disabled={deployModel.isPending}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        Deploy
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Accuracy:</span>
                        <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                          {(job.metrics.accuracy * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">F1 Score:</span>
                        <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                          {job.metrics.f1Score?.toFixed(3) || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deployed Models Tab */}
      {activeTab === "models" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
          {deployedModels.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No deployed models
            </div>
          ) : (
            deployedModels.map((model: any) => (
              <div key={model.modelId} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {model.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {model.type} • v{model.version}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-sm font-medium">
                    {model.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Accuracy:</span>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {(model.performanceMetrics.accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Predictions:</span>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {model.productionMetrics.predictions}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Avg Latency:</span>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {model.productionMetrics.avgLatency}ms
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Uptime:</span>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {model.productionMetrics.uptime}%
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === "stats" && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Model Types</h3>
            <div className="space-y-2">
              {Object.entries(stats.modelTypes).map(([type, count]: [string, any]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {type.replace(/_/g, " ")}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Job Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Completed</span>
                <span className="font-semibold text-green-600">{stats.completedJobs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Running</span>
                <span className="font-semibold text-orange-600">{stats.runningJobs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Failed</span>
                <span className="font-semibold text-red-600">{stats.failedJobs}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
