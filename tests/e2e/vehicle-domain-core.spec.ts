import { expect, test } from '@playwright/test';
import {
  deriveBookingEligibility,
  explainBookingIneligibility,
  normalizeRegistrationNumber,
} from '../../server/vehicle/core';
import type { ComplianceStatus, OperationalStatus } from '../../server/vehicle/core';

// Pure-function tests only (TASK-VEHICLE-DOMAIN-01) — no DB, no browser page
// fixture needed, matching the established pattern for pure logic elsewhere
// in this suite (e.g. gps-connection-security.spec.ts's first test).

test('deriveBookingEligibility: eligible only when AVAILABLE, compliance not blocked, and no safety hold', () => {
  expect(deriveBookingEligibility('AVAILABLE', 'COMPLIANT', false)).toBe(true);
  expect(deriveBookingEligibility('AVAILABLE', 'EXPIRING_SOON', false)).toBe(true);
  expect(deriveBookingEligibility('AVAILABLE', 'PENDING', false)).toBe(true);
});

test('deriveBookingEligibility: blocked by any non-AVAILABLE operational status', () => {
  const nonAvailable: OperationalStatus[] = [
    'RESERVED', 'ASSIGNED', 'ON_TRIP', 'RETURNING', 'CLEANING',
    'MAINTENANCE_DUE', 'IN_MAINTENANCE', 'BREAKDOWN', 'ACCIDENT_HOLD', 'INACTIVE', 'SOLD',
  ];
  for (const status of nonAvailable) {
    expect(deriveBookingEligibility(status, 'COMPLIANT', false), status).toBe(false);
  }
});

test('deriveBookingEligibility: blocked by EXPIRED or COMPLIANCE_HOLD compliance, not by lesser compliance states', () => {
  expect(deriveBookingEligibility('AVAILABLE', 'EXPIRED', false)).toBe(false);
  expect(deriveBookingEligibility('AVAILABLE', 'COMPLIANCE_HOLD', false)).toBe(false);
  // Only these two compliance values block eligibility per the spec's exact rule.
  const nonBlocking: ComplianceStatus[] = ['COMPLIANT', 'EXPIRING_SOON', 'PENDING'];
  for (const status of nonBlocking) {
    expect(deriveBookingEligibility('AVAILABLE', status, false), status).toBe(true);
  }
});

test('deriveBookingEligibility: SAFETY_HOLD overrides everything, even AVAILABLE + COMPLIANT', () => {
  expect(deriveBookingEligibility('AVAILABLE', 'COMPLIANT', true)).toBe(false);
});

test('explainBookingIneligibility: returns every applicable reason, not just the first', () => {
  expect(explainBookingIneligibility('BREAKDOWN', 'EXPIRED', true)).toEqual(
    expect.arrayContaining(['SAFETY_HOLD', 'NOT_OPERATIONAL_AVAILABLE', 'COMPLIANCE_BLOCKED']),
  );
  expect(explainBookingIneligibility('BREAKDOWN', 'EXPIRED', true)).toHaveLength(3);
  expect(explainBookingIneligibility('AVAILABLE', 'COMPLIANT', false)).toEqual([]);
});

test('normalizeRegistrationNumber: strips separators and uppercases, matching VendorVehicle behavior', () => {
  expect(normalizeRegistrationNumber('MP09 AB 1234')).toBe('MP09AB1234');
  expect(normalizeRegistrationNumber('mp-09-ab-1234')).toBe('MP09AB1234');
  expect(normalizeRegistrationNumber('MP09AB1234')).toBe('MP09AB1234');
});
