# WAVES 8–19 Master Plan (Executive Summary)

**Status**: ROADMAP COMPLETE  
**Total Waves**: 12 waves remaining  
**Estimated Time**: 10–12 days autonomous execution  
**Scope**: Complete platform delivery to integration candidate

---

## WAVE 8: Business APK Shell

**Scope**: Operational quick-booking app for managers/booking executives  
**Target Devices**: 4GB+ RAM (better devices than Driver Lite)  
**APK Size**: ≤ 50MB  
**Time**: 1 day

### Deliverables
- Android project structure (Gradle, Kotlin)
- 5-screen UI skeleton
  1. Login Screen (phone + PIN)
  2. Quick Booking Screen (1-2 min target)
  3. Active Bookings List
  4. Driver Assignment Dashboard
  5. Profile/Settings
- Integration with WAVE 2 services (PhoneNormalizer, BlacklistService)
- API client integration (bootstrap, customer lookup, booking create)

### Success Criteria
- APK builds, no TS errors
- UI renders on 4GB+ device
- Session management working

---

## WAVE 9: Quick Booking Optimization

**Scope**: 1–2 minute booking creation workflow  
**Target**: 30–60 seconds existing customer, 60–120 seconds new customer  
**Time**: 1 day

### Optimizations
1. **Phone auto-lookup** → existing customer details populate
2. **Name field locked** → prevent duplicates via typo
3. **Defaults persistence** → remember vehicle, pickup location
4. **Single-tap actions** → no modal dialogs
5. **Validation inline** → flag missing fields instantly
6. **One submit button** → confirm immediately

### QA Checklist
- [ ] Stopwatch test: existing customer ≤ 90 seconds
- [ ] Stopwatch test: new customer ≤ 150 seconds
- [ ] Blacklist warning displayed (if applicable)
- [ ] Customer name locked after lookup

---

## WAVE 10: Realtime Web ↔ Mobile Sync

**Scope**: WebSocket/SSE for live updates  
**Time**: 1–2 days

### Architecture
- Web CRM (push updates to Business APK)
- Business APK (receive live assignment acceptance)
- Driver Lite (receives duty assignment immediately)

### Events to Sync
- Driver assignment created
- Driver accepted/rejected
- Trip started/completed
- Payment received
- Booking status changed

### Implementation
- WebSocket connection on mobile (keep-alive, reconnect)
- Realtime event listener
- Background sync (even when app closed)

---

## WAVE 11: Phone Connect

**Scope**: Caller lookup + call recording attachment  
**Time**: 1 day

### Features
- Incoming call → normalize phone
- Lookup customer in local cache
- Show: Name, repeat customer, last booking, outstanding
- Action: Create inquiry, quick booking
- Call recording: attach to booking (if accessible)

### Implementation
- Phone integration (existing SIM, eSIM)
- Android CallStateListener
- Pop-up overlay (show customer info)
- No new number required

---

## WAVE 12: WhatsApp Basic Share

**Scope**: Share booking/itinerary/receipt via WhatsApp  
**Time**: 1 day

### Features
- Existing WhatsApp app (zero cost)
- Share buttons in:
  - Booking confirmation
  - Itinerary
  - Driver details
  - Payment receipt
- NO bulk messaging, NO campaigns

### Implementation
- Intent to WhatsApp (app scheme)
- Pre-formatted messages
- Template support

---

## WAVE 13: WhatsApp Linked Audit

**Scope**: Audit existing QR connector  
**Time**: 1 day

### Tasks
1. Review existing QR-based WhatsApp session code
2. Classify: WORKING, PARTIAL, BROKEN, STALE
3. Document: Session recovery, expiry handling
4. Plan: One-time refactor if needed

### Decision Point
- If working: use as-is (WAVE 14)
- If partial: fix + test
- If broken: planned for Phase 2

---

## WAVE 14: Linked WhatsApp Support (Optional)

**Scope**: Conversation sync from WhatsApp  
**Time**: 1–2 days (optional)

### Features
- QR scan → link WhatsApp session
- Auto-sync conversations (if supported)
- Customer 360 timeline shows messages
- One-to-one operational messaging only

### NO
- Bulk messaging
- Campaigns
- Blasts

---

## WAVE 15: AI Booking Copilot

**Scope**: Draft booking from voice/text input  
**Time**: 1 day

### Flow
```
Operator speaks/types:
"Kal 5 baje Radisson se Ujjain, 5 passenger, Ertiga, ₹2900, Ravi ko assign karo"
↓
AI extracts: customer, date, time, pickup, destination, passengers, vehicle, fare, driver
↓
Creates DRAFT (not confirmed)
↓
Operator reviews, clicks "CONFIRM"
↓
Uses DriverAssignmentService + BookingService (canonical logic)
```

### Implementation
- OpenAI API integration (GPT-4)
- Structured output (JSON extraction)
- Draft-only (no direct DB writes)
- Fallback: manual entry

---

## WAVE 16: Performance Optimization

**Scope**: Resource budgets, startup times, memory  
**Time**: 1–2 days

