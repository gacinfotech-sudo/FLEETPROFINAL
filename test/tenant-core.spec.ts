/**
 * TENANT CORE TESTS
 * Validates all core tenant workflows: customers, drivers, vehicles, bookings
 */

import { test, expect } from '@playwright/test';
import { TestHelper } from './helpers';
import { TEST_CONFIG, API_ENDPOINTS, HTTP_CODES } from './config';

test.describe('Tenant Core Tests', () => {
  let helper: TestHelper;
  let auth: any;
  let tenantId: string;

  test.beforeEach(async ({ request }) => {
    helper = new TestHelper(request);
    auth = await helper.loginAsTenantOwner('dharvika');
    tenantId = auth.tenantId;
  });

  test.afterEach(async () => {
    if (auth?.token) {
      await helper.logout(auth.token);
    }
  });

  // ========== CUSTOMER CRUD ==========

  test('Create new customer', async () => {
    const customer = await helper.createCustomer(tenantId, auth.token, {
      name: 'Test Customer',
      city: 'Bangalore',
    });

    expect(customer.id).toBeDefined();
    expect(customer.name).toBe('Test Customer');
    expect(customer.city).toBe('Bangalore');
  });

  test('Read customer details', async () => {
    const created = await helper.createCustomer(tenantId, auth.token);
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.tenant.customers}/${created.id}`, auth.token, tenantId);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const customer = await response.json();
    expect(customer.id).toBe(created.id);
    expect(customer.name).toBe(created.name);
  });

  test('Update customer details', async () => {
    const created = await helper.createCustomer(tenantId, auth.token, { name: 'Original Name' });

    const response = await helper.apiCall(
      'PUT',
      `${API_ENDPOINTS.tenant.customers}/${created.id}`,
      auth.token,
      tenantId,
      { name: 'Updated Name' }
    );

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
  });

  test('Delete customer', async () => {
    const created = await helper.createCustomer(tenantId, auth.token);

    const response = await helper.apiCall('DELETE', `${API_ENDPOINTS.tenant.customers}/${created.id}`, auth.token, tenantId);

    expect([HTTP_CODES.OK, HTTP_CODES.NO_CONTENT]).toContain(response.status());

    // Verify customer is deleted
    const getResponse = await helper.apiCall('GET', `${API_ENDPOINTS.tenant.customers}/${created.id}`, auth.token, tenantId);
    expect(getResponse.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Search customers', async () => {
    const created = await helper.createCustomer(tenantId, auth.token, { name: 'Unique Test Customer' });

    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.customers}?search=Unique&limit=10`,
      auth.token,
      tenantId
    );

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    expect(data.customers.length).toBeGreaterThan(0);
  });

  test('List customers with pagination', async () => {
    const response = await helper.listCustomers(tenantId, auth.token, 1, 10);

    expect(response.customers).toBeDefined();
    expect(Array.isArray(response.customers)).toBe(true);
  });

  // ========== DRIVER CRUD ==========

  test('Create new driver', async () => {
    const driver = await helper.createDriver(tenantId, auth.token, {
      name: 'Test Driver',
      licenseNumber: 'DL-TEST-123456',
    });

    expect(driver.id).toBeDefined();
    expect(driver.name).toBe('Test Driver');
    expect(driver.licenseNumber).toBe('DL-TEST-123456');
  });

  test('Read driver details', async () => {
    const created = await helper.createDriver(tenantId, auth.token);
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.tenant.drivers}/${created.id}`, auth.token, tenantId);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const driver = await response.json();
    expect(driver.id).toBe(created.id);
  });

  test('Update driver details', async () => {
    const created = await helper.createDriver(tenantId, auth.token, { name: 'Original Name' });

    const response = await helper.apiCall(
      'PUT',
      `${API_ENDPOINTS.tenant.drivers}/${created.id}`,
      auth.token,
      tenantId,
      { name: 'Updated Name' }
    );

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
  });

  test('Delete driver', async () => {
    const created = await helper.createDriver(tenantId, auth.token);

    const response = await helper.apiCall('DELETE', `${API_ENDPOINTS.tenant.drivers}/${created.id}`, auth.token, tenantId);

    expect([HTTP_CODES.OK, HTTP_CODES.NO_CONTENT]).toContain(response.status());
  });

  test('Search drivers', async () => {
    const created = await helper.createDriver(tenantId, auth.token, { name: 'Unique Test Driver' });

    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.drivers}?search=Unique&limit=10`,
      auth.token,
      tenantId
    );

    expect([HTTP_CODES.OK]).toContain(response.status());
  });

  test('List drivers with pagination', async () => {
    const response = await helper.listDrivers(tenantId, auth.token, 1, 10);

    expect(response.drivers).toBeDefined();
    expect(Array.isArray(response.drivers)).toBe(true);
  });

  // ========== VEHICLE CRUD ==========

  test('Create new vehicle', async () => {
    const vehicle = await helper.createVehicle(tenantId, auth.token, {
      model: 'Innova',
      manufacturer: 'Toyota',
    });

    expect(vehicle.id).toBeDefined();
    expect(vehicle.model).toBe('Innova');
    expect(vehicle.manufacturer).toBe('Toyota');
  });

  test('Read vehicle details', async () => {
    const created = await helper.createVehicle(tenantId, auth.token);
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.tenant.vehicles}/${created.id}`, auth.token, tenantId);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const vehicle = await response.json();
    expect(vehicle.id).toBe(created.id);
  });

  test('Update vehicle details', async () => {
    const created = await helper.createVehicle(tenantId, auth.token, { model: 'Innova' });

    const response = await helper.apiCall(
      'PUT',
      `${API_ENDPOINTS.tenant.vehicles}/${created.id}`,
      auth.token,
      tenantId,
      { model: 'Fortuner' }
    );

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
  });

  test('Delete vehicle', async () => {
    const created = await helper.createVehicle(tenantId, auth.token);

    const response = await helper.apiCall('DELETE', `${API_ENDPOINTS.tenant.vehicles}/${created.id}`, auth.token, tenantId);

    expect([HTTP_CODES.OK, HTTP_CODES.NO_CONTENT]).toContain(response.status());
  });

  test('List vehicles with pagination', async () => {
    const response = await helper.listVehicles(tenantId, auth.token, 1, 10);

    expect(response.vehicles).toBeDefined();
    expect(Array.isArray(response.vehicles)).toBe(true);
  });

  // ========== BOOKING WORKFLOW ==========

  test('Create new booking', async () => {
    const customer = await helper.createCustomer(tenantId, auth.token);
    const booking = await helper.createBooking(tenantId, auth.token, customer.id);

    expect(booking.id).toBeDefined();
    expect(booking.customerId).toBe(customer.id);
    expect(booking.status).toBe('draft');
  });

  test('Assign driver to booking', async () => {
    const customer = await helper.createCustomer(tenantId, auth.token);
    const driver = await helper.createDriver(tenantId, auth.token);
    const booking = await helper.createBooking(tenantId, auth.token, customer.id);

    const updated = await helper.assignDriverToBooking(tenantId, auth.token, booking.id, driver.id);

    expect(updated.driverId).toBe(driver.id);
  });

  test('Assign vehicle to booking', async () => {
    const customer = await helper.createCustomer(tenantId, auth.token);
    const vehicle = await helper.createVehicle(tenantId, auth.token);
    const booking = await helper.createBooking(tenantId, auth.token, customer.id);

    const updated = await helper.assignVehicleToBooking(tenantId, auth.token, booking.id, vehicle.id);

    expect(updated.vehicleId).toBe(vehicle.id);
  });

  test('Complete booking workflow: create -> assign driver -> assign vehicle', async () => {
    const customer = await helper.createCustomer(tenantId, auth.token);
    const driver = await helper.createDriver(tenantId, auth.token);
    const vehicle = await helper.createVehicle(tenantId, auth.token);

    // Create booking
    const booking = await helper.createBooking(tenantId, auth.token, customer.id);
    expect(booking.id).toBeDefined();

    // Assign driver
    await helper.assignDriverToBooking(tenantId, auth.token, booking.id, driver.id);

    // Assign vehicle
    await helper.assignVehicleToBooking(tenantId, auth.token, booking.id, vehicle.id);

    // Verify final state
    const finalBooking = await helper.getBookingDetails(tenantId, auth.token, booking.id);
    expect(finalBooking.driverId).toBe(driver.id);
    expect(finalBooking.vehicleId).toBe(vehicle.id);
  });

  test('List bookings with pagination', async () => {
    const response = await helper.listBookings(tenantId, auth.token, 1, 10);

    expect(response.bookings).toBeDefined();
    expect(Array.isArray(response.bookings)).toBe(true);
  });

  test('Get booking details', async () => {
    const customer = await helper.createCustomer(tenantId, auth.token);
    const created = await helper.createBooking(tenantId, auth.token, customer.id);

    const booking = await helper.getBookingDetails(tenantId, auth.token, created.id);

    expect(booking.id).toBe(created.id);
    expect(booking.customerId).toBe(customer.id);
  });

  // ========== PAYMENT PROCESSING ==========

  test('Record payment for booking', async () => {
    const customer = await helper.createCustomer(tenantId, auth.token);
    const booking = await helper.createBooking(tenantId, auth.token, customer.id);

    const payment = await helper.recordPayment(tenantId, auth.token, booking.id, 5000, 'cash');

    expect(payment.id).toBeDefined();
    expect(payment.amount).toBe(5000);
    expect(payment.method).toBe('cash');
  });

  test('Record multiple payments for same booking', async () => {
    const customer = await helper.createCustomer(tenantId, auth.token);
    const booking = await helper.createBooking(tenantId, auth.token, customer.id);

    const payment1 = await helper.recordPayment(tenantId, auth.token, booking.id, 3000, 'cash');
    const payment2 = await helper.recordPayment(tenantId, auth.token, booking.id, 2000, 'card');

    expect(payment1.id).toBeDefined();
    expect(payment2.id).toBeDefined();
    expect(payment1.id).not.toBe(payment2.id);
  });

  // ========== VALIDATION & ERROR HANDLING ==========

  test('Cannot create customer without required fields', async () => {
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.customers, auth.token, tenantId, {
      // Missing name and mobile
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Cannot create driver with invalid license expiry', async () => {
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.drivers, auth.token, tenantId, {
      name: 'Test Driver',
      mobile: '9123456789',
      licenseNumber: 'DL-TEST-123456',
      licenseExpiry: '2020-12-31', // Expired
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Cannot create duplicate vehicle registration', async () => {
    const regNumber = `KA01TST${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;
    await helper.createVehicle(tenantId, auth.token, { registrationNumber: regNumber });

    // Try to create another with same registration
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.vehicles, auth.token, tenantId, {
      ...TEST_CONFIG.testData.vehicle,
      registrationNumber: regNumber,
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });
});
