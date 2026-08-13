# Driver 360 - Payroll Ecosystem Integration

Complete unified driver view with integrated salary data, payment tracking, and year-to-date earnings comparison.

## Overview

The Driver 360 - Payroll Integration provides:

- **Unified Driver View**: Single comprehensive profile combining driver information with payroll data
- **Current Month Salary**: Real-time breakdown of base salary, incentives, and deductions
- **Payment Tracking**: Last payment date/amount and next payment details
- **YTD Earnings**: Year-to-date comparison with trend analysis
- **Real-time Updates**: WebSocket notifications for salary events
- **Detailed Breakdown**: Full salary components with payment history

## Architecture

### Backend Services

#### 1. Driver Payroll Aggregation Service
**File**: `server/services/driverPayrollAggregationService.ts`

Main service that combines driver and payroll data:

```typescript
// Get comprehensive payroll aggregation
const payroll = await getDriverPayrollAggregation(tenantId, driverId);

// Result includes:
// - currentMonth: { base, incentives, deductions, net, paid, pending }
// - lastPayment: { date, amount, status }
// - nextPayment: { date, estimatedAmount, daysUntil }
// - ytdEarnings: { total, previousYearTotal, changePercentage, trend }
// - status: { color, label, message }
// - details: Full breakdown of all components
// - paymentHistory: Last 6 months of payments
```

**Key Features**:
- Calculates current month salary in real-time
- Aggregates attendance, bookings, advances, recoveries
- Compares YTD earnings with previous year
- Determines payment status (on_track/pending/overdue)
- Tracks payment history

#### 2. Payroll Notification Service
**File**: `server/services/payrollNotificationService.ts`

Real-time event notifications:

```typescript
// Emit events
payrollEmitter.emitSalaryCalculated(tenantId, driverId, amount, month, year);
payrollEmitter.emitPaymentProcessed(tenantId, driverId, amount, 'bank_transfer');
payrollEmitter.emitAdvanceGiven(tenantId, driverId, advanceAmount);

// Subscribe to notifications
const unsubscribe = payrollEmitter.subscribeToDriver(
  tenantId,
  driverId,
  (notification) => console.log(notification)
);
```

### API Endpoints

#### 1. Payroll Summary (Quick View)
```
GET /api/drivers/:id/payroll-summary
```

Returns lightweight summary for dashboard cards:
```json
{
  "success": true,
  "data": {
    "currentMonth": {
      "base": 20000,
      "incentives": 5000,
      "deductions": 2000,
      "net": 23000,
      "paid": 15000,
      "pending": 8000,
      "paidPercentage": 65.2
    },
    "lastPayment": {
      "date": "2024-08-10",
      "amount": 15000,
      "status": "paid"
    },
    "nextPayment": {
      "date": "2024-08-31",
      "estimatedAmount": 23000,
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
      "message": "₹8,000 pending (35%)"
    }
  }
}
```

#### 2. Payroll Details (Full View)
```
GET /api/drivers/:id/payroll-details
```

Returns comprehensive payroll breakdown with payment history.

#### 3. Driver 360 with Payroll (Integrated View)
```
GET /api/drivers/:id/360-with-payroll
```

Combines driver 360 profile with integrated payroll data.

## Frontend Components

### 1. Salary Card Component
**File**: `client/src/components/driver-360/SalaryCard.tsx`

Displays current month salary summary with visual indicators:

```tsx
import SalaryCard from '@/components/driver-360/SalaryCard';

export function DriverDetail({ driverId, driverName }) {
  return (
    <SalaryCard
      driverId={driverId}
      driverName={driverName}
    />
  );
}
```

**Features**:
- Base salary, incentives, deductions breakdown
- Current month payment status with progress bar
- Last payment information
- Next payment details with countdown
- YTD earnings comparison with trend
- Click to expand for detailed view

### 2. Salary Details Modal
**File**: `client/src/components/driver-360/SalaryDetailsModal.tsx`

Comprehensive salary breakdown modal with 3 tabs:

**Breakdown Tab**:
- Current month status
- Earnings components (base, allowances, bonuses, incentives)
- Deductions (advances, penalties)

**History Tab**:
- Recent payment history (last 6 months)
- Next payment details