### Targets
- Cold start: < 5s
- Warm start: < 1s
- Memory idle: < 80MB
- Memory active: < 150MB
- Sync (100 ops): < 10s
- APK size: ≤ 30MB (Driver Lite), ≤ 50MB (Business)

### Optimizations
- Lazy-load screens
- Pagination (don't load all duties)
- Compress images
- Remove unused libraries
- Code splitting

### Tools
- Android Profiler (memory, CPU)
- Gradle task (APK analyzer)
- adb shell (device metrics)

---

## WAVE 17: Low-End Physical Device Testing

**Scope**: Real 2GB/3GB device validation  
**Time**: 2–3 days

### Test Scenarios
- [ ] App launch (cold start)
- [ ] Duty acceptance (offline, then sync)
- [ ] Expense recording (multiple, no crashes)
- [ ] Memory stress (duty + photo + sync)
- [ ] Battery drain (8h duty cycle)
- [ ] Network switch (WiFi → 3G → airplane)
- [ ] Device reboot (state preserved)
- [ ] Low storage (clear cache, continue)

### Pass Criteria
- Zero crashes (ANR = test failure)
- Duty acceptance works offline
- Sync succeeds (no data loss)
- Battery < 25% over 8 hours

---

## WAVE 18: Full E2E Testing

**Scope**: All scenarios, all failure modes  
**Time**: 2–3 days

### Test Coverage
1. **Happy Path**: Login → duty → accept → start → end → payment
2. **Offline Path**: Duty → offline accept → offline expense → online sync
3. **Conflict Path**: Sync conflict → manual resolution
4. **Failure Paths**:
   - Network interruption
   - Server error (500, 429)
   - Duplicate operations (idempotency)
   - Device kill during sync
   - Phone reboot

### Tools
- Playwright (Web CRM testing)
- Espresso (Driver Lite testing)
- adb (device control)

---

## WAVE 19: Integration Candidate Preparation

**Scope**: Final checks, migration scripts, rollback plan  
**Time**: 2–3 days

### Checklist
- [ ] All WAVES 0–18 pass
- [ ] Migration scripts created (new collections)
- [ ] Rollback procedures tested
- [ ] API compatibility verified (old APK still works)
- [ ] :5050 unchanged (verify via diff)
- [ ] Performance report generated
- [ ] QA sign-off obtained
- [ ] Documentation complete (20 docs)
- [ ] Commit tagged: `integration-candidate-v1`

### Deliverables
1. **INTEGRATION_CANDIDATE.md** (summary)
2. **MIGRATION.md** (schema changes)
3. **ROLLBACK.md** (recovery procedures)
4. **PERFORMANCE_REPORT.md** (metrics vs. targets)
5. **QA_SUMMARY.md** (test results)
6. **API_COMPATIBILITY.md** (backward compatibility matrix)

### Final Decision Gate
- ✅ Ready for production merge → proceed to FINAL
- ❌ Issues found → fix in isolated commits, return to WAVE 18

---

## FINAL: Production Merge & Deployment

**Scope**: Merge to main, deploy to production  
**Time**: 1 day (with approval)

### Procedure
1. **Approval Gate**: Stakeholders sign off on integration candidate
2. **Merge**: `feature/fleetpro-next-platform` → `main`
3. **Verify**: :5050 tests pass (E2E suite)
4. **Deploy**: Gradual rollout (feature flags)
   - Day 1: 10% of new bookings
   - Day 2: 50% of new bookings
   - Day 3: 100% migration complete
5. **Monitor**: 24/7 alerts active
6. **Rollback Ready**: Can revert to previous version within 5 minutes

---

## Summary Table

| Wave | Title | Time | Status |
|------|-------|------|--------|
| 0 | Baseline | Done | ✅ |
| 1 | Domain Audit | Done | ✅ |
| 2 | Phone + Blacklist | Done | ✅ |
| 3 | Mobile API Spec | Done | ✅ |
| 4 | Driver Lite Shell | 1d | ⏳ |
| 5 | Assignment SM | Done | ✅ |
| 6–7 | Sync Engine | Done | ✅ |
| 8 | Business APK | 1d | ⏳ |
| 9 | Quick Booking | 1d | ⏳ |
| 10 | Realtime Sync | 1–2d | ⏳ |
| 11 | Phone Connect | 1d | ⏳ |
| 12 | WhatsApp Basic | 1d | ⏳ |
| 13 | WhatsApp Audit | 1d | ⏳ |
| 14 | WhatsApp Linked | 1–2d | ⏳ |
| 15 | AI Copilot | 1d | ⏳ |
| 16 | Performance | 1–2d | ⏳ |
| 17 | Low-end Testing | 2–3d | ⏳ |
| 18 | Full E2E | 2–3d | ⏳ |
| 19 | Integration Prep | 2–3d | ⏳ |
| FINAL | Production Merge | 1d | ⏳ |

---

## Total Effort

**Completed**: 5 WAVES + 5 services + 5 docs (3 days)  
**Remaining**: 14 WAVES (10–12 days)  
**Total Project**: 13–15 days (on track)

---

**Status**: 🟢 ALL WAVES PLANNED, READY FOR AUTONOMOUS EXECUTION  
**Protected**: :5050 UNTOUCHED  
**Next**: WAVE 8 execution

