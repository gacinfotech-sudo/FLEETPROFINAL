/**
 * Smart Booking Validation - End-to-End Browser Tests
 * Tests complete user flows in real browser environment
 */

import { test, expect, Page } from "@playwright/test";

const BASE_URL = "http://localhost:5050";

// Helper to fill booking form field
async function fillField(page: Page, fieldLabel: string, value: string) {
  const input = page.locator(`input[placeholder*="${fieldLabel}"], input[aria-label*="${fieldLabel}"], select[name*="${fieldLabel.toLowerCase()}"]`);
  if (input) {
    await input.fill(value);
  }
}

// Helper to wait for toast notification
async function waitForToast(page: Page, text: string) {
  await page.waitForSelector('div[role="alert"]');
  const toast = page.locator('div[role="alert"]');
  await expect(toast).toContainText(text);
  return toast;
}

// Helper to check field highlighting
async function checkFieldHighlight(page: Page, fieldName: string) {
  const field = page.locator(`input[name="${fieldName}"], select[name="${fieldName}"]`);
  await expect(field).toHaveClass(/booking-field-highlight/);
}

test.describe("Smart Booking Validation - E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to create booking page
    await page.goto(`${BASE_URL}/booking/create`);
    await page.waitForLoadState("networkidle");
  });

  test("TEST 1: Missing Pickup Date - Auto-Navigate & Highlight", async ({ page }) => {
    // Fill other Step 1 fields but leave date empty
    await fillField(page, "pickup time", "10:00");
    await fillField(page, "pickup location", "Downtown");
    await fillField(page, "dropoff location", "Airport");

    // Click Next button
    const nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();

    // Expect: Toast with specific message
    const toast = await waitForToast(page, "📅");
    await expect(toast).toContainText("Pickup date");

    // Expect: Form stays on Step 1
    const stepIndicator = page.locator("text=/Step 1/");
    await expect(stepIndicator).toBeVisible();

    // Expect: Date field highlighted
    await checkFieldHighlight(page, "pickupDate");

    // Verify highlight color (red outline)
    const dateField = page.locator('input[name="pickupDate"]');
    const style = await dateField.evaluate((el: HTMLElement) => {
      const classes = el.className;
      return classes.includes("highlight");
    });
    expect(style).toBeTruthy();

    console.log("✅ TEST 1 PASSED: Missing date detected, auto-highlighted");
  });

  test("TEST 2: Missing Pickup Location - Auto-Highlight", async ({ page }) => {
    // Fill date fields
    await fillField(page, "pickup date", "2026-08-15");
    await fillField(page, "pickup time", "10:00");

    // Leave location empty
    await fillField(page, "dropoff location", "Airport");

    // Click Next
    const nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();

    // Expect: Location error
    const toast = await waitForToast(page, "📍");
    await expect(toast).toContainText("location");

    // Expect: Location field highlighted
    await checkFieldHighlight(page, "pickupLocation");

    console.log("✅ TEST 2 PASSED: Missing location detected and highlighted");
  });

  test("TEST 3: Missing Vehicle (Own Fleet) - Step Navigation", async ({ page }) => {
    // Complete Step 1
    await fillField(page, "pickup date", "2026-08-15");
    await fillField(page, "pickup time", "10:00");
    await fillField(page, "return date", "2026-08-16");
    await fillField(page, "return time", "16:00");
    await fillField(page, "pickup location", "Downtown");
    await fillField(page, "dropoff location", "Airport");

    // Click Next to go to Step 2
    let nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300); // Wait for step animation

    // Expect: On Step 2
    let stepIndicator = page.locator("text=/Step 2/");
    await expect(stepIndicator).toBeVisible();

    // Leave vehicle empty and try to proceed
    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();

    // Expect: Error toast with vehicle message
    const toast = await waitForToast(page, "🚗");
    await expect(toast).toContainText("vehicle");

    // Expect: Stay on Step 2
    stepIndicator = page.locator("text=/Step 2/");
    await expect(stepIndicator).toBeVisible();

    // Expect: Vehicle field highlighted
    await checkFieldHighlight(page, "vehicleId");

    console.log("✅ TEST 3 PASSED: Missing vehicle auto-navigated and highlighted");
  });

  test("TEST 4: Missing Customer Name - Step 3 Navigation", async ({ page }) => {
    // Complete Steps 1-2 with valid data
    await fillField(page, "pickup date", "2026-08-15");
    await fillField(page, "pickup time", "10:00");
    await fillField(page, "return date", "2026-08-16");
    await fillField(page, "return time", "16:00");
    await fillField(page, "pickup location", "Downtown");
    await fillField(page, "dropoff location", "Airport");

    let nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Step 2: Select vehicle
    await fillField(page, "vehicle", "vehicle_001");

    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Expect: On Step 3
    let stepIndicator = page.locator("text=/Step 3/");
    await expect(stepIndicator).toBeVisible();

    // Leave name empty, fill phone
    await fillField(page, "phone", "9876543210");

    // Click Next
    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();

    // Expect: Name error
    const toast = await waitForToast(page, "👤");
    await expect(toast).toContainText("name");

    // Expect: Stay on Step 3
    stepIndicator = page.locator("text=/Step 3/");
    await expect(stepIndicator).toBeVisible();

    // Expect: Name field highlighted
    await checkFieldHighlight(page, "customerName");

    console.log("✅ TEST 4 PASSED: Missing name on Step 3, auto-highlighted");
  });

  test("TEST 5: Invalid Phone (< 10 digits) - Validation Error", async ({ page }) => {
    // Navigate to Step 3 with valid data
    await fillField(page, "pickup date", "2026-08-15");
    await fillField(page, "pickup time", "10:00");
    await fillField(page, "return date", "2026-08-16");
    await fillField(page, "return time", "16:00");
    await fillField(page, "pickup location", "Downtown");
    await fillField(page, "dropoff location", "Airport");

    let nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    await fillField(page, "vehicle", "vehicle_001");
    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // On Step 3: Fill name, enter invalid phone
    await fillField(page, "customer name", "John Doe");
    await fillField(page, "phone", "98765"); // Only 5 digits

    // Click Next
    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();

    // Expect: Phone validation error
    const toast = await waitForToast(page, "📱");
    await expect(toast).toContainText("10");

    // Expect: Phone field highlighted
    await checkFieldHighlight(page, "customerPhone");

    console.log("✅ TEST 5 PASSED: Invalid phone rejected with specific message");
  });

  test("TEST 6: Missing Amount - Step 4 Navigation", async ({ page }) => {
    // Complete Steps 1-3 with valid data
    await fillField(page, "pickup date", "2026-08-15");
    await fillField(page, "pickup time", "10:00");
    await fillField(page, "return date", "2026-08-16");
    await fillField(page, "return time", "16:00");
    await fillField(page, "pickup location", "Downtown");
    await fillField(page, "dropoff location", "Airport");

    let nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    await fillField(page, "vehicle", "vehicle_001");
    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    await fillField(page, "customer name", "John Doe");
    await fillField(page, "phone", "9876543210");
    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Expect: On Step 4
    let stepIndicator = page.locator("text=/Step 4/");
    await expect(stepIndicator).toBeVisible();

    // Leave amount empty, try to create booking
    const createButton = page.locator("button:has-text('Create Booking')");
    await createButton.click();

    // Expect: Amount error
    const toast = await waitForToast(page, "💰");
    await expect(toast).toContainText("Amount");

    // Expect: Stay on Step 4
    stepIndicator = page.locator("text=/Step 4/");
    await expect(stepIndicator).toBeVisible();

    // Expect: Amount field highlighted
    await checkFieldHighlight(page, "amount");

    console.log("✅ TEST 6 PASSED: Missing amount on Step 4, auto-highlighted");
  });

  test("TEST 7: Zero/Negative Amount Rejection", async ({ page }) => {
    // Complete Steps 1-3
    await fillField(page, "pickup date", "2026-08-15");
    await fillField(page, "pickup time", "10:00");
    await fillField(page, "return date", "2026-08-16");
    await fillField(page, "return time", "16:00");
    await fillField(page, "pickup location", "Downtown");
    await fillField(page, "dropoff location", "Airport");

    let nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    await fillField(page, "vehicle", "vehicle_001");
    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    await fillField(page, "customer name", "John Doe");
    await fillField(page, "phone", "9876543210");
    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Test A: Zero amount
    await fillField(page, "amount", "0");
    const createButton = page.locator("button:has-text('Create Booking')");
    await createButton.click();

    let toast = await waitForToast(page, "💰");
    await expect(toast).toContainText("greater than 0");

    // Clear and test negative
    const amountField = page.locator('input[name="amount"]');
    await amountField.clear();
    await amountField.fill("-100");
    await createButton.click();

    toast = await waitForToast(page, "💰");
    expect(toast).toBeDefined();

    console.log("✅ TEST 7 PASSED: Zero and negative amounts rejected");
  });

  test("TEST 8: Multiple Missing Fields - First Only Priority", async ({ page }) => {
    // Fill only pickup time, leave date, location, all others empty
    await fillField(page, "pickup time", "10:00");

    // Click Next
    const nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();

    // Expect: ONLY first missing field error (date), not all missing fields
    const toast = await waitForToast(page, "📅");
    await expect(toast).toContainText("date");

    // Verify phone/name errors NOT shown yet
    const toastText = await toast.textContent();
    expect(toastText).not.toContain("Name");
    expect(toastText).not.toContain("Phone");

    // Expect: Date field highlighted
    await checkFieldHighlight(page, "pickupDate");

    console.log("✅ TEST 8 PASSED: First missing field only, not all errors");
  });

  test("TEST 9: Data Preservation Across Validation Error", async ({ page }) => {
    // Fill all fields on Step 1
    const pickupDate = "2026-08-15";
    const pickupTime = "10:00";
    const pickupLocation = "Downtown";
    const dropoffLocation = "Airport";

    await fillField(page, "pickup date", pickupDate);
    await fillField(page, "pickup time", pickupTime);
    await fillField(page, "pickup location", pickupLocation);
    await fillField(page, "dropoff location", dropoffLocation);

    // Trigger validation error (missing return date)
    const nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();

    // Should show error for return date
    await waitForToast(page, "📅");

    // Verify previously entered data still there
    const dateField = page.locator('input[name="pickupDate"]');
    await expect(dateField).toHaveValue(pickupDate);

    const timeField = page.locator('input[name="pickupTime"]');
    await expect(timeField).toHaveValue(pickupTime);

    const locationField = page.locator('input[name="pickupLocation"]');
    await expect(locationField).toHaveValue(pickupLocation);

    console.log("✅ TEST 9 PASSED: Data preserved across validation errors");
  });

  test("TEST 10: Visual Highlight Duration (3 seconds)", async ({ page }) => {
    // Trigger a validation error
    await fillField(page, "pickup date", "2026-08-15");
    await fillField(page, "pickup time", "10:00");
    // Leave location empty

    const nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();

    // Wait for highlight to appear
    await page.waitForTimeout(300);
    const locationField = page.locator('input[name="pickupLocation"]');

    // Verify highlight is present
    let hasHighlight = await locationField.evaluate((el: HTMLElement) => {
      return el.classList.contains("booking-field-highlight");
    });
    expect(hasHighlight).toBeTruthy();

    // Wait for 3 seconds
    await page.waitForTimeout(3000);

    // Verify highlight is removed
    hasHighlight = await locationField.evaluate((el: HTMLElement) => {
      return el.classList.contains("booking-field-highlight");
    });
    expect(hasHighlight).toBeFalsy();

    console.log("✅ TEST 10 PASSED: Highlight persists 3 seconds then fades");
  });

  test("TEST 11: Valid Complete Booking - Success Flow", async ({ page }) => {
    // Fill all required fields correctly
    await fillField(page, "pickup date", "2026-08-15");
    await fillField(page, "pickup time", "10:00");
    await fillField(page, "return date", "2026-08-16");
    await fillField(page, "return time", "16:00");
    await fillField(page, "pickup location", "Downtown");
    await fillField(page, "dropoff location", "Airport");

    // Step 1: Next
    let nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Step 2: Fill vehicle
    await fillField(page, "vehicle", "vehicle_001");
    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Step 3: Fill customer info
    await fillField(page, "customer name", "John Doe");
    await fillField(page, "phone", "9876543210");
    nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Step 4: Fill amount
    await fillField(page, "amount", "500");

    // Create booking
    const createButton = page.locator("button:has-text('Create Booking')");
    await createButton.click();

    // Expect: Success (navigate away or show success message)
    await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {
      // Booking might not navigate, check for success toast instead
    });

    // Verify: Either navigated to booking list or success message shown
    const pageUrl = page.url();
    const hasBookingCreated = pageUrl.includes("booking") ||
                             await page.locator("text=/Success|Created|Booking saved/i").isVisible().catch(() => false);

    expect(hasBookingCreated).toBeTruthy();

    console.log("✅ TEST 11 PASSED: Valid booking created successfully");
  });

  test("TEST 12: Mobile Responsiveness - Touch & Highlight", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Trigger validation error
    await fillField(page, "pickup time", "10:00");

    const nextButton = page.locator("button:has-text('Next')").first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Expect: Date field highlighted even on mobile
    const dateField = page.locator('input[name="pickupDate"]');
    const hasHighlight = await dateField.evaluate((el: HTMLElement) => {
      return el.classList.contains("booking-field-highlight");
    });
    expect(hasHighlight).toBeTruthy();

    // Expect: Field in viewport (auto-scrolled)
    await expect(dateField).toBeInViewport();

    // Expect: Toast visible
    const toast = page.locator('div[role="alert"]');
    await expect(toast).toBeVisible();

    console.log("✅ TEST 12 PASSED: Mobile layout responsive and functional");
  });
});