**Comparison Tab**:
- YTD earnings vs previous year
- Percentage change with trend indicator

### 3. Custom Hook
**File**: `client/src/hooks/useDriverPayroll.ts`

React Query hooks for data fetching:

```tsx
import {
  useDriverPayrollSummary,
  useDriverPayrollDetails,
  useDriver360WithPayroll,
  formatCurrency,
  getStatusColor
} from '@/hooks/useDriverPayroll';

function MyComponent({ driverId }) {
  // For dashboard cards
  const { data: summary } = useDriverPayrollSummary(driverId);

  // For detailed modal
  const { data: details } = useDriverPayrollDetails(driverId);

  // For comprehensive view
  const { data: full360 } = useDriver360WithPayroll(driverId);

  return (
    <>
      <div>{formatCurrency(summary?.data.currentMonth.net)}</div>
      <span style={{ color: getStatusColor(summary?.data.status.color) }}>
        {summary?.data.status.label}
      </span>
    </>
  );
}
```

## Integration Guide

### 1. Add to Driver 360 Page

```tsx
// client/src/components/drivers/driver-360.tsx
import SalaryCard from '@/components/driver-360/SalaryCard';

export default function Driver360({ driver }) {
  return (
    <Tabs>
      <TabsContent value="salary">
        <SalaryCard
          driverId={driver._id}
          driverName={driver.name}
        />
      </TabsContent>
    </Tabs>
  );
}
```

### 2. Trigger Real-time Updates

```tsx
import { useEffect, useState } from 'react';
import { setupPayrollRealtimeUpdates } from '@/services/payrollNotificationService';

function DriverPayrollMonitor({ tenantId, driverId }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const cleanup = setupPayrollRealtimeUpdates(
      tenantId,
      driverId,
      (notification) => {
        setNotifications(prev => [notification, ...prev]);
      },
      60000 // Poll every 60 seconds
    );

    return cleanup;
  }, [tenantId, driverId]);

  return (
    <div>
      {notifications.map(n => (
        <div key={n.timestamp.toString()}>
          {n.data.message}
        </div>
      ))}
    </div>
  );
}
```

### 3. Emit Events from Backend

When processing salary events, emit notifications:

```typescript
// server/routes/driverSalaryRoutes.ts
import { payrollEmitter } from '../services/payrollNotificationService';

router.post('/generate', async (req, res) => {
  // ... salary generation logic ...

  // Emit notification
  payrollEmitter.emitSalaryCalculated(
    tenantId,
    driverId,
    netSalary,
    month,
    year
  );

  res.json({ success: true, data: salary });
});
```

## Salary Calculation Details

### Current Month Breakdown

The system calculates:

1. **Base Salary**: Fixed monthly salary from salary master
2. **Incentives**:
   - Night duty allowance (₹X per night trip)
   - Outstation allowance (₹X per outstation day)
   - Food allowance (fixed)
   - Attendance bonus (13.33% for perfect attendance)
   - KM incentive (₹1.50 per km)
3. **Deductions**:
   - Salary advances (pending recovery)
   - Penalties/Recoveries
4. **Calculations**:
   - Gross = Base + Incentives
   - Net = Gross - Deductions
   - Paid % = Paid / Net
   - Pending = Max(0, Net - Paid)

### YTD Comparison

- Total earned in current year
- Total earned in previous year (same period)
- Percentage change
- Trend: increasing (>5%), decreasing (<-5%), flat

### Payment Status

- **Green (On Track)**: Pending = 0 (100% paid)
- **Yellow (Pending)**: Pending <= 25% of net
- **Red (Overdue)**: Pending > 25% of net

## Data Consistency

The system ensures data consistency through:

1. **Single Source of Truth**: All calculations derived from actual database records
2. **Real-time Aggregation**: Data fetched fresh on each request (with 5min cache)
3. **Atomic Calculations**: Each component calculated independently and validated
4. **Audit Trail**: All payroll events logged with timestamps
5. **Cross-endpoint Validation**: Summary and details endpoints return consistent data

## Testing

### Unit Tests
```bash
# Run payroll integration tests
npm test -- driver-payroll-integration.test.ts
```

