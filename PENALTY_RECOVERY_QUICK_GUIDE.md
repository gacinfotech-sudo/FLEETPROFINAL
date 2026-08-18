# Penalty & Recovery Management - Quick User Guide

## Overview

The Penalty & Recovery Management system allows you to:
- Add and track driver penalties
- Manage recovery of outstanding amounts
- View complete ledger trail of all deductions
- Analyze penalty trends and recovery progress

## Accessing the System

1. Login to FleetPro admin/manager account
2. Navigate to **Payroll** section in sidebar
3. Click **🚨 Penalty & Recovery**

## Main Dashboard

### Summary Cards (Top)
| Card | Shows | Action |
|------|-------|--------|
| 💰 Total Penalties | Sum of all penalties | Monitor cumulative penalties |
| ⚠️ Pending Approval | Count of unapproved penalties | Review for approval |
| 💰 Active Recoveries | Count of ongoing recoveries | Track progress |
| 💵 Total Recovery Amount | Sum of all outstanding recoveries | Monitor collections |
| ✅ Amount Recovered | Sum of payments collected | Track actual collections |

## Tab 1: Overview 📊

View analytics and trends.

### Penalty Trend Chart
- **Shows**: Penalty amounts over last 12 months
- **Use**: Identify patterns and spike periods
- **Example**: See if penalties increase during monsoon/peak season

### Penalties by Type Chart
- **Shows**: Breakdown of penalties by type (Damage, Challan, Cash Shortage, etc.)
- **Use**: Identify most common penalty types
- **Example**: Damage penalties might be 40%, Challan 35%, etc.

### Recovery Progress Chart
- **Shows**: How much recovered vs. how much remaining for active recoveries
- **Use**: Monitor collection progress
- **Example**: If total recovery is ₹50000 and recovered ₹15000, bar shows 30% progress

## Tab 2: Penalties ⚠️

Manage driver penalties.

### Adding a New Penalty

1. Click **+ Add Penalty** button
2. Fill the form:
   - **Driver**: Select from dropdown (required)
   - **Penalty Type**: Choose one of 7 types:
     - 💥 **Damage**: Vehicle damage
     - 🚨 **Challan/Fine**: Traffic violation
     - 💸 **Cash Shortage**: Missing money in cash
     - ⛽ **Fuel Excess**: Excessive fuel consumption
     - 📅 **Attendance**: Late/absent
     - 😠 **Behavior**: Misconduct
     - 🔧 **Other**: Any other penalty
   - **Amount (₹)**: Penalty amount in rupees
   - **Reason**: Description (e.g., "Broken windshield during trip")
   - **Deduction Mode**: How to deduct:
     - 📅 **Full Next Salary**: Deduct entire amount from next month's salary
     - 📊 **EMI**: Spread over monthly installments (you choose count)
     - 🔄 **Manual**: Track separately, deduct when ready
   - **Number of Installments** (if EMI selected): 2-12 months
   - **Notes** (optional): Additional info

3. Click **Add Penalty**

### Penalty Status Flow

```
PENDING → APPROVE → APPROVED → DEDUCTED → (REVERSED if reversed)
```

| Status | Meaning | Action |
|--------|---------|--------|
| 🟡 PENDING | Awaiting admin approval | Click **Approve** to approve |
| 🔵 APPROVED | Approved, ready to deduct | Automatically deducts on schedule |
| 🟢 DEDUCTED | Successfully deducted | No action needed |
| ⚪ REVERSED | Penalty cancelled | Refund may be issued |

### Penalty Table

View all penalties with:
- **Driver Name**: Click to view driver details
- **Type**: Penalty type (color-coded)
- **Amount**: Penalty amount in ₹
- **Reason**: Why penalty was issued
- **Status**: Current status (colored badge)
- **Deduction Mode**: How it will be deducted (Full/EMI/Manual)
- **Action**: Approve button (if pending)

### Tips
- ✅ Always provide clear reason for audit trail
- ✅ Use EMI for large amounts (> ₹5000) to avoid salary shock
- ✅ Approve penalties within 48 hours
- ✅ Review ledger to see actual deductions

## Tab 3: Recoveries 💰

Track collection of outstanding amounts.

### Creating a Recovery

