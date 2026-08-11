import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface AssessEntityParams {
  entityId: string;
  entityType: "driver" | "customer" | "ride" | "payment" | "account";
  context?: Record<string, any>;
}

export interface RecordTransactionParams {
  entityId: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  location?: { lat: number; lng: number };
}

export interface UpdateVerificationParams {
  entityId: string;
  field: string;
  status: string;
}

export const useAssessEntity = () => {
  return useMutation({
    mutationFn: async (params: AssessEntityParams) => {
      const response = await apiRequest("POST", "/fraud/assess", params);
      return response.data;
    },
  });
};

export const useRecordTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RecordTransactionParams) => {
      const response = await apiRequest("POST", "/fraud/transaction", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud", "stats"] });
    },
  });
};

export const useGetProfile = (entityId: string) => {
  return useQuery({
    queryKey: ["fraud", "profile", entityId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/fraud/profile/${entityId}`);
      return response.data;
    },
  });
};

export const useUpdateVerification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateVerificationParams) => {
      const response = await apiRequest("POST", "/fraud/verify", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud", "profile"] });
    },
  });
};

export const useGetIncidents = (status?: string) => {
  return useQuery({
    queryKey: ["fraud", "incidents", status],
    queryFn: async () => {
      const response = await apiRequest("GET", "/fraud/incidents", {
        params: status ? { status } : {},
      });
      return response.data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useGetFraudStats = () => {
  return useQuery({
    queryKey: ["fraud", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/fraud/stats");
      return response.data;
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });
};
