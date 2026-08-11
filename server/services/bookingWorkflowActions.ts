import { bookingLifecycleManager } from "./bookingLifecycleManager";
import { notificationEngine } from "./smartNotificationEngine";
import { sendNotificationToUser } from "./websocketNotificationService";

interface ActionContext {
  bookingId: string;
  tenantId: string;
  customerId?: string;
  driverId?: string;
  vehicleId?: string;
  metadata?: Record<string, any>;
}

class BookingWorkflowActions {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for auto-action events from lifecycle manager
    bookingLifecycleManager.on("booking:auto_action", async (event) => {
      const { bookingId, action, metadata } = event;
      console.log(`⚡ Auto-action triggered: ${action} for booking ${bookingId}`);

      // Execute the action
      await this.executeAction(bookingId, action, metadata);
    });

    // Listen for status transitions
    bookingLifecycleManager.on("booking:assigned", async (data) => {
      await this.onBookingAssigned(data);
    });

    bookingLifecycleManager.on("booking:confirmed", async (data) => {
      await this.onBookingConfirmed(data);
    });

    bookingLifecycleManager.on("booking:in_progress", async (data) => {
      await this.onBookingStarted(data);
    });

    bookingLifecycleManager.on("booking:completed", async (data) => {
      await this.onBookingCompleted(data);
    });

