# Salary Calculation Engine - Driver Salary Profile Integration

## Overview

The salary calculation engine has been enhanced to integrate seamlessly with the Driver Salary Profile system. This enables automated, validated salary calculations based on the driver's active configuration.

## Key Features

### 1. **Active Salary Configuration Management**

The engine now supports fetching and validating active salary configurations directly:

```typescript
import { getActiveSalaryConfig, validateSalaryMasterIsActive } from './services/salaryCalculationEngine';

// Get active salary configuration for a driver
const activeSalary = await getActiveSalaryConfig(driverId, tenantId);

// Validate that configuration is active
const validation = validateSalaryMasterIsActive(activeSalary);
if (!validation.valid) {
  console.error(validation.error);
}
```

### 2. **Configuration Status Queries**

Check complete salary configuration status:

```typescript
import { getSalaryConfigurationStatus } from './services/salaryCalculationEngine';

const status = await getSalaryConfigurationStatus(driverId, tenantId);
console.log({
  hasActiveSalary: status.hasActiveSalary,
  activeConfig: status.activeConfig,
  linkedToDriver: status.linkedToDriver,
  issues: status.issues
});
```

### 3. **Async Salary Calculation with Active Config**

Calculate salary automatically using the active configuration:

```typescript
import { calculateSalaryWithActiveConfig } from './services/salaryCalculationEngine';

const calculation = await calculateSalaryWithActiveConfig({
  driverId: 'driver-123',
  tenantId: 'tenant-456',
  useActiveSalaryConfig: true,
  validateSalaryMasterActive: true,
  salaryPeriodStart: new Date('2024-01-01'),
  salaryPeriodEnd: new Date('2024-01-31'),
  payableDays: 26,
  payrollDays: 31,
  presentDays: 25,
  paidLeaveDays: 0,
  unpaidLeaveDays: 0,
  weeklyOffDays: 2,
  halfDays: 0,
  absentDays: 0,
  bookingServiceDays: 20,
  totalKilometers: 5000,
  nightDutyTrips: 5,
  outstationTrips: 2,
  manualAllowances: 0,
  manualDeductions: 0
});

console.log(calculation.result); // SalaryCalculationResult
console.log(calculation.configStatus); // 'active'
```

## API Endpoints

### Get Salary Configuration Status

```
GET /api/salary-profile/:driverId/status
```

Returns current salary configuration status for a driver.

**Response:**
```json
{
  "hasActiveSalary": true,
  "activeConfig": { /* DriverSalaryMaster */ },
  "lastModified": "2024-01-15T10:30:00Z",
  "configurationStatus": "active",
  "linkedToDriver": true,
  "issues": []
}
```

### Get Health Report

```
GET /api/salary-profile/:driverId/health
```

Comprehensive health report including validation and recommendations.

**Response:**
```json
{
  "driverId": "driver-123",
  "driverName": "John Doe",
  "overallStatus": "healthy",
  "configurationStatus": { /* ... */ },
  "validationStatus": { /* ... */ },
  "linkingStatus": { /* ... */ },
  "history": { /* ... */ },
  "recommendations": []
}
```

### Validate Tenant Configurations

```
GET /api/salary-profile/tenant/validate
```

Validates salary configurations for all drivers in a tenant.

**Response:**
```json
{
  "tenantId": "tenant-456",
  "totalDrivers": 50,
  "driversSummary": {
    "withActiveSalary": 48,
    "properlyLinked": 45,
    "withIssues": 5
  },
  "criticalIssues": [ /* ... */ ],
  "warnings": [ /* ... */ ]
}
```

### Calculate Salary

```
POST /api/salary-profile/:driverId/calculate
```

Calculate salary using active configuration.

**Request:**
```json
{
  "salaryPeriodStart": "2024-01-01",
  "salaryPeriodEnd": "2024-01-31",
  "payableDays": 26,
  "payrollDays": 31,
  "presentDays": 25,
  "paidLeaveDays": 0,
  "unpaidLeaveDays": 0,
  "weeklyOffDays": 2,
  "halfDays": 0,
  "absentDays": 0,
  "bookingServiceDays": 20,
  "totalKilometers": 5000,
  "nightDutyTrips": 5,
  "outstationTrips": 2,
  "manualAllowances": 0,
  "manualDeductions": 0,
  "validateSalaryMasterActive": true
}
```

**Response:**
```json
{
  "calculation": { /* SalaryCalculationResult */ },
  "configStatus": "active"
}
```

### Link Salary Master

```
POST /api/salary-profile/:driverId/link
```

