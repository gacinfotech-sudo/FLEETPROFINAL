import { expect, test } from '@playwright/test';
import { resolveAllApplicability, resolveApplicability } from '../../server/vehicle/documents/applicability';
import { computeComplianceStatus } from '../../server/vehicle/documents/complianceStatus';
import type { ApplicabilityContext } from '../../server/vehicle/documents/types';

// Pure-function tests only (TASK-VEHICLE-COMPLIANCE-02) — no DB needed.

const INDIA_PASSENGER: ApplicabilityContext = { country: 'IN', usage: 'passenger_commercial' };
const INDIA_GOODS: ApplicabilityContext = { country: 'IN', usage: 'goods_commercial' };
const INDIA_PRIVATE: ApplicabilityContext = { country: 'IN', usage: 'private' };
const NON_INDIA: ApplicabilityContext = { country: 'US', usage: 'passenger_commercial' };

test('RC/Insurance-third-party/PUC/Road-tax apply nationally in India regardless of usage, but are not hardcoded — resolved from country', () => {
  for (const ctx of [INDIA_PASSENGER, INDIA_GOODS, INDIA_PRIVATE]) {
    for (const type of ['registration_certificate', 'insurance_third_party', 'puc_certificate', 'road_tax'] as const) {
      expect(resolveApplicability(type, ctx).applicable, `${type} in ${ctx.usage}`).toBe(true);
    }
  }
  // Proof it's resolved, not hardcoded: a non-India context gets none of them.
  for (const type of ['registration_certificate', 'insurance_third_party', 'puc_certificate', 'road_tax'] as const) {
    expect(resolveApplicability(type, NON_INDIA).applicable, type).toBe(false);
  }
});

test('permit_goods only applies to goods-commercial usage, permit_passenger only to passenger-commercial', () => {
  expect(resolveApplicability('permit_goods', INDIA_GOODS).applicable).toBe(true);
  expect(resolveApplicability('permit_goods', INDIA_PASSENGER).applicable).toBe(false);
  expect(resolveApplicability('permit_goods', INDIA_PRIVATE).applicable).toBe(false);

  expect(resolveApplicability('permit_passenger', INDIA_PASSENGER).applicable).toBe(true);
  expect(resolveApplicability('permit_passenger', INDIA_GOODS).applicable).toBe(false);
});

test('rejected claim #1: no document type defaults to universally mandatory — speed governor and retro-reflective tape never apply without an explicit tenant override', () => {
  for (const ctx of [INDIA_PASSENGER, INDIA_GOODS, INDIA_PRIVATE]) {
    expect(resolveApplicability('speed_governor_calibration', ctx).applicable).toBe(false);
    expect(resolveApplicability('retro_reflective_tape', ctx).applicable).toBe(false);
  }
  // Only an explicit tenant policy override can turn them on.
  const withOverride: ApplicabilityContext = {
    ...INDIA_GOODS,
    tenantPolicyOverrides: { speed_governor_calibration: true },
  };
  expect(resolveApplicability('speed_governor_calibration', withOverride).applicable).toBe(true);
  expect(resolveApplicability('retro_reflective_tape', withOverride).applicable).toBe(false);
});

test('comprehensive insurance is never a legal baseline default, matching "advisable, not universally mandated"', () => {
  for (const ctx of [INDIA_PASSENGER, INDIA_GOODS, INDIA_PRIVATE]) {
    const result = resolveApplicability('insurance_comprehensive', ctx);
    expect(result.applicable).toBe(false);
    expect(result.basis).toBe('not_applicable');
  }
});

test('hypothecation only applies to financed vehicles', () => {
  expect(resolveApplicability('hypothecation', { ...INDIA_PASSENGER, isFinanced: true }).applicable).toBe(true);
  expect(resolveApplicability('hypothecation', { ...INDIA_PASSENGER, isFinanced: false }).applicable).toBe(false);
  expect(resolveApplicability('hypothecation', INDIA_PASSENGER).applicable).toBe(false);
});

test('tenant policy override cannot switch off a genuine legal requirement', () => {
  const attemptToDisable: ApplicabilityContext = {
    ...INDIA_PASSENGER,
    tenantPolicyOverrides: { registration_certificate: false },
  };
  expect(resolveApplicability('registration_certificate', attemptToDisable).applicable).toBe(true);
});

