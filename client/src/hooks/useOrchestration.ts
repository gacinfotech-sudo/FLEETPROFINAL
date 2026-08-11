import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface ExecuteWorkflowParams {
  workflowId: string;
  context?: Record<string, any>;
}

export interface AddRecommendationParams {
  sourceSystem: string;
  category: string;
  priority?: "critical" | "high" | "medium" | "low";
  action: string;
  estimatedROI?: number;
  expiresAt?: Date;
}

export interface MakeDecisionParams {
  sourceSystem: string;
  recommendation: string;
  priority?: "critical" | "high" | "medium" | "low";
}

export interface CreateAlertParams {
  system: string;
  title: string;
  message: string;
  severity?: "critical" | "warning" | "info";
}

export const useExecuteWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ExecuteWorkflowParams) => {
      const response = await apiRequest("POST", "/orchestration/execute", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orchestration", "stats"] });
    },
  });
};

export const useAddRecommendation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddRecommendationParams) => {
      const response = await apiRequest("POST", "/orchestration/recommend", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orchestration", "recommendations"],
      });
    },
  });
};

export const useMakeDecision = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MakeDecisionParams) => {
      const response = await apiRequest("POST", "/orchestration/decide", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orchestration", "stats"] });
    },
  });
};

export const useCreateAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateAlertParams) => {
      const response = await apiRequest("POST", "/orchestration/alert", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orchestration", "alerts"] });
    },
  });
};

export const useGetWorkflows = () => {
  return useQuery({
    queryKey: ["orchestration", "workflows"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/orchestration/workflows");
      return response.data || [];
    },
  });
};

export const useGetAlerts = (status?: string) => {
  return useQuery({
    queryKey: ["orchestration", "alerts", status],
    queryFn: async () => {
      const response = await apiRequest("GET", "/orchestration/alerts", {
        params: status ? { status } : {},
      });
      return response.data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest(
        "POST",
        `/orchestration/alerts/${alertId}/acknowledge`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orchestration", "alerts"] });
    },
  });
};

export const useGetRecommendations = (sourceSystem?: string) => {
  return useQuery({
    queryKey: ["orchestration", "recommendations", sourceSystem],
    queryFn: async () => {
      const response = await apiRequest("GET", "/orchestration/recommendations", {
        params: sourceSystem ? { sourceSystem } : {},
      });
      return response.data || [];
    },
    refetchInterval: 45000, // Refetch every 45 seconds
  });
};

export const useGetPlatformMetrics = () => {
  return useQuery({
    queryKey: ["orchestration", "metrics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/orchestration/metrics");
      return response.data;
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });
};

export const useGetOrchestrationStats = () => {
  return useQuery({
    queryKey: ["orchestration", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/orchestration/stats");
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