    bookingLifecycleManager.on("booking:paid", async (data) => {
      await this.onPaymentReceived(data);
    });
  }

  private async executeAction(
    bookingId: string,
    action: string,
    metadata?: Record<string, any>
  ) {
    switch (action) {
      case "assign_vehicle":
        await this.assignVehicle(bookingId, metadata);
        break;
      case "confirm_booking":
        await this.confirmBooking(bookingId, metadata);
        break;
      case "start_trip":
        await this.startTrip(bookingId, metadata);
        break;
      case "complete_trip":
        await this.completeTrip(bookingId, metadata);
        break;
      case "collect_payment":
        await this.collectPayment(bookingId, metadata);
        break;
      case "send_invoice":
        await this.sendInvoice(bookingId, metadata);
        break;
      case "request_review":
        await this.requestReview(bookingId, metadata);
        break;
      case "cancel_booking":
        await this.cancelBooking(bookingId, metadata);
        break;
    }
  }

  private async assignVehicle(bookingId: string, metadata?: Record<string, any>) {
    console.log(`🚗 Assigning vehicle to booking ${bookingId}`);

    try {
      // In real implementation, this would:
      // 1. Find available vehicle matching criteria
      // 2. Reserve vehicle for booking
      // 3. Notify driver
      // 4. Update booking status

      const booking = bookingLifecycleManager.getBooking(bookingId);
      if (!booking) return;

      // Simulate assignment
      booking.assignedVehicleId = metadata?.vehicleId || "v1";
      booking.assignedDriverId = metadata?.driverId || "d1";

      // Notify driver
      await this.notifyDriver(
        booking.assignedDriverId,
        "Vehicle Assigned",
        `New booking assigned to you. Pickup: ${metadata?.pickupLocation}`,
        bookingId
      );

      // Notify tenant
      await this.notifyTenant(
        booking.bookingId,
        "Vehicle Assigned",
        `Vehicle assigned: ${metadata?.vehicleNumber}. Driver: ${metadata?.driverName}`
      );
    } catch (error) {
      console.error("Error assigning vehicle:", error);
    }
  }

  private async confirmBooking(bookingId: string, metadata?: Record<string, any>) {
    console.log(`✓ Confirming booking ${bookingId}`);

    try {
      const booking = bookingLifecycleManager.getBooking(bookingId);
      if (!booking) return;

      // Send confirmation to customer
      await this.notifyCustomer(
        bookingId,
        "Booking Confirmed",
        `Your booking is confirmed. Driver ${metadata?.driverName} will pick you up at ${metadata?.pickupTime}`
      );

      // Send details to driver
      await this.notifyDriver(
        booking.assignedDriverId,
        "Confirm Acceptance",
        "Please confirm you can complete this trip",
        bookingId
      );
    } catch (error) {
      console.error("Error confirming booking:", error);
    }
  }

  private async startTrip(bookingId: string, metadata?: Record<string, any>) {
    console.log(`▶️ Starting trip for booking ${bookingId}`);

    try {
      const booking = bookingLifecycleManager.getBooking(bookingId);
      if (!booking) return;

      // Update actual pickup time
      booking.actualPickupTime = new Date();

      // Notify customer that trip started
      await this.notifyCustomer(
        bookingId,
        "Trip Started",
        "Your driver has started the trip. You can track in real-time."
      );

      // Send customer location to driver
      // (In real implementation, integrate with GPS/maps API)
    } catch (error) {
      console.error("Error starting trip:", error);
    }
  }

  private async completeTrip(bookingId: string, metadata?: Record<string, any>) {
    console.log(`✅ Completing trip for booking ${bookingId}`);

    try {
      const booking = bookingLifecycleManager.getBooking(bookingId);
      if (!booking) return;

      // Update actual dropoff time
      booking.actualDropoffTime = new Date();

      // Calculate trip duration and distance
      const duration = booking.actualDropoffTime.getTime() - (booking.actualPickupTime?.getTime() || 0);
      const durationMinutes = Math.round(duration / 60000);

      // Notify customer
      await this.notifyCustomer(
        bookingId,
        "Trip Completed",
        `Trip completed in ${durationMinutes} minutes. Thank you for booking with us!`
      );

      // Notify tenant
      await this.notifyTenant(
        bookingId,
        "Trip Completed",
        `Trip completed. Total distance: ${metadata?.distance}km, Time: ${durationMinutes}min`
      );
    } catch (error) {
      console.error("Error completing trip:", error);
    }
  }

  private async collectPayment(bookingId: string, metadata?: Record<string, any>) {
    console.log(`💰 Collecting payment for booking ${bookingId}`);

    try {
      const booking = bookingLifecycleManager.getBooking(bookingId);
      if (!booking) return;

      // Send payment request to customer
      await this.notifyCustomer(
        bookingId,
        "Payment Due",
        `Please pay ₹${booking.totalAmount} for your trip. Use UPI, Card, or Cash.`,
        {
          actionUrl: `/payments/${bookingId}`,
          actionLabel: "Pay Now",
        }
      );

      // Send payment reminder to tenant
      await this.notifyTenant(
        bookingId,
        "Payment Pending",
        `Waiting for payment of ₹${booking.totalAmount}`
      );
    } catch (error) {
      console.error("Error collecting payment:", error);
    }
  }

  private async sendInvoice(bookingId: string, metadata?: Record<string, any>) {
    console.log(`📄 Sending invoice for booking ${bookingId}`);

    try {
      const booking = bookingLifecycleManager.getBooking(bookingId);
      if (!booking) return;

      // Generate and send invoice
      // (In real implementation, generate PDF and email)

      await this.notifyCustomer(
        bookingId,
        "Invoice Sent",
        `Invoice for ₹${booking.totalAmount} has been sent to your email. Click to download.`,
        {
          actionUrl: `/invoices/${bookingId}`,
          actionLabel: "View Invoice",
        }
      );
    } catch (error) {
      console.error("Error sending invoice:", error);
    }
  }

  private async requestReview(bookingId: string, metadata?: Record<string, any>) {
    console.log(`⭐ Requesting review for booking ${bookingId}`);

    try {
      const booking = bookingLifecycleManager.getBooking(bookingId);
      if (!booking) return;

      // Send review request to customer
      await this.notifyCustomer(
        bookingId,
        "Share Your Feedback",
        "How was your trip experience? Your feedback helps us improve.",
        {
          actionUrl: `/reviews/${bookingId}`,
          actionLabel: "Rate & Review",
        }
      );
    } catch (error) {
      console.error("Error requesting review:", error);
    }
  }

  private async cancelBooking(bookingId: string, metadata?: Record<string, any>) {
    console.log(`❌ Cancelling booking ${bookingId}`);

    try {
      const booking = bookingLifecycleManager.getBooking(bookingId);
      if (!booking) return;

      const reason = metadata?.reason || "Customer requested cancellation";

      // Notify customer
      await this.notifyCustomer(
        bookingId,
        "Booking Cancelled",
        `Your booking has been cancelled. Reason: ${reason}`
      );

      // Notify driver if already assigned
      if (booking.assignedDriverId) {
        await this.notifyDriver(
          booking.assignedDriverId,
          "Booking Cancelled",
          "The booking has been cancelled. Please release the vehicle.",
          bookingId
        );
      }

      // Notify tenant
      await this.notifyTenant(
        bookingId,
        "Booking Cancelled",
        `Booking cancelled. Reason: ${reason}`
      );

      // Process refund if needed
      if (booking.paidAmount && booking.paidAmount > 0) {
        await this.processRefund(bookingId, booking.paidAmount, metadata?.refundReason);
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
    }
  }

  private async processRefund(
    bookingId: string,
    amount: number,
    reason?: string
  ) {
    console.log(`↩️ Processing refund of ₹${amount} for booking ${bookingId}`);

    try {
      // In real implementation:
      // 1. Initiate refund via payment gateway
      // 2. Update booking with refund details
      // 3. Send refund confirmation

      await this.notifyCustomer(
        bookingId,
        "Refund Processed",
        `Refund of ₹${amount} has been initiated. It will reach your account in 1-2 business days.`
      );
    } catch (error) {
      console.error("Error processing refund:", error);
    }
  }

  private async onBookingAssigned(data: any) {
    const { booking } = data;
    console.log(`📍 Booking ${booking.bookingId} assigned`);

    // Any post-assignment logic
    // E.g., update analytics, trigger marketing emails
  }

  private async onBookingConfirmed(data: any) {
    const { booking } = data;
    console.log(`✅ Booking ${booking.bookingId} confirmed`);

    // Any post-confirmation logic
  }

  private async onBookingStarted(data: any) {
    const { booking } = data;
    console.log(`🚗 Booking ${booking.bookingId} started`);

    // Start real-time tracking
    // Update customer location map
  }

  private async onBookingCompleted(data: any) {
    const { booking } = data;
    console.log(`🎉 Booking ${booking.bookingId} completed`);

    // Update customer lifetime value
    // Trigger loyalty program
    // Generate performance metrics
  }

  private async onPaymentReceived(data: any) {
    const { booking } = data;
    console.log(`💳 Payment received for booking ${booking.bookingId}`);

    // Close the booking
    // Send thank you email
    // Update financial reports
  }

  private async notifyCustomer(
    bookingId: string,
    title: string,
    message: string,
    action?: { actionUrl: string; actionLabel: string }
  ) {
    // Send notification via SMS/Email/App
    console.log(`📱 Customer notification: ${title} - ${message}`);
  }

  private async notifyDriver(
    driverId: string,
    title: string,
    message: string,
    bookingId?: string
  ) {
    // Send notification to driver via app/SMS
    console.log(`👨‍✈️ Driver notification: ${title} - ${message}`);
  }

  private async notifyTenant(
    bookingId: string,
    title: string,
    message: string
  ) {
    // Send notification to tenant via WebSocket
    console.log(`📢 Tenant notification: ${title} - ${message}`);
  }
}

export const bookingWorkflowActions = new BookingWorkflowActions();
