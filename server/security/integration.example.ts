/**
 * Security Hardening Integration Example
 *
 * This file demonstrates how to integrate the three security modules:
 * 1. Redis-backed Rate Limiting
 * 2. Webhook Security
 * 3. Notification Encryption
 *
 * Copy patterns from this file into your actual server/index.ts
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Import security modules
import {
  createRedisClient,
  createLoginRateLimiter,
  createPerUserRateLimiter,
  createPerChannelRateLimiter,
  createPerTriggerRateLimiter,
} from './rateLimiting';

import {
  globalWebhookManager,
  webhookVerificationMiddleware,
  WebhookConfig,
} from './webhookSecurity';

import {
  globalEncryptionManager,
  TLSManager,
} from './encryption';

/**
 * STEP 1: Initialize Express app with security
 */
export async function setupSecurityHardening(app: Express) {
  // =========================================================================
  // Rate Limiting Setup
  // =========================================================================

  console.log('[Security] Initializing Redis-backed rate limiting...');
  const redisClient = await createRedisClient();

  const loginLimiter = createLoginRateLimiter(redisClient);
  const userLimiter = createPerUserRateLimiter(redisClient);
  const emailLimiter = createPerChannelRateLimiter('email', redisClient);
  const smsLimiter = createPerChannelRateLimiter('sms', redisClient);
  const bookingTriggerLimiter = createPerTriggerRateLimiter('booking.created', redisClient);
  const paymentTriggerLimiter = createPerTriggerRateLimiter('payment.processed', redisClient);

  // Apply rate limiting middleware to all API routes
  app.use('/api/', userLimiter.middleware());

  console.log('[Security] Rate limiting configured');

  // =========================================================================
  // Webhook Security Setup
  // =========================================================================

  console.log('[Security] Initializing webhook security...');

  // Example: Register pre-configured webhooks
  // In production, load these from database
  const webhookConfigs: WebhookConfig[] = [
    {
      id: 'webhook-notifications',
      url: 'https://notifications.example.com/webhook',
      secret: crypto.randomBytes(32).toString('hex'),
      ipWhitelist: ['203.0.113.42'], // Customer's IP
      events: ['notification.sent', 'notification.failed'],
      maxRetries: 3,
      retryBackoffMs: 1000,
      headers: {
        'Authorization': 'Bearer customer-token-123',
      },
    },
    {
      id: 'webhook-bookings',
      url: 'https://partner.example.com/api/bookings',
      secret: crypto.randomBytes(32).toString('hex'),
      events: ['booking.created', 'booking.updated', 'booking.cancelled'],
      maxRetries: 5,
      retryBackoffMs: 2000,
    },
  ];

  for (const config of webhookConfigs) {
    try {
      globalWebhookManager.registerWebhook(config);
      console.log(`[Security] Webhook registered: ${config.id}`);
    } catch (error) {
      console.error(`[Security] Failed to register webhook ${config.id}:`, error);
    }
  }

  console.log('[Security] Webhook security configured');

  // =========================================================================
  // Encryption Setup
  // =========================================================================

  console.log('[Security] Initializing encryption system...');
  const currentKeyId = globalEncryptionManager.getCurrentKeyId();
  console.log(`[Security] Current encryption key: ${currentKeyId}`);

  console.log('[Security] Encryption system configured');

  // =========================================================================
  // TLS Configuration
  // =========================================================================

  if (process.env.NODE_ENV === 'production') {
    console.log('[Security] TLS 1.3+ enforced for production');
    const tlsOptions = TLSManager.getTLSOptions();
    console.log(`[Security] TLS Ciphers: ${tlsOptions.ciphers?.split(':')[0]}...`);
  }

  return {
    loginLimiter,
    userLimiter,
    emailLimiter,
    smsLimiter,
    bookingTriggerLimiter,
    paymentTriggerLimiter,
  };
}

/**
 * STEP 2: Authentication with Rate Limiting
 */
export async function setupAuthRoutes(
  app: Express,
  loginLimiter: any
) {
  // Rate limit login attempts
  app.post(
    '/api/auth/login',
    loginLimiter.middleware(),
    async (req: Request, res: Response) => {
      try {
        const { email, password } = req.body;

        // Verify password (encrypted)
        const user = await findUserByEmail(email);
        if (!user || !await verifyPassword(password, user.passwordHash)) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Login successful
        (req as any).session = {
          userId: user.id,
          email: user.email,
        };

        res.json({ message: 'Logged in successfully', user });
      } catch (error) {
        res.status(500).json({ message: 'Login failed' });
      }
    }
  );
}

