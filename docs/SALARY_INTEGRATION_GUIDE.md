# Monthly Salary Formula - Integration Guide

## Overview

This guide shows how to integrate the monthly salary formula into your FleetPro application.

The formula implemented is:
```
NET PAYABLE = BASE + ALLOWANCES - DEDUCTIONS - ADVANCES - PENALTIES
```

## Files Created

### 1. Core Service
**File:** `/server/services/salaryCoreCalculationService.ts`

Contains all salary calculation logic:
- `calculateMonthlySalary()` - Calculate for single driver
- `calculateTeamSalaries()` - Calculate for multiple drivers
- `calculateTeamSalaryStatistics()` - Get statistical summary
- `formatSalaryCalculation()` - Format for display
- `validateSalaryCalculation()` - Validate calculation

### 2. API Routes
**File:** `/server/routes/salaryCalculationRoutes.ts`

REST API endpoints:
- `POST /api/salary/calculate` - Single driver calculation
- `POST /api/salary/calculate-team` - Team calculation
- `GET /api/salary/statistics/:tenantId/:month/:year` - Statistics
- `GET /api/salary/slip/:tenantId/:driverId/:month/:year` - Formatted slip
- `GET /api/salary/export/:tenantId/:month/:year` - Export data

### 3. Tests
**File:** `/tests/salary-formula.test.ts`

Comprehensive test suite covering:
- Base salary calculation
- Allowances and deductions
- Advances deduction
- Penalties
- Complete formula
- Validation logic
- Error handling

### 4. Documentation
- `docs/SALARY_FORMULA.md` - Complete specification
- `docs/SALARY_FORMULA_QUICK_REFERENCE.md` - Quick reference guide

---

## Integration Steps

### Step 1: Register Routes (server/index.ts or routes.ts)

```typescript
import salaryCalculationRoutes from './routes/salaryCalculationRoutes';

// Add to express app
app.use('/api/salary', salaryCalculationRoutes);
```

### Step 2: Create Required Models (if not existing)

Ensure these collections exist in your database:

```typescript
// DriverSalaryMaster - Salary configuration
// DriverSalaryLedger - Salary transactions
// DriverAdvance - Driver advances
// DriverRecovery - Damage/challan recoveries
// DriverSalaryPayment - Payment history
```

### Step 3: Create Database Indexes

For optimal performance, create these indexes:

```javascript
// Run in MongoDB:

// DriverSalaryMaster
db.driversalarymaster.createIndex({ tenantId: 1, driverId: 1, status: 1 });

// DriverSalaryLedger
db.driversalaryledger.createIndex({ tenantId: 1, driverId: 1, month: 1, year: 1 });
db.driversalaryledger.createIndex({ tenantId: 1, driverId: 1, transactionType: 1 });

// DriverAdvance
db.driveradvance.createIndex({ tenantId: 1, driverId: 1, status: 1 });

// DriverRecovery
db.driverrecovery.createIndex({ tenantId: 1, driverId: 1, date: 1 });
```

### Step 4: Run Tests

```bash
npm test -- salary-formula
```

Expected output:
```
✓ salary-formula.test.ts (8 tests)
  ✓ Basic Salary Formula
    ✓ should calculate salary with only base salary
    ✓ should calculate salary with base + allowances
    ✓ should calculate salary with deductions applied
    ✓ should calculate salary with advances deduction
    ✓ should calculate salary with penalties
    ✓ should calculate complete salary formula
  ✓ Validation and Error Handling
    ✓ should validate salary calculation
    ✓ should format salary calculation for display
```

### Step 5: Integrate with Frontend (Optional)

#### Display Salary Dashboard

```typescript
// React component
import { useQuery } from '@tanstack/react-query';

function SalaryDashboard({ tenantId, month, year }) {
  const { data: stats } = useQuery({
    queryKey: ['salary-stats', tenantId, month, year],
    queryFn: () => fetch(`/api/salary/statistics/${tenantId}/${month}/${year}`)
      .then(r => r.json())
      .then(r => r.data)
  });

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h2>Salary Dashboard - {month}/{year}</h2>
      <div>Total Drivers: {stats.driverCount}</div>
      <div>Total Gross: ₹{stats.totalGrossEarnings}</div>
      <div>Total Net: ₹{stats.totalNetPayable}</div>
      <div>Total Paid: ₹{stats.totalAmountPaid}</div>
      <div>Total Pending: ₹{stats.totalAmountPending}</div>
    </div>
  );
}
```

