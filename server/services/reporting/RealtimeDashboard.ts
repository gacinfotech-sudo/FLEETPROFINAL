import { EventEmitter } from "events";
import { Booking, Driver } from "../../models";

interface DashboardMetrics {
  timestamp: Date;
  activeBookings: number;
  completedToday: number;
  totalEarningsToday: number;
  activeDrivers: number;
  averageWaitTime: number;
  systemHealth: {
    uptime: number;
    apiLatency: number;
    errorRate: number;
    status: "healthy" | "degraded" | "critical";
  };
  alerts: Alert[];
}

interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: Date;
  component: string;
  resolved: boolean;
}

interface RealtimeMetric {
  key: string;
  value: number;
  target: number;
  status: "on-target" | "below-target" | "above-target";
  lastUpdated: Date;
}

export class RealtimeDashboard extends EventEmitter {
  private metrics: Map<string, RealtimeMetric> = new Map();
  private alerts: Alert[] = [];
  private systemHealth = {
    uptime: 99.99,
    apiLatency: 150,
    errorRate: 0.01,
    status: "healthy" as const,
  };

  constructor() {
    super();
    this.initializeMetrics();
    this.startMonitoring();
  }

  /**
   * Get current dashboard snapshot
   */
  async getDashboardSnapshot(tenantId: string): Promise<DashboardMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeBookings = await Booking.countDocuments({
      tenantId,
      status: "pending",
    });

    const completedToday = await Booking.countDocuments({
      tenantId,
      status: "completed",
      createdAt: { $gte: today },
    });

    const completedBookings = await Booking.find({
      tenantId,
      status: "completed",
      createdAt: { $gte: today },
    }).lean();

    const totalEarnings = completedBookings.reduce(
      (sum: number, b: any) => sum + (b.fare || 0),
      0
    );

    const activeDrivers = await Driver.countDocuments({
      tenantId,
      status: "online",
    });

    // Calculate average wait time
    const pendingBookings = await Booking.find({
      tenantId,
      status: "pending",
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    }).lean();

    const avgWaitTime =
      pendingBookings.length > 0
        ? pendingBookings.reduce((sum: number, b: any) => {
            const waitTime = Date.now() - new Date(b.createdAt).getTime();
            return sum + waitTime;
          }, 0) / pendingBookings.length / 1000
        : 0; // in seconds

    return {
      timestamp: new Date(),
      activeBookings,
      completedToday,
      totalEarningsToday: Math.round(totalEarnings),
      activeDrivers,
      averageWaitTime: Math.round(avgWaitTime),
      systemHealth: this.systemHealth,
      alerts: this.getActiveAlerts(),
    };
  }

  /**
   * Track real-time metric
   */
  updateMetric(
    key: string,
    value: number,
    target: number,
    tenantId?: string
  ): void {
    const status =
      value >= target * 0.9
        ? "on-target"
        : value < target * 0.5
        ? "below-target"
        : "above-target";

    const metric: RealtimeMetric = {
      key,
      value,
      target,
      status,
      lastUpdated: new Date(),
    };

    this.metrics.set(key, metric);
    this.emit("metric-updated", metric);

    // Create alert if threshold exceeded
    if (status === "below-target" && value < target * 0.3) {
      this.createAlert({
        id: `alert-${Date.now()}`,
        severity: "critical",
        message: `${key} is critically low: ${value} (target: ${target})`,
        timestamp: new Date(),
        component: key,
        resolved: false,
      });
    }
  }

  /**
   * Get metric by key
   */
  getMetric(key: string): RealtimeMetric | undefined {
    return this.metrics.get(key);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): RealtimeMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Create alert
   */
  createAlert(alert: Alert): void {
    this.alerts.push(alert);
    this.emit("alert-created", alert);

    // Auto-resolve info alerts after 1 hour
    if (alert.severity === "info") {
      setTimeout(() => {
        this.resolveAlert(alert.id);
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.emit("alert-resolved", alert);
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter((a) => !a.resolved).slice(0, 10);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Update system health status
   */
  updateSystemHealth(health: Partial<typeof this.systemHealth>): void {
    this.systemHealth = { ...this.systemHealth, ...health };
    this.emit("health-updated", this.systemHealth);

    // Determine status based on metrics
    if (
      this.systemHealth.uptime < 95 ||
      this.systemHealth.errorRate > 0.1 ||
      this.systemHealth.apiLatency > 500
    ) {
      this.systemHealth.status = "critical";
    } else if (
      this.systemHealth.uptime < 98 ||
      this.systemHealth.errorRate > 0.05 ||
      this.systemHealth.apiLatency > 300
    ) {
      this.systemHealth.status = "degraded";
    } else {
      this.systemHealth.status = "healthy";
    }
  }

  /**
   * Export dashboard metrics to JSON
   */
  exportDashboard(tenantId: string): Promise<string> {
    return this.getDashboardSnapshot(tenantId).then((dashboard) =>
      JSON.stringify(dashboard, null, 2)
    );
  }

  private initializeMetrics(): void {
    const defaultMetrics = [
      { key: "bookings-per-hour", target: 100 },
      { key: "active-drivers", target: 50 },
      { key: "customer-satisfaction", target: 95 },
      { key: "system-availability", target: 99.9 },
      { key: "api-latency-ms", target: 200 },
      { key: "average-ride-rating", target: 4.5 },
    ];

    defaultMetrics.forEach((m) => {
      this.updateMetric(m.key, Math.random() * m.target, m.target);
    });
  }

  private startMonitoring(): void {
    // Update metrics every 30 seconds
    setInterval(() => {
      this.metrics.forEach((metric) => {
        // Simulate metric fluctuation
        const variance = (Math.random() - 0.5) * 10;
        const newValue = metric.value + variance;
        this.updateMetric(
          metric.key,
          Math.max(0, newValue),
          metric.target
        );
      });
    }, 30000);
  }
}
