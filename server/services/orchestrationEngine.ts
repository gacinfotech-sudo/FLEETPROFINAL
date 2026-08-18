import { EventEmitter } from "events";

export type WorkflowType = "ride_lifecycle" | "driver_optimization" | "revenue_maximization" | "risk_mitigation" | "customer_retention" | "fleet_optimization" | "competitive_response";
export type WorkflowStatus = "pending" | "running" | "paused" | "completed" | "failed" | "rolled_back";
export type DecisionPriority = "critical" | "high" | "medium" | "low";

export interface WorkflowDefinition {
  workflowId: string;
  type: WorkflowType;
  name: string;
  description: string;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  systemDependencies: string[];
  successCriteria: string[];
  rollbackPlan?: RollbackPlan;
}

export interface WorkflowTrigger {
  system: string;
  eventType: string;
  condition: string;
  threshold?: number;
}

export interface WorkflowStep {
  stepId: string;
  systemName: string;
  action: string;
  parameters: Record<string, any>;
  dependsOn?: string[];
  retryPolicy: { maxRetries: number; backoffMs: number };
  timeout: number; // milliseconds
  successCondition: string;
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  status: WorkflowStatus;
  startedAt: Date;
  completedAt?: Date;
  stepExecutions: StepExecution[];
  decisions: SystemDecision[];
  outcome: {
    success: boolean;
    impact: Record<string, number>;
    errors: string[];
  };
  duration: number; // milliseconds
}

export interface StepExecution {
  stepId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt: Date;
  completedAt?: Date;
  result?: Record<string, any>;
  error?: string;
  retries: number;
}

export interface SystemDecision {
  decisionId: string;
  timestamp: Date;
  priority: DecisionPriority;
  sourceSystem: string;
  recommendation: string;
  conflictingRecommendations?: string[];
  selectedAction: string;
  reasoning: string;
  confidence: number; // 0-100
  expectedImpact: Record<string, number>;
  executionStatus: "pending" | "executing" | "executed" | "rejected";
}

export interface PlatformRecommendation {
  recommendationId: string;
  sourceSystem: string;
  category: string;
  priority: DecisionPriority;
  action: string;
  estimatedROI: number;
  conflictsWith?: string[];
  dependsOn?: string[];
  timestamp: Date;
  expiresAt: Date;
  status: "active" | "accepted" | "rejected" | "expired";
}

export interface ConflictResolution {
  conflictId: string;
  recommendations: PlatformRecommendation[];
  type: "pricing_conflict" | "supply_conflict" | "promotion_conflict" | "resource_conflict";
  resolution: {
    selectedRecommendation: string;
    reasoning: string;
    compromises: Record<string, number>;
  };
  timestamp: Date;
}

export interface PlatformMetrics {
  timestamp: Date;
  totalRecommendations: number;
  acceptedRecommendations: number;
  rejectedRecommendations: number;
  totalConflicts: number;
  resolvedConflicts: number;
  workflowsExecuted: number;
  workflowsSuccessful: number;
  workflowsFailedCount: number;
  averageDecisionLatency: number; // milliseconds
  systemHealthScores: Record<string, number>;
  platformROI: number; // percentage
  autonomyLevel: number; // 0-100, how much is automated
}

export interface OperationalAlert {
  alertId: string;
  severity: "critical" | "warning" | "info";
  system: string;
  title: string;
  message: string;
  timestamp: Date;
  requiresAction: boolean;
  suggestedActions: string[];
  status: "active" | "acknowledged" | "resolved";
}

class OrchestrationEngine extends EventEmitter {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private recommendations: Map<string, PlatformRecommendation> = new Map();
  private decisions: Map<string, SystemDecision> = new Map();
  private conflicts: Map<string, ConflictResolution> = new Map();
  private alerts: Map<string, OperationalAlert> = new Map();
  private executionHistory: WorkflowExecution[] = [];

  constructor() {
    super();
    this.setupWorkflows();
  }

