import { EventEmitter } from "events";

export type BookingStatus =
  | "created"
  | "assigned"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "payment_pending"
  | "paid"
  | "cancelled";

export type BookingAction =
  | "assign_vehicle"
  | "confirm_booking"
  | "start_trip"
  | "complete_trip"
  | "collect_payment"
  | "send_invoice"
  | "request_review"
  | "cancel_booking";

interface BookingEvent {
  bookingId: string;
  action: BookingAction;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface WorkflowTransition {
  from: BookingStatus;
  to: BookingStatus;
  requiredFields: string[];
  autoActions: BookingAction[];
  timeoutMinutes?: number;
}

interface BookingLifecycle {
  bookingId: string;
  currentStatus: BookingStatus;
  history: Array<{
    status: BookingStatus;
    timestamp: Date;
    action?: BookingAction;
  }>;
  assignedVehicleId?: string;
  assignedDriverId?: string;
  estimatedPickupTime?: Date;
  actualPickupTime?: Date;
  actualDropoffTime?: Date;
  totalAmount?: number;
  paidAmount?: number;
  createdAt: Date;
  completedAt?: Date;
}

class BookingLifecycleManager extends EventEmitter {
  private transitions: Map<string, WorkflowTransition> = new Map();
  private bookingStates: Map<string, BookingLifecycle> = new Map();

  constructor() {
    super();
    this.initializeTransitions();
  }

  private initializeTransitions() {
    // Created → Assigned
    this.registerTransition({
      from: "created",
      to: "assigned",
      requiredFields: ["vehicleId", "driverId"],
      autoActions: ["assign_vehicle"],
      timeoutMinutes: 30, // Auto-cancel if not assigned in 30 min
    });

    // Assigned → Confirmed
    this.registerTransition({
      from: "assigned",
      to: "confirmed",
      requiredFields: ["assignedVehicleId", "assignedDriverId"],
      autoActions: ["confirm_booking"],
      timeoutMinutes: 10, // Driver must confirm within 10 min
    });

    // Confirmed → In Progress
    this.registerTransition({
      from: "confirmed",
      to: "in_progress",
      requiredFields: ["actualPickupTime"],
      autoActions: ["start_trip"],
    });

    // In Progress → Completed
    this.registerTransition({
      from: "in_progress",
      to: "completed",
      requiredFields: ["actualDropoffTime"],
      autoActions: ["complete_trip", "request_review"],
    });

    // Completed → Payment Pending
    this.registerTransition({
      from: "completed",
      to: "payment_pending",
      requiredFields: ["totalAmount"],
      autoActions: ["send_invoice"],
    });

    // Payment Pending → Paid
    this.registerTransition({
      from: "payment_pending",
      to: "paid",
      requiredFields: ["paidAmount"],
      autoActions: ["send_invoice"],
    });
  }

  registerTransition(transition: WorkflowTransition) {
    const key = `${transition.from}->${transition.to}`;
    this.transitions.set(key, transition);
  }

  initializeBooking(bookingId: string, data: any): BookingLifecycle {
    const lifecycle: BookingLifecycle = {
      bookingId,
      currentStatus: "created",
      history: [
        {
          status: "created",
          timestamp: new Date(),
          action: undefined,
        },
      ],
      createdAt: new Date(),
      ...data,
    };

    this.bookingStates.set(bookingId, lifecycle);
    this.emit("booking:created", lifecycle);

    return lifecycle;
  }

  async transitionBooking(
    bookingId: string,
    action: BookingAction,
    metadata?: Record<string, any>
  ): Promise<BookingLifecycle | null> {
    const booking = this.bookingStates.get(bookingId);
    if (!booking) {
      console.error(`Booking ${bookingId} not found`);
      return null;
    }

    // Get next status based on action
    const nextStatus = this.getNextStatus(booking.currentStatus, action);
    if (!nextStatus) {
      console.warn(
        `No valid transition from ${booking.currentStatus} for action ${action}`
      );
      return null;
    }

    const transitionKey = `${booking.currentStatus}->${nextStatus}`;
    const transition = this.transitions.get(transitionKey);

    if (!transition) {
      console.warn(`No transition defined for ${transitionKey}`);
      return null;
    }

    // Validate required fields
    const missingFields = transition.requiredFields.filter(
      (field) => !(field in booking)
    );
    if (missingFields.length > 0) {
      console.warn(`Cannot transition: missing fields ${missingFields.join(", ")}`);
      this.emit("booking:validation_failed", {
        bookingId,
        reason: `Missing fields: ${missingFields.join(", ")}`,
      });
      return null;
    }

    // Update booking
    booking.currentStatus = nextStatus;
    booking.history.push({
      status: nextStatus,
      timestamp: new Date(),
      action,
    });

    if (nextStatus === "completed") {
      booking.completedAt = new Date();
    }

    // Execute auto-actions
    for (const autoAction of transition.autoActions) {
      this.emit(`booking:auto_action`, {
        bookingId,
        action: autoAction,
        metadata,
      });
    }

    // Emit status change event
    this.emit(`booking:${nextStatus}`, {
      booking,
      action,
      metadata,
    });

    console.log(
      `✓ Booking ${bookingId}: ${booking.currentStatus} (via ${action})`
    );

    return booking;
  }

