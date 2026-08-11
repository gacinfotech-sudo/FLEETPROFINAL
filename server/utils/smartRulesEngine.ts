// Smart Notification Rules Engine - Phase 38
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('SmartRulesEngine');

export interface NotificationRule {
  _id?: string;
  tenantId: string;
  name: string;
  enabled: boolean;
  eventType: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'in' | 'regex';
  value: any;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
}

export interface RuleAction {
  type: 'send' | 'delay' | 'skip' | 'escalate' | 'segment';
  channels?: string[];
  delayMinutes?: number;
  segmentRule?: string;
  escalationLevel?: 'high' | 'medium' | 'low';
}

class SmartRulesEngine {
  private db = mongoose.connection.db!;

  async evaluateRules(tenantId: string, eventType: string, eventData: Record<string, any>): Promise<RuleAction[]> {
    try {
      const collection = this.db.collection('notification_rules');

      const rules = await collection
        .find({
          tenantId,
          eventType,
          enabled: true
        })
        .sort({ priority: -1 })
        .toArray() as any;

      const matchedActions: RuleAction[] = [];

      for (const rule of rules) {
        if (this.evaluateConditions(rule.conditions, eventData)) {
          matchedActions.push(...rule.actions);
          log.debug('Rule matched', { ruleId: rule._id, name: rule.name });
        }
      }

      return matchedActions;
    } catch (error) {
      log.error('Failed to evaluate rules', { error });
      return [];
    }
  }

  private evaluateConditions(conditions: RuleCondition[], data: Record<string, any>): boolean {
    if (conditions.length === 0) return true;

    return conditions.every(cond => this.evaluateCondition(cond, data));
  }

  private evaluateCondition(condition: RuleCondition, data: Record<string, any>): boolean {
    const value = data[condition.field];

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'notEquals':
        return value !== condition.value;

      case 'greaterThan':
        return value > condition.value;

      case 'lessThan':
        return value < condition.value;

      case 'contains':
        return String(value).includes(String(condition.value));

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);

      case 'regex':
        const regex = new RegExp(condition.value);
        return regex.test(String(value));

      default:
        return false;
    }
  }

  async createRule(rule: Omit<NotificationRule, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const collection = this.db.collection('notification_rules');

      const doc = {
        ...rule,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(doc as any);

      log.info('Rule created', {
        ruleId: result.insertedId,
        name: rule.name
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to create rule', { error });
      throw error;
    }
  }

  async updateRule(ruleId: string, updates: Partial<NotificationRule>): Promise<void> {
    try {
      const collection = this.db.collection('notification_rules');

      await collection.updateOne(
        { _id: new mongoose.Types.ObjectId(ruleId) },
        {
          $set: {
            ...updates,
            updatedAt: new Date()
          }
        }
      );

      log.info('Rule updated', { ruleId });
    } catch (error) {
      log.error('Failed to update rule', { ruleId, error });
      throw error;
    }
  }

  async deleteRule(ruleId: string): Promise<void> {
    try {
      const collection = this.db.collection('notification_rules');

      await collection.deleteOne({
        _id: new mongoose.Types.ObjectId(ruleId)
      });

      log.info('Rule deleted', { ruleId });
    } catch (error) {
      log.error('Failed to delete rule', { ruleId, error });
      throw error;
    }
  }

  async listRules(tenantId: string): Promise<NotificationRule[]> {
    try {
      const collection = this.db.collection('notification_rules');

      return await collection
        .find({ tenantId })
        .sort({ priority: -1 })
        .toArray() as any;
    } catch (error) {
      log.error('Failed to list rules', { error });
      return [];
    }
  }

  async testRule(tenantId: string, ruleId: string, testData: Record<string, any>): Promise<{ matched: boolean; actions: RuleAction[] }> {
    try {
      const collection = this.db.collection('notification_rules');

      const rule = await collection.findOne({
        _id: new mongoose.Types.ObjectId(ruleId),
        tenantId
      }) as any;

      if (!rule) {
        throw new Error('Rule not found');
      }

      const matched = this.evaluateConditions(rule.conditions, testData);
      const actions = matched ? rule.actions : [];

      return { matched, actions };
    } catch (error) {
      log.error('Failed to test rule', { ruleId, error });
      throw error;
    }
  }
}

export const smartRulesEngine = new SmartRulesEngine();
