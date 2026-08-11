import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface CreateAlertParams {
  severity: "critical" | "high" | "medium" | "low";
  type: string;
  title: string;
  description: string;
  affectedSystem: string;
}

export interface ResolveAlertParams {
  alertId: string;
  resolution: string;
}

export interface UpdateConfigParams {
  category: string;
  key: string;
  value: any;
  updatedBy: string;
}

export interface GenerateReportParams {
  title: string;
  type: "daily" | "weekly" | "monthly" | "custom";
  generatedBy: string;
  periodStart: string;
  periodEnd: string;
}

export interface CreateBulkOperationParams {
  type: string;
  targetCount: number;
  createdBy: string;
}

export interface UpdateBulkOperationParams {
  operationId: string;
  processed: number;
  successful: number;
  failed: number;
}

export const useGetMetrics = () => {
  return useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/admin/metrics");
      return response.data;
    },
    refetchInterval: 30000,
  });
};

export const useGetAuditLogs = (adminId?: string, entityType?: string, limit: number = 100) => {
  return useQuery({
    queryKey: ["admin", "audit-logs", adminId, entityType, limit],
    queryFn: async () => {
      const response = await apiRequest("GET", "/admin/audit-logs", {
        params: { adminId, entityType, limit },
      });
      return response.data || [];
    },
  });
};

export const useLogAuditAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      adminId: string;
      action: string;
      entityType: string;
      entityId: string;
      changes: any;
    }) => {
      const response = await apiRequest("POST", "/admin/audit-log", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
};

export const useGetAlerts = () => {
  return useQuery({
    queryKey: ["admin", "alerts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/admin/alerts");
      return response.data || [];
    },
    refetchInterval: 20000,
  });
};

export const useCreateAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateAlertParams) => {
      const response = await apiRequest("POST", "/admin/alert", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "alerts"] });
    },
  });
};

export const useResolveAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ResolveAlertParams) => {
      const response = await apiRequest("POST", `/admin/alert/${params.alertId}/resolve`, {
        resolution: params.resolution,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "alerts"] });
    },
  });
};

export const useGetConfigurations = () => {
  return useQuery({
    queryKey: ["admin", "config"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/admin/config");
      return response.data || [];
    },
  });
};

export const useUpdateConfiguration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateConfigParams) => {
      const response = await apiRequest("POST", "/admin/config", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
    },
  });
};

export const useGenerateReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerateReportParams) => {
      const response = await apiRequest("POST", "/admin/report", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
  });
};

export const useGetReport = (reportId: string) => {
  return useQuery({
    queryKey: ["admin", "report", reportId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/admin/report/${reportId}`);
      return response.data;
    },
    enabled: !!reportId,
  });
};

export const useGetAdmins = () => {
  return useQuery({
    queryKey: ["admin", "admins"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/admin/admins");
      return response.data || [];
    },
  });
};

export const useCreateBulkOperation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateBulkOperationParams) => {
      const response = await apiRequest("POST", "/admin/bulk-operation", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bulk-operations"] });
    },
  });
};

export const useUpdateBulkOperation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateBulkOperationParams) => {
      const response = await apiRequest("PUT", `/admin/bulk-operation/${params.operationId}`, {
        processed: params.processed,
        successful: params.successful,
        failed: params.failed,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bulk-operations"] });
    },
  });
};
