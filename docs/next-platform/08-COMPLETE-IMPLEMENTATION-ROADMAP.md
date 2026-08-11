# Complete Implementation Roadmap (WAVES 9-19 FAST TRACK)

**Execution Strategy**: Fast-track implementation with parallel development  
**Timeline**: 10–12 days autonomous, 24/7 execution  
**Approach**: Modular implementation, test-driven, checkpoint-based

---

## WAVE 9: Quick Booking Optimization (1 Day)

### Scope: 1–2 Minute Booking Creation

**Files to Create**:
1. `server/routes/mobile/quickbooking.ts` (80 lines)
   - POST /mobile/v1/bookings (quick endpoint)
   - Auto-validate customer
   - Check blacklist
   - Create booking atomically

2. `business-apk/src/main/kotlin/com/fleetpro/business/ui/vm/QuickBookingViewModel.kt` (120 lines)
   - Phone lookup (PhoneNormalizer integration)
   - Customer cache
   - Defaults (vehicle, location)
   - Form validation inline

3. `business-apk/src/main/kotlin/com/fleetpro/business/domain/usecases/QuickBookingUseCase.kt` (60 lines)
   - Orchestrate booking creation
   - Call backend, handle errors
   - Track timing (stopwatch)

4. `business-apk/src/main/kotlin/com/fleetpro/business/ui/screens/QuickBookingScreenOptimized.kt` (200 lines)
   - Remove modals
   - One-tap actions
   - Inline validation (red borders on missing fields)
   - Autocomplete from history

**Tests**:
- Existing customer ≤ 90 seconds ✓
- New customer ≤ 150 seconds ✓
- Blacklist warning shown ✓
- Name locked after lookup ✓

**Checkpoint**: Commit `WAVE-9-QUICK-BOOKING`

---

## WAVES 10-15: Features (6 Days - Parallel Development)

### WAVE 10: Realtime Sync (1-2 days)

**Files**:
- `server/realtime/websocket-server.ts` (150 lines)
- `server/realtime/event-emitter.ts` (100 lines)
- `business-apk/src/main/kotlin/com/fleetpro/business/sync/RealtimeClient.kt` (120 lines)
- `driver-lite/app/src/main/kotlin/com/fleetpro/driver/sync/RealtimeClient.kt` (120 lines)

**Events**:
- DRIVER_ASSIGNED
- DRIVER_ACCEPTED / REJECTED
- TRIP_STARTED / COMPLETED
- PAYMENT_RECEIVED
- BOOKING_STATUS_CHANGED

**Checkpoint**: Commit `WAVE-10-REALTIME-SYNC`

### WAVE 11: Phone Connect (1 day)

**Files**:
- `business-apk/src/main/kotlin/com/fleetpro/business/phone/PhoneConnector.kt` (150 lines)
- `server/routes/mobile/callerupdate.ts` (80 lines)

**Features**:
- Incoming call listener
- Phone normalization lookup
- Customer info popup
- Call context tracking

**Checkpoint**: Commit `WAVE-11-PHONE-CONNECT`

### WAVE 12: WhatsApp Basic (1 day)

**Files**:
- `server/routes/mobile/whatsapp-share.ts` (100 lines)
- `business-apk/src/main/kotlin/com/fleetpro/business/integration/WhatsAppBasic.kt` (120 lines)

**Features**:
- Share booking confirmation
- Share itinerary
- Share driver details
- Share payment receipt
- NO bulk messaging, NO campaigns

**Checkpoint**: Commit `WAVE-12-WHATSAPP-BASIC`

### WAVE 13: WhatsApp Audit (1 day)

**Analysis**:
- Review existing QR connector code
- Document: working state, session recovery, expiry handling
- Create: `docs/next-platform/WHATSAPP-LINKED-AUDIT.md`

**Decision Point**:
- If working: proceed to WAVE 14
- If partial: create fixes
- If broken: mark for Phase 2

**Checkpoint**: Commit `WAVE-13-WHATSAPP-AUDIT`

### WAVE 14: WhatsApp Linked (1-2 days, optional)

**Files**:
- `business-apk/src/main/kotlin/com/fleetpro/business/integration/WhatsAppLinked.kt` (180 lines)
- `server/routes/mobile/whatsapp-linked.ts` (120 lines)

**Features**:
- QR scan linking
- Auto-sync conversations (if available)
- Customer 360 timeline
- ONE-TO-ONE messaging only

**Checkpoint**: Commit `WAVE-14-WHATSAPP-LINKED`

### WAVE 15: AI Copilot (1 day)

**Files**:
- `server/routes/mobile/ai-booking.ts` (150 lines)
  - OpenAI API integration
  - Structured extraction
  - Draft-only creation
