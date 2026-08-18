# PayrollIntegrationService - Quick Reference Guide

## 🎯 Quick Start

### Import the Service
```typescript
import {
  linkSalaryToLedger,
  linkMonthlyPayrollToLedger,
  reconcileSalaryLedger,
  getPayrollIntegrationReport
} from './server/services/payrollIntegrationService';
```

### Link Single Salary
```typescript
const salary = await DriverSalary.findById(salaryId);
const result = await linkSalaryToLedger(salary, tenantId, month, year);
console.log(`Created ${result.ledgerEntriesCreated} ledger entries`);
```

### Link Monthly Payroll
```typescript
const { results, summary } = await linkMonthlyPayrollToLedger(tenantId, month, year);
console.log(`Processed ${summary.totalProcessed} drivers, Success: ${summary.successCount}`);
```

### Verify Integration
```typescript
const reconciliation = await reconcileSalaryLedger(tenantId, month, year);
if (reconciliation.salariesWithoutLedger === 0) {
  console.log('✅ All salaries integrated');
} else {
  console.warn(`⚠️ ${reconciliation.salariesWithoutLedger} salaries missing ledger entries`);
}
```

### Get Report
```typescript
const report = await getPayrollIntegrationReport(tenantId, month, year);
console.log(`Total Gross: ₹${report.totalGrossSalary}`);
console.log(`Reconciliation: ${report.reconciliationStatus.reconciliationPercentage}%`);
```

## 📡 API Endpoints

### Link Single Salary
```
POST /api/payroll/integration/link-salary
{
  "salaryId": "65abc123...",
  "month": 8,
  "year": 2026
}
Response: { success: true, data: PayrollIntegrationResult }
```

### Link Monthly Payroll
```
POST /api/payroll/integration/link-monthly
{
  "month": 8,
  "year": 2026
}
Response: { success: true, data: { results[], summary } }
```

### Reconcile
```
POST /api/payroll/integration/reconcile
{
  "month": 8,
  "year": 2026
}
Response: { 
  success: true, 
  data: { totalSalaries, salariesWithLedger, missingReconciliations[] }
}
```

### Get Status
```
GET /api/payroll/integration/status/8/2026
Response: { 
  success: true, 
  data: { period, totalSalaries, totalGrossSalary, reconciliationStatus }
}
```

### Get Salary Breakdown
```
GET /api/payroll/integration/salary-breakdown/65abc123...
Response: { 
  success: true, 
  data: { breakdown: SalaryComponentBreakdown }
}
```

### Get Report
```
GET /api/payroll/integration/report/8/2026
Response: { 
  success: true, 
  data: { period, totalSalaries, reconciliationStatus, ... }
}
```

## 📊 Data Types

### PayrollIntegrationResult
```typescript
{
  salaryId: string;
  driverId: string;
  driverName: string;
  month: number;
  year: number;
  status: 'success' | 'partial' | 'failed';
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  ledgerEntriesCreated: number;
  ledgerEntries: string[];
  errors: string[];
  warnings: string[];
  timestamp: Date;
}
```

### SalaryComponentBreakdown
```typescript
{
  baseSalary: number;
  tripIncentive: number;
  kmIncentive: number;
  nightAllowance: number;
  outstationAllowance: number;
  foodAllowance: number;
  overtimeEarning: number;
  bonus: number;
  manualCredits: number;
  totalEarnings: number;
  
  absenceDeduction: number;
  advanceRecovery: number;
  loanRecovery: number;
  penalty: number;
  damageRecovery: number;
  challanRecovery: number;
  cashShortage: number;
  fuelExcess: number;
  otherDeductions: number;
  totalDeductions: number;
  
  grossSalary: number;
  netSalary: number;
}
```

## 🔧 Common Tasks

### Check if Integration Successful
```typescript
const result = await linkSalaryToLedger(salary, tenantId, month, year);
if (result.status === 'success' && result.errors.length === 0) {
  console.log('✅ Successfully linked');
}
```

### Get Salary Components for Display
```typescript
const salary = await DriverSalary.findById(salaryId);
const breakdown = extractSalaryComponentBreakdown(salary);
// Use breakdown.baseSalary, breakdown.tripIncentive, etc.
```

### Process All Drivers for Month
```typescript
const { results, summary } = await linkMonthlyPayrollToLedger(tenantId, 8, 2026);

// Check summary
if (summary.failedCount === 0) {
  console.log('✅ All drivers processed');
} else {
  console.error(`❌ ${summary.failedCount} drivers failed`);
  // Find failures
  const failures = results.filter(r => r.status === 'failed');
}
```

