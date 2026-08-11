import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface ReportIncidentParams {
  vehicleId: string;
  driverId: string;
  type: string;
  title: string;
  description: string;
  reportedBy: "driver" | "customer" | "system" | "admin";
  customerId?: string;
  injuries?: boolean;
  damageEstimate?: number;
}

export interface InvestigateIncidentParams {
  incidentId: string;
  findings: string;
}

export interface ResolveIncidentParams {
  incidentId: string;
  resolutionNotes: string;
  responseActions: string[];
}

export interface RecordViolationParams {
  driverId: string;
  violationType: string;
  details: string;
  location?: { latitude: number; longitude: number };
}

export const useReportIncident = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ReportIncidentParams) => {
      const response = await apiRequest("POST", "/safety/incident", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety"] });
    },
  });
};

export const useGetIncident = (incidentId: string) => {
  return useQuery({
    queryKey: ["safety", "incident", incidentId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/safety/incident/${incidentId}`);
      return response.data;
    },
    enabled: !!incidentId,
    refetchInterval: 30000,
  });
};

export const useInvestigateIncident = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: InvestigateIncidentParams) => {
      const response = await apiRequest(
        "POST",
        `/safety/incident/${params.incidentId}/investigate`,
        { findings: params.findings }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety"] });
    },
  });
};

export const useResolveIncident = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ResolveIncidentParams) => {
      const response = await apiRequest(
        "POST",
        `/safety/incident/${params.incidentId}/resolve`,
        {
          resolutionNotes: params.resolutionNotes,
          responseActions: params.responseActions,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety"] });
    },
  });
};

export const useCloseIncident = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (incidentId: string) => {
      const response = await apiRequest(
        "POST",
        `/safety/incident/${incidentId}/close`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety"] });
    },
  });
};

export const useGetDriverIncidents = (driverId: string) => {
  return useQuery({
    queryKey: ["safety", "driver_incidents", driverId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/safety/driver/${driverId}/incidents`
      );
      return response.data || [];
    },
    enabled: !!driverId,
  });
};

export const useGetDriverSafetyProfile = (driverId: string) => {
  return useQuery({
    queryKey: ["safety", "profile", driverId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/safety/driver/${driverId}/profile`
      );
      return response.data;
    },
    enabled: !!driverId,
    refetchInterval: 60000,
  });
};

export const useRecordViolation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RecordViolationParams) => {
      const response = await apiRequest("POST", "/safety/violation", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety"] });
    },
  });
};

export const useAssignTraining = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { driverId: string; trainingType: string }) => {
      const response = await apiRequest("POST", "/safety/training", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety"] });
    },
  });
};

export const useCompleteTraining = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { trainingId: string; score: number }) => {
      const response = await apiRequest(
        "POST",
        `/safety/training/${params.trainingId}/complete`,
        { score: params.score }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety"] });
    },
  });
};

export const useGetSafetyMetrics = () => {
  return useQuery({
    queryKey: ["safety", "metrics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/safety/metrics");
      return response.data;
    },
    refetchInterval: 60000,
  });
};

export const useGetPendingInvestigations = () => {
  return useQuery({
    queryKey: ["safety", "pending_investigations"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/safety/pending-investigations"
      );
      return response.data || [];
    },
    refetchInterval: 30000,
  });
};