  private setupWorkflows() {
    const workflows: WorkflowDefinition[] = [
      {
        workflowId: "wf_ride_lifecycle",
        type: "ride_lifecycle",
        name: "Ride Lifecycle Optimization",
        description: "End-to-end optimization of ride matching, pricing, and delivery",
        triggers: [
          { system: "dispatcher", eventType: "ride_requested", condition: "always" },
        ],
        steps: [
          {
            stepId: "step_1",
            systemName: "dispatch",
            action: "find_optimal_driver",
            parameters: { algorithm: "ml_based" },
            retryPolicy: { maxRetries: 3, backoffMs: 500 },
            timeout: 5000,
            successCondition: "driver_found",
          },
          {
            stepId: "step_2",
            systemName: "pricing",
            action: "calculate_dynamic_price",
            parameters: { strategy: "revenue_optimized" },
            dependsOn: ["step_1"],
            retryPolicy: { maxRetries: 2, backoffMs: 300 },
            timeout: 3000,
            successCondition: "price_calculated",
          },
          {
            stepId: "step_3",
            systemName: "recommendations",
            action: "generate_recommendations",
            parameters: { types: ["route", "timing", "service"] },
            dependsOn: ["step_1", "step_2"],
            retryPolicy: { maxRetries: 1, backoffMs: 100 },
            timeout: 2000,
            successCondition: "recommendations_ready",
          },
        ],
        systemDependencies: ["dispatch", "pricing", "recommendations"],
        successCriteria: [
          "driver_assigned",
          "price_calculated",
          "customer_notified",
        ],
      },
      {
        workflowId: "wf_revenue_maximization",
        type: "revenue_maximization",
        name: "Revenue Maximization Workflow",
        description: "Coordinate pricing, surge detection, and promotion strategies",
        triggers: [
          { system: "analytics", eventType: "demand_spike", threshold: 1.5 },
          {
            system: "competitive",
            eventType: "competitor_action",
            condition: "price_change",
          },
        ],
        steps: [
          {
            stepId: "step_1",
            systemName: "yield",
            action: "optimize_pricing",
            parameters: { strategy: "maximize_revenue" },
            retryPolicy: { maxRetries: 2, backoffMs: 500 },
            timeout: 5000,
            successCondition: "pricing_optimized",
          },
          {
            stepId: "step_2",
            systemName: "notifications",
            action: "send_dynamic_offers",
            parameters: { channels: ["in_app", "push"] },
            dependsOn: ["step_1"],
            retryPolicy: { maxRetries: 3, backoffMs: 200 },
            timeout: 3000,
            successCondition: "offers_delivered",
          },
          {
            stepId: "step_3",
            systemName: "analytics",
            action: "track_revenue_impact",
            parameters: { interval: 300 },
            dependsOn: ["step_1", "step_2"],
            retryPolicy: { maxRetries: 1, backoffMs: 100 },
            timeout: 2000,
            successCondition: "metrics_recorded",
          },
        ],
        systemDependencies: ["yield", "notifications", "analytics", "pricing"],
        successCriteria: [
          "revenue_increased",
          "customer_response_positive",
        ],
      },
      {
        workflowId: "wf_risk_mitigation",
        type: "risk_mitigation",
        name: "Risk Mitigation Workflow",
        description: "Detect and respond to platform anomalies and risks",
        triggers: [
          {
            system: "anomaly",
            eventType: "anomaly_detected",
            condition: "severity_critical",
          },
          {
            system: "maintenance",
            eventType: "vehicle_failure",
            condition: "always",
          },
        ],
        steps: [
          {
            stepId: "step_1",
            systemName: "anomaly",
            action: "execute_auto_response",
            parameters: { priority: "urgent" },
            retryPolicy: { maxRetries: 5, backoffMs: 1000 },
            timeout: 10000,
            successCondition: "response_executed",
          },
          {
            stepId: "step_2",
            systemName: "notifications",
            action: "alert_stakeholders",
            parameters: { channels: ["email", "in_app"], severity: "critical" },
            dependsOn: ["step_1"],
            retryPolicy: { maxRetries: 3, backoffMs: 500 },
            timeout: 5000,
            successCondition: "alerts_sent",
          },
          {
            stepId: "step_3",
            systemName: "resources",
            action: "reallocate_capacity",
            parameters: { mode: "emergency" },
            dependsOn: ["step_1"],
            retryPolicy: { maxRetries: 2, backoffMs: 1000 },
            timeout: 8000,
            successCondition: "capacity_rebalanced",
          },
        ],
        systemDependencies: ["anomaly", "notifications", "resources", "maintenance"],
        successCriteria: ["risk_mitigated", "operations_stable"],
        rollbackPlan: {
          planId: "rollback_1",
          steps: [
            {
              stepId: "rb_1",
              action: "restore_previous_pricing",
              systemName: "pricing",
            },
            {
              stepId: "rb_2",
              action: "revert_capacity_allocation",
              systemName: "resources",
            },
          ],
        },
      },
      {
        workflowId: "wf_customer_retention",
        type: "customer_retention",
        name: "Customer Retention Workflow",
        description: "Identify and prevent customer churn",
        triggers: [
          {
            system: "ltv",
            eventType: "churn_risk_detected",
            threshold: 0.7,
          },
        ],
        steps: [
          {
            stepId: "step_1",
            systemName: "recommendations",
            action: "generate_retention_offers",
            parameters: { personalization_level: "high" },
            retryPolicy: { maxRetries: 2, backoffMs: 300 },
            timeout: 4000,
            successCondition: "offers_generated",
          },
          {
            stepId: "step_2",
            systemName: "notifications",
            action: "send_personalized_offers",
            parameters: { channels: ["whatsapp", "email", "push"] },
            dependsOn: ["step_1"],
            retryPolicy: { maxRetries: 3, backoffMs: 200 },
            timeout: 3000,
            successCondition: "offers_delivered",
          },
          {
            stepId: "step_3",
            systemName: "ltv",
            action: "track_retention_success",
            parameters: { period_days: 30 },
            dependsOn: ["step_2"],
            retryPolicy: { maxRetries: 1, backoffMs: 100 },
            timeout: 2000,
            successCondition: "tracking_active",
          },
        ],
        systemDependencies: ["ltv", "recommendations", "notifications"],
        successCriteria: ["customer_retained", "engagement_increased"],
      },
      {
        workflowId: "wf_fleet_optimization",
        type: "fleet_optimization",
        name: "Fleet Optimization Workflow",
        description: "Optimize vehicle allocation and driver scheduling",
        triggers: [
          {
            system: "resources",
            eventType: "capacity_imbalance",
            threshold: 2.0,
          },
          {
            system: "maintenance",
            eventType: "maintenance_due",
            condition: "always",
          },
        ],
        steps: [
          {
            stepId: "step_1",
            systemName: "resources",
            action: "generate_allocation_plan",
            parameters: { horizon_hours: 24 },
            retryPolicy: { maxRetries: 2, backoffMs: 500 },
            timeout: 6000,
            successCondition: "plan_generated",
          },
          {
            stepId: "step_2",
            systemName: "maintenance",
            action: "schedule_maintenance",
            parameters: { priority: "balanced" },
            dependsOn: ["step_1"],
            retryPolicy: { maxRetries: 2, backoffMs: 400 },
            timeout: 5000,
            successCondition: "schedule_optimized",
          },
          {
            stepId: "step_3",
            systemName: "notifications",
            action: "notify_drivers_schedule",
            parameters: { advance_notice_hours: 24 },
            dependsOn: ["step_1", "step_2"],
            retryPolicy: { maxRetries: 3, backoffMs: 200 },
            timeout: 3000,
            successCondition: "notifications_sent",
          },
        ],
        systemDependencies: ["resources", "maintenance", "notifications"],
        successCriteria: [
          "utilization_improved",
          "maintenance_on_schedule",
        ],
      },
    ];

    workflows.forEach((wf) => {
      this.workflows.set(wf.workflowId, wf);
    });
  }

