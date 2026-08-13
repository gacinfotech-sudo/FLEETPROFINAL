# Driver Salary Setup Panel - Integration Guide

## Overview

The `DriverSalarySetupPanel` component is a comprehensive UI for configuring driver salary structures during the onboarding process or for managing existing driver salary configurations.

## Features

- **Employment Type Selection** - Set employment status (permanent, contract, probation, temporary, casual)
- **Flexible Salary Structures** - Support for fixed monthly, daily rate, per trip, fixed + incentive, and custom structures
- **Weekly Off Configuration** - Configurable weekly off days with different leave types
- **Allowances & Incentives** - Food, night, outstation allowances, KM incentives, overtime rates
- **Bank Details** - Support for bank transfers or UPI payments
- **Real-time Validation** - Form-level validation with error messaging
- **Estimated Monthly Earning** - Visual preview of total estimated monthly compensation
- **Read-only Mode** - Lock salary configuration after setup to prevent accidental changes
- **Auto-load Existing** - Automatically loads and displays existing salary configuration

## Installation

The component is located at:
```
client/src/components/onboarding/DriverSalarySetupPanel.tsx
```

## Basic Usage

```tsx
import DriverSalarySetupPanel from '@/components/onboarding/DriverSalarySetupPanel';

export default function DriverOnboarding() {
  const driverId = 'driver-123';
  const driverName = 'John Doe';

  return (
    <DriverSalarySetupPanel
      driverId={driverId}
      driverName={driverName}
      onSalarySetupComplete={() => console.log('Setup complete')}
      onCancel={() => console.log('Cancelled')}
    />
  );
}
```

## Props

```typescript
interface DriverSalarySetupPanelProps {
  driverId: string;                          // Required: Driver's unique ID
  driverName: string;                        // Required: Driver's display name
  onSalarySetupComplete?: () => void;        // Optional: Callback after successful save
  onCancel?: () => void;                     // Optional: Callback on cancel
  isReadOnly?: boolean;                      // Optional: Lock form after setup (default: false)
}
```

## Component Sections

### 1. Employment Tab
- **Joining Date** - When the driver joined the company
- **Salary Start Date** - When salary benefits begin
- **Employment Type** - Permanent, contract, probation, temporary, or casual
- **Joining Base Salary** - Initial salary at time of joining
- **Weekly Off Configuration** - Select which days are off and whether they're paid/unpaid/compensatory

### 2. Salary Tab
- **Salary Structure Type** - Choose between 5 salary computation models
- **Current Base Salary** - Primary salary component
- **Variable Components** - Per-day rate, per-trip rate, KM incentive, overtime, extra duty
- **Estimated Monthly Earning** - Visual preview of total compensation

### 3. Allowances Tab
- **Food Allowance** - Fixed monthly allowance
- **Per Booking Food Charge** - Variable per trip
- **Night Allowance** - Per night shift premium
- **Outstation Allowance** - Per day out-of-station premium

### 4. Bank Tab
- **Bank Name** - Bank where driver has account
- **Account Number** - Driver's bank account
- **IFSC Code** - Bank branch code
- **UPI ID** - Alternative payment method

## Salary Structure Types

### Fixed Monthly
- Simple monthly salary
- Best for: Permanent employees with consistent compensation

### Daily Rate
- Per-day compensation
- Best for: Part-time or contract drivers

### Per Trip
- Per-trip payment
- Best for: Gig-based or commission drivers

### Fixed + Incentive
- Base salary plus performance incentives
- Best for: Mixed compensation model

### Custom
- Multiple variables including overtime and extra duty
- Best for: Complex compensation structures

## API Integration

### POST /api/driver-salary/master
Creates or updates a driver's salary configuration.

**Request Body:**
```typescript
{
  driverId: string;                          // Required
  salaryType: 'fixed_monthly' | 'daily' | 'per_trip' | 'fixed_incentive' | 'custom';
  baseSalary: number;                        // Required
  perDaySalary?: number;
  perTripSalary?: number;
  kmIncentivePerKm?: number;
  nightAllowancePerNight?: number;
  outstationAllowancePerDay?: number;
  foodAllowance?: number;
  perBookingFoodCharge?: number;
  overtimeRatePerHour?: number;
  extraDutyRate?: number;
  weeklyOffDays?: number[];                  // 0-6 (Sunday-Saturday)
  weeklyOffLeaveType?: 'paid' | 'unpaid' | 'compensatory';
  salaryStartDate: Date;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    _id: string;
    tenantId: string;
    driverId: string;
    name: string;
    mobile: string;
    salaryType: string;
    baseSalary: number;
    status: 'active' | 'inactive';
    createdAt: Date;
    updatedAt: Date;
  }
}
```

### GET /api/driver-salary/master/:driverId
Fetches existing salary configuration for a driver.

**Response:**
```typescript
{
  data: {
    // Full IDriverSalaryMaster object
  }
}
```

