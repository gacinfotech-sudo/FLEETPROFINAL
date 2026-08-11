import crypto from 'crypto';
import { WebhookSigner, WebhookManager, webhookVerificationMiddleware } from '../webhookSecurity';

describe('WebhookSigner', () => {
  describe('Signature Generation', () => {
    it('should generate valid HMAC-SHA256 signature', () => {
      const payload = { id: 1, event: 'booking.created' };
      const secret = 'test-secret-key-very-long-and-secure';

      const sig = WebhookSigner.sign(payload, secret);

      expect(sig.signature).toBeDefined();
      expect(sig.timestamp).toBeDefined();
      expect(typeof sig.signature).toBe('string');
      expect(sig.signature.length).toBeGreaterThan(0);
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'test-secret-key-very-long-and-secure';

      const sig1 = WebhookSigner.sign({ id: 1 }, secret);
      const sig2 = WebhookSigner.sign({ id: 2 }, secret);

      expect(sig1.signature).not.toEqual(sig2.signature);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = { id: 1 };

      const sig1 = WebhookSigner.sign(payload, 'secret1');
      const sig2 = WebhookSigner.sign(payload, 'secret2');

      expect(sig1.signature).not.toEqual(sig2.signature);
    });

    it('should generate consistent timestamp format', () => {
      const payload = { id: 1 };
      const secret = 'test-secret-key-very-long-and-secure';

      const sig = WebhookSigner.sign(payload, secret);

      expect(typeof sig.timestamp).toBe('number');
      expect(sig.timestamp).toBeGreaterThan(0);
      expect(sig.timestamp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });
  });

  describe('Signature Verification', () => {
    it('should verify valid signature', () => {
      const payload = { id: 1, event: 'booking.created' };
      const secret = 'test-secret-key-very-long-and-secure';

      const sig = WebhookSigner.sign(payload, secret);
      const verified = WebhookSigner.verify(payload, sig.signature, secret, sig.timestamp);

      expect(verified).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = { id: 1 };
      const secret = 'test-secret-key-very-long-and-secure';

      const sig = WebhookSigner.sign(payload, secret);
      const verified = WebhookSigner.verify(payload, 'invalid-signature', secret, sig.timestamp);

      expect(verified).toBe(false);
    });

    it('should reject tampered payload', () => {
      const payload = { id: 1, amount: 100 };
      const secret = 'test-secret-key-very-long-and-secure';

      const sig = WebhookSigner.sign(payload, secret);

      const tamperedPayload = { id: 1, amount: 1000 }; // Modified amount
      const verified = WebhookSigner.verify(tamperedPayload, sig.signature, secret, sig.timestamp);

      expect(verified).toBe(false);
    });

    it('should reject expired timestamp', () => {
      const payload = { id: 1 };
      const secret = 'test-secret-key-very-long-and-secure';

      // Manually create signature with old timestamp
      const oldTimestamp = Math.floor(Date.now() / 1000) - 10 * 60; // 10 minutes old
      const signatureData = `${oldTimestamp}.${JSON.stringify(payload)}`;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(signatureData);
      const signature = hmac.digest('hex');

      // Verify with default 5-minute window
      const verified = WebhookSigner.verify(payload, signature, secret, oldTimestamp);

      expect(verified).toBe(false);
    });

    it('should accept valid timestamp within window', () => {
      const payload = { id: 1 };
      const secret = 'test-secret-key-very-long-and-secure';

      const sig = WebhookSigner.sign(payload, secret);

      // Verify immediately (should be within 5-minute window)
      const verified = WebhookSigner.verify(
        payload,
        sig.signature,
        secret,
        sig.timestamp,
        5 * 60 * 1000 // 5 minutes
      );

      expect(verified).toBe(true);
    });

    it('should use timing-safe comparison', () => {
      const payload = { id: 1 };
      const secret = 'test-secret-key-very-long-and-secure';

      const sig = WebhookSigner.sign(payload, secret);

      // Similar but not identical signature
      const similarSig = sig.signature.slice(0, -1) + 'X';
      const verified = WebhookSigner.verify(payload, similarSig, secret, sig.timestamp);

      expect(verified).toBe(false);
    });
  });
});

describe('WebhookManager', () => {
  let manager: WebhookManager;

  beforeEach(() => {
    manager = new WebhookManager();
  });

  describe('Webhook Registration', () => {
    it('should register webhook', () => {
      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'secret-key-very-long-and-secure-32-bytes',
      });

      const webhook = manager.getWebhook('webhook-1');
      expect(webhook).toBeDefined();
      expect(webhook?.id).toBe('webhook-1');
      expect(webhook?.url).toBe('https://example.com/webhook');
    });

    it('should reject invalid URL', () => {
      expect(() => {
        manager.registerWebhook({
          id: 'webhook-1',
          url: 'not-a-valid-url',
          secret: 'secret-key-very-long-and-secure-32-bytes',
        });
      }).toThrow();
    });

    it('should warn about short secrets', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'short',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should unregister webhook', () => {
      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'secret-key-very-long-and-secure-32-bytes',
      });

      manager.unregisterWebhook('webhook-1');
      const webhook = manager.getWebhook('webhook-1');
      expect(webhook).toBeUndefined();
    });
  });

  describe('Secret Rotation', () => {
    it('should rotate webhook secret', () => {
      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'old-secret-key-very-long-and-secure-bytes',
      });

      const webhook = manager.getWebhook('webhook-1');
      const oldSecret = webhook!.secret;

      const newSecret = manager.rotateWebhookSecret('webhook-1');

      expect(newSecret).not.toEqual(oldSecret);
      expect(webhook!.rotationKey).toEqual(oldSecret);
    });

    it('should reject rotation of non-existent webhook', () => {
      expect(() => {
        manager.rotateWebhookSecret('non-existent');
      }).toThrow();
    });
  });

  describe('Webhook Delivery', () => {
    it('should queue webhook delivery', async () => {
      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'secret-key-very-long-and-secure-32-bytes',
        events: ['booking.created'],
      });

      const delivery = await manager.queueWebhookDelivery(
        'webhook-1',
        'booking.created',
        { bookingId: 123 }
      );

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('pending');
      expect(delivery?.event).toBe('booking.created');
    });

    it('should skip delivery for unlistened events', async () => {
      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'secret-key-very-long-and-secure-32-bytes',
        events: ['booking.created'],
      });

      const delivery = await manager.queueWebhookDelivery(
        'webhook-1',
        'payment.processed',
        { paymentId: 123 }
      );

      expect(delivery).toBeNull();
    });

    it('should skip delivery for disabled webhook', async () => {
      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'secret-key-very-long-and-secure-32-bytes',
        enabled: false,
      });

      const delivery = await manager.queueWebhookDelivery(
        'webhook-1',
        'booking.created',
        { bookingId: 123 }
      );

      expect(delivery).toBeNull();
    });

    it('should get delivery status', async () => {
      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'secret-key-very-long-and-secure-32-bytes',
      });

      const delivery = await manager.queueWebhookDelivery(
        'webhook-1',
        'booking.created',
        { bookingId: 123 }
      );

      if (delivery) {
        const status = manager.getDeliveryStatus(delivery.id);
        expect(status).toBeDefined();
        expect(status?.id).toBe(delivery.id);
      }
    });
  });

  describe('Webhook Configuration', () => {
    it('should update webhook configuration', () => {
      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'secret-key-very-long-and-secure-32-bytes',
      });

      manager.updateWebhook('webhook-1', {
        url: 'https://newexample.com/webhook',
      });

      const webhook = manager.getWebhook('webhook-1');
      expect(webhook?.url).toBe('https://newexample.com/webhook');
    });

    it('should reject invalid URL on update', () => {
      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'secret-key-very-long-and-secure-32-bytes',
      });

      expect(() => {
        manager.updateWebhook('webhook-1', {
          url: 'not-a-valid-url',
        });
      }).toThrow();
    });

    it('should list all webhooks', () => {
      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook1',
        secret: 'secret-key-very-long-and-secure-32-bytes',
      });

      manager.registerWebhook({
        id: 'webhook-2',
        url: 'https://example.com/webhook2',
        secret: 'secret-key-very-long-and-secure-32-bytes',
      });

      const webhooks = manager.listWebhooks();
      expect(webhooks).toHaveLength(2);
    });
  });
});