Link active salary master to driver profile.

**Request:**
```json
{
  "salaryMasterId": "salary-master-789"
}
```

### Create Salary Configuration

```
POST /api/salary-profile/:driverId/create
```

Create new salary configuration for a driver.

**Request:**
```json
{
  "baseSalary": 20000,
  "salaryType": "fixed_monthly",
  "employmentType": "permanent",
  "perTripSalary": 500,
  "kmIncentivePerKm": 5,
  "nightAllowancePerNight": 100,
  "foodAllowance": 2000,
  "bankName": "ICICI Bank",
  "accountNumber": "1234567890",
  "ifscCode": "ICIC0000001",
  "joiningDate": "2024-01-01"
}
```

### Update Salary Configuration

```
PUT /api/salary-profile/:driverId/update
```

Update active salary configuration (creates new version).

**Request:**
```json
{
  "baseSalary": 22000,
  "perTripSalary": 550
}
```

### Deactivate Salary Configuration

```
POST /api/salary-profile/:driverId/deactivate
```

Deactivate salary configuration for a driver.

### Export Configuration History

```
GET /api/salary-profile/:driverId/history
```

Export complete salary configuration history for audit purposes.

## Service Integration

### Driver Salary Profile Service

The `driverSalaryProfileService` provides high-level operations:

```typescript
import {
  linkActiveSalaryMasterToDriver,
  getSalaryConfigurationHealthReport,
  validateTenantSalaryConfigurations,
  createDriverSalaryConfiguration,
  updateDriverSalaryConfiguration,
  deactivateDriverSalaryConfiguration,
  exportDriverSalaryConfigurationHistory
} from './services/driverSalaryProfileService';

// Create salary configuration
const config = await createDriverSalaryConfiguration(
  driverId,
  tenantId,
  {
    baseSalary: 20000,
    salaryType: 'fixed_monthly',
    employmentType: 'permanent'
  },
  { userId: 'admin-1', role: 'admin' }
);

// Get health report
const health = await getSalaryConfigurationHealthReport(driverId, tenantId);

// Validate entire tenant
const validation = await validateTenantSalaryConfigurations(tenantId);
```

## Data Model

### DriverSalaryMaster

```typescript
interface IDriverSalaryMaster {
  tenantId: ObjectId;
  driverId: ObjectId;
  name: string;
  mobile: string;
  joiningDate: Date;
  joiningBaseSalary: number;
  currentBaseSalary: number;
  employmentType: 'permanent' | 'contract' | 'probation' | 'temporary' | 'casual';
  salaryType: 'fixed_monthly' | 'daily' | 'per_trip' | 'fixed_incentive' | 'custom';
  baseSalary: number;
  perDaySalary?: number;
  perTripSalary?: number;
  kmIncentivePerKm?: number;
  nightAllowancePerNight?: number;
  outstationAllowancePerDay?: number;
  foodAllowance?: number;
  perBookingFoodCharge?: number;
  overtimeRatePerHour?: number;
  extraDutyRate?: number;
  weeklyOffDays?: number[];
  weeklyOffLeaveType?: 'paid' | 'unpaid' | 'compensatory';
  salaryStartDate: Date;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  status: 'active' | 'inactive' | 'suspended' | 'terminated' | 'on_leave';
  createdAt: Date;
  updatedAt: Date;
}
```

### Driver Profile Link

The `Driver` model includes:

```typescript
interface IDriver {
  // ... existing fields
  activeSalaryMasterId?: ObjectId;  // Reference to active salary config
  baseSalary?: number;              // Denormalized for quick access
  salaryStructureType?: string;      // Reference to salary type
  ctcAmount?: number;               // Cost to company
  lastModifiedBy?: string;          // Who made the change
  lastModifiedAt?: Date;            // When it was modified
}
```

## Error Handling

The engine provides typed error handling:

```typescript
import { SalaryConfigurationError } from './services/salaryCalculationEngine';

try {
  const result = await calculateSalaryWithActiveConfig({
    // ...
    useActiveSalaryConfig: true
  });
} catch (error) {
  if (error instanceof SalaryConfigurationError) {
    console.error(`Error [${error.code}]: ${error.message}`);
    // Handle specific error codes
    switch (error.code) {
      case 'NO_ACTIVE_SALARY_CONFIG':
        // No active configuration found
        break;
      case 'INACTIVE_SALARY_CONFIG':
        // Configuration is not active
        break;
      case 'INCOMPLETE_SALARY_CONFIG':
        // Configuration is missing required fields
        break;
    }
  }
}
```

