/**
 * PAYROLL NOTIFICATION SERVICE
 * Handles real-time WebSocket notifications for salary updates
 *
 * Events:
 * - salary_calculated: New salary calculated
 * - salary_updated: Salary master updated
 * - payment_processed: Payment recorded
 * - advance_given: Salary advance requested
 * - payroll_closed: Monthly payroll closed
 */

import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import { DriverSalaryPayment } from '../models/index';

export interface SalaryNotification {
  type: 'salary_calculated' | 'salary_updated' | 'payment_processed' | 'advance_given' | 'payroll_closed';
  driverId: string;
  tenantId: string;
  timestamp: Date;
  data: {
    amount?: number;
    month?: number;
    year?: number;
    paymentMode?: string;
    reference?: string;
    message: string;
  };
  priority: 'low' | 'normal' | 'high';
}

export interface PayrollSubscriber {
  tenantId: string;
  driverId?: string; // If specified, only get notifications for this driver
  userId?: string;
  callback: (notification: SalaryNotification) => void;
}

/**
 * Singleton event emitter for payroll notifications
 */
class PayrollNotificationEmitter extends EventEmitter {
  private static instance: PayrollNotificationEmitter;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): PayrollNotificationEmitter {
    if (!PayrollNotificationEmitter.instance) {
      PayrollNotificationEmitter.instance = new PayrollNotificationEmitter();
    }
    return PayrollNotificationEmitter.instance;
  }

  /**
   * Emit salary calculated event
   */
  emitSalaryCalculated(
    tenantId: string | mongoose.Types.ObjectId,
    driverId: string | mongoose.Types.ObjectId,
    amount: number,
    month: number,
    year: number
  ) {
    const notification: SalaryNotification = {
      type: 'salary_calculated',
      driverId: driverId.toString(),
      tenantId: tenantId.toString(),
      timestamp: new Date(),
      data: {
        amount,
        month,
        year,
        message: `Salary calculated: ${amount.toLocaleString('en-IN')}`
      },
      priority: 'normal'
    };

    this.emit(`salary:${tenantId}:${driverId}`, notification);
    this.emit(`tenant:${tenantId}`, notification);
  }

  /**
   * Emit salary updated event
   */
  emitSalaryUpdated(
    tenantId: string | mongoose.Types.ObjectId,
    driverId: string | mongoose.Types.ObjectId,
    message: string
  ) {
    const notification: SalaryNotification = {
      type: 'salary_updated',
      driverId: driverId.toString(),
      tenantId: tenantId.toString(),
      timestamp: new Date(),
      data: { message },
      priority: 'normal'
    };

    this.emit(`salary:${tenantId}:${driverId}`, notification);
    this.emit(`tenant:${tenantId}`, notification);
  }

  /**
   * Emit payment processed event
   */
  emitPaymentProcessed(
    tenantId: string | mongoose.Types.ObjectId,
    driverId: string | mongoose.Types.ObjectId,
    amount: number,
    paymentMode: string,
    reference?: string
  ) {
    const notification: SalaryNotification = {
      type: 'payment_processed',
      driverId: driverId.toString(),
      tenantId: tenantId.toString(),
      timestamp: new Date(),
      data: {
        amount,
        paymentMode,
        reference,
        message: `Payment processed: ${amount.toLocaleString('en-IN')} via ${paymentMode}`
      },
      priority: 'high'
    };

    this.emit(`salary:${tenantId}:${driverId}`, notification);
    this.emit(`tenant:${tenantId}`, notification);
  }

  /**
   * Emit advance given event
   */
  emitAdvanceGiven(
    tenantId: string | mongoose.Types.ObjectId,
    driverId: string | mongoose.Types.ObjectId,
    amount: number
  ) {
    const notification: SalaryNotification = {
      type: 'advance_given',
      driverId: driverId.toString(),
      tenantId: tenantId.toString(),
      timestamp: new Date(),
      data: {
        amount,
        message: `Salary advance: ${amount.toLocaleString('en-IN')}`
      },
      priority: 'normal'
    };

    this.emit(`salary:${tenantId}:${driverId}`, notification);
    this.emit(`tenant:${tenantId}`, notification);
  }

  /**
   * Emit payroll closed event
   */
  emitPayrollClosed(
    tenantId: string | mongoose.Types.ObjectId,
    month: number,
    year: number,
    totalAmount: number
  ) {
    const notification: SalaryNotification = {
      type: 'payroll_closed',
      driverId: 'all',
      tenantId: tenantId.toString(),
      timestamp: new Date(),
      data: {
        month,
        year,
        amount: totalAmount,
        message: `Payroll closed for ${month}/${year}: ${totalAmount.toLocaleString('en-IN')}`
      },
      priority: 'high'
    };

    this.emit(`tenant:${tenantId}`, notification);
  }

  /**
   * Subscribe to driver salary notifications
   */
  subscribeToDriver(
    tenantId: string | mongoose.Types.ObjectId,
    driverId: string | mongoose.Types.ObjectId,
    callback: (notification: SalaryNotification) => void
  ) {
    const eventKey = `salary:${tenantId}:${driverId}`;
    this.on(eventKey, callback);

    // Return unsubscribe function
    return () => {
      this.removeListener(eventKey, callback);
    };
  }

  /**
   * Subscribe to tenant-wide payroll notifications
   */
  subscribeToTenant(
    tenantId: string | mongoose.Types.ObjectId,
    callback: (notification: SalaryNotification) => void
  ) {
    const eventKey = `tenant:${tenantId}`;
    this.on(eventKey, callback);

    return () => {
      this.removeListener(eventKey, callback);
    };
  }
}

