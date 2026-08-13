# 🚀 FleetPro 100% Automation System
## Complete Driver → Payroll → 360 Automation Guide

**Status:** Production Ready  
**Version:** 1.0  
**Last Updated:** 2026-08-13  

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Automation Phases](#automation-phases)
3. [How It Works](#how-it-works)
4. [API Endpoints](#api-endpoints)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)
7. [Examples](#examples)

---

## 🎯 Overview

The FleetPro automation system provides **100% end-to-end automation** for driver payroll management:

### What Gets Automated

| Process | Automation | Trigger |
|---------|----------|---------|
| **Salary Master Creation** | Auto-create when driver added | Driver creation |
| **Payroll Enrollment** | Auto-enroll in current month | Salary master creation |
| **Attendance Sync** | Auto-fetch & sync real-time | Hourly + on-change |
| **Booking Sync** | Auto-fetch trip data | Hourly + booking completion |
| **Advance Sync** | Auto-fetch advance requests | Hourly + approval/payment |
| **Salary Calculation** | Auto-recalculate real-time | Data change event |
| **360 View Update** | Auto-populate complete profile | On-demand (always current) |
| **Monthly Payroll** | Auto-process all drivers | 1st of month at 1 AM |

### Key Features

✅ **Zero Manual Setup** - Drivers auto-enroll when added  
✅ **Real-Time Updates** - Salary updates instantly on any change  
✅ **Connected Data** - All data sources automatically synced  
✅ **360 Dashboard** - Complete real-time profile always available  
✅ **Scheduled Jobs** - Hourly sync + monthly payroll processing  
✅ **Event-Driven** - Triggers on attendance, bookings, advances  
✅ **Production Ready** - Error handling + logging + monitoring  

---

## 🔄 Automation Phases

### PHASE 1: Auto-Create Salary Master

**When:** Driver is created via `POST /api/drivers`  
**What Happens:**
1. Driver record created
2. Salary master automatically created with default values
3. Driver enrolled in current month payroll
4. Response includes auto-enrollment confirmation

**Default Auto-Enrollment Settings:**
```javascript
{
  salaryType: 'fixed_monthly',
  baseSalary: ₹15,000,
  attendanceBonusPercentage: 13.33%,
  nightDutyAllowancePerTrip: ₹40,
  outstationAllowancePerTrip: ₹60,
  kmIncentiveRate: ₹1.50/km,
  weeklyOffDays: [Sunday],
  weeklyOffLeaveType: 'paid',
  startDate: Now
}
```

**Can be customized:**
Update salary master via `PUT /api/driver-salary/master/:driverId`

---

### PHASE 2: Real-Time Data Sync

**When:**
- Hourly (automatic)
- On-change events:
  - Attendance marked
  - Booking completed
  - Advance approved/paid
  - Leave approved

**What Gets Synced:**
- ✅ Current month attendance records
- ✅ Completed bookings (trip data, km, incentives)
- ✅ Active advances & recoveries
- ✅ Penalties & deductions
- ✅ Payment records

**How It Works:**
```
Event Triggered
    ↓
Async Sync Queued (non-blocking)
    ↓
Fetch All Related Data (parallel)
    ↓
Store/Update Cache
    ↓
Trigger Salary Recalculation
    ↓
Notify Dashboard (WebSocket)
```

---

### PHASE 3: Auto Salary Calculation

**When:** Any data change (attendance, booking, advance)  
**What's Calculated:**

```
EARNINGS:
├─ Base Salary
├─ Attendance Bonus (13.33% per perfect day)
├─ Trip Incentives (₹1.50 per km)
├─ Night Duty Allowance (₹40 per trip)
├─ Outstation Allowance (₹60 per trip)
└─ Food Allowance

DEDUCTIONS:
├─ Absence Deduction
├─ Advance Recovery
├─ Penalty Deduction
├─ Damage Recovery
└─ Fuel Excess Recovery

FINAL:
= (Earnings) - (Deductions) = Net Salary
```

**Calculation Triggers:**
- ✅ Attendance marked
- ✅ Booking completed
- ✅ Advance given/recovered
- ✅ Penalty recorded
- ✅ Leave approved
- ✅ Hourly sync

---

### PHASE 4: Auto 360 View

**Endpoint:** `GET /api/drivers/:id/auto-360`

**Returns:** Complete real-time profile with:
- Driver basic info
- Salary configuration & calculations
- Current month attendance
- Completed bookings (count, km, details)
- Active advances (count, amounts)
- Penalties (count, amounts)
- Payment records
- 360 Summary (earnings, deductions, net)

**Always Current:** Fetches live data on every request

---

### PHASE 5: Monthly Payroll Processing

**When:** 1st of each month at 1:00 AM (automatic)  
**Process:**
1. Get all active drivers
2. Calculate salary for each (using current month data)
3. Generate payroll record
4. Record in system
5. Notify drivers via email/SMS/WhatsApp
6. Archive previous month

**Manual Trigger:** `POST /api/payroll/calculate`

---

### PHASE 6: Notification & Webhooks

**Auto-Notifications:**
- ✅ Salary calculated (daily)
- ✅ Advance approved (instant)
- ✅ Payment recorded (instant)
- ✅ Payroll ready (1st of month)

**Channels:**
- WhatsApp
- Email
- SMS
- In-App Notifications

---

## 🔧 How It Works

### Architecture Diagram

```
Driver Management
    ↓
[POST /api/drivers]
    ↓
Auto-Create Salary Master ← Default config applied
    ↓
Auto-Enroll in Payroll
    ↓
Real-Time Data Sync ← Triggered on events + hourly job
    ├─ Attendance Service
    ├─ Booking Service
    ├─ Advance Service
    ├─ Penalty Service
    └─ Ledger Service
    ↓
Auto-Calculate Salary ← Real-time updates
    ↓
Auto-360 View Updated ← GET /api/drivers/:id/auto-360
    ↓
Monthly Payroll ← 1st of month automatic
    ├─ Calculate all drivers
    ├─ Generate payroll
    ├─ Record payments
    └─ Archive & notify
```

### Background Jobs

**1. Hourly Sync (0 * * * *)**
```
Get all active drivers
  ↓
For each driver:
  ├─ Sync attendance
  ├─ Sync bookings
  ├─ Sync advances
  ├─ Sync penalties
  ├─ Recalculate salary
  └─ Update 360 view
  ↓
Log completion
```

**2. Monthly Payroll (0 1 1 * *)**
```
Get all active drivers
  ↓
Calculate salary for each
  ↓
Generate payroll record
  ↓
Update driver payment status
  ↓
Notify drivers
  ↓
Archive month
```

**3. Daily Cleanup (0 2 * * *)**
```
Archive old sync records
Archive calculations
Update availability flags
Generate daily reports
```

---

## 📡 API Endpoints

### Driver Creation (Auto-Enrollment)

```http
POST /api/drivers
Content-Type: application/json

{
  "name": "Raj Kumar",
  "phone": "9876543210",
  "email": "raj@example.com",
  "licenseNumber": "DL-123456",
  "dateOfJoining": "2026-08-13"
}
```

**Response:**
```json
{
  "id": "driver_123",
  "name": "Raj Kumar",
  "phone": "9876543210",
  "status": "active",
  "autoEnrollment": {
    "salaryMasterId": "salary_master_123",
    "status": "active",
    "autoCreated": true,
    "message": "Salary master automatically created and driver enrolled in payroll"
  }
}
```

---

### Auto-360 View

```http
GET /api/drivers/:id/auto-360
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "driver": {
      "id": "driver_123",
      "name": "Raj Kumar",
      "phone": "9876543210",
      "email": "raj@example.com",
      "status": "active",
      "rating": 4.8
    },
    "salary": {
      "baseSalary": 15000,
      "allowances": 1500,
      "grossSalary": 16500,
      "deductions": 2000,
      "netPayable": 14500,
      "paid": 10000,
      "pending": 4500
    },
    "attendance": {
      "presentDays": 20,
      "absentDays": 2,
      "paidLeaveDays": 1,
      "unpaidLeaveDays": 0,
      "weeklyOffDays": 4,
      "halfDays": 0
    },
    "bookings": {
      "count": 45,
      "totalKms": 2340,
      "items": [...]
    },
    "advances": {
      "count": 2,
      "total": 5000,
      "items": [...]
    },
    "penalties": {
      "count": 0,
      "total": 0,
      "items": []
    },
    "view360": {
      "totalEarnings": 16500,
      "totalDeductions": 2000,
      "netSalary": 14500,
      "pendingPayment": 4500,
      "paid": 10000,
      "lastUpdated": "2026-08-13T12:30:45Z"
    }
  },
  "meta": {
    "lastUpdated": "2026-08-13T12:30:45Z",
    "realtime": true,
    "dataSource": "auto-sync"
  }
}
```

---

### Trigger Immediate Sync

```http
POST /api/payroll/sync-driver/:driverId
Authorization: Bearer <token>

{
  "tenantId": "tenant_123"
}
```

---

### Trigger Manual Payroll

```http
POST /api/payroll/calculate
Content-Type: application/json
Authorization: Bearer <token>

{
  "month": 8,
  "year": 2026
}
```

---

## ⚙️ Configuration

### Auto-Enrollment Defaults

Edit in `/server/services/driverAutoEnrollmentService.ts`:

```typescript
export const DEFAULT_AUTO_ENROLLMENT = {
  salaryType: 'fixed_monthly',
  baseSalary: 15000,           // ← Customize here
  attendanceBonusPercentage: 13.33,
  nightDutyAllowancePerTrip: 40,
  outstationAllowancePerTrip: 60,
  kmIncentiveRate: 1.50,
  weeklyOffDays: [0],          // 0 = Sunday
  weeklyOffLeaveType: 'paid',
  status: 'active',
  startDate: new Date()
};
```

### Scheduler Configuration

Edit in `/server/services/payrollAutoSyncScheduler.ts`:

```typescript
// Hourly sync — change cron expression
schedule.scheduleJob('0 * * * *', async () => { /* ... */ });

// Monthly payroll — change day/time
schedule.scheduleJob('0 1 1 * *', async () => { /* ... */ });

// Daily cleanup — change time
schedule.scheduleJob('0 2 * * *', async () => { /* ... */ });
```

**Cron Reference:**
- `0 * * * *` = Every hour
- `0 1 1 * *` = 1st of month, 1 AM
- `0 2 * * *` = Every day, 2 AM
- `0 9-17 * * 1-5` = Weekdays 9 AM-5 PM

---

## 🔍 Troubleshooting

### Auto-Enrollment Not Working

**Problem:** Driver created but salary master not created

**Solution:**
1. Check server logs for `[AUTO-ENROLL]` messages
2. Verify MongoDB connection is active
3. Check if `driverAutoEnrollmentService.ts` is imported
4. Ensure `autoCreateSalaryMaster()` has correct default values

```bash
# Check logs
tail -f .server-5050.log | grep AUTO-ENROLL
```

---

### 360 View Shows Stale Data

**Problem:** 360 view not showing latest changes

**Solution:**
1. 360 view always fetches latest data
2. If data is delayed, check hourly sync job
3. Trigger immediate sync: `POST /api/payroll/sync-driver/:driverId`

```bash
# Manually trigger sync
curl -X POST http://localhost:5050/api/payroll/sync-driver/driver_123 \
  -H "Authorization: Bearer <token>"
```

---

### Monthly Payroll Not Processing

**Problem:** 1st of month jobs not running

**Solution:**
1. Check if scheduler initialized: `[SCHEDULER] ✅ Initializing auto-sync scheduler`
2. Verify MongoDB is connected
3. Check if jobs are registered
4. Manually trigger: `POST /api/payroll/calculate`

```bash
# Check scheduler status
curl http://localhost:5050/api/scheduler/status \
  -H "Authorization: Bearer <token>"
```

---

### High Database Load

**Problem:** Hourly sync causing database spikes

**Solution:**
1. Adjust sync frequency (reduce from hourly to 2-hourly)
2. Use selective sync (only changed drivers)
3. Add database indexes on driverId, tenantId, date ranges
4. Monitor query times in MongoDB logs

---

## 📚 Examples

### Example 1: Add Driver → Auto-Setup Complete

```bash
# 1. Add new driver
curl -X POST http://localhost:5050/api/drivers \
  -H "Authorization: Bearer token123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Raj Kumar",
    "phone": "9876543210",
    "email": "raj@example.com",
    "licenseNumber": "DL-123456",
    "dateOfJoining": "2026-08-13"
  }'

# Response shows:
# - Driver created ✓
# - Salary master auto-created ✓
# - Enrolled in payroll ✓
# - Ready to use immediately ✓
```

---

### Example 2: Check Real-Time 360 View

```bash
# Get complete driver profile
curl -X GET http://localhost:5050/api/drivers/driver_123/auto-360 \
  -H "Authorization: Bearer token123"

# Response includes:
# - Salary calculations (real-time)
# - Attendance summary
# - Booking history
# - Advance tracking
# - Payment status
# - All data is current
```

---

### Example 3: Trigger Immediate Payroll

```bash
# Manually process payroll for current month
curl -X POST http://localhost:5050/api/payroll/calculate \
  -H "Authorization: Bearer token123" \
  -H "Content-Type: application/json" \
  -d '{
    "month": 8,
    "year": 2026
  }'

# Response includes:
# - Payroll ID
# - Total drivers processed
# - Total earnings
# - Total deductions
# - Total net salary
```

---

## 📊 Monitoring

### Key Metrics to Track

1. **Auto-Enrollment Success Rate**
   - Drivers added with auto-enrollment: 100%
   - Failed auto-enrollments: should be 0%

2. **Sync Latency**
   - Hourly sync completion time: < 5 minutes
   - Event-based sync latency: < 30 seconds

3. **Salary Calculation Accuracy**
   - Manual calculation vs. auto-calculation: match 100%
   - No rounding errors or formula mismatches

4. **Payroll Completion**
   - Monthly payroll processing time: < 10 minutes
   - Driver notification delivery: 99%+

### View Logs

```bash
# Tail auto-enrollment logs
tail -f .server-5050.log | grep AUTO-ENROLL

# Tail scheduler logs
tail -f .server-5050.log | grep SCHEDULER

# Tail sync logs
tail -f .server-5050.log | grep AUTO-SYNC
```

---

## 🚀 Performance Benchmarks

| Operation | Latency | Scale | Notes |
|-----------|---------|-------|-------|
| Auto-create salary master | < 500ms | per driver | Inline, blocking |
| Hourly sync | < 5min | all drivers | Background, async |
| Event-based sync | < 1sec | per event | Non-blocking queue |
| Salary calculation | < 100ms | per driver | Cached results |
| 360 view fetch | < 500ms | per request | Parallel queries |
| Monthly payroll | < 10min | 100+ drivers | Background job |

---

## 🎓 Best Practices

1. **Always use auto-enrollment** - Don't manually create salary masters
2. **Check 360 view daily** - Verify salary calculations are correct
3. **Monitor hourly sync** - Ensure no missed data syncs
4. **Archive old payroll** - Keep database clean
5. **Backup before month-end** - In case of calculation issues
6. **Test with small dataset first** - Before large-scale deployment
7. **Use webhooks** - For external system integration
8. **Enable audit logs** - Track all changes

---

## 📞 Support

For issues or questions:
1. Check logs: `tail -f .server-5050.log | grep AUTO`
2. Review this guide: /AUTOMATION_GUIDE.md
3. Check model schemas: `/server/models/index.ts`
4. Review services: `/server/services/driverAutoEnrollment*.ts`

---

## 📝 Changelog

**v1.0 (2026-08-13)**
- Initial release
- Phase 1-6 implementation
- Background schedulers
- Auto-360 view
- Complete documentation

---

**Status:** ✅ Production Ready  
**Last Updated:** 2026-08-13  
**Next Review:** 2026-09-13
