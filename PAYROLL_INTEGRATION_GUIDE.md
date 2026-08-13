# Payroll Integration Service Guide

## Overview

The **PayrollIntegrationService** provides a comprehensive solution to link salary calculations (in the `DriverSalary` collection) to accounting ledger entries (in the `DriverSalaryLedger` collection). This ensures complete accounting integrity and audit trails for all payroll operations.

### Key Objectives

- ✅ **Automatic Integration**: Every salary calculation automatically creates corresponding ledger entries
- ✅ **Component Breakdown**: Each salary component (base, incentives, deductions) gets its own ledger entry
- ✅ **Accounting Integrity**: Running balances are maintained and verified
- ✅ **Batch Processing**: Support for monthly payroll processing of multiple drivers
- ✅ **Reconciliation**: Verify that all salaries have corresponding ledger entries
- ✅ **Audit Trail**: Complete history of all integration operations

## Architecture

### Service Structure

```
PayrollIntegrationService
├── Salary Analysis
│   └── extractSalaryComponentBreakdown()
├── Ledger Generation
│   ├── generateLedgerEntryDefinitions()
│   └── definitionsToLedgerInputs()
├── Integration Operations
│   ├── linkSalaryToLedger()
│   ├── linkBatchSalariesToLedger()
│   └── linkMonthlyPayrollToLedger()
├── Verification & Reporting
│   ├── reconcileSalaryLedger()
│   └── getPayrollIntegrationReport()
└── API Routes
    ├── POST /api/payroll/integration/link-salary
    ├── POST /api/payroll/integration/link-monthly
    ├── POST /api/payroll/integration/reconcile
    ├── GET /api/payroll/integration/status/:month/:year
    ├── GET /api/payroll/integration/salary-breakdown/:salaryId
    └── GET /api/payroll/integration/report/:month/:year
```

### Data Flow

```
DriverSalary
    ↓
    └─→ extractSalaryComponentBreakdown()
        ├─ Base Salary
        ├─ Trip Incentive
        ├─ KM Incentive
        ├─ Allowances (Night, Outstation, Food)
        ├─ Overtime Earnings
        ├─ Bonus
        ├─ Manual Credits
        └─ Deductions (Advance, Penalty, Damage, Challan, etc.)
        
            ↓
            └─→ generateLedgerEntryDefinitions()
                └─→ createBatchLedgerEntries()
                    └─→ DriverSalaryLedger (Multiple entries)
                        
                            ↓
                            └─→ verifyLedgerBalance()
```

## Core Functions

### 1. Extract Salary Component Breakdown

**Function**: `extractSalaryComponentBreakdown(salary: IDriverSalary)`

Extracts individual salary components from a DriverSalary document for ledger entry creation.

**Input**:
```typescript
salary: IDriverSalary {
  baseSalary: number;
  tripIncentive: number;
  kmIncentive: number;
  nightAllowance: number;
  outstationAllowance: number;
  foodAllowance: number;
  overtimeEarning: number;
  bonus: number;
  manualCredits: number;
  absenceDeduction: number;
  advanceRecovery: number;
  penalty: number;
  damageRecovery: number;
  // ... and more
}
```

**Output**:
```typescript
{
  baseSalary: 15000,
  tripIncentive: 2500,
  kmIncentive: 1200,
  nightAllowance: 800,
  // ... all components
  totalEarnings: 25000,
  totalDeductions: 3500,
  grossSalary: 25000,
  netSalary: 21500
}
```

### 2. Link Single Salary to Ledger

**Function**: `linkSalaryToLedger(salary, tenantId, month, year, createdBy?)`

Links a single salary calculation to ledger entries.

**Example Usage**:
```typescript
const salary = await DriverSalary.findById(salaryId);

const result = await linkSalaryToLedger(
  salary,
  tenantId,
  8,     // August
  2026,
  {
    userId: 'admin-123',
    role: 'payroll_manager'
  }
);

console.log(result);
// {
//   salaryId: '65abc123...',
//   driverId: '65xyz789...',
//   driverName: 'John Doe',
//   month: 8,
//   year: 2026,
//   status: 'success',
//   grossSalary: 25000,
//   totalDeductions: 3500,
//   netSalary: 21500,
//   ledgerEntriesCreated: 12,
//   ledgerEntries: ['65ab...', '65cd...', ...],
//   errors: [],
//   warnings: [],
//   timestamp: 2026-08-13T10:30:00Z
// }
```

