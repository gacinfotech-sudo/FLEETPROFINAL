# Penalty & Recovery Management - Technical Specification

## Document Information
- **Version**: 1.0
- **Date**: August 13, 2026
- **Status**: Final
- **Audience**: Developers, Architects, QA

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                              │
│  React Component: penalty-recovery-management.tsx            │
│  - Overview Dashboard                                         │
│  - Penalties Management Tab                                   │
│  - Recoveries Tracking Tab                                    │
│  - Ledger View Tab                                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER (REST)                         │
│  Express Router: /api/penalties, /api/recoveries            │
│  - Endpoints: POST, GET, PATCH                               │
│  - Auth Middleware: requireAuth, checkTenantAccess          │
│  - Response Format: JSON                                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                              │
│  Services: penaltyRecoveryService.ts                         │
│  - Business Logic                                             │
│  - Database Transactions                                      │
│  - Ledger Integration                                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER (MongoDB)                       │
│  Collections:                                                 │
│  - penalties                                                  │
│  - recoveries                                                 │
│  - driversalarylredgers                                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Diagram

```
penalty-recovery-management.tsx
├── Overview Tab
│   ├── SummaryCards (5x)
│   ├── PenaltyTrendChart (LineChart)
│   ├── PenaltyTypeChart (PieChart)
│   └── RecoveryProgressChart (BarChart)
├── Penalties Tab
│   ├── PenaltyTable
│   └── AddPenaltyDialog
├── Recoveries Tab
│   ├── RecoveryTable
│   └── AddRecoveryDialog
└── Ledger Tab
    ├── LedgerTable
    └── Filters
```

## 2. Database Schema

### 2.1 Penalty Collection

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId (indexed),
  driverId: ObjectId (indexed),
  driverName: String,
  penaltyType: Enum ['damage', 'challan', 'cash_shortage', 'fuel_excess', 'attendance', 'behavior', 'other'],
  amount: Number (in paise),
  reason: String (required, min 10 chars),
  date: Date (default: now),
  status: Enum ['pending', 'approved', 'deducted', 'reversed'] (indexed),
  deductionMode: Enum ['full_next_salary', 'emi', 'manual'],
  installments: Number (1-12, default: 1),
  appliedTo: Number (default: 0),
  ledgerEntryId: ObjectId (reference to DriverSalaryLedger),
  approvedBy: {
    userId: String,
    role: String,
    timestamp: String (ISO 8601)
  },
  notes: String (optional),
  createdBy: {
    userId: String,
    role: String
  },
  createdAt: Date (default: now, indexed),
  updatedAt: Date (default: now)
}
```

**Indexes**:
- `{tenantId: 1, driverId: 1}`
- `{tenantId: 1, status: 1}`
- `{tenantId: 1, createdAt: -1}`
- `{driverId: 1, status: 1}`

**Validation Rules**:
- `amount`: Must be > 0
- `reason`: Min 10 characters, max 500
- `installments`: Must be 1-12 for EMI mode
- `penaltyType`: Must be valid enum value

### 2.2 Recovery Collection

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId (indexed),
  driverId: ObjectId (indexed),
  driverName: String,
  recoveryType: Enum ['advance', 'loan', 'penalty', 'damage', 'shortage', 'fuel_excess', 'other'],
  amount: Number (in paise, total recovery amount),
  originalAmount: Number (initial amount before payments),
  description: String (required, min 10 chars),
  startDate: Date (indexed, default: now),
  expectedCompletionDate: Date (optional),
  status: Enum ['active', 'completed', 'paused', 'cancelled'] (indexed),
  recoveryMode: Enum ['single', 'emi', 'manual'],
  installments: Number (1-24, null for single mode),
  emiAmount: Number (calculated: amount / installments),
  recoveredAmount: Number (in paise, default: 0, >= 0),
  remainingAmount: Number (in paise, = amount - recoveredAmount),
  ledgerEntries: [ObjectId] (references to DriverSalaryLedger),
  createdBy: {
    userId: String,
    role: String
  },
  createdAt: Date (default: now),
  updatedAt: Date (default: now)
}
```

**Indexes**:
- `{tenantId: 1, driverId: 1}`
- `{tenantId: 1, status: 1}`
- `{tenantId: 1, startDate: -1}`
- `{driverId: 1, status: 1}`
- `{driverId: 1, recoveredAmount: 1}`

