import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface TrackEventParams {
  competitorId: string;
  eventType: string;
  description: string;
  impact: "high" | "medium" | "low";
}

export const useAnalyzePricing = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/competitors/analyze-pricing");
      return response.data;
    },
  });
};

export const useGetMarketPositioning = () => {
  return useQuery({
    queryKey: ["competitors", "positioning"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/competitors/positioning");
      return response.data;
    },
    refetchInterval: 120000, // Refetch every 2 minutes
  });
};

export const useTrackCompetitorEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: TrackEventParams) => {
      const response = await apiRequest("POST", "/competitors/track-event", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
    },
  });
};

export const useGetCompetitorProfiles = () => {
  return useQuery({
    queryKey: ["competitors", "profiles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/competitors/profiles");
      return response.data || [];
    },
    refetchInterval: 180000, // Refetch every 3 minutes
  });
};

export const useGetCompetitor = (competitorId: string) => {
  return useQuery({
    queryKey: ["competitors", competitorId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/competitors/${competitorId}`);
      return response.data;
    },
  });
};

export const useGetMarketSegments = (segment?: string) => {
  return useQuery({
    queryKey: ["competitors", "segments", segment],
    queryFn: async () => {
      const response = await apiRequest("GET", "/competitors/market/segments", {
        params: segment ? { segment } : {},
      });
      return response.data || [];
    },
    refetchInterval: 150000, // Refetch every 2.5 minutes
  });
};

export const useGetCompetitiveAnalytics = () => {
  return useQuery({
    queryKey: ["competitors", "analytics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/competitors/analytics");
      return response.data;
    },
    refetchInterval: 180000, // Refetch every 3 minutes
  });
};
