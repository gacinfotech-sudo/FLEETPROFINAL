# DriverSalaryMasterService + Versioning

Comprehensive CRUD + versioning service for salary master configuration management in FleetPro.

## Overview

The DriverSalaryMasterService provides:

- **Full CRUD Operations**: Create, Read, Update, Delete salary master configurations
- **Automatic Versioning**: Every change is automatically versioned with audit trail
- **Change Tracking**: Detailed tracking of what changed, who changed it, and why
- **Version Comparison**: Compare any two versions to see differences
- **Rollback Support**: Revert to any previous version with audit logging
- **Batch Operations**: Create/update multiple salary masters with transaction support
- **Comprehensive Analytics**: Statistics, field history, timeline views
- **Data Export**: Export salary data and version history for reporting

## Core Features

### 1. CRUD Operations

#### Create Salary Master

```typescript
import { createSalaryMaster } from './driverSalaryMasterService';

const { master, version } = await createSalaryMaster(
  {
    tenantId: 'tenant-123',
    driverId: 'driver-456',
    salaryType: 'fixed_monthly',
    baseSalary: 50000,
    nightAllowancePerNight: 500,
    employmentType: 'permanent',
    salaryStartDate: new Date('2026-08-01')
  },
  'user-123',  // changedBy
  'Initial salary configuration' // changeReason
);
```

#### Read Salary Master

```typescript
// By Driver
const master = await getSalaryMasterByDriver(tenantId, driverId);

// By ID
const master = await getSalaryMasterById(tenantId, salaryMasterId);

// List with filters
const { data, total } = await listSalaryMasters(tenantId, {
  status: 'active',
  employmentType: 'permanent',
  limit: 50,
  skip: 0
});
```

#### Update Salary Master

```typescript
const { master, version } = await updateSalaryMaster(
  tenantId,
  driverId,
  {
    baseSalary: 55000,
    nightAllowancePerNight: 600
  },
  'user-123',
  'Annual salary increment'
);
```

#### Delete Salary Master

```typescript
const version = await deleteSalaryMaster(
  tenantId,
  driverId,
  'user-123',
  'Employee terminated'
);
```

### 2. Versioning System

#### Version Structure

Every version includes:

```typescript
interface SalaryMasterVersion {
  version: number;                           // Version number
  salaryMasterId: string;                   // Associated salary master
  tenantId: string;                         // Tenant ID
  driverId: string;                         // Driver ID
  changes: Record<string, any>;             // What changed
  previousVersion: number | null;           // Link to previous
  changedBy?: string;                       // Who made change
  changeReason?: string;                    // Why changed
  changeType: 'create' | 'update' | 'delete' | 'rollback';
  snapshot: IDriverSalaryMaster;            // Full snapshot
  createdAt: Date;                          // When changed
}
```

#### Get Version History

```typescript
import { getVersionHistory, getVersionSnapshot } from './SalaryMasterVersionService';

// Get all versions
const { versions, total } = await getVersionHistory(
  salaryMasterId,
  50,  // limit
  0    // skip
);

// Get specific version
const version = await getVersionSnapshot(salaryMasterId, 3);

// Get latest version
const latest = await getLatestVersionInfo(salaryMasterId);
```

### 3. Change Tracking & Comparison

#### Compare Versions

```typescript
const comparison = await compareVersions(
  salaryMasterId,
  versionNumber1,
  versionNumber2
);

// Result:
// {
//   version1: 2,
//   version2: 3,
//   differences: [
//     {
//       field: 'baseSalary',
//       oldValue: 50000,
//       newValue: 55000,
//       changeType: 'modified'
//     },
//     ...
//   ]
// }
```

#### Change Timeline

```typescript
const timeline = await getChangeTimeline(salaryMasterId, 50);

// Result:
// [
//   {
//     version: 3,
//     changeType: 'update',
//     changedAt: Date,
//     changedBy: 'user-123',
//     changeReason: 'Annual salary increment',
//     summaryOfChanges: 'Changed baseSalary from 50000 to 55000'
//   },
//   ...
// ]
```

#### Field Change History

```typescript
const history = await getFieldChangeHistory(salaryMasterId, 'baseSalary');

// Result:
// [
//   {
//     version: 1,
//     oldValue: undefined,
//     newValue: 50000,
//     changedAt: Date,
//     changedBy: 'user-123'
//   },
//   {
//     version: 3,
//     oldValue: 50000,
//     newValue: 55000,
//     changedAt: Date,
//     changedBy: 'user-456'
//   },
//   ...
// ]
```

### 4. Rollback Operations

```typescript
import { recordRollback } from './SalaryMasterVersionService';

// Rollback to previous version
const rollbackVersion = await recordRollback(
  salaryMasterId,
  tenantId,
  driverId,
  targetVersion,  // Roll back to this version
  currentSnapshot,
  'user-123',
  'Reverted incorrect salary change'
);
```