**Return Type**: `PayrollIntegrationResult`

### 3. Link Monthly Payroll

**Function**: `linkMonthlyPayrollToLedger(tenantId, month, year, createdBy?)`

Links all salaries for a specific month to ledger entries in batch.

**Example Usage**:
```typescript
const { results, summary } = await linkMonthlyPayrollToLedger(
  tenantId,
  8,      // August
  2026,
  {
    userId: 'admin-123',
    role: 'payroll_manager'
  }
);

console.log(summary);
// {
//   totalProcessed: 15,
//   successCount: 15,
//   partialCount: 0,
//   failedCount: 0,
//   totalGrossSalary: 375000,
//   totalDeductions: 52500,
//   totalNetSalary: 322500,
//   totalLedgerEntries: 180
// }
```

### 4. Reconcile Salary and Ledger

**Function**: `reconcileSalaryLedger(tenantId, month, year)`

Verifies that every salary has corresponding ledger entries.

**Example Usage**:
```typescript
const reconciliation = await reconcileSalaryLedger(tenantId, 8, 2026);

console.log(reconciliation);
// {
//   totalSalaries: 15,
//   salariesWithLedger: 15,
//   salariesWithoutLedger: 0,
//   missingReconciliations: []
// }
```

### 5. Get Integration Report

**Function**: `getPayrollIntegrationReport(tenantId, month, year)`

Gets comprehensive integration status and statistics for a payroll period.

**Example Usage**:
```typescript
const report = await getPayrollIntegrationReport(tenantId, 8, 2026);

console.log(report);
// {
//   period: '8/2026',
//   totalSalaries: 15,
//   totalGrossSalary: 375000,
//   totalDeductions: 52500,
//   totalNetSalary: 322500,
//   totalLedgerEntries: 180,
//   averageEntriesPerSalary: 12,
//   reconciliationStatus: {
//     totalSalaries: 15,
//     salariesWithLedger: 15,
//     salariesWithoutLedger: 0,
//     reconciliationPercentage: 100
//   }
// }
```

## API Endpoints

### 1. Link Single Salary

```bash
POST /api/payroll/integration/link-salary
Content-Type: application/json

{
  "salaryId": "65abc123456789...",
  "month": 8,
  "year": 2026
}

Response:
{
  "success": true,
  "data": {
    "salaryId": "65abc123...",
    "driverId": "65xyz789...",
    "driverName": "John Doe",
    "status": "success",
    "ledgerEntriesCreated": 12,
    "grossSalary": 25000,
    "totalDeductions": 3500,
    "netSalary": 21500
  }
}
```

### 2. Link Monthly Payroll

```bash
POST /api/payroll/integration/link-monthly
Content-Type: application/json

{
  "month": 8,
  "year": 2026
}

Response:
{
  "success": true,
  "data": {
    "results": [
      {
        "salaryId": "...",
        "driverId": "...",
        "status": "success",
        "ledgerEntriesCreated": 12,
        ...
      },
      ...
    ],
    "summary": {
      "totalProcessed": 15,
      "successCount": 15,
      "failedCount": 0,
      "totalGrossSalary": 375000,
      "totalLedgerEntries": 180
    }
  }
}
```

### 3. Reconcile Salary and Ledger

```bash
POST /api/payroll/integration/reconcile
Content-Type: application/json

{
  "month": 8,
  "year": 2026
}

Response:
{
  "success": true,
  "data": {
    "totalSalaries": 15,
    "salariesWithLedger": 15,
    "salariesWithoutLedger": 0,
    "missingReconciliations": []
  }
}
```

### 4. Get Integration Status

```bash
GET /api/payroll/integration/status/8/2026

Response:
{
  "success": true,
  "data": {
    "period": "8/2026",
    "totalSalaries": 15,
    "totalGrossSalary": 375000,
    "totalLedgerEntries": 180,
    "reconciliationStatus": {
      "reconciliationPercentage": 100
    }
  }
}
```

