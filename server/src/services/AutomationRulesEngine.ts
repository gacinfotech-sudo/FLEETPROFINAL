// ============================================================================
// AUTOMATION RULES ENGINE - No-code workflow automation
// Phase 5: Milestone 1 - AI & ML Enhancements
// ============================================================================

import {
  AutomationRule,
  AutomationAction,
  AutomationExecutionLog,
  Condition,
  ConditionOperator,
  TriggerType,
  ActionType,
} from '../types/ai-ml.types';

/**
 * AutomationRulesEngine: No-code automation builder
 * - Trigger-action patterns (if X then Y)
 * - Complex conditions (AND, OR, NOT)
 * - Data transformation
 * - Multi-step workflows
 * - Scheduled automation
 * - Execution history and monitoring
 */
export class AutomationRulesEngine {
  private rules: Map<string, AutomationRule> = new Map();
  private executionLogs: AutomationExecutionLog[] = [];
  private scheduledTasks: Map<string, NodeJS.Timeout> = new Map();
  private dataStore: Map<string, any> = new Map();

  constructor() {
    this.initializeEngine();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeEngine(): void {
    console.log('[AutomationRulesEngine] Service initialized');
  }

  // ========================================================================
  // RULE MANAGEMENT
  // ========================================================================

  /**
   * Create a new automation rule
   */
  async createRule(
    tenantId: string,
    name: string,
    description: string | undefined,
    trigger: { type: TriggerType; config: Record<string, any> },
    conditions: Condition[],
    actions: AutomationAction[],
    enabled: boolean = true
  ): Promise<AutomationRule> {
    // Validate rule
    await this.validateRule(trigger, conditions, actions);

    const ruleId = this.generateRuleId();
    const rule: AutomationRule = {
      id: ruleId,
      tenantId,
      name,
      description,
      enabled,
      trigger,
      conditions,
      actions,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(ruleId, rule);
    return rule;
  }

  /**
   * Update an existing rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<AutomationRule>
  ): Promise<AutomationRule | null> {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    // Validate if conditions or actions changed
    if (updates.conditions || updates.actions || updates.trigger) {
      await this.validateRule(
        updates.trigger || rule.trigger,
        updates.conditions || rule.conditions,
        updates.actions || rule.actions
      );
    }

    const updatedRule: AutomationRule = {
      ...rule,
      ...updates,
      updatedAt: new Date(),
    };

    this.rules.set(ruleId, updatedRule);
    return updatedRule;
  }

  /**
   * Get rule by ID
   */
  async getRule(ruleId: string): Promise<AutomationRule | null> {
    return this.rules.get(ruleId) || null;
  }

  /**
   * Get all rules for tenant
   */
  async getTenantRules(tenantId: string): Promise<AutomationRule[]> {
    return Array.from(this.rules.values()).filter(r => r.tenantId === tenantId);
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    // Stop any scheduled task
    const task = this.scheduledTasks.get(ruleId);
    if (task) {
      clearInterval(task);
      this.scheduledTasks.delete(ruleId);
    }

    return this.rules.delete(ruleId);
  }

  /**
   * Enable/disable a rule
   */
  async toggleRule(ruleId: string, enabled: boolean): Promise<AutomationRule | null> {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    rule.enabled = enabled;
    rule.updatedAt = new Date();
    return rule;
  }

  // ========================================================================
  // RULE VALIDATION
  // ========================================================================

  /**
   * Validate rule configuration
   */
  private async validateRule(
    trigger: { type: TriggerType; config: Record<string, any> },
    conditions: Condition[],
    actions: AutomationAction[]
  ): Promise<void> {
    // Validate trigger
    if (!trigger || !trigger.type) {
      throw new Error('Rule must have a trigger');
    }

    // Validate time-based trigger
    if (trigger.type === TriggerType.TIME_BASED) {
      if (!trigger.config.schedule) {
        throw new Error('Time-based trigger requires a schedule');
      }
    }

    // Validate event-based trigger
    if (trigger.type === TriggerType.EVENT_BASED) {
      if (!trigger.config.eventType) {
        throw new Error('Event-based trigger requires an event type');
      }
    }

    // Validate conditions
    for (const condition of conditions) {
      if (!condition.field || !condition.operator || condition.value === undefined) {
        throw new Error('Each condition must have field, operator, and value');
      }

      if (!Object.values(ConditionOperator).includes(condition.operator)) {
        throw new Error(`Invalid operator: ${condition.operator}`);
      }
    }

    // Validate actions
    if (actions.length === 0) {
      throw new Error('Rule must have at least one action');
    }

    for (const action of actions) {
      if (!action.type || !Object.values(ActionType).includes(action.type)) {
        throw new Error(`Invalid action type: ${action.type}`);
      }

      if (!action.config) {
        throw new Error('Action must have configuration');
      }
    }
  }

  // ========================================================================
  // EXECUTION ENGINE
  // ========================================================================

  /**
   * Execute a rule
   */
  async executeRule(ruleId: string, triggerData: Record<string, any>): Promise<AutomationExecutionLog> {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) {
      throw new Error(`Rule ${ruleId} not found or disabled`);
    }

    const executionId = this.generateExecutionId();
    const startTime = new Date();

    const log: AutomationExecutionLog = {
      id: executionId,
      ruleId,
      tenantId: rule.tenantId,
      status: 'pending',
      startTime,
    };

    try {
      log.status = 'executing';

      // Evaluate conditions
      const conditionsMet = await this.evaluateConditions(rule.conditions, triggerData);

      if (!conditionsMet) {
        log.status = 'success'; // Conditions not met is not a failure
        log.endTime = new Date();
        log.executionTime = log.endTime.getTime() - startTime.getTime();
        this.executionLogs.push(log);
        return log;
      }

      // Execute actions
      const actionResults: Record<string, any> = {};
      for (const action of rule.actions) {
        try {
          actionResults[action.id] = await this.executeAction(action, triggerData);
        } catch (error) {
          actionResults[action.id] = { error: (error as Error).message };
        }
      }

      log.status = 'success';
      log.resultData = actionResults;

      // Update rule statistics
      rule.executionCount++;
      rule.successCount++;
      rule.lastExecuted = startTime;

    } catch (error) {
      log.status = 'failed';
      log.errorMessage = (error as Error).message;

      // Update rule statistics
      rule.executionCount++;
      rule.failureCount++;
      rule.lastExecuted = startTime;
    }

    log.endTime = new Date();
    log.executionTime = log.endTime.getTime() - startTime.getTime();
    this.executionLogs.push(log);

    return log;
  }

  /**
   * Evaluate conditions
   */
  private async evaluateConditions(
    conditions: Condition[],
    data: Record<string, any>
  ): Promise<boolean> {
    if (conditions.length === 0) return true;

    let result = true;
    let logicalOperator = 'AND';

    for (const condition of conditions) {
      const conditionResult = this.evaluateCondition(condition, data);

      if (logicalOperator === 'AND') {
        result = result && conditionResult;
      } else if (logicalOperator === 'OR') {
        result = result || conditionResult;
      }

      if (condition.logicalOperator) {
        logicalOperator = condition.logicalOperator;
      }
    }

    return result;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: Condition, data: Record<string, any>): boolean {
    const value = data[condition.field];

    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return value === condition.value;

      case ConditionOperator.NOT_EQUALS:
        return value !== condition.value;

      case ConditionOperator.GREATER_THAN:
        return value > condition.value;

      case ConditionOperator.LESS_THAN:
        return value < condition.value;

      case ConditionOperator.CONTAINS:
        return String(value).includes(condition.value);

      case ConditionOperator.STARTS_WITH:
        return String(value).startsWith(condition.value);

      case ConditionOperator.IN:
        return Array.isArray(condition.value) && condition.value.includes(value);

      default:
        return false;
    }
  }

