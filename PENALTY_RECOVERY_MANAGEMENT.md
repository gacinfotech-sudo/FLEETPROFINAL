# Penalty & Recovery Management System

## Overview

The Penalty & Recovery Management system is a comprehensive solution for tracking driver penalties and implementing recovery mechanisms in FleetPro. It integrates seamlessly with the salary ledger system to maintain an accurate audit trail of all deductions.

## Features

### 1. Penalty Management
- **Create Penalties**: Add penalties for various infractions
- **Multiple Penalty Types**: Damage, Challan/Fines, Cash Shortage, Fuel Excess, Attendance, Behavior, Other
- **Flexible Deduction Modes**: 
  - Full Next Salary: Deduct entire amount from next salary
  - EMI: Spread deduction over multiple installments
  - Manual: Manual recovery tracking
- **Approval Workflow**: Penalties require approval before being applied
- **Status Tracking**: Pending → Approved → Deducted → (Reversed)

### 2. Recovery Management
- **Create Recoveries**: Initiate recovery for outstanding amounts
- **Multiple Recovery Types**: Advance, Loan, Penalty, Damage, Shortage, Fuel Excess, Other
- **Recovery Modes**:
  - Single Payment: One-time recovery
  - EMI: Monthly installment-based recovery
  - Manual: Manual payment tracking
- **Progress Tracking**: Real-time tracking of recovered vs. remaining amounts
- **Status Management**: Active → Completed / Paused / Cancelled

### 3. Ledger Integration
- **Automatic Ledger Entries**: Every penalty and recovery creates ledger entries
- **Immutable Audit Trail**: All transactions are recorded and cannot be altered
- **Running Balance**: Automatic calculation of driver's balance
- **Transaction Types**:
  - `penalty`: Direct penalty charges
  - `damage_recovery`: Damage-related deductions
  - `challan_recovery`: Fine/challan deductions
  - `cash_shortage`: Cash shortage deductions
  - `fuel_excess`: Fuel excess deductions

### 4. Analytics & Reporting
- **Penalty Trends**: Visual representation of penalty amounts over time
- **Penalty Breakdown**: Pie chart showing penalties by type
- **Recovery Progress**: Bar chart showing recovered vs. remaining amounts
- **Statistics Dashboard**: Key metrics and counts
- **Period Reports**: Detailed reports for specific date ranges

## Data Models

### Penalty Schema
```typescript
interface Penalty {
  _id: ObjectId;
  tenantId: ObjectId;
  driverId: ObjectId;
  driverName: string;
  penaltyType: 'damage' | 'challan' | 'cash_shortage' | 'fuel_excess' | 'attendance' | 'behavior' | 'other';
  amount: number; // In paise
  reason: string;
  date: string;
  status: 'pending' | 'approved' | 'deducted' | 'reversed';
  deductionMode: 'full_next_salary' | 'emi' | 'manual';
  installments?: number;
  appliedTo?: number; // How many installments have been applied
  ledgerEntryId?: ObjectId;
  approvedBy?: { userId: string; role: string; timestamp: string };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { userId: string; role: string };
}
```

### Recovery Schema
```typescript
interface Recovery {
  _id: ObjectId;
  tenantId: ObjectId;
  driverId: ObjectId;
  driverName: string;
  recoveryType: 'advance' | 'loan' | 'penalty' | 'damage' | 'shortage' | 'fuel_excess' | 'other';
  amount: number; // Total recovery amount in paise
  originalAmount?: number;
  description: string;
  startDate: Date;
  expectedCompletionDate?: Date;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  recoveryMode: 'single' | 'emi' | 'manual';
  installments?: number;
  emiAmount?: number; // Per installment amount
  recoveredAmount: number; // Already recovered in paise
  remainingAmount: number; // Still outstanding
  ledgerEntries?: ObjectId[]; // References to ledger entries
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { userId: string; role: string };
}
```

### Ledger Entry Schema
```typescript
interface DriverSalaryLedger {
  _id: ObjectId;
  tenantId: ObjectId;
  driverId: ObjectId;
  driverName: string;
  month: number;
  year: number;
  transactionType: 'penalty' | 'damage_recovery' | 'challan_recovery' | 'cash_shortage' | 'fuel_excess' | ...;
  amount: number; // Deduction amount
  reason: string;
  referenceType?: 'booking_id' | 'advance_id' | 'trip_id' | 'deduction_id' | 'penalty_id' | 'recovery_id' | 'manual';
  referenceId?: ObjectId;
  closingBalance: number; // Running balance after this transaction
  createdAt: Date;
  createdBy?: { userId: string; role: string };
}
```

