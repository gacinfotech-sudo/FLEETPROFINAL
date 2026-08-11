import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface MetricsInput {
  revenue: number;
  rides: number;
  avgRating: number;
  driverUtilization: number;
  customerChurn: number;
  operatingCost: number;
  profitMargin: number;
}

export interface InsightsInput {
  revenue?: number;
  churn?: number;
  customerSatisfaction?: number;
  systemHealth?: number;
}

export interface HealthReportInput {
  recommendations?: number;
  pricing?: number;
  dispatch?: number;
  maintenance?: number;
  driverIntelligence?: number;
  customerLtv?: number;
  anomalyDetection?: number;
}

export const useRecordMetrics = () => {
  return useMutation({
    mutationFn: async (params: MetricsInput) => {
      const response = await apiRequest("POST", "/analytics/metrics", params);
      return response.data;
    },
  });
};

export const useGetTrends = () => {
  return useQuery({
    queryKey: ["analytics", "trends"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/analytics/trends");
      return response.data || {};
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });
};

export const useGenerateInsights = () => {
  return useMutation({
    mutationFn: async (params: InsightsInput) => {
      const response = await apiRequest("POST", "/analytics/insights", params);
      return response.data;
    },
  });
};

export const useGenerateHealthReport = () => {
  return useMutation({
    mutationFn: async (params: HealthReportInput) => {
      const response = await apiRequest("POST", "/analytics/health-report", params);
      return response.data;
    },
  });
};

export const useGetHealthReports = (limit: number = 10) => {
  return useQuery({
    queryKey: ["analytics", "health-reports", limit],
    queryFn: async () => {
      const response = await apiRequest("GET", "/analytics/health-reports", {
        params: { limit },
      });
      return response.data || [];
    },
    refetchInterval: 120000, // Refetch every 2 minutes
  });
};

export const useGenerateBusinessIntelligence = () => {
  return useMutation({
    mutationFn: async (period: string = "daily") => {
      const response = await apiRequest("POST", "/analytics/business-intelligence", {
        period,
      });
      return response.data;
    },
  });
};

export const useGetAnalyticsStats = () => {
  return useQuery({
    queryKey: ["analytics", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/analytics/stats");
      return response.data;
    },
    refetchInterval: 90000, // Refetch every 90 seconds
  });
};