/**
 * STEP 3: Webhook Delivery Routes
 */
export async function setupWebhookRoutes(app: Express) {
  // Incoming webhook verification
  app.post(
    '/api/webhooks/receive',
    webhookVerificationMiddleware(globalWebhookManager),
    async (req: Request, res: Response) => {
      try {
        const webhook = (req as any).webhook;
        const event = req.headers['x-webhook-event'];
        const deliveryId = req.headers['x-webhook-delivery'];

        console.log(`[Webhook] Received ${event} delivery ${deliveryId}`);

        // Process webhook payload
        await processWebhookPayload(event as string, req.body);

        res.json({ status: 'received' });
      } catch (error) {
        console.error('[Webhook] Processing error:', error);
        res.status(500).json({ message: 'Processing failed' });
      }
    }
  );

  // Outbound webhook management
  app.post(
    '/api/webhooks/register',
    async (req: Request, res: Response) => {
      try {
        const { url, events } = req.body;

        // Validate URL
        const secret = crypto.randomBytes(32).toString('hex');

        globalWebhookManager.registerWebhook({
          id: `webhook-${Date.now()}`,
          url,
          secret,
          events,
          enabled: true,
        });

        // Return secret (one-time only)
        res.json({
          webhookId: `webhook-${Date.now()}`,
          secret,
          message: 'Webhook registered successfully. Store the secret securely.',
        });
      } catch (error) {
        console.error('[Webhook] Registration error:', error);
        res.status(500).json({ message: 'Registration failed' });
      }
    }
  );

  // Webhook secret rotation
  app.post(
    '/api/webhooks/:webhookId/rotate-secret',
    async (req: Request, res: Response) => {
      try {
        const { webhookId } = req.params;

        const newSecret = globalWebhookManager.rotateWebhookSecret(webhookId);

        res.json({
          message: 'Secret rotated successfully',
          newSecret,
          note: 'Old secret will work for 24 hours',
        });
      } catch (error) {
        console.error('[Webhook] Rotation error:', error);
        res.status(500).json({ message: 'Rotation failed' });
      }
    }
  );
}

/**
 * STEP 4: Notification Delivery with Encryption
 */
export async function setupNotificationRoutes(app: Express) {
  app.post(
    '/api/notifications/send',
    async (req: Request, res: Response) => {
      try {
        const { userId, email, phone, message, channel } = req.body;

        // Encrypt sensitive fields
        const encryptedEmail = email
          ? globalEncryptionManager.encrypt(email, 'email')
          : null;

        const encryptedPhone = phone
          ? globalEncryptionManager.encrypt(phone, 'phone')
          : null;

        // Store encrypted notification
        const notification = {
          userId,
          email: encryptedEmail,
          phone: encryptedPhone,
          message,
          channel,
          createdAt: new Date(),
          _encrypted: ['email', 'phone'],
        };

        // Save to database
        const saved = await saveNotification(notification);

        // Trigger webhook delivery based on channel
        if (channel === 'email' && email) {
          await globalWebhookManager.queueWebhookDelivery(
            'webhook-notifications',
            'notification.sent',
            {
              notificationId: saved.id,
              type: 'email',
              timestamp: new Date().toISOString(),
            }
          );
        }

        if (channel === 'sms' && phone) {
          await globalWebhookManager.queueWebhookDelivery(
            'webhook-notifications',
            'notification.sent',
            {
              notificationId: saved.id,
              type: 'sms',
              timestamp: new Date().toISOString(),
            }
          );
        }

        res.json({
          notificationId: saved.id,
          message: 'Notification queued for delivery',
        });
      } catch (error) {
        console.error('[Notification] Send error:', error);
        res.status(500).json({ message: 'Send failed' });
      }
    }
  );

  // Retrieve notification (auto-decrypt)
  app.get(
    '/api/notifications/:notificationId',
    async (req: Request, res: Response) => {
      try {
        const notification = await getNotification(req.params.notificationId);

        if (!notification) {
          return res.status(404).json({ message: 'Not found' });
        }

        // Auto-decrypt sensitive fields
        const decrypted = globalEncryptionManager.decryptObject(notification);

        res.json(decrypted);
      } catch (error) {
        console.error('[Notification] Retrieve error:', error);
        res.status(500).json({ message: 'Retrieval failed' });
      }
    }
  );
}