## API Endpoints

### Penalties

#### Create Penalty
```
POST /api/penalties
Content-Type: application/json

{
  "driverId": "driver_id",
  "penaltyType": "damage",
  "amount": 5000,
  "reason": "Vehicle damage during trip",
  "deductionMode": "emi",
  "installments": 3,
  "notes": "Windshield damage"
}

Response: 201 Created
{
  "_id": "penalty_id",
  "driverId": "driver_id",
  "driverName": "John Doe",
  "penaltyType": "damage",
  "amount": 5000,
  "reason": "Vehicle damage during trip",
  "status": "pending",
  "deductionMode": "emi",
  "installments": 3,
  "createdAt": "2026-08-13T10:00:00Z"
}
```

#### Get Penalties
```
GET /api/penalties?month=8&year=2026&status=approved

Response: 200 OK
[
  {
    "_id": "penalty_id",
    "driverId": "driver_id",
    "driverName": "John Doe",
    "penaltyType": "damage",
    "amount": 5000,
    "reason": "Vehicle damage during trip",
    "status": "approved",
    ...
  }
]
```

#### Approve Penalty
```
POST /api/penalties/{penalty_id}/approve

Response: 200 OK
{
  "_id": "penalty_id",
  "status": "approved",
  "approvedBy": {
    "userId": "admin_id",
    "role": "admin",
    "timestamp": "2026-08-13T10:30:00Z"
  },
  ...
}
```

### Recoveries

#### Create Recovery
```
POST /api/recoveries
Content-Type: application/json

{
  "driverId": "driver_id",
  "recoveryType": "advance",
  "amount": 15000,
  "description": "Advance recovery - ₹15000",
  "recoveryMode": "emi",
  "installments": 3,
  "startDate": "2026-08-13"
}

Response: 201 Created
{
  "_id": "recovery_id",
  "driverId": "driver_id",
  "driverName": "John Doe",
  "recoveryType": "advance",
  "amount": 15000,
  "emiAmount": 5000,
  "status": "active",
  "recoveredAmount": 0,
  "remainingAmount": 15000,
  "createdAt": "2026-08-13T10:00:00Z"
}
```

#### Get Recoveries
```
GET /api/recoveries?driverId=driver_id&status=active

Response: 200 OK
[
  {
    "_id": "recovery_id",
    "driverId": "driver_id",
    "driverName": "John Doe",
    "recoveryType": "advance",
    "amount": 15000,
    "recoveredAmount": 5000,
    "remainingAmount": 10000,
    "status": "active",
    ...
  }
]
```

#### Record Recovery Payment
```
POST /api/recoveries/{recovery_id}/payment
Content-Type: application/json

{
  "paidAmount": 5000
}

Response: 200 OK
{
  "_id": "recovery_id",
  "recoveredAmount": 5000,
  "remainingAmount": 10000,
  "status": "active",
  ...
}
```

### Statistics & Reports

#### Get Penalty & Recovery Statistics
```
GET /api/penalties-recoveries/stats?month=8&year=2026

Response: 200 OK
{
  "totalPenalties": 25000,
  "totalRecoveries": 50000,
  "totalRecovered": 15000,
  "totalRemaining": 35000,
  "pendingPenalties": 3,
  "approvedPenalties": 5,
  "deductedPenalties": 2,
  "activePenalties": 8,
  "activeRecoveries": 12,
  "completedRecoveries": 3,
  "penaltyByType": {
    "damage": 10000,
    "challan": 8000,
    "cash_shortage": 7000
  },
  "recoveryByType": {
    "advance": 30000,
    "loan": 20000
  }
}
```

#### Generate Report
```
GET /api/penalties-recoveries/report?startDate=2026-08-01&endDate=2026-08-31&driverId=driver_id

Response: 200 OK
{
  "period": {
    "from": "2026-08-01",
    "to": "2026-08-31"
  },
  "penalties": {
    "count": 5,
    "total": 25000,
    "byType": { ... },
    "byStatus": { ... }
  },
  "recoveries": {
    "count": 3,
    "total": 50000,
    "recovered": 15000,
    "remaining": 35000,
    ...
  },
  "ledgerImpact": {
    "entriesCreated": 8,
    "totalDeduction": 40000
  }
}
```

