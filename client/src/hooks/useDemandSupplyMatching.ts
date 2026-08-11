import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SupplyMetrics {
  route: string;
  totalVehicles: number;
  availableVehicles: number;
  activeBookings: number;
  utilizationRate: number;
  expectedDowntime: number;
  avgResponseTime: number;
}

export interface DemandMetrics {
  route: string;
  currentDemand: number;
  predictedDemand: number;
  peakDemand: number;
  peakTime: Date;
  demandTrend: "increasing" | "stable" | "decreasing";
}

export function useUpdateSupplyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ route, metrics }: { route: string; metrics: Partial<SupplyMetrics> }) => {
      const response = await fetch("/api/matching/supply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, metrics }),
      });
      if (!response.ok) throw new Error("Failed to update supply metrics");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matching", "metrics"] });
      queryClient.invalidateQueries({ queryKey: ["matching", "alerts"] });
    },
  });
}

export function useUpdateDemandMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ route, metrics }: { route: string; metrics: Partial<DemandMetrics> }) => {
      const response = await fetch("/api/matching/demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, metrics }),
      });
      if (!response.ok) throw new Error("Failed to update demand metrics");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matching", "metrics"] });
      queryClient.invalidateQueries({ queryKey: ["matching", "alerts"] });
    },
  });
}

export function useCalculateMatch(route?: string) {
  return useMutation({
    mutationFn: async (routeName: string) => {
      const response = await fetch("/api/matching/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: routeName }),
      });
      if (!response.ok) throw new Error("Failed to calculate match");
      return response.json();
    },
  });
}

export function useMatchingHistory(route?: string, limit: number = 50) {
  return useQuery({
    queryKey: ["matching", "history", route],
    queryFn: async () => {
      if (!route) return [];

      const params = new URLSearchParams();
      params.append("limit", limit.toString());

      const response = await fetch(`/api/matching/history/${route}?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch matching history");
      const data = await response.json();
      return data.data;
    },
    enabled: !!route,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useMatchingAlerts(route?: string, severity?: string) {
  return useQuery({
    queryKey: ["matching", "alerts", route, severity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (route) params.append("route", route);
      if (severity) params.append("severity", severity);

      const response = await fetch(`/api/matching/alerts?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch alerts");
      const data = await response.json();
      return data.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useSystemMetrics() {
  return useQuery({
    queryKey: ["matching", "metrics"],
    queryFn: async () => {
      const response = await fetch("/api/matching/metrics");
      if (!response.ok) throw new Error("Failed to fetch system metrics");
      const data = await response.json();
      return data.data;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

export function useMatchingStrategies(status?: string) {
  return useQuery({
    queryKey: ["matching", "strategies", status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);

      const response = await fetch(`/api/matching/strategies?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch strategies");
      const data = await response.json();
      return data.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useEnableMatchingStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (strategyId: string) => {
      const response = await fetch(`/api/matching/strategies/${strategyId}/enable`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to enable strategy");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matching", "strategies"] });
    },
  });
}

export function useDisableMatchingStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (strategyId: string) => {
      const response = await fetch(`/api/matching/strategies/${strategyId}/disable`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to disable strategy");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matching", "strategies"] });
    },
  });
}