### 5. Get Salary Component Breakdown

```bash
GET /api/payroll/integration/salary-breakdown/65abc123456789...

Response:
{
  "success": true,
  "data": {
    "salaryId": "65abc123...",
    "driverId": "65xyz789...",
    "driverName": "John Doe",
    "month": 8,
    "year": 2026,
    "breakdown": {
      "baseSalary": 15000,
      "tripIncentive": 2500,
      "kmIncentive": 1200,
      "nightAllowance": 800,
      "outstationAllowance": 500,
      "foodAllowance": 300,
      "overtimeEarning": 400,
      "bonus": 1000,
      "manualCredits": 300,
      "totalEarnings": 22000,
      "absenceDeduction": 1500,
      "advanceRecovery": 1000,
      "penalty": 500,
      "damageRecovery": 500,
      "totalDeductions": 3500,
      "grossSalary": 22000,
      "netSalary": 18500
    }
  }
}
```

### 6. Get Detailed Report

```bash
GET /api/payroll/integration/report/8/2026

Response:
{
  "success": true,
  "data": {
    "period": "8/2026",
    "totalSalaries": 15,
    "totalGrossSalary": 375000,
    "totalDeductions": 52500,
    "totalNetSalary": 322500,
    "totalLedgerEntries": 180,
    "averageEntriesPerSalary": 12,
    "reconciliationStatus": {
      "totalSalaries": 15,
      "salariesWithLedger": 15,
      "salariesWithoutLedger": 0,
      "reconciliationPercentage": 100
    }
  }
}
```

## Ledger Entry Types

Each salary component creates one or more ledger entries:

### Earnings Entries (Credits)
- **base_salary** - Base monthly salary
- **trip_incentive** - Trip-based incentive
- **km_incentive** - Kilometer incentive
- **night_allowance** - Night duty allowance
- **outstation_allowance** - Outstation allowance
- **food_allowance** - Food allowance
- **overtime_earning** - Overtime earnings
- **bonus** - Bonus payment
- **manual_incentive** - Manual credits

### Deduction Entries (Debits)
- **absence_deduction** - Deduction for absences
- **advance_recovery** - Recovery of advances from salary
- **loan_recovery** - Recovery of loans
- **penalty** - Penalties and fines
- **damage_recovery** - Damage recovery
- **challan_recovery** - Traffic challan recovery
- **cash_shortage** - Cash shortage deduction
- **fuel_excess** - Fuel excess deduction
- **other_deduction** - Other miscellaneous deductions

## Workflow Example: Complete Monthly Payroll Integration

```typescript
// 1. Calculate all salaries for the month (done separately)
const month = 8, year = 2026;

// 2. Link all salaries to ledger entries
const { results, summary } = await linkMonthlyPayrollToLedger(
  tenantId,
  month,
  year,
  { userId: 'payroll-admin', role: 'payroll_manager' }
);

console.log(`Processed ${summary.totalProcessed} drivers`);
console.log(`Success: ${summary.successCount}, Partial: ${summary.partialCount}, Failed: ${summary.failedCount}`);

// 3. Verify integration
const reconciliation = await reconcileSalaryLedger(tenantId, month, year);
if (reconciliation.salariesWithoutLedger > 0) {
  console.warn('⚠️ Some salaries missing ledger entries:', 
    reconciliation.missingReconciliations);
}

// 4. Get final report
const report = await getPayrollIntegrationReport(tenantId, month, year);
console.log('Integration Report:', report);

// 5. Proceed with salary payments
if (reconciliation.salariesWithoutLedger === 0) {
  console.log('✅ All salaries integrated successfully. Ready for payment.');
  // Proceed with payment workflow
}
```

## Integration Points

The PayrollIntegrationService integrates with:

### Source Collections
- **DriverSalary** - Source of salary calculations
- **DriverSalaryMaster** - Configuration for salary structure
- **DriverAdvance** - Advance deductions
- **DriverRecharge** - Mobile recharge deductions
- **DriverRecovery** - Damage and other recoveries
- **Driver** - Driver information

### Target Collections
- **DriverSalaryLedger** - Accounting ledger entries with running balances