**Validation Rules**:
- `amount`: Must be > 0
- `description`: Min 10 characters, max 500
- `installments`: Must be 1-24 for EMI mode, null for single
- `recoveredAmount`: Must be >= 0 and <= amount
- `remainingAmount`: = amount - recoveredAmount
- `emiAmount`: = Math.ceil(amount / installments)

### 2.3 Ledger Entry (Existing, Enhanced)

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId (indexed),
  driverId: ObjectId (indexed),
  driverName: String,
  month: Number (1-12),
  year: Number,
  transactionType: Enum [
    'base_salary', 'bonus', 'food_allowance', 'overtime_earning',
    'manual_incentive', 'absence_deduction', 'advance_recovery',
    'loan_recovery', 'penalty', 'damage_recovery', 'challan_recovery',
    'cash_shortage', 'fuel_excess', 'other_deduction'
  ],
  amount: Number (in paise, always positive),
  reason: String,
  referenceType: Enum ['booking_id', 'advance_id', 'trip_id', 'deduction_id', 'penalty_id', 'recovery_id', 'manual'],
  referenceId: ObjectId,
  basis: {
    type: String,
    value: Number
  },
  closingBalance: Number (in paise, calculated running balance),
  createdBy: {
    userId: String,
    role: String
  },
  createdAt: Date (indexed),
  updatedAt: Date
}
```

**Additional Indexes**:
- `{tenantId: 1, driverId: 1, month: 1, year: 1}`
- `{tenantId: 1, referenceType: 1, referenceId: 1}`
- `{transactionType: 1}` (for penalty/recovery entries)

## 3. API Specification

### 3.1 Penalty Endpoints

#### CREATE PENALTY
```
POST /api/penalties
Content-Type: application/json
Authorization: Bearer {token}

Request Body:
{
  driverId: "6507c3e8e1234567890abcde" (required, ObjectId string),
  penaltyType: "damage" (required, enum),
  amount: 5000 (required, number, > 0, in rupees),
  reason: "Windshield damage during trip 123" (required, string, min 10),
  deductionMode: "emi" (required, enum),
  installments: 3 (optional, number, 1-12),
  notes: "Repair quote received" (optional, string)
}

Response: 201 Created
{
  _id: "6507c3e8e9876543210fedcb",
  tenantId: "6507c3e8e1234567890abcde",
  driverId: "6507c3e8e1234567890abcde",
  driverName: "John Doe",
  penaltyType: "damage",
  amount: 5000,
  reason: "Windshield damage during trip 123",
  status: "pending",
  deductionMode: "emi",
  installments: 3,
  appliedTo: 0,
  createdAt: "2026-08-13T10:00:00Z",
  createdBy: { userId: "admin1", role: "admin" },
  notes: "Repair quote received"
}

Error Responses:
400 Bad Request - Missing required fields
400 Bad Request - Invalid deductionMode (must be full_next_salary, emi, or manual)
400 Bad Request - Installments must be 1-12 for EMI mode
404 Not Found - Driver not found
500 Internal Server Error
```

#### LIST PENALTIES
```
GET /api/penalties?driverId={id}&status={status}&month={m}&year={y}&penaltyType={type}
Authorization: Bearer {token}

Query Parameters:
- driverId: Optional, filter by driver (ObjectId string)
- status: Optional, enum filter (pending, approved, deducted, reversed)
- month: Optional, number (1-12)
- year: Optional, number (YYYY)
- penaltyType: Optional, enum filter
- limit: Optional, default 50, max 1000
- offset: Optional, default 0

Response: 200 OK
[
  {
    _id: "6507c3e8e9876543210fedcb",
    driverId: "6507c3e8e1234567890abcde",
    driverName: "John Doe",
    penaltyType: "damage",
    amount: 5000,
    reason: "Windshield damage during trip 123",
    status: "pending",
    deductionMode: "emi",
    installments: 3,
    createdAt: "2026-08-13T10:00:00Z"
  },
  ...
]

Error Responses:
400 Bad Request - Invalid query parameters
500 Internal Server Error
```

#### APPROVE PENALTY
```
POST /api/penalties/{penaltyId}/approve
Authorization: Bearer {token}

Request Body: (empty)

Response: 200 OK
{
  _id: "6507c3e8e9876543210fedcb",
  status: "approved",
  approvedBy: {
    userId: "admin1",
    role: "admin",
    timestamp: "2026-08-13T10:30:00Z"
  },
  ledgerEntryId: "6507c3e8e1111111111111111",
  ...
}

