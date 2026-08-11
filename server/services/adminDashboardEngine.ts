import { EventEmitter } from "events";

export type AdminRole = "super_admin" | "admin" | "manager" | "analyst" | "support_lead";
export type AuditAction = "create" | "update" | "delete" | "approve" | "reject" | "suspend" | "activate";
export type ReportType = "daily" | "weekly" | "monthly" | "custom";

export interface AdminUser {
  adminId: string;
  email: string;
  name: string;
  role: AdminRole;
  department: string;
  permissions: string[];
  status: "active" | "inactive" | "suspended";
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  auditId: string;
  adminId: string;
  action: AuditAction;
  entityType: string; // "driver", "customer", "booking", "vehicle", etc.
  entityId: string;
  changes: { [key: string]: { before: any; after: any } };
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  status: "success" | "failed";
  reason?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  totalUsers: number;
  activeUsers24h: number;
  newUsersToday: number;
  totalRidesCompleted: number;
  todayRides: number;
  totalRevenue: number; // ₹
  todayRevenue: number; // ₹
  avgRideValue: number; // ₹
  systemUptime: number; // percentage
  apiResponseTime: number; // ms
  activeConnections: number;
  errorRate: number; // percentage
  databaseSize: number; // GB
}

export interface OperationalAlert {
  alertId: string;
  severity: "critical" | "high" | "medium" | "low";
  type: string; // "high_error_rate", "low_uptime", "db_performance", etc.
  title: string;
  description: string;
  affectedSystem: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  status: "active" | "acknowledged" | "resolved";
}

export interface AdminReport {
  reportId: string;
  title: string;
  type: ReportType;
  generatedBy: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  sections: {
    summary: {
      totalRides: number;
      totalRevenue: number;
      avgRideValue: number;
      customerSatisfaction: number;
      driverSatisfaction: number;
    };
    performance: {
      uptime: number;
      avgResponseTime: number;
      errorRate: number;
      failedTransactions: number;
    };
    financial: {
      grossRevenue: number;
      platformFees: number;
      payouts: number;
      netProfit: number;
    };
    users: {
      newCustomers: number;
      newDrivers: number;
      churnRate: number;
      activeUsers: number;
    };
    incidents: {
      safetyIncidents: number;
      fraudCases: number;
      complaints: number;
      resolutionRate: number;
    };
  };
  recommendations: string[];
}

export interface SystemConfiguration {
  configId: string;
  category: string; // "pricing", "booking", "driver", "customer", "system"
  key: string;
  value: any;
  dataType: "string" | "number" | "boolean" | "json";
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export interface BulkOperation {
  operationId: string;
  type: string; // "bulk_suspend_drivers", "bulk_message", etc.
  status: "pending" | "in_progress" | "completed" | "failed";
  targetCount: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  startedAt: Date;
  completedAt?: Date;
  createdBy: string;
  progress: number; // percentage
}

class AdminDashboardEngine extends EventEmitter {
  private admins: Map<string, AdminUser> = new Map();
  private auditLogs: Map<string, AuditLog> = new Map();
  private alerts: Map<string, OperationalAlert> = new Map();
  private reports: Map<string, AdminReport> = new Map();
  private configurations: Map<string, SystemConfiguration> = new Map();
  private bulkOperations: Map<string, BulkOperation> = new Map();
  private auditHistory: AuditLog[] = [];

  constructor() {
    super();
    this.setupDefaultAdmins();
    this.setupDefaultConfigurations();
  }