### Related Services
- **ledgerEntryAutomation.ts** - Core ledger entry creation and balance calculation
- **consolidatedSalaryService.ts** - Consolidated salary reporting
- **salaryReportingService.ts** - Payroll analytics and reporting

## Best Practices

### 1. Always Reconcile After Integration
```typescript
const { results, summary } = await linkMonthlyPayrollToLedger(tenantId, month, year);
const reconciliation = await reconcileSalaryLedger(tenantId, month, year);

if (reconciliation.salariesWithoutLedger !== 0) {
  throw new Error('Reconciliation failed: Not all salaries integrated');
}
```

### 2. Batch Processing for Large Payrolls
For tenants with 50+ drivers, process in smaller batches:
```typescript
const drivers = await Driver.find({ tenantId });
const batchSize = 10;

for (let i = 0; i < drivers.length; i += batchSize) {
  const batch = drivers.slice(i, i + batchSize);
  await linkBatchSalariesToLedger(
    batch.map(d => /* DriverSalary for driver */),
    tenantId,
    month,
    year
  );
}
```

### 3. Monitor Integration Metrics
```typescript
const report = await getPayrollIntegrationReport(tenantId, month, year);

if (report.reconciliationStatus.reconciliationPercentage < 100) {
  // Alert: Not all salaries integrated
  alertAdmin({
    message: 'Payroll integration incomplete',
    percentage: report.reconciliationStatus.reconciliationPercentage,
    missing: report.reconciliationStatus.salariesWithoutLedger
  });
}
```

### 4. Validate Before Integration
```typescript
const salary = await DriverSalary.findById(salaryId);

if (!salary.driverId || !salary.grossSalary) {
  throw new Error('Invalid salary record: missing required fields');
}

// Ensure salary master exists
const master = await DriverSalaryMaster.findOne({
  tenantId,
  driverId: salary.driverId
});

if (!master) {
  throw new Error('No salary master configuration found for driver');
}

const result = await linkSalaryToLedger(salary, tenantId, month, year);
```

## Error Handling

### Common Errors and Solutions

**Error**: "Salary record not found"
- **Cause**: SalaryId doesn't exist
- **Solution**: Verify salary ID and ensure salary has been calculated

**Error**: "Ledger balance inconsistency"
- **Cause**: Running balance calculation error
- **Solution**: Check for concurrent updates; verify all entries created sequentially

**Error**: "Failed to link monthly payroll"
- **Cause**: Database connection or multi-driver processing issue
- **Solution**: Check DB connection, retry with smaller batches

## Monitoring and Maintenance

### Regular Checks
```typescript
// Daily reconciliation check
const startOfMonth = new Date();
startOfMonth.setDate(1);

const report = await getPayrollIntegrationReport(
  tenantId,
  startOfMonth.getMonth() + 1,
  startOfMonth.getFullYear()
);

if (report.reconciliationStatus.reconciliationPercentage < 100) {
  // Take action
  console.error('Integration issue detected');
}
```

### Audit Trail
All integration operations include:
- User ID and role who performed the operation
- Timestamp of operation
- Complete before/after state
- Linked ledger entry IDs

## Performance Considerations

- **Batch Size**: Process drivers in batches of 10-20 for optimal performance
- **Concurrent Requests**: Limit to 3-5 concurrent integrations
- **Memory**: Each salary generates 8-15 ledger entries; budget accordingly
- **Database**: Index on `(tenantId, driverId, month, year)` for ledger queries

## Security

The PayrollIntegrationService enforces:
- ✅ Tenant-level isolation
- ✅ Role-based access control (admin, finance, payroll_manager)
- ✅ Audit trail of all operations
- ✅ Immutable ledger entries (no modifications, only new entries)
- ✅ Data integrity verification

## Summary

The **PayrollIntegrationService** provides a robust, auditable system for linking salary calculations to accounting ledgers. It ensures complete accounting integrity, supports batch processing, and provides comprehensive reconciliation and reporting capabilities.

Use it to:
- ✅ Automatically create ledger entries from salary calculations
- ✅ Break down salaries into individual components for accounting
- ✅ Verify integration completeness
- ✅ Generate compliance reports
- ✅ Maintain complete audit trails
