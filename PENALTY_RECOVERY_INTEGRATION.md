# Penalty & Recovery Management - Integration Guide

## Quick Start

This guide explains how to integrate the Penalty & Recovery Management system into FleetPro.

## Step 1: Add Database Models

The Penalty and Recovery models should be added to `server/models/index.ts`.

```typescript
// server/models/index.ts

// Add these schemas:

export interface IPenalty extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  driverName: string;
  penaltyType: 'damage' | 'challan' | 'cash_shortage' | 'fuel_excess' | 'attendance' | 'behavior' | 'other';
  amount: number;
  reason: string;
  date?: Date;
  status: 'pending' | 'approved' | 'deducted' | 'reversed';
  deductionMode: 'full_next_salary' | 'emi' | 'manual';
  installments?: number;
  appliedTo?: number;
  ledgerEntryId?: mongoose.Types.ObjectId;
  approvedBy?: { userId: string; role: string; timestamp: string };
  notes?: string;
  createdBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const PenaltySchema = new Schema<IPenalty>({
  tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
  driverId: { type: Schema.Types.ObjectId, required: true, index: true },
  driverName: { type: String, required: true },
  penaltyType: {
    type: String,
    enum: ['damage', 'challan', 'cash_shortage', 'fuel_excess', 'attendance', 'behavior', 'other'],
    required: true,
  },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  date: { type: Date, default: new Date() },
  status: {
    type: String,
    enum: ['pending', 'approved', 'deducted', 'reversed'],
    default: 'pending',
  },
  deductionMode: {
    type: String,
    enum: ['full_next_salary', 'emi', 'manual'],
    default: 'full_next_salary',
  },
  installments: { type: Number, default: 1 },
  appliedTo: { type: Number, default: 0 },
  ledgerEntryId: { type: Schema.Types.ObjectId },
  approvedBy: {
    userId: String,
    role: String,
    timestamp: String,
  },
  notes: String,
  createdBy: {
    userId: String,
    role: String,
  },
  createdAt: { type: Date, default: new Date() },
  updatedAt: { type: Date, default: new Date() },
});

PenaltySchema.index({ tenantId: 1, driverId: 1 });
PenaltySchema.index({ tenantId: 1, status: 1 });
PenaltySchema.index({ tenantId: 1, month: 1, year: 1 });

export const Penalty = mongoose.model<IPenalty>('Penalty', PenaltySchema);

// Similar for Recovery...

export interface IRecovery extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  driverName: string;
  recoveryType: 'advance' | 'loan' | 'penalty' | 'damage' | 'shortage' | 'fuel_excess' | 'other';
  amount: number;
  originalAmount?: number;
  description: string;
  startDate: Date;
  expectedCompletionDate?: Date;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  recoveryMode: 'single' | 'emi' | 'manual';
  installments?: number;
  emiAmount?: number;
  recoveredAmount: number;
  remainingAmount: number;
  ledgerEntries?: mongoose.Types.ObjectId[];
  createdBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const RecoverySchema = new Schema<IRecovery>({
  tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
  driverId: { type: Schema.Types.ObjectId, required: true, index: true },
  driverName: { type: String, required: true },
  recoveryType: {
    type: String,
    enum: ['advance', 'loan', 'penalty', 'damage', 'shortage', 'fuel_excess', 'other'],
    required: true,
  },
  amount: { type: Number, required: true },
  originalAmount: Number,
  description: { type: String, required: true },
  startDate: { type: Date, default: new Date() },
  expectedCompletionDate: Date,
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'cancelled'],
    default: 'active',
  },
  recoveryMode: {
    type: String,
    enum: ['single', 'emi', 'manual'],
    default: 'single',
  },
  installments: Number,
  emiAmount: Number,
  recoveredAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, required: true },
  ledgerEntries: [{ type: Schema.Types.ObjectId, ref: 'DriverSalaryLedger' }],
  createdBy: {
    userId: String,
    role: String,
  },
  createdAt: { type: Date, default: new Date() },
  updatedAt: { type: Date, default: new Date() },
});

RecoverySchema.index({ tenantId: 1, driverId: 1 });
RecoverySchema.index({ tenantId: 1, status: 1 });

export const Recovery = mongoose.model<IRecovery>('Recovery', RecoverySchema);
```

