// Tests for TASK-ROOT-SUPPORT-03's errorCaptureService: redaction pipeline
// (the hard security requirement) and the requirePlatformRoleLocal
// placeholder middleware, in isolation. No test runner (Jest/Vitest) is
// configured in this repo — run directly via tsx, following the pattern in
// server/services/bookingCodeService.test.ts:
//
//   npx tsx --test server/root/services/errorCaptureService.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_PLATFORM_ROLES,
  buildErrorRecordDocument,
  MUTATION_PLATFORM_ROLES,
  REDACTED_FIELD_KEY_SUBSTRINGS,
  requirePlatformRoleLocal,
  sanitizeErrorPayload,
  sanitizeMessageText,
} from './errorCaptureService';

describe('sanitizeErrorPayload — redaction (bad case: secrets present)', () => {
  test('strips password/otp/token/cookie/authorization/secret fields at every nesting depth', () => {
    const raw = {
      message: 'Login failed',
      user: {
        email: 'driver@example.com',
        password: 'hunter2-super-secret',
        newPassword: 'another-secret',
      },
      request: {
        headers: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          Cookie: 'connect.sid=s%3AabcdEFGH123.signature; other=1',
        },
        body: {
          otp: '482913',
          refreshToken: 'refresh-secret-value',
          nested: {
            apiKey: 'sk_live_ABC123',
            webhookSecret: 'whsec_ABC123',
          },
        },
      },
      tags: [{ sessionId: 'sess_abc123', ok: 'value' }],
    };

    const { sanitized, strippedKeys } = sanitizeErrorPayload(raw);
    const serialized = JSON.stringify(sanitized);

    // The actual bad case is caught: none of the raw secret values survive
    // anywhere in the sanitized output.
    for (const secretValue of [
      'hunter2-super-secret',
      'another-secret',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      's%3AabcdEFGH123.signature',
      '482913',
      'refresh-secret-value',
      'sk_live_ABC123',
      'whsec_ABC123',
      'sess_abc123',
    ]) {
      assert.equal(serialized.includes(secretValue), false, `secret value leaked: ${secretValue}`);
    }

    // Non-sensitive fields are preserved (happy-path data isn't collateral damage).
    assert.equal((sanitized as any).message, 'Login failed');
    assert.equal((sanitized as any).user.email, 'driver@example.com');
    assert.equal((sanitized as any).tags[0].ok, 'value');

    // The redaction actually fired — not just silently no-opping.
    assert.ok(strippedKeys.includes('password'));
    assert.ok(strippedKeys.includes('newPassword'));
    assert.ok(strippedKeys.includes('Authorization'));
    assert.ok(strippedKeys.includes('Cookie'));
    assert.ok(strippedKeys.includes('otp'));
    assert.ok(strippedKeys.includes('refreshToken'));
    assert.ok(strippedKeys.includes('apiKey'));
    assert.ok(strippedKeys.includes('webhookSecret'));
    assert.ok(strippedKeys.includes('sessionId'));
  });

  test('happy path: a payload with no sensitive fields passes through unchanged', () => {
    const raw = { bookingId: 'BK123', module: 'booking', message: 'Vehicle not found for route' };
    const { sanitized, strippedKeys } = sanitizeErrorPayload(raw);
    assert.deepEqual(sanitized, raw);
    assert.deepEqual(strippedKeys, []);
  });
});

describe('sanitizeMessageText — inline secret scrubbing in free text', () => {
  test('redacts a Bearer token embedded in a message string', () => {
    const text = 'Upstream call failed: Authorization: Bearer abc.def-ghi_JKL==';
    const result = sanitizeMessageText(text);
    assert.equal(result.includes('abc.def-ghi_JKL=='), false);
    assert.match(result, /\[REDACTED\]/);
  });

  test('redacts password=value embedded in a message string', () => {
    const text = 'Validation failed for password=hunter2super';
    const result = sanitizeMessageText(text);
    assert.equal(result.includes('hunter2super'), false);
  });

  test('redacts a connect.sid cookie value even without a "cookie" keyword nearby', () => {
    const text = 'Set-Cookie header was connect.sid=s%3AabcXYZ.sig123; Path=/';
    const result = sanitizeMessageText(text);
    assert.equal(result.includes('s%3AabcXYZ.sig123'), false);
  });

  test('redacts a JWT-shaped string without mangling an ordinary file path', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const withJwt = sanitizeMessageText(`token dump: ${jwt}`);
    assert.equal(withJwt.includes(jwt), false);

    const filePathMessage = 'Unhandled exception in server.routes.ts:142';
    const sanitizedPath = sanitizeMessageText(filePathMessage);
    assert.equal(sanitizedPath, filePathMessage, 'an ordinary dotted file path must not be treated as a JWT');
  });
});

