/**
 * DriverAssignmentService (WAVE 5)
 *
 * State machine for driver duty assignment lifecycle.
 * Manages: assignment creation → notification → acceptance/rejection → timeout
 */

import mongoose from 'mongoose';

export type AssignmentStatus = 'ASSIGNED' | 'NOTIFICATION_SENT' | 'SEEN' | 'ACCEPTED' | 'REJECTED' | 'TIMED_OUT' | 'CANCELLED';

export interface IDriverAssignment {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  status: AssignmentStatus;

  // Timestamps per state
  assignedAt: Date;
  notificationSentAt?: Date;
  seenAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  timedOutAt?: Date;
  cancelledAt?: Date;

  // Acceptance deadline
  acceptanceDeadline?: Date;
  acceptanceDeadlineMinutes?: number;

  // Rejection details
  rejectionReason?: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

export interface IAssignmentResult {
  success: boolean;
  assignment?: IDriverAssignment;
  error?: string;
  nextAction?: string;
}

export interface INotificationEvent {
  type: 'ASSIGNMENT_CREATED' | 'ACCEPTED' | 'REJECTED' | 'TIMED_OUT';
  assignmentId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  timestamp: Date;
  data: Record<string, any>;
}

/**
 * Driver Assignment State Machine Service
 */
export class DriverAssignmentService {
  /**
   * Create new driver assignment
   * Triggered when ops assigns driver to booking
   */
  static async assign(
    tenantId: mongoose.Types.ObjectId,
    bookingId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId,
    options?: {
      acceptanceDeadlineMinutes?: number;
    }
  ): Promise<IAssignmentResult> {
    const now = new Date();
    const deadlineMinutes = options?.acceptanceDeadlineMinutes || 15;
    const acceptanceDeadline = new Date(now.getTime() + deadlineMinutes * 60 * 1000);

    const assignment: IDriverAssignment = {
      tenantId,
      bookingId,
      driverId,
      status: 'ASSIGNED',
      assignedAt: now,
      acceptanceDeadline,
      acceptanceDeadlineMinutes: deadlineMinutes,
      createdAt: now,
      updatedAt: now,
    };

    // TODO: Persist to MongoDB
    // const saved = await db.collection('driverassignments').insertOne(assignment);
    // assignment._id = saved.insertedId;

    // Emit notification event
    this.emitNotification({
      type: 'ASSIGNMENT_CREATED',
      assignmentId: assignment._id!,
      bookingId,
      driverId,
      tenantId,
      timestamp: now,
      data: {
        pickupTime: null, // From booking
        location: null,   // From booking
        deadline: acceptanceDeadline,
      },
    });

    return {
      success: true,
      assignment,
      nextAction: 'SEND_NOTIFICATION',
    };
  }

  /**
   * Mark notification as sent
   * Called after notification delivery confirmed
   */
  static async markNotificationSent(
    assignmentId: mongoose.Types.ObjectId,
    mongoClient: any
  ): Promise<IAssignmentResult> {
    const now = new Date();

    // TODO: Update in MongoDB
    // const result = await db.collection('driverassignments').updateOne(
    //   { _id: assignmentId, status: 'ASSIGNED' },
    //   {
    //     $set: {
    //       status: 'NOTIFICATION_SENT',
    //       notificationSentAt: now,
    //       updatedAt: now,
    //     }
    //   }
    // );

    return {
      success: true,
      nextAction: 'WAIT_FOR_DRIVER_RESPONSE',
    };
  }

  /**
   * Mark notification as seen by driver
   * Called when driver opens the duty in their app
   */
  static async markAsSeen(
    assignmentId: mongoose.Types.ObjectId,
    mongoClient: any
  ): Promise<IAssignmentResult> {
    const now = new Date();

    // TODO: Update in MongoDB
    // const result = await db.collection('driverassignments').updateOne(
    //   { _id: assignmentId, status: 'NOTIFICATION_SENT' },
    //   {
    //     $set: {
    //       status: 'SEEN',
    //       seenAt: now,
    //       updatedAt: now,
    //     }
    //   }
    // );

    return {
      success: true,
      nextAction: 'WAIT_FOR_ACCEPT_REJECT',
    };
  }