#### Display Individual Salary Slip

```typescript
function SalarySlip({ tenantId, driverId, month, year }) {
  const { data: slip } = useQuery({
    queryKey: ['salary-slip', driverId, month, year],
    queryFn: () => fetch(`/api/salary/slip/${tenantId}/${driverId}/${month}/${year}`)
      .then(r => r.json())
      .then(r => r.data)
  });

  if (!slip) return <div>Loading...</div>;

  const { components, netPayable } = slip;

  return (
    <div style={{ fontFamily: 'monospace' }}>
      <h3>Salary Slip - {slip.driverName}</h3>
      <table>
        <tr>
          <td>Base Salary</td>
          <td>₹{components.baseSalary}</td>
        </tr>
        <tr>
          <td>Allowances</td>
          <td>₹{components.allowances.total}</td>
        </tr>
        <tr>
          <td>Deductions</td>
          <td>₹{components.deductions.total}</td>
        </tr>
        <tr>
          <td>Advances</td>
          <td>₹{components.advances.total}</td>
        </tr>
        <tr>
          <td>Penalties</td>
          <td>₹{components.penalties.total}</td>
        </tr>
        <tr style={{ fontWeight: 'bold' }}>
          <td>NET PAYABLE</td>
          <td>₹{netPayable}</td>
        </tr>
      </table>
    </div>
  );
}
```

---

## Usage Examples

### Example 1: Calculate Single Driver Salary

**Request:**
```bash
curl -X POST http://localhost:5000/api/salary/calculate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tenantId": "507f1f77bcf86cd799439011",
    "driverId": "507f1f77bcf86cd799439012",
    "month": 8,
    "year": 2026
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "driverId": "507f1f77bcf86cd799439012",
    "driverName": "Rajesh Kumar",
    "month": 8,
    "year": 2026,
    "components": {
      "baseSalary": 25000,
      "allowances": {
        "nightAllowance": 1500,
        "outstationAllowance": 1000,
        "foodAllowance": 800,
        "otherAllowances": 0,
        "total": 3300
      },
      "deductions": {
        "absenceDeduction": 1000,
        "damageRecovery": 500,
        "challanRecovery": 0,
        "cashShortage": 0,
        "fuelExcess": 0,
        "otherDeductions": 0,
        "total": 1500
      },
      "advances": {
        "advanceAmount": 3000,
        "total": 3000
      },
      "penalties": {
        "penaltyAmount": 800,
        "total": 800
      }
    },
    "grossEarnings": 28300,
    "totalDeductions": 5300,
    "netPayable": 23000,
    "amountPaid": 0,
    "amountPending": 23000,
    "calculatedAt": "2026-08-13T10:30:00Z"
  },
  "formatted": "... formatted salary slip string ..."
}
```

### Example 2: Calculate Team Salaries

**Request:**
```bash
curl -X POST http://localhost:5000/api/salary/calculate-team \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tenantId": "507f1f77bcf86cd799439011",
    "month": 8,
    "year": 2026
  }'
```

**Response:**
```json
{
  "success": true,
  "period": "8/2026",
  "driverCount": 10,
  "summary": {
    "totalGrossEarnings": 280000,
    "totalDeductions": 42500,
    "totalNetPayable": 237500,
    "totalAmountPaid": 120000,
    "totalAmountPending": 117500,
    "averageSalary": 23750
  },
  "calculations": [
    { /* driver 1 calculation */ },
    { /* driver 2 calculation */ },
    ...
  ]
}
```

### Example 3: Get Salary Statistics

**Request:**
```bash
curl http://localhost:5000/api/salary/statistics/507f1f77bcf86cd799439011/8/2026 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "8/2026",
    "driverCount": 10,
    "totalGrossEarnings": 280000,
    "totalDeductions": 42500,
    "totalNetPayable": 237500,
    "totalAmountPaid": 120000,
    "totalAmountPending": 117500,
    "averageSalary": 23750,
    "lowestSalary": 18000,
    "highestSalary": 32000
  }
}
```