## Integration with Ledger

### Automatic Ledger Creation Flow

1. **Penalty Created**: 
   - Initial ledger entry created (if pending)
   - `transactionType`: "penalty"
   - `reason`: "Penalty Type - Reason"

2. **Penalty Approved**:
   - Additional ledger entry created
   - `transactionType`: "damage_recovery" | "challan_recovery" | etc. (based on type)
   - `reason`: "Approved: Penalty Type - Reason"

3. **Penalty Applied to Salary**:
   - Deduction recorded in payroll
   - Ledger entry updated with running balance

4. **Recovery Payment**:
   - Ledger entry created for each payment
   - `transactionType`: "recovery_deducted"
   - Running balance updated

### Example Ledger Trail

For a ₹5000 damage penalty with EMI mode (3 installments):

```
Date       | Type              | Description              | Amount | Debit | Running Balance
2026-08-13 | penalty           | Penalty created          | 5000   | 0     | 5000
2026-08-14 | damage_recovery   | Approved: Damage - ...   | 5000   | 5000  | 0
2026-09-01 | recovery_deducted | EMI 1/3 deducted         | 1667   | 1667  | -1667
2026-10-01 | recovery_deducted | EMI 2/3 deducted         | 1667   | 1667  | -3334
2026-11-01 | recovery_deducted | EMI 3/3 deducted         | 1666   | 1666  | -5000
```

## UI Components

### Overview Tab
- **Summary Cards**: Total penalties, pending approvals, active recoveries, recovery amounts
- **Penalty Trend Chart**: Line chart showing penalty amounts over last 12 months
- **Penalty by Type Chart**: Pie chart showing distribution of penalties by type
- **Recovery Progress Chart**: Bar chart showing recovered vs. remaining amounts

### Penalties Tab
- **Penalty Table**: List of all penalties with filters
- **Columns**: Driver, Type, Amount, Reason, Status, Deduction Mode, Actions
- **Filters**: Month/Year selection
- **Actions**: Approve pending penalties

### Recoveries Tab
- **Recovery Table**: List of all recoveries
- **Columns**: Driver, Type, Total Amount, Recovered, Remaining, Status, Progress
- **Filters**: Driver selection, Status filter
- **Progress Bars**: Visual indication of recovery completion

### Ledger Tab
- **Ledger Entries Table**: Driver salary ledger with penalty/recovery entries
- **Columns**: Date, Transaction Type, Description, Amount, Closing Balance
- **Filters**: Driver, Month, Year
- **Transaction Types**: Filtered to show only penalty/recovery related entries

## Usage Workflow

### Adding a Penalty

1. Navigate to **Penalty & Recovery Management** → **Penalties** tab
2. Click **+ Add Penalty**
3. Fill in the form:
   - Select Driver
   - Choose Penalty Type (Damage, Challan, etc.)
   - Enter Amount
   - Provide Reason
   - Select Deduction Mode (Full Next Salary / EMI / Manual)
   - If EMI, specify number of installments
   - Optional: Add Notes
4. Submit the form
5. Penalty appears in table with "Pending" status
6. Admin can now approve it with **Approve** button
7. Once approved, ledger entry is created
8. Deduction is applied to next salary

### Initiating a Recovery

1. Navigate to **Penalty & Recovery Management** → **Recoveries** tab
2. Click **+ Add Recovery**
3. Fill in the form:
   - Select Driver
   - Choose Recovery Type (Advance, Loan, Penalty, etc.)
   - Enter Total Amount to Recover
   - Provide Description
   - Select Recovery Mode (Single / EMI / Manual)
   - If EMI, specify number of installments
4. Submit the form
5. Recovery appears in table with "Active" status
6. Progress bar shows 0% initially
7. Record payments as they're made via **+ Payment** button
8. Progress bar updates automatically
9. Recovery marked "Completed" when 100% recovered

### Viewing Ledger Trail

1. Navigate to **Penalty & Recovery Management** → **Ledger** tab
2. Select a Driver
3. Choose Month and Year
4. View all penalty/recovery related ledger entries
5. See running balance for each transaction
6. All entries are immutable (for audit trail)