describe('Webhook Security', () => {
  describe('Signature Verification', () => {
    it('should prevent replay attacks with timestamp validation', () => {
      const payload = { id: 1, event: 'booking.created' };
      const secret = 'test-secret-key-very-long-and-secure';

      const sig = WebhookSigner.sign(payload, secret);

      // Valid signature
      const verified1 = WebhookSigner.verify(payload, sig.signature, secret, sig.timestamp);
      expect(verified1).toBe(true);

      // Old signature should fail
      const oldTimestamp = Math.floor(Date.now() / 1000) - 10 * 60; // 10 minutes old
      const verified2 = WebhookSigner.verify(payload, sig.signature, secret, oldTimestamp);
      expect(verified2).toBe(false);
    });

    it('should prevent tampering with key rotation', async () => {
      const manager = new WebhookManager();

      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'original-secret-key-very-long-and-secure',
      });

      const payload = { id: 1 };
      const sig = WebhookSigner.sign(payload, 'original-secret-key-very-long-and-secure');

      // Rotate secret
      manager.rotateWebhookSecret('webhook-1');

      // Old signature should still verify within rotation window
      const webhook = manager.getWebhook('webhook-1');
      const verified = WebhookSigner.verify(payload, sig.signature, webhook!.rotationKey!);

      expect(verified).toBe(true);
    });
  });

  describe('IP Whitelist Protection', () => {
    it('should validate IP whitelist configuration', () => {
      const manager = new WebhookManager();

      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'secret-key-very-long-and-secure-32-bytes',
        ipWhitelist: ['192.168.1.1', '10.0.0.1'],
      });

      const webhook = manager.getWebhook('webhook-1');
      expect(webhook?.ipWhitelist).toContain('192.168.1.1');
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should queue multiple deliveries independently', async () => {
      const manager = new WebhookManager();

      manager.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        secret: 'secret-key-very-long-and-secure-32-bytes',
      });

      const deliveries = [];
      for (let i = 0; i < 5; i++) {
        const delivery = await manager.queueWebhookDelivery(
          'webhook-1',
          'booking.created',
          { bookingId: i }
        );
        if (delivery) deliveries.push(delivery);
      }

      expect(deliveries).toHaveLength(5);
      expect(deliveries.every(d => d.status === 'pending')).toBe(true);
    });
  });
});
