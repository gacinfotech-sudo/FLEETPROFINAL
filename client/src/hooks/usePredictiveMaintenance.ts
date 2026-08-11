import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface VehicleHealthMetrics {
  vehicleId: string;
  mileage: number;
  age: number;
  engineHours: number;
  lastServiceDate: Date;
  nextServiceDate: Date;
  fuelEfficiency: number;
  engineOilLevel: number;
  coolantLevel: number;
  brakePadWear: number;
  tireCondition: number;
  batteryHealth: number;
  transmissionFluidLevel: number;
  faultCodes: string[];
  lastDiagnosticDate: Date;
}

export function useUpdateVehicleMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vehicleId, metrics }: { vehicleId: string; metrics: Partial<VehicleHealthMetrics> }) => {
      const response = await fetch("/api/maintenance/vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, metrics }),
      });
      if (!response.ok) throw new Error("Failed to update vehicle metrics");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance", "fleet"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance", "vehicle"] });
    },
  });
}

export function useVehicleMaintenance(vehicleId?: string) {
  return useQuery({
    queryKey: ["maintenance", "vehicle", vehicleId],
    queryFn: async () => {
      if (!vehicleId) return null;

      const response = await fetch(`/api/maintenance/vehicle/${vehicleId}`);
      if (!response.ok) throw new Error("Failed to fetch vehicle maintenance");
      const data = await response.json();
      return data.data;
    },
    enabled: !!vehicleId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useFleetHealthReport() {
  return useQuery({
    queryKey: ["maintenance", "fleet"],
    queryFn: async () => {
      const response = await fetch("/api/maintenance/fleet");
      if (!response.ok) throw new Error("Failed to fetch fleet health report");
      const data = await response.json();
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCompleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vehicleId, serviceType }: { vehicleId: string; serviceType: string }) => {
      const response = await fetch(`/api/maintenance/service/${vehicleId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceType }),
      });
      if (!response.ok) throw new Error("Failed to complete service");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
  });
}
