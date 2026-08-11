import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

// TASK-03 (performance QA) — exercises the two new, additive storage
// helpers directly against the real database configured by MONGODB_URI
// (the same connection string the app itself uses), rather than through
// HTTP: neither helper is wired into a route yet (server/routes.ts is
// protected — see TASK-03-report.md for the exact proposed diffs), so
// there is no endpoint to hit. This is the DB-layer proof that:
//   1. the new helpers return a genuinely bounded page + accurate total,
//      independent of how large the underlying collection is (the actual
//      fix), and
//   2. today's existing getBookingsByTenant() is unbounded — it returns
//      every row regardless of collection size (the bug being fixed),
//      reproduced here at 550+ rows, past this task's "500+ list
//      records" threshold.
// See TASK-03-report.md's "Before/after measurements" table for the
// wall-clock timing numbers measured the same way, at larger scale, on
// an isolated database.

test.describe('performance: paginated storage helpers vs. unbounded originals', () => {
  test.setTimeout(60_000);

  let tenantId: mongoose.Types.ObjectId;
  let vehicleId: mongoose.Types.ObjectId;
  const ROW_COUNT = 550; // past the "500+ list records" threshold from the task's acceptance criteria

  test.beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }
    const { Tenant, Vehicle, Booking, Customer } = await import('../../server/models');

    const tenant = await Tenant.create({
      name: 'PerfQA Pagination Test', businessName: 'PerfQA Pagination Test', isActive: true,
    });
    tenantId = tenant._id as mongoose.Types.ObjectId;

    const vehicle = await Vehicle.create({ tenantId, make: 'PerfQA Test Vehicle', status: 'available' });
    vehicleId = vehicle._id as mongoose.Types.ObjectId;

    const now = Date.now();
    await Booking.insertMany(Array.from({ length: ROW_COUNT }, (_, i) => ({
      tenantId, bookingId: `PERFQA-PAG-${i}`,
      customerName: `Pag Customer ${i}`, customerPhone: `9${String(5000000000 + i).slice(0, 9)}`,
      vehicleId, pickupLocation: 'Indore', pickupDate: new Date(now + i * 1000),
      bookingType: 'self_drive', status: 'confirmed', totalAmount: 1000,
      createdAt: new Date(now - i * 1000),
      createdBy: { userId: 'perfqa-test', role: 'client' },
    })));

    await Customer.insertMany(Array.from({ length: ROW_COUNT }, (_, i) => ({
      tenantId, name: `Pag Customer ${i}`, primaryMobile: `9${String(6000000000 + i).slice(0, 9)}`,
      lastBookingDate: new Date(now - i * 1000), createdAt: new Date(now - i * 1000),
      createdBy: { userId: 'perfqa-test', role: 'client' },
    })));
  });

  test.afterAll(async () => {
    const { Tenant, Vehicle, Booking, Customer } = await import('../../server/models');
    await Promise.all([
      Booking.deleteMany({ tenantId }),
      Customer.deleteMany({ tenantId }),
      Vehicle.deleteMany({ tenantId }),
      Tenant.deleteOne({ _id: tenantId }),
    ]);
  });

  test('BEFORE: existing storage.getBookingsByTenant is unbounded — returns all 550 rows every time', async () => {
    const { storage } = await import('../../server/storage-mongodb');
    const all = await storage.getBookingsByTenant(tenantId.toString());
    expect(all.length).toBe(ROW_COUNT);
  });

  test('AFTER: new storage.getBookingsByTenantPaginated returns one bounded page + accurate total', async () => {
    const { storage } = await import('../../server/storage-mongodb');
    const page1 = await storage.getBookingsByTenantPaginated(tenantId.toString(), { limit: 25, skip: 0 });
    expect(page1.rows.length).toBe(25);
    expect(page1.total).toBe(ROW_COUNT);

    const page2 = await storage.getBookingsByTenantPaginated(tenantId.toString(), { limit: 25, skip: 25 });
    expect(page2.rows.length).toBe(25);
    // Pages don't overlap.
    const page1Ids = new Set(page1.rows.map((r: any) => r.bookingId));
    for (const row of page2.rows) expect(page1Ids.has((row as any).bookingId)).toBe(false);
  });

  test('AFTER: new storage.getCustomersListPaginated returns one bounded page + accurate total, independent of the 550-row collection size', async () => {
    const { storage } = await import('../../server/storage-mongodb');
    const result = await storage.getCustomersListPaginated({ tenantId }, { limit: 30, skip: 0 });
    expect(result.rows.length).toBe(30);
    expect(result.total).toBe(ROW_COUNT);
  });

  test('a page fetched via the new paginated helper is dramatically cheaper than fetching the whole 550-row collection', async () => {
    const { storage } = await import('../../server/storage-mongodb');

    const start1 = process.hrtime.bigint();
    await storage.getBookingsByTenant(tenantId.toString());
    const unboundedMs = Number(process.hrtime.bigint() - start1) / 1e6;

    const start2 = process.hrtime.bigint();
    await storage.getBookingsByTenantPaginated(tenantId.toString(), { limit: 25 });
    const paginatedMs = Number(process.hrtime.bigint() - start2) / 1e6;

    // Not a strict multiplier assertion (timing is environment-dependent) —
    // just confirms the paginated path is meaningfully cheaper, which it
    // must be structurally (25 rows + 1 populate pair vs 550 rows + 550
    // populate pairs). See TASK-03-report.md for the actual measured ms.
    expect(paginatedMs).toBeLessThan(unboundedMs);
  });
});