## Step 2: Register API Routes

Add the penalty recovery routes to the main server file:

```typescript
// server/index.ts

import penaltyRecoveryRoutes from './routes/penaltyRecovery';

// ... other routes ...

app.use('/api', penaltyRecoveryRoutes);
```

## Step 3: Add Navigation Entry

Add the page to the navigation manifest:

```typescript
// client/src/modules/manifest.ts

export const manifest = [
  // ... other entries ...
  {
    id: 'penalty-recovery',
    label: '🚨 Penalty & Recovery',
    path: '/penalty-recovery',
    category: 'Payroll',
    icon: 'AlertTriangle',
    roles: ['admin', 'manager'],
    description: 'Manage penalties and recovery tracking',
  },
  // ... more entries ...
];
```

## Step 4: Add Route Definition

Add the route to the routing configuration:

```typescript
// client/src/routes.ts

import PenaltyRecoveryManagement from './pages/penalty-recovery-management';

export const routes = [
  // ... other routes ...
  {
    path: '/penalty-recovery',
    component: PenaltyRecoveryManagement,
    requiresAuth: true,
  },
  // ... more routes ...
];
```

## Step 5: Update Sidebar

If using the sidebar navigation:

```typescript
// client/src/components/layout/sidebar.tsx

// Add to payroll section:
<NavItem
  icon={AlertTriangle}
  label="Penalty & Recovery"
  href="/penalty-recovery"
  roles={['admin', 'manager']}
/>
```

## Step 6: Add to Package Imports (Optional)

If creating a unified services file:

```typescript
// server/services/index.ts

export * from './penaltyRecoveryService';
export * from './ledgerEntryAutomation';
```

## Integration Points

### 1. Payroll System
The penalty and recovery system integrates with payroll by:
- Creating ledger entries for deductions
- Tracking recovery amounts separately from salary
- Maintaining running balance for each driver

### 2. Salary Calculation
When calculating salary:
```typescript
// In salary calculation service
const totalDeductions = await getLedgerEntries({
  driverId,
  month,
  year,
  transactionType: ['penalty', 'damage_recovery', 'challan_recovery', 'cash_shortage', 'fuel_excess']
});

const totalDeductionAmount = totalDeductions.reduce((sum, entry) => sum + entry.amount, 0);
const netSalary = baseSalary - totalDeductionAmount;
```

### 3. Ledger System
Penalties and recoveries automatically appear in the salary ledger:
```typescript
// In ledger view component
const ledgerEntries = await getLedgerEntries({
  driverId,
  month,
  year,
});

// Filter for penalty/recovery entries
const penaltyRecoveryEntries = ledgerEntries.filter(e =>
  ['penalty', 'damage_recovery', 'challan_recovery', 'cash_shortage', 'fuel_excess'].includes(e.transactionType)
);
```

### 4. Driver Dashboard
Can add widgets to driver dashboard:
```typescript
// In driver dashboard
const stats = await getPenaltyRecoveryStats({ driverId });

// Display cards
<StatCard
  title="Outstanding Recoveries"
  value={fmtMoney(stats.totalRemaining)}
  trend="warning"
/>
```

## API Endpoint Summary

```
POST   /api/penalties                      # Create penalty
GET    /api/penalties                      # List penalties
POST   /api/penalties/:id/approve          # Approve penalty
POST   /api/recoveries                     # Create recovery
GET    /api/recoveries                     # List recoveries
POST   /api/recoveries/:id/payment         # Record recovery payment
GET    /api/penalties-recoveries/stats     # Get statistics
GET    /api/penalties-recoveries/report    # Generate report
```

## Testing the Integration

### 1. Test Penalty Creation
```bash
curl -X POST http://localhost:5050/api/penalties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "driverId": "driver_id",
    "penaltyType": "damage",
    "amount": 5000,
    "reason": "Vehicle damage",
    "deductionMode": "emi",
    "installments": 3
  }'
```

