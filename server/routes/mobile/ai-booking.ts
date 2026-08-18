import express from "express";
import axios from "axios";
import { Booking, Customer } from "../models";
import { PhoneNormalizer } from "../services/PhoneNormalizer";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();
const phoneNormalizer = new PhoneNormalizer();

// OpenAI API integration (or any LLM)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LLM_MODEL = "gpt-4o"; // or gpt-3.5-turbo

interface ExtractedBookingData {
  customerPhone?: string;
  customerName?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  vehicleType?: string;
  estimatedFare?: number;
  notes?: string;
  confidence: number; // 0-100
}

interface DraftBooking {
  _id?: string;
  tenantId: string;
  extractedData: ExtractedBookingData;
  sourceText: string;
  status: "DRAFT" | "CONFIRMED" | "REJECTED";
  createdAt: Date;
  confirmedAt?: Date;
  operatorId: string;
}

// POST /mobile/v1/ai-booking/extract - Extract booking details from text/audio
router.post(
  "/extract",
  authenticateUser,
  requireTenant,
  async (req: any, res) => {
    try {
      const { tenantId, userId } = req.tenant;
      const { text, audioTranscript } = req.body;

      const sourceText = text || audioTranscript;
      if (!sourceText) {
        return res.status(400).json({
          success: false,
          error: "Text or audio transcript required",
        });
      }

      // Call OpenAI to extract booking details
      const extractedData = await extractBookingDetailsWithAI(sourceText);

      // Create draft booking (no confirmation yet)
      const draftBooking: DraftBooking = {
        tenantId,
        extractedData,
        sourceText,
        status: "DRAFT",
        createdAt: new Date(),
        operatorId: userId,
      };

      // Save draft to database (simplified)
      // const saved = await DraftBooking.create(draftBooking);

      res.json({
        success: true,
        data: {
          draftBookingId: "draft_" + Date.now(), // Use saved._id in production
          extractedData,
          confidence: extractedData.confidence,
          sourceText,
          needsReview: extractedData.confidence < 80, // Flag low-confidence extractions
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error("AI extraction failed:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to extract booking details",
      });
    }
  }
);

// POST /mobile/v1/ai-booking/confirm - Confirm and create booking from draft
router.post(
  "/confirm",
  authenticateUser,
  requireTenant,
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { draftBookingId, extractedData, overrides } = req.body;

      if (!draftBookingId || !extractedData) {
        return res.status(400).json({
          success: false,
          error: "Draft booking ID and extracted data required",
        });
      }

      // Merge overrides (operator corrections)
      const finalData = {
        ...extractedData,
        ...overrides, // Operator can correct AI extraction
      };

      // Validate required fields
      const required = [
        "customerPhone",
        "pickupLocation",
        "dropoffLocation",
      ];
      const missing = required.filter((field) => !finalData[field]);

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missing.join(", ")}`,
        });
      }

      // Normalize phone
      const normalizedPhone = phoneNormalizer.normalize(
        finalData.customerPhone
      );
      if (!phoneNormalizer.isValid(normalizedPhone)) {
        return res.status(400).json({
          success: false,
          error: "Invalid phone number",
        });
      }

      // Find or create customer
      let customer = await Customer.findOne({
        tenantId,
        phoneNumbers: normalizedPhone,
      });

      if (!customer) {
        customer = await Customer.create({
          tenantId,
          phoneNumbers: [normalizedPhone],
          name: finalData.customerName || "Unknown",
          createdAt: new Date(),
        });
      }

      // Create actual booking
      const booking = await Booking.create({
        tenantId,
        customerId: customer._id,
        customerPhone: normalizedPhone,
        pickupLocation: finalData.pickupLocation,
        dropoffLocation: finalData.dropoffLocation,
        vehicleType: finalData.vehicleType || "SUV",
        estimatedFare: finalData.estimatedFare || 0,
        notes: finalData.notes || "",
        pickupTime: finalData.pickupTime
          ? new Date(finalData.pickupTime)
          : new Date(),
        status: "CONFIRMED",
        createdAt: new Date(),
        source: "AI_COPILOT",
        metadata: {
          aiExtracted: true,
          aiConfidence: finalData.confidence,
          operatorConfirmed: true,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          bookingId: booking._id,
          customerId: customer._id,
          customerName: customer.name,
          pickupLocation: booking.pickupLocation,
          dropoffLocation: booking.dropoffLocation,
          estimatedFare: booking.estimatedFare,
          status: booking.status,
          createdAt: booking.createdAt,
        },
      });
    } catch (error: any) {
      console.error("Booking confirmation failed:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to confirm booking",
      });
    }
  }
);

// POST /mobile/v1/ai-booking/reject - Reject draft booking
router.post(
  "/reject",
  authenticateUser,
  requireTenant,
  async (req: any, res) => {
    try {
      const { draftBookingId, reason } = req.body;

      if (!draftBookingId) {
        return res.status(400).json({
          success: false,
          error: "Draft booking ID required",
        });
      }

      // Mark as rejected in database (simplified)
      // await DraftBooking.updateOne(
      //   { _id: draftBookingId },
      //   { status: "REJECTED", rejectionReason: reason }
      // );

      res.json({
        success: true,
        data: {
          draftBookingId,
          status: "REJECTED",
          reason,
        },
      });
    } catch (error: any) {
      console.error("Booking rejection failed:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to reject booking",
      });
    }
  }
);

/**
 * Extract booking details using AI (OpenAI API)
 * Structured extraction with confidence scoring
 */
async function extractBookingDetailsWithAI(
  text: string
): Promise<ExtractedBookingData> {
  try {
    if (!OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY not set, using mock extraction");
      return mockExtraction(text);
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a booking extraction AI. Extract booking details from the text.

Return JSON with these fields (all optional except locations):
{
  "customerPhone": "phone number if mentioned",
  "customerName": "customer name if mentioned",
  "pickupLocation": "pickup location",
  "dropoffLocation": "dropoff location",
  "pickupTime": "ISO datetime if mentioned",
  "vehicleType": "vehicle type (SUV, Sedan, etc)",
  "estimatedFare": "numeric fare if mentioned",
  "notes": "any special notes",
  "confidence": 0-100 (confidence in extraction)
}

Be strict: only include fields you're confident about. Set confidence 0-100 based on clarity of input.`,
          },
          {
            role: "user",
            content: `Extract booking details from: "${text}"`,
          },
        ],
        temperature: 0.3, // Low temperature for consistency
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0].message.content;
    const extracted = JSON.parse(content);

    return {
      customerPhone: extracted.customerPhone,
      customerName: extracted.customerName,
      pickupLocation: extracted.pickupLocation,
      dropoffLocation: extracted.dropoffLocation,
      pickupTime: extracted.pickupTime,
      vehicleType: extracted.vehicleType || "SUV",
      estimatedFare: extracted.estimatedFare
        ? parseFloat(extracted.estimatedFare)
        : 0,
      notes: extracted.notes || "",
      confidence: extracted.confidence || 50,
    };
  } catch (error) {
    console.error("AI extraction error:", error);
    return mockExtraction(text);
  }
}

/**
 * Mock extraction for testing (when OpenAI not available)
 */
function mockExtraction(text: string): ExtractedBookingData {
  // Simple pattern matching for demo
  const phoneMatch = text.match(/\d{10}|\d{12}/);
  const locationMatch = text.match(
    /(from|pickup|start).*?([A-Za-z\s]+).*?(to|dropoff|end).*?([A-Za-z\s]+)/i
  );

  return {
    customerPhone: phoneMatch ? phoneMatch[0] : undefined,
    pickupLocation: locationMatch ? locationMatch[2]?.trim() : undefined,
    dropoffLocation: locationMatch ? locationMatch[4]?.trim() : undefined,
    vehicleType: "SUV",
    confidence: phoneMatch && locationMatch ? 75 : 40,
  };
}

export default router;
