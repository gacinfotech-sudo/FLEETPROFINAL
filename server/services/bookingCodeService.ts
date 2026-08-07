// Short, human-friendly Booking Code (TASK-BOOKING-CODE-02).
//
// FleetPro's Booking already has TWO identifiers before this module:
//   1. `_id` (Mongoose ObjectId)   — the real primary key. Every foreign-key
//      relationship in the schema (`ref: 'Booking'`) points at this. Never
//      touched, referenced, or duplicated by anything in this file.
//   2. `bookingId` (String, e.g. "BK1786085579949K7QP", ~19 chars) —
//      generated at server/storage-mongodb.ts:630 as
//      `BK${Date.now()}${nanoid(4).toUpperCase()}`. This is the existing
//      long display id the bug report calls "too long". This module does
//      NOT change, remove, or re-generate it.
//
// This module adds the THIRD, purely additive identifier:
//   3. `bookingCode` — exactly 6 uppercase alphanumeric characters
//      (A-Z0-9), guaranteed to contain at least one letter and one digit,
//      unique, human-friendly (e.g. "A7K29Q").
//
// Design notes:
// - `generateBookingCode()` is a pure function: no I/O, no DB/model
//   access, no dependency on server/models/index.ts (which this task is
//   forbidden from editing). It uses Node's built-in `crypto.randomInt`
//   for unbiased character selection — "cryptographically fine" per the
//   task brief, not a hard security requirement.
// - The full A-Z0-9 charset (36 symbols) is used rather than an
//   ambiguity-reduced subset (e.g. excluding 0/O/1/I/L), because the
//   requirement explicitly spells out "Uppercase alphanumeric (A-Z0-9)"
//   and the acceptance criteria check exactly that range. If a future
//   iteration wants to exclude visually-ambiguous characters for
//   phone/SMS readback, swap `ALL_CHARS` below — the rest of the module
//   (length, letter+digit guarantee, uniqueness retry) is unaffected.
// - At least one letter AND one digit is guaranteed by rejection
//   sampling (regenerate until both classes are present) rather than by
//   forcing fixed positions, so codes don't all share a predictable
//   letter-then-digit shape. With a 6-character draw from a 36-symbol
//   alphabet, the chance of landing all-letters or all-digits in one
//   draw is well under 2%, so this converges in ~1 attempt on average
//   and is bounded (see MAX_GENERATION_ATTEMPTS) so it can never spin
//   forever.
// - `generateUniqueBookingCode()` layers DB-backed collision retry on
//   top of the pure generator. It takes an injected `exists` checker
//   function instead of importing the Mongoose `Booking` model directly,
//   so this module has zero hard dependency on server/models/index.ts
//   and can be fully unit-tested without a database. The real call site
//   (proposed, not wired in by this task — see the report) supplies a
//   checker backed by `Booking.exists({ bookingCode: code })`.

import { randomInt } from 'crypto';

/** Exact, fixed length of a booking code. */
export const BOOKING_CODE_LENGTH = 6;

/** Full uppercase-alphanumeric charset the code is drawn from (A-Z0-9). */
const ALL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Upper bound on rejection-sampling attempts inside generateBookingCode(). */
const MAX_GENERATION_ATTEMPTS = 1000;

/** Upper bound on DB collision-retry attempts inside generateUniqueBookingCode(). */
export const DEFAULT_MAX_UNIQUE_ATTEMPTS = 10;

const HAS_LETTER = /[A-Z]/;
const HAS_DIGIT = /[0-9]/;

/**
 * True iff `code` satisfies the full booking-code format contract:
 * exactly BOOKING_CODE_LENGTH uppercase alphanumeric characters,
 * containing at least one letter and at least one digit.
 */
export function isValidBookingCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  if (code.length !== BOOKING_CODE_LENGTH) return false;
  if (!/^[A-Z0-9]+$/.test(code)) return false;
  return HAS_LETTER.test(code) && HAS_DIGIT.test(code);
}

function randomChars(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALL_CHARS[randomInt(0, ALL_CHARS.length)];
  }
  return out;
}

/**
 * Pure generator: returns a fresh 6-character uppercase alphanumeric
 * booking code containing at least one letter and one digit. No I/O, no
 * uniqueness check against the database — see generateUniqueBookingCode
 * for that.
 */
export function generateBookingCode(): string {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = randomChars(BOOKING_CODE_LENGTH);
    if (HAS_LETTER.test(code) && HAS_DIGIT.test(code)) {
      return code;
    }
  }
  // Practically unreachable (see the ~2% analysis above, applied
  // MAX_GENERATION_ATTEMPTS times), but fail loudly rather than return an
  // invalid code if it is ever somehow hit.
  throw new Error(
    `generateBookingCode: failed to produce a code with both a letter and a digit after ${MAX_GENERATION_ATTEMPTS} attempts`,
  );
}

/** Injected collision check: resolve true if `code` is already taken. */
export type BookingCodeExistsChecker = (code: string) => Promise<boolean>;

export class BookingCodeGenerationError extends Error {
  constructor(attempts: number) {
    super(`generateUniqueBookingCode: could not find a unique booking code after ${attempts} attempts`);
    this.name = 'BookingCodeGenerationError';
  }
}

/**
 * Generates a booking code, retrying against the DB-backed `exists`
 * checker on collision, up to `maxAttempts` times. Throws
 * BookingCodeGenerationError if it can't find a free code in time
 * (astronomically unlikely at 36^6 ≈ 2.18B possible codes, but bounded
 * so a pathological/misbehaving `exists` checker can't hang forever).
 */
export async function generateUniqueBookingCode(
  exists: BookingCodeExistsChecker,
  maxAttempts: number = DEFAULT_MAX_UNIQUE_ATTEMPTS,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateBookingCode();
    if (!(await exists(code))) {
      return code;
    }
  }
  throw new BookingCodeGenerationError(maxAttempts);
}