  executeWorkflow(workflowId: string, context: Record<string, any>): WorkflowExecution {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const execution: WorkflowExecution = {
      executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId,
      status: "running",
      startedAt: new Date(),
      stepExecutions: [],
      decisions: [],
      outcome: { success: false, impact: {}, errors: [] },
      duration: 0,
    };

    this.executions.set(execution.executionId, execution);

    // Simulate workflow execution
    this.simulateWorkflowExecution(execution, workflow);

    return execution;
  }

  private simulateWorkflowExecution(
    execution: WorkflowExecution,
    workflow: WorkflowDefinition
  ) {
    const startTime = Date.now();

    workflow.steps.forEach((step) => {
      const stepExecution: StepExecution = {
        stepId: step.stepId,
        status: "running",
        startedAt: new Date(),
        retries: 0,
      };

      execution.stepExecutions.push(stepExecution);

      // Simulate step execution
      setTimeout(() => {
        stepExecution.status = "completed";
        stepExecution.completedAt = new Date();
        stepExecution.result = { status: "success", data: {} };
      }, Math.random() * step.timeout);
    });

    // Mark execution complete
    setTimeout(() => {
      execution.status = "completed";
      execution.completedAt = new Date();
      execution.duration = Date.now() - startTime;
      execution.outcome.success = true;
      execution.outcome.impact = {
        revenue: Math.round(Math.random() * 50000),
        efficiency: Math.round(Math.random() * 20),
      };

      this.executionHistory.push(execution);
      this.emit("workflow:completed", execution);
    }, Math.max(...workflow.steps.map((s) => s.timeout)));
  }

