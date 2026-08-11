# WAVE 5: Driver Assignment State Machine

**Status**: SPECIFICATION COMPLETE  
**Service**: DriverAssignmentService  
**States**: 7 (ASSIGNED → ACCEPTED/REJECTED/TIMED_OUT)

---

## Overview

Driver assignment is a **state machine** that tracks duty allocation lifecycle:

```
ASSIGNED
  ├─→ NOTIFICATION_SENT
  │     ├─→ SEEN
  │     │     ├─→ ACCEPTED ✅
  │     │     ├─→ REJECTED ❌
  │     │     └─→ TIMED_OUT ⏱️
  │     └─→ TIMED_OUT
  └─→ CANCELLED
```

Each state transition triggers **events** → notifications → Web/Business APK updates.

---

## Service Methods

### assign() — Create new assignment
```kotlin
val result = DriverAssignmentService.assign(
  tenantId = tenant._id,
  bookingId = booking._id,
  driverId = driver._id,
  acceptanceDeadlineMinutes = 15
)
// Returns: IDriverAssignment with status=ASSIGNED
```

### accept() — Driver accepts duty
```kotlin
val result = DriverAssignmentService.accept(assignmentId)
// Returns: success + nextAction="ASSIGNMENT_ACCEPTED"
// Event: ACCEPTED → triggers Web/Business update
```

### reject() — Driver rejects
```kotlin
val result = DriverAssignmentService.reject(
  assignmentId,
  reason = "Vehicle not in good condition"
)
// Returns: success + nextAction="REASSIGN_TO_DIFFERENT_DRIVER"
// Event: REJECTED → ops can assign different driver
```

### handleTimeout() — Acceptance deadline passed
```kotlin
val result = DriverAssignmentService.handleTimeout(assignmentId)
// Returns: success + nextAction="NOTIFY_OPERATIONS_TIMEOUT"
// Event: TIMED_OUT → ops knows no response, can reassign
```

---

## Notification Integration

When assignment created → high-priority notification:

**Payload to driver**:
```json
{
  "type": "DUTY_ASSIGNMENT",
  "assignmentId": "...",
  "bookingId": "...",
  "customerId": "...",
  "customerName": "Rajesh Sharma",
  "pickupTime": "2026-08-15T10:30:00Z",
  "pickupLocation": "Indore Station",
  "route": "Station → Temple (25 km, 45 min)",
  "acceptanceDeadline": "2026-08-15T10:45:00Z",
  "actions": [
    {"label": "ACCEPT", "type": "ACCEPT_DUTY"},
    {"label": "REJECT", "type": "REJECT_DUTY"}
  ]
}
```

**Display**: High-priority alert (not silent), big buttons, countdown timer.

---

## Realtime Sync

When driver accepts:
1. Database updated: `assignments.status = ACCEPTED`
2. Event emitted: `ASSIGNMENT_ACCEPTED`
3. Realtime broadcast to:
   - Web CRM (operations dashboard updates)
   - Business APK (assignment list updates)
   - Driver Lite (confirmation + next steps)

**Web shows**: "✅ DRIVER ACCEPTED - Pradeep"

---

## Test Cases

```kotlin
test("assign creates ASSIGNED state") {
  val assignment = DriverAssignmentService.assign(...)
  assert(assignment.status == "ASSIGNED")
  assert(assignment.acceptanceDeadline != null)
}

test("accept transitions ASSIGNED → ACCEPTED") {
  val assignment = DriverAssignmentService.accept(id)
  assert(assignment.status == "ACCEPTED")
}

test("reject with reason stored") {
  val result = DriverAssignmentService.reject(id, "vehicle breakdown")
  assert(result.success)
}

test("timeout after deadline") {
  val timedOut = DriverAssignmentService.handleTimeout(id)
  assert(timedOut.status == "TIMED_OUT")
}

test("accept twice = idempotent (same result)") {
  val first = DriverAssignmentService.accept(id)
  val second = DriverAssignmentService.accept(id)  // Duplicate
  assert(first.assignmentId == second.assignmentId)
  assert(first.acceptedAt == second.acceptedAt)  // Same timestamp
}
```

---

**Complete**: WAVE 5 service layer implemented.  
**Next**: WAVE 6–7 (Sync engine + automatic retry)