Error Responses:
404 Not Found - Penalty not found
400 Bad Request - Penalty already approved
500 Internal Server Error
```

### 3.2 Recovery Endpoints

#### CREATE RECOVERY
```
POST /api/recoveries
Content-Type: application/json
Authorization: Bearer {token}

Request Body:
{
  driverId: "6507c3e8e1234567890abcde" (required, ObjectId string),
  recoveryType: "advance" (required, enum),
  amount: 15000 (required, number, > 0, in rupees),
  description: "Salary advance dated 2026-07-15" (required, string, min 10),
  recoveryMode: "emi" (required, enum: single, emi, manual),
  installments: 3 (required for emi mode, number, 2-24),
  startDate: "2026-08-13" (optional, ISO 8601 date)
}

Response: 201 Created
{
  _id: "6507c3e8e9876543210fedcb",
  tenantId: "6507c3e8e1234567890abcde",
  driverId: "6507c3e8e1234567890abcde",
  driverName: "John Doe",
  recoveryType: "advance",
  amount: 15000,
  originalAmount: 15000,
  description: "Salary advance dated 2026-07-15",
  status: "active",
  recoveryMode: "emi",
  installments: 3,
  emiAmount: 5000,
  recoveredAmount: 0,
  remainingAmount: 15000,
  startDate: "2026-08-13T00:00:00Z",
  ledgerEntries: [],
  createdAt: "2026-08-13T10:00:00Z"
}

Error Responses:
400 Bad Request - Missing required fields
400 Bad Request - Installments required for EMI mode
404 Not Found - Driver not found
500 Internal Server Error
```

#### LIST RECOVERIES
```
GET /api/recoveries?driverId={id}&status={status}&recoveryType={type}
Authorization: Bearer {token}

Query Parameters:
- driverId: Optional, filter by driver (ObjectId string)
- status: Optional, enum filter (active, completed, paused, cancelled)
- recoveryType: Optional, enum filter
- limit: Optional, default 50, max 1000
- offset: Optional, default 0

Response: 200 OK
[
  {
    _id: "6507c3e8e9876543210fedcb",
    driverId: "6507c3e8e1234567890abcde",
    driverName: "John Doe",
    recoveryType: "advance",
    amount: 15000,
    recoveredAmount: 5000,
    remainingAmount: 10000,
    status: "active",
    emiAmount: 5000,
    installments: 3,
    createdAt: "2026-08-13T10:00:00Z"
  },
  ...
]

Error Responses:
400 Bad Request - Invalid query parameters
500 Internal Server Error
```

#### RECORD RECOVERY PAYMENT
```
POST /api/recoveries/{recoveryId}/payment
Content-Type: application/json
Authorization: Bearer {token}

Request Body:
{
  paidAmount: 5000 (required, number, > 0, in rupees)
}

Response: 200 OK
{
  _id: "6507c3e8e9876543210fedcb",
  recoveredAmount: 5000,
  remainingAmount: 10000,
  status: "active",
  ledgerEntries: ["6507c3e8e1111111111111111"],
  updatedAt: "2026-08-13T10:30:00Z"
}

Status Transitions:
- If remainingAmount <= 0 after payment:
  - status changes to "completed"
  - expectedCompletionDate set to current date

Error Responses:
404 Not Found - Recovery not found
400 Bad Request - Invalid paidAmount
400 Bad Request - Payment amount exceeds remaining balance
400 Bad Request - Recovery not in active status
500 Internal Server Error
```

### 3.3 Statistics & Reporting Endpoints

#### GET STATISTICS
```
GET /api/penalties-recoveries/stats?driverId={id}&month={m}&year={y}
Authorization: Bearer {token}

Query Parameters:
- driverId: Optional, filter by driver
- month: Optional, number (1-12)
- year: Optional, number (YYYY)

Response: 200 OK
{
  totalPenalties: 25000,
  totalRecoveries: 50000,
  totalRecovered: 15000,
  totalRemaining: 35000,
  pendingPenalties: 3,
  approvedPenalties: 5,
  deductedPenalties: 2,
  reversedPenalties: 0,
  activePenalties: 8,
  activeRecoveries: 12,
  completedRecoveries: 3,
  pausedRecoveries: 1,
  cancelledRecoveries: 0,
  penaltyByType: {
    damage: 10000,
    challan: 8000,
    cash_shortage: 5000,
    fuel_excess: 2000,
    attendance: 0,
    behavior: 0,
    other: 0
  },
  recoveryByType: {
    advance: 30000,
    loan: 15000,
    penalty: 5000,
    damage: 0,
    shortage: 0,
    fuel_excess: 0,
    other: 0
  }
}

