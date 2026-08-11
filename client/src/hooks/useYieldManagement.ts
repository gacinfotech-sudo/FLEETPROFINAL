import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface OptimizeParams {
  strategy?: "maximize_revenue" | "maximize_profit" | "maximize_utilization" | "balanced";
}

export const useGenerateOptimizationPlan = () => {
  return useMutation({
    mutationFn: async (params: OptimizeParams) => {
      const response = await apiRequest("POST", "/yield/optimize", params);
      return response.data;
    },
  });
};

export const useAnalyzeProfitability = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/yield/profitability");
      return response.data;
    },
  });
};

export const useCreateBundles = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/yield/bundles");
      return response.data;
    },
  });
};

export const useAllocateInventory = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/yield/inventory/allocate");
      return response.data;
    },
  });
};

export const useGetYieldStats = () => {
  return useQuery({
    queryKey: ["yield", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/yield/stats");
      return response.data;
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });
};

export const useGetRevenueForecasts = () => {
  return useQuery({
    queryKey: ["yield", "forecasts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/yield/forecasts");
      return response.data;
    },
    refetchInterval: 120000, // Refetch every 2 minutes
  });
};
