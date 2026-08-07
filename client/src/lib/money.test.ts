// Unit tests for the shared booking-money utility (client/src/lib/money.ts).
//
// Run with: npx tsx --test client/src/lib/money.test.ts
// (No vitest/jest is configured in this repo's client — Node's built-in
// test runner + tsx's on-the-fly TS transform avoids adding a new test
// framework dependency for a handful of pure-function tests.)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toPaise,
  fromPaise,
  calculateBookingFinalTotalPaise,
  calculateBookingFinalTotal,
  calculateRemainingBalancePaise,
  calculateRemainingBalance,
} from "./money";

test("toPaise: converts rupees to integer paise", () => {
  assert.equal(toPaise(6000), 600000);
  assert.equal(toPaise(0), 0);
  assert.equal(toPaise(1.5), 150);
});

test("toPaise: treats missing/invalid input as zero", () => {
  assert.equal(toPaise(undefined), 0);
  assert.equal(toPaise(null), 0);
  assert.equal(toPaise(NaN), 0);
});

test("fromPaise: converts integer paise back to rupees", () => {
  assert.equal(fromPaise(600000), 6000);
  assert.equal(fromPaise(0), 0);
  assert.equal(fromPaise(150), 1.5);
});

test("calculateBookingFinalTotal: Base=6000, everything else 0 -> exactly 6000, no drift", () => {
  const result = calculateBookingFinalTotal({
    amount: 6000,
    tollCharges: 0,
    parkingCharges: 0,
    miscellaneousAmount: 0,
    petrolCharges: 0,
    dieselCharges: 0,
    cngCharges: 0,
  });
  assert.equal(result, 6000);
});

test("calculateBookingFinalTotal: matches the formula previously inlined at :640/:2950/:3158", () => {
  const charges = {
    amount: 5000,
    tollCharges: 120,
    parkingCharges: 60,
    miscellaneousAmount: 250,
    petrolCharges: 300,
    dieselCharges: 0,
    cngCharges: 0,
  };
  // The old inline formula, computed independently here in plain float
  // rupee arithmetic (what all three call sites used to do), to prove the
  // new paise-based utility produces an identical result for well-behaved
  // integer-rupee inputs — i.e. this is a non-regression check, not just a
  // "trust the new code" check.
  const legacyInlineFormula =
    (charges.amount || 0) +
    (charges.tollCharges || 0) +
    (charges.parkingCharges || 0) +
    (charges.miscellaneousAmount || 0) -
    (charges.petrolCharges || 0) -
    (charges.dieselCharges || 0) -
    (charges.cngCharges || 0);

  assert.equal(calculateBookingFinalTotal(charges), legacyInlineFormula);
  assert.equal(calculateBookingFinalTotal(charges), 5130);
});

test("calculateBookingFinalTotal: undefined/missing optional charges behave as zero", () => {
  const result = calculateBookingFinalTotal({ amount: 1000 });
  assert.equal(result, 1000);
});

test("calculateBookingFinalTotal: fractional-rupee inputs never drift by even a paisa (paise-integer arithmetic)", () => {
  // Repeated float addition of values like 33.33 is a classic source of
  // sub-rupee binary-floating-point drift (0.1 + 0.2 !== 0.3 style error).
  // Paise-integer arithmetic must not exhibit that drift.
  const result = calculateBookingFinalTotal({
    amount: 33.33,
    tollCharges: 33.33,
    parkingCharges: 33.34,
    miscellaneousAmount: 0,
    petrolCharges: 0,
    dieselCharges: 0,
    cngCharges: 0,
  });
  assert.equal(result, 100);
});

test("calculateBookingFinalTotalPaise: returns an exact integer (never a float remainder)", () => {
  const paise = calculateBookingFinalTotalPaise({
    amount: 9797,
    tollCharges: 0,
    parkingCharges: 0,
    miscellaneousAmount: 0,
    petrolCharges: 0,
    dieselCharges: 0,
    cngCharges: 0,
  });
  assert.equal(paise, 979700);
  assert.equal(Number.isInteger(paise), true);
});

test("a zero/never-touched hidden fuel-deduction field contributes exactly zero", () => {
  const withZeroFuel = calculateBookingFinalTotal({
    amount: 6000,
    tollCharges: 0,
    parkingCharges: 0,
    miscellaneousAmount: 0,
    petrolCharges: 0,
    dieselCharges: 0,
    cngCharges: 0,
  });
  const withUndefinedFuel = calculateBookingFinalTotal({
    amount: 6000,
    tollCharges: 0,
    parkingCharges: 0,
    miscellaneousAmount: 0,
    // petrol/diesel/cng omitted entirely, as if the field was never
    // registered/touched (matches an untouched React Hook Form field).
  });
  assert.equal(withZeroFuel, 6000);
  assert.equal(withUndefinedFuel, 6000);
});

test("calculateRemainingBalance: advance received reduces remaining balance only", () => {
  const charges = {
    amount: 6000,
    tollCharges: 0,
    parkingCharges: 0,
    miscellaneousAmount: 0,
    petrolCharges: 0,
    dieselCharges: 0,
    cngCharges: 0,
  };
  const finalTotal = calculateBookingFinalTotal(charges);
  const remaining = calculateRemainingBalance(charges, 2000);

  assert.equal(finalTotal, 6000, "final total must be unaffected by advance");
  assert.equal(remaining, 4000);
});

test("calculateRemainingBalance: never goes below zero when advance exceeds the total", () => {
  const charges = { amount: 1000 };
  const remaining = calculateRemainingBalance(charges, 5000);
  assert.equal(remaining, 0);
});

test("calculateRemainingBalance: applies an optional redemption discount on top of advance", () => {
  const charges = { amount: 1000 };
  const remaining = calculateRemainingBalance(charges, 200, 300);
  assert.equal(remaining, 500);
});

test("calculateRemainingBalancePaise: exact integer paise, matches calculateRemainingBalance", () => {
  const charges = { amount: 6000 };
  const paise = calculateRemainingBalancePaise(charges, 2500);
  assert.equal(paise, 350000);
  assert.equal(fromPaise(paise), calculateRemainingBalance(charges, 2500));
});
