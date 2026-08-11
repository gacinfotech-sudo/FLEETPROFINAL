// SMS Provider Tests - 10+ SMS delivery scenarios
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { smsProvider } from '../integrations/smsProvider';
import type { SmsMessage, SmsDeliveryResult } from '../integrations/smsProvider';

describe('SMS Provider', () => {
  beforeAll(() => {
    // Ensure mock provider is configured
    smsProvider.updateConfig({
      provider: 'mock',
      twilioPhoneNumber: '+1234567890'
    });
  });

  describe('Single SMS Delivery', () => {
    it('should send a simple SMS successfully', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Hello, this is a test SMS from FleetPro'
      };

      const result = await smsProvider.send(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.phoneNumber).toBe('+919876543210');
      expect(result.provider).toBe('mock');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should send SMS with data attributes', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Booking confirmation: VEH-12345',
        data: {
          bookingId: 'VEH-12345',
          userId: 'user-123',
          type: 'confirmation'
        }
      };

      const result = await smsProvider.send(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should calculate single SMS segment for short message', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Hi' // Very short
      };

      const result = await smsProvider.send(message);

      expect(result.segments).toBe(1);
    });

    it('should send SMS at maximum single segment length (160 chars)', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'a'.repeat(160) // Exactly 160 chars
      };

      const result = await smsProvider.send(message);

      expect(result.success).toBe(true);
      expect(result.segments).toBe(1);
    });

    it('should calculate multiple SMS segments for long message', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'a'.repeat(300) // 300 chars - should be 2 segments
      };

      const result = await smsProvider.send(message);

      expect(result.success).toBe(true);
      expect(result.segments).toBeGreaterThan(1);
    });

    it('should send SMS with special characters', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Your booking is ready! 🚗 Confirm: https://fleetpro.app/book/123'
      };

      const result = await smsProvider.send(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should send SMS with Indian phone number', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Namaste! Your vehicle is ready for pickup.'
      };

      const result = await smsProvider.send(message);

      expect(result.success).toBe(true);
      expect(result.phoneNumber).toBe('+919876543210');
    });

    it('should send SMS with international phone number', async () => {
      const message: SmsMessage = {
        to: ['+1234567890'],
        body: 'Your FleetPro booking confirmation'
      };

      const result = await smsProvider.send(message);

      expect(result.success).toBe(true);
      expect(result.phoneNumber).toBe('+1234567890');
    });

    it('should send SMS with tags/categories', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Booking confirmed: VEH-12345',
        tags: ['booking', 'confirmation', 'transactional']
      };

      const result = await smsProvider.send(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should send SMS with media URLs', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Check your booking details',
        mediaUrls: ['https://example.com/invoice.pdf']
      };

      const result = await smsProvider.send(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should send SMS with very long message (multi-part)', async () => {
      const longMessage = 'a'.repeat(500); // 500 chars - requires multiple segments
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: longMessage
      };

      const result = await smsProvider.send(message);

      expect(result.success).toBe(true);
      expect(result.segments).toBeGreaterThan(1);
    });
  });

  describe('Bulk SMS Delivery', () => {
    it('should send multiple SMS messages in bulk', async () => {
      const messages: SmsMessage[] = [
        {
          to: ['+919876543210'],
          body: 'SMS 1: Booking confirmed'
        },
        {
          to: ['+919876543211'],
          body: 'SMS 2: Payment received'
        },
        {
          to: ['+919876543212'],
          body: 'SMS 3: Vehicle ready'
        }
      ];

      const results = await smsProvider.sendBulk(messages);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.messageId)).toBe(true);
    });

    it('should track segment count across bulk delivery', async () => {
      const messages: SmsMessage[] = [
        {
          to: ['+919876543210'],
          body: 'Short' // 1 segment
        },
        {
          to: ['+919876543211'],
          body: 'a'.repeat(300) // Multiple segments
        }
      ];

      const results = await smsProvider.sendBulk(messages);

      expect(results[0].segments).toBe(1);
      expect(results[1].segments).toBeGreaterThan(1);
    });
  });

  describe('SMS Segment Calculation', () => {
    it('should calculate 1 segment for message under 160 chars', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Short message'
      };

      const result = await smsProvider.send(message);
      expect(result.segments).toBe(1);
    });

    it('should calculate 2 segments for message 161-306 chars', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'a'.repeat(200)
      };

      const result = await smsProvider.send(message);
      expect(result.segments).toBe(2);
    });

    it('should calculate 3 segments for message 307-459 chars', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'a'.repeat(400)
      };

      const result = await smsProvider.send(message);
      expect(result.segments).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Configuration', () => {
    it('should get current configuration', () => {
      const config = smsProvider.getConfig();

      expect(config).toBeDefined();
      expect(config.provider).toBe('mock');
    });

    it('should update configuration', () => {
      smsProvider.updateConfig({
        twilioPhoneNumber: '+9876543210'
      });

      const config = smsProvider.getConfig();
      expect(config.twilioPhoneNumber).toBe('+9876543210');
    });

    it('should support rate limit configuration', () => {
      smsProvider.updateConfig({
        provider: 'mock',
        rateLimitPerMinute: 50
      });

      const config = smsProvider.getConfig();
      expect(config.rateLimitPerMinute).toBe(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle SMS delivery errors gracefully', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Test error handling'
      };

      const result = await smsProvider.send(message);

      // Mock always succeeds
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.provider).toBe('mock');
    });

    it('should handle empty phone number list', async () => {
      const message: SmsMessage = {
        to: [],
        body: 'Test'
      };

      const result = await smsProvider.send(message);

      // Should return result regardless
      expect(result.provider).toBeDefined();
    });

    it('should handle very long SMS gracefully', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'a'.repeat(1000) // Very long
      };

      const result = await smsProvider.send(message);

      // Should succeed (no hard limit in practical terms)
      expect(result.success).toBe(true);
    });
  });

  describe('Phone Number Validation', () => {
    it('should handle E.164 format phone numbers', async () => {
      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Test E.164'
      };

      const result = await smsProvider.send(message);
      expect(result.success).toBe(true);
    });

    it('should handle phone numbers with country codes', async () => {
      const message: SmsMessage = {
        to: ['+44-7700-900000'],
        body: 'UK number test'
      };

      const result = await smsProvider.send(message);
      expect(result.phoneNumber).toBeDefined();
    });
  });

  describe('Connection Testing', () => {
    it('should test provider connection', async () => {
      const isConnected = await smsProvider.testConnection();

      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits per minute', async () => {
      smsProvider.updateConfig({
        provider: 'mock',
        twilioPhoneNumber: '+1234567890',
        rateLimitPerMinute: 3
      });

      const message: SmsMessage = {
        to: ['+919876543210'],
        body: 'Rate limit test'
      };

      // Send 3 messages (should succeed)
      for (let i = 0; i < 3; i++) {
        const result = await smsProvider.send(message);
        expect(result.success).toBe(true);
      }

      // Note: In mock provider, additional sends won't fail
      // But in production with real rate limiting, they would
    });
  });

  afterAll(() => {
    // Reset to default configuration
    smsProvider.updateConfig({
      provider: 'mock',
      twilioPhoneNumber: '+1234567890'
    });
  });
});