  private setupDefaultAdmins() {
    const admins: AdminUser[] = [
      {
        adminId: "admin_001",
        email: "super@fleetpro.com",
        name: "Super Admin",
        role: "super_admin",
        department: "Administration",
        permissions: ["*"],
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        adminId: "admin_002",
        email: "manager@fleetpro.com",
        name: "Operations Manager",
        role: "manager",
        department: "Operations",
        permissions: ["view_analytics", "manage_drivers", "manage_bookings", "view_reports"],
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    admins.forEach((admin) => this.admins.set(admin.adminId, admin));
  }

  private setupDefaultConfigurations() {
    const configs: SystemConfiguration[] = [
      {
        configId: "cfg_1",
        category: "pricing",
        key: "base_fare",
        value: 50,
        dataType: "number",
        updatedAt: new Date(),
        updatedBy: "admin_001",
        version: 1,
      },
      {
        configId: "cfg_2",
        category: "pricing",
        key: "per_km_rate",
        value: 15,
        dataType: "number",
        updatedAt: new Date(),
        updatedBy: "admin_001",
        version: 1,
      },
      {
        configId: "cfg_3",
        category: "booking",
        key: "cancellation_window_minutes",
        value: 2,
        dataType: "number",
        updatedAt: new Date(),
        updatedBy: "admin_001",
        version: 1,
      },
      {
        configId: "cfg_4",
        category: "system",
        key: "maintenance_mode",
        value: false,
        dataType: "boolean",
        updatedAt: new Date(),
        updatedBy: "admin_001",
        version: 1,
      },
    ];

    configs.forEach((cfg) => this.configurations.set(`${cfg.category}:${cfg.key}`, cfg));
  }

  logAuditAction(
    adminId: string,
    action: AuditAction,
    entityType: string,
    entityId: string,
    changes: any
  ): AuditLog {
    const log: AuditLog = {
      auditId: `audit_${Date.now()}`,
      adminId,
      action,
      entityType,
      entityId,
      changes,
      timestamp: new Date(),
      status: "success",
    };

    this.auditLogs.set(log.auditId, log);
    this.auditHistory.push(log);
    this.emit("audit:logged", log);
    return log;
  }

  createAlert(
    severity: "critical" | "high" | "medium" | "low",
    type: string,
    title: string,
    description: string,
    affectedSystem: string
  ): OperationalAlert {
    const alert: OperationalAlert = {
      alertId: `alert_${Date.now()}`,
      severity,
      type,
      title,
      description,
      affectedSystem,
      createdAt: new Date(),
      status: "active",
    };

    this.alerts.set(alert.alertId, alert);
    this.emit("alert:created", alert);

    if (severity === "critical") {
      this.emit("alert:critical", alert);
    }

    return alert;
  }

  resolveAlert(alertId: string, resolution: string): OperationalAlert | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.status = "resolved";
    alert.resolvedAt = new Date();
    alert.resolution = resolution;

    this.emit("alert:resolved", alert);
    return alert;
  }

  updateConfiguration(
    category: string,
    key: string,
    value: any,
    updatedBy: string
  ): SystemConfiguration {
    const configKey = `${category}:${key}`;
    let config = this.configurations.get(configKey);

    if (!config) {
      config = {
        configId: `cfg_${Date.now()}`,
        category,
        key,
        value,
        dataType: typeof value as any,
        updatedAt: new Date(),
        updatedBy,
        version: 1,
      };
    } else {
      config.value = value;
      config.updatedAt = new Date();
      config.updatedBy = updatedBy;
      config.version++;
    }

    this.configurations.set(configKey, config);
    this.emit("config:updated", config);
    return config;
  }

  generateReport(
    title: string,
    type: ReportType,
    generatedBy: string,
    periodStart: Date,
    periodEnd: Date
  ): AdminReport {
    const report: AdminReport = {
      reportId: `report_${Date.now()}`,
      title,
      type,
      generatedBy,
      generatedAt: new Date(),
      periodStart,
      periodEnd,
      sections: {
        summary: {
          totalRides: Math.floor(Math.random() * 1000) + 500,
          totalRevenue: Math.floor(Math.random() * 100000) + 50000,
          avgRideValue: 350 + Math.random() * 100,
          customerSatisfaction: 4.2 + Math.random() * 0.8,
          driverSatisfaction: 4.1 + Math.random() * 0.9,
        },
        performance: {
          uptime: 99.8 + Math.random() * 0.2,
          avgResponseTime: 45 + Math.random() * 55,
          errorRate: 0.1 + Math.random() * 0.4,
          failedTransactions: Math.floor(Math.random() * 10),
        },
        financial: {
          grossRevenue: Math.floor(Math.random() * 100000) + 50000,
          platformFees: Math.floor(Math.random() * 20000) + 10000,
          payouts: Math.floor(Math.random() * 60000) + 30000,
          netProfit: Math.floor(Math.random() * 30000) + 10000,
        },
        users: {
          newCustomers: Math.floor(Math.random() * 200) + 50,
          newDrivers: Math.floor(Math.random() * 50) + 10,
          churnRate: 2 + Math.random() * 3,
          activeUsers: Math.floor(Math.random() * 5000) + 2000,
        },
        incidents: {
          safetyIncidents: Math.floor(Math.random() * 5),
          fraudCases: Math.floor(Math.random() * 3),
          complaints: Math.floor(Math.random() * 20),
          resolutionRate: 85 + Math.random() * 15,
        },
      },
      recommendations: [
        "Optimize pricing during peak hours",
        "Increase driver incentives in underserved areas",
        "Implement enhanced fraud detection",
        "Improve customer support response time",
        "Expand in high-demand regions",
      ],
    };

    this.reports.set(report.reportId, report);
    this.emit("report:generated", report);
    return report;
  }

  createBulkOperation(type: string, targetCount: number, createdBy: string): BulkOperation {
    const operation: BulkOperation = {
      operationId: `bulk_${Date.now()}`,
      type,
      status: "pending",
      targetCount,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      startedAt: new Date(),
      createdBy,
      progress: 0,
    };

    this.bulkOperations.set(operation.operationId, operation);
    this.emit("bulk_operation:created", operation);
    return operation;
  }

  updateBulkOperationProgress(operationId: string, processed: number, successful: number, failed: number): BulkOperation | null {
    const operation = this.bulkOperations.get(operationId);
    if (!operation) return null;

    operation.processedCount = processed;
    operation.successCount = successful;
    operation.failureCount = failed;
    operation.progress = (processed / operation.targetCount) * 100;

    if (processed === operation.targetCount) {
      operation.status = failed > 0 ? "completed" : "completed";
      operation.completedAt = new Date();
    } else if (processed > 0) {
      operation.status = "in_progress";
    }

    this.emit("bulk_operation:progress", operation);
    return operation;
  }

  getSystemMetrics(): SystemMetrics {
    return {
      timestamp: new Date(),
      totalUsers: Math.floor(Math.random() * 50000) + 10000,
      activeUsers24h: Math.floor(Math.random() * 5000) + 1000,
      newUsersToday: Math.floor(Math.random() * 200) + 50,
      totalRidesCompleted: Math.floor(Math.random() * 1000000) + 100000,
      todayRides: Math.floor(Math.random() * 5000) + 1000,
      totalRevenue: Math.floor(Math.random() * 10000000) + 1000000,
      todayRevenue: Math.floor(Math.random() * 200000) + 50000,
      avgRideValue: 350 + Math.random() * 100,
      systemUptime: 99.8 + Math.random() * 0.2,
      apiResponseTime: 45 + Math.random() * 55,
      activeConnections: Math.floor(Math.random() * 10000) + 1000,
      errorRate: 0.1 + Math.random() * 0.4,
      databaseSize: 100 + Math.random() * 50,
    };
  }

  getAuditLogs(filter?: { adminId?: string; entityType?: string; limit?: number }): AuditLog[] {
    let logs = this.auditHistory;

    if (filter?.adminId) {
      logs = logs.filter((l) => l.adminId === filter.adminId);
    }

    if (filter?.entityType) {
      logs = logs.filter((l) => l.entityType === filter.entityType);
    }

    return logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, filter?.limit || 100);
  }

  getActiveAlerts(): OperationalAlert[] {
    return Array.from(this.alerts.values()).filter((a) => a.status === "active");
  }

  getConfiguration(category: string, key: string): SystemConfiguration | undefined {
    return this.configurations.get(`${category}:${key}`);
  }

  getAllConfigurations(): SystemConfiguration[] {
    return Array.from(this.configurations.values());
  }

  getAdmin(adminId: string): AdminUser | undefined {
    return this.admins.get(adminId);
  }

  getAllAdmins(): AdminUser[] {
    return Array.from(this.admins.values());
  }

  getReport(reportId: string): AdminReport | undefined {
    return this.reports.get(reportId);
  }

  getBulkOperation(operationId: string): BulkOperation | undefined {
    return this.bulkOperations.get(operationId);
  }
}

export const adminDashboardEngine = new AdminDashboardEngine();