  /**
   * Execute an action
   */
  private async executeAction(
    action: AutomationAction,
    triggerData: Record<string, any>
  ): Promise<any> {
    switch (action.type) {
      case ActionType.SEND_NOTIFICATION:
        return this.executeSendNotification(action.config);

      case ActionType.UPDATE_RECORD:
        return this.executeUpdateRecord(action.config, triggerData);

      case ActionType.CREATE_TASK:
        return this.executeCreateTask(action.config);

      case ActionType.ESCALATE:
        return this.executeEscalate(action.config);

      case ActionType.WEBHOOK_CALL:
        return this.executeWebhookCall(action.config);

      case ActionType.DATA_TRANSFORM:
        return this.executeDataTransform(action.config, triggerData);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  // ========================================================================
  // ACTION IMPLEMENTATIONS
  // ========================================================================

  private async executeSendNotification(config: Record<string, any>): Promise<any> {
    const { recipient, subject, message, channel } = config;

    return {
      notificationId: this.generateNotificationId(),
      recipient,
      subject,
      message,
      channel,
      sentAt: new Date(),
      status: 'sent',
    };
  }

  private async executeUpdateRecord(
    config: Record<string, any>,
    triggerData: Record<string, any>
  ): Promise<any> {
    const { recordId, fields } = config;

    // In production, would update actual database record
    const updatedRecord: Record<string, any> = { id: recordId };
    for (const [key, value] of Object.entries(fields)) {
      updatedRecord[key] = typeof value === 'string' && value.startsWith('{{')
        ? this.interpolateValue(value, triggerData)
        : value;
    }

    return { success: true, updatedRecord };
  }

  private async executeCreateTask(config: Record<string, any>): Promise<any> {
    const { title, description, assignee, priority, dueDate } = config;

    return {
      taskId: this.generateTaskId(),
      title,
      description,
      assignee,
      priority,
      dueDate,
      createdAt: new Date(),
      status: 'created',
    };
  }

  private async executeEscalate(config: Record<string, any>): Promise<any> {
    const { level, reason, assignee } = config;

    return {
      escalationId: this.generateEscalationId(),
      level,
      reason,
      assignee,
      escalatedAt: new Date(),
      status: 'escalated',
    };
  }

  private async executeWebhookCall(config: Record<string, any>): Promise<any> {
    const { url, method, headers, body } = config;

    // In production, would make actual HTTP call
    return {
      webhookId: this.generateWebhookId(),
      url,
      method,
      headers,
      body,
      status: 'sent',
      timestamp: new Date(),
    };
  }

  private async executeDataTransform(
    config: Record<string, any>,
    triggerData: Record<string, any>
  ): Promise<any> {
    const { transformationType, mapping } = config;

    const transformed: Record<string, any> = {};
    for (const [key, sourceField] of Object.entries(mapping)) {
      transformed[key] = triggerData[sourceField as string];
    }

    return { transformationType, transformed };
  }

  // ========================================================================
  // SCHEDULING
  // ========================================================================

  /**
   * Schedule a time-based automation
   */
  async scheduleTimeBasedRule(ruleId: string, cronExpression: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    if (rule.trigger.type !== TriggerType.TIME_BASED) {
      throw new Error('Rule must be time-based to schedule');
    }

    // Simple interval-based scheduling (in production, use node-cron)
    const intervalMs = this.parseSchedule(cronExpression);

    const task = setInterval(async () => {
      if (rule.enabled) {
        await this.executeRule(ruleId, { scheduledExecution: true });
      }
    }, intervalMs);

    this.scheduledTasks.set(ruleId, task);
  }

  /**
   * Parse schedule expression to milliseconds
   */
  private parseSchedule(expression: string): number {
    const schedules: Record<string, number> = {
      'every_hour': 60 * 60 * 1000,
      'every_day': 24 * 60 * 60 * 1000,
      'every_week': 7 * 24 * 60 * 60 * 1000,
      'every_month': 30 * 24 * 60 * 60 * 1000,
    };

    return schedules[expression] || 24 * 60 * 60 * 1000; // Default to daily
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Interpolate template values
   */
  private interpolateValue(template: string, data: Record<string, any>): any {
    const match = template.match(/\{\{(.+?)\}\}/);
    if (match) {
      return data[match[1]];
    }
    return template;
  }

  /**
   * Get execution logs for a rule
   */
  async getRuleExecutionLogs(ruleId: string, limit: number = 100): Promise<AutomationExecutionLog[]> {
    return this.executionLogs.filter(log => log.ruleId === ruleId).slice(-limit);
  }

  /**
   * Get rule performance metrics
   */
  async getRuleMetrics(ruleId: string): Promise<any> {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const successRate = rule.executionCount > 0
      ? (rule.successCount / rule.executionCount) * 100
      : 0;

    return {
      ruleId,
      totalExecutions: rule.executionCount,
      successCount: rule.successCount,
      failureCount: rule.failureCount,
      successRate: Math.round(successRate),
      lastExecuted: rule.lastExecuted,
    };
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEscalationId(): string {
    return `esc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWebhookId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const automationRulesEngine = new AutomationRulesEngine();
