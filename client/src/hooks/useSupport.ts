import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface CreateTicketParams {
  category: string;
  subject: string;
  description: string;
}

export interface AddMessageParams {
  ticketId: string;
  content: string;
}

export interface ResolveTicketParams {
  ticketId: string;
  resolutionType: string;
  description: string;
  compensation?: { type: string; amount: number };
}

export interface EscalateTicketParams {
  ticketId: string;
  toQueue: string;
  reason: string;
}

export interface RecordSatisfactionParams {
  ticketId: string;
  score: number;
  comments?: string;
}

export const useCreateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateTicketParams) => {
      const response = await apiRequest("POST", "/support/ticket", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
    },
  });
};

export const useAddMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddMessageParams) => {
      const response = await apiRequest(
        "POST",
        `/support/ticket/${params.ticketId}/message`,
        { content: params.content }
      );
      return response.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({
        queryKey: ["support", "ticket", data.ticketId],
      });
    },
  });
};

export const useResolveTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ResolveTicketParams) => {
      const response = await apiRequest(
        "POST",
        `/support/ticket/${params.ticketId}/resolve`,
        {
          resolutionType: params.resolutionType,
          description: params.description,
          compensation: params.compensation,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support", "analytics"] });
    },
  });
};

export const useEscalateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EscalateTicketParams) => {
      const response = await apiRequest(
        "POST",
        `/support/ticket/${params.ticketId}/escalate`,
        {
          toQueue: params.toQueue,
          reason: params.reason,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
    },
  });
};

export const useRecordSatisfaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RecordSatisfactionParams) => {
      const response = await apiRequest(
        "POST",
        `/support/ticket/${params.ticketId}/satisfaction`,
        {
          score: params.score,
          comments: params.comments,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support", "analytics"] });
    },
  });
};

export const useGetTicket = (ticketId: string) => {
  return useQuery({
    queryKey: ["support", "ticket", ticketId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/support/ticket/${ticketId}`);
      return response.data;
    },
    enabled: !!ticketId,
    refetchInterval: 5000,
  });
};

export const useGetTickets = () => {
  return useQuery({
    queryKey: ["support", "tickets"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/support/tickets");
      return response.data || [];
    },
    refetchInterval: 30000,
  });
};

export const useGetSupportAnalytics = () => {
  return useQuery({
    queryKey: ["support", "analytics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/support/analytics");
      return response.data;
    },
    refetchInterval: 60000,
  });
};

export const useGetAgents = () => {
  return useQuery({
    queryKey: ["support", "agents"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/support/agents");
      return response.data || [];
    },
    refetchInterval: 30000,
  });
};

export const useGetFAQs = (category?: string) => {
  return useQuery({
    queryKey: ["support", "faqs", category],
    queryFn: async () => {
      const params = category ? { params: { category } } : undefined;
      const response = await apiRequest("GET", "/support/faqs", params);
      return response.data || [];
    },
  });
};
