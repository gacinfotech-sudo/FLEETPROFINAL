import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface AllocationGenerateParams {
  horizon?: number;
}

export interface ScheduleOptimizeParams {
  driverIds: string[];
}

export interface CapacityForecastParams {
  days?: number;
}

export interface ActionExecuteParams {
  actionId: string;
}

export const useGenerateAllocationPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AllocationGenerateParams) => {
      const response = await apiRequest(
        "POST",
        "/resources/allocation/generate",
        params
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "allocation"] });
      queryClient.invalidateQueries({ queryKey: ["resources", "stats"] });
    },
  });
};

export const useGetZones = () => {
  return useQuery({
    queryKey: ["resources", "zones"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/resources/zones");
      return response.data || [];
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });
};

export const useExecuteAllocationAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ActionExecuteParams) => {
      const response = await apiRequest(
        "POST",
        "/resources/allocation/execute",
        params
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "actions"] });
    },
  });
};

export const useOptimizeDriverSchedules = () => {
  return useMutation({
    mutationFn: async (params: ScheduleOptimizeParams) => {
      const response = await apiRequest(
        "POST",
        "/resources/driver-schedules/optimize",
        params
      );
      return response.data;
    },
  });
};

export const useForecastCapacity = () => {
  return useMutation({
    mutationFn: async (params: CapacityForecastParams) => {
      const response = await apiRequest(
        "POST",
        "/resources/capacity/forecast",
        params
      );
      return response.data;
    },
  });
};

export const useGetResourceMetrics = () => {
  return useQuery({
    queryKey: ["resources", "metrics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/resources/metrics");
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useGetAllocationActions = (status?: string) => {
  return useQuery({
    queryKey: ["resources", "actions", status],
    queryFn: async () => {
      const response = await apiRequest("GET", "/resources/actions", {
        params: status ? { status } : {},
      });
      return response.data || [];
    },
    refetchInterval: 15000, // Refetch every 15 seconds
  });
};

export const useGetAllocationStats = () => {
  return useQuery({
    queryKey: ["resources", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/resources/stats");
      return response.data;
    },
    refetchInterval: 45000, // Refetch every 45 seconds
  });
};
