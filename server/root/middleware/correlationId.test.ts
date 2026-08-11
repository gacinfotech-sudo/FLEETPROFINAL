// Unit test of the correlation-ID middleware in isolation, per this task's
// acceptance criteria — it isn't wired into the live app by this task, so
// it's proven with mock req/res objects, not a live server.
//
//   npx tsx --test server/root/middleware/correlationId.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { correlationIdMiddleware, isValidCorrelationId, CORRELATION_ID_RESPONSE_HEADER } from './correlationId';

function mockReq(headers: Record<string, string | string[]> = {}) {
  return { headers } as any;
}

function mockRes() {
  const headers: Record<string, string> = {};
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
  };
  return { res: res as any, headers };
}

describe('correlationIdMiddleware', () => {
  test('two sequential requests with no header each get a distinct generated ID', () => {
    const { res: res1, headers: headers1 } = mockRes();
    const { res: res2, headers: headers2 } = mockRes();
    const req1 = mockReq();
    const req2 = mockReq();

    correlationIdMiddleware(req1, res1, () => {});
    correlationIdMiddleware(req2, res2, () => {});

    assert.ok(req1.correlationId);
    assert.ok(req2.correlationId);
    assert.notEqual(req1.correlationId, req2.correlationId);
    assert.equal(headers1[CORRELATION_ID_RESPONSE_HEADER], req1.correlationId);
    assert.equal(headers2[CORRELATION_ID_RESPONSE_HEADER], req2.correlationId);
  });

  test('a request that explicitly supplies X-Correlation-Id keeps that exact ID', () => {
    const { res, headers } = mockRes();
    const req = mockReq({ 'x-correlation-id': 'client-supplied-id-123' });

    correlationIdMiddleware(req, res, () => {});

    assert.equal(req.correlationId, 'client-supplied-id-123');
    assert.equal(headers[CORRELATION_ID_RESPONSE_HEADER], 'client-supplied-id-123');
  });

  test('calls next() exactly once', () => {
    const { res } = mockRes();
    const req = mockReq();
    let callCount = 0;
    correlationIdMiddleware(req, res, () => {
      callCount += 1;
    });
    assert.equal(callCount, 1);
  });

  test('an unsafe/oversized client-supplied ID is rejected and a fresh one is generated instead', () => {
    const { res: resInjection } = mockRes();
    const reqInjection = mockReq({ 'x-correlation-id': 'bad header\r\nvalue with spaces' });
    correlationIdMiddleware(reqInjection, resInjection, () => {});
    assert.notEqual(reqInjection.correlationId, 'bad header\r\nvalue with spaces');

    const { res: resTooLong } = mockRes();
    const reqTooLong = mockReq({ 'x-correlation-id': 'a'.repeat(200) });
    correlationIdMiddleware(reqTooLong, resTooLong, () => {});
    assert.notEqual(reqTooLong.correlationId.length, 200);
  });

  test('an array-valued header (duplicate header sent) uses the first value', () => {
    const { res } = mockRes();
    const req = mockReq({ 'x-correlation-id': ['first-id', 'second-id'] });
    correlationIdMiddleware(req, res, () => {});
    assert.equal(req.correlationId, 'first-id');
  });
});

describe('isValidCorrelationId', () => {
  test('accepts a safe, bounded-length identifier', () => {
    assert.equal(isValidCorrelationId('abc-123_ABC.456'), true);
  });

  test('rejects empty string, non-string, and oversized values', () => {
    assert.equal(isValidCorrelationId(''), false);
    assert.equal(isValidCorrelationId(undefined), false);
    assert.equal(isValidCorrelationId(42 as unknown as string), false);
    assert.equal(isValidCorrelationId('a'.repeat(129)), false);
  });

  test('rejects values with unsafe characters', () => {
    assert.equal(isValidCorrelationId('has space'), false);
    assert.equal(isValidCorrelationId('has\r\nnewline'), false);
    assert.equal(isValidCorrelationId('<script>'), false);
  });
});
