# FleetPro Regression Test Suite

Comprehensive end-to-end test suite for validating FleetPro platform after data recovery. 50+ test cases covering all critical workflows.

## Overview

This test suite validates:
- Authentication & session management
- Platform admin functionality
- Tenant core workflows (customers, drivers, vehicles, bookings)
- Data integrity after recovery
- Multi-tenant isolation
- Error handling & recovery
- Reports & analytics

## Test Files

### 1. `auth.spec.ts` - Authentication Tests
- Root user login/logout
- Tenant owner authentication
- Tenant staff authentication
- Session management
- Token validation
- Cross-tenant access control

**Tests:** 20+

### 2. `platform-admin.spec.ts` - Platform Admin Tests
- Tenant CRUD operations
- Tenant user management
- Role-based permissions
- Tenant suspension/activation
- Platform statistics

**Tests:** 15+

### 3. `tenant-core.spec.ts` - Tenant Core Tests
- Customer CRUD (create, read, update, delete, search)
- Driver CRUD operations
- Vehicle CRUD operations
- Complete booking workflow
- Payment processing
- Validation & error handling

**Tests:** 25+

### 4. `data-integrity.spec.ts` - Data Integrity Tests
- Verifies Dharvika Travels exists
- Validates ~1,730 customers recovered
- Validates ~1,381 bookings recovered
- Validates ~255 drivers recovered
- Validates ~368 vehicles recovered
- Relationship integrity
- Duplicate & orphan detection

**Tests:** 20+

### 5. `multi-tenant.spec.ts` - Multi-Tenant Isolation Tests
- Tenant A cannot access Tenant B data
- Record-level access control
- Modification isolation
- Dashboard isolation
- Admin endpoints isolation
- Token context validation
- Concurrent access isolation

**Tests:** 20+

### 6. `error-handling.spec.ts` - Error Handling Tests
- Invalid credentials
- Validation errors
- 404/Not Found errors
- Conflict errors (duplicates)
- Malformed requests
- Authorization errors
- Rate limiting
- Edge cases

**Tests:** 25+

### 7. `reports-dashboard.spec.ts` - Reports & Analytics Tests
- Dashboard functionality
- Revenue reports
- Booking reports
- Driver reports
- Vehicle reports
- Analytics calculations
- Search & filtering
- Performance benchmarks
- Data quality checks

**Tests:** 25+

## Running Tests

### Prerequisites

```bash
# Ensure MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Ensure FleetPro server is running (port 5050)
npm run dev
```

### Run All Tests

```bash
npm run test:regression
```

### Run Specific Test Suite

```bash
npm run test:regression:auth         # Authentication tests
npm run test:regression:admin        # Platform admin tests
npm run test:regression:core         # Tenant core tests
npm run test:regression:integrity    # Data integrity tests
npm run test:regression:isolation    # Multi-tenant isolation
npm run test:regression:errors       # Error handling tests
npm run test:regression:reports      # Reports & analytics
```

### Run Tests with UI

```bash
npm run test:regression:ui
```

### Run Tests with Coverage

```bash
npm run test:regression:coverage
```

### Run Specific Test

```bash
npx playwright test test/auth.spec.ts --grep "Root user can login"
```

## Test Configuration

Edit `test/config.ts` to customize:

```typescript
export const TEST_CONFIG = {
  baseUrl: 'http://localhost:5050',
  rootUser: { email: 'root@fleetpro.local', password: '...' },
  tenants: {
    dharvika: { id: '...', owner: { email: '...', password: '...' } }
  },
  expectedDataCounts: {
    dharvika: {
      customers: 1730,
      bookings: 1381,
      drivers: 255,
      vehicles: 368
    }
  }
};
```

## Test Data

Test helpers automatically create test data with random values:

```typescript
helper.createCustomer(tenantId, token)    // Creates test customer
helper.createDriver(tenantId, token)      // Creates test driver
helper.createVehicle(tenantId, token)     // Creates test vehicle
helper.createBooking(tenantId, token)     // Creates test booking
```

Override defaults:

```typescript
helper.createCustomer(tenantId, token, {
  name: 'Custom Name',
  city: 'Bangalore'
})
```

## Authentication Flow

```typescript
// Login as root
const auth = await helper.loginAsRoot();
// { token, userId, user }

// Login as tenant owner
const auth = await helper.loginAsTenantOwner('dharvika');
// { token, userId, tenantId, user }

// Login as tenant staff
const auth = await helper.loginAsTenantStaff('dharvika');
// { token, userId, tenantId, user }

// Logout
await helper.logout(auth.token);
```