- `business-apk/src/main/kotlin/com/fleetpro/business/ai/BookingCopilot.kt` (180 lines)
  - Voice/text input
  - Draft display
  - Operator review + confirm

**Features**:
- Operator speaks/types booking details
- AI extracts: customer, date, time, location, vehicle, fare, driver
- Creates DRAFT (not confirmed yet)
- Operator reviews, clicks "CONFIRM"
- Uses canonical BookingService

**Checkpoint**: Commit `WAVE-15-AI-COPILOT`

---

## WAVES 16-19: QA & Integration (7 Days)

### WAVE 16: Performance Optimization (1-2 days)

**Targets**:
- Cold start: < 5s
- Warm start: < 1s
- Memory idle: < 80MB
- Memory active: < 150MB
- Sync (100 ops): < 10s
- APK size: ≤ 30MB (Driver Lite), ≤ 50MB (Business)

**Optimizations**:
- Lazy-load screens
- Pagination (duties, bookings)
- Image compression
- Code splitting
- Remove unused libs

**Checkpoint**: Commit `WAVE-16-PERFORMANCE`

### WAVE 17: Low-End Device Testing (2-3 days)

**Test Scenarios** (on real 2GB/3GB device):
- [ ] App launch (cold start)
- [ ] Duty acceptance (offline → sync)
- [ ] Expense recording (multiple)
- [ ] Memory stress test
- [ ] Battery drain (8h cycle)
- [ ] Network switch (WiFi → 3G)
- [ ] Device reboot
- [ ] Low storage (cache clear)

**Pass Criteria**:
- Zero crashes (ANR = FAIL)
- Duty works offline
- Sync succeeds
- Battery < 25% per 8 hours

**Checkpoint**: Commit `WAVE-17-DEVICE-TESTING`

### WAVE 18: Full E2E Testing (2-3 days)

**Scenarios**:
1. Happy path (login → duty → accept → start → end → payment)
2. Offline path (no network throughout)
3. Conflict path (sync conflict, manual resolution)
4. Failure paths:
   - Network interruption mid-sync
   - Server error (500, 429)
   - Duplicate operations (idempotency)
   - Device kill during sync
   - Phone reboot mid-trip

**Tools**:
- Playwright (Web :5050)
- Espresso (Driver Lite)
- Curl/Postman (API)

**Pass Criteria**:
- 100% of scenarios pass
- Zero data loss
- Idempotency verified

**Checkpoint**: Commit `WAVE-18-E2E-TESTING`

### WAVE 19: Integration Candidate (2-3 days)

**Checklist**:
- ✅ All WAVES 0–18 pass
- ✅ Zero TypeScript errors
- ✅ Zero test failures
- ✅ Migration scripts created
- ✅ Rollback procedures tested
- ✅ API compatibility verified
- ✅ :5050 verification (0 changes)
- ✅ Performance report (all targets met)
- ✅ QA sign-off
- ✅ Documentation complete (20 files)

**Deliverables**:
1. `INTEGRATION_CANDIDATE.md`
2. `MIGRATION.md`
3. `ROLLBACK.md`
4. `PERFORMANCE_REPORT.md`
5. `QA_SUMMARY.md`
6. `API_COMPATIBILITY.md`

**Tag**: `integration-candidate-v1-20260824`

**Checkpoint**: Commit `WAVE-19-INTEGRATION-CANDIDATE`

---

## FINAL: Production Merge (1 Day)

### Procedure

**Step 1**: Stakeholder approval
**Step 2**: Merge feature/fleetpro-next-platform → main
**Step 3**: Deploy with 4-phase rollout
- Day 1: 10% traffic
- Day 2: 50% traffic
- Day 3: 100% traffic
**Step 4**: 24/7 monitoring
**Step 5**: Success metrics validation

**Rollback Ready**: < 5 minutes

---

## Timeline Summary

| Phase | Waves | Duration | Status |
|-------|-------|----------|--------|
| Completed | 0–8 | 8 hours | ✅ |
| Features | 9–15 | 6 days | ⏳ |
| QA | 16–19 | 7 days | ⏳ |
| Merge | FINAL | 1 day | ⏳ |
| **TOTAL** | **0–19+** | **13–15 days** | ⏳ |

---

## Autonomous Execution Model

**No Stopping**:
- Execute all WAVES sequentially
- Commit at each checkpoint
- No permission prompts
- 24/7 continuous execution
- Auto-continue on completion

**Monitoring**:
- Track metrics
- Verify :5050 remains untouched
- Report progress

**Final Deliverable**:
- Integration candidate ready
- All documentation complete
- Production-ready platform
- Rollback procedure verified

---

**Status**: 🟢 **READY FOR AUTONOMOUS EXECUTION**  
**Current Phase**: WAVE 9 (Quick booking optimization) starting NOW

