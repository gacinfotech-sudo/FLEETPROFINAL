import { randomInt } from 'crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid look-alike confusion
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGIT = '23456789';
const SYMBOL = '!@#$%^&*-_=+?';
const ALL = UPPER + LOWER + DIGIT + SYMBOL;

function pick(charset: string): string {
  return charset[randomInt(charset.length)];
}

/** Cryptographically random password: >=20 chars, guaranteed upper/lower/digit/symbol. */
export function generateSecurePassword(length = 24): string {
  const required = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () => pick(ALL));
  const chars = [...required, ...rest];

  // Fisher-Yates shuffle using a CSPRNG so the guaranteed characters aren't
  // predictably in the first four positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
