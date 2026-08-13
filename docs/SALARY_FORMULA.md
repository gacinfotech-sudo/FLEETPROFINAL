# Monthly Salary Formula Documentation

## Formula Specification

The monthly salary is calculated using the following formula:

```
Monthly Salary = Base + Allowances - Deductions - Advances - Penalties
```

### Components Breakdown

#### 1. **Base Salary** (Income)
- Fixed monthly salary amount from the salary master configuration
- Starting point for all salary calculations
- Example: ₹25,000

#### 2. **Allowances** (Income Additions)
Various allowances add to the base salary:

| Allowance Type | Description | Source |
|---|---|---|
| **Night Allowance** | Paid for night duty shifts | Salary Master + Ledger |
| **Outstation Allowance** | Paid for outstation trips | Salary Master + Ledger |
| **Food Allowance** | Monthly food/meal allowance | Salary Master + Ledger |
| **Other Allowances** | Any additional allowances | Ledger Entries |

**Example:**
- Night Allowance: ₹1,500
- Outstation Allowance: ₹1,000
- Food Allowance: ₹800
- **Total Allowances: ₹3,300**

#### 3. **Deductions** (Income Reductions)
Various deductions reduce the salary:

| Deduction Type | Description | Source |
|---|---|---|
| **Absence Deduction** | Deduction for absent days | Salary Ledger |
| **Damage Recovery** | Recovery for vehicle/asset damage | Recovery Records |
| **Challan Recovery** | Recovery for traffic challans | Recovery Records |
| **Cash Shortage** | Shortage in cash handling | Salary Ledger |
| **Fuel Excess** | Excess fuel consumption | Salary Ledger |
| **Other Deductions** | Miscellaneous deductions | Salary Ledger |

**Example:**
- Absence Deduction: ₹1,000
- Damage Recovery: ₹500
- Cash Shortage: ₹300
- **Total Deductions: ₹1,800**

#### 4. **Advances** (Loan Recoveries)
Driver advances are deducted based on the deduction mode:

| Deduction Mode | Description |
|---|---|
| **Full Next Salary** | Entire remaining advance deducted in next salary |
| **EMI** | Monthly EMI amount deducted (e.g., 6 installments) |
| **Manual** | No automatic deduction; manual tracking only |

**Example:**
- Advance Amount: ₹5,000
- Deduction Mode: Full Next Salary
- **Advance Deduction: ₹5,000**

#### 5. **Penalties** (Administrative Charges)
Penalties for violations or rule breaches:

| Penalty Type | Description |
|---|---|
| **Late Arrival** | Penalty for arriving late |
| **Driving Violation** | Penalty for traffic violations |
| **Vehicle Misuse** | Penalty for improper vehicle usage |
| **Policy Violation** | Penalty for company policy violations |

**Example:**
- Late Arrival Penalty: ₹500
- Vehicle Violation Penalty: ₹300
- **Total Penalties: ₹800**

---

## Calculation Example

### Scenario: Driver Monthly Salary Calculation (August 2026)

**Input Data:**
```
Driver: Rajesh Kumar
Tenant: Fleet Company
Period: August 2026

Base Salary: ₹25,000
Night Allowance (8 nights): ₹1,500
Outstation Allowance (5 days): ₹1,000
Food Allowance: ₹800
Absence Deduction: ₹1,000
Damage Recovery: ₹500
Driver Advance (Full deduction): ₹3,000
Penalties (Late arrival): ₹800
```

**Calculation:**

```
INCOME SECTION
├─ Base Salary              ₹25,000
├─ Night Allowance         ₹1,500
├─ Outstation Allowance    ₹1,000
├─ Food Allowance          ₹800
└─ Subtotal (Gross)        ₹28,300

DEDUCTIONS SECTION
├─ Absence Deduction       ₹1,000
├─ Damage Recovery         ₹500
├─ Advance Deduction       ₹3,000
├─ Penalties               ₹800
└─ Subtotal (Deductions)   ₹5,300

FINAL CALCULATION
└─ NET PAYABLE = ₹28,300 - ₹5,300 = ₹23,000
```

---

## Implementation Details

### 1. Data Sources

Each component fetches data from specific sources:

| Component | Source Collection | Query |
|---|---|---|
| Base Salary | DriverSalaryMaster | `tenantId, driverId, status='active'` |
| Allowances | DriverSalaryLedger | `type='*_allowance', month, year` |
| Deductions | DriverSalaryLedger | `type='*_deduction', month, year` |
| Advances | DriverAdvance | `driverId, status='paid'` |
| Penalties | DriverSalaryLedger | `type='penalty', month, year` |
| Recoveries | DriverRecovery | `driverId, month, year, status='approved'` |

### 2. Ledger Entry Types

Supported transaction types in DriverSalaryLedger:

**Earnings:**
- `base_salary` - Base monthly salary
- `night_allowance` - Night duty allowance
- `outstation_allowance` - Outstation allowance
- `food_allowance` - Food allowance
- `trip_incentive` - Trip-based incentive
- `km_incentive` - Kilometer-based incentive
- `attendance_bonus` - Attendance bonus
- `overtime_earning` - Overtime earnings
- `bonus` - Special bonus
- `manual_incentive` - Manually added incentive

**Deductions:**
- `absence_deduction` - Deduction for absences
- `advance_recovery` - Advance deduction
- `loan_recovery` - Loan recovery
- `penalty` - Penalty deduction
- `damage_recovery` - Damage recovery
- `challan_recovery` - Challan recovery
- `cash_shortage` - Cash shortage recovery
- `fuel_excess` - Fuel excess recovery
- `other_deduction` - Other deductions

