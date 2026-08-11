# Mobile API Contract (WAVE 3)

**Status**: SPECIFICATION COMPLETE  
**Version**: /mobile/v1/  
**Date**: 2026-08-12  
**Backward Compatibility**: Maintains /api/* routes unchanged  

---

## API Versioning Strategy

### Versioned Path Prefix
```
/mobile/v1/          → First major version
/mobile/v2/ (future) → Breaking changes only
```

### Backward Compatibility
- Old APK continues to work during transition
- New `/mobile/v1/` routes do not interfere with `/api/*`
- Minimum supported version policy: current + 1 prior release
- Forced upgrade only for security/critical issues

---

## Authentication

### Device-Based Session

```typescript
// Lifecycle:
// 1. Register device (POST /mobile/v1/device/register)
// 2. Get session token (valid 7 days)
// 3. Send token in X-Session-Token header
// 4. Session auto-refreshes on active use
// 5. Multi-device: each device maintains independent session
```

### Headers

```
POST /mobile/v1/device/register
Authorization: Basic <base64(userId:password)>
Content-Type: application/json
```

```
GET /mobile/v1/bookings
X-Session-Token: <session-token>
X-Device-Id: <device-fingerprint>
Content-Type: application/json
```

### Response on Auth Failure

```json
{
  "error": "UNAUTHORIZED",
  "code": 401,
  "message": "Invalid or expired session token"
}
```

---

## Endpoint Specifications

### 1. Device Registration

**Purpose**: Register mobile device, get session token  
**Method**: `POST /mobile/v1/device/register`

**Request**:
```json
{
  "deviceId": "uuid-or-fingerprint",
  "deviceType": "ANDROID" | "IOS",
  "appVersion": "1.0.0"
}
```

**Response (200)**:
```json
{
  "registered": true,
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-08-19T02:50:00Z",
  "user": {
    "id": "...",
    "name": "Pradeep",
    "tenantId": "..."
  },
  "tenant": {
    "id": "...",
    "name": "ABC Taxi",
    "timezone": "Asia/Kolkata"
  }
}
```

**Errors**:
- 400: Invalid device info
- 401: Invalid credentials
- 429: Rate limited (max 5 registrations per user per hour)

---

### 2. Bootstrap Configuration

**Purpose**: Load tenant config, feature flags, feature availability  
**Method**: `GET /mobile/v1/bootstrap`  
**Auth**: Required

**Response (200)**:
```json
{
  "tenant": {
    "id": "...",
    "name": "ABC Taxi",
    "businessName": "ABC Taxi Services",
    "timezone": "Asia/Kolkata",
    "phone": "+91 98765 43210"
  },
  "user": {
    "id": "...",
    "name": "Pradeep",
    "role": "manager",
    "permissions": ["booking.create", "booking.view", "driver.assign"]
  },
  "features": {
    "whatsapp": {
      "mode": "BASIC" | "LINKED" | "OFFICIAL",
      "enabled": true,
      "qrUrl": "..." // Only if mode: LINKED
    },
    "phone": {
      "enabled": true
    },
    "gps": {
      "enabled": false,
      "reason": "Not configured for this tenant"
    },
    "offlineMode": {
      "enabled": true,
      "maxQueueSize": 1000,
      "syncBatchSize": 100
    },
    "aiCopilot": {
      "enabled": false
    }
  },
  "config": {
    "booking": {
      "bookingTimeoutMinutes": 15,
      "defaultAdvancePercentage": 30,
      "paymentModesAvailable": ["cash", "upi", "card"]
    },
    "driver": {
      "assignmentDeadlineMinutes": 15,
      "notificationPriority": "HIGH",
      "acceptanceTimeoutMinutes": 15
    },
    "sync": {
      "batchSize": 100,
      "maxRetries": 5,
      "retryBackoffMs": 1000
    }
  },
  "policies": {
    "blacklist": {
      "mode": "WARNING" | "MANAGER_APPROVAL" | "HARD_BLOCK"
    },
    "customer": {
      "allowDuplicatePhones": false,
      "phoneLookupRequired": true
    }
  }
}
```

---

### 3. Customer Lookup

**Purpose**: Find or create customer by phone, check blacklist  
**Method**: `POST /mobile/v1/customer/lookup`  
**Auth**: Required

**Request**:
```json
{
  "phone": "9876543210"  // Any format, will be normalized
}
```

**Response (200) — Customer Found**:
```json
{
  "found": true,
  "customer": {
    "id": "ObjectId",
    "name": "Rajesh Sharma",
    "phone": "9876543210",
    "email": "rajesh@example.com",
    "customerStatus": "repeat",
    "lastBooking": {
      "id": "...",
      "date": "2026-08-10",
      "status": "completed"
    },
    "upcomingBooking": {
      "id": "...",
      "date": "2026-08-15",
      "status": "confirmed"
    },
    "outstanding": 0,
    "preferences": {
      "vehicleCategory": "SUV",
      "driverPreference": "courteous"
    }
  },
  "blacklist": {
    "status": "ACTIVE" | "WARNING" | "MANAGER_APPROVAL" | "HARD_BLOCK",
    "reason": "",
    "riskNotes": ""
  }
}
```

**Response (200) — Customer Not Found**:
```json
{
  "found": false,
  "customer": null,
  "blacklist": {
    "status": "NONE"
  },
  "canCreateNew": true,
  "suggestion": "New customer; ready to create"
}
```

**Response (409) — Duplicate Detected**:
```json
{
  "found": false,
  "duplicateDetected": true,
  "potentialMatches": [
    {
      "id": "ObjectId",
      "name": "Rajesh Sharma",
      "matchScore": 95,
      "confidence": "DEFINITE",
      "reasons": ["Primary phone exact match", "Name matches"]
    }
  ],
  "action": "MANUAL_REVIEW",
  "recommendation": "1 definite match detected; please verify before creating new"
}
```

**Errors**:
- 400: Invalid phone number
- 429: Rate limited (max 100 lookups per hour per user)

---

### 4. Create Booking

**Purpose**: Create new booking  
**Method**: `POST /mobile/v1/bookings`  
**Auth**: Required

**Request**:
```json
{
  "customerId": "...",
  "bookingType": "self_drive" | "with_driver",
  "pickupTime": "2026-08-15T10:30:00Z",
  "pickupLocation": "Indore Station",
  "dropLocation": "Ujjain Temple",
  "vehicleType": "SUV" | "sedan",
  "passengers": 4,
  "fare": 2500,  // In rupees
  "advance": 750,  // In rupees, optional
  "operationId": "uuid",  // For idempotency
  "notes": "Customer says fragile items"
}
```

**Response (201)**:
```json
{
  "id": "...",
  "bookingId": "BK-2026-08-15-001",
  "bookingCode": "ABC123",
  "status": "confirmed",
  "customerId": "...",
  "customerName": "Rajesh Sharma",
  "vehicleId": null,  // Not assigned yet
  "driverId": null,
  "fare": 2500,
  "advance": 750,
  "outstanding": 1750,
  "pickupTime": "2026-08-15T10:30:00Z",
  "createdAt": "2026-08-12T02:50:00Z",
  "nextAction": "ASSIGN_DRIVER" | "WAIT_FOR_CONFIRMATION"
}
```

**Errors**:
- 400: Invalid input
- 409: Blacklisted customer (if HARD_BLOCK mode)
- 422: Customer duplicate (suggest merge)
- 429: Rate limited (max 1000 bookings per hour per tenant)

---

### 5. Driver Assignment

**Purpose**: Assign driver to booking  
**Method**: `POST /mobile/v1/bookings/{bookingId}/assign-driver`  
**Auth**: Required

**Request**:
```json
{
  "driverId": "...",
  "operationId": "uuid"  // For idempotency
}
```

**Response (200)**:
```json
{
  "assignmentId": "...",
  "bookingId": "...",
  "driverId": "...",
  "status": "ASSIGNED",
  "notificationSent": true,
  "acceptanceDeadline": "2026-08-15T10:45:00Z"
}
```

---

### 6. Accept Duty (Driver)

**Purpose**: Driver accepts assigned duty  
**Method**: `POST /mobile/v1/assignments/{assignmentId}/accept`  
**Auth**: Required (driver session)

**Request**:
```json
{
  "operationId": "uuid"
}
```

**Response (200)**:
```json
{
  "assignmentId": "...",
  "status": "ACCEPTED",
  "bookingId": "...",
  "acceptedAt": "2026-08-15T10:35:00Z",
  "nextSteps": ["Review trip details", "Navigate to pickup location"]
}
```

---

### 7. Sync Push (Offline Operations)

**Purpose**: Upload offline operations to server (idempotent)  
**Method**: `POST /mobile/v1/sync/push`  
**Auth**: Required

**Request**:
```json
{
  "operations": [
    {
      "operationId": "uuid-1",
      "entityType": "EXPENSE",
      "entityId": "...",
      "payload": {
        "category": "fuel",
        "amount": 500,
        "description": "Diesel"
      },
      "baseVersion": 1,
      "deviceTimestamp": "2026-08-15T10:30:00Z"
    },
    {
      "operationId": "uuid-2",
      "entityType": "PAYMENT",
      "entityId": "...",
      "payload": {
        "amount": 2500,
        "method": "cash"
      },
      "baseVersion": 1,
      "deviceTimestamp": "2026-08-15T10:32:00Z"
    }
  ]
}
```

**Response (200)**:
```json
{
  "synced": [
    {
      "operationId": "uuid-1",
      "status": "SYNCED",
      "serverVersion": 2,
      "timestamp": "2026-08-15T10:35:12Z"
    }
  ],
  "conflicts": [
    {
      "operationId": "uuid-2",
      "status": "CONFLICT",
      "reason": "OPTIMISTIC_LOCK_FAILED",
      "serverVersion": 2,
      "serverState": { ... }
    }
  ],
  "failed": [
    {
      "operationId": "uuid-3",
      "error": "VALIDATION_ERROR",
      "message": "Amount exceeds booking total"
    }
  ],
  "nextRetryMs": 5000
}
```

---

### 8. Sync Pull (Download Canonical State)

**Purpose**: Download canonical state for offline operation  
**Method**: `POST /mobile/v1/sync/pull`  
**Auth**: Required

**Request**:
```json
{
  "lastEventId": "...",  // null on first sync
  "entities": ["BOOKING", "ASSIGNMENT", "VEHICLE", "DRIVER"],
  "filters": {
    "bookingStatus": ["confirmed", "assigned", "in_progress"],
    "tenantId": "..."
  }
}
```

**Response (200)**:
```json
{
  "events": [
    {
      "eventId": "evt-001",
      "entityType": "BOOKING",
      "entityId": "bk-123",
      "action": "CREATED" | "UPDATED" | "DELETED",
      "state": {
        "id": "...",
        "customerId": "...",
        "status": "confirmed",
        "pickupTime": "2026-08-15T10:30:00Z"
        // ... full entity state
      },
      "version": 2,
      "timestamp": "2026-08-15T10:35:12Z"
    }
  ],
  "nextEventId": "evt-002",
  "hasMore": true,
  "syncToken": "token-for-next-pull"
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "ERROR_CODE",
  "code": 400,
  "message": "Human-readable error message",
  "details": {
    "field": "phone",
    "reason": "Invalid phone format"
  },
  "requestId": "req-uuid-for-logging"
}
```

### Common Error Codes

| Code | HTTP | Meaning | Action |
|------|------|---------|--------|
| INVALID_INPUT | 400 | Input validation failed | Show error, retry with correction |
| UNAUTHORIZED | 401 | Session expired or invalid | Re-register device |
| FORBIDDEN | 403 | User lacks permission | Show permission error |
| NOT_FOUND | 404 | Resource doesn't exist | Show 404, retry |
| CONFLICT | 409 | Optimistic lock failure | Retry with new base version |
| RATE_LIMITED | 429 | Too many requests | Back off & retry after delay |
| SERVER_ERROR | 500 | Unexpected server error | Retry (exponential backoff) |

---

## Rate Limiting

### Tenant-Level Limits

```
Bookings created:     1000 per hour
Device registrations: 100 per tenant per hour
Customer lookups:     10000 per hour
Sync operations:      unlimited (no rate limit)
```

### User-Level Limits

```
Device registrations: 5 per user per hour
Customer lookups:     100 per user per hour
Booking creations:    100 per user per hour
```

### Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1692082200
```

---

## Idempotency

### Every mutation requires operationId

```
POST /mobile/v1/bookings
{
  "operationId": "uuid-unique-per-device"
  // ... other fields
}
```

### Duplicate handling

- First attempt: Execute, store result in cache
- Duplicate attempt: Return cached result (exact same response)
- No side effects from re-execution

---

## Pagination

### For list endpoints

```
GET /mobile/v1/bookings?limit=20&cursor=...

Response:
{
  "items": [...],
  "nextCursor": "...",
  "hasMore": true,
  "total": 150
}
```

---

## Versioning & Deprecation

### Phase-Out Strategy

1. **Active** — Current version, all new clients use this
2. **Deprecated** — Still supported, warning headers
3. **Sunset** — Removed in next major version
4. **Removed** — Old version no longer supported

### Announcement

```
X-API-Deprecation: true
X-API-Sunset-Date: 2027-01-01
X-API-Documentation: https://docs.fleetpro.dev/v2-migration
```

---

## Testing Checklist

- [ ] Device registration flow (new + returning user)
- [ ] Customer lookup (found, not found, duplicate, blacklisted)
- [ ] Booking creation (valid, invalid, duplicate)
- [ ] Driver assignment (success, timeout)
- [ ] Offline sync (push operations, handle conflicts)
- [ ] Rate limiting (verify limits enforced)
- [ ] Error handling (all error codes tested)
- [ ] Multi-device sessions (independent sessions per device)
- [ ] Backward compatibility (old /api/* routes unchanged)

---

**Document Version**: 1.0  
**Status**: SPECIFICATION COMPLETE  
**Next**: WAVE 3 (Implementation of routes)  
**Last Updated**: 2026-08-12

