// Notification Providers API - Phase 33 Config endpoints
import express, { Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/auth';
import { emailProvider } from '../integrations/emailProvider';
import { smsProvider } from '../integrations/smsProvider';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationProvidersRoute');
const router = express.Router();

// Configure Email Provider
router.post('/api/notification-providers/email/config', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const { provider, sendgridApiKey, smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName } = req.body;

    if (!provider || !fromEmail) {
      return res.status(400).json({ error: 'provider and fromEmail required' });
    }

    emailProvider.updateConfig({
      provider: provider as any,
      sendgridApiKey,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      fromEmail,
      fromName
    });

    log.info('Email provider configured', { provider, fromEmail, tenantId: req.tenantId });

    return res.json({
      success: true,
      provider,
      message: 'Email provider configured successfully'
    });
  } catch (error) {
    log.error('Email provider config failed', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Configure SMS Provider
router.post('/api/notification-providers/sms/config', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const { provider, twilioAccountSid, twilioAuthToken, twilioPhoneNumber, awsRegion } = req.body;

    if (!provider) {
      return res.status(400).json({ error: 'provider required' });
    }

    smsProvider.updateConfig({
      provider: provider as any,
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber,
      awsRegion
    });

    log.info('SMS provider configured', { provider, tenantId: req.tenantId });

    return res.json({
      success: true,
      provider,
      message: 'SMS provider configured successfully'
    });
  } catch (error) {
    log.error('SMS provider config failed', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get Email Provider Config
router.get('/api/notification-providers/email/status', requireAuth, requireTenant, (req: Request, res: Response) => {
  try {
    const config = emailProvider.getConfig();
    return res.json({
      provider: config.provider,
      configured: !!config.fromEmail,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      hasApiKey: !!config.sendgridApiKey,
      hasSmtpConfig: !!config.smtpHost
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get SMS Provider Config
router.get('/api/notification-providers/sms/status', requireAuth, requireTenant, (req: Request, res: Response) => {
  try {
    const config = smsProvider.getConfig();
    return res.json({
      provider: config.provider,
      configured: config.provider !== 'mock',
      hasTwilioConfig: !!config.twilioAccountSid,
      hasAwsConfig: !!config.awsRegion
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Test Email Delivery
router.post('/api/notification-providers/email/test', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'to email required' });
    }

    const result = await emailProvider.send({
      to: [to],
      subject: 'FleetPro Email Test',
      htmlBody: '<p>This is a test email from FleetPro notification system.</p>'
    });

    log.info('Email test sent', { to, result: result.success });

    return res.json(result);
  } catch (error) {
    log.error('Email test failed', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Test SMS Delivery
router.post('/api/notification-providers/sms/test', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'to phone number required' });
    }

    const result = await smsProvider.send({
      to: [to],
      body: 'FleetPro: This is a test SMS from notification system.'
    });

    log.info('SMS test sent', { to, result: result.success });

    return res.json(result);
  } catch (error) {
    log.error('SMS test failed', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
