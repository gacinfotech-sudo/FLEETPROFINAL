import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";

export interface UpdateLocationParams {
  vehicleId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  address?: string;
}

export interface CreateRouteParams {
  vehicleId: string;
  startPoint: { latitude: number; longitude: number };
  endPoint: { latitude: number; longitude: number };
  waypoints?: { latitude: number; longitude: number }[];
}

export interface StartTripParams {
  vehicleId: string;
  driverId: string;
  startLocation: { latitude: number; longitude: number };
  routeId?: string;
}

export interface EndTripParams {
  tripId: string;
  endLocation: { latitude: number; longitude: number };
}

export const useUpdateLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateLocationParams) => {
      const response = await apiRequest("POST", "/tracking/location", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking"] });
    },
  });
};

export const useGetLocation = (vehicleId: string) => {
  return useQuery({
    queryKey: ["tracking", "location", vehicleId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/tracking/location/${vehicleId}`);
      return response.data;
    },
    enabled: !!vehicleId,
    refetchInterval: 5000, // Update every 5 seconds
  });
};

export const useCreateRoute = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateRouteParams) => {
      const response = await apiRequest("POST", "/tracking/route", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking", "routes"] });
    },
  });
};

export const useOptimizeRoute = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (routeId: string) => {
      const response = await apiRequest(
        "POST",
        `/tracking/route/${routeId}/optimize`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking", "routes"] });
    },
  });
};

export const useGetRoute = (routeId: string) => {
  return useQuery({
    queryKey: ["tracking", "route", routeId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/tracking/route/${routeId}`);
      return response.data;
    },
    enabled: !!routeId,
  });
};

export const useStartTrip = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: StartTripParams) => {
      const response = await apiRequest("POST", "/tracking/trip/start", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking", "trips"] });
    },
  });
};

export const useEndTrip = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EndTripParams) => {
      const response = await apiRequest(
        "POST",
        `/tracking/trip/${params.tripId}/end`,
        { endLocation: params.endLocation }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking", "trips"] });
    },
  });
};

export const useGetTrip = (tripId: string) => {
  return useQuery({
    queryKey: ["tracking", "trip", tripId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/tracking/trip/${tripId}`);
      return response.data;
    },
    enabled: !!tripId,
  });
};

export const useGetVehicleStats = (vehicleId: string) => {
  return useQuery({
    queryKey: ["tracking", "stats", vehicleId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/tracking/stats/${vehicleId}`
      );
      return response.data;
    },
    enabled: !!vehicleId,
    refetchInterval: 30000,
  });
};

export const useGetGeofenceEvents = (vehicleId?: string, hours: number = 24) => {
  return useQuery({
    queryKey: ["tracking", "geofence_events", vehicleId, hours],
    queryFn: async () => {
      const params = vehicleId ? { params: { vehicleId, hours } } : { params: { hours } };
      const response = await apiRequest("GET", "/tracking/geofence-events", params);
      return response.data || [];
    },
  });
};

export const useGetTrackingAnalytics = () => {
  return useQuery({
    queryKey: ["tracking", "analytics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/tracking/analytics");
      return response.data;
    },
    refetchInterval: 60000,
  });
};