  /**
   * Driver accepts the assignment
   * Idempotent: multiple accepts → single acceptance
   */
  static async accept(
    assignmentId: mongoose.Types.ObjectId,
    mongoClient: any
  ): Promise<IAssignmentResult> {
    const now = new Date();

    // TODO: Check if already accepted
    // If yes, return cached result (idempotency)

    // TODO: Update in MongoDB
    // const result = await db.collection('driverassignments').updateOne(
    //   { _id: assignmentId },
    //   {
    //     $set: {
    //       status: 'ACCEPTED',
    //       acceptedAt: now,
    //       updatedAt: now,
    //     }
    //   }
    // );

    // Emit acceptance event
    this.emitNotification({
      type: 'ACCEPTED',
      assignmentId,
      bookingId: null as any,
      driverId: null as any,
      tenantId: null as any,
      timestamp: now,
      data: {
        acceptedAt: now,
      },
    });

    return {
      success: true,
      nextAction: 'ASSIGNMENT_ACCEPTED',
    };
  }

  /**
   * Driver rejects the assignment
   */
  static async reject(
    assignmentId: mongoose.Types.ObjectId,
    reason: string,
    mongoClient: any
  ): Promise<IAssignmentResult> {
    const now = new Date();

    // TODO: Update in MongoDB
    // const result = await db.collection('driverassignments').updateOne(
    //   { _id: assignmentId },
    //   {
    //     $set: {
    //       status: 'REJECTED',
    //       rejectionReason: reason,
    //       rejectedAt: now,
    //       updatedAt: now,
    //     }
    //   }
    // );

    // Emit rejection event
    this.emitNotification({
      type: 'REJECTED',
      assignmentId,
      bookingId: null as any,
      driverId: null as any,
      tenantId: null as any,
      timestamp: now,
      data: {
        reason,
        rejectedAt: now,
      },
    });

    return {
      success: true,
      nextAction: 'REASSIGN_TO_DIFFERENT_DRIVER',
    };
  }

  /**
   * Handle acceptance deadline timeout
   * Called by scheduled job when deadline passes
   */
  static async handleTimeout(
    assignmentId: mongoose.Types.ObjectId,
    mongoClient: any
  ): Promise<IAssignmentResult> {
    const now = new Date();

    // TODO: Check current status
    // Only timeout if still in ASSIGNED/NOTIFICATION_SENT/SEEN

    // TODO: Update in MongoDB
    // const result = await db.collection('driverassignments').updateOne(
    //   {
    //     _id: assignmentId,
    //     status: { $in: ['ASSIGNED', 'NOTIFICATION_SENT', 'SEEN'] }
    //   },
    //   {
    //     $set: {
    //       status: 'TIMED_OUT',
    //       timedOutAt: now,
    //       updatedAt: now,
    //     }
    //   }
    // );

    // Emit timeout event
    this.emitNotification({
      type: 'TIMED_OUT',
      assignmentId,
      bookingId: null as any,
      driverId: null as any,
      tenantId: null as any,
      timestamp: now,
      data: {
        timedOutAt: now,
      },
    });

    return {
      success: true,
      nextAction: 'NOTIFY_OPERATIONS_TIMEOUT',
    };
  }

  /**
   * Cancel assignment (ops cancels before driver responds)
   */
  static async cancel(
    assignmentId: mongoose.Types.ObjectId,
    mongoClient: any
  ): Promise<IAssignmentResult> {
    const now = new Date();

    // TODO: Update in MongoDB
    // const result = await db.collection('driverassignments').updateOne(
    //   { _id: assignmentId },
    //   {
    //     $set: {
    //       status: 'CANCELLED',
    //       cancelledAt: now,
    //       updatedAt: now,
    //     }
    //   }
    // );

    return {
      success: true,
      nextAction: 'NOTIFY_DRIVER_CANCELLED',
    };
  }

