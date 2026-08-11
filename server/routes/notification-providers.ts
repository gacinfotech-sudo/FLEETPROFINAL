// Notification Providers Configuration API
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { getEmailProvider } from '../integrations/emailProvider';
import { getSmsProvider } from '../integrations/smsProvider';
import { notificationRateLimiter } from '../utils/notificationRateLimiter';

const log = createLogger('NotificationProvidersAPI');
const router = express.Router();

// POST /api/notification-providers/email/config
// Configure email provider (admin only)
router.post('/email/config', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { apiKey, fromEmail, fromName, replyTo, sandboxMode } = req.body;

    // Validate required fields
    if (!apiKey || !fromEmail || !fromName) {
      return res.status(400).json({
        error: 'Missing required fields: apiKey, fromEmail, fromName'
      });
    }

    const db = mongoose.connection.db!;
    const configCollection = db.collection('provider_configs');

    // Update or insert email provider configuration
    const config = {
      provider: 'email',
      type: 'sendgrid',
      apiKey,
      fromEmail,
      fromName,
      replyTo: replyTo || fromEmail,
      sandboxMode: sandboxMode || false,
      updatedAt: new Date(),
      updatedBy: (req as any).userId
    };

    const result = await configCollection.updateOne(
      { provider: 'email' },
      { $set: config },
      { upsert: true }
    );

    // Initialize email provider with new config
    try {
      const emailProvider = getEmailProvider();
      await emailProvider.initialize({
        apiKey,
        fromEmail,
        fromName,
        replyTo: replyTo || fromEmail,
        sandboxMode: sandboxMode || false
      });
    } catch (error) {
      log.error('Failed to initialize email provider', { error });
      return res.status(500).json({
        error: 'Failed to test email provider configuration',
        message: (error as Error).message
      });
    }

    log.info('Email provider configured', {
      fromEmail,
      updatedBy: (req as any).userId
    });

    res.json({
      success: true,
      provider: 'email',
      config: {
        fromEmail,
        fromName,
        replyTo: replyTo || fromEmail,
        sandboxMode: sandboxMode || false
      },
      message: 'Email provider configured successfully'
    });
  } catch (error) {
    log.error('Failed to configure email provider', { error });
    res.status(500).json({
      error: 'Failed to configure email provider',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-providers/sms/config
// Configure SMS provider (admin only)
router.post('/sms/config', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { accountSid, authToken, fromNumber, webhookUrl, sandboxMode } = req.body;

    // Validate required fields
    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({
        error: 'Missing required fields: accountSid, authToken, fromNumber'
      });
    }

    const db = mongoose.connection.db!;
    const configCollection = db.collection('provider_configs');

    // Update or insert SMS provider configuration
    const config = {
      provider: 'sms',
      type: 'twilio',
      accountSid,
      authToken,
      fromNumber,
      webhookUrl: webhookUrl || null,
      sandboxMode: sandboxMode || false,
      updatedAt: new Date(),
      updatedBy: (req as any).userId
    };

    const result = await configCollection.updateOne(
      { provider: 'sms' },
      { $set: config },
      { upsert: true }
    );

    // Initialize SMS provider with new config
    try {
      const smsProvider = getSmsProvider();
      await smsProvider.initialize({
        accountSid,
        authToken,
        fromNumber,
        webhookUrl: webhookUrl || undefined,
        sandboxMode: sandboxMode || false
      });
    } catch (error) {
      log.error('Failed to initialize SMS provider', { error });
      return res.status(500).json({
        error: 'Failed to test SMS provider configuration',
        message: (error as Error).message
      });
    }

    log.info('SMS provider configured', {
      fromNumber,
      updatedBy: (req as any).userId
    });

    res.json({
      success: true,
      provider: 'sms',
      config: {
        fromNumber,
        webhookUrl: webhookUrl || null,
        sandboxMode: sandboxMode || false
      },
      message: 'SMS provider configured successfully'
    });
  } catch (error) {
    log.error('Failed to configure SMS provider', { error });
    res.status(500).json({
      error: 'Failed to configure SMS provider',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-providers/status
// Get status of all providers (admin only)
router.get('/status', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db!;
    const configCollection = db.collection('provider_configs');

    // Get all provider configurations
    const configs = await configCollection.find({}).toArray();

    const status: Record<string, any> = {
      email: { configured: false, status: 'unknown' },
      sms: { configured: false, status: 'unknown' }
    };

    // Check email provider
    const emailConfig = configs.find((c: any) => c.provider === 'email');
    if (emailConfig) {
      status.email.configured = true;

      try {
        const emailProvider = getEmailProvider();
        const isInitialized = emailProvider.getConfig() !== null;
        status.email.status = isInitialized ? 'active' : 'inactive';
        status.email.updatedAt = emailConfig.updatedAt;
        status.email.fromEmail = emailConfig.fromEmail;
      } catch (error) {
        status.email.status = 'error';
        status.email.error = (error as Error).message;
      }
    }

    // Check SMS provider
    const smsConfig = configs.find((c: any) => c.provider === 'sms');
    if (smsConfig) {
      status.sms.configured = true;

      try {
        const smsProvider = getSmsProvider();
        const isInitialized = smsProvider.getConfig() !== null;
        status.sms.status = isInitialized ? 'active' : 'inactive';
        status.sms.updatedAt = smsConfig.updatedAt;
        status.sms.fromNumber = smsConfig.fromNumber;
      } catch (error) {
        status.sms.status = 'error';
        status.sms.error = (error as Error).message;
      }
    }

    // Get delivery stats
    const emailQueueCollection = db.collection('email_queue');
    const smsQueueCollection = db.collection('sms_queue');

    const emailStats = await emailQueueCollection.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const smsStats = await smsQueueCollection.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    status.email.queue = Object.fromEntries(
      emailStats.map((s: any) => [s._id, s.count])
    );

    status.sms.queue = Object.fromEntries(
      smsStats.map((s: any) => [s._id, s.count])
    );

    res.json({
      success: true,
      providers: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get provider status', { error });
    res.status(500).json({
      error: 'Failed to get provider status',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-providers/test
// Test provider connection (admin only)
router.post('/test', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { provider, testEmail, testPhoneNumber } = req.body;

    if (!provider) {
      return res.status(400).json({
        error: 'Provider not specified'
      });
    }

    const results: Record<string, any> = {};

    // Test email provider
    if (provider === 'email' || provider === 'all') {
      try {
        if (!testEmail) {
          return res.status(400).json({
            error: 'testEmail is required to test email provider'
          });
        }

        const emailProvider = getEmailProvider();

        if (!emailProvider.getConfig()) {
          results.email = {
            success: false,
            error: 'Email provider not configured'
          };
        } else {
          // Test by sending a sample email
          const response = await emailProvider.send({
            to: [testEmail],
            subject: '[TEST] FleetPro Email Provider Test',
            htmlBody: '<p>This is a test email from FleetPro.</p>',
            plainTextBody: 'This is a test email from FleetPro.',
            trackingSettings: {
              openTracking: true,
              clickTracking: true
            }
          });

          results.email = {
            success: response.success,
            messageId: response.messageId,
            timestamp: response.timestamp
          };

          if (!response.success) {
            results.email.error = response.error;
          }
        }
      } catch (error) {
        results.email = {
          success: false,
          error: (error as Error).message
        };
      }
    }

    // Test SMS provider
    if (provider === 'sms' || provider === 'all') {
      try {
        if (!testPhoneNumber) {
          return res.status(400).json({
            error: 'testPhoneNumber is required to test SMS provider'
          });
        }

        const smsProvider = getSmsProvider();

        if (!smsProvider.getConfig()) {
          results.sms = {
            success: false,
            error: 'SMS provider not configured'
          };
        } else {
          // Test by sending a sample SMS
          const response = await smsProvider.send({
            to: [testPhoneNumber],
            body: '[TEST] FleetPro SMS Provider Test - Ignore this message'
          });

          results.sms = {
            success: response.success,
            messageId: response.messageId,
            timestamp: response.timestamp
          };

          if (!response.success) {
            results.sms.error = response.error;
          }
        }
      } catch (error) {
        results.sms = {
          success: false,
          error: (error as Error).message
        };
      }
    }

    const allSuccessful = Object.values(results).every((r: any) => r.success !== false);

    res.json({
      success: allSuccessful,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to test providers', { error });
    res.status(500).json({
      error: 'Failed to test providers',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-providers/fallback-chain
// Get fallback delivery chain configuration (admin only)
router.get('/fallback-chain', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db!;
    const configCollection = db.collection('provider_configs');

    const fallbackConfig = await configCollection.findOne({ _id: 'fallback_chain' });

    const defaultChain = [
      'push',
      'email',
      'sms',
      'in_app'
    ];

    const chain = fallbackConfig?.chain || defaultChain;

    res.json({
      success: true,
      fallbackChain: chain,
      description: 'Notification will be delivered via these channels in order until one succeeds'
    });
  } catch (error) {
    log.error('Failed to get fallback chain', { error });
    res.status(500).json({
      error: 'Failed to get fallback chain',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-providers/fallback-chain
// Update fallback delivery chain (admin only)
router.post('/fallback-chain', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { chain } = req.body;

    if (!Array.isArray(chain) || chain.length === 0) {
      return res.status(400).json({
        error: 'chain must be a non-empty array of channel names'
      });
    }

    const validChannels = new Set(['push', 'email', 'sms', 'in_app']);
    for (const channel of chain) {
      if (!validChannels.has(channel)) {
        return res.status(400).json({
          error: `Invalid channel: ${channel}. Valid channels are: push, email, sms, in_app`
        });
      }
    }

    const db = mongoose.connection.db!;
    const configCollection = db.collection('provider_configs');

    await configCollection.updateOne(
      { _id: 'fallback_chain' },
      {
        $set: {
          chain,
          updatedAt: new Date(),
          updatedBy: (req as any).userId
        }
      },
      { upsert: true }
    );

    log.info('Fallback chain updated', {
      chain,
      updatedBy: (req as any).userId
    });

    res.json({
      success: true,
      fallbackChain: chain,
      message: 'Fallback chain updated successfully'
    });
  } catch (error) {
    log.error('Failed to update fallback chain', { error });
    res.status(500).json({
      error: 'Failed to update fallback chain',
      message: (error as Error).message
    });
  }
});

export default router;