## Business Rules

### Penalty Rules
- Penalties cannot be deducted without approval
- Amount must be positive
- Penalty type must be valid
- Approval required from admin/manager
- Multiple penalties for same driver allowed
- Ledger entries created automatically

### Recovery Rules
- Recovery amount cannot exceed total outstanding
- Once marked completed, cannot record more payments
- EMI calculation is automatic
- Recovery must have valid driver and type
- Status transitions: active → completed/paused/cancelled
- Progress is tracked across salary periods

### Ledger Rules
- All entries immutable (no editing)
- Running balance calculated automatically
- Reference to original penalty/recovery maintained
- Timestamp recorded for each transaction
- User/admin recorded for audit trail

## Calculations

### EMI Calculation
```
EMI Amount = Total Amount / Number of Installments
```

Example: ₹6000 penalty over 3 installments
- EMI 1: ₹2000
- EMI 2: ₹2000
- EMI 3: ₹2000

### Recovery Progress
```
Progress % = (Recovered Amount / Total Amount) × 100
Remaining Amount = Total Amount - Recovered Amount
```

Example: ₹15000 recovery, ₹5000 recovered
- Progress: (5000 / 15000) × 100 = 33.33%
- Remaining: ₹10000

### Running Balance
```
Running Balance = Previous Balance + Credits - Debits

For penalties:
Running Balance = Previous Balance - Penalty Amount

For recovery payments:
Running Balance = Previous Balance - Payment Amount
```

## Audit Trail

Every penalty and recovery action creates immutable ledger entries:
- **Penalties**: Created immediately with "pending" status, ledger entry on approval
- **Recoveries**: Ledger entry on creation and for each payment
- **Ledger**: All entries timestamped and attributed to user
- **References**: Links back to original penalty/recovery document

## Reports

### Monthly Penalty Report
- Total penalties by type
- Status breakdown (pending/approved/deducted/reversed)
- Per-driver breakdown
- Trend analysis

### Monthly Recovery Report
- Total recovery amount
- Amount recovered vs. remaining
- Status breakdown (active/completed/paused/cancelled)
- Per-driver breakdown

### Combined Report
- Total deductions vs. collections
- Recovery rate percentage
- Deduction impact on salary
- Per-driver ledger impact

## File Structure

```
server/
├── services/
│   └── penaltyRecoveryService.ts       # Business logic
├── routes/
│   └── penaltyRecovery.ts              # API endpoints
└── models/
    └── index.ts                         # Penalty, Recovery schemas

client/
└── src/pages/
    └── penalty-recovery-management.tsx  # UI component

docs/
└── PENALTY_RECOVERY_MANAGEMENT.md       # This file
```

## Integration Checklist

- [x] Create Penalty model
- [x] Create Recovery model
- [x] Create service functions
- [x] Create API routes
- [x] Create UI component
- [x] Link to ledger system
- [x] Add statistics API
- [x] Add report generation
- [ ] Add email notifications for approvals
- [ ] Add SMS notifications for recovery reminders
- [ ] Create bulk import/export
- [ ] Add approval workflows
- [ ] Add audit logging
- [ ] Add dashboard widgets

## Future Enhancements

1. **Approval Workflows**: Multi-step approval for penalties above threshold
2. **Notifications**: Email/SMS alerts for recovery deadlines
3. **Bulk Operations**: Import penalties from CSV, bulk approve
4. **Automated Deductions**: Auto-deduct from salary on due date
5. **Recovery Plans**: Create custom recovery schedules
6. **Interest Calculation**: Add interest on unpaid amounts
7. **Compliance Reports**: Generate compliance reports for audits
8. **Integration**: Link with vehicle damage/incident tracking

## Troubleshooting

### Penalty not appearing in ledger
- Check approval status (must be approved)
- Verify tenant access permissions
- Check date filters in ledger view

### Recovery not progressing
- Verify payment amounts recorded
- Check recovery status (must be active)
- Ensure driver exists in system

### Ledger balance inconsistency
- Regenerate running balance
- Verify no duplicate ledger entries
- Check for manual ledger adjustments

## Support

For issues or questions:
1. Check audit trail in ledger
2. Review error messages in API response
3. Check permissions (tenant access)
4. Verify data integrity with reports