### Example 4: Export Salaries as CSV

**Request:**
```bash
curl http://localhost:5000/api/salary/export/507f1f77bcf86cd799439011/8/2026?format=csv \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o salaries-8-2026.csv
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    API Request                              │
│  POST /api/salary/calculate                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Fetch Data from Collections                          │
├─────────────────────────────────────────────────────────────┤
│ 1. DriverSalaryMaster (Base salary config)                  │
│ 2. DriverSalaryLedger (Transactions for month)              │
│ 3. DriverAdvance (Active advances)                          │
│ 4. DriverRecovery (Damage/challan for month)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│      Calculate Salary Components                             │
├─────────────────────────────────────────────────────────────┤
│ Base Salary          ← Salary Master                         │
│ Allowances           ← Ledger entries (allowance types)      │
│ Deductions           ← Ledger entries (deduction types)      │
│ Advances             ← Advance records (deduction mode)      │
│ Penalties            ← Ledger entries (penalty type)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│      Apply Formula                                           │
├─────────────────────────────────────────────────────────────┤
│ Gross    = Base + Allowances                                │
│ Deduct   = Deductions + Advances + Penalties                │
│ Net      = Gross - Deduct                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│    Validate Result                                           │
├─────────────────────────────────────────────────────────────┤
│ ✓ Net ≥ 0                                                   │
│ ✓ Gross > 0                                                 │
│ ✓ Deductions reasonable                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│        Return Result                                         │
├─────────────────────────────────────────────────────────────┤
│ MonthlySalaryCalculation object with:                       │
│ - Component breakdown                                       │
│ - Calculation summary                                       │
│ - Formatted salary slip                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Issue: "No active salary master found"

**Cause:** Driver doesn't have a salary configuration

**Solution:**
```javascript
// Create salary master for driver
const salaryMaster = new DriverSalaryMaster({
  tenantId: tenantId,
  driverId: driverId,
  name: 'Driver Name',
  salaryType: 'fixed_monthly',
  baseSalary: 25000,
  status: 'active',
  salaryStartDate: new Date()
});
await salaryMaster.save();
```

### Issue: "Negative deductions error"

**Cause:** Ledger entry has negative amount

**Solution:**
```javascript
// Verify ledger entries
const entries = await DriverSalaryLedger.find({
  driverId: driverId,
  month: 8,
  year: 2026
});

// Check for negative amounts
console.log(entries.filter(e => e.amount < 0));
```

### Issue: "Advance not being deducted"

**Cause:** Advance status not 'paid' or deduction mode issue

**Solution:**
```javascript
// Update advance status and deduction mode
await DriverAdvance.updateOne(
  { _id: advanceId },
  {
    status: 'paid',
    deductionMode: 'full_next_salary'
  }
);
```

---

## Performance Optimization

### Caching Strategy

```typescript
// Cache salary masters (they rarely change)
const cache = new Map();

async function getSalaryMasterCached(tenantId, driverId) {
  const key = `${tenantId}:${driverId}`;
  if (cache.has(key)) {
    return cache.get(key);
  }

  const master = await DriverSalaryMaster.findOne({
    tenantId, driverId, status: 'active'
  });

  cache.set(key, master);
  return master;
}
```

### Batch Processing

```typescript
// Process salaries for 50 drivers at once
const drivers = await Driver.find({ tenantId }).limit(50);
const calculations = await Promise.all(
  drivers.map(d => calculateMonthlySalary({
    tenantId,
    driverId: d._id,
    month: 8,
    year: 2026
  }))
);
```

---

## Next Steps

1. ✅ Register API routes in main server file
2. ✅ Create database indexes for performance
3. ✅ Run test suite to verify implementation
4. ✅ Integrate frontend components
5. ✅ Set up salary calculation scheduler (monthly automation)
6. ✅ Create admin dashboard for salary management
7. ✅ Set up email notifications for salary slip

---

## Support

For issues or questions:
1. Check `SALARY_FORMULA.md` for detailed specification
2. Review `SALARY_FORMULA_QUICK_REFERENCE.md` for quick lookup
3. Check test cases in `tests/salary-formula.test.ts` for examples
4. Review API route implementation in `server/routes/salaryCalculationRoutes.ts`
