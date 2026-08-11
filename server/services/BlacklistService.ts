/**
 * BlacklistService (WAVE 2)
 *
 * Enforces customer blacklist policies at booking creation time.
 * Prevents bookings from blacklisted/do-not-contact customers.
 */

import mongoose from 'mongoose';

export type BlacklistStatus = 'active' | 'inactive' | 'blacklisted' | 'do_not_contact';

export type BlacklistAction = 'WARNING' | 'MANAGER_APPROVAL' | 'HARD_BLOCK';

export interface IBlacklistCheckResult {
  allowed: boolean;
  status: BlacklistStatus;
  action: BlacklistAction;
  reason?: string;
  riskNotes?: string;
  requiresManagerApproval: boolean;
  canBypassWithApproval: boolean;
}

export interface IBlacklistEntry {
  customerId: mongoose.Types.ObjectId;
  reason: string;
  addedBy: {
    userId: string;
    role: string;
  };
  addedAt: Date;
  notes?: string;
}

/**
 * Blacklist service for customer verification at booking time
 */
export class BlacklistService {
  /**
   * Check if a customer is blacklisted
   * Returns action required (WARNING, MANAGER_APPROVAL, HARD_BLOCK)
   *
   * @param tenantId Tenant context
   * @param customerId Customer to check
   * @param customerStatus Customer status from database
   * @param tenantConfig Optional tenant policy configuration
   * @returns Blacklist check result
   */
  static async checkCustomer(
    tenantId: mongoose.Types.ObjectId,
    customerId: mongoose.Types.ObjectId,
    customerStatus: BlacklistStatus,
    tenantConfig?: {
      blacklistMode?: 'WARNING' | 'MANAGER_APPROVAL' | 'HARD_BLOCK';
    }
  ): Promise<IBlacklistCheckResult> {
    // Determine action based on status
    const action = tenantConfig?.blacklistMode || 'MANAGER_APPROVAL';

    switch (customerStatus) {
      case 'do_not_contact':
        // Do not contact = explicit customer request to stop all communications
        // Usually still allows booking (for reference), but no messaging
        return {
          allowed: true,
          status: 'do_not_contact',
          action: 'WARNING',
          reason: 'Customer has opted out of communications',
          requiresManagerApproval: false,
          canBypassWithApproval: false,
        };

      case 'blacklisted':
        // Blacklisted = payment default, fraud, or policy violation
        // Action depends on tenant config
        if (action === 'HARD_BLOCK') {
          return {
            allowed: false,
            status: 'blacklisted',
            action: 'HARD_BLOCK',
            reason: 'Customer is blacklisted',
            requiresManagerApproval: false,
            canBypassWithApproval: false,
          };
        } else if (action === 'MANAGER_APPROVAL') {
          return {
            allowed: false,
            status: 'blacklisted',
            action: 'MANAGER_APPROVAL',
            reason: 'Customer is blacklisted; manager approval required',
            requiresManagerApproval: true,
            canBypassWithApproval: true,
          };
        } else {
          // WARNING mode
          return {
            allowed: true,
            status: 'blacklisted',
            action: 'WARNING',
            reason: 'Customer is blacklisted but booking allowed with caution',
            requiresManagerApproval: false,
            canBypassWithApproval: false,
          };
        }

      case 'inactive':
        // Inactive = customer hasn't booked recently but not flagged as problem
        return {
          allowed: true,
          status: 'inactive',
          action: 'WARNING',
          reason: 'Customer is inactive; may need payment verification',
          requiresManagerApproval: false,
          canBypassWithApproval: false,
        };

      case 'active':
      default:
        // Active = no issues
        return {
          allowed: true,
          status: 'active',
          action: 'WARNING',
          reason: '',
          requiresManagerApproval: false,
          canBypassWithApproval: false,
        };
    }
  }

  /**
   * Blacklist a customer (with audit trail)
   *
   * @param customerId Customer to blacklist
   * @param reason Reason for blacklist (payment_default, fraud, abuse, etc.)
   * @param addedBy User who is adding to blacklist
   * @param notes Optional internal notes
   */
  static async blacklistCustomer(
    customerId: mongoose.Types.ObjectId,
    reason: string,
    addedBy: {
      userId: string;
      role: string;
    },
    notes?: string
  ): Promise<IBlacklistEntry> {
    const entry: IBlacklistEntry = {
      customerId,
      reason,
      addedBy,
      addedAt: new Date(),
      notes,
    };

    // TODO: Persist to BlacklistAudit collection for history
    // This is a placeholder; actual implementation would write to audit log

    return entry;
  }