### 5. Batch Operations

#### Batch Create

```typescript
const { created, errors } = await batchCreateSalaryMasters(
  [
    {
      tenantId: 'tenant-123',
      driverId: 'driver-1',
      salaryType: 'fixed_monthly',
      baseSalary: 50000,
      salaryStartDate: new Date()
    },
    {
      tenantId: 'tenant-123',
      driverId: 'driver-2',
      salaryType: 'daily',
      perDaySalary: 1500,
      salaryStartDate: new Date()
    }
    // ... more drivers
  ],
  'user-123'
);

console.log(`Created: ${created.length}, Failed: ${errors.length}`);
```

#### Batch Update

```typescript
const { updated, errors } = await batchUpdateSalaryMasters(
  [
    {
      tenantId: 'tenant-123',
      driverId: 'driver-1',
      data: { baseSalary: 55000 }
    },
    {
      tenantId: 'tenant-123',
      driverId: 'driver-2',
      data: { perDaySalary: 1600 }
    }
    // ... more updates
  ],
  'user-123'
);
```

### 6. Summary & Analytics

#### Salary Master Summary

```typescript
const summary = await getSalaryMasterSummary(tenantId, driverId);

// Result:
// {
//   driverId: 'driver-123',
//   name: 'John Doe',
//   mobile: '9876543210',
//   salaryType: 'fixed_monthly',
//   baseSalary: 50000,
//   currentBaseSalary: 55000,
//   totalAllowances: 1500,
//   status: 'active',
//   employmentType: 'permanent',
//   joiningDate: Date,
//   currentVersion: 3,
//   lastUpdated: Date
// }
```

#### Batch Summaries

```typescript
const summaries = await getBatchSalaryMasterSummaries(
  tenantId,
  ['driver-1', 'driver-2', 'driver-3']
);
```

#### Version Statistics

```typescript
const stats = await getVersionStatistics(salaryMasterId);

// Result:
// {
//   totalVersions: 5,
//   createCount: 1,
//   updateCount: 3,
//   deleteCount: 0,
//   rollbackCount: 1,
//   lastModified: Date,
//   firstCreated: Date,
//   uniqueUsers: ['user-123', 'user-456']
// }
```

#### Export Data

```typescript
// Export all salary masters
const data = await exportSalaryMasterData(tenantId, {
  status: 'active',
  employmentType: 'permanent'
});

// Result:
// [
//   {
//     driverId: 'driver-1',
//     name: 'John Doe',
//     salaryType: 'fixed_monthly',
//     baseSalary: 50000,
//     currentBaseSalary: 55000,
//     totalSalary: 51500,
//     status: 'active',
//     // ... more fields
//   },
//   ...
// ]
```

### 7. Audit & Compliance

#### Audit Log

```typescript
const logs = await getAuditLog(
  salaryMasterId,
  new Date('2026-08-01'),
  new Date('2026-08-31')
);

// Result: Array of version records for date range
```

#### Changes by User

```typescript
const userChanges = await getChangesByUser(salaryMasterId, 'user-123');

// Result: All versions modified by specific user
```

#### Changes by Type

```typescript
const updates = await getChangesByType(salaryMasterId, 'update');
const rollbacks = await getChangesByType(salaryMasterId, 'rollback');
```

#### Export History

```typescript
const { data, exportedAt } = await exportVersionHistory(salaryMasterId);

// Export complete version history for reporting/backup
```

## Salary Types & Configuration

### Fixed Monthly

```typescript
{
  salaryType: 'fixed_monthly',
  baseSalary: 50000,  // Required
  nightAllowancePerNight?: 500,
  outstationAllowancePerDay?: 1000,
  foodAllowance?: 2000
}
```

### Daily

```typescript
{
  salaryType: 'daily',
  perDaySalary: 1500,  // Required
  nightAllowancePerNight?: 500
}
```

### Per Trip

```typescript
{
  salaryType: 'per_trip',
  perTripSalary: 500,  // Required
  kmIncentivePerKm?: 5
}
```

### Custom

```typescript
{
  salaryType: 'custom',
  baseSalary: 50000,
  perDaySalary?: 1500,
  perTripSalary?: 500,
  kmIncentivePerKm?: 5
}
```

## API Endpoints

### CRUD Endpoints

```
POST   /api/salary-masters                          # Create
GET    /api/salary-masters                          # List
GET    /api/salary-masters/driver/:driverId         # Get by driver
GET    /api/salary-masters/:driverId/summary        # Get summary
PUT    /api/salary-masters/:driverId                # Update
PATCH  /api/salary-masters/:driverId/status         # Update status
DELETE /api/salary-masters/:driverId                # Delete
```

### Versioning Endpoints