  private getNextStatus(currentStatus: BookingStatus, action: BookingAction): BookingStatus | null {
    const actionToStatusMap: Record<BookingAction, Record<BookingStatus, BookingStatus | null>> = {
      assign_vehicle: {
        created: "assigned",
        assigned: "assigned",
        confirmed: null,
        in_progress: null,
        completed: null,
        payment_pending: null,
        paid: null,
        cancelled: null,
      },
      confirm_booking: {
        created: null,
        assigned: "confirmed",
        confirmed: "confirmed",
        in_progress: null,
        completed: null,
        payment_pending: null,
        paid: null,
        cancelled: null,
      },
      start_trip: {
        created: null,
        assigned: null,
        confirmed: "in_progress",
        in_progress: "in_progress",
        completed: null,
        payment_pending: null,
        paid: null,
        cancelled: null,
      },
      complete_trip: {
        created: null,
        assigned: null,
        confirmed: null,
        in_progress: "completed",
        completed: "completed",
        payment_pending: null,
        paid: null,
        cancelled: null,
      },
      collect_payment: {
        created: null,
        assigned: null,
        confirmed: null,
        in_progress: null,
        completed: "payment_pending",
        payment_pending: "paid",
        paid: "paid",
        cancelled: null,
      },
      send_invoice: {
        created: null,
        assigned: null,
        confirmed: null,
        in_progress: null,
        completed: "payment_pending",
        payment_pending: "payment_pending",
        paid: "paid",
        cancelled: null,
      },
      request_review: {
        created: null,
        assigned: null,
        confirmed: null,
        in_progress: null,
        completed: "completed",
        payment_pending: null,
        paid: null,
        cancelled: null,
      },
      cancel_booking: {
        created: "cancelled",
        assigned: "cancelled",
        confirmed: "cancelled",
        in_progress: "cancelled",
        completed: null,
        payment_pending: null,
        paid: null,
        cancelled: "cancelled",
      },
    };

    return actionToStatusMap[action]?.[currentStatus] ?? null;
  }

  getBooking(bookingId: string): BookingLifecycle | null {
    return this.bookingStates.get(bookingId) || null;
  }

  getBookingHistory(bookingId: string) {
    const booking = this.bookingStates.get(bookingId);
    return booking?.history || [];
  }

  getNextRecommendedActions(bookingId: string): BookingAction[] {
    const booking = this.bookingStates.get(bookingId);
    if (!booking) return [];

    const recommendedActions: BookingAction[] = [];

    // Status-based recommendations
    switch (booking.currentStatus) {
      case "created":
        recommendedActions.push("assign_vehicle");
        break;
      case "assigned":
        recommendedActions.push("confirm_booking");
        break;
      case "confirmed":
        recommendedActions.push("start_trip");
        break;
      case "in_progress":
        recommendedActions.push("complete_trip");
        break;
      case "completed":
        recommendedActions.push("request_review", "collect_payment");
        break;
      case "payment_pending":
        recommendedActions.push("collect_payment");
        break;
    }

    return recommendedActions;
  }

  getBookingStats(): {
    totalBookings: number;
    byStatus: Record<BookingStatus, number>;
    averageCompletionTime: number;
    completionRate: number;
  } {
    let totalBookings = 0;
    let completedBookings = 0;
    let totalCompletionTime = 0;

    const byStatus: Record<BookingStatus, number> = {
      created: 0,
      assigned: 0,
      confirmed: 0,
      in_progress: 0,
      completed: 0,
      payment_pending: 0,
      paid: 0,
      cancelled: 0,
    };

    this.bookingStates.forEach((booking) => {
      totalBookings++;
      byStatus[booking.currentStatus]++;

      if (booking.completedAt) {
        completedBookings++;
        const duration =
          booking.completedAt.getTime() - booking.createdAt.getTime();
        totalCompletionTime += duration;
      }
    });

    return {
      totalBookings,
      byStatus,
      averageCompletionTime:
        completedBookings > 0 ? totalCompletionTime / completedBookings / 60000 : 0, // in minutes
      completionRate:
        totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0,
    };
  }

  detectStuckBookings(thresholdMinutes: number = 30) {
    const now = new Date();
    const stuckBookings: string[] = [];

    this.bookingStates.forEach((booking) => {
      if (["created", "assigned", "confirmed"].includes(booking.currentStatus)) {
        const ageMinutes =
          (now.getTime() - booking.createdAt.getTime()) / 60000;
        if (ageMinutes > thresholdMinutes) {
          stuckBookings.push(booking.bookingId);
        }
      }
    });

    return stuckBookings;
  }

  getSuggestions(bookingId: string) {
    const booking = this.bookingStates.get(bookingId);
    if (!booking) return [];

    const suggestions: Array<{
      action: string;
      reason: string;
      urgency: "critical" | "high" | "medium" | "low";
    }> = [];

    const now = new Date();
    const ageMinutes = (now.getTime() - booking.createdAt.getTime()) / 60000;

    // Stuck booking detection
    if (booking.currentStatus === "created" && ageMinutes > 30) {
      suggestions.push({
        action: "assign_vehicle",
        reason: "Booking has been waiting 30+ minutes for vehicle assignment",
        urgency: "critical",
      });
    }

    if (booking.currentStatus === "assigned" && ageMinutes > 15) {
      suggestions.push({
        action: "confirm_booking",
        reason: "Driver needs to confirm booking (15+ min waiting)",
        urgency: "high",
      });
    }

    // Payment follow-up
    if (
      booking.currentStatus === "payment_pending" &&
      ageMinutes > 60 &&
      (!booking.paidAmount || booking.paidAmount === 0)
    ) {
      suggestions.push({
        action: "collect_payment",
        reason: "Payment pending for 60+ minutes",
        urgency: "high",
      });
    }

    // Missing review
    if (
      booking.currentStatus === "completed" &&
      ageMinutes > 120
    ) {
      suggestions.push({
        action: "request_review",
        reason: "Request customer review for this completed trip",
        urgency: "medium",
      });
    }

    return suggestions;
  }
}

export const bookingLifecycleManager = new BookingLifecycleManager();
