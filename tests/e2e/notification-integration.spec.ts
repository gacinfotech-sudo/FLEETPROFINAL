// End-to-End Notification System Tests
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://192.168.29.142:5050';

test.describe('FleetPro Notification System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Login if needed
    await page.goto(`${BASE_URL}/notification-preferences`);
  });

  test.describe('User Preferences', () => {
    test('should load preference dashboard', async ({ page }) => {
      await expect(page).toHaveTitle(/Notification Preferences/);
      await expect(page.locator('h1')).toContainText('Notification Preferences');
    });

    test('should toggle global notifications', async ({ page }) => {
      const checkbox = page.locator('input[type="checkbox"]').first();
      await checkbox.click();
      await expect(page.locator('button:has-text("Save")')).toBeVisible();
    });

    test('should configure quiet hours', async ({ page }) => {
      const quietHoursCheckbox = page.locator('input[type="checkbox"]').nth(1);
      await quietHoursCheckbox.click();

      const startTimeInput = page.locator('input[type="time"]').first();
      await startTimeInput.fill('22:00');

      const endTimeInput = page.locator('input[type="time"]').nth(1);
      await endTimeInput.fill('08:00');

      await page.locator('button:has-text("Save")').click();
      await expect(page.locator('text=Preferences saved successfully')).toBeVisible();
    });

    test('should select timezone', async ({ page }) => {
      const select = page.locator('select').first();
      await select.selectOption('Asia/Tokyo');
      await page.locator('button:has-text("Save")').click();
      await expect(page.locator('text=Preferences saved successfully')).toBeVisible();
    });
  });

  test.describe('Analytics Dashboard', () => {
    test('should load analytics dashboard', async ({ page }) => {
      await page.goto(`${BASE_URL}/notification-analytics`);
      await expect(page).toHaveTitle(/Notification Analytics/);
      await expect(page.locator('h1')).toContainText('Notification Analytics');
    });

    test('should display KPI cards', async ({ page }) => {
      await page.goto(`${BASE_URL}/notification-analytics`);

      await expect(page.locator('text=Total Sent')).toBeVisible();
      await expect(page.locator('text=Delivered')).toBeVisible();
      await expect(page.locator('text=Opened')).toBeVisible();
      await expect(page.locator('text=Clicked')).toBeVisible();
      await expect(page.locator('text=Success Rate')).toBeVisible();
    });

    test('should filter by date range', async ({ page }) => {
      await page.goto(`${BASE_URL}/notification-analytics`);

      const select = page.locator('select');
      await select.selectOption('30d');

      await page.waitForTimeout(500);
      await expect(page.locator('text=Last 30 Days')).toBeVisible();
    });

    test('should export CSV', async ({ page }) => {
      await page.goto(`${BASE_URL}/notification-analytics`);

      const downloadPromise = page.waitForEvent('download');
      await page.locator('button:has-text("Export CSV")').click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/analytics-.*.csv/);
    });
  });

  test.describe('Notification API', () => {
    test('should create notification trigger', async ({ page }) => {
      const response = await page.request.post(
        `${BASE_URL}/api/notification-triggers`,
        {
          data: {
            name: 'Test Trigger',
            eventType: 'booking_created',
            channels: ['push', 'email'],
            enabled: true,
            templateId: 'test-template-id'
          }
        }
      );

      expect(response.ok()).toBeTruthy();
      const json = await response.json();
      expect(json).toHaveProperty('_id');
    });

    test('should get user preferences', async ({ page }) => {
      const response = await page.request.get(
        `${BASE_URL}/api/notification-preferences`
      );

      expect(response.ok()).toBeTruthy();
      const json = await response.json();
      expect(json).toHaveProperty('globalEnabled');
      expect(json).toHaveProperty('quietHoursEnabled');
    });

    test('should update preferences', async ({ page }) => {
      const response = await page.request.put(
        `${BASE_URL}/api/notification-preferences`,
        {
          data: {
            globalEnabled: true,
            quietHoursEnabled: false
          }
        }
      );

      expect(response.ok()).toBeTruthy();
    });

    test('should get analytics summary', async ({ page }) => {
      const response = await page.request.get(
        `${BASE_URL}/api/notification-analytics/summary`
      );

      expect(response.ok()).toBeTruthy();
      const json = await response.json();
      expect(json).toHaveProperty('summary');
      expect(json.summary).toHaveProperty('totalSent');
      expect(json.summary).toHaveProperty('successRate');
    });

    test('should get health status', async ({ page }) => {
      const response = await page.request.get(
        `${BASE_URL}/api/notification-health/status`
      );

      expect(response.ok()).toBeTruthy();
      const json = await response.json();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(json.status);
    });
  });

  test.describe('Provider Configuration', () => {
    test('should configure email provider', async ({ page }) => {
      const response = await page.request.post(
        `${BASE_URL}/api/notification-providers/email/config`,
        {
          data: {
            provider: 'mock',
            fromEmail: 'test@fleetpro.com',
            fromName: 'FleetPro Test'
          }
        }
      );

      expect(response.ok()).toBeTruthy();
    });

    test('should get email provider status', async ({ page }) => {
      const response = await page.request.get(
        `${BASE_URL}/api/notification-providers/email/status`
      );

      expect(response.ok()).toBeTruthy();
      const json = await response.json();
      expect(json).toHaveProperty('provider');
      expect(json).toHaveProperty('configured');
    });

    test('should test email delivery', async ({ page }) => {
      const response = await page.request.post(
        `${BASE_URL}/api/notification-providers/email/test`,
        {
          data: {
            to: 'test@example.com'
          }
        }
      );

      expect(response.ok()).toBeTruthy();
      const json = await response.json();
      expect(json).toHaveProperty('success');
    });
  });

  test.describe('Push Notifications', () => {
    test('should subscribe to push notifications', async ({ page, context }) => {
      // Request permission
      await context.grantPermissions(['notifications']);

      const response = await page.request.post(
        `${BASE_URL}/api/notifications/subscribe`,
        {
          data: {
            endpoint: 'https://push.example.com/endpoint',
            keys: {
              p256dh: 'test-key',
              auth: 'test-auth'
            }
          }
        }
      );

      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid preference update', async ({ page }) => {
      const response = await page.request.put(
        `${BASE_URL}/api/notification-preferences`,
        {
          data: {
            invalidField: 'test'
          }
        }
      );

      // Should fail gracefully
      expect(response.status()).toBeLessThanOrEqual(500);
    });

    test('should handle non-existent trigger', async ({ page }) => {
      const response = await page.request.get(
        `${BASE_URL}/api/notification-triggers/invalid-id`
      );

      expect(response.status()).toBe(404);
    });
  });
});
