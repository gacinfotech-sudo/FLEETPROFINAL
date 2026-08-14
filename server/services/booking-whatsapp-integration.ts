import { whatsappService } from './whatsapp-service';
import TemplateValidator from './template-validator';

export interface BookingWhatsAppEvent {
  tenantId: string;
  bookingId: string;
  eventType: 'BOOKING_CONFIRMED' | 'DRIVER_ASSIGNED' | 'VEHICLE_ASSIGNED' | 'BOOKING_MODIFIED';
  booking: any;
  driver?: any;
  vehicle?: any;
  payment?: any;
  tenant?: any;
}

export class BookingWhatsAppIntegration {
  /**
   * Handle booking confirmation event - send WhatsApp messages
   */
  static async handleBookingConfirmed(event: BookingWhatsAppEvent): Promise<void> {
    try {
      const { tenantId, booking, driver, vehicle, payment, tenant } = event;

      if (!tenant || !tenant.isActive) {
        console.log(`Tenant ${tenantId} WhatsApp not configured. Skipping.`);
        return;
      }

      // 1. Send customer booking confirmation (English)
      if (tenant.features?.bookingConfirmation && tenant.customerSupportNumber) {
        await this.sendCustomerBookingConfirmation(tenantId, booking, driver, vehicle, payment, tenant);
      }

      // 2. Send driver assignment (if assigned)
      if (tenant.features?.driverAssignment && driver && tenant.driverSupportNumber) {
        await this.sendDriverAssignment(tenantId, booking, driver, vehicle, tenant);
      }

      // 3. Send owner alert
      if (tenant.features?.bookingAlert && tenant.ownerWhatsApp) {
        await this.sendOwnerAlert(tenantId, booking, driver, vehicle, payment, tenant);
      }
    } catch (error) {
      console.error('Error handling booking WhatsApp event:', error);
      // Do NOT fail booking creation if WhatsApp fails
    }
  }