  /**
   * Remove customer from blacklist (with audit trail)
   *
   * @param customerId Customer to remove
   * @param reason Reason for removal (appeal_granted, resolution, etc.)
   * @param removedBy User removing from blacklist
   */
  static async removeFromBlacklist(
    customerId: mongoose.Types.ObjectId,
    reason: string,
    removedBy: {
      userId: string;
      role: string;
    }
  ): Promise<void> {
    // TODO: Persist removal to audit log
  }

  /**
   * Get blacklist history for a customer
   * Shows who blacklisted when and why
   *
   * @param customerId Customer to check
   * @returns Array of blacklist events
   */
  static async getBlacklistHistory(customerId: mongoose.Types.ObjectId): Promise<IBlacklistEntry[]> {
    // TODO: Query BlacklistAudit collection
    return [];
  }

  /**
   * Bulk check customers for blacklist status
   * Useful for imports or bulk operations
   *
   * @param customerIds Array of customer IDs
   * @param customerStatuses Map of customerId → status
   * @returns Map of customerId → check result
   */
  static async bulkCheck(
    customerIds: mongoose.Types.ObjectId[],
    customerStatuses: Map<string, BlacklistStatus>
  ): Promise<Map<string, IBlacklistCheckResult>> {
    const results = new Map<string, IBlacklistCheckResult>();

    for (const customerId of customerIds) {
      const status = customerStatuses.get(customerId.toString()) || 'active';
      const result = await this.checkCustomer(customerId, customerId, status as BlacklistStatus);
      results.set(customerId.toString(), result);
    }

    return results;
  }
}

/**
 * Result display helper for frontend/mobile
 */
export class BlacklistDisplay {
  /**
   * Format blacklist result for user display
   *
   * @param result Blacklist check result
   * @param customerName Customer name for display
   * @param customerPhone Customer phone (optional, formatted)
   * @returns Display-friendly object
   */
  static format(
    result: IBlacklistCheckResult,
    customerName: string,
    customerPhone?: string
  ): {
    icon: string;
    title: string;
    message: string;
    color: 'red' | 'yellow' | 'green';
    buttons: Array<{ label: string; action: string; requiresApproval?: boolean }>;
  } {
    const baseInfo = `${customerName}${customerPhone ? ` (${customerPhone})` : ''}`;

    switch (result.action) {
      case 'HARD_BLOCK':
        return {
          icon: '🚫',
          title: 'Blacklisted Customer',
          message: `${baseInfo}\n\n${result.reason}`,
          color: 'red',
          buttons: [{ label: 'Cancel', action: 'cancel' }],
        };

      case 'MANAGER_APPROVAL':
        return {
          icon: '⚠️',
          title: 'Blacklisted - Approval Required',
          message: `${baseInfo}\n\nReason: ${result.reason}${result.riskNotes ? `\n\n${result.riskNotes}` : ''}`,
          color: 'yellow',
          buttons: [
            { label: 'Cancel', action: 'cancel' },
            { label: 'Manager Approval', action: 'request_approval', requiresApproval: true },
          ],
        };

      case 'WARNING':
        if (result.status === 'active') {
          return {
            icon: '✅',
            title: 'Customer Active',
            message: 'No issues detected',
            color: 'green',
            buttons: [{ label: 'Proceed', action: 'proceed' }],
          };
        } else {
          return {
            icon: '⚠️',
            title: result.status === 'do_not_contact' ? 'Do Not Contact' : 'Inactive Customer',
            message: `${baseInfo}\n\n${result.reason}`,
            color: 'yellow',
            buttons: [
              { label: 'Cancel', action: 'cancel' },
              { label: 'Proceed with Caution', action: 'proceed' },
            ],
          };
        }

      default:
        return {
          icon: '❓',
          title: 'Unknown Status',
          message: 'Unable to verify customer status',
          color: 'yellow',
          buttons: [{ label: 'Cancel', action: 'cancel' }],
        };
    }
  }
}

export default BlacklistService;