  /**
   * Get assignment current state
   */
  static async getAssignment(
    assignmentId: mongoose.Types.ObjectId,
    mongoClient: any
  ): Promise<IDriverAssignment | null> {
    // TODO: Query MongoDB
    // return await db.collection('driverassignments').findOne({ _id: assignmentId });
    return null;
  }

  /**
   * Get driver's current assignments
   * Used for driver duty list
   */
  static async getDriverAssignments(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId,
    statuses?: AssignmentStatus[],
    mongoClient?: any
  ): Promise<IDriverAssignment[]> {
    const query: any = {
      tenantId,
      driverId,
    };

    if (statuses && statuses.length > 0) {
      query.status = { $in: statuses };
    }

    // TODO: Query MongoDB
    // return await db.collection('driverassignments')
    //   .find(query)
    //   .sort({ assignedAt: -1 })
    //   .toArray();

    return [];
  }

  /**
   * Get booking's assignment (if driver assigned)
   */
  static async getBookingAssignment(
    tenantId: mongoose.Types.ObjectId,
    bookingId: mongoose.Types.ObjectId,
    mongoClient?: any
  ): Promise<IDriverAssignment | null> {
    // TODO: Query MongoDB
    // return await db.collection('driverassignments').findOne({
    //   tenantId,
    //   bookingId,
    //   status: { $ne: 'CANCELLED' }
    // });

    return null;
  }

  /**
   * Timeout check job
   * Run periodically (every 5 minutes) to handle expired deadlines
   */
  static async checkAndTimeoutExpired(mongoClient?: any): Promise<number> {
    const now = new Date();

    // TODO: Query MongoDB
    // const expired = await db.collection('driverassignments')
    //   .find({
    //     status: { $in: ['ASSIGNED', 'NOTIFICATION_SENT', 'SEEN'] },
    //     acceptanceDeadline: { $lt: now }
    //   })
    //   .toArray();

    // for (const assignment of expired) {
    //   await this.handleTimeout(assignment._id);
    // }

    // return expired.length;

    return 0;
  }

  /**
   * Emit notification event
   * Trigger: notification service, realtime updates, Web/Business APK sync
   */
  private static emitNotification(event: INotificationEvent): void {
    // TODO: Publish to event system
    // - Send to driver notification queue
    // - Send to Web/Business APK realtime (WebSocket)
    // - Log for audit trail

    console.log(`[AssignmentEvent] ${event.type} for assignment ${event.assignmentId}`);
  }

  /**
   * State transition validator
   * Ensures only valid state changes
   */
  static isValidTransition(from: AssignmentStatus, to: AssignmentStatus): boolean {
    const validTransitions: Record<AssignmentStatus, AssignmentStatus[]> = {
      ASSIGNED: ['NOTIFICATION_SENT', 'CANCELLED'],
      NOTIFICATION_SENT: ['SEEN', 'TIMED_OUT', 'CANCELLED'],
      SEEN: ['ACCEPTED', 'REJECTED', 'TIMED_OUT', 'CANCELLED'],
      ACCEPTED: [],                    // Terminal state
      REJECTED: [],                    // Terminal state
      TIMED_OUT: [],                   // Terminal state
      CANCELLED: [],                   // Terminal state
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Get human-readable status
   */
  static getStatusLabel(status: AssignmentStatus): string {
    const labels: Record<AssignmentStatus, string> = {
      ASSIGNED: 'Assigned to driver',
      NOTIFICATION_SENT: 'Waiting for driver',
      SEEN: 'Duty viewed',
      ACCEPTED: 'Driver accepted',
      REJECTED: 'Driver rejected',
      TIMED_OUT: 'Acceptance timed out',
      CANCELLED: 'Assignment cancelled',
    };
    return labels[status] || status;
  }
}

export default DriverAssignmentService;