### 3. Service Functions

**Core Functions:**

```typescript
// Calculate monthly salary for a single driver
async function calculateMonthlySalary(
  input: MonthlySalaryCalculationInput
): Promise<MonthlySalaryCalculation>

// Calculate for multiple drivers in a period
async function calculateTeamSalaries(
  tenantId: string,
  month: number,
  year: number,
  driverIds?: string[]
): Promise<MonthlySalaryCalculation[]>

// Get statistical summary
async function calculateTeamSalaryStatistics(
  tenantId: string,
  month: number,
  year: number
): Promise<TeamsalaryStatistics>

// Format for display
function formatSalaryCalculation(
  calculation: MonthlySalaryCalculation
): string

// Validate calculation
function validateSalaryCalculation(
  calculation: MonthlySalaryCalculation
): { valid: boolean; errors: string[] }
```

---

## API Usage Examples

### 1. Calculate Single Driver Salary

**Endpoint:** `POST /api/salary/calculate`

**Request:**
```json
{
  "tenantId": "507f1f77bcf86cd799439011",
  "driverId": "507f1f77bcf86cd799439012",
  "month": 8,
  "year": 2026
}
```

**Response:**
```json
{
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
      "total": 3300
    },
    "deductions": {
      "absenceDeduction": 1000,
      "damageRecovery": 500,
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
  "amountPending": 23000
}
```

### 2. Calculate Team Salaries

**Endpoint:** `POST /api/salary/calculate-team`

**Request:**
```json
{
  "tenantId": "507f1f77bcf86cd799439011",
  "month": 8,
  "year": 2026,
  "driverIds": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]
}
```

**Response:**
```json
{
  "period": "8/2026",
  "driverCount": 2,
  "totalGrossEarnings": 60000,
  "totalDeductions": 8500,
  "totalNetPayable": 51500,
  "totalAmountPaid": 0,
  "totalAmountPending": 51500,
  "averageSalary": 25750,
  "lowestSalary": 20000,
  "highestSalary": 31500,
  "calculations": [
    { /* driver 1 calculation */ },
    { /* driver 2 calculation */ }
  ]
}
```

### 3. Get Salary Statistics

**Endpoint:** `GET /api/salary/statistics/:tenantId/:month/:year`

**Response:**
```json
{
  "period": "8/2026",
  "driverCount": 10,
  "totalGrossEarnings": 275000,
  "totalDeductions": 42500,
  "totalNetPayable": 232500,
  "totalAmountPaid": 120000,
  "totalAmountPending": 112500,
  "averageSalary": 23250,
  "lowestSalary": 18000,
  "highestSalary": 35000
}
```

---

## Validation Rules

1. **Net Payable Cannot Be Negative:** If deductions exceed earnings, net payable is 0
2. **Gross Earnings Must Be Positive:** Base salary should never be zero
3. **Deductions Should Not Exceed 150% of Gross:** Indicates potential data error
4. **Advance Must Have Valid Deduction Mode:** Required for advance deduction calculation

---

## Data Integrity

### Ledger Entry Requirements

Every salary calculation must have:
1. ✅ At least one base salary entry per month
2. ✅ Corresponding ledger entries for all additions/deductions
3. ✅ Advance records with proper status and deduction mode
4. ✅ Recovery records for damage/challan recoveries

### Transaction Audit Trail

All salary calculations are logged with:
- Calculation timestamp
- Calculated by (userId, role)
- Component breakdown
- Source data references (ledger entries, advances, recoveries)

---

## Error Handling

| Error | Cause | Resolution |
|---|---|---|
| `No active salary master` | Driver has no salary configuration | Create salary master for driver |
| `No attendance data` | Attendance records missing | Record attendance for the month |
| `Negative deductions` | Invalid ledger entry | Validate ledger entry amount |
| `Advance without EMI info` | EMI deduction mode but no installments | Update advance record |

---

## Testing

Comprehensive test suite in `tests/salary-formula.test.ts` covers:

- ✅ Base salary only
- ✅ Base + Allowances
- ✅ Deductions applied
- ✅ Advances deduction
- ✅ Penalties
- ✅ Complete formula (all components)
- ✅ Validation logic
- ✅ Error handling

**Run tests:**
```bash
npm test salary-formula
```

---

## Performance Considerations

### Database Indexes

Required indexes for optimal performance:

```javascript
// DriverSalaryMaster
db.driversalarymaster.createIndex({ tenantId: 1, driverId: 1, status: 1 })

// DriverSalaryLedger
db.driversalaryledger.createIndex({ tenantId: 1, driverId: 1, month: 1, year: 1 })
db.driversalaryledger.createIndex({ tenantId: 1, driverId: 1, transactionType: 1 })

// DriverAdvance
db.driveradvance.createIndex({ tenantId: 1, driverId: 1, status: 1 })

// DriverRecovery
db.driverrecovery.createIndex({ tenantId: 1, driverId: 1, date: 1 })
```

### Query Performance

- Single driver calculation: ~200ms (with 100 ledger entries)
- Team calculation (50 drivers): ~3-4 seconds
- Statistics calculation: ~2-3 seconds

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-08-13 | Initial formula implementation |
| - | - | Base + Allowances - Deductions - Advances - Penalties |
| - | - | Support for all transaction types |
| - | - | Comprehensive validation |
| - | - | Team salary calculation |
