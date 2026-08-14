export const DEFAULT_TEMPLATES = [
  // Customer Templates - English
  {
    templateType: 'customer',
    messageType: 'booking_confirmation',
    name: 'Booking Confirmation',
    language: 'en',
    body: `Dear {{customerName}},

Your booking with {{companyName}} has been confirmed.

Booking ID: {{bookingId}}

Pickup:
{{pickup}}

Destination:
{{drop}}

Route:
{{itinerary}}

Pickup Date: {{pickupDate}}
Pickup Time: {{pickupTime}}

Vehicle: {{vehicleName}}
Vehicle Number: {{vehicleNumber}}

Driver: {{driverName}}
Driver Contact: {{driverPhone}}

Booking Amount: {{bookingAmount}}
Amount Received: {{amountReceived}}
Balance Payable: {{balanceDue}}

For assistance:
{{companyName}}
{{supportPhone}}

Thank you for choosing {{companyName}}.`,
    isCustom: false,
  },

  {
    templateType: 'customer',
    messageType: 'payment_receipt',
    name: 'Payment Receipt',
    language: 'en',
    body: `Payment Received

Booking ID: {{bookingId}}

Amount Received: {{amountReceived}}
Total Received: {{balanceDue}}
Remaining Balance: ₹0

Thank you.
{{companyName}}`,
    isCustom: false,
  },

  {
    templateType: 'customer',
    messageType: 'trip_completion',
    name: 'Trip Completed',
    language: 'en',
    body: `Dear {{customerName}},

Your trip has been completed.

Booking ID: {{bookingId}}
Driver: {{driverName}}
Vehicle: {{vehicleName}}

Thank you for travelling with {{companyName}}.

Share feedback: [link]`,
    isCustom: false,
  },

  // Driver Templates - Hindi
  {
    templateType: 'driver',
    messageType: 'booking_assignment',
    name: 'नई बुकिंग असाइनमेंट',
    language: 'hi',
    body: `नमस्ते {{driverName}} जी,

आपको नई बुकिंग असाइन की गई है।

Booking ID: {{bookingId}}

Customer: {{customerName}}
Mobile: {{driverPhone}}

Pickup: {{pickup}}
Route: {{itinerary}}

Pickup Date: {{pickupDate}}
Pickup Time: {{pickupTime}}

Vehicle: {{vehicleName}}
Number: {{vehicleNumber}}

Customer से लेना है: {{driverCollectAmount}}
Total Booking: {{bookingAmount}}
पहले से प्राप्त: {{amountReceived}}

कृपया समय पर पहुँचें।

Support: {{supportPhone}}`,
    isCustom: false,
  },

  {
    templateType: 'driver',
    messageType: 'trip_started',
    name: 'Trip शुरू हुई',
    language: 'hi',
    body: `Trip शुरू हो गई है।

Booking: {{bookingId}}
Customer: {{customerName}}
Route: {{itinerary}}

Safe driving!`,
    isCustom: false,
  },

  // Owner Templates
  {
    templateType: 'owner',
    messageType: 'booking_alert',
    name: 'Booking Alert',
    language: 'en',
    body: `✅ NEW BOOKING

Booking ID: {{bookingId}}

Customer: {{customerName}}
Phone: {{customerPhone}}

Driver: {{driverName}}
Vehicle: {{vehicleName}}

Route: {{itinerary}}
Date: {{pickupDate}}

Booking: {{bookingAmount}}
Received: {{amountReceived}}
Due: {{balanceDue}}`,
    isCustom: false,
  },

  {
    templateType: 'daily_summary',
    messageType: 'owner_summary',
    name: 'Daily Owner Summary',
    language: 'hinglish',
    subject: 'Daily Closing Summary',
    body: `📊 {{companyName}}
DAILY BUSINESS SUMMARY

Date: {{summaryDate}}

━━━━━━━━━━━━━━━━
BOOKINGS
━━━━━━━━━━━━━━━━

Total Today: {{totalBookings}}
Completed: {{completedBookings}}
Pending: {{pendingBookings}}

Booking Value: {{totalBookingValue}}

━━━━━━━━━━━━━━━━
COLLECTION
━━━━━━━━━━━━━━━━

Received: {{totalReceived}}
Outstanding: {{outstanding}}
Driver Held: {{driverHeld}}

━━━━━━━━━━━━━━━━
FLEET
━━━━━━━━━━━━━━━━

Active Vehicles: {{activeVehicles}}
On Booking: {{vehiclesOnBooking}}
Available: {{availableVehicles}}

Utilization: {{utilization}}%

━━━━━━━━━━━━━━━━

{{companyName}} Daily Closing`,
    isCustom: false,
  },

  // Finance Templates
  {
    templateType: 'finance',
    messageType: 'payment_received',
    name: 'Payment Received Alert',
    language: 'en',
    body: `Payment Received

Booking: {{bookingId}}
Customer: {{customerName}}
Amount: {{amountReceived}}

Total Received: {{totalReceived}}
Outstanding: {{balanceDue}}`,
    isCustom: false,
  },

  {
    templateType: 'finance',
    messageType: 'outstanding_alert',
    name: 'Outstanding Payment Alert',
    language: 'en',
    body: `Outstanding Payment Alert

Booking: {{bookingId}}
Customer: {{customerName}}

Outstanding: {{balanceDue}}

Please follow up for collection.`,
    isCustom: false,
  },
];

export async function initializeDefaultTemplates(tenantId: string, storage: any): Promise<void> {
  try {
    const db = storage.client?.db("fleetpro");
    const collection = db?.collection("whatsappTemplates");

    for (const template of DEFAULT_TEMPLATES) {
      const exists = await collection?.findOne({
        tenantId,
        templateType: template.templateType,
        messageType: template.messageType,
        language: template.language,
      });

      if (!exists) {
        await collection?.insertOne({
          ...template,
          tenantId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error('Failed to initialize default templates:', error);
  }
}
