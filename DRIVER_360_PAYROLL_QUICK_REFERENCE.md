# Driver 360 - Payroll Integration Quick Reference

## Quick Start (5 Minutes)

### 1. Add Salary Card to Driver 360 Page

```tsx
// client/src/components/drivers/driver-360.tsx
import SalaryCard from '@/components/driver-360/SalaryCard';

export default function Driver360({ driver }) {
  return (
    <Tabs>
      {/* ... other tabs ... */}
      <TabsContent value="salary" className="space-y-6">
        <SalaryCard
          driverId={driver._id}
          driverName={driver.name}
        />
      </TabsContent>
    </Tabs>
  );
}
```

### 2. Use in Dashboard Component

```tsx
import { useDriverPayrollSummary } from '@/hooks/useDriverPayroll';

function DriverSalaryWidget({ driverId }) {
  const { data, isLoading } = useDriverPayrollSummary(driverId);

  if (isLoading) return <div>Loading...</div>;

  const { currentMonth, status } = data?.data || {};

  return (
    <div className="p-4 border rounded-lg">
      <h3>Current Month Salary</h3>
      <p className="text-2xl font-bold">
        ₹{currentMonth?.net?.toLocaleString('en-IN')}
      </p>
      <p className={`text-sm ${
        status?.color === 'green' ? 'text-green-600' :
        status?.color === 'yellow' ? 'text-yellow-600' :
        'text-red-600'
      }`}>
        {status?.message}
      </p>
    </div>
  );
}
```

## API Reference

### Get Payroll Summary
```bash
GET /api/drivers/:id/payroll-summary

# Response
{
  "success": true,
  "data": {
    "currentMonth": {
      "base": 20000,
      "incentives": 5000,
      "deductions": 1000,
      "net": 24000,
      "paid": 15000,
      "pending": 9000,
      "paidPercentage": 62.5
    },
    "lastPayment": {
      "date": "2024-08-10",
      "amount": 15000,
      "status": "paid"
    },
    "nextPayment": {
      "date": "2024-08-31",
      "estimatedAmount": 24000,
      "daysUntil": 21
    },
    "ytdEarnings": {
      "total": 180000,
      "previousYearTotal": 165000,
      "changePercentage": 9.1,
      "trend": "increasing"
    },
    "status": {
      "color": "yellow",
      "label": "pending",
      "message": "₹9,000 pending (38%)"
    }
  }
}
```

### Get Payroll Details
```bash
GET /api/drivers/:id/payroll-details

# Full response with:
# - All fields from summary
# - details: Salary component breakdown
# - paymentHistory: Last 6 months of payments
```

### Get Driver 360 with Payroll
```bash
GET /api/drivers/:id/360-with-payroll

# Response
{
  "data": {
    "driver360": { /* driver info */ },
    "payroll": { /* payroll details */ },
    "metadata": {
      "lastUpdated": "2024-08-13T10:30:00Z",
      "realtime": true,
      "dataSource": "driver360-payroll-aggregation"
    }
  }
}
```

## React Hooks

### useDriverPayrollSummary
```tsx
const { data, isLoading, error } = useDriverPayrollSummary(driverId);
// Light-weight hook for dashboard cards
// Cache: 5 minutes
```

### useDriverPayrollDetails
```tsx
const { data, isLoading, error } = useDriverPayrollDetails(driverId);
// Full details with payment history
// Cache: 5 minutes
```

### useDriver360WithPayroll
```tsx
const { data, isLoading, error } = useDriver360WithPayroll(driverId);
// Comprehensive 360 view with payroll
// Cache: 5 minutes
```

## Utility Functions

```typescript
import {
  formatCurrency,
  getStatusColor,
  calculateSalaryTrend,
  getDaysUntilPayment,
  formatPaymentDate,
  getPaymentStatusTooltip
} from '@/hooks/useDriverPayroll';

// Format numbers
formatCurrency(25000)  // "₹25,000"

// Get color for status
getStatusColor('on_track')  // "green"
getStatusColor('yellow')    // "yellow"
getStatusColor('red')       // "red"

// Calculate trend
calculateSalaryTrend(25000, 20000)
// { percentage: 25, trend: 'up', label: 'Up 25%' }

// Days until payment
getDaysUntilPayment('2024-08-31')  // 21

// Format date
formatPaymentDate('2024-08-10')  // "10 Aug 2024"

// Get tooltip
getPaymentStatusTooltip('pending', 9000, 21)
// "₹9,000 pending - Due in 21 days"
```

## Backend Integration

### Emit Salary Events
```typescript
import { payrollEmitter } from '../services/payrollNotificationService';

// When salary is calculated
payrollEmitter.emitSalaryCalculated(tenantId, driverId, 24000, 8, 2024);

// When payment is processed
payrollEmitter.emitPaymentProcessed(tenantId, driverId, 15000, 'bank_transfer', 'PAY-2024-001');

// When advance is given
payrollEmitter.emitAdvanceGiven(tenantId, driverId, 5000);

// When payroll is closed
payrollEmitter.emitPayrollClosed(tenantId, 8, 2024, 480000);
```

### Subscribe to Notifications
```typescript
// Subscribe to driver salary events
const unsubscribe = payrollEmitter.subscribeToDriver(
  tenantId,
  driverId,
  (notification) => {
    console.log('Salary event:', notification);
  }
);

// Subscribe to tenant-wide events
const unsubscribeTenant = payrollEmitter.subscribeToTenant(
  tenantId,
  (notification) => {
    console.log('Tenant payroll event:', notification);
  }
);

// Cleanup
unsubscribe();
unsubscribeTenant();
```