describe('buildErrorRecordDocument — end-to-end redaction before storage shape is built', () => {
  test('a sample error payload containing password/token/cookie fields is fully redacted in the built document', () => {
    const built = buildErrorRecordDocument({
      source: 'api_5xx',
      message: 'Save failed: password=hunter2, token=abc123secret',
      stack: 'Error: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c\n  at handler',
      clientContext: { browser: 'Chrome 120', os: 'macOS', url: 'https://app.example.com?token=leak-me' },
      apiResponseSnapshot: { error: 'invalid', debug: { password: 'hunter2', cookie: 'connect.sid=abcXYZ.sig' } },
    });

    const serialized = JSON.stringify(built);
    for (const secretValue of ['hunter2', 'abc123secret', 'leak-me', 'abcXYZ.sig']) {
      assert.equal(serialized.includes(secretValue), false, `secret leaked in built ErrorRecord document: ${secretValue}`);
    }
    assert.equal(built.errorId.startsWith('ERR-'), true);
    assert.ok(built.correlationId.length > 0, 'a correlation ID is always generated even if none was supplied');
    assert.ok(built.redactedFieldKeys.length > 0, 'redaction must have actually fired for this payload');
  });
});

describe('REDACTED_FIELD_KEY_SUBSTRINGS — documented list matches the hard security requirement', () => {
  test('covers passwords, OTP, tokens, cookies, and authorization headers explicitly', () => {
    for (const required of ['password', 'otp', 'token', 'cookie', 'authorization']) {
      assert.ok(
        REDACTED_FIELD_KEY_SUBSTRINGS.includes(required as any),
        `required substring "${required}" missing from REDACTED_FIELD_KEY_SUBSTRINGS`,
      );
    }
  });
});

describe('requirePlatformRoleLocal — placeholder RootAccessService.requirePlatformRole', () => {
  function mockRes() {
    const state: { statusCode?: number; body?: unknown } = {};
    const res = {
      status(code: number) {
        state.statusCode = code;
        return res;
      },
      json(body: unknown) {
        state.body = body;
        return res;
      },
    };
    return { res: res as any, state };
  }

  test('403s a tenant-scoped user (no platformRole at all)', () => {
    const middleware = requirePlatformRoleLocal(ALL_PLATFORM_ROLES);
    const { res, state } = mockRes();
    let nextCalled = false;
    middleware({ user: { role: 'client', tenantId: 'abc' } } as any, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(state.statusCode, 403);
  });

  test('403s a platform user whose role is not in the allowed set', () => {
    const middleware = requirePlatformRoleLocal(MUTATION_PLATFORM_ROLES);
    const { res, state } = mockRes();
    let nextCalled = false;
    middleware({ user: { platformRole: 'PLATFORM_READ_ONLY_AUDITOR' } } as any, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(state.statusCode, 403);
  });

  test('allows a user with an allowed platformRole through to next()', () => {
    const middleware = requirePlatformRoleLocal(ALL_PLATFORM_ROLES);
    const { res } = mockRes();
    let nextCalled = false;
    middleware({ user: { platformRole: 'PLATFORM_SUPPORT_ADMIN' } } as any, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  test('also reads platformRole via a Mongoose-document-shaped .get() accessor', () => {
    const middleware = requirePlatformRoleLocal(ALL_PLATFORM_ROLES);
    const { res } = mockRes();
    let nextCalled = false;
    const mongooseLikeUser = {
      get(key: string) {
        return key === 'platformRole' ? 'PLATFORM_ROOT' : undefined;
      },
    };
    middleware({ user: mongooseLikeUser } as any, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });
});