## Usage Examples

### Example 1: Basic Permanent Employee Setup
```tsx
<DriverSalarySetupPanel
  driverId={driver.id}
  driverName={driver.name}
  onSalarySetupComplete={() => {
    toast.success('Salary configured for ' + driver.name);
    navigateTo('/drivers/' + driver.id);
  }}
/>
```

### Example 2: With Read-only Mode After Setup
```tsx
const [isConfigured, setIsConfigured] = useState(false);

<DriverSalarySetupPanel
  driverId={driver.id}
  driverName={driver.name}
  isReadOnly={isConfigured}
  onSalarySetupComplete={() => setIsConfigured(true)}
/>
```

### Example 3: In Onboarding Flow
```tsx
const [step, setStep] = useState('personal');

{step === 'salary' && (
  <DriverSalarySetupPanel
    driverId={driver.id}
    driverName={driver.name}
    onSalarySetupComplete={() => setStep('documents')}
    onCancel={() => setStep('personal')}
  />
)}
```

### Example 4: Modal/Dialog Integration
```tsx
import { Dialog, DialogContent } from '@/components/ui/dialog';

const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-2xl">
    <DriverSalarySetupPanel
      driverId={driver.id}
      driverName={driver.name}
      onSalarySetupComplete={() => setOpen(false)}
      onCancel={() => setOpen(false)}
    />
  </DialogContent>
</Dialog>
```

## Validation Rules

1. **Dates** - Both joining date and salary start date are required
2. **Base Salary** - Must be greater than 0
3. **Optional Fields** - All allowances and variable components are optional
4. **Weekly Off** - At least one day can be selected
5. **Bank Details** - Either provide complete bank details OR UPI ID

## State Management

The component uses:
- **React Hooks** - `useState` for form state, `useRef` for interaction tracking
- **React Query** - `useQuery` for fetching, `useMutation` for saving
- **Toast Notifications** - For user feedback on success/error

### Form State
```typescript
{
  joiningDate: string (YYYY-MM-DD);
  joiningBaseSalary: number;
  currentBaseSalary: number;
  employmentType: string;
  salaryType: string;
  baseSalary: number;
  // ... other fields
}
```

## Error Handling

The component handles:
- Missing required fields (validation error toast)
- Invalid values (negative numbers, etc.)
- Network errors during save (error toast with details)
- Duplicate salary configurations (409 conflict message)

## Styling

The component uses:
- **Tailwind CSS** - For responsive design
- **shadcn/ui Components** - For consistent UI elements
- **Lucide Icons** - For visual indicators
- **Dark Mode Support** - Responsive to system/user preference

## Responsive Design

- **Mobile** - Single column layout with tab navigation showing icons only
- **Tablet** - Two column grid for most fields
- **Desktop** - Optimized multi-column layouts with full labels

## Accessibility

- **ARIA Labels** - All form inputs have proper labels
- **Focus Management** - Keyboard navigation support
- **Color Contrast** - Meets WCAG standards
- **Status Indicators** - Visual feedback for configured status

## Performance Considerations

1. **Lazy Loading** - Existing salary data loaded on demand
2. **Debounced Saves** - Form submission validated before API call
3. **Query Caching** - React Query handles caching of driver salary data
4. **Optimized Re-renders** - useRef prevents form clobbering on data load

## Common Scenarios

### Scenario 1: New Driver Onboarding
1. Load component with new driver ID
2. Fill in all required fields
3. Component creates new salary master
4. Triggers onSalarySetupComplete callback

### Scenario 2: Edit Existing Configuration
1. Load component with existing driver ID
2. Component auto-fetches current configuration
3. User can update any field (unless isReadOnly=true)
4. Saves updates to same master record

### Scenario 3: Quick Salary Review
```tsx
<DriverSalarySetupPanel
  driverId={driver.id}
  driverName={driver.name}
  isReadOnly={true}  // Prevents editing
/>
```

## Troubleshooting

### Component Won't Load Existing Data
- Ensure `driverId` is correct and exists in database
- Check network tab for 404 errors
- Verify tenant context is set

### Validation Errors
- Base salary must be > 0
- Dates must be in YYYY-MM-DD format
- Employment type must be one of the predefined values

### Save Failures
- Check if salary master already exists for driver
- Verify all required fields are filled
- Check server logs for validation errors

## Future Enhancements

- [ ] Bulk salary configuration import/export
- [ ] Salary comparison tool
- [ ] Increment history tracking
- [ ] Contract-based salary templates
- [ ] Salary revision request workflow
- [ ] Commission structure builder

## Related Components

- `OnboardingWizard` - Main onboarding flow
- `InvoiceSettingsPanel` - Similar panel pattern
- `NotificationPreferencesPanel` - Similar form pattern

## Support

For issues or questions about the DriverSalarySetupPanel:
1. Check this documentation
2. Review component code comments
3. Check API endpoint documentation
4. Review server logs for validation errors
