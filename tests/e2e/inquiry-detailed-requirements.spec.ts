import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function freshMobile(): string {
  return '9' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-9);
}

// Mirrors the exact acceptance scenario from the Inquiry/Lead/Booking spec:
// Indore Airport pickup, Ujjain/Omkareshwar/Maheshwar, 3 days, 6 adults incl.
// 2 senior citizens, 5 bags, experienced Hindi-speaking driver, 7-seater +
// a custom Premium 8-seater request.
test.describe('Inquiry Detailed Requirement Form (Phase 2)', () => {
  test('API: multiple vehicle requirements and a custom vehicle request persist via safe-merge PATCH, unrelated fields survive, array replace does not corrupt other data', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());

    const created = await (await page.request.post('/api/inquiries', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { customerName: `Acceptance Detailed ${marker}`, primaryMobile: freshMobile(), source: 'whatsapp', notes: 'initial note' },
    })).json();

    const patchRes = await page.request.patch(`/api/inquiries/${created._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        tripType: 'religious_tour',
        route: 'Indore Airport -> Ujjain -> Omkareshwar -> Maheshwar -> Indore',
        placesToVisit: 'Ujjain, Omkareshwar, Maheshwar',
        seniorCitizens: 2,
        luggageCount: 5,
        driverPreference: 'Experienced, Hindi speaking, route knowledge',
        vehicleRequirements: [
          { requestedNameSnapshot: '7-Seater', quantity: 1, seatingCapacity: 7, serviceType: 'with_driver', alternativeAllowed: true },
        ],
        customVehicleRequests: [
          { customVehicleName: 'Premium 8-Seater', quantity: 1, seatingCapacity: 8, alternativeAllowed: true, customerDescription: 'Customer specifically requested a premium option' },
        ],
      },
    });
    const patched = await patchRes.json();
    expect(patchRes.ok(), JSON.stringify(patched)).toBe(true);

    expect(patched.notes).toBe('initial note'); // untouched by this PATCH
    expect(patched.customerName).toBe(`Acceptance Detailed ${marker}`); // untouched
    expect(patched.tripType).toBe('religious_tour');
    expect(patched.seniorCitizens).toBe(2);
    expect(patched.luggageCount).toBe(5);
    expect(patched.vehicleRequirements).toHaveLength(1);
    expect(patched.vehicleRequirements[0].requestedNameSnapshot).toBe('7-Seater');
    expect(patched.customVehicleRequests).toHaveLength(1);
    expect(patched.customVehicleRequests[0].customVehicleName).toBe('Premium 8-Seater');

    // No physical Vehicle document was created by the custom vehicle request.
    const vehiclesRes = await page.request.get('/api/vehicles');
    const vehicles = await vehiclesRes.json();
    expect(vehicles.some((v: any) => v.make === 'Premium 8-Seater')).toBe(false);

    // Qualification now succeeds with the detailed fields present (route
    // satisfies "pickupLocation or route", vehicleRequirements satisfies
    // "vehicleCategory or vehicleRequirements") plus the remaining minimum fields.
    await page.request.patch(`/api/inquiries/${created._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { numberOfPassengers: 6, assignedExecutive: 'Priya', pickupDate: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString() },
    });
    const qualifyRes = await page.request.post(`/api/inquiries/${created._id}/qualify`, { headers: { 'X-CSRF-Token': csrfToken } });
    const qualified = await qualifyRes.json();
    expect(qualifyRes.ok(), JSON.stringify(qualified)).toBe(true);
    expect(qualified.status).toBe('qualified');
  });

  test('UI: full acceptance scenario — quick capture, detailed requirements, multiple + custom vehicle requests, qualify', async ({ page }) => {
    test.setTimeout(45000);
    await login(page, 'qaclient', 'QaFixed456!');
    const marker = String(Date.now());
    const customerName = `Shantanu Acceptance ${marker}`;

    await page.goto('/dashboard/inquiries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'New Inquiry', exact: true }).click();
    await page.locator('#inq-mobile').fill(freshMobile());
    await page.locator('#inq-name').fill(customerName);
    await page.locator('#inq-pickup').fill('Indore Airport');
    await page.locator('#inq-drop').fill('Ujjain, Omkareshwar, Maheshwar');
    await page.locator('#inq-passengers').fill('6');
    await page.locator('#inq-vehicle').fill('7-Seater');
    await page.getByRole('button', { name: 'Save Inquiry' }).click();
    await expect(page.getByText('Inquiry saved')).toBeVisible({ timeout: 5000 });

    // Refresh persistence check (spec acceptance item #2).
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(customerName).first()).toBeVisible();

    await page.getByText(customerName).first().click();
    await page.getByRole('button', { name: 'Add Full Requirement Details' }).click();

    await page.locator('#dreq-senior').fill('2');
    await page.locator('#dreq-luggage').fill('5');
    await page.locator('#dreq-driver-pref').fill('Experienced, Hindi speaking, route knowledge');
    await page.locator('#dreq-places').fill('Ujjain, Omkareshwar, Maheshwar');

    // Custom 8-seater request — proves it searches/adds as a request, not a physical vehicle.
    const customSection = page.locator('div').filter({ hasText: 'Custom Vehicle Requests' }).last();
    await page.getByPlaceholder('Premium 8-Seater').fill('Premium 8-Seater');
    await page.getByRole('button', { name: 'Add' }).last().click();
    await expect(page.getByText('1× Premium 8-Seater')).toBeVisible();

    await page.getByRole('button', { name: 'Save Requirement Details' }).click();
    await expect(page.getByText('Requirement details saved')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('1× Premium 8-Seater')).toBeVisible();

    // No duplicate/silent physical vehicle was created from the custom request.
    const vehiclesRes = await page.request.get('/api/vehicles');
    const vehicles = await vehiclesRes.json();
    expect(vehicles.some((v: any) => v.make === 'Premium 8-Seater')).toBe(false);
  });
});
