import express from "express";
import { supportEngine } from "../services/supportEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/support/ticket - Create new ticket
router.post("/ticket", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { category, subject, description } = req.body;

    if (!category || !subject || !description) {
      return res.status(400).json({
        success: false,
        error: "category, subject, and description are required",
      });
    }

    const ticket = supportEngine.createTicket(
      req.user.customerId || req.user.id,
      category,
      subject,
      description
    );

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error: any) {
    console.error("Error creating support ticket:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create ticket",
    });
  }
});

// POST /api/support/ticket/:ticketId/message - Add message to ticket
router.post("/ticket/:ticketId/message", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { content } = req.body;
    const { ticketId } = req.params;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: "content is required",
      });
    }

    const success = supportEngine.addMessage(
      ticketId,
      req.user.role === "agent" ? "agent" : "customer",
      req.user.name || "User",
      content
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Ticket not found",
      });
    }

    const ticket = supportEngine.getTicket(ticketId);
    res.json({
      success: true,
      data: ticket,
    });
  } catch (error: any) {
    console.error("Error adding message:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to add message",
    });
  }
});

// POST /api/support/ticket/:ticketId/resolve - Resolve ticket
router.post("/ticket/:ticketId/resolve", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { resolutionType, description, compensation } = req.body;
    const { ticketId } = req.params;

    if (!resolutionType || !description) {
      return res.status(400).json({
        success: false,
        error: "resolutionType and description are required",
      });
    }

    const success = supportEngine.resolveTicket(
      ticketId,
      resolutionType,
      description,
      req.user.agentId || req.user.id,
      compensation
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Ticket not found",
      });
    }

    const ticket = supportEngine.getTicket(ticketId);
    res.json({
      success: true,
      data: ticket,
    });
  } catch (error: any) {
    console.error("Error resolving ticket:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to resolve ticket",
    });
  }
});

// POST /api/support/ticket/:ticketId/escalate - Escalate ticket
router.post("/ticket/:ticketId/escalate", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { toQueue, reason } = req.body;
    const { ticketId } = req.params;

    if (!toQueue || !reason) {
      return res.status(400).json({
        success: false,
        error: "toQueue and reason are required",
      });
    }

    const success = supportEngine.escalateTicket(
      ticketId,
      toQueue,
      reason,
      req.user.agentId
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Ticket not found",
      });
    }

    const ticket = supportEngine.getTicket(ticketId);
    res.json({
      success: true,
      data: ticket,
    });
  } catch (error: any) {
    console.error("Error escalating ticket:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to escalate ticket",
    });
  }
});

// GET /api/support/ticket/:ticketId - Get ticket details
router.get("/ticket/:ticketId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const ticket = supportEngine.getTicket(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: "Ticket not found",
      });
    }

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error: any) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch ticket",
    });
  }
});

// GET /api/support/tickets - Get customer's tickets
router.get("/tickets", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const tickets = supportEngine.getTicketsByCustomer(
      req.user.customerId || req.user.id
    );

    res.json({
      success: true,
      data: tickets,
      count: tickets.length,
    });
  } catch (error: any) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch tickets",
    });
  }
});

// POST /api/support/ticket/:ticketId/satisfaction - Record satisfaction
router.post("/ticket/:ticketId/satisfaction", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { score, comments } = req.body;
    const { ticketId } = req.params;

    if (score === undefined || score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        error: "score must be between 0 and 100",
      });
    }

    const success = supportEngine.recordSatisfaction(
      ticketId,
      score,
      comments || ""
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Ticket not found",
      });
    }

    res.json({
      success: true,
      message: "Satisfaction recorded",
    });
  } catch (error: any) {
    console.error("Error recording satisfaction:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to record satisfaction",
    });
  }
});

// GET /api/support/analytics - Get support analytics
router.get("/analytics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const analytics = supportEngine.getSupportAnalytics();

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch analytics",
    });
  }
});

// GET /api/support/agents - Get agent performance
router.get("/agents", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const agents = supportEngine.getAgentStats();

    res.json({
      success: true,
      data: agents,
      count: agents.length,
    });
  } catch (error: any) {
    console.error("Error fetching agents:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch agents",
    });
  }
});

// GET /api/support/faqs - Get FAQs
router.get("/faqs", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { category } = req.query;
    const faqs = supportEngine.getFAQs(category as any);

    res.json({
      success: true,
      data: faqs,
      count: faqs.length,
    });
  } catch (error: any) {
    console.error("Error fetching FAQs:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch FAQs",
    });
  }
});

// POST /api/support/test - Test support engine
router.post("/test", (req: any, res) => {
  try {
    // Create tickets
    const ticket1 = supportEngine.createTicket(
      "customer_001",
      "payment",
      "Double charge on my account",
      "I was charged twice for the same ride. Please refund the extra amount."
    );

    const ticket2 = supportEngine.createTicket(
      "customer_002",
      "safety",
      "Unsafe driver behavior",
      "The driver was reckless and endangered my safety during the ride."
    );

    // Add messages
    supportEngine.addMessage(
      ticket1.ticketId,
      "agent",
      "Priya Singh",
      "Thank you for reporting this. I've identified the duplicate charge and initiated a refund."
    );

    supportEngine.addMessage(
      ticket2.ticketId,
      "customer",
      "Customer",
      "I need this investigated immediately!"
    );

    // Resolve first ticket
    supportEngine.resolveTicket(
      ticket1.ticketId,
      "resolved",
      "Refund of ₹500 processed successfully",
      "agent_001",
      { type: "refund", amount: 500 }
    );

    // Escalate second ticket
    supportEngine.escalateTicket(
      ticket2.ticketId,
      "safety",
      "Safety concern requires escalation",
      "agent_002"
    );

    // Record satisfaction
    supportEngine.recordSatisfaction(
      ticket1.ticketId,
      85,
      "Great service, issue resolved quickly"
    );

    // Get analytics
    const analytics = supportEngine.getSupportAnalytics();
    const agents = supportEngine.getAgentStats();
    const faqs = supportEngine.getFAQs();

    res.json({
      success: true,
      tickets: [ticket1, ticket2],
      analytics,
      agents: agents.slice(0, 2),
      faqCount: faqs.length,
      summary: {
        ticketsCreated: 2,
        resolved: 1,
        escalated: 1,
        avgResolutionMinutes: Math.round(analytics.avgResolutionTime),
        avgSatisfaction: analytics.avgSatisfactionScore,
        fcrRate: analytics.firstContactResolutionRate,
      },
    });
  } catch (error: any) {
    console.error("Error testing support engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test support engine",
    });
  }
});

export default router;
