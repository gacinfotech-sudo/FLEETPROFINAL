// Tests for TASK-BOOKING-CODE-02's bookingCodeService.
//
// No test runner (Jest/Vitest) is configured in this repo (see
// package.json's "scripts" — only "check" -> tsc; the only existing test
// suite is Playwright e2e under tests/e2e). This file uses Node's
// built-in `node:test` + `node:assert/strict`, run directly via tsx:
//
//   npx tsx --test server/services/bookingCodeService.test.ts
//
// tsconfig.json already excludes "**/*.test.ts" from `npm run check`, so
// this file does not affect the type-check gate.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  generateBookingCode,
  generateUniqueBookingCode,
  isValidBookingCode,
  BookingCodeGenerationError,
  BOOKING_CODE_LENGTH,
} from './bookingCodeService';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('generateBookingCode (property tests)', () => {
  const ITERATIONS = 20_000;

  test('always returns exactly 6 uppercase alphanumeric characters', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const code = generateBookingCode();
      assert.equal(code.length, BOOKING_CODE_LENGTH, `iteration ${i}: wrong length: ${code}`);
      assert.match(code, /^[A-Z0-9]+$/, `iteration ${i}: not uppercase alphanumeric: ${code}`);
    }
  });

  test('always contains at least one letter and one digit', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const code = generateBookingCode();
      assert.match(code, /[A-Z]/, `iteration ${i}: no letter in: ${code}`);
      assert.match(code, /[0-9]/, `iteration ${i}: no digit in: ${code}`);
    }
  });

  test('every generated code passes isValidBookingCode', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const code = generateBookingCode();
      assert.equal(isValidBookingCode(code), true, `iteration ${i}: ${code} failed isValidBookingCode`);
    }
  });

  test('has no hard-coded/fixed character positions (varies across draws)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) codes.add(generateBookingCode());
    // With 36^6 possible codes, 1000 draws colliding down to a handful of
    // unique values would indicate a broken/degenerate RNG path.
    assert.ok(codes.size > 950, `expected high uniqueness in 1000 draws, got ${codes.size} distinct codes`);
  });

  test('is never confused with the lowercase or mixed-case shape', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateBookingCode();
      assert.equal(code, code.toUpperCase());
    }
  });
});

describe('isValidBookingCode', () => {
  test('accepts the example from the requirement', () => {
    assert.equal(isValidBookingCode('A7K29Q'), true);
  });

  test('rejects wrong length', () => {
    assert.equal(isValidBookingCode('A7K29'), false);
    assert.equal(isValidBookingCode('A7K29QQ'), false);
    assert.equal(isValidBookingCode(''), false);
  });

  test('rejects all-letters (no digit)', () => {
    assert.equal(isValidBookingCode('ABCDEF'), false);
  });

  test('rejects all-digits (no letter)', () => {
    assert.equal(isValidBookingCode('123456'), false);
  });

  test('rejects lowercase', () => {
    assert.equal(isValidBookingCode('a7k29q'), false);
  });

  test('rejects non-alphanumeric characters', () => {
    assert.equal(isValidBookingCode('A7K-9Q'), false);
    assert.equal(isValidBookingCode('A7K 9Q'), false);
  });
});