Tests cover:
- Salary calculation accuracy
- Payment tracking
- YTD earnings calculation
- Data consistency across endpoints
- Payment status determination
- Error handling

### Manual Testing

1. **Dashboard Card**
   - Navigate to Driver 360
   - Check Salary tab loads card
   - Verify current month breakdown

2. **Details Modal**
   - Click "View Detailed Breakdown"
   - Verify all tabs load correctly
   - Check payment history

3. **Real-time Updates**
   - Process a payment
   - Verify notification appears
   - Check data refreshes automatically

## Performance Optimization

### Caching Strategy
- Summary: 5 minute cache (frequent access)
- Details: 5 minute cache (detailed view)
- Full 360: 5 minute cache (comprehensive view)

### Database Indexes
Required indexes for performance:
```javascript
// DriverSalaryPayment
db.driversalarypaymentsyments.createIndex({ tenantId: 1, driverId: 1, createdAt: -1 });

// DriverAttendance
db.driverattendances.createIndex({ tenantId: 1, driverId: 1, date: 1 });

// Booking (already exists)
db.bookings.createIndex({ tenantId: 1, driverId: 1, createdAt: -1 });
```

## Error Handling

### Common Errors

1. **No Active Salary Master**
   - Status: 404
   - Solution: Configure salary master for driver

2. **Invalid Driver ID**
   - Status: 400
   - Solution: Verify driver ID format

3. **Missing Authentication**
   - Status: 401
   - Solution: Include Bearer token in request

4. **Payroll Data Not Found**
   - Status: 404
   - Solution: Ensure driver has salary master configured

## WebSocket Integration

### Socket.io Setup

```typescript
// server/index.ts
import { setupWebSocketPayrollHandlers } from './services/payrollNotificationService';

io.on('connection', (socket) => {
  setupWebSocketPayrollHandlers(socket, req.query.tenantId);
});
```

### Client Setup

```typescript
// client/services/socket.ts
import io from 'socket.io-client';

const socket = io(process.env.REACT_APP_API_URL, {
  query: { tenantId: getCurrentTenantId() }
});

// Listen for payroll updates
socket.on('payroll:update', (notification) => {
  console.log('Salary updated:', notification);
  // Refresh UI component
});

// Subscribe to specific driver
socket.emit('payroll:subscribe-driver', driverId);
```

## Migration Guide

If upgrading from previous salary module:

1. **No Breaking Changes**: Existing endpoints still work
2. **New Features**: Add SalaryCard to Driver 360 page
3. **Optional**: Enable real-time updates with WebSocket
4. **Gradual Rollout**: Enable for select drivers first

## Troubleshooting

### Data Not Updating
- Check React Query cache settings (default 5 min)
- Verify database connections
- Check browser console for errors

### Missing Salary Data
- Ensure salary master is configured
- Check driver has status = 'active'
- Verify no database errors in server logs

### Performance Issues
- Check database indexes exist
- Monitor query times
- Consider increasing cache TTL

## Future Enhancements

1. **Advance Approval Workflow**: Allow drivers to request advances
2. **Payment Analytics**: Charts for historical salary trends
3. **Custom Salary Formulas**: Support complex incentive rules
4. **Bulk Payroll Processing**: Mass salary generation and payment
5. **Salary Slips**: Generate and email PDF salary slips
6. **Tax Calculations**: Automatic tax deduction calculations

## Files Modified/Created

### Backend
- ✅ `server/services/driverPayrollAggregationService.ts` (NEW)
- ✅ `server/services/payrollNotificationService.ts` (NEW)
- ✅ `server/services/driver360Service.ts` (ENHANCED)
- ✅ `server/routes/drivers.ts` (ENHANCED)

### Frontend
- ✅ `client/src/components/driver-360/SalaryCard.tsx` (NEW)
- ✅ `client/src/components/driver-360/SalaryDetailsModal.tsx` (NEW)
- ✅ `client/src/hooks/useDriverPayroll.ts` (NEW)

### Tests
- ✅ `tests/driver-payroll-integration.test.ts` (NEW)

## Support

For issues or questions:
1. Check this documentation
2. Review test cases for examples
3. Check server logs for errors
4. Review database data for consistency
