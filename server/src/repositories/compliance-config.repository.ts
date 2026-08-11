// ============================================================================
// COMPLIANCE CONFIG REPOSITORY - Alert thresholds and settings
// Phase 4: Database Integration
// ============================================================================

import { Pool } from 'pg';
import { AlertConfiguration } from '../types/fleet-compliance.types';
import { TenantAwareRepository } from './base.repository';

export class ComplianceConfigRepository extends TenantAwareRepository<AlertConfiguration> {
  constructor(pool: Pool) {
    super('alert_configuration', pool);
  }

  /**
   * Get config for tenant (creates default if not exists)
   */
  async getOrCreateForTenant(tenantId: string): Promise<AlertConfiguration> {
    let config = await this.findByTenant(tenantId);

    if (!config) {
      config = await this.insert({
        tenant_id: tenantId,
        days_before_expiry_info: 30,
        days_before_expiry_warning: 15,
        days_before_expiry_high: 7,
        days_before_expiry_critical: 3,
        enable_auto_alerts: true,
        enable_email_notifications: true,
        enable_sms_notifications: false,
        alert_frequency_hours: 24,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
    }

    return config;
  }

  /**
   * Get config for specific tenant
   */
  async findByTenant(tenantId: string): Promise<AlertConfiguration | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_active = true
      LIMIT 1
    `;
    return this.queryOne<AlertConfiguration>(sql, [tenantId]);
  }

  /**
   * Update tenant config
   */
  async updateConfig(
    tenantId: string,
    config: Partial<AlertConfiguration>
  ): Promise<AlertConfiguration> {
    const existing = await this.findByTenant(tenantId);
    if (!existing) {
      throw new Error(`No configuration found for tenant ${tenantId}`);
    }

    return this.update(existing.id, {
      ...config,
      updated_at: new Date(),
    } as any);
  }

  /**
   * Get info threshold (days)
   */
  async getInfoThreshold(tenantId: string): Promise<number> {
    const config = await this.getOrCreateForTenant(tenantId);
    return config.days_before_expiry_info;
  }

  /**
   * Get warning threshold (days)
   */
  async getWarningThreshold(tenantId: string): Promise<number> {
    const config = await this.getOrCreateForTenant(tenantId);
    return config.days_before_expiry_warning;
  }

  /**
   * Get high threshold (days)
   */
  async getHighThreshold(tenantId: string): Promise<number> {
    const config = await this.getOrCreateForTenant(tenantId);
    return config.days_before_expiry_high;
  }

  /**
   * Get critical threshold (days)
   */
  async getCriticalThreshold(tenantId: string): Promise<number> {
    const config = await this.getOrCreateForTenant(tenantId);
    return config.days_before_expiry_critical;
  }

  /**
   * Check if auto alerts enabled
   */
  async isAutoAlertsEnabled(tenantId: string): Promise<boolean> {
    const config = await this.getOrCreateForTenant(tenantId);
    return config.enable_auto_alerts;
  }

  /**
   * Check if email notifications enabled
   */
  async isEmailNotificationsEnabled(tenantId: string): Promise<boolean> {
    const config = await this.getOrCreateForTenant(tenantId);
    return config.enable_email_notifications;
  }

  /**
   * Check if SMS notifications enabled
   */
  async isSMSNotificationsEnabled(tenantId: string): Promise<boolean> {
    const config = await this.getOrCreateForTenant(tenantId);
    return config.enable_sms_notifications;
  }

  /**
   * Get alert frequency in hours
   */
  async getAlertFrequency(tenantId: string): Promise<number> {
    const config = await this.getOrCreateForTenant(tenantId);
    return config.alert_frequency_hours;
  }

  /**
   * Update thresholds for tenant
   */
  async updateThresholds(
    tenantId: string,
    thresholds: {
      info?: number;
      warning?: number;
      high?: number;
      critical?: number;
    }
  ): Promise<AlertConfiguration> {
    const update: Record<string, number> = {};

    if (thresholds.info !== undefined)
      update.days_before_expiry_info = thresholds.info;
    if (thresholds.warning !== undefined)
      update.days_before_expiry_warning = thresholds.warning;
    if (thresholds.high !== undefined)
      update.days_before_expiry_high = thresholds.high;
    if (thresholds.critical !== undefined)
      update.days_before_expiry_critical = thresholds.critical;

    return this.updateConfig(tenantId, update as any);
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(
    tenantId: string,
    settings: {
      enableEmail?: boolean;
      enableSMS?: boolean;
      frequency?: number;
    }
  ): Promise<AlertConfiguration> {
    const update: Record<string, any> = {};

    if (settings.enableEmail !== undefined)
      update.enable_email_notifications = settings.enableEmail;
    if (settings.enableSMS !== undefined)
      update.enable_sms_notifications = settings.enableSMS;
    if (settings.frequency !== undefined)
      update.alert_frequency_hours = settings.frequency;

    return this.updateConfig(tenantId, update);
  }

  /**
   * Reset to defaults for tenant
   */
  async resetToDefaults(tenantId: string): Promise<AlertConfiguration> {
    const existing = await this.findByTenant(tenantId);
    if (!existing) {
      throw new Error(`No configuration found for tenant ${tenantId}`);
    }

    return this.update(existing.id, {
      days_before_expiry_info: 30,
      days_before_expiry_warning: 15,
      days_before_expiry_high: 7,
      days_before_expiry_critical: 3,
      enable_auto_alerts: true,
      enable_email_notifications: true,
      enable_sms_notifications: false,
      alert_frequency_hours: 24,
      updated_at: new Date(),
    } as any);
  }
}