export const payrollEmitter = PayrollNotificationEmitter.getInstance();

/**
 * Log payroll event for audit trail
 */
export async function logPayrollEvent(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  eventType: string,
  details: Record<string, any>
) {
  try {
    console.log(`[PAYROLL-EVENT] ${eventType}`, {
      tenantId: tenantId.toString(),
      driverId: driverId.toString(),
      details,
      timestamp: new Date().toISOString()
    });

    // In production, store in dedicated audit log collection
    // For now, just log to console
  } catch (error) {
    console.error('[PAYROLL-EVENT] Failed to log event:', error);
  }
}

/**
 * Setup real-time payroll update polling
 * Call this on driver detail page load
 */
export function setupPayrollRealtimeUpdates(
  tenantId: string,
  driverId: string,
  onUpdate: (notification: SalaryNotification) => void,
  pollIntervalMs: number = 60000 // 1 minute
) {
  // Subscribe to events
  const unsubscribe = payrollEmitter.subscribeToDriver(tenantId, driverId, onUpdate);

  // Optional: Setup polling for slower connections
  let pollTimeout: NodeJS.Timeout | null = null;

  const startPolling = () => {
    pollTimeout = setTimeout(() => {
      // Emit refresh event
      const refreshNotification: SalaryNotification = {
        type: 'salary_updated',
        driverId,
        tenantId,
        timestamp: new Date(),
        data: { message: 'Salary data refreshed' },
        priority: 'low'
      };
      onUpdate(refreshNotification);
      startPolling();
    }, pollIntervalMs);
  };

  // Start polling
  startPolling();

  // Return cleanup function
  return () => {
    unsubscribe();
    if (pollTimeout) {
      clearTimeout(pollTimeout);
    }
  };
}

/**
 * Setup WebSocket handlers for payroll updates
 * Call this when initializing WebSocket connection
 */
export function setupWebSocketPayrollHandlers(
  socket: any, // Socket.io socket
  tenantId: string
) {
  // Join tenant room
  socket.join(`payroll:${tenantId}`);

  // Subscribe to tenant-wide updates
  const unsubscribe = payrollEmitter.subscribeToTenant(tenantId, (notification) => {
    socket.emit('payroll:update', notification);
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    unsubscribe();
  });

  // Allow client to subscribe to specific driver
  socket.on('payroll:subscribe-driver', (driverId: string) => {
    const driverUnsubscribe = payrollEmitter.subscribeToDriver(
      tenantId,
      driverId,
      (notification) => {
        socket.emit('payroll:driver-update', notification);
      }
    );

    socket.on('payroll:unsubscribe-driver', () => {
      driverUnsubscribe();
    });
  });
}

/**
 * Broadcast payroll update to frontend
 */
export function broadcastPayrollUpdate(
  io: any, // Socket.io instance
  tenantId: string,
  driverId: string,
  notification: SalaryNotification
) {
  // Broadcast to driver's namespace
  io.to(`payroll:${tenantId}`).emit('payroll:update', notification);

  // Also emit through event emitter for real-time listeners
  payrollEmitter.emit(`salary:${tenantId}:${driverId}`, notification);
}