## Validation Rules

### Status Validation

A salary configuration must have `status: 'active'` to be used for calculations (unless validation is explicitly disabled).

### Completeness Validation

Required fields based on salary type:
- **All types**: `driverId`, `baseSalary`, `salaryType`, `salaryStartDate`
- **per_trip**: `perTripSalary`
- **daily**: `perDaySalary`

### Driver Linking

Best practice: Link active salary master to driver profile using:
```typescript
await linkActiveSalaryMasterToDriver(driverId, salaryMasterId, tenantId, { userId, role });
```

This ensures:
- `Driver.activeSalaryMasterId` references the active config
- Quick lookup without database queries
- Audit trail of who made changes

## Usage Examples

### Example 1: Simple Salary Calculation

```typescript
import { calculateSalary } from './services/salaryCalculationEngine';
import { DriverSalaryMaster } from './models';

const salaryMaster = await DriverSalaryMaster.findOne({
  driverId: driverId,
  status: 'active'
});

const result = calculateSalary({
  salaryMaster,
  salaryPeriodStart: new Date('2024-01-01'),
  salaryPeriodEnd: new Date('2024-01-31'),
  payableDays: 26,
  payrollDays: 31,
  presentDays: 25,
  bookingServiceDays: 20,
  totalKilometers: 5000
});

console.log(`Net Payable: ₹${result.netPayable}`);
```

### Example 2: Batch Salary Calculation with Active Config

```typescript
import { calculateSalaryWithActiveConfig } from './services/salaryCalculationEngine';

const drivers = await Driver.find({ tenantId, status: 'available' });

for (const driver of drivers) {
  try {
    const { result, configStatus } = await calculateSalaryWithActiveConfig({
      driverId: driver._id,
      tenantId,
      useActiveSalaryConfig: true,
      validateSalaryMasterActive: true,
      salaryPeriodStart: new Date('2024-01-01'),
      salaryPeriodEnd: new Date('2024-01-31'),
      payableDays: 26,
      payrollDays: 31,
      presentDays: 25,
      bookingServiceDays: 20,
      totalKilometers: 5000
    });

    console.log(`${driver.name}: ₹${result.netPayable}`);
  } catch (error) {
    console.error(`Failed for ${driver.name}: ${error.message}`);
  }
}
```

### Example 3: Validation Before Calculation

```typescript
import {
  validateSalaryCalculationInputWithProfile,
  calculateSalaryWithActiveConfig
} from './services/salaryCalculationEngine';

const input = {
  driverId,
  tenantId,
  useActiveSalaryConfig: true,
  validateSalaryMasterActive: true,
  // ... other fields
};

const validation = await validateSalaryCalculationInputWithProfile(input);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
} else {
  const { result } = await calculateSalaryWithActiveConfig(input);
  // Process result
}
```

## Best Practices

1. **Always Validate**: Use `validateSalaryMasterIsActive()` before calculations in production
2. **Link Profiles**: Keep `Driver.activeSalaryMasterId` in sync with active configurations
3. **Version History**: Don't modify existing configs; create new ones with status change
4. **Error Handling**: Catch `SalaryConfigurationError` for configuration-specific issues
5. **Audit Trail**: Track who created/modified salary configurations
6. **Health Checks**: Regularly run `validateTenantSalaryConfigurations()` to catch issues early
7. **Status Management**: Use deactivate/update operations instead of deleting configs

## Migration Guide

### From Direct SalaryMaster to Active Config

**Before:**
```typescript
const salaryMaster = await DriverSalaryMaster.findById(salaryMasterId);
const result = calculateSalary({ salaryMaster, ... });
```

**After:**
```typescript
const { result } = await calculateSalaryWithActiveConfig({
  driverId,
  tenantId,
  useActiveSalaryConfig: true,
  validateSalaryMasterActive: true,
  // ... other fields
});
```

This ensures:
- Automatic retrieval of current active configuration
- Built-in validation that configuration is active
- Better error messages
- Cleaner API

## Troubleshooting

### "No active salary configuration found"
- Ensure DriverSalaryMaster exists with `status: 'active'`
- Check that `driverId` and `tenantId` match exactly

### "Salary master is in 'inactive' status"
- Driver's salary configuration has been deactivated
- Create new active configuration or reactivate existing one

### "Configuration is incomplete"
- Missing required fields for salary type
- Check completeness report in health report

### "Linking failure"
- Verify `activeSalaryMasterId` is not already linked
- Check database connection and indexes
