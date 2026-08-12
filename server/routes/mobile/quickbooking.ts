import express from "express";
import { PhoneNormalizer } from "../services/PhoneNormalizer";
import { BlacklistService } from "../services/BlacklistService";
import { BookingService } from "../services/BookingService";
import { CustomerService } from "../services/CustomerService";
import { authenticateUser, requireTenant } from "../middleware/auth";
import { Booking, Customer } from "../models";

const router = express.Router();
const phoneNormalizer = new PhoneNormalizer();
const blacklistService = new BlacklistService();
const bookingService = new BookingService();
const customerService = new CustomerService();

// Performance tracking
interface BookingTiming {
  phoneNormalization: number;
  customerLookup: number;
  blacklistCheck: number;
  bookingCreation: number;
  total: number;
}

// POST /mobile/v1/bookings - Quick booking creation
// Optimized for <2 minute completion
router.post("/bookings", authenticateUser, requireTenant, async (req: any, res) => {
  const startTime = Date.now();
  const timing: BookingTiming = {
    phoneNormalization: 0,
    customerLookup: 0,
    blacklistCheck: 0,
    bookingCreation: 0,
    total: 0,
  };

  try {
    const { tenantId } = req.tenant;
    const {
      customerPhone,
      pickupLocation,
      dropoffLocation,
      vehicleType,
      estimatedFare,
      notes,
      pickupTime // optional: future booking
    } = req.body;

    // 1. Phone Normalization (< 50ms)
    const normStart = Date.now();
    if (!customerPhone) {
      return res.status(400).json({
        success: false,
        error: "Customer phone required",
      });
    }

    const normalizedPhone = phoneNormalizer.normalize(customerPhone);
    if (!phoneNormalizer.isValid(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number",
      });
    }
    timing.phoneNormalization = Date.now() - normStart;

    // 2. Customer Lookup or Create (50-500ms)
    const customerLookupStart = Date.now();
    let customer = await customerService.findOrCreateByPhone(tenantId, normalizedPhone);

    if (!customer) {
      // Fallback: create new customer with minimal info
      customer = await customerService.createCustomer(tenantId, {
        phoneNumber: normalizedPhone,
        createdAt: new Date(),
        lastBookingDate: new Date(),
      });
    }
    timing.customerLookup = Date.now() - customerLookupStart;

    // 3. Blacklist Check (< 50ms)
    const blacklistStart = Date.now();
    const blacklistStatus = await blacklistService.checkCustomer(tenantId, customer._id);

    if (blacklistStatus.status === "HARD_BLOCK") {
      return res.status(403).json({
        success: false,
        error: "Customer is blacklisted - booking not allowed",
        blacklistReason: blacklistStatus.reason,
      });
    }

    // Warning on manager approval required
    if (blacklistStatus.status === "MANAGER_APPROVAL") {
      console.warn(`Booking for ${normalizedPhone} requires manager approval`);
    }
    timing.blacklistCheck = Date.now() - blacklistStart;

    // 4. Booking Creation (Atomic, 500-1000ms)
    const bookingStart = Date.now();
    const booking = await bookingService.createBooking({
      tenantId,
      customerId: customer._id,
      customerPhone: normalizedPhone,
      pickupLocation,
      dropoffLocation,
      vehicleType,
      estimatedFare: estimatedFare || 0,
      notes: notes || "",
      bookingTime: new Date(),
      pickupTime: pickupTime ? new Date(pickupTime) : new Date(),
      status: "CONFIRMED",
    });
    timing.bookingCreation = Date.now() - bookingStart;

    timing.total = Date.now() - startTime;

    // Log performance
    if (timing.total > 2000) {
      console.warn(`Booking ${booking._id} took ${timing.total}ms`, timing);
    }

    res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id,
        customerId: customer._id,
        customerName: customer.name || "Unknown",
        customerPhone: normalizedPhone,
        pickupLocation,
        dropoffLocation,
        vehicleType,
        estimatedFare,
        bookingStatus: "CONFIRMED",
        blacklistWarning: blacklistStatus.status === "MANAGER_APPROVAL" ? "Manager approval required" : null,
      },
      timing, // Return timing for diagnostics
    });
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`Quick booking failed after ${totalTime}ms:`, error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create booking",
      timing: {
        ...timing,
        total: totalTime,
      },
    });
  }
});

// GET /mobile/v1/bookings/:id - Get booking details
router.get("/bookings/:id", authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { tenantId } = req.tenant;
    const { id } = req.params;

    const booking = await Booking.findOne({ _id: id, tenantId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    res.json({
      success: true,
      data: booking,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch booking",
    });
  }
});

// GET /mobile/v1/customer-quick-lookup - Quick customer lookup
router.get("/customer-quick-lookup", authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { tenantId } = req.tenant;
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number required",
      });
    }

    const normalizedPhone = phoneNormalizer.normalize(String(phone));
    const customer = await customerService.findByPhone(tenantId, normalizedPhone);

    if (!customer) {
      return res.json({
        success: true,
        data: null,
        message: "No existing customer found",
      });
    }

    // Return minimal cached data for quick booking form fill
    res.json({
      success: true,
      data: {
        customerId: customer._id,
        customerName: customer.name || "",
        lastVehicleType: customer.lastVehicleType || "",
        lastPickupLocation: customer.lastPickupLocation || "",
        lastDropoffLocation: customer.lastDropoffLocation || "",
        preferredPaymentMethod: customer.preferredPaymentMethod || "CASH",
        bookingCount: customer.bookingCount || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to lookup customer",
    });
  }
});

export default router;
