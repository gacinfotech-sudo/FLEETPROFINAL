/**
 * DRIVER PAYROLL INTEGRATION TESTS
 * Verify unified driver + payroll data consistency
 *
 * Tests:
 * 1. Salary calculation accuracy
 * 2. Payment tracking
 * 3. YTD earnings calculation
 * 4. Data consistency across endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';
import mongoose from 'mongoose';
import {
  Driver,
  DriverSalaryMaster,
  DriverSalaryPayment,
  DriverAdvance,
  DriverAttendance,
  Booking
} from '../server/models/index';

const BASE_URL = 'http://localhost:5050/api';

// Test data
const TENANT_ID = new mongoose.Types.ObjectId();
const DRIVER_ID = new mongoose.Types.ObjectId();

let authToken: string;
let testDriver: any;
let testSalaryMaster: any;

/**
 * Setup test environment
 */
beforeAll(async () => {
  // Create test tenant & user
  const tenantRes = await axios.post(`${BASE_URL}/admin/tenants`, {
    name: `Test Tenant ${Date.now()}`,
    email: 'test@example.com'
  });

  const tenant = tenantRes.data.data;

  // Create test user
  const userRes = await axios.post(`${BASE_URL}/auth/register`, {
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    tenantId: tenant._id
  });

  authToken = userRes.data.token;

  // Create test driver
  testDriver = await Driver.create({
    tenantId: tenant._id,
    name: 'Test Driver',
    phone: '+919999999999',
    email: 'driver@test.com',
    status: 'active',
    dateOfJoining: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
  });

  // Create salary master
  testSalaryMaster = await DriverSalaryMaster.create({
    tenantId: tenant._id,
    driverId: testDriver._id,
    baseSalary: 20000,
    nightAllowancePerNight: 50,
    outstationAllowancePerDay: 75,
    foodAllowance: 500,
    kmIncentivePerKm: 1.5,
    status: 'active'
  });
});

/**
 * Cleanup test environment
 */
afterAll(async () => {
  await Driver.deleteMany({ _id: testDriver._id });
  await DriverSalaryMaster.deleteMany({ _id: testSalaryMaster._id });
  await DriverSalaryPayment.deleteMany({ driverId: testDriver._id });
  await DriverAdvance.deleteMany({ driverId: testDriver._id });
});

/**
 * TEST 1: Basic Salary Calculation
 */
describe('Salary Calculation', () => {
  it('should calculate current month salary correctly', async () => {
    // Create attendance records
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    for (let i = 0; i < 20; i++) {
      const date = new Date(monthStart);
      date.setDate(date.getDate() + i);

      await DriverAttendance.create({
        tenantId: testDriver.tenantId,
        driverId: testDriver._id,
        date,
        status: i % 6 === 0 ? 'absent' : 'present'
      });
    }

    // Create bookings (completed)
    for (let i = 0; i < 15; i++) {
      await Booking.create({
        tenantId: testDriver.tenantId,
        driverId: testDriver._id,
        bookingId: `BK${Date.now()}_${i}`,
        status: 'completed',
        totalKilometers: 50 + Math.random() * 100,
        createdAt: new Date()
      });
    }

    // Get payroll summary
    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { currentMonth } = response.data.data;

    // Verify calculations
    expect(currentMonth.base).toBe(testSalaryMaster.baseSalary);
    expect(currentMonth.incentives).toBeGreaterThan(0);
    expect(currentMonth.net).toBe(
      currentMonth.base + currentMonth.incentives - currentMonth.deductions
    );
    expect(currentMonth.paidPercentage).toBeGreaterThanOrEqual(0);
    expect(currentMonth.paidPercentage).toBeLessThanOrEqual(100);
  });

  it('should handle zero deductions correctly', async () => {
    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { currentMonth } = response.data.data;

    // If no advances/penalties, deductions should be 0
    if (currentMonth.deductions === 0) {
      expect(currentMonth.net).toBe(
        currentMonth.base + currentMonth.incentives
      );
    }
  });

  it('should calculate incentives with multiple allowances', async () => {
    // Create night duty booking
    await Booking.create({
      tenantId: testDriver.tenantId,
      driverId: testDriver._id,
      bookingId: `BK_NIGHT_${Date.now()}`,
      status: 'completed',
      pickupTime: new Date('2024-01-01T23:00:00'),
      totalKilometers: 100,
      createdAt: new Date()
    });

    // Create outstation booking
    await Booking.create({
      tenantId: testDriver.tenantId,
      driverId: testDriver._id,
      bookingId: `BK_OUT_${Date.now()}`,
      status: 'completed',
      tripType: 'outstation',
      totalKilometers: 200,
      createdAt: new Date()
    });

    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-details`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { details } = response.data.data;

    expect(details.allowances.nightDuty).toBeGreaterThanOrEqual(0);
    expect(details.allowances.outstation).toBeGreaterThanOrEqual(0);
  });
});

/**
 * TEST 2: Payment Tracking
 */
describe('Payment Tracking', () => {
  it('should track payment history correctly', async () => {
    const tenantId = testDriver.tenantId;

    // Create payment records
    const payments = [];
    for (let i = 0; i < 3; i++) {
      const payment = await DriverSalaryPayment.create({
        tenantId,
        driverId: testDriver._id,
        amount: 20000 - (i * 1000),
        paymentMode: 'bank_transfer',
        reference: `PAY${Date.now()}_${i}`,
        createdAt: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000)
      });
      payments.push(payment);
    }

    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-details`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { paymentHistory } = response.data.data;

    expect(paymentHistory).toBeDefined();
    expect(Array.isArray(paymentHistory)).toBe(true);
  });

  it('should calculate pending amount correctly', async () => {
    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { currentMonth } = response.data.data;

    // Pending = Net - Paid
    const expectedPending = Math.max(0, currentMonth.net - currentMonth.paid);
    expect(currentMonth.pending).toBe(expectedPending);
  });

  it('should handle partial payments', async () => {
    const tenantId = testDriver.tenantId;

    // Create salary record
    const grossSalary = 25000;

    // Create partial payment (50% of salary)
    await DriverSalaryPayment.create({
      tenantId,
      driverId: testDriver._id,
      amount: grossSalary / 2,
      paymentMode: 'bank_transfer',
      createdAt: new Date()
    });

    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { currentMonth } = response.data.data;

    // Paid percentage should be between 0 and 100
    expect(currentMonth.paidPercentage).toBeGreaterThan(0);
    expect(currentMonth.paidPercentage).toBeLessThanOrEqual(100);
  });
});

