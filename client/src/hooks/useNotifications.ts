import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  channels?: string[];
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface TemplateNotificationParams {
  userId: string;
  templateId: string;
  variables: Record<string, any>;
}

export interface PreferencesParams {
  userId: string;
  channels?: Record<string, boolean>;
  categories?: Record<string, boolean>;
  quiet_hours?: {
    start: string;
    end: string;
  };
  batching_enabled?: boolean;
  batching_interval?: number;
}

export const useCreateNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateNotificationParams) => {
      const response = await apiRequest("POST", "/notifications/create", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export const useCreateNotificationFromTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: TemplateNotificationParams) => {
      const response = await apiRequest("POST", "/notifications/from-template", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export const useGetUserNotifications = (userId: string, limit: number = 50) => {
  return useQuery({
    queryKey: ["notifications", "user", userId, limit],
    queryFn: async () => {
      const response = await apiRequest("GET", `/notifications/user/${userId}`, {
        params: { limit },
      });
      return response.data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useGetUnreadNotifications = (userId: string) => {
  return useQuery({
    queryKey: ["notifications", "unread", userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/notifications/user/${userId}/unread`);
      return response.data || [];
    },
    refetchInterval: 15000, // Refetch every 15 seconds
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("POST", `/notifications/${notificationId}/read`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export const useSetPreferences = () => {
  return useMutation({
    mutationFn: async (params: PreferencesParams) => {
      const response = await apiRequest("POST", "/notifications/preferences", params);
      return response.data;
    },
  });
};

export const useGetPreferences = (userId: string) => {
  return useQuery({
    queryKey: ["notifications", "preferences", userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/notifications/preferences/${userId}`);
      return response.data;
    },
  });
};

export const useGetTemplates = () => {
  return useQuery({
    queryKey: ["notifications", "templates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/notifications/templates");
      return response.data || [];
    },
  });
};

export const useGetDeliveryStats = () => {
  return useQuery({
    queryKey: ["notifications", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/notifications/stats");
      return response.data;
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });
};
