import { nanoid } from 'nanoid';

export interface WhatsAppMessage {
  tenantId: string;
  bookingId?: string;
  recipientType: 'customer' | 'driver' | 'owner' | 'finance' | 'operations';
  recipientPhone: string;
  recipientName?: string;
  messageType: string;
  templateType: string;
  variables: Record<string, any>;
}

export interface IdempotencyKey {
  tenantId: string;
  bookingId?: string;
  eventType: string;
  eventVersion?: string;
}

export class WhatsAppService {
  private messageQueue: WhatsAppMessage[] = [];
  private idempotencyMap: Map<string, boolean> = new Map();

  /**
   * Generate idempotency key to prevent duplicate messages
   */
  generateIdempotencyKey(key: IdempotencyKey): string {
    const parts = [key.tenantId, key.bookingId || '', key.eventType, key.eventVersion || '1'];
    return parts.filter(Boolean).join('|');
  }

  /**
   * Check if message was already sent using idempotency
   */
  async isMessageAlreadySent(idempotencyKey: string, tenantId: string): Promise<boolean> {
    // In-memory check for this session
    if (this.idempotencyMap.has(idempotencyKey)) {
      return true;
    }
    // TODO: Check database for historical messages
    return false;
  }

  /**
   * Queue a WhatsApp message for sending
   */
  async queueMessage(message: WhatsAppMessage, idempotencyKey: string): Promise<string> {
    // Check if already sent
    const alreadySent = await this.isMessageAlreadySent(idempotencyKey, message.tenantId);
    if (alreadySent) {
      return idempotencyKey; // Return existing key without queuing
    }

    // Mark as being processed
    this.idempotencyMap.set(idempotencyKey, true);

    // Add to queue
    const messageId = nanoid();
    this.messageQueue.push({
      ...message,
      bookingId: message.bookingId || undefined,
    });

    return messageId;
  }

  /**
   * Send customer booking confirmation message (English)
   */
  async sendCustomerBookingConfirmation(tenantId: string, booking: any, tenant: any): Promise<string> {
    const idempotencyKey = this.generateIdempotencyKey({
      tenantId,
      bookingId: booking._id?.toString(),
      eventType: 'BOOKING_CONFIRMED',
      eventVersion: '1',
    });

    const message: WhatsAppMessage = {
      tenantId,
      bookingId: booking._id?.toString(),
      recipientType: 'customer',
      recipientPhone: booking.customerPhone,
      recipientName: booking.customerName,
      messageType: 'booking_confirmation',
      templateType: 'customer_booking_en',
      variables: {
        companyName: tenant.companyName,
        bookingId: booking.bookingId,
        customerName: booking.customerName,
        pickup: booking.pickupLocation,
        drop: booking.dropLocation,
        itinerary: booking.itinerary,
        pickupDate: booking.pickupDate,
        pickupTime: booking.pickupTime,
        vehicleName: booking.vehicle?.name || 'TBD',
        vehicleNumber: booking.vehicle?.registrationNumber || 'TBD',
        driverName: booking.driver?.name || 'TBD',
        driverPhone: booking.driver?.phone || 'TBD',
        bookingAmount: booking.totalAmount,
        amountReceived: booking.advanceAmount,
        balanceDue: booking.balanceAmount,
        supportPhone: tenant.customerSupportNumber,
        companyPhone: tenant.bookingContactNumber,
      },
    };

    return this.queueMessage(message, idempotencyKey);
  }

  /**
   * Send driver assignment message (Hindi)
   */
  async sendDriverAssignmentMessage(tenantId: string, booking: any, driver: any, tenant: any): Promise<string> {
    const idempotencyKey = this.generateIdempotencyKey({
      tenantId,
      bookingId: booking._id?.toString(),
      eventType: 'DRIVER_ASSIGNED',
      eventVersion: '1',
    });

    const message: WhatsAppMessage = {
      tenantId,
      bookingId: booking._id?.toString(),
      recipientType: 'driver',
      recipientPhone: driver.phone,
      recipientName: driver.name,
      messageType: 'driver_assignment',
      templateType: 'driver_assignment_hi',
      variables: {
        companyName: tenant.companyName,
        driverName: driver.name,
        bookingId: booking.bookingId,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        pickup: booking.pickupLocation,
        itinerary: booking.itinerary,
        pickupDate: booking.pickupDate,
        pickupTime: booking.pickupTime,
        vehicleName: booking.vehicle?.name,
        vehicleNumber: booking.vehicle?.registrationNumber,
        bookingAmount: booking.totalAmount,
        amountReceived: booking.advanceAmount,
        driverCollectAmount: booking.balanceAmount,
        supportPhone: tenant.driverSupportNumber,
      },
    };

    return this.queueMessage(message, idempotencyKey);
  }

  /**
   * Send owner booking alert
   */
  async sendOwnerBookingAlert(tenantId: string, booking: any, tenant: any): Promise<string> {
    const idempotencyKey = this.generateIdempotencyKey({
      tenantId,
      bookingId: booking._id?.toString(),
      eventType: 'OWNER_BOOKING_ALERT',
      eventVersion: '1',
    });

    const message: WhatsAppMessage = {
      tenantId,
      bookingId: booking._id?.toString(),
      recipientType: 'owner',
      recipientPhone: tenant.ownerWhatsApp,
      recipientName: tenant.ownerName,
      messageType: 'owner_alert',
      templateType: 'owner_booking_alert',
      variables: {
        companyName: tenant.companyName,
        bookingId: booking.bookingId,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        driverName: booking.driver?.name || 'Not Assigned',
        driverPhone: booking.driver?.phone || 'N/A',
        vehicleName: booking.vehicle?.name || 'Not Assigned',
        vehicleNumber: booking.vehicle?.registrationNumber || 'N/A',
        pickup: booking.pickupLocation,
        drop: booking.dropLocation,
        itinerary: booking.itinerary,
        bookingAmount: booking.totalAmount,
        amountReceived: booking.advanceAmount,
        balanceDue: booking.balanceAmount,
        status: booking.status,
      },
    };

    return this.queueMessage(message, idempotencyKey);
  }

  /**
   * Send payment receipt message
   */
  async sendPaymentReceiptMessage(tenantId: string, booking: any, payment: any, tenant: any): Promise<string> {
    const idempotencyKey = this.generateIdempotencyKey({
      tenantId,
      bookingId: booking._id?.toString(),
      eventType: 'PAYMENT_RECEIVED',
      eventVersion: payment.transactionId,
    });

    const message: WhatsAppMessage = {
      tenantId,
      bookingId: booking._id?.toString(),
      recipientType: 'customer',
      recipientPhone: booking.customerPhone,
      recipientName: booking.customerName,
      messageType: 'payment_receipt',
      templateType: 'payment_receipt_en',
      variables: {
        companyName: tenant.companyName,
        bookingId: booking.bookingId,
        amountReceived: payment.amount,
        totalReceived: booking.totalReceived,
        balanceDue: booking.balanceAmount,
        transactionId: payment.transactionId,
      },
    };

    return this.queueMessage(message, idempotencyKey);
  }

  /**
   * Get queued messages
   */
  getQueuedMessages(): WhatsAppMessage[] {
    return this.messageQueue;
  }

  /**
   * Clear queue (after successful send)
   */
  clearQueue(): void {
    this.messageQueue = [];
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }
}

export const whatsappService = new WhatsAppService();
