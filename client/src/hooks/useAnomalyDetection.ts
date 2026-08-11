import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface AnomalyDetectionParams {
  metrics: Record<string, number>;
}

export interface MetricRecordingParams {
  metricName: string;
  value: number;
}

export interface AnomalyResolutionParams {
  anomalyId: string;
  resolution: string;
}

export const useDetectAnomalies = () => {
  return useMutation({
    mutationFn: async (params: AnomalyDetectionParams) => {
      const response = await apiRequest("POST", "/anomaly-detection/detect", params);
      return response.data;
    },
  });
};

export const useRecordMetric = () => {
  return useMutation({
    mutationFn: async (params: MetricRecordingParams) => {
      const response = await apiRequest("POST", "/anomaly-detection/metric", params);
      return response.data;
    },
  });
};

export const useGetActiveAnomalies = () => {
  return useQuery({
    queryKey: ["anomalies", "active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/anomaly-detection/active");
      return response.data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useResolveAnomaly = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AnomalyResolutionParams) => {
      const response = await apiRequest("POST", "/anomaly-detection/resolve", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomalies", "active"] });
      queryClient.invalidateQueries({ queryKey: ["anomalies", "stats"] });
    },
  });
};

export const useGetIncidents = (status?: string) => {
  return useQuery({
    queryKey: ["anomalies", "incidents", status],
    queryFn: async () => {
      const params = status ? { status } : {};
      const response = await apiRequest("GET", "/anomaly-detection/incidents", { params });
      return response.data || [];
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });
};

export const useGetAnomalyStats = () => {
  return useQuery({
    queryKey: ["anomalies", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/anomaly-detection/stats");
      return response.data;
    },
    refetchInterval: 45000, // Refetch every 45 seconds
  });
};