## API Endpoints

Covered endpoints:

- Auth: `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh-token`
- Root: `/api/root/tenants`, `/api/root/users`, `/api/root/stats`
- Admin: `/api/admin/users`, `/api/admin/permissions`, `/api/admin/roles`
- Tenant: `/api/tenant/customers`, `/api/tenant/drivers`, `/api/tenant/vehicles`
- Bookings: `/api/bookings`, `/api/bookings/:id`
- Reports: `/api/reports/revenue`, `/api/reports/bookings`, `/api/reports/drivers`

## Expected Test Results

### Summary Targets

- **Total Tests:** 150+
- **Pass Rate:** 100%
- **Execution Time:** < 10 minutes
- **Coverage:** > 80% of critical paths

### Individual Suite Targets

| Suite | Tests | Target Pass Rate |
|-------|-------|------------------|
| Auth | 20 | 100% |
| Admin | 15 | 100% |
| Core | 25 | 100% |
| Integrity | 20 | 100% |
| Isolation | 20 | 100% |
| Errors | 25 | 100% |
| Reports | 25 | 100% |

## Retry & Backoff

Tests automatically retry with exponential backoff:

```typescript
// Default: 3 attempts, 1s initial delay, 2x backoff
await helper.retryRequest(async () => {
  // Your code
}, 3);
```

## Common Issues & Solutions

### "Cannot find module" error
```bash
npm install
```

### "ECONNREFUSED" - Server not running
```bash
npm run dev
```

### "ECONNREFUSED" - MongoDB not running
```bash
mongosh --eval "db.adminCommand('ping')"
```

### Tests timeout
Increase timeout in config:
```typescript
TEST_CONFIG.timeout = 60000; // 60 seconds
```

### Database connection errors
Clear sessions:
```bash
mongosh
use fleetpro
db.sessions.deleteMany({})
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Regression Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:latest
        options: --health-cmd="mongosh --eval \"db.adminCommand('ping')\"" --health-interval=10s
        ports:
          - 27017:27017
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run dev &
      - run: sleep 3
      - run: npm run test:regression
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

## Performance Benchmarks

Expected performance:

| Operation | Target Time |
|-----------|------------|
| Login | < 1s |
| Create customer | < 500ms |
| List customers (100 items) | < 1s |
| Get dashboard | < 2s |
| Revenue report | < 2s |
| Booking workflow (create + assign) | < 2s |

## Known Issues & Limitations

### 1. Rate Limiting
Some endpoints may have rate limiting. Tests account for this:
- Login attempts: max 10 per minute
- API requests: configurable per endpoint

### 2. Data Variance
Data counts are expected to vary:
- Allow ±20% variance from expected counts
- Tests check for "no less than 80% of expected"

### 3. Timing
Timestamps may vary between requests:
- Don't assert exact match on createdAt
- Use date range assertions instead

### 4. Concurrent Operations
Tests are sequential to avoid race conditions:
- parallelWorkers: 1 in playwright.config.ts
- Can be increased if test suite is optimized

## Test Results Output

After running tests:

```
test-results/
├── results.json          # Playwright JSON report
├── html/                 # HTML report
│   └── index.html       # Open in browser
└── videos/              # Failed test videos
```

View HTML report:
```bash
open test-results/html/index.html
```

## Maintenance

### Update Test Data

Edit `test/config.ts`:

```typescript
expectedDataCounts: {
  dharvika: {
    customers: 1730,   // Update if data changes
    bookings: 1381,
    drivers: 255,
    vehicles: 368
  }
}
```

### Add New Tests

1. Create `test/feature.spec.ts`
2. Use existing helpers from `test/helpers.ts`
3. Follow naming convention: `test('Should ...')`
4. Update playwright.config.ts if needed

### Debug Failing Test

```bash
# Run with verbose output
npx playwright test test/auth.spec.ts --headed

# Debug mode (opens inspector)
npx playwright test test/auth.spec.ts --debug

# View trace for failed test
npx playwright show-trace test-results/trace.zip
```

## Resources

- [Playwright Docs](https://playwright.dev)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Test Assertions](https://playwright.dev/docs/test-assertions)
- [Debugging Tests](https://playwright.dev/docs/debug)

## Support

For issues or questions:
1. Check test logs in `test-results/`
2. Review config settings in `test/config.ts`
3. Verify server is running on port 5050
4. Check MongoDB connection

---

**Last Updated:** 2026-08-15
**Test Suite Version:** 1.0.0
**Playwright Version:** ^1.62.1