1. Click **+ Add Recovery** button
2. Fill the form:
   - **Driver**: Select from dropdown (required)
   - **Recovery Type**: Choose one of 7 types:
     - 💳 **Advance**: Salary advance to be recovered
     - 🏦 **Loan**: Personal loan
     - ⚠️ **Penalty**: From previous penalties
     - 💥 **Damage**: Damage recovery charge
     - 💸 **Shortage**: Cash/fuel shortage
     - ⛽ **Fuel Excess**: Fuel overage charge
     - 🔧 **Other**: Any other recovery
   - **Amount (₹)**: Total amount to recover (required)
   - **Description**: Why recovery is needed (e.g., "Advance given on 2026-07-15")
   - **Recovery Mode**: How to recover:
     - 💰 **Single Payment**: One-time full recovery
     - 📊 **EMI**: Monthly installments (you choose count)
     - 🔄 **Manual**: Track separately
   - **Number of Installments** (if EMI): 2-24 months

3. Click **Create Recovery**

### Recording a Payment

1. Find the recovery in the **Recoveries** table
2. Click **+ Payment** or **Record Payment** button
3. Enter the payment amount
4. Click **Submit**
5. Progress bar updates automatically

### Recovery Status Flow

```
ACTIVE → COMPLETED (when 100% recovered)
  ↓
  PAUSED (temporarily stop recovery)
  ↓
  ACTIVE (resume)
```

| Status | Meaning | Progress |
|--------|---------|----------|
| 🔵 ACTIVE | Currently collecting | 0-99% |
| 🟢 COMPLETED | Fully recovered | 100% |
| 🟡 PAUSED | Temporarily stopped | Any % |
| ⚪ CANCELLED | Cancelled, no more collection | Any % |

### Recovery Table

View all recoveries with:
- **Driver Name**: Recovered from which driver
- **Type**: Type of recovery
- **Total Amount**: Amount to collect (₹)
- **Recovered**: Amount already collected (₹, green)
- **Remaining**: Still outstanding (₹, red)
- **Status**: Current status
- **Progress**: Visual bar showing % complete

### Tips
- ✅ Start recovery as soon as advance is given
- ✅ Use EMI for large advances (> ₹10000)
- ✅ Record payments immediately after collection
- ✅ Review recovery list weekly

## Tab 4: Ledger 📋

View detailed transaction history (immutable audit trail).

### Viewing Ledger

1. Select a **Driver** from dropdown (required)
2. Select **Month** and **Year**
3. View all penalty/recovery related entries

### Ledger Table Columns

| Column | Shows |
|--------|-------|
| Date | Transaction date |
| Transaction Type | penalty, damage_recovery, cash_shortage, etc. |
| Description | What happened |
| Amount | Deduction amount (₹) |
| Closing Balance | Running balance after this transaction |

### Example Ledger Trail

For a ₹6000 damage penalty with 3-month EMI:

```
Date        Type              Description                   Amount    Closing Balance
2026-08-13  penalty           Penalty created              ₹6000     ₹6000
2026-08-14  damage_recovery   Approved: Damage             ₹6000     ₹6000
2026-09-01  recovery_deducted EMI 1/3 deducted            ₹2000     ₹4000
2026-10-01  recovery_deducted EMI 2/3 deducted            ₹2000     ₹2000
2026-11-01  recovery_deducted EMI 3/3 deducted            ₹2000     ₹0
```

### Important Notes
- 🔒 **Ledger is immutable**: Cannot edit or delete entries
- 📊 **Running balance**: Shows cumulative effect
- 🔗 **References**: Links back to original penalty/recovery
- 📅 **Date range**: Filter by month/year for specific period

## Common Workflows

### Workflow 1: Issue a Damage Penalty

1. **Monday**: Issue ₹5000 damage penalty with EMI mode (3 months)
   - Go to **Penalties** tab
   - Click **+ Add Penalty**
   - Select driver, type "Damage", amount "5000"
   - Set mode to "EMI" with 3 installments
   - Click **Add Penalty**

2. **Same day**: Approve the penalty
   - In **Penalties** table, click **Approve** button
   - Status changes to "APPROVED"
   - Ledger entry created automatically

3. **Next month**: Deduction occurs
   - Ledger shows ₹1667 deducted on due date
   - Repeats for 3 months total