## Component Examples

### Basic Salary Card
```tsx
import SalaryCard from '@/components/driver-360/SalaryCard';

<SalaryCard
  driverId="507f1f77bcf86cd799439011"
  driverName="John Doe"
/>
```

### Salary Details Modal
```tsx
import SalaryDetailsModal from '@/components/driver-360/SalaryDetailsModal';
import { useState } from 'react';

const [open, setOpen] = useState(false);

<SalaryDetailsModal
  driverId="507f1f77bcf86cd799439011"
  driverName="John Doe"
  open={open}
  onOpenChange={setOpen}
/>
```

### Custom Salary Widget
```tsx
function MySalaryWidget() {
  const { data } = useDriverPayrollSummary(driverId);

  return (
    <div className="space-y-4">
      {/* Net Salary */}
      <div>
        <p className="text-gray-600">Net Payable</p>
        <p className="text-3xl font-bold">
          {formatCurrency(data?.data.currentMonth.net || 0)}
        </p>
      </div>

      {/* Status */}
      <div className={`p-3 rounded-lg ${
        data?.data.status.color === 'green' ? 'bg-green-50' :
        data?.data.status.color === 'yellow' ? 'bg-yellow-50' :
        'bg-red-50'
      }`}>
        <p className="font-semibold">
          {data?.data.status.message}
        </p>
      </div>

      {/* Progress */}
      <div>
        <p className="text-sm text-gray-600 mb-2">
          Payment Progress
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full"
            style={{
              width: `${data?.data.currentMonth.paidPercentage || 0}%`
            }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-1">
          {data?.data.currentMonth.paidPercentage.toFixed(0)}% paid
        </p>
      </div>
    </div>
  );
}
```

## Common Tasks

### Display Current Month Net Salary
```tsx
const { data } = useDriverPayrollSummary(driverId);
const net = data?.data.currentMonth.net;
<div>{formatCurrency(net)}</div>
```

### Show Payment Status
```tsx
const { data } = useDriverPayrollSummary(driverId);
const status = data?.data.status;
<span className={`text-${status?.color}-600`}>
  {status?.message}
</span>
```

### Display YTD Comparison
```tsx
const { data } = useDriverPayrollSummary(driverId);
const ytd = data?.data.ytdEarnings;
<div>
  <p>This Year: {formatCurrency(ytd?.total)}</p>
  <p>Last Year: {formatCurrency(ytd?.previousYearTotal)}</p>
  <p className={ytd?.changePercentage > 0 ? 'text-green-600' : 'text-red-600'}>
    {ytd?.changePercentage > 0 ? '+' : ''}{ytd?.changePercentage}%
  </p>
</div>
```

### Show Next Payment Details
```tsx
const { data } = useDriverPayrollSummary(driverId);
const next = data?.data.nextPayment;
<div>
  <p>Due: {formatPaymentDate(next?.date)}</p>
  <p>Amount: {formatCurrency(next?.estimatedAmount)}</p>
  <p>Days: {next?.daysUntil}</p>
</div>
```

## Testing

### Mock API Responses
```typescript
// tests/mocks/payroll.ts
export const mockPayrollSummary = {
  data: {
    currentMonth: {
      base: 20000,
      incentives: 5000,
      deductions: 1000,
      net: 24000,
      paid: 15000,
      pending: 9000,
      paidPercentage: 62.5
    },
    lastPayment: {
      date: '2024-08-10',
      amount: 15000,
      status: 'paid'
    },
    nextPayment: {
      date: '2024-08-31',
      estimatedAmount: 24000,
      daysUntil: 21
    },
    ytdEarnings: {
      total: 180000,
      previousYearTotal: 165000,
      changePercentage: 9.1,
      trend: 'increasing'
    },
    status: {
      color: 'yellow',
      label: 'pending',
      message: '₹9,000 pending (38%)'
    }
  }
};
```

### Test Component
```typescript
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SalaryCard from '@/components/driver-360/SalaryCard';

it('should display salary card', () => {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <SalaryCard driverId="123" driverName="John" />
    </QueryClientProvider>
  );

  expect(screen.getByText('💰 Salary Information')).toBeInTheDocument();
});
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Component not rendering | Check if driverId is valid |
| Data showing old values | Clear React Query cache or wait 5 min |
| API returning 404 | Verify driver exists and has salary master |
| Styling not applied | Check Tailwind CSS is configured |
| Modal not opening | Check Dialog component is imported |
| Slow performance | Check database indexes exist |

## File Locations

| Component | Location |
|-----------|----------|
| Salary Card | `client/src/components/driver-360/SalaryCard.tsx` |
| Salary Modal | `client/src/components/driver-360/SalaryDetailsModal.tsx` |
| Hook | `client/src/hooks/useDriverPayroll.ts` |
| Service (Backend) | `server/services/driverPayrollAggregationService.ts` |
| Routes | `server/routes/drivers.ts` |
| Notifications | `server/services/payrollNotificationService.ts` |
| Tests | `tests/driver-payroll-integration.test.ts` |

## Support & Documentation

- **Full Docs**: See `DRIVER_360_PAYROLL_INTEGRATION.md`
- **Deployment**: See `DRIVER_360_PAYROLL_DEPLOYMENT_CHECKLIST.md`
- **API Docs**: Check Swagger/OpenAPI docs
- **Examples**: Check test files for usage examples