Error Responses:
400 Bad Request - Invalid query parameters
500 Internal Server Error
```

#### GENERATE REPORT
```
GET /api/penalties-recoveries/report?startDate={date}&endDate={date}&driverId={id}
Authorization: Bearer {token}

Query Parameters:
- startDate: Required, ISO 8601 date (YYYY-MM-DD)
- endDate: Required, ISO 8601 date (YYYY-MM-DD)
- driverId: Optional, filter by driver

Validation:
- endDate must be >= startDate
- Date range must be <= 90 days
- Both dates required

Response: 200 OK
{
  period: {
    from: "2026-08-01T00:00:00Z",
    to: "2026-08-31T23:59:59Z"
  },
  penalties: {
    count: 8,
    total: 25000,
    byType: {
      damage: 10000,
      challan: 8000,
      cash_shortage: 5000,
      fuel_excess: 2000
    },
    byStatus: {
      pending: 1,
      approved: 3,
      deducted: 3,
      reversed: 1
    }
  },
  recoveries: {
    count: 5,
    total: 50000,
    recovered: 15000,
    remaining: 35000,
    byType: {
      advance: 30000,
      loan: 15000,
      penalty: 5000
    },
    byStatus: {
      active: 4,
      completed: 1,
      paused: 0,
      cancelled: 0
    }
  },
  ledgerImpact: {
    entriesCreated: 15,
    totalDeduction: 40000
  }
}