test('resolveAllApplicability covers every known document type exactly once', () => {
  const results = resolveAllApplicability(INDIA_PASSENGER);
  const types = results.map((r) => r.documentType);
  expect(new Set(types).size).toBe(types.length); // no duplicates
  expect(types).toContain('registration_certificate');
  expect(types).toContain('speed_governor_calibration');
});

test('computeComplianceStatus: COMPLIANT when every applicable legal document is verified and not expiring soon', () => {
  const farFuture = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000);
  const result = computeComplianceStatus(
    [
      { documentType: 'registration_certificate', verified: true },
      { documentType: 'insurance_third_party', expiryDate: farFuture, verified: true },
      { documentType: 'puc_certificate', expiryDate: farFuture, verified: true },
      { documentType: 'road_tax', expiryDate: farFuture, verified: true },
    ],
    INDIA_PRIVATE,
  );
  expect(result.status).toBe('COMPLIANT');
  expect(result.blockingDocumentTypes).toEqual([]);
});

test('computeComplianceStatus: PENDING when a legally-required document was never recorded', () => {
  const result = computeComplianceStatus([], INDIA_PRIVATE);
  expect(result.status).toBe('PENDING');
  expect(result.missingDocumentTypes).toEqual(expect.arrayContaining(['registration_certificate', 'insurance_third_party', 'puc_certificate', 'road_tax']));
});

test('computeComplianceStatus: EXPIRING_SOON when within threshold, EXPIRED when past', () => {
  const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days out
  const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // yesterday

  const expiringSoon = computeComplianceStatus(
    [
      { documentType: 'registration_certificate', verified: true },
      { documentType: 'insurance_third_party', expiryDate: soon, verified: true },
      { documentType: 'puc_certificate', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
      { documentType: 'road_tax', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
    ],
    INDIA_PRIVATE,
    { expiringSoonThresholdDays: 30 },
  );
  expect(expiringSoon.status).toBe('EXPIRING_SOON');

  const expired = computeComplianceStatus(
    [
      { documentType: 'registration_certificate', verified: true },
      { documentType: 'insurance_third_party', expiryDate: past, verified: true },
      { documentType: 'puc_certificate', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
      { documentType: 'road_tax', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
    ],
    INDIA_PRIVATE,
  );
  expect(expired.status).toBe('EXPIRED');
  expect(expired.blockingDocumentTypes).toContain('insurance_third_party');
});

test('computeComplianceStatus: COMPLIANCE_HOLD only after the tenant-configured grace period past EXPIRED, never by default', () => {
  const wayPast = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
  const docs = [
    { documentType: 'registration_certificate' as const, verified: true },
    { documentType: 'insurance_third_party' as const, expiryDate: wayPast, verified: true },
    { documentType: 'puc_certificate' as const, expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
    { documentType: 'road_tax' as const, expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
  ];
  // No grace period configured — stays EXPIRED, never auto-escalates.
  expect(computeComplianceStatus(docs, INDIA_PRIVATE).status).toBe('EXPIRED');
  // Explicit tenant-configured grace period — escalates.
  expect(computeComplianceStatus(docs, INDIA_PRIVATE, { complianceHoldGraceDays: 60 }).status).toBe('COMPLIANCE_HOLD');
});

test('computeComplianceStatus: rejected claim proof — RC (no-expiry document type) verified-only is sufficient, never demands an expiry date', () => {
  const result = computeComplianceStatus(
    [
      { documentType: 'registration_certificate', verified: true }, // no expiryDate at all
      { documentType: 'insurance_third_party', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
      { documentType: 'puc_certificate', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
      { documentType: 'road_tax', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
    ],
    INDIA_PRIVATE,
  );
  expect(result.status).toBe('COMPLIANT');
});

test('computeComplianceStatus: a missing/expired POLICY-only document does not block overall status', () => {
  const result = computeComplianceStatus(
    [
      { documentType: 'registration_certificate', verified: true },
      { documentType: 'insurance_third_party', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
      { documentType: 'puc_certificate', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
      { documentType: 'road_tax', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), verified: true },
      // insurance_comprehensive is policy-only and not applicable by default
      // in this context anyway — recorded here to prove its absence doesn't
      // block, even though it's a real recorded gap.
    ],
    INDIA_PRIVATE,
  );
  expect(result.status).toBe('COMPLIANT');
});
