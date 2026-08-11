import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface SubmitReviewParams {
  entityId: string;
  entityType: "driver" | "service" | "booking";
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  comment: string;
  photos?: string[];
}

export interface RespondToReviewParams {
  reviewId: string;
  responseText: string;
}

export interface ApproveReviewParams {
  reviewId: string;
}

export interface RejectReviewParams {
  reviewId: string;
  reason: string;
}

export const useSubmitReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SubmitReviewParams) => {
      const response = await apiRequest("POST", "/feedback/review", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback", "stats"] });
    },
  });
};

export const useGetReviews = (entityId: string, status?: string) => {
  return useQuery({
    queryKey: ["feedback", "reviews", entityId, status],
    queryFn: async () => {
      const params = status ? { params: { status } } : undefined;
      const response = await apiRequest(
        "GET",
        `/feedback/reviews/${entityId}`,
        params
      );
      return response.data || [];
    },
    enabled: !!entityId,
  });
};

export const useGetReputation = (entityId: string) => {
  return useQuery({
    queryKey: ["feedback", "reputation", entityId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/feedback/reputation/${entityId}`);
      return response.data;
    },
    enabled: !!entityId,
  });
};

export const useApproveReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ApproveReviewParams) => {
      const response = await apiRequest(
        "POST",
        `/feedback/review/${params.reviewId}/approve`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
  });
};

export const useRejectReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RejectReviewParams) => {
      const response = await apiRequest(
        "POST",
        `/feedback/review/${params.reviewId}/reject`,
        { reason: params.reason }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
  });
};

export const useRespondToReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RespondToReviewParams) => {
      const response = await apiRequest(
        "POST",
        `/feedback/review/${params.reviewId}/respond`,
        { responseText: params.responseText }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
  });
};

export const useMarkReviewHelpful = () => {
  return useMutation({
    mutationFn: async (params: {
      reviewId: string;
      helpful: boolean;
    }) => {
      const response = await apiRequest(
        "POST",
        `/feedback/review/${params.reviewId}/helpful`,
        { helpful: params.helpful }
      );
      return response.data;
    },
  });
};

export const useGetInsights = (category: string, period: "7d" | "30d" | "90d" = "30d") => {
  return useQuery({
    queryKey: ["feedback", "insights", category, period],
    queryFn: async () => {
      const response = await apiRequest("GET", `/feedback/insights/${category}`, {
        params: { period },
      });
      return response.data;
    },
    enabled: !!category,
  });
};

export const useGetPendingModeration = () => {
  return useQuery({
    queryKey: ["feedback", "pending_moderation"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/feedback/pending-moderation");
      return response.data || [];
    },
    refetchInterval: 30000,
  });
};

export const useGetFeedbackStats = () => {
  return useQuery({
    queryKey: ["feedback", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/feedback/stats");
      return response.data;
    },
    refetchInterval: 60000,
  });
};