### 2. Test Recovery Creation
```bash
curl -X POST http://localhost:5050/api/recoveries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "driverId": "driver_id",
    "recoveryType": "advance",
    "amount": 15000,
    "description": "Advance recovery",
    "recoveryMode": "emi",
    "installments": 3
  }'
```

### 3. Test Ledger Integration
```bash
curl -X GET "http://localhost:5050/api/ledger?driverId=driver_id&month=8&year=2026" \
  -H "Authorization: Bearer <token>"
```

## Database Migrations (if needed)

If adding to an existing database:

```typescript
// server/migrations/add-penalty-recovery.ts

export async function up(db: Database) {
  // Create Penalty collection
  await db.createCollection('penalties', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenantId', 'driverId', 'penaltyType', 'amount', 'reason'],
        properties: {
          tenantId: { bsonType: 'objectId' },
          driverId: { bsonType: 'objectId' },
          penaltyType: { enum: ['damage', 'challan', 'cash_shortage', 'fuel_excess', 'attendance', 'behavior', 'other'] },
          amount: { bsonType: 'number' },
          // ... more properties
        }
      }
    }
  });

  // Create indexes
  await db.collection('penalties').createIndex({ tenantId: 1, driverId: 1 });
  await db.collection('penalties').createIndex({ tenantId: 1, status: 1 });

  // Similar for recoveries
}

export async function down(db: Database) {
  await db.dropCollection('penalties');
  await db.dropCollection('recoveries');
}
```

## Permissions & Access Control

Ensure proper permissions are set:

```typescript
// Middleware check for penalty/recovery operations
const penaltyRecoveryPermission = (req, res, next) => {
  const allowedRoles = ['admin', 'manager', 'finance'];
  
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
};

// Apply to routes
router.post('/penalties', penaltyRecoveryPermission, ...);
router.post('/recoveries', penaltyRecoveryPermission, ...);
```

## Environment Configuration (if needed)

```bash
# .env
ENABLE_PENALTY_RECOVERY=true
PENALTY_AUTO_DEDUCT=false  # Auto-deduct penalties on due date
RECOVERY_NOTIFICATION_DAYS=7  # Send reminder 7 days before due
```

## Monitoring & Logging

Add logging to track operations:

```typescript
// In service functions
import logger from '../utils/logger';

export async function createPenalty(input: CreatePenaltyInput) {
  logger.info('Creating penalty', {
    driverId: input.driverId,
    amount: input.amount,
    type: input.penaltyType,
  });

  try {
    const penalty = await Penalty.create({...});
    logger.info('Penalty created successfully', { penaltyId: penalty._id });
    return penalty;
  } catch (error) {
    logger.error('Failed to create penalty', { error });
    throw error;
  }
}
```

## Troubleshooting Integration

### Issue: Routes not responding
- Verify routes are registered in `server/index.ts`
- Check middleware order (auth before routes)
- Test with curl/Postman

### Issue: UI page not showing
- Verify route added to `client/src/routes.ts`
- Check manifest has entry
- Clear browser cache

### Issue: Ledger entries not appearing
- Verify ledgerEntryAutomation.ts is imported
- Check service function is calling createLedgerEntry
- Verify DriverSalaryLedger model exists

### Issue: Database errors
- Run migrations if needed
- Check indexes are created
- Verify connection string

## Production Deployment Checklist

- [ ] Database schemas created with indexes
- [ ] API routes tested and working
- [ ] UI page integrated and displaying
- [ ] Ledger integration verified
- [ ] Permissions configured correctly
- [ ] Error handling tested
- [ ] Logging enabled
- [ ] Backups configured
- [ ] User documentation prepared
- [ ] Training materials ready
- [ ] Performance testing done
- [ ] Security audit completed

## Support & Documentation

- [Full Documentation](./PENALTY_RECOVERY_MANAGEMENT.md)
- [API Endpoint Reference](./PENALTY_RECOVERY_MANAGEMENT.md#api-endpoints)
- [Data Models Reference](./PENALTY_RECOVERY_MANAGEMENT.md#data-models)
- [Troubleshooting Guide](./PENALTY_RECOVERY_MANAGEMENT.md#troubleshooting)
