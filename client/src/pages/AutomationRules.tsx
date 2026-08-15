// ============================================================================
// AUTOMATION RULES PAGE - No-code workflow automation UI
// Phase 5: Milestone 1 - AI & ML Enhancements
// ============================================================================

import React, { useState, useEffect } from 'react';
import '../styles/AutomationRules.css';

interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'starts_with' | 'in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

interface Action {
  id: string;
  type: 'send_notification' | 'update_record' | 'create_task' | 'escalate' | 'webhook_call' | 'data_transform';
  config: Record<string, any>;
  order: number;
}

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: {
    type: 'manual' | 'time_based' | 'event_based' | 'condition_based';
    config: Record<string, any>;
  };
  conditions: Condition[];
  actions: Action[];
  executionCount?: number;
  successCount?: number;
  failureCount?: number;
}

/**
 * AutomationRules: No-code automation rule builder UI
 * - Visual rule builder interface
 * - Trigger, condition, and action configuration
 * - Rule management (create, edit, delete)
 * - Execution history and metrics
 * - Testing and preview
 */
export const AutomationRulesPage: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');

  useEffect(() => {
    // Load rules from API
    loadRules();
  }, []);

  const loadRules = async () => {
    // In production, would fetch from API
    const mockRules: AutomationRule[] = [
      {
        id: 'rule_1',
        name: 'Send welcome email to new users',
        description: 'Automatically send welcome email when new user signs up',
        enabled: true,
        trigger: {
          type: 'event_based',
          config: { eventType: 'user.created' },
        },
        conditions: [],
        actions: [
          {
            id: 'action_1',
            type: 'send_notification',
            config: {
              recipient: '{{user.email}}',
              subject: 'Welcome to FleetPro!',
              message: 'Welcome! Here are some tips to get started...',
              channel: 'email',
            },
            order: 1,
          },
        ],
        executionCount: 245,
        successCount: 243,
        failureCount: 2,
      },
      {
        id: 'rule_2',
        name: 'Alert on high error rate',
        description: 'Create alert when error rate exceeds 5%',
        enabled: true,
        trigger: {
          type: 'condition_based',
          config: {},
        },
        conditions: [
          {
            field: 'error_rate',
            operator: 'greater_than',
            value: 5,
          },
        ],
        actions: [
          {
            id: 'action_2',
            type: 'escalate',
            config: { level: 'high', reason: 'High error rate detected' },
            order: 1,
          },
        ],
        executionCount: 52,
        successCount: 51,
        failureCount: 1,
      },
    ];

    setRules(mockRules);
  };

  const handleCreateRule = () => {
    setSelectedRule({
      id: `rule_${Date.now()}`,
      name: '',
      description: '',
      enabled: true,
      trigger: { type: 'manual', config: {} },
      conditions: [],
      actions: [],
    });
    setShowBuilder(true);
    setIsEditing(true);
  };

  const handleEditRule = (rule: AutomationRule) => {
    setSelectedRule(rule);
    setShowBuilder(true);
    setIsEditing(true);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (window.confirm('Are you sure you want to delete this rule?')) {
      setRules(rules.filter(r => r.id !== ruleId));
      setShowBuilder(false);
      setSelectedRule(null);
    }
  };

  const handleSaveRule = (rule: AutomationRule) => {
    if (rules.some(r => r.id === rule.id)) {
      setRules(rules.map(r => (r.id === rule.id ? rule : r)));
    } else {
      setRules([...rules, rule]);
    }

    setShowBuilder(false);
    setSelectedRule(null);
    setIsEditing(false);
  };

  const handleToggleRule = (ruleId: string) => {
    setRules(
      rules.map(r =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      )
    );
  };

  const filteredRules = rules.filter(rule => {
    if (filterStatus === 'enabled') return rule.enabled;
    if (filterStatus === 'disabled') return !rule.enabled;
    return true;
  });

  const successRate = (rule: AutomationRule) => {
    if (!rule.executionCount || rule.executionCount === 0) return 0;
    return Math.round((rule.successCount || 0) / rule.executionCount * 100);
  };

  return (
    <div className="automation-rules-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Automation Rules</h1>
          <p>Create and manage no-code workflow automations</p>
        </div>
        <button className="btn-primary" onClick={handleCreateRule}>
          + Create Rule
        </button>
      </div>

      {!showBuilder && (
        <div className="rules-section">
          <div className="filters">
            <div className="filter-group">
              <label>Status:</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
              >
                <option value="all">All Rules</option>
                <option value="enabled">Enabled Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
            </div>

            <div className="stats">
              <div className="stat">
                <span className="label">Total Rules</span>
                <span className="value">{rules.length}</span>
              </div>
              <div className="stat">
                <span className="label">Enabled</span>
                <span className="value">{rules.filter(r => r.enabled).length}</span>
              </div>
              <div className="stat">
                <span className="label">Total Executions</span>
                <span className="value">
                  {rules.reduce((sum, r) => sum + (r.executionCount || 0), 0)}
                </span>
              </div>
            </div>
          </div>

          {filteredRules.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⚙️</div>
              <h3>No automation rules yet</h3>
              <p>Create your first automation rule to get started</p>
              <button className="btn-secondary" onClick={handleCreateRule}>
                Create First Rule
              </button>
            </div>
          ) : (
            <div className="rules-list">
              {filteredRules.map(rule => (
                <div key={rule.id} className={`rule-card ${!rule.enabled ? 'disabled' : ''}`}>
                  <div className="rule-header">
                    <div className="rule-info">
                      <h3>{rule.name}</h3>
                      {rule.description && <p>{rule.description}</p>}
                    </div>
                    <div className="rule-actions">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleToggleRule(rule.id)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="rule-details">
                    <div className="detail-item">
                      <span className="label">Trigger:</span>
                      <span className="value">{rule.trigger.type}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Conditions:</span>
                      <span className="value">{rule.conditions.length}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Actions:</span>
                      <span className="value">{rule.actions.length}</span>
                    </div>
                  </div>

                  {rule.executionCount ? (
                    <div className="rule-metrics">
                      <div className="metric">
                        <span className="label">Executions:</span>
                        <span className="value">{rule.executionCount}</span>
                      </div>
                      <div className="metric">
                        <span className="label">Success Rate:</span>
                        <span className={`value ${successRate(rule) >= 95 ? 'success' : 'warning'}`}>
                          {successRate(rule)}%
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="rule-actions-footer">
                    <button
                      className="btn-link"
                      onClick={() => handleEditRule(rule)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-link btn-danger"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showBuilder && selectedRule && (
        <RuleBuilder
          rule={selectedRule}
          isEditing={isEditing}
          onSave={handleSaveRule}
          onCancel={() => {
            setShowBuilder(false);
            setSelectedRule(null);
            setIsEditing(false);
          }}
        />
      )}
    </div>
  );
};

interface RuleBuilderProps {
  rule: AutomationRule;
  isEditing: boolean;
  onSave: (rule: AutomationRule) => void;
  onCancel: () => void;
}

/**
 * RuleBuilder: Visual automation rule builder interface
 */
const RuleBuilder: React.FC<RuleBuilderProps> = ({ rule, isEditing, onSave, onCancel }) => {
  const [formRule, setFormRule] = useState<AutomationRule>(rule);

  const handleNameChange = (name: string) => {
    setFormRule({ ...formRule, name });
  };

  const handleDescriptionChange = (description: string) => {
    setFormRule({ ...formRule, description });
  };

  const handleTriggerTypeChange = (type: any) => {
    setFormRule({
      ...formRule,
      trigger: { ...formRule.trigger, type },
    });
  };

  const handleAddCondition = () => {
    setFormRule({
      ...formRule,
      conditions: [
        ...formRule.conditions,
        { field: '', operator: 'equals', value: '' },
      ],
    });
  };

  const handleRemoveCondition = (index: number) => {
    setFormRule({
      ...formRule,
      conditions: formRule.conditions.filter((_, i) => i !== index),
    });
  };

  const handleAddAction = () => {
    setFormRule({
      ...formRule,
      actions: [
        ...formRule.actions,
        {
          id: `action_${Date.now()}`,
          type: 'send_notification',
          config: {},
          order: formRule.actions.length + 1,
        },
      ],
    });
  };

  const handleRemoveAction = (index: number) => {
    setFormRule({
      ...formRule,
      actions: formRule.actions.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="rule-builder">
      <div className="builder-header">
        <h2>{isEditing ? 'Edit Rule' : 'Create New Rule'}</h2>
        <button className="close-btn" onClick={onCancel}>✕</button>
      </div>

      <div className="builder-content">
        <section className="builder-section">
          <h3>Basic Information</h3>
          <div className="form-group">
            <label>Rule Name *</label>
            <input
              type="text"
              value={formRule.name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g., Send welcome email to new users"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formRule.description || ''}
              onChange={e => handleDescriptionChange(e.target.value)}
              placeholder="Describe what this rule does..."
              rows={3}
            />
          </div>
        </section>

        <section className="builder-section">
          <h3>Trigger</h3>
          <div className="form-group">
            <label>Trigger Type *</label>
            <select
              value={formRule.trigger.type}
              onChange={e => handleTriggerTypeChange(e.target.value)}
            >
              <option value="manual">Manual</option>
              <option value="time_based">Time-based (Scheduled)</option>
              <option value="event_based">Event-based</option>
              <option value="condition_based">Condition-based</option>
            </select>
          </div>
        </section>

        <section className="builder-section">
          <div className="section-header">
            <h3>Conditions</h3>
            <button className="btn-small" onClick={handleAddCondition}>
              + Add Condition
            </button>
          </div>

          {formRule.conditions.length === 0 ? (
            <p className="empty-text">No conditions added (rule will always execute)</p>
          ) : (
            <div className="conditions-list">
              {formRule.conditions.map((condition, index) => (
                <div key={index} className="condition-item">
                  <select value={condition.field} className="field-select">
                    <option value="">Select field...</option>
                    <option value="user_type">User Type</option>
                    <option value="usage_count">Usage Count</option>
                    <option value="error_rate">Error Rate</option>
                    <option value="subscription">Subscription</option>
                  </select>
                  <select value={condition.operator} className="operator-select">
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not Equals</option>
                    <option value="greater_than">Greater Than</option>
                    <option value="less_than">Less Than</option>
                    <option value="contains">Contains</option>
                  </select>
                  <input
                    type="text"
                    value={condition.value}
                    className="value-input"
                    placeholder="Value"
                  />
                  <button
                    className="btn-remove"
                    onClick={() => handleRemoveCondition(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="builder-section">
          <div className="section-header">
            <h3>Actions</h3>
            <button className="btn-small" onClick={handleAddAction}>
              + Add Action
            </button>
          </div>

          {formRule.actions.length === 0 ? (
            <p className="empty-text">No actions added</p>
          ) : (
            <div className="actions-list">
              {formRule.actions.map((action, index) => (
                <div key={action.id} className="action-item">
                  <div className="action-number">{index + 1}</div>
                  <select value={action.type} className="action-type-select">
                    <option value="send_notification">Send Notification</option>
                    <option value="update_record">Update Record</option>
                    <option value="create_task">Create Task</option>
                    <option value="escalate">Escalate</option>
                    <option value="webhook_call">Webhook Call</option>
                    <option value="data_transform">Transform Data</option>
                  </select>
                  <button
                    className="btn-remove"
                    onClick={() => handleRemoveAction(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="builder-footer">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={() => onSave(formRule)}
          disabled={!formRule.name}
        >
          {isEditing ? 'Save Changes' : 'Create Rule'}
        </button>
      </div>
    </div>
  );
};

export default AutomationRulesPage;
