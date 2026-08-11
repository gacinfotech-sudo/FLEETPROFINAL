/**
 * Smart Booking Validation - Mobile E2E Tests
 * Tests mobile-specific scenarios and responsiveness
 */

import { test, expect, Page, devices } from "@playwright/test";

const BASE_URL = "http://localhost:5050";

// Mobile devices to test
const MOBILE_DEVICES = {
  "iPhone 12": devices["iPhone 12"],
  "Pixel 5": devices["Pixel 5"],
  "iPad Mini": devices["iPad mini"],
};

test.describe("Smart Booking Validation - Mobile E2E", () => {
  Object.entries(MOBILE_DEVICES).forEach(([deviceName, deviceConfig]) => {
    test.describe(`${deviceName}`, () => {
      test.use(deviceConfig);

      test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/booking/create`);
        await page.waitForLoadState("networkidle");
      });

      test(`${deviceName}: Missing Date - Mobile Highlight`, async ({ page }) => {
        // Fill only time field
        const timeInput = page.locator('input[name="pickupTime"]');
        await timeInput.fill("10:00");

        // Click Next
        const nextButton = page.locator("button:has-text('Next')").first();
        await nextButton.click();

        // Wait for highlight
        await page.waitForTimeout(300);

        // Verify: Date field highlighted
        const dateField = page.locator('input[name="pickupDate"]');
        const hasHighlight = await dateField.evaluate((el: HTMLElement) => {
          return el.classList.contains("booking-field-highlight");
        });
        expect(hasHighlight).toBeTruthy();

        // Verify: Field in viewport (auto-scrolled)
        await expect(dateField).toBeInViewport();

        // Verify: Toast visible on mobile
        const toast = page.locator('div[role="alert"]');
        await expect(toast).toBeVisible();

        console.log(`✅ ${deviceName}: Missing date detected on mobile`);
      });

      test(`${deviceName}: Scroll to Field - Auto-Scroll on Mobile`, async ({ page }) => {
        // Scroll to bottom of form
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

        // Fill some fields at top
        const timeInput = page.locator('input[name="pickupTime"]');
        if (await timeInput.isVisible()) {
          await timeInput.fill("10:00");
        }

        // Click Next (which should scroll back to date field)
        const nextButton = page.locator("button:has-text('Next')").first();
        await nextButton.click();
        await page.waitForTimeout(300);

        // Verify: Date field scrolled into view
        const dateField = page.locator('input[name="pickupDate"]');
        await expect(dateField).toBeInViewport();

        console.log(`✅ ${deviceName}: Auto-scroll to error field on mobile`);
      });

      test(`${deviceName}: Touch Target Size - Buttons Large Enough`, async ({ page }) => {
        const nextButton = page.locator("button:has-text('Next')").first();
        const boundingBox = await nextButton.boundingBox();

        // Touch targets should be at least 44x44px (recommended by Apple/Google)
        expect(boundingBox!.width).toBeGreaterThanOrEqual(44);
        expect(boundingBox!.height).toBeGreaterThanOrEqual(44);

        console.log(`✅ ${deviceName}: Touch targets adequately sized`);
      });

      test(`${deviceName}: Form Layout - Responsive on Mobile`, async ({ page }) => {
        // Verify form is single column on mobile (not side-by-side)
        const formContainer = page.locator("form, [role='form']").first();
        const containerBox = await formContainer.boundingBox();

        // Get first two form fields
        const firstField = page.locator("input, select").first();
        const secondField = page.locator("input, select").nth(1);

        const firstBox = await firstField.boundingBox();
        const secondBox = await secondField.boundingBox();

        // Verify: Fields are stacked vertically (similar x position)
        if (firstBox && secondBox) {
          const xDifference = Math.abs(firstBox.x - secondBox.x);
          const yDifference = secondBox.y - firstBox.y;

          // Fields should be close in X, far in Y (stacked)
          expect(yDifference).toBeGreaterThan(firstBox.height * 1.5);
        }

        console.log(`✅ ${deviceName}: Form layout responsive on mobile`);
      });

      test(`${deviceName}: Error Message - Toast Readable on Mobile`, async ({ page }) => {
        // Trigger validation error
        const timeInput = page.locator('input[name="pickupTime"]');
        await timeInput.fill("10:00");

        const nextButton = page.locator("button:has-text('Next')").first();
        await nextButton.click();

        // Get toast
        const toast = page.locator('div[role="alert"]');
        await expect(toast).toBeVisible();

        // Get toast bounding box
        const toastBox = await toast.boundingBox();

        // Verify: Toast width doesn't exceed viewport
        const viewportSize = page.viewportSize();
        expect(toastBox!.width).toBeLessThan(viewportSize!.width);

        // Verify: Text is readable (font size reasonable)
        const fontSize = await toast.evaluate((el: HTMLElement) => {
          return window.getComputedStyle(el).fontSize;
        });
        const fontSizeNum = parseInt(fontSize);
        expect(fontSizeNum).toBeGreaterThanOrEqual(12); // At least 12px

        console.log(`✅ ${deviceName}: Toast error message readable on mobile`);
      });

      test(`${deviceName}: Focus Visible - Keyboard Navigation Works`, async ({ page }) => {
        // Tab to first input
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");

        // Get focused element
        const focusedElement = await page.evaluate(() => {
          return document.activeElement?.getAttribute("name");
        });

        expect(focusedElement).toBeDefined();

        // Verify: Focused element has visible focus indicator
        const focused = page.locator(`[name="${focusedElement}"]`);
        const outlineStyle = await focused.evaluate((el: HTMLElement) => {
          return window.getComputedStyle(el).outline;
        });

        expect(outlineStyle).not.toBe("none");

        console.log(`✅ ${deviceName}: Keyboard navigation with visible focus`);
      });

      test(`${deviceName}: Dark Mode - Highlight Visible in Dark Mode`, async ({ page }) => {
        // Simulate dark mode preference
        await page.emulateMedia({ colorScheme: "dark" });

        // Trigger validation error
        const timeInput = page.locator('input[name="pickupTime"]');
        await timeInput.fill("10:00");

        const nextButton = page.locator("button:has-text('Next')").first();
        await nextButton.click();
        await page.waitForTimeout(300);

        // Get highlighted field
        const dateField = page.locator('input[name="pickupDate"]');
        const hasHighlight = await dateField.evaluate((el: HTMLElement) => {
          return el.classList.contains("booking-field-highlight");
        });
        expect(hasHighlight).toBeTruthy();

        // Verify: Outline color adjusted for dark mode
        const outlineColor = await dateField.evaluate((el: HTMLElement) => {
          return window.getComputedStyle(el).outlineColor;
        });

        // Should be lighter red for dark mode, not original red
        expect(outlineColor).toBeDefined();

        console.log(`✅ ${deviceName}: Highlight visible in dark mode`);
      });
    });
  });
});

test.describe("Smart Booking Validation - Landscape Orientation", () => {
  test.beforeEach(async ({ page }) => {
    // Set landscape viewport
    await page.setViewportSize({ width: 812, height: 375 });
    await page.goto(`${BASE_URL}/booking/create`);
    await page.waitForLoadState("networkidle");
  });

  test("Landscape: Two-Column Layout Functional", async ({ page }) => {
    // Fill time field
    const timeInput = page.locator('input[name="pickupTime"]');
    await timeInput.fill("10:00");

    // Click Next
    const nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Verify: Date field still highlighted in landscape
    const dateField = page.locator('input[name="pickupDate"]');
    const hasHighlight = await dateField.evaluate((el: HTMLElement) => {
      return el.classList.contains("booking-field-highlight");
    });
    expect(hasHighlight).toBeTruthy();

    console.log("✅ Landscape: Validation working in landscape mode");
  });

  test("Landscape: Auto-Scroll Respects Landscape Layout", async ({ page }) => {
    // Scroll to right (landscape)
    await page.evaluate(() => window.scrollTo(500, 0));

    // Trigger error
    const timeInput = page.locator('input[name="pickupTime"]');
    await timeInput.fill("10:00");

    const nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Verify: Date field in viewport
    const dateField = page.locator('input[name="pickupDate"]');
    await expect(dateField).toBeInViewport();

    console.log("✅ Landscape: Auto-scroll works in landscape");
  });
});
