# Monthly Salary Formula - Quick Reference

## Formula
```
NET PAYABLE = BASE + ALLOWANCES - DEDUCTIONS - ADVANCES - PENALTIES
```

## Components at a Glance

| Component | Type | Example | Source |
|-----------|------|---------|--------|
| **Base Salary** | Income | ₹25,000 | Salary Master |
| **Night Allowance** | Income | ₹1,500 | Ledger Entry |
| **Outstation Allowance** | Income | ₹1,000 | Ledger Entry |
| **Food Allowance** | Income | ₹800 | Ledger Entry |
| **Absence Deduction** | Reduction | ₹1,000 | Ledger Entry |
| **Damage Recovery** | Reduction | ₹500 | Recovery Record |
| **Challan Recovery** | Reduction | ₹200 | Recovery Record |
| **Advance Deduction** | Reduction | ₹3,000 | Advance Record |
| **Penalty** | Reduction | ₹800 | Ledger Entry |

## Calculation Steps

### Step 1: Calculate Gross Earnings
```
Gross = Base + Night Allowance + Outstation Allowance + Food Allowance + Other Allowances
Example: 25,000 + 1,500 + 1,000 + 800 = ₹28,300
```

### Step 2: Calculate Total Deductions
```
Deductions = Absence + Damage + Challan + Cash Shortage + Fuel Excess + Other
Example: 1,000 + 500 + 0 + 0 + 0 + 0 = ₹1,500
```

### Step 3: Calculate Advance Deduction
```
Advance = Amount (based on deduction mode)
Example: ₹3,000 (Full Next Salary mode)
```

### Step 4: Calculate Penalties
```
Penalties = Sum of all penalties
Example: ₹800
```

### Step 5: Calculate Net Payable
```
Net = Gross - Deductions - Advances - Penalties
Net = ₹28,300 - ₹1,500 - ₹3,000 - ₹800
NET = ₹23,000
```

## Database Collections

### 1. DriverSalaryMaster
Stores driver salary configuration
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  driverId: ObjectId,
  name: String,
  baseSalary: Number,        // ← Base salary
  nightAllowancePerNight: Number,
  outstationAllowancePerDay: Number,
  foodAllowance: Number,
  status: 'active' | 'inactive'
}
```

### 2. DriverSalaryLedger
Tracks all salary transactions
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  driverId: ObjectId,
  month: Number,
  year: Number,
  transactionType: String,   // ← Type of transaction
  amount: Number,            // ← Amount
  createdBy: Object
}
```

**Transaction Types:**
- `base_salary` - Base salary
- `night_allowance` - Night allowance
- `outstation_allowance` - Outstation allowance
- `food_allowance` - Food allowance
- `absence_deduction` - Absence deduction
- `damage_recovery` - Damage recovery
- `challan_recovery` - Challan recovery
- `cash_shortage` - Cash shortage
- `fuel_excess` - Fuel excess
- `penalty` - Penalty
- `other_deduction` - Other deductions

### 3. DriverAdvance
Tracks driver advances
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  driverId: ObjectId,
  amount: Number,
  approvedAmount: Number,
  remaining: Number,
  deductionMode: 'full_next_salary' | 'emi' | 'manual',
  emiAmount: Number,         // ← For EMI mode
  status: 'approved' | 'paid' | 'rejected'
}
```

### 4. DriverRecovery
Tracks damage/challan recoveries
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  driverId: ObjectId,
  amount: Number,
  recoveryType: 'damage' | 'challan',
  status: 'approved' | 'recovered'
}
```

## API Endpoints

### Calculate Single Driver Salary
```
POST /api/salary/calculate
Body: { tenantId, driverId, month, year }
Returns: MonthlySalaryCalculation object
```

### Calculate Team Salaries
```
POST /api/salary/calculate-team
Body: { tenantId, month, year, driverIds?: [...] }
Returns: Array of MonthlySalaryCalculation objects
```

### Get Salary Statistics
```
GET /api/salary/statistics/:tenantId/:month/:year
Returns: TeamSalaryStatistics object
```

### Get Salary Slip (Formatted)
```
GET /api/salary/slip/:tenantId/:driverId/:month/:year
Returns: Formatted salary slip
```

### Export Salary Data
```
GET /api/salary/export/:tenantId/:month/:year?format=csv
Returns: CSV or JSON export
```

## Usage Examples

### Example 1: Calculate Monthly Salary (TypeScript)
```typescript
import { calculateMonthlySalary } from '@/services/salaryCoreCalculationService';

const calculation = await calculateMonthlySalary({
  tenantId: 'tenant123',
  driverId: 'driver456',
  month: 8,
  year: 2026
});

console.log(`Net Payable: ₹${calculation.netPayable}`);
console.log(`Gross Earnings: ₹${calculation.grossEarnings}`);
console.log(`Total Deductions: ₹${calculation.totalDeductions}`);
```

### Example 2: Create Salary Ledger Entry
```typescript
import { DriverSalaryLedger } from '@/models/index';

// Add absence deduction
const ledgerEntry = new DriverSalaryLedger({
  tenantId: 'tenant123',
  driverId: 'driver456',
  month: 8,
  year: 2026,
  transactionType: 'absence_deduction',
  amount: 1000,
  reason: '2 days absence',
  createdBy: { userId: 'admin1', role: 'admin' }
});
await ledgerEntry.save();
```

### Example 3: Record Driver Advance
```typescript
import { DriverAdvance } from '@/models/index';

// Record advance that will be deducted next month
const advance = new DriverAdvance({
  tenantId: 'tenant123',
  driverId: 'driver456',
  amount: 5000,
  approvedAmount: 5000,
  remaining: 5000,
  deductionMode: 'full_next_salary',
  status: 'paid'
});
await advance.save();
```

### Example 4: Fetch API (JavaScript)
```javascript
// Calculate salary via API
const response = await fetch('/api/salary/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'tenant123',
    driverId: 'driver456',
    month: 8,
    year: 2026
  })
});

const { data } = await response.json();
console.log(`Net: ₹${data.netPayable}`);
```

## Important Notes

### Deduction Modes for Advances

1. **Full Next Salary**
   - Entire remaining advance deducted in next month
   - Use case: Small advances that need quick recovery

2. **EMI (Equated Monthly Installment)**
   - Fixed amount deducted each month
   - Use case: Large advances (6-12 months)
   - Requires `emiAmount` field

3. **Manual**
   - No automatic deduction
   - Use case: Flexible recovery arrangements
   - Manual deduction via ledger entry

### Validation

- Minimum base salary: ₹100
- Maximum advance: ₹10,00,000
- Period: Month (1-12) and Year (2020+)
- Status for deductions: Only 'approved' or 'recovered' recoveries counted

### Performance Tips

1. **Index required fields** for faster queries
2. **Batch calculations** for teams using `calculateTeamSalaries`
3. **Cache salary masters** as they don't change frequently
4. **Use statistics endpoint** instead of calculating individual salaries

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| `No active salary master` | Driver has no config | Create salary master |
| `Negative net payable` | Deductions exceed gross | Review deductions |
| `Missing ledger entries` | Transactions not recorded | Add ledger entries |
| `Advance not deducted` | Status not 'paid' | Approve and mark paid |

## Testing

Run the test suite:
```bash
npm test -- salary-formula
```

Tests cover:
- ✅ Base salary calculation
- ✅ Allowances addition
- ✅ Deductions subtraction
- ✅ Advance deduction
- ✅ Penalties
- ✅ Complete formula
- ✅ Validation logic
- ✅ Error handling
