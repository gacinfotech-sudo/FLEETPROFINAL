import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface TrainingStartParams {
  modelId: string;
  datasetConfig: {
    size: number;
    features: string[];
    targetVariable: string;
    timeRange: {
      start: Date;
      end: Date;
    };
    splitRatio: {
      train: number;
      validation: number;
      test: number;
    };
  };
}

export interface DeploymentParams {
  modelId: string;
  trainingJobId: string;
}

export interface PredictionParams {
  modelId: string;
  input: Record<string, any>;
}

export const useStartTraining = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: TrainingStartParams) => {
      const response = await apiRequest("POST", "/ml/training/start", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml", "training"] });
      queryClient.invalidateQueries({ queryKey: ["ml", "stats"] });
    },
  });
};

export const useGetTrainingJob = (jobId: string) => {
  return useQuery({
    queryKey: ["ml", "training", jobId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/ml/training/${jobId}`);
      return response.data;
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};

export const useGetAllTrainingJobs = (status?: string) => {
  return useQuery({
    queryKey: ["ml", "training", status],
    queryFn: async () => {
      const response = await apiRequest("GET", "/ml/training", {
        params: status ? { status } : {},
      });
      return response.data || [];
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

export const useDeployModel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: DeploymentParams) => {
      const response = await apiRequest("POST", "/ml/models/deploy", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml", "models"] });
      queryClient.invalidateQueries({ queryKey: ["ml", "stats"] });
    },
  });
};

export const useGetDeployedModel = (modelId: string) => {
  return useQuery({
    queryKey: ["ml", "models", modelId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/ml/models/${modelId}`);
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useGetAllDeployedModels = () => {
  return useQuery({
    queryKey: ["ml", "models"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/ml/models");
      return response.data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useMakePrediction = () => {
  return useMutation({
    mutationFn: async (params: PredictionParams) => {
      const response = await apiRequest("POST", "/ml/predict", params);
      return response.data;
    },
  });
};

export const useEvaluateModel = () => {
  return useMutation({
    mutationFn: async (modelId: string) => {
      const response = await apiRequest("POST", `/ml/evaluate/${modelId}`);
      return response.data;
    },
  });
};

export const useGetMLStats = () => {
  return useQuery({
    queryKey: ["ml", "stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/ml/stats");
      return response.data;
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });
};

export const useGetPredictionStats = (modelId?: string) => {
  return useQuery({
    queryKey: ["ml", "predictions", "stats", modelId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/ml/predictions/stats", {
        params: modelId ? { modelId } : {},
      });
      return response.data;
    },
    refetchInterval: 45000, // Refetch every 45 seconds
  });
};