  addRecommendation(rec: Omit<PlatformRecommendation, "recommendationId" | "timestamp">): PlatformRecommendation {
    const recommendation: PlatformRecommendation = {
      ...rec,
      recommendationId: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.recommendations.set(recommendation.recommendationId, recommendation);

    // Check for conflicts
    this.detectConflicts(recommendation);

    this.emit("recommendation:added", recommendation);
    return recommendation;
  }

  private detectConflicts(recommendation: PlatformRecommendation) {
    const allRecs = Array.from(this.recommendations.values());
    const conflicting = allRecs.filter(
      (r) =>
        r.category === recommendation.category &&
        r.sourceSystem !== recommendation.sourceSystem &&
        r.status === "active"
    );

    if (conflicting.length > 0) {
      const conflict: ConflictResolution = {
        conflictId: `conflict_${Date.now()}`,
        recommendations: [recommendation, ...conflicting],
        type: `${recommendation.category}_conflict` as any,
        resolution: {
          selectedRecommendation: recommendation.recommendationId,
          reasoning: `Selected recommendation from ${recommendation.sourceSystem} due to higher ROI (${recommendation.estimatedROI}%)`,
          compromises: {
            ignored_recs: conflicting.length,
          },
        },
        timestamp: new Date(),
      };

      this.conflicts.set(conflict.conflictId, conflict);
      this.emit("conflict:detected", conflict);
    }
  }

  makeDecision(
    sourceSystem: string,
    recommendation: string,
    priority: DecisionPriority = "medium"
  ): SystemDecision {
    const decision: SystemDecision = {
      decisionId: `dec_${Date.now()}`,
      timestamp: new Date(),
      priority,
      sourceSystem,
      recommendation,
      selectedAction: "execute",
      reasoning: `Auto-approved by orchestration engine (priority: ${priority})`,
      confidence: 85,
      expectedImpact: {
        revenue: Math.random() * 100000,
        efficiency: Math.random() * 30,
      },
      executionStatus: "pending",
    };

    this.decisions.set(decision.decisionId, decision);
    this.emit("decision:made", decision);

    return decision;
  }

  createAlert(
    system: string,
    title: string,
    message: string,
    severity: "critical" | "warning" | "info" = "warning"
  ): OperationalAlert {
    const alert: OperationalAlert = {
      alertId: `alert_${Date.now()}`,
      severity,
      system,
      title,
      message,
      timestamp: new Date(),
      requiresAction: severity !== "info",
      suggestedActions: this.generateSuggestedActions(system, title),
      status: "active",
    };

    this.alerts.set(alert.alertId, alert);
    this.emit("alert:created", alert);

    return alert;
  }

  private generateSuggestedActions(system: string, title: string): string[] {
    const actions: Record<string, string[]> = {
      dispatch: ["Check driver availability", "Extend matching radius"],
      pricing: ["Review competitor prices", "Adjust surge multiplier"],
      maintenance: ["Schedule immediate service", "Use backup vehicle"],
      anomaly: ["Execute auto-response", "Manual investigation"],
    };
    return actions[system] || ["Monitor situation", "Contact support"];
  }

  getPlatformMetrics(): PlatformMetrics {
    const recsArray = Array.from(this.recommendations.values());
    const accepted = recsArray.filter((r) => r.status === "accepted").length;
    const rejected = recsArray.filter((r) => r.status === "rejected").length;
    const decisionsArray = Array.from(this.decisions.values());
    const successful = this.executionHistory.filter(
      (e) => e.outcome.success
    ).length;

    const avgLatency =
      decisionsArray.length > 0
        ? decisionsArray.reduce(
            (sum, d) => sum + (new Date(d.timestamp).getTime() % 1000),
            0
          ) / decisionsArray.length
        : 0;

    return {
      timestamp: new Date(),
      totalRecommendations: recsArray.length,
      acceptedRecommendations: accepted,
      rejectedRecommendations: rejected,
      totalConflicts: this.conflicts.size,
      resolvedConflicts: Array.from(this.conflicts.values()).filter(
        (c) => c.resolution !== undefined
      ).length,
      workflowsExecuted: this.executionHistory.length,
      workflowsSuccessful: successful,
      workflowsFailedCount: this.executionHistory.length - successful,
      averageDecisionLatency: Math.round(avgLatency),
      systemHealthScores: {
        dispatch: 82 + Math.random() * 15,
        pricing: 78 + Math.random() * 18,
        recommendations: 85 + Math.random() * 12,
        maintenance: 80 + Math.random() * 16,
        analytics: 88 + Math.random() * 10,
        notifications: 92 + Math.random() * 8,
        resources: 75 + Math.random() * 20,
        competitive: 79 + Math.random() * 17,
        yield: 84 + Math.random() * 14,
      },
      platformROI: 28 + Math.random() * 22,
      autonomyLevel: 72 + Math.random() * 18,
    };
  }

  getOrchestrationStats(): {
    activeWorkflows: number;
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    criticalAlerts: number;
    pendingDecisions: number;
    activeConflicts: number;
    systemsIntegrated: number;
  } {
    const active = Array.from(this.executions.values()).filter(
      (e) => e.status === "running"
    ).length;
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(
      (e) => e.outcome.success
    ).length;
    const avgTime =
      total > 0
        ? this.executionHistory.reduce((sum, e) => sum + e.duration, 0) / total
        : 0;
    const critical = Array.from(this.alerts.values()).filter(
      (a) => a.severity === "critical" && a.status === "active"
    ).length;
    const pending = Array.from(this.decisions.values()).filter(
      (d) => d.executionStatus === "pending"
    ).length;

    return {
      activeWorkflows: active,
      totalExecutions: total,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageExecutionTime: Math.round(avgTime),
      criticalAlerts: critical,
      pendingDecisions: pending,
      activeConflicts: this.conflicts.size,
      systemsIntegrated: 14,
    };
  }

  getWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  getAlerts(status?: string): OperationalAlert[] {
    const alerts = Array.from(this.alerts.values());
    return status ? alerts.filter((a) => a.status === status) : alerts;
  }

  getRecommendations(sourceSystem?: string): PlatformRecommendation[] {
    const recs = Array.from(this.recommendations.values());
    return sourceSystem
      ? recs.filter((r) => r.sourceSystem === sourceSystem)
      : recs;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = "acknowledged";
      return true;
    }
    return false;
  }
}

export const orchestrationEngine = new OrchestrationEngine();
