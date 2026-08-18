import { useQuery, useMutation } from "@tanstack/react-query";

export interface PricingContext {
  basePrice: number;
  distance: number;
  duration: number;
  pickupTime?: Date;
  dropoffLocation: string;
  vehicleCategory: string;
  customerId?: string;
  customerSegment?: string;
  customerLTV?: number;
  isFrequentRoute?: boolean;
  currentDemand?: number;
  demandForecast?: number;
  competitorPrice?: number;
  isHoliday?: boolean;
  isWeekend?: boolean;
  vehicleUtilization?: number;
  availableVehicles?: number;
}

export function useCalculateDynamicPrice(context?: Partial<PricingContext>) {
  return useQuery({
    queryKey: ["pricing", "calculate", context],
    queryFn: async () => {
      if (!context) return null;

      const params = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      const response = await fetch(`/api/pricing/calculate?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to calculate price");
      const data = await response.json();
      return data.data;
    },
    enabled: !!context,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCalculatePriceWithBody(context?: Partial<PricingContext>) {
  return useMutation({
    mutationFn: async (pricingContext: Partial<PricingContext>) => {
      const response = await fetch("/api/pricing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricingContext),
      });
      if (!response.ok) throw new Error("Failed to calculate price");
      const data = await response.json();
      return data.data;
    },
  });
}

export function usePricingRules() {
  return useQuery({
    queryKey: ["pricing", "rules"],
    queryFn: async () => {
      const response = await fetch("/api/pricing/rules");
      if (!response.ok) throw new Error("Failed to fetch pricing rules");
      const data = await response.json();
      return data.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useEnablePricingRule() {
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(`/api/pricing/rules/${ruleId}/enable`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to enable rule");
      return response.json();
    },
  });
}

export function useDisablePricingRule() {
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(`/api/pricing/rules/${ruleId}/disable`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to disable rule");
      return response.json();
    },
  });
}

export function useUpdateRulePriority() {
  return useMutation({
    mutationFn: async ({ ruleId, priority }: { ruleId: string; priority: number }) => {
      const response = await fetch(`/api/pricing/rules/${ruleId}/priority`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (!response.ok) throw new Error("Failed to update rule priority");
      return response.json();
    },
  });
}

export function usePricingStats() {
  return useQuery({
    queryKey: ["pricing", "stats"],
    queryFn: async () => {
      const response = await fetch("/api/pricing/stats");
      if (!response.ok) throw new Error("Failed to fetch pricing stats");
      const data = await response.json();
      return data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateDemand() {
  return useMutation({
    mutationFn: async ({ route, demand }: { route: string; demand: number }) => {
      const response = await fetch("/api/pricing/demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, demand }),
      });
      if (!response.ok) throw new Error("Failed to update demand");
      return response.json();
    },
  });
}

export function useUpdateCompetitorPrice() {
  return useMutation({
    mutationFn: async ({ route, price }: { route: string; price: number }) => {
      const response = await fetch("/api/pricing/competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, price }),
      });
      if (!response.ok) throw new Error("Failed to update competitor price");
      return response.json();
    },
  });
}
