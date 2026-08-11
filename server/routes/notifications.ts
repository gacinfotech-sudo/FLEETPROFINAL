import express from "express";
import { notificationEngine, type NotificationPreferences } from "../services/notificationEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/notifications/create - Create a new notification
router.post("/create", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { userId, title, message, category, priority, channels, actionUrl, metadata } =
      req.body;

    if (!userId || !title || !message || !category || !priority) {
      return res.status(400).json({
        success: false,
        error: "userId, title, message, category, and priority are required",
      });
    }

    const notification = notificationEngine.createNotification({
      userId,
      title,
      message,
      category,
      priority,
      channels,
      actionUrl,
      metadata,
    });

    res.json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create notification",
    });
  }
});

// POST /api/notifications/from-template - Create notification from template
router.post("/from-template", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { userId, templateId, variables } = req.body;

    if (!userId || !templateId || !variables) {
      return res.status(400).json({
        success: false,
        error: "userId, templateId, and variables are required",
      });
    }

    const notification = notificationEngine.createFromTemplate({
      userId,
      templateId,
      variables,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Template not found",
      });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    console.error("Error creating notification from template:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create notification from template",
    });
  }
});

// GET /api/notifications/user/:userId - Get user notifications
router.get("/user/:userId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const notifications = notificationEngine.getUserNotifications(req.params.userId, limit);

    res.json({
      success: true,
      data: notifications,
      count: notifications.length,
    });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch notifications",
    });
  }
});

// GET /api/notifications/user/:userId/unread - Get unread notifications
router.get("/user/:userId/unread", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const notifications = notificationEngine.getUnreadNotifications(req.params.userId);

    res.json({
      success: true,
      data: notifications,
      count: notifications.length,
    });
  } catch (error: any) {
    console.error("Error fetching unread notifications:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch unread notifications",
    });
  }
});

// POST /api/notifications/:notificationId/read - Mark notification as read
router.post("/:notificationId/read", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const success = notificationEngine.markAsRead(req.params.notificationId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to mark notification as read",
    });
  }
});

// POST /api/notifications/preferences - Set user preferences
router.post("/preferences", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { userId, channels, categories, quiet_hours, batching_enabled, batching_interval } =
      req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    const preferences: NotificationPreferences = {
      userId,
      channels: channels || {
        in_app: true,
        email: true,
        sms: true,
        whatsapp: true,
        push: true,
      },
      categories: categories || {},
      quiet_hours,
      batching_enabled: batching_enabled || false,
      batching_interval: batching_interval || 15,
    };

    notificationEngine.setUserPreferences(preferences);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error("Error setting preferences:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to set preferences",
    });
  }
});

// GET /api/notifications/preferences/:userId - Get user preferences
router.get("/preferences/:userId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const preferences = notificationEngine.getUserPreferences(req.params.userId);

    if (!preferences) {
      return res.status(404).json({
        success: false,
        error: "Preferences not found",
      });
    }

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch preferences",
    });
  }
});

// GET /api/notifications/templates - Get all templates
router.get("/templates", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const templates = notificationEngine.getAllTemplates();

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error: any) {
    console.error("Error fetching templates:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch templates",
    });
  }
});

// GET /api/notifications/templates/:templateId - Get specific template
router.get("/templates/:templateId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const template = notificationEngine.getTemplate(req.params.templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: "Template not found",
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error("Error fetching template:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch template",
    });
  }
});

// GET /api/notifications/stats - Get delivery statistics
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = notificationEngine.getDeliveryStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch stats",
    });
  }
});

// POST /api/notifications/cleanup - Cleanup expired notifications
router.post("/cleanup", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const removed = notificationEngine.cleanupExpiredNotifications();

    res.json({
      success: true,
      message: `Cleaned up ${removed} expired notifications`,
    });
  } catch (error: any) {
    console.error("Error cleaning up notifications:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to cleanup notifications",
    });
  }
});

// POST /api/notifications/test - Test notification engine
router.post("/test", (req: any, res) => {
  try {
    // Create test notifications
    const notif1 = notificationEngine.createNotification({
      userId: "TEST-USER-001",
      title: "🎉 Test Notification 1",
      message: "This is a test notification for booking confirmed",
      category: "booking",
      priority: "high",
      channels: ["in_app", "sms"],
    });

    const notif2 = notificationEngine.createFromTemplate({
      userId: "TEST-USER-001",
      templateId: "payment_received",
      variables: { amount: "2500", bookingId: "BK-12345" },
    });

    const notif3 = notificationEngine.createFromTemplate({
      userId: "TEST-USER-001",
      templateId: "driver_assigned",
      variables: { driverName: "Rajesh", eta: "5" },
    });

    // Set user preferences
    notificationEngine.setUserPreferences({
      userId: "TEST-USER-001",
      channels: {
        in_app: true,
        email: true,
        sms: true,
        whatsapp: true,
        push: true,
      },
      categories: {},
      batching_enabled: false,
      batching_interval: 15,
    });

    // Mark one as read
    if (notif1) {
      notificationEngine.markAsRead(notif1.id);
    }

    const stats = notificationEngine.getDeliveryStats();
    const userNotifs = notificationEngine.getUserNotifications("TEST-USER-001");
    const unreadNotifs = notificationEngine.getUnreadNotifications("TEST-USER-001");
    const templates = notificationEngine.getAllTemplates();

    res.json({
      success: true,
      createdNotifications: [notif1, notif2, notif3].filter(Boolean),
      stats,
      userNotifications: userNotifs,
      unreadCount: unreadNotifs.length,
      templateCount: templates.length,
      summary: {
        totalCreated: 3,
        totalNotifications: stats.totalNotifications,
        deliveryRate: stats.deliveryRate,
      },
    });
  } catch (error: any) {
    console.error("Error testing notification engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test notification engine",
    });
  }
});

export default router;
