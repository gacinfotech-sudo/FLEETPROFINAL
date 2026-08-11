import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface EarnPointsParams {
  customerId: string;
  points: number;
  reason: string;
  rideId?: string;
}

export interface RedeemPointsParams {
  customerId: string;
  points: number;
  rewardType: string;
  description?: string;
}

export interface CreateReferralParams {
  customerId: string;
}

export interface CompleteReferralParams {
  referralCode: string;
  refereeId: string;
}

export const useGetProfile = (customerId: string) => {
  return useQuery({
    queryKey: ["loyalty", "profile", customerId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/loyalty/profile/${customerId}`);
      return response.data;
    },
    enabled: !!customerId,
    refetchInterval: 30000,
  });
};

export const useEarnPoints = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EarnPointsParams) => {
      const response = await apiRequest("POST", "/loyalty/points/earn", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty"] });
    },
  });
};

export const useRedeemPoints = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RedeemPointsParams) => {
      const response = await apiRequest("POST", "/loyalty/points/redeem", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty"] });
    },
  });
};

export const useGetAllTiers = () => {
  return useQuery({
    queryKey: ["loyalty", "tiers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/loyalty/tiers");
      return response.data || [];
    },
  });
};

export const useGetTier = (tier: string) => {
  return useQuery({
    queryKey: ["loyalty", "tier", tier],
    queryFn: async () => {
      const response = await apiRequest("GET", `/loyalty/tier/${tier}`);
      return response.data;
    },
    enabled: !!tier,
  });
};

export const useGetTransactionHistory = (customerId: string, limit: number = 50) => {
  return useQuery({
    queryKey: ["loyalty", "transactions", customerId, limit],
    queryFn: async () => {
      const response = await apiRequest("GET", `/loyalty/transactions/${customerId}`, {
        params: { limit },
      });
      return response.data || [];
    },
    enabled: !!customerId,
  });
};

export const useCreateReferral = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateReferralParams) => {
      const response = await apiRequest("POST", "/loyalty/referral", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty"] });
    },
  });
};

export const useCompleteReferral = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CompleteReferralParams) => {
      const response = await apiRequest("POST", "/loyalty/referral/complete", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty"] });
    },
  });
};

export const useAddMilestone = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      customerId: string;
      milestone: number;
      type: "rides" | "spending";
    }) => {
      const response = await apiRequest("POST", "/loyalty/milestone", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty"] });
    },
  });
};

export const useClaimMilestone = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (milestoneId: string) => {
      const response = await apiRequest(
        "POST",
        `/loyalty/milestone/${milestoneId}/claim`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty"] });
    },
  });
};

export const useGetChallenges = () => {
  return useQuery({
    queryKey: ["loyalty", "challenges"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/loyalty/challenges");
      return response.data || [];
    },
    refetchInterval: 60000,
  });
};

export const useGetLoyaltyStats = () => {
  return useQuery({
    queryKey: ["loyalty", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/loyalty/stats");
      return response.data;
    },
    refetchInterval: 60000,
  });
};
