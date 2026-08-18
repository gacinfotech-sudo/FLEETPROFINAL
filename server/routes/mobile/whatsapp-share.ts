import express from "express";
import axios from "axios";
import { Booking, Customer } from "../models";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

interface WhatsAppMessage {
  to: string;
  body: string;
  mediaUrl?: string;
}

// WhatsApp message templates
const templates = {
  bookingConfirmation: (booking: any, customer: any) => `
🎉 *Booking Confirmed!*

*Booking ID:* ${booking._id}
*Date:* ${new Date(booking.bookingTime).toLocaleDateString()}
*Time:* ${new Date(booking.bookingTime).toLocaleTimeString()}

📍 *Pickup:* ${booking.pickupLocation}
📍 *Dropoff:* ${booking.dropoffLocation}

🚗 *Vehicle:* ${booking.vehicleType}
💰 *Est. Fare:* ₹${booking.estimatedFare}

Thank you for booking with us!
  `,

  driverAssigned: (booking: any, driver: any) => `
✅ *Driver Assigned!*

*Driver:* ${driver.name}
*Vehicle:* ${driver.vehicleType} (${driver.licensePlate})
*Rating:* ⭐ ${driver.rating}/5

📞 *Call Driver:* ${driver.phone}

Your driver will arrive shortly!
  `,

  tripStarted: (booking: any, driver: any, eta: number) => `
🚗 *Trip Started!*

*Driver:* ${driver.name}
*Location:* ${booking.pickupLocation}
⏱️ *ETA:* ${eta} minutes

Track your trip in app for live updates.
  `,

  tripCompleted: (booking: any, finalFare: number, distance: number) => `
✅ *Trip Completed!*

🎯 *Pickup:* ${booking.pickupLocation}
📍 *Dropoff:* ${booking.dropoffLocation}

📏 *Distance:* ${distance} km
⏱️ *Duration:* ${booking.duration} min
💰 *Total Fare:* ₹${finalFare}

Thank you for riding with us! Rate your driver in the app.
  `,

  paymentReceived: (booking: any, payment: any) => `
💳 *Payment Received!*

*Amount:* ₹${payment.amount}
*Method:* ${payment.method}
*Receipt ID:* ${payment.receiptId}

Your trip is now complete. Thank you!
  `,

  itinerary: (booking: any) => `
📋 *Trip Itinerary*

*Pickup:* ${booking.pickupLocation}
*Dropoff:* ${booking.dropoffLocation}

*Est. Distance:* 12 km
*Est. Duration:* 25 min
*Est. Fare:* ₹${booking.estimatedFare}

Confirm booking in app to get driver assignment.
  `,
};

// POST /mobile/v1/whatsapp/share-booking
router.post(
  "/share-booking",
  authenticateUser,
  requireTenant,
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { bookingId, shareType } = req.body; // shareType: confirmation, itinerary, etc

      if (!bookingId || !shareType) {
        return res.status(400).json({
          success: false,
          error: "Booking ID and share type required",
        });
      }

      const booking = await Booking.findOne({ _id: bookingId, tenantId });
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: "Booking not found",
        });
      }

      const customer = await Customer.findOne({ _id: booking.customerId, tenantId });
      if (!customer) {
        return res.status(400).json({
          success: false,
          error: "Customer not found",
        });
      }

      // Generate message based on type
      let message = "";
      switch (shareType) {
        case "confirmation":
          message = templates.bookingConfirmation(booking, customer);
          break;
        case "itinerary":
          message = templates.itinerary(booking);
          break;
        default:
          message = templates.bookingConfirmation(booking, customer);
      }

      // Get WhatsApp number (with country code)
      const whatsappNumber = customer.phoneNumbers?.[0] || customer.phone;

      // Send via WhatsApp API (mock implementation)
      await sendWhatsAppMessage({
        to: whatsappNumber,
        body: message,
      });

      res.json({
        success: true,
        data: {
          messageSent: true,
          recipientNumber: whatsappNumber,
          messageType: shareType,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error("Failed to send WhatsApp booking share:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to send WhatsApp message",
      });
    }
  }
);

// POST /mobile/v1/whatsapp/share-driver-details
router.post(
  "/share-driver-details",
  authenticateUser,
  requireTenant,
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { bookingId, driverId } = req.body;

      if (!bookingId || !driverId) {
        return res.status(400).json({
          success: false,
          error: "Booking ID and driver ID required",
        });
      }

      const booking = await Booking.findOne({ _id: bookingId, tenantId });
      const driver = await (global as any).Driver.findOne({
        _id: driverId,
        tenantId,
      });
      const customer = await Customer.findOne({ _id: booking.customerId, tenantId });

      if (!booking || !driver || !customer) {
        return res.status(404).json({
          success: false,
          error: "Booking, driver, or customer not found",
        });
      }

      const message = templates.driverAssigned(booking, driver);
      const whatsappNumber = customer.phoneNumbers?.[0] || customer.phone;

      await sendWhatsAppMessage({
        to: whatsappNumber,
        body: message,
      });

      res.json({
        success: true,
        data: {
          messageSent: true,
          driverName: driver.name,
          driverPhone: driver.phone,
        },
      });
    } catch (error: any) {
      console.error("Failed to send driver details:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to send driver details",
      });
    }
  }
);

// POST /mobile/v1/whatsapp/share-payment-receipt
router.post(
  "/share-payment-receipt",
  authenticateUser,
  requireTenant,
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { bookingId, paymentId } = req.body;

      if (!bookingId || !paymentId) {
        return res.status(400).json({
          success: false,
          error: "Booking ID and payment ID required",
        });
      }

      const booking = await Booking.findOne({ _id: bookingId, tenantId });
      const payment = await (global as any).Payment.findOne({
        _id: paymentId,
        tenantId,
      });
      const customer = await Customer.findOne({ _id: booking.customerId, tenantId });

      if (!booking || !payment || !customer) {
        return res.status(404).json({
          success: false,
          error: "Booking, payment, or customer not found",
        });
      }

      const message = templates.paymentReceived(booking, payment);
      const whatsappNumber = customer.phoneNumbers?.[0] || customer.phone;

      await sendWhatsAppMessage({
        to: whatsappNumber,
        body: message,
      });

      res.json({
        success: true,
        data: {
          messageSent: true,
          amount: payment.amount,
          paymentMethod: payment.method,
        },
      });
    } catch (error: any) {
      console.error("Failed to send payment receipt:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to send payment receipt",
      });
    }
  }
);

// Mock WhatsApp API integration (use actual API like Twilio, MessageBird, etc)
async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
  try {
    // This is a placeholder - integrate with actual WhatsApp API
    // Example using Twilio:
    // const response = await axios.post(
    //   `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    //   {
    //     From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
    //     To: `whatsapp:${message.to}`,
    //     Body: message.body,
    //   },
    //   {
    //     auth: {
    //       username: TWILIO_ACCOUNT_SID,
    //       password: TWILIO_AUTH_TOKEN,
    //     },
    //   }
    // );

    console.log(`[WhatsApp] Message sent to ${message.to}`);
  } catch (error: any) {
    console.error("WhatsApp API error:", error);
    throw error;
  }
}

export default router;
