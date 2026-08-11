import { useState, useEffect } from "react";

export interface DashboardWidget {
  id: string;
  title: string;
  type: "kpi" | "chart" | "list" | "map" | "status";
  enabled: boolean;
  order: number;
  size: "small" | "medium" | "large"; // grid column spans
  minHeight?: number;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "kpi-cards", title: "Key Metrics", type: "kpi", enabled: true, order: 0, size: "large" },
  { id: "revenue-trend", title: "Revenue Trend", type: "chart", enabled: true, order: 1, size: "large" },
  { id: "fleet-status", title: "Fleet Status", type: "status", enabled: true, order: 2, size: "medium" },
  { id: "driver-status", title: "Driver Status", type: "status", enabled: true, order: 3, size: "medium" },
  { id: "booking-activity", title: "Booking Activity", type: "chart", enabled: true, order: 4, size: "large" },
  { id: "attention", title: "Attention Required", type: "list", enabled: true, order: 5, size: "medium" },
  { id: "upcoming", title: "Upcoming Bookings", type: "list", enabled: true, order: 6, size: "medium" },
  { id: "live-ops", title: "Live Operations", type: "status", enabled: true, order: 7, size: "large" },
  { id: "gps", title: "Live Fleet GPS", type: "map", enabled: true, order: 8, size: "medium" },
];

const STORAGE_KEY = "fleetpro_dashboard_layout";

export function useDashboardLayout() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLayout = async () => {
      try {
        const res = await fetch("/api/user/dashboard-layout", { credentials: "include" });
        if (res.ok) {
          const saved = await res.json();
          if (saved && Array.isArray(saved)) {
            setWidgets(saved);
          }
        }
      } catch {
        // Fallback to default
      } finally {
        setIsLoading(false);
      }
    };

    loadLayout();
  }, []);

  const updateLayout = async (newWidgets: DashboardWidget[]) => {
    setWidgets(newWidgets);

    try {
      await fetch("/api/user/dashboard-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newWidgets),
      });
    } catch (err) {
      console.error("Failed to save dashboard layout", err);
    }
  };

  const toggleWidget = (id: string) => {
    const updated = widgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w));
    updateLayout(updated);
  };

  const reorderWidgets = (fromIndex: number, toIndex: number) => {
    const updated = [...widgets];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    // Recalculate order
    const reordered = updated.map((w, i) => ({ ...w, order: i }));
    updateLayout(reordered);
  };

  const resizeWidget = (id: string, size: "small" | "medium" | "large") => {
    const updated = widgets.map((w) => (w.id === id ? { ...w, size } : w));
    updateLayout(updated);
  };

  const resetLayout = () => {
    updateLayout(DEFAULT_WIDGETS);
  };

  const getEnabledWidgets = () => widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order);

  return {
    widgets,
    isLoading,
    toggleWidget,
    reorderWidgets,
    resizeWidget,
    resetLayout,
    getEnabledWidgets,
  };
}