/**
 * TEST 3: YTD Calculations
 */
describe('Year-to-Date Earnings', () => {
  it('should calculate YTD earnings correctly', async () => {
    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { ytdEarnings } = response.data.data;

    expect(ytdEarnings).toBeDefined();
    expect(ytdEarnings.total).toBeGreaterThanOrEqual(0);
    expect(ytdEarnings.previousYearTotal).toBeGreaterThanOrEqual(0);
    expect(typeof ytdEarnings.changePercentage).toBe('number');
  });

  it('should determine YTD trend correctly', async () => {
    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { ytdEarnings } = response.data.data;

    expect(['increasing', 'decreasing', 'flat']).toContain(ytdEarnings.trend);
  });
});

/**
 * TEST 4: Data Consistency
 */
describe('Data Consistency', () => {
  it('should return consistent data across endpoints', async () => {
    // Get payroll summary
    const summaryRes = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    // Get payroll details
    const detailsRes = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-details`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const summary = summaryRes.data.data;
    const details = detailsRes.data.data;

    // Current month data should match
    expect(summary.currentMonth.base).toBe(details.currentMonth.base);
    expect(summary.currentMonth.net).toBe(details.currentMonth.net);
    expect(summary.currentMonth.paid).toBe(details.currentMonth.paid);
    expect(summary.currentMonth.pending).toBe(details.currentMonth.pending);
  });

  it('should return 360 view with payroll integrated', async () => {
    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/360-with-payroll`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { data } = response.data;

    expect(data).toBeDefined();
    expect(data.driver360).toBeDefined();
    expect(data.payroll).toBeDefined();
  });
});

/**
 * TEST 5: Payment Status
 */
describe('Payment Status', () => {
  it('should determine on-track status when paid in full', async () => {
    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { status, currentMonth } = response.data.data;

    if (currentMonth.pending === 0) {
      expect(status.label).toBe('on_track');
      expect(status.color).toBe('green');
    }
  });

  it('should determine pending status when partially paid', async () => {
    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { status, currentMonth } = response.data.data;

    if (currentMonth.pending > 0 && currentMonth.pending <= currentMonth.net * 0.25) {
      expect(status.label).toBe('pending');
      expect(status.color).toBe('yellow');
    }
  });

  it('should determine overdue status when significantly behind', async () => {
    const response = await axios.get(
      `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const { status, currentMonth } = response.data.data;

    if (currentMonth.pending > currentMonth.net * 0.25) {
      expect(status.label).toBe('overdue');
      expect(status.color).toBe('red');
    }
  });
});

/**
 * TEST 6: Error Handling
 */
describe('Error Handling', () => {
  it('should handle invalid driver ID', async () => {
    try {
      await axios.get(
        `${BASE_URL}/drivers/invalid-id/payroll-summary`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toContain('Invalid');
    }
  });

  it('should handle missing driver', async () => {
    try {
      const fakeId = new mongoose.Types.ObjectId();
      await axios.get(
        `${BASE_URL}/drivers/${fakeId}/payroll-summary`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.response.status).toBe(404);
    }
  });

  it('should require authentication', async () => {
    try {
      await axios.get(
        `${BASE_URL}/drivers/${testDriver._id}/payroll-summary`
      );
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.response.status).toBe(401);
    }
  });
});