4. **Track progress**:
   - Go to **Ledger** tab
   - Select driver and month
   - See ₹1667 deduction for each month

### Workflow 2: Collect an Advance Recovery

1. **Advance given**: Create recovery record
   - Go to **Recoveries** tab
   - Click **+ Add Recovery**
   - Type "Advance", amount "₹12000"
   - Mode "EMI", 3 installments
   - Creates ₹4000 monthly installment plan

2. **End of first month**: Record payment
   - Employee pays ₹4000
   - Click **Record Payment** in table
   - Enter "4000"
   - Progress bar shows 33%

3. **End of second month**: Record second payment
   - Employee pays ₹4000
   - Click **Record Payment**
   - Progress bar shows 67%

4. **End of third month**: Record final payment
   - Employee pays ₹4000
   - Click **Record Payment**
   - Status auto-changes to "COMPLETED" (100%)

### Workflow 3: Monitor Penalties This Month

1. Go to **Overview** tab
2. View summary cards:
   - See total penalties for month
   - See pending approvals
   - See active recoveries
3. Click on **Penalties by Type** chart
4. Identify most common issues
5. Plan corrective action

## Key Metrics to Monitor

### Daily Checks
- **Pending Approvals**: Should be 0 (all approved within 24 hours)
- **Active Recoveries**: Should decrease month over month
- **Recovery Rate**: Should be > 80% (amount recovered / amount total)

### Weekly Checks
- Review **Overview** tab charts
- Check penalty trends (increasing/decreasing?)
- Review recoveries status

### Monthly Checks
- Generate report for the month
- Compare with previous months
- Identify top penalty reasons
- Calculate impact on salary

## Important Tips & Best Practices

### ✅ DO's
- ✅ **Approve penalties quickly** (within 48 hours)
- ✅ **Record recovery payments immediately** (same day)
- ✅ **Use EMI for large amounts** (spread impact)
- ✅ **Provide clear reasons** (audit trail)
- ✅ **Review ledger regularly** (catch errors)
- ✅ **Monitor recovery rates** (track collection)

### ❌ DON'Ts
- ❌ **Don't issue vague penalties** (must have clear reason)
- ❌ **Don't delay approvals** (penalty loses effectiveness)
- ❌ **Don't double-deduct** (check ledger first)
- ❌ **Don't mix multiple penalties** (each should be separate)
- ❌ **Don't ignore outstanding recoveries** (follow up regularly)

## Troubleshooting

### Issue: Penalty not appearing in ledger
**Solution**: Check if penalty is "Approved" status. Ledger entries only created after approval.

### Issue: Recovery showing wrong progress
**Solution**: Check if all payments were recorded. Refresh page and re-verify.

### Issue: Can't add penalty for driver
**Solution**: Ensure driver exists and is active in system. Check permissions.

### Issue: Recovery amount seems too high
**Solution**: Check in Ledger tab to see running balance and all deductions.

## Reports

### Generate a Report
- Go to **Penalties & Recoveries > Report** (if available)
- Select date range
- Select driver (optional)
- Click "Generate"
- Shows:
  - Total penalties by type
  - Penalty status breakdown
  - Recovery amounts
  - Collection rate
  - Ledger impact

### Export Data
- All tables have export option (📥 Export button)
- Choose format: CSV or Excel
- Use for external analysis

## Support & Help

### For Questions
1. Check **Ledger** tab for specific transactions
2. Review **Overview** charts for patterns
3. Look at **Reports** for summary data

### For Issues
- Contact system administrator
- Provide driver name and date range
- Share screenshot of issue
- Reference this guide for specific workflows

## Summary

| Need | Location | Action |
|------|----------|--------|
| Add penalty | Penalties tab | Click "Add Penalty" |
| Approve penalty | Penalties table | Click "Approve" |
| Create recovery | Recoveries tab | Click "Add Recovery" |
| Record payment | Recoveries table | Click "Record Payment" |
| View ledger | Ledger tab | Select driver, month, year |
| See analytics | Overview tab | Review charts |
| Generate report | Reports section | Set date range |
| Check stats | Summary cards | View top section |

---

**Last Updated**: 2026-08-13  
**Version**: 1.0  
**For Support**: Contact FleetPro Admin
