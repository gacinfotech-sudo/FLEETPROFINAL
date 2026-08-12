import express from "express";
import { PhoneNormalizer } from "../services/PhoneNormalizer";
import { Customer, CallLog } from "../models";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();
const phoneNormalizer = new PhoneNormalizer();

interface CallContext {
  phoneNumber: string;
  customerName?: string;
  customerId?: string;
  bookingCount?: number;
  lastBookingId?: string;
  callStartTime: Date;
  callEndTime?: Date;
  callDuration?: number;
  outcome: "ANSWERED" | "MISSED" | "REJECTED" | "CANCELLED";
}

// POST /mobile/v1/call-started - Track incoming call
router.post("/call-started", authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { tenantId } = req.tenant;
    const { incomingNumber, callStartTime } = req.body;

    if (!incomingNumber) {
      return res.status(400).json({
        success: false,
        error: "Incoming number required",
      });
    }

    const normalizedPhone = phoneNormalizer.normalize(incomingNumber);

    // Quick lookup existing customer
    const customer = await Customer.findOne({
      tenantId,
      phoneNumbers: normalizedPhone,
    });

    // Log call
    await CallLog.create({
      tenantId,
      customerId: customer?._id || null,
      customerPhone: normalizedPhone,
      customerName: customer?.name || "Unknown",
      callStartTime: new Date(callStartTime || Date.now()),
      outcome: "STARTED",
      metadata: {
        isKnownCustomer: !!customer,
        bookingCount: customer?.bookingCount || 0,
      },
    });

    res.json({
      success: true,
      data: {
        isKnownCustomer: !!customer,
        customerName: customer?.name || null,
        customerId: customer?._id || null,
        bookingCount: customer?.bookingCount || 0,
        lastBookingDate: customer?.lastBookingDate || null,
      },
    });
  } catch (error: any) {
    console.error("Error tracking call start:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to track call",
    });
  }
});

// POST /mobile/v1/call-ended - Track call completion
router.post("/call-ended", authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { tenantId } = req.tenant;
    const { incomingNumber, callStartTime, callEndTime, outcome } = req.body;

    if (!incomingNumber || !outcome) {
      return res.status(400).json({
        success: false,
        error: "Incoming number and outcome required",
      });
    }

    const normalizedPhone = phoneNormalizer.normalize(incomingNumber);
    const callDuration = callEndTime - callStartTime; // milliseconds

    // Find and update call log
    const callLog = await CallLog.findOneAndUpdate(
      {
        tenantId,
        customerPhone: normalizedPhone,
        callStartTime: new Date(callStartTime),
      },
      {
        callEndTime: new Date(callEndTime || Date.now()),
        callDuration,
        outcome,
      },
      { new: true }
    );

    // Update customer metrics
    if (callLog?.customerId) {
      await Customer.updateOne(
        { _id: callLog.customerId },
        {
          $inc: {
            incomingCallCount: 1,
            totalCallTime: callDuration,
          },
          $set: {
            lastCallDate: new Date(),
          },
        }
      );
    }

    res.json({
      success: true,
      data: {
        callId: callLog?._id,
        callDuration: Math.round(callDuration / 1000), // Convert to seconds
        outcome,
      },
    });
  } catch (error: any) {
    console.error("Error tracking call end:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to track call",
    });
  }
});

// GET /mobile/v1/call-history/:phoneNumber - Get call history for a customer
router.get(
  "/call-history/:phoneNumber",
  authenticateUser,
  requireTenant,
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { phoneNumber } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const normalizedPhone = phoneNormalizer.normalize(phoneNumber);

      const callLogs = await CallLog.find({
        tenantId,
        customerPhone: normalizedPhone,
      })
        .sort({ callStartTime: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset));

      const totalCount = await CallLog.countDocuments({
        tenantId,
        customerPhone: normalizedPhone,
      });

      res.json({
        success: true,
        data: {
          calls: callLogs.map((log: any) => ({
            id: log._id,
            date: log.callStartTime,
            duration: Math.round(log.callDuration / 1000),
            outcome: log.outcome,
            customerName: log.customerName,
          })),
          totalCount,
          hasMore: offset + parseInt(limit) < totalCount,
        },
      });
    } catch (error: any) {
      console.error("Error fetching call history:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch call history",
      });
    }
  }
);

// POST /mobile/v1/auto-booking-from-call - Create booking from incoming call context
router.post(
  "/auto-booking-from-call",
  authenticateUser,
  requireTenant,
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const {
        incomingNumber,
        pickupLocation,
        dropoffLocation,
        vehicleType,
        estimatedFare,
      } = req.body;

      if (!incomingNumber || !pickupLocation || !dropoffLocation) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
        });
      }

      const normalizedPhone = phoneNormalizer.normalize(incomingNumber);

      // Lookup customer
      const customer = await Customer.findOne({
        tenantId,
        phoneNumbers: normalizedPhone,
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: "Customer not found for this call",
        });
      }

      // Create booking (simplified)
      const booking = await (global as any).bookingService.createBooking({
        tenantId,
        customerId: customer._id,
        customerPhone: normalizedPhone,
        pickupLocation,
        dropoffLocation,
        vehicleType,
        estimatedFare: estimatedFare || 0,
        source: "CALL_CONTEXT",
      });

      res.status(201).json({
        success: true,
        data: {
          bookingId: booking._id,
          customerId: customer._id,
          customerName: customer.name,
        },
      });
    } catch (error: any) {
      console.error("Error creating booking from call:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create booking",
      });
    }
  }
);

export default router;