### Generate Monthly Report
```typescript
const report = await getPayrollIntegrationReport(tenantId, 8, 2026);

// Format for display
console.log(`Period: ${report.period}`);
console.log(`Total Gross: ₹${report.totalGrossSalary.toLocaleString('en-IN')}`);
console.log(`Total Net: ₹${report.totalNetSalary.toLocaleString('en-IN')}`);
console.log(`Reconciliation: ${report.reconciliationStatus.reconciliationPercentage}%`);
```

### Find Missing Reconciliations
```typescript
const reconciliation = await reconcileSalaryLedger(tenantId, month, year);

if (reconciliation.missingReconciliations.length > 0) {
  console.log('Missing reconciliations:');
  reconciliation.missingReconciliations.forEach(m => {
    console.log(`- ${m.driverName}: ₹${m.grossSalary}`);
  });
}
```

## ⚠️ Error Handling

```typescript
try {
  const result = await linkSalaryToLedger(salary, tenantId, month, year);
  
  if (result.status === 'failed') {
    console.error('Integration failed:', result.errors);
  } else if (result.status === 'partial') {
    console.warn('Partial integration:', result.warnings);
  }
  
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  }
}
```

## 🔍 Debugging

### Check Ledger Entries Created
```typescript
const salary = await DriverSalary.findById(salaryId);
const breakdown = extractSalaryComponentBreakdown(salary);
const definitions = generateLedgerEntryDefinitions(breakdown, salaryId);
console.log(`Will create ${definitions.length} ledger entries`);
definitions.forEach(d => {
  console.log(`- ${d.transactionType}: ₹${d.amount}`);
});
```

### Verify Balance Calculation
```typescript
const entries = await DriverSalaryLedger.find({
  tenantId,
  driverId,
  month,
  year
}).sort({ createdAt: 1 });

let balance = 0;
entries.forEach(e => {
  console.log(`${e.transactionType}: ₹${e.amount}, Balance: ₹${e.closingBalance}`);
});
```

### Check Integration Status
```typescript
const report = await getPayrollIntegrationReport(tenantId, month, year);
console.log(`Status: ${report.reconciliationStatus.reconciliationPercentage}%`);

if (report.reconciliationStatus.reconciliationPercentage < 100) {
  const reconciliation = await reconcileSalaryLedger(tenantId, month, year);
  console.log('Missing:', reconciliation.missingReconciliations);
}
```

## 📈 Performance Tips

### For Large Batches
```typescript
// Process in smaller batches instead of all at once
const batchSize = 10;
for (let i = 0; i < salaries.length; i += batchSize) {
  const batch = salaries.slice(i, i + batchSize);
  await linkBatchSalariesToLedger(batch, tenantId, month, year);
  console.log(`Processed batch ${Math.floor(i / batchSize) + 1}`);
}
```

### For Monitoring
```typescript
// Check integration health periodically
setInterval(async () => {
  const report = await getPayrollIntegrationReport(tenantId, currentMonth, currentYear);
  if (report.reconciliationStatus.reconciliationPercentage < 100) {
    alertAdmin('Integration incomplete');
  }
}, 3600000); // Every hour
```

## 🚀 Workflow

### Standard Monthly Integration
```
1. Calculate all driver salaries for the month
2. Call linkMonthlyPayrollToLedger(tenantId, month, year)
3. Verify result.summary.failedCount === 0
4. Call reconcileSalaryLedger() to verify completeness
5. Get report with getPayrollIntegrationReport()
6. If reconciliation 100%, proceed with payment processing
```

### Correcting Failed Integrations
```
1. Get reconciliation report to identify failures
2. Check individual salary records for data issues
3. Fix salary data as needed
4. Re-link failed salaries with linkSalaryToLedger()
5. Verify with reconcileSalaryLedger()
```

## 📚 Related Services

- **ledgerEntryAutomation.ts** - Core ledger operations
- **driverSalaryService.ts** - Salary data fetching
- **consolidatedSalaryService.ts** - Salary reporting
- **salaryReportingService.ts** - Analytics

## 🆘 Need Help?

- Check `PAYROLL_INTEGRATION_GUIDE.md` for detailed documentation
- Review `payroll-integration-examples.ts` for usage examples
- Run `tests/payroll-integration.test.ts` for test scenarios
- Check API responses for error messages

## 📝 Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `payrollIntegrationService.ts` | Core service | 440 |
| `payrollIntegrationRoutes.ts` | API endpoints | 220 |
| `PAYROLL_INTEGRATION_GUIDE.md` | Full documentation | 550+ |
| `payroll-integration-examples.ts` | Usage examples | 420 |
| `payroll-integration.test.ts` | Tests | 400+ |

## ✅ Checklist for Production

- [ ] Database connection verified
- [ ] Test monthly integration with real data
- [ ] Verify reconciliation completeness
- [ ] Check report generation
- [ ] Test error scenarios
- [ ] Monitor performance metrics
- [ ] Verify role-based access control
- [ ] Setup monitoring/alerts
- [ ] Document in runbook
- [ ] Train team on usage