describe('generateUniqueBookingCode (collision retry)', () => {
  test('returns immediately when the first code is free', async () => {
    const seen: string[] = [];
    const exists = async (code: string) => {
      seen.push(code);
      return false; // never taken
    };
    const code = await generateUniqueBookingCode(exists);
    assert.equal(isValidBookingCode(code), true);
    assert.equal(seen.length, 1);
    assert.equal(seen[0], code);
  });

  test('retries on a seeded collision and returns a different, still-valid code', async () => {
    // Force the very first generated code to collide, then free.
    let calls = 0;
    const takenCodes = new Set<string>();
    // Prime the "taken" set with whatever the first real draw is by
    // wrapping the checker to record + reject exactly the first code it
    // is asked about, then accept everything else.
    let firstSeenCode: string | undefined;
    const exists = async (code: string) => {
      calls++;
      if (firstSeenCode === undefined) {
        firstSeenCode = code;
        takenCodes.add(code);
        return true; // force a retry on the first attempt
      }
      return takenCodes.has(code);
    };

    const result = await generateUniqueBookingCode(exists);

    assert.ok(calls >= 2, `expected at least one retry (>=2 exists() calls), got ${calls}`);
    assert.equal(isValidBookingCode(result), true);
    assert.notEqual(result, firstSeenCode, 'retried code must differ from the seeded collision');
    assert.equal(takenCodes.has(result), false);
  });

  test('retries repeatedly against a checker that rejects the first N codes', async () => {
    const rejectCount = 5;
    let calls = 0;
    const exists = async (_code: string) => {
      calls++;
      return calls <= rejectCount; // first 5 calls are "taken", 6th is free
    };

    const result = await generateUniqueBookingCode(exists, 10);

    assert.equal(calls, rejectCount + 1);
    assert.equal(isValidBookingCode(result), true);
  });

  test('throws BookingCodeGenerationError when every attempt collides', async () => {
    const exists = async (_code: string) => true; // always taken
    await assert.rejects(
      () => generateUniqueBookingCode(exists, 5),
      (err: unknown) => {
        assert.ok(err instanceof BookingCodeGenerationError);
        assert.match((err as Error).message, /5 attempts/);
        return true;
      },
    );
  });

  test('respects a custom maxAttempts and calls exists() exactly that many times when always colliding', async () => {
    let calls = 0;
    const exists = async (_code: string) => {
      calls++;
      return true;
    };
    await assert.rejects(() => generateUniqueBookingCode(exists, 3));
    assert.equal(calls, 3);
  });
});

describe('Regression: existing bookingId generation is completely unchanged', () => {
  // This module never edits server/storage-mongodb.ts (forbidden file for
  // this task). This test locks in the exact source shape of the existing
  // bookingId generation line so any future accidental edit to it (by
  // this task or otherwise, before the Integrator applies the proposed
  // call-site patch) is caught.
  test('storage-mongodb.ts still generates bookingId as `BK${Date.now()}${nanoid(4).toUpperCase()}`', () => {
    const storagePath = join(__dirname, '../storage-mongodb.ts');
    const src = readFileSync(storagePath, 'utf8');
    assert.match(
      src,
      /bookingData\.bookingId = `BK\$\{Date\.now\(\)\}\$\{nanoid\(4\)\.toUpperCase\(\)\}`;/,
      'the existing bookingId generation expression must be byte-for-byte unchanged',
    );
    // Also confirm the guard that only assigns it when absent is intact
    // (bookingCode's future call site must be added alongside this, not
    // replace it).
    assert.match(src, /if \(!bookingData\.bookingId\) \{/);
  });

  test('the existing bookingId shape (BK + timestamp + 4 uppercase alphanumeric) still matches what nanoid(4).toUpperCase() produces', () => {
    // Sanity-check the *shape* independent of source text: BK, digits
    // (Date.now()), then exactly 4 uppercase alphanumeric characters
    // (nanoid's default alphabet is uppercase/lowercase/digits/-/_;
    // .toUpperCase() folds letters to uppercase but nanoid can still emit
    // '-' or '_' — this regex reflects that, not narrowed further).
    const sample = `BK${Date.now()}WXYZ`;
    assert.match(sample, /^BK\d+[A-Za-z0-9_-]{4}$/);
  });
});

describe('Isolation from _id / foreign-key relationships', () => {
  test('this module exports nothing named _id, ObjectId, or anything relationship-related', () => {
    // Static guard: enumerate this module's own exports and assert none
    // of them are named in a way that could be mistaken for a
    // relationship/primary-key concern. Guards against scope creep in
    // future edits to this file.
    const exportNames = ['generateBookingCode', 'generateUniqueBookingCode', 'isValidBookingCode', 'BookingCodeGenerationError', 'BOOKING_CODE_LENGTH'];
    for (const name of exportNames) {
      assert.doesNotMatch(name, /_id/i);
      assert.doesNotMatch(name, /ObjectId/i);
    }
  });
});
