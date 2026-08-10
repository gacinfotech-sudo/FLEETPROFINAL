# RAPID COMPLETION STRATEGY — Focus on MVP for Live Testing

## DONE ✅
- Schema: Pickup/drop charges added to Booking
- Schema: VehicleInspection model created
- Schema: Build passes, no errors

## NEXT: MINIMUM VIABLE FOR LIVE TEST

### CRITICAL PATH (Must work for demo):
1. ✅ Customer auto-fetch: Already works (`/api/customers/lookup`)
2. ✅ Duplicate prevention: Already works (findOrCreateCustomer checks phone)
3. ✅ Driver login: Already works (`/api/driver-auth/login`)
4. ✅ Driver duties: Already works (`/api/driver-portal/my-duties`)
5. ⚠️ **NEED: Delivery collection UI** — show what driver needs to collect
6. ⚠️ **NEED: Handover inspection form** — capture pre-delivery checklist
7. ⚠️ **NEED: Return inspection form** — capture vehicle return state
8. ⚠️ **NEED: Payment split collection** — cash vs online entry

### QUICK WINS (Low effort, high impact):
- Add pickup/drop charge calculations to booking total (API + Form)
- Create inspection capture endpoint
- Create delivery collection endpoint
- Create return inspection endpoint

### SKIP FOR NOW (Phase 2):
- AI assistant (REQ-14) — explicitly marked HOLD
- Complex damage comparison logic — simplify to list
- Driver cash ledger integration — just track collection amounts
- Refund/settlement calculation — can be manual for now

## IMPLEMENTATION ORDER
1. API: Fix amount calculation (validate server-side)
2. API: Add inspection endpoints (save photos + checklist)
3. API: Add delivery collection endpoint
4. UI: Add pickup/drop charge inputs in booking form
5. UI: Create driver delivery workflow
6. UI: Create inspection photo capture
7. Test locally
8. Deploy to :5050
9. Test end-to-end

## SUCCESS CRITERIA FOR MVP
- ✅ Existing customer → auto-select → no duplicate
- ✅ Amounts calculate correctly (5000 test)
- ✅ Driver can login
- ✅ Driver sees assigned duties
- ✅ Driver can mark delivery in progress
- ✅ Driver can collect payment (cash/online)
- ✅ Driver can capture pre-handover photos
- ✅ Admin can see driver collections
- ✅ All existing features still work
- ✅ Deployed and testable

## TIME ESTIMATE
- API: 1 hour
- UI: 1.5 hours
- Test + Deploy: 0.5 hours
- **TOTAL: 3 hours**

## NO CHANGES TO:
- Dashboard
- Booking History
- Fleet Management
- Customer Lookup
- Payment Reports
- Any existing working feature
