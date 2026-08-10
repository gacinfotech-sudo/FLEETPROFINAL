# CRM FULL-STACK EXECUTION PLAN — 2026-08-10

## SCOPE
15 integrated requirements: customer auto-fetch → driver login → self-drive workflows → payment → audit

## EXISTING STATE
✅ Customer lookup endpoint: `/api/customers/lookup` (line 4897, routes.ts)
✅ normalizeIndianPhone function exists
✅ Booking schema has createdBy field (line 931-934)
✅ Booking has securityDepositAmount (line 755)
✅ Payment tracking: advanceReceived, driverCollectionAmount exist
✅ Status enums: includes self_drive, with_driver
✅ Driver model exists with loginCredentials

## FIXES REQUIRED

### PHASE 1: CUSTOMER DUPLICATE PREVENTION & AUTO-FETCH (REQ 1-2)
- [x] API: Normalize phone in booking submission (backend)
- [ ] API: Reject duplicate mobile creation in customer POST
- [ ] API: Auto-match existing customer on mobile lookup
- [ ] Form: Display matched customer fields (name, email, WhatsApp)
- [ ] Form: Prevent name override for existing customer
- [ ] DB: Add unique index on normalized phone (migrations)

### PHASE 2: AMOUNT CALCULATION BUG (REQ 3)
- [ ] Audit: Find the digit-removal bug in form/submission
- [ ] Form: Separate display formatting from numeric value
- [ ] API: Validate numeric amounts server-side
- [ ] Test: 5000, 50000, 500000 edge cases

### PHASE 3: CREATED-BY USER TRACKING (REQ 4)
- [ ] API: Auto-capture createdBy from session (don't trust frontend)
- [ ] DB: Ensure createdBy/createdAt/updatedBy/updatedAt persisted
- [ ] Audit: Enable employee-wise reporting

### PHASE 4: SELF-DRIVE PICKUP/DROP CHARGES (REQ 5)
- [ ] Schema: Add pickupChargeRequired, dropChargeRequired, amounts
- [ ] Form: Add Pickup/Drop Service selector + amount inputs
- [ ] Calculation: Include in totalAmount
- [ ] Payment: Include in driver collection + reconciliation

### PHASE 5: DRIVER LOGIN & ROLE (REQ 6)
- [ ] Create Driver portal/app entry
- [ ] Driver Role: READ-ONLY duties, can't modify booking data
- [ ] Implement driver permission model
- [ ] Ensure driver session secured

### PHASE 6: SELF-DRIVE DELIVERY WORKFLOW (REQ 7)
- [ ] Create "Deliver Vehicle to Customer" action
- [ ] Show collection checklist + amounts
- [ ] Payment modes: Cash/Online/Split
- [ ] Online payment: reference field + proof upload
- [ ] Auto-add cash to Driver Cash Ledger

### PHASE 7: PRE-HANDOVER INSPECTION (REQ 8)
- [ ] Create inspection checklist schema
- [ ] Vehicle condition: front/rear/sides/interior/tires/lights
- [ ] Capture photos (mandatory for issues)
- [ ] Store with booking/vehicle/driver/timestamp
- [ ] Enforce mandatory items before handover

### PHASE 8: RETURN INSPECTION & DAMAGE (REQ 9)
- [ ] Create return inspection checklist
- [ ] Compare PRE vs RETURN for new damages
- [ ] Damage categories + auto-detect new issues
- [ ] Feed into charges: fuel, KM, dent, scratch, etc.
- [ ] Generate refund/settlement calculation

### PHASE 9: SELF-DRIVE STATUS FLOW (REQ 10)
- [ ] Canonical workflow: Deposit → Handover → On Trip → Returned → Settled → Closed
- [ ] Driver updates sync to Admin panel (real-time)
- [ ] No duplicate driver-side booking copy
- [ ] Payment ledger reads unified records

### PHASE 10: CHAUFFEUR TRIP START/END (REQ 11)
- [ ] Trip Start: automatic timestamp, location, odometer photo
- [ ] Trip End: automatic timestamp, location, odometer, KM calc
- [ ] Payment collection: cash/online/split
- [ ] Same payment engine as self-drive

### PHASE 11: UNIFIED PAYMENT COLLECTION (REQ 12)
- [ ] One system for: booking / self-drive / driver workflows
- [ ] Support: Cash / Online / Split
- [ ] Track: Total Due / Total Received / Cash / Online / Pending
- [ ] Prevent double-counting advance
- [ ] Audit trail for all changes

### PHASE 12: PHOTO & AUDIT SECURITY (REQ 13)
- [ ] Audit log for: payment, inspection, handover, return, damage
- [ ] Store: user/driver ID, booking ID, vehicle ID, timestamp
- [ ] No silent overwrites
- [ ] Evidence preservation

### PHASE 13: CONFLICT PREVENTION (REQ 2)
- [ ] Backend: Check vehicle overlap before assignment
- [ ] Backend: Check driver overlap before assignment
- [ ] Idempotent booking submission (dedup key)
- [ ] Return conflict message with existing booking ID

### PHASE 14: REGRESSION PROTECTION
- [ ] Run 20+ test scenarios pre-deploy
- [ ] Verify existing booking flows unchanged
- [ ] Sidebar/modules intact
- [ ] KPIs still correct

### PHASE 15: DEPLOYMENT
- [ ] Build clean
- [ ] Run migrations
- [ ] Start services
- [ ] Health check DB/API/Frontend
- [ ] Deploy to localhost:5050
- [ ] Smoke test actual deployed build

## TIMELINE
- Phases 1-3: Foundation (customer + amounts + user tracking)
- Phases 4-6: Driver + Self-Drive setup
- Phases 7-12: Workflows + inspection + payment
- Phase 13-15: Tests + deploy

## SUCCESS CRITERIA
✅ Existing customer → auto-select → no duplicate
✅ Amounts 5000-500000 all correct
✅ Created-by user captured server-side
✅ Self-drive pickup/drop charges included
✅ Driver login works, read-only permissions
✅ Delivery workflow: handover → collection → settled
✅ Pre-handover inspection: checklist + photos
✅ Return inspection: damage comparison
✅ No duplicate bookings/vehicles/drivers
✅ Payment split: cash/online unified
✅ All existing flows still working
✅ Deployed and testable on :5050