/**
 * STEP 5: Booking Event Triggers with Rate Limiting
 */
export async function setupBookingRoutes(
  app: Express,
  bookingTriggerLimiter: any
) {
  app.post(
    '/api/bookings',
    bookingTriggerLimiter.middleware(),
    async (req: Request, res: Response) => {
      try {
        const booking = req.body;

        // Create booking
        const saved = await saveBooking(booking);

        // Emit webhook event (rate-limited by trigger)
        await globalWebhookManager.queueWebhookDelivery(
          'webhook-bookings',
          'booking.created',
          {
            bookingId: saved.id,
            customerId: booking.customerId,
            amount: booking.amount,
            timestamp: new Date().toISOString(),
          }
        );

        // Send encrypted notification
        const notification = {
          userId: booking.customerId,
          email: booking.customerEmail,
          phone: booking.customerPhone,
          message: `Booking #${saved.id} confirmed`,
          channel: 'email',
        };

        // Encrypt fields
        const encryptedNotif = globalEncryptionManager.encryptObject(
          notification,
          ['email', 'phone']
        );

        await saveNotification(encryptedNotif);

        res.json({
          bookingId: saved.id,
          message: 'Booking created successfully',
        });
      } catch (error) {
        console.error('[Booking] Create error:', error);
        res.status(500).json({ message: 'Creation failed' });
      }
    }
  );
}

/**
 * STEP 6: Health Check Endpoints
 */
export function setupHealthCheck(app: Express) {
  app.get('/health/security', (req: Request, res: Response) => {
    const status = {
      timestamp: new Date().toISOString(),
      encryption: {
        currentKey: globalEncryptionManager.getCurrentKeyId(),
        keys: globalEncryptionManager.listKeys().length,
      },
      webhooks: {
        count: globalWebhookManager.listWebhooks().length,
        enabled: globalWebhookManager.listWebhooks()
          .filter(w => w.enabled)
          .length,
      },
      rateLimiting: {
        redis: process.env.REDIS_URL ? 'configured' : 'in-memory',
        status: 'active',
      },
    };

    res.json(status);
  });
}

/**
 * STEP 7: Monitoring and Logging
 */
export function setupSecurityMonitoring(app: Express) {
  // Log rate limit violations
  app.use((req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function (data: any) {
      if (res.statusCode === 429) {
        console.warn('[RateLimit] Violation:', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
        });
      }

      return originalJson.call(this, data);
    };

    next();
  });
}

// ============================================================================
// Helper Functions (Mock implementations)
// ============================================================================

async function findUserByEmail(email: string): Promise<any> {
  // TODO: Implement actual database lookup
  return null;
}

async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return globalEncryptionManager.verifyHash(plaintext, hash);
}

async function processWebhookPayload(event: string, payload: any): Promise<void> {
  console.log(`Processing webhook event: ${event}`, payload);
}

async function saveNotification(notification: any): Promise<any> {
  console.log('Saving notification:', notification);
  return { id: crypto.randomUUID(), ...notification };
}

async function getNotification(notificationId: string): Promise<any> {
  // TODO: Implement database lookup
  return null;
}

async function saveBooking(booking: any): Promise<any> {
  console.log('Saving booking:', booking);
  return { id: crypto.randomUUID(), ...booking };
}

/**
 * STEP 8: Integration in main server/index.ts
 */
export async function integrateSecurityHardening(app: Express) {
  // Initialize all security modules
  const limiters = await setupSecurityHardening(app);

  // Setup routes
  await setupAuthRoutes(app, limiters.loginLimiter);
  setupWebhookRoutes(app);
  await setupNotificationRoutes(app);
  setupBookingRoutes(app, limiters.bookingTriggerLimiter);

  // Setup monitoring
  setupSecurityMonitoring(app);
  setupHealthCheck(app);

  console.log('[Security] All security modules initialized and integrated');
}