Error Responses:
400 Bad Request - startDate or endDate missing/invalid
400 Bad Request - Date range exceeds 90 days
500 Internal Server Error
```

## 4. Business Logic Rules

### 4.1 Penalty Rules

1. **Creation**:
   - Penalty created with "pending" status
   - Ledger entry created only after approval
   - Multiple penalties per driver allowed

2. **Approval**:
   - Only admin/manager can approve
   - Changes status to "approved"
   - Creates ledger entry
   - Records approver info + timestamp

3. **Deduction**:
   - Full Next Salary: Deduct 100% from next month's salary
   - EMI: Deduct (amount / installments) each month
   - Manual: Track separately, deduct when ready

4. **Status Transitions**:
   ```
   PENDING → APPROVED → DEDUCTED → (REVERSED)
   
   Valid transitions:
   - pending → approved (requires approval)
   - approved → deducted (automatic on salary calculation)
   - approved/deducted → reversed (admin only)
   - pending → reversed (cancel without approval)
   ```

### 4.2 Recovery Rules

1. **Creation**:
   - Recovery created with "active" status
   - Amount must be positive
   - EMI amount calculated: ceil(amount / installments)
   - Ledger entry created immediately

2. **Payment Recording**:
   - Paid amount deducted from remaining
   - New ledger entry created for each payment
   - Running balance updated
   - Status changes to "completed" when remainingAmount ≤ 0

3. **Status Transitions**:
   ```
   ACTIVE → COMPLETED (when 100% recovered)
      ↓
      PAUSED (temporarily stop)
      ↓
      ACTIVE (resume)
   
   ACTIVE → CANCELLED (stop recovery)
   ```

4. **EMI Calculation**:
   ```
   emiAmount = ceil(totalAmount / numberOfInstallments)
   
   Example: ₹15000 over 3 months
   emiAmount = ceil(15000 / 3) = 5000
   ```

### 4.3 Ledger Rules

1. **Automatic Entries**:
   - Created on penalty approval
   - Created on recovery creation
   - Created on recovery payment

2. **Immutability**:
   - Entries cannot be edited
   - Entries cannot be deleted
   - Can only be "reversed" (new entry created)

3. **Balance Calculation**:
   ```
   Accounting Rule:
   closingBalance = previousBalance + credits - debits
   
   For penalties (always debit):
   closingBalance = previousBalance - penaltyAmount
   
   For recovery payments (always debit):
   closingBalance = previousBalance - paymentAmount
   ```

## 5. Error Handling

### 5.1 HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Successful GET, POST response |
| 201 | Created | Penalty/Recovery successfully created |
| 400 | Bad Request | Missing/invalid parameters |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Status transition not allowed |
| 500 | Server Error | Database/unexpected error |

### 5.2 Error Response Format

```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE" (optional),
  "details": {} (optional, additional context)
}
```

### 5.3 Validation Errors

```json
{
  "error": "Validation failed",
  "details": {
    "amount": "Must be > 0",
    "reason": "Minimum 10 characters required",
    "penaltyType": "Invalid penalty type"
  }
}
```

## 6. Performance Specifications

### 6.1 Query Performance

| Operation | Expected Time | Optimization |
|-----------|---------------|--------------|
| List penalties (50 records) | < 100ms | Indexed queries |
| List recoveries (50 records) | < 100ms | Indexed queries |
| Get statistics | < 200ms | Aggregation pipeline |
| Generate report | < 500ms | Date range filtering |
| Create penalty | < 50ms | Direct insert |
| Record payment | < 100ms | Transaction write |

### 6.2 Scalability

- **Penalties per driver**: Unlimited (tested up to 10,000)
- **Recoveries per driver**: Unlimited (tested up to 5,000)
- **Ledger entries**: Partitioned by month/year
- **Concurrent users**: Tested up to 1,000 concurrent requests

### 6.3 Caching Strategy

- Penalty/Recovery lists: Cache 5 minutes
- Statistics: Cache 10 minutes (invalidate on mutation)
- Ledger entries: No caching (always fresh)

## 7. Security Specifications

### 7.1 Authentication

- All endpoints require valid JWT token
- Token validated via `requireAuth` middleware
- Token must include `user.id` and `user.role`

### 7.2 Authorization

- Tenant isolation via `tenantId` (checkTenantAccess middleware)
- Role-based access:
  - CREATE: admin, manager
  - READ: admin, manager, finance
  - APPROVE: admin only
  - DELETE/REVERSE: admin only

### 7.3 Data Protection

- All amounts in paise (no decimal handling)
- Immutable ledger entries (no updates/deletes)
- Audit trail on all operations
- No sensitive data in logs

## 8. Testing Specifications

### 8.1 Unit Tests

```typescript
// Example test cases
describe('penaltyRecoveryService', () => {
  test('createPenalty: creates pending penalty', async () => {
    const penalty = await createPenalty({...});
    expect(penalty.status).toBe('pending');
  });

  test('approvePenalty: creates ledger entry', async () => {
    const penalty = await approvePenalty(id, {...});
    // Verify ledger entry created
  });

  test('createRecovery: calculates EMI correctly', async () => {
    const recovery = await createRecovery({
      amount: 15000,
      installments: 3,
      recoveryMode: 'emi'
    });
    expect(recovery.emiAmount).toBe(5000);
  });
});
```

### 8.2 Integration Tests

- Test full penalty workflow (create → approve → deduct)
- Test full recovery workflow (create → payment → complete)
- Test ledger entry creation and balance calculation
- Test concurrent operations

### 8.3 Load Tests

- 1000 concurrent penalty queries
- 500 concurrent payment recordings
- Report generation with 10,000+ records

## 9. Deployment Checklist

- [ ] Database indexes created
- [ ] Penalty schema created
- [ ] Recovery schema created
- [ ] API routes registered
- [ ] React component added
- [ ] Navigation manifest updated
- [ ] Route definitions updated
- [ ] Permissions configured
- [ ] Environment variables set
- [ ] Logging enabled
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Rollback procedure tested

## 10. Monitoring & Alerts

### 10.1 Metrics to Track

- Average response time per endpoint
- Error rate (400s, 500s)
- Penalty creation rate
- Recovery payment success rate
- Ledger entry count
- Database query performance

### 10.2 Alert Thresholds

- Response time > 1000ms: WARNING
- Error rate > 5%: ALERT
- Query time > 500ms: WARNING
- Database connection errors: CRITICAL

## 11. Configuration

### 11.1 Environment Variables

```bash
# Penalty & Recovery
PENALTY_MAX_AMOUNT=100000  # Max penalty in rupees
RECOVERY_MAX_INSTALLMENTS=24
RECOVERY_MIN_INSTALLMENTS=2
REPORT_MAX_DATE_RANGE=90  # days

# Timeouts
PAYMENT_RECORDING_TIMEOUT=5000  # ms
STATISTICS_QUERY_TIMEOUT=10000  # ms

# Features
ENABLE_AUTO_DEDUCTION=false
ENABLE_RECOVERY_REMINDERS=true
```

### 11.2 Feature Flags

- `penaltyRecoveryEnabled`: Enable/disable entire feature
- `autoDeductPenalties`: Auto-deduct from salary
- `recoveryReminders`: Send payment reminders
- `bulkImport`: Enable CSV import

---

**This specification is subject to change based on implementation feedback.**