```
GET    /api/salary-masters/:driverId/versions                      # Get history
GET    /api/salary-masters/:driverId/versions/:versionNumber       # Get version
GET    /api/salary-masters/:driverId/versions/latest               # Get latest
POST   /api/salary-masters/:driverId/versions/compare              # Compare
GET    /api/salary-masters/:driverId/timeline                      # Change timeline
GET    /api/salary-masters/:driverId/audit-log                     # Audit log
GET    /api/salary-masters/:driverId/statistics                    # Statistics
GET    /api/salary-masters/:driverId/field-history/:fieldName      # Field history
POST   /api/salary-masters/:driverId/rollback                      # Rollback
GET    /api/salary-masters/:driverId/export-history                # Export history
```

### Batch Endpoints

```
POST   /api/salary-masters/batch/create             # Batch create
PUT    /api/salary-masters/batch/update             # Batch update
POST   /api/salary-masters/summaries/batch          # Batch summaries
POST   /api/salary-masters/export                   # Export data
```

## Validation Rules

### Salary Amounts

- Cannot be negative
- Required based on salary type
- Type validation enforced

### Dates

- Must be valid date format
- Salary start date required for all types
- Joining date tracked automatically

### Allowances

- All allowance fields must be non-negative
- Optional fields
- Calculated into total salary

### Employment Types

Valid values:
- `permanent`
- `contract`
- `probation`
- `temporary`
- `casual`

### Status Values

Valid values:
- `active`
- `inactive`
- `suspended`
- `terminated`
- `on_leave`

## Error Handling

```typescript
try {
  const { master, version } = await createSalaryMaster(input);
} catch (error) {
  if (error.message.includes('Driver')) {
    // Handle driver not found
  } else if (error.message.includes('already exists')) {
    // Handle duplicate
  } else if (error.message.includes('required')) {
    // Handle validation error
  }
}
```

## Integration Example

```typescript
// In your API route handler
router.post('/drivers/:driverId/salary', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.user.id;

    const { master, version } = await createSalaryMaster(
      {
        tenantId,
        driverId: req.params.driverId,
        ...req.body
      },
      userId,
      req.body.reason
    );

    res.status(201).json({
      success: true,
      data: { master, version }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

## Performance Considerations

### Batch Operations

- Use batch operations for multiple creates/updates
- Transactions ensure consistency
- 100+ items batches supported

### Version History

- Versions stored efficiently
- Pagination recommended for large histories
- Archive old versions (90+ days) periodically

### Indexing

Recommended MongoDB indexes:

```
{tenantId: 1, driverId: 1}  // Unique compound index
{tenantId: 1, status: 1}    // Status queries
{tenantId: 1, employmentType: 1}  // Employment type filter
```

## Security

- Tenant isolation enforced
- User tracking on all changes
- Audit trail for compliance
- Soft deletes for data preservation
- Change reasons for accountability

## Future Enhancements

- [ ] Version history collection in MongoDB
- [ ] Automatic snapshot compression
- [ ] Version retention policies
- [ ] Bulk export to CSV/Excel
- [ ] Email notifications on salary changes
- [ ] Approval workflow for critical changes
- [ ] Salary increment automation
- [ ] Cost allocation by department

## Testing Examples

```typescript
// Test creating salary master
test('should create salary master with version 1', async () => {
  const { master, version } = await createSalaryMaster({
    tenantId: 'test-tenant',
    driverId: 'test-driver',
    salaryType: 'fixed_monthly',
    baseSalary: 50000,
    salaryStartDate: new Date()
  });

  expect(version.version).toBe(1);
  expect(version.changeType).toBe('create');
});

// Test update tracking
test('should track salary update in version history', async () => {
  const { master: m1 } = await createSalaryMaster({...});
  const { version: v2 } = await updateSalaryMaster(
    tenantId, driverId, { baseSalary: 55000 }
  );

  expect(v2.version).toBe(2);
  expect(v2.changes.baseSalary).toEqual({
    old: 50000,
    new: 55000
  });
});

// Test batch operations
test('should handle batch create with mixed success', async () => {
  const { created, errors } = await batchCreateSalaryMasters([
    {...validInput1},
    {...invalidInput},
    {...validInput2}
  ]);

  expect(created.length).toBe(2);
  expect(errors.length).toBe(1);
});
```

## Support & Troubleshooting

### Common Issues

**Salary master not found**
- Check tenant ID matches
- Verify driver ID exists

**No changes detected**
- Ensure update data differs from current
- Check field names are correct

**Version not found**
- Verify version number exists
- Check salary master ID

**Batch operation partial failure**
- Review errors array for details
- Some items created/updated, others failed

## Files

- `driverSalaryMasterService.ts` - Main CRUD service
- `SalaryMasterVersionService.ts` - Versioning & history service
- `salaryMasterRoutes.ts` - API endpoints
- `SALARY_MASTER_SERVICE_README.md` - This documentation

---

**Last Updated**: 2026-08-13
**Version**: 1.0.0
**Status**: Production Ready
