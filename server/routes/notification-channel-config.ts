// Notification Channel Configuration API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import mongoose from 'mongoose';
import { getChannelManager } from '../utils/notificationChannels';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationChannelConfigAPI');
const router = express.Router();

// GET /api/notification-channels/status
// Get status of all channels (admin only)
router.get('/status', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const manager = getChannelManager();
    const stats = manager.getChannelStats();
    const enabled = manager.getEnabledChannels();
    const verification = await manager.verifyChannels();

    log.info('Channel status retrieved', { enabledChannels: enabled.length });

    res.json({
      success: true,
      channels: stats,
      enabled,
      verification,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get channel status', { error });
    res.status(500).json({
      error: 'Failed to retrieve channel status',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-channels/config
// Get channel configurations (admin only)
router.get('/config', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const manager = getChannelManager();
    const channels = ['email', 'sms', 'push', 'in_app'];

    const configs: Record<string, any> = {};

    for (const channel of channels) {
      const config = manager.getConfig(channel as any);
      if (config) {
        configs[channel] = {
          name: config.name,
          enabled: config.enabled,
          provider: config.provider,
          settings: config.settings,
          // Don't expose full credentials
          hasCredentials: !!config.credentials && Object.keys(config.credentials).length > 0
        };
      }
    }

    log.info('Channel configurations retrieved');

    res.json({
      success: true,
      channels: configs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get channel configurations', { error });
    res.status(500).json({
      error: 'Failed to retrieve configurations',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-channels/:channel/test
// Send test notification via specified channel (admin only)
router.post(
  '/:channel/test',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { channel } = req.params;
      const { recipient, title, body, message } = req.body;

      if (!['email', 'sms', 'push', 'in_app'].includes(channel)) {
        return res.status(400).json({
          error: 'Invalid channel',
          message: 'Channel must be email, sms, push, or in_app'
        });
      }

      const manager = getChannelManager();
      const channelObj = manager.getChannel(channel as any);

      if (!channelObj) {
        return res.status(400).json({
          error: 'Channel not configured',
          message: `${channel} channel is not initialized`
        });
      }

      if (!manager.isChannelEnabled(channel as any)) {
        return res.status(400).json({
          error: 'Channel disabled',
          message: `${channel} channel is currently disabled`
        });
      }

      let result: any;

      if (channel === 'email') {
        result = await channelObj.send(
          recipient,
          title || 'Test Email',
          `<p>${body || message || 'This is a test notification'}</p>`
        );
      } else if (channel === 'sms') {
        result = await channelObj.send(
          recipient,
          message || body || 'This is a test SMS'
        );
      } else if (channel === 'push') {
        result = await channelObj.send(
          recipient,
          title || 'Test Push',
          {
            body: body || message || 'This is a test push notification',
            icon: '🔔'
          }
        );
      } else if (channel === 'in_app') {
        result = await channelObj.send(
          recipient,
          title || 'Test In-App',
          body || message || 'This is a test in-app notification'
        );
      }

      log.info(`Test notification sent via ${channel}`, {
        channel,
        recipient,
        status: result.status
      });

      res.json({
        success: result.status === 'success',
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to send test notification', { error });
      res.status(500).json({
        error: 'Failed to send test notification',
        message: (error as Error).message
      });
    }
  }
);

// GET /api/notification-channels/:channel/settings
// Get channel settings template (admin only)
router.get(
  '/:channel/settings',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { channel } = req.params;

      const templates: Record<string, any> = {
        email: {
          providers: [
            {
              id: 'sendgrid',
              name: 'SendGrid',
              credentials: ['sendgridApiKey'],
              settings: ['fromEmail', 'replyTo']
            },
            {
              id: 'gmail',
              name: 'Gmail',
              credentials: ['gmailEmail', 'gmailAppPassword'],
              settings: ['fromEmail', 'replyTo']
            },
            {
              id: 'smtp',
              name: 'SMTP Server',
              credentials: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpSecure'],
              settings: ['fromEmail', 'replyTo']
            }
          ]
        },
        sms: {
          providers: [
            {
              id: 'twilio',
              name: 'Twilio',
              credentials: ['twilioAccountSid', 'twilioAuthToken'],
              settings: ['fromNumber']
            }
          ]
        },
        push: {
          providers: [
            {
              id: 'web-push',
              name: 'Web Push (VAPID)',
              credentials: ['vapidPublicKey', 'vapidPrivateKey'],
              settings: []
            }
          ]
        },
        in_app: {
          providers: [
            {
              id: 'database',
              name: 'Database Storage',
              credentials: [],
              settings: []
            }
          ]
        }
      };

      const template = templates[channel];

      if (!template) {
        return res.status(404).json({
          error: 'Not found',
          message: `No template for channel: ${channel}`
        });
      }

      log.info('Channel settings template retrieved', { channel });

      res.json({
        success: true,
        channel,
        template,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to get channel settings', { error });
      res.status(500).json({
        error: 'Failed to retrieve settings',
        message: (error as Error).message
      });
    }
  }
);

// POST /api/notification-channels/:channel/verify
// Verify channel credentials (admin only)
router.post(
  '/:channel/verify',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { channel } = req.params;

      const manager = getChannelManager();
      const channelObj = manager.getChannel(channel as any);

      if (!channelObj) {
        return res.status(400).json({
          error: 'Channel not configured',
          message: `${channel} channel is not initialized`
        });
      }

      let isValid = false;

      if (channelObj.verify) {
        isValid = await channelObj.verify();
      } else {
        isValid = true;
      }

      log.info(`Channel verification: ${channel}`, { isValid });

      res.json({
        success: isValid,
        channel,
        verified: isValid,
        message: isValid ? 'Channel verified successfully' : 'Channel verification failed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Channel verification failed', { error });
      res.status(500).json({
        error: 'Verification failed',
        message: (error as Error).message
      });
    }
  }
);

export default router;
