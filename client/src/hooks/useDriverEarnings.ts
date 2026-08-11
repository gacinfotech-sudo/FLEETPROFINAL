import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface RecordEarningParams {
  driverId: string;
  bookingId: string;
  fareAmount: number;
  platformFee?: number;
}

export interface CreateIncentiveParams {
  driverId: string;
  type:
    | "rides_completed"
    | "rating_bonus"
    | "on_time_bonus"
    | "safety_bonus"
    | "referral_bonus";
  targetMetric: number;
  bonusAmount: number;
  period: "daily" | "weekly" | "biweekly" | "monthly";
}

export interface RequestPayoutParams {
  driverId: string;
  amount: number;
  method: string;
  bankDetails?: any;
  upiId?: string;
}

export const useRecordEarning = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RecordEarningParams) => {
      const response = await apiRequest("POST", "/earnings/record", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
    },
  });
};

export const useGetProfile = (driverId: string) => {
  return useQuery({
    queryKey: ["earnings", "profile", driverId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/earnings/profile/${driverId}`);
      return response.data;
    },
    enabled: !!driverId,
    refetchInterval: 30000,
  });
};

export const useCreateIncentive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateIncentiveParams) => {
      const response = await apiRequest("POST", "/earnings/incentive", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
    },
  });
};

export const useGenerateStatement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      driverId: string;
      period: string;
    }) => {
      const response = await apiRequest("POST", "/earnings/statement", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings", "statements"] });
    },
  });
};

export const useGetStatements = (driverId: string) => {
  return useQuery({
    queryKey: ["earnings", "statements", driverId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/earnings/statements/${driverId}`
      );
      return response.data || [];
    },
    enabled: !!driverId,
  });
};

export const useRequestPayout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RequestPayoutParams) => {
      const response = await apiRequest("POST", "/earnings/payout", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings", "payouts"] });
    },
  });
};

export const useGetPendingPayouts = (driverId: string) => {
  return useQuery({
    queryKey: ["earnings", "payouts", driverId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/earnings/payouts/${driverId}`);
      return response.data || [];
    },
    enabled: !!driverId,
    refetchInterval: 30000,
  });
};

export const useGetAnalytics = (driverId: string) => {
  return useQuery({
    queryKey: ["earnings", "analytics", driverId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/earnings/analytics/${driverId}`
      );
      return response.data;
    },
    enabled: !!driverId,
    refetchInterval: 60000,
  });
};

export const useGetTaxSummary = (driverId: string) => {
  return useQuery({
    queryKey: ["earnings", "tax", driverId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/earnings/tax-summary/${driverId}`
      );
      return response.data;
    },
    enabled: !!driverId,
  });
};