  /**
   * Render template with booking data
   */
  static renderTemplate(templateBody: string, variables: Record<string, any>): string {
    let rendered = templateBody;

    // Replace all {{variable}} with actual values
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      } else {
        // Remove incomplete variables
        rendered = rendered.replace(new RegExp(`{{${key}}}\\n?`, 'g'), '');
      }
    });

    // Clean up extra newlines
    rendered = rendered.replace(/\n\n+/g, '\n\n').trim();
    return rendered;
  }

  /**
   * Send customer booking confirmation
   */
  static async sendCustomerBookingConfirmation(
    tenantId: string,
    booking: any,
    driver: any,
    vehicle: any,
    payment: any,
    tenant: any
  ): Promise<void> {
    const variables = {
      companyName: tenant.companyName,
      bookingId: booking.bookingId || booking._id,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      pickup: booking.pickupLocation,
      drop: booking.dropLocation,
      itinerary: booking.itinerary || `${booking.pickupLocation} → ${booking.dropLocation}`,
      pickupDate: booking.pickupDate ? new Date(booking.pickupDate).toLocaleDateString('en-IN') : 'TBD',
      pickupTime: booking.pickupTime || 'TBD',
      vehicleName: vehicle?.name || 'TBD',
      vehicleNumber: vehicle?.registrationNumber || 'TBD',
      driverName: driver?.name || 'TBD',
      driverPhone: driver?.phone || 'TBD',
      bookingAmount: payment?.totalAmount ? `₹${payment.totalAmount}` : 'TBD',
      amountReceived: payment?.advanceAmount ? `₹${payment.advanceAmount}` : '₹0',
      balanceDue: payment?.balanceAmount ? `₹${payment.balanceAmount}` : 'TBD',
      supportPhone: tenant.customerSupportNumber || tenant.bookingContactNumber,
    };

    // Fetch active customer booking confirmation template
    const templateBody = `Dear {{customerName}},

Your booking with {{companyName}} has been confirmed.

Booking ID: {{bookingId}}

Pickup:
{{pickup}}

Destination:
{{drop}}

Route: {{itinerary}}

Pickup Date: {{pickupDate}}
Pickup Time: {{pickupTime}}

Vehicle: {{vehicleName}}
Vehicle No: {{vehicleNumber}}

Driver: {{driverName}}
Contact: {{driverPhone}}

Booking Amount: {{bookingAmount}}
Amount Received: {{amountReceived}}
Balance Due: {{balanceDue}}

For assistance:
{{companyName}}
{{supportPhone}}

Thank you for choosing {{companyName}}.`;

    const rendered = this.renderTemplate(templateBody, variables);

    await whatsappService.queueMessage(
      {
        tenantId,
        bookingId: booking._id?.toString() || booking.id,
        recipientType: 'customer',
        recipientPhone: booking.customerPhone,
        recipientName: booking.customerName,
        messageType: 'booking_confirmation',
        templateType: 'customer_booking_en',
        variables,
      },
      `${tenantId}|${booking._id}|BOOKING_CONFIRMED_CUSTOMER`
    );
  }

  /**
   * Send driver assignment
   */
  static async sendDriverAssignment(
    tenantId: string,
    booking: any,
    driver: any,
    vehicle: any,
    tenant: any
  ): Promise<void> {
    const variables = {
      companyName: tenant.companyName,
      driverName: driver.name,
      bookingId: booking.bookingId || booking._id,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      pickup: booking.pickupLocation,
      itinerary: booking.itinerary || `${booking.pickupLocation} → ${booking.dropLocation}`,
      pickupDate: booking.pickupDate ? new Date(booking.pickupDate).toLocaleDateString('hi-IN') : 'TBD',
      pickupTime: booking.pickupTime || 'TBD',
      vehicleName: vehicle?.name || 'TBD',
      vehicleNumber: vehicle?.registrationNumber || 'TBD',
      bookingAmount: booking.totalAmount ? `₹${booking.totalAmount}` : 'TBD',
      amountReceived: booking.advanceAmount ? `₹${booking.advanceAmount}` : '₹0',
      driverCollectAmount: booking.balanceAmount ? `₹${booking.balanceAmount}` : 'TBD',
      supportPhone: tenant.driverSupportNumber || tenant.bookingContactNumber,
    };

    const templateBody = `नमस्ते {{driverName}} जी,

आपको नई बुकिंग असाइन की गई है।

Booking ID: {{bookingId}}

Customer: {{customerName}}
Mobile: {{customerPhone}}

Pickup: {{pickup}}
Route: {{itinerary}}

Pickup Date: {{pickupDate}}
Pickup Time: {{pickupTime}}

Vehicle: {{vehicleName}}
Number: {{vehicleNumber}}

Total Booking: {{bookingAmount}}
Advance Received: {{amountReceived}}
आपको लेना है: {{driverCollectAmount}}

कृपया समय पर पहुँचें।

Support: {{supportPhone}}`;

    const rendered = this.renderTemplate(templateBody, variables);

    await whatsappService.queueMessage(
      {
        tenantId,
        bookingId: booking._id?.toString() || booking.id,
        recipientType: 'driver',
        recipientPhone: driver.phone,
        recipientName: driver.name,
        messageType: 'driver_assignment',
        templateType: 'driver_assignment_hi',
        variables,
      },
      `${tenantId}|${booking._id}|DRIVER_ASSIGNED`
    );
  }

  /**
   * Send owner alert
   */
  static async sendOwnerAlert(
    tenantId: string,
    booking: any,
    driver: any,
    vehicle: any,
    payment: any,
    tenant: any
  ): Promise<void> {
    const variables = {
      companyName: tenant.companyName,
      bookingId: booking.bookingId || booking._id,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      driverName: driver?.name || 'Not Assigned',
      driverPhone: driver?.phone || 'N/A',
      vehicleName: vehicle?.name || 'Not Assigned',
      vehicleNumber: vehicle?.registrationNumber || 'N/A',
      pickup: booking.pickupLocation,
      drop: booking.dropLocation,
      itinerary: booking.itinerary || `${booking.pickupLocation} → ${booking.dropLocation}`,
      bookingAmount: payment?.totalAmount ? `₹${payment.totalAmount}` : 'TBD',
      amountReceived: payment?.advanceAmount ? `₹${payment.advanceAmount}` : '₹0',
      balanceDue: payment?.balanceAmount ? `₹${payment.balanceAmount}` : 'TBD',
      status: booking.status || 'CONFIRMED',
    };

    const templateBody = `✅ NEW BOOKING CONFIRMED

Booking ID: {{bookingId}}

Customer: {{customerName}}
Phone: {{customerPhone}}

Driver: {{driverName}}
Phone: {{driverPhone}}

Vehicle: {{vehicleName}}
Number: {{vehicleNumber}}

Route: {{itinerary}}
Pickup: {{pickup}}
Drop: {{drop}}

Booking Value: {{bookingAmount}}
Received: {{amountReceived}}
Due: {{balanceDue}}

Status: {{status}}`;

    const rendered = this.renderTemplate(templateBody, variables);

    await whatsappService.queueMessage(
      {
        tenantId,
        bookingId: booking._id?.toString() || booking.id,
        recipientType: 'owner',
        recipientPhone: tenant.ownerWhatsApp,
        recipientName: tenant.ownerName,
        messageType: 'owner_alert',
        templateType: 'owner_booking_alert',
        variables,
      },
      `${tenantId}|${booking._id}|OWNER_ALERT`
    );
  }
}

export default BookingWhatsAppIntegration;
