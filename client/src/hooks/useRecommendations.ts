import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";

interface Recommendation {
  id: string;
  customerId: string;
  type: "booking" | "vehicle" | "route" | "driver" | "timing" | "price" | "loyalty";
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  suggestedAction: string;
  confidence: number;
  expectedBenefit: string;
  tags: string[];
  expiresAt: Date;
  createdAt: Date;
}

export function useRecommendations(customerId?: string) {
  return useQuery({
    queryKey: ["recommendations", customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const response = await fetch(`/api/recommendations?customerId=${customerId}`);
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      return response.json() as Promise<Recommendation[]>;
    },
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRecommendationsByType(
  customerId?: string,
  type?: string
) {
  return useQuery({
    queryKey: ["recommendations", customerId, type],
    queryFn: async () => {
      if (!customerId) return [];

      const url = new URL("/api/recommendations", window.location.origin);
      url.searchParams.set("customerId", customerId);
      if (type) url.searchParams.set("type", type);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      return response.json() as Promise<Recommendation[]>;
    },
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAcceptRecommendation() {
  return useMutation({
    mutationFn: async (recommendationId: string) => {
      const response = await fetch(`/api/recommendations/${recommendationId}/accept`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to accept recommendation");
      return response.json();
    },
  });
}

export function useDismissRecommendation() {
  return useMutation({
    mutationFn: async (recommendationId: string) => {
      const response = await fetch(`/api/recommendations/${recommendationId}/dismiss`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to dismiss recommendation");
      return response.json();
    },
  });
}

export function useRecommendationStats() {
  return useQuery({
    queryKey: ["recommendations", "stats"],
    queryFn: async () => {
      const response = await fetch("/api/recommendations/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useRecommendationWebSocket(customerId?: string) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    if (!customerId) return;

    const ws = new WebSocket(`/ws?customerId=${customerId}&type=recommendations`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "subscribe", customerId, type: "recommendations" }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "recommendations:updated") {
        setRecommendations(message.data);
      }
    };

    return () => {
      ws.close();
    };
  }, [customerId]);

  return recommendations;
}
