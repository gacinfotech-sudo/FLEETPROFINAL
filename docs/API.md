# FleetPro Fleet Compliance API Documentation

## Base URL

```
Production: https://api.fleetpro.example.com
Staging: https://staging-api.fleetpro.example.com
Local: http://localhost:3000
```

## Authentication

All API endpoints require authentication via JWT Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.fleetpro.example.com/vehicles/123/documents
```

## Response Format

All endpoints return JSON with this structure:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2026-08-11T10:30:00Z"
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "error": "Error message",
  "timestamp": "2026-08-11T10:30:00Z"
}
```

## Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid token
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Document Management Endpoints

### Create Document

**POST** `/vehicles/{vehicleId}/documents`

Create a new vehicle document.

**Request:**
```json
{
  "documentType": "RC",
  "documentNumber": "RC001",
  "issueDate": "2024-01-01",
  "validFrom": "2024-01-01",
  "expiryDate": "2026-12-31",
  "issuingAuthority": "RTO",
  "fileReference": "s3://bucket/rc001.pdf",
  "remarks": "Original document"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "doc_1691757600000_abc123",
    "vehicleId": "vehicle-001",
    "documentType": "RC",
    "documentNumber": "RC001",
    "status": "valid",
    "daysUntilExpiry": 700,
    "verificationStatus": "pending",
    "createdAt": "2026-08-11T10:30:00Z"
  }
}
```

**Status Code:** `201 Created`

---

### Get Vehicle Documents

**GET** `/vehicles/{vehicleId}/documents`

Get all documents for a vehicle.

**Query Parameters:**
- `limit` (optional): Results per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_1691757600000_abc123",
      "vehicleId": "vehicle-001",
      "documentType": "RC",
      "status": "valid",
      "daysUntilExpiry": 700,
      "expiryDate": "2026-12-31"
    }
  ],
  "count": 1
}
```

**Status Code:** `200 OK`

---

### Get Document

**GET** `/documents/{documentId}`

Get a specific document by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "doc_1691757600000_abc123",
    "vehicleId": "vehicle-001",
    "documentType": "RC",
    "documentNumber": "RC001",
    "status": "valid",
    "verificationStatus": "verified",
    "verifiedBy": "user-001",
    "verifiedAt": "2026-08-11T10:35:00Z"
  }
}
```

**Status Code:** `200 OK`

---

### Update Document

**PUT** `/documents/{documentId}`

Update document details.

**Request:**
```json
{
  "expiryDate": "2027-12-31",
  "remarks": "Renewed document",
  "verificationStatus": "verified"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "doc_1691757600000_abc123",
    "status": "valid",
    "daysUntilExpiry": 1400,
    "updatedAt": "2026-08-11T10:40:00Z"
  }
}
```

**Status Code:** `200 OK`

---

### Verify Document

**POST** `/documents/{documentId}/verify`

Mark a document as verified.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "doc_1691757600000_abc123",
    "verificationStatus": "verified",
    "verifiedAt": "2026-08-11T10:45:00Z"
  }
}
```

**Status Code:** `200 OK`

---

### Renew Document

**POST** `/documents/{documentId}/renew`

Complete document renewal (archive old, create new).

**Request:**
```json
{
  "documentNumber": "RC002",
  "issueDate": "2026-01-01",
  "validFrom": "2026-01-01",
  "expiryDate": "2028-12-31",
  "issuingAuthority": "RTO"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "oldDocument": {
      "id": "doc_1691757600000_abc123",
      "isActive": false
    },
    "newDocument": {
      "id": "doc_1691757800000_xyz789",
      "status": "valid",
      "daysUntilExpiry": 1095
    }
  }
}
```

**Status Code:** `200 OK`

---

## Compliance Checking Endpoints

### Get Vehicle Compliance

**GET** `/vehicles/{vehicleId}/compliance`

Get compliance score and summary for a vehicle.

**Response:**
```json
{
  "success": true,
  "data": {
    "score": {
      "vehicleId": "vehicle-001",
      "overallStatus": "ROAD_READY",
      "compliancePercentage": 100,
      "validDocuments": 5,
      "expiringDocuments": 0,
      "criticalDocuments": 0,
      "expiredDocuments": 0
    },
    "summary": {
      "licensePlate": "MH09AB1234",
      "overallStatus": "ROAD_READY",
      "compliancePercentage": 100,
      "documents": [
        {
          "documentType": "RC",
          "status": "valid",
          "daysRemaining": 700,
          "actions": ["View"]
        }
      ]
    }
  }
}
```

**Status Code:** `200 OK`

---

### Validate Booking Compliance

**POST** `/bookings/{bookingId}/vehicle/validate`

Validate if a vehicle is compliant for booking allocation.

**Request:**
```json
{
  "vehicleId": "vehicle-001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicleId": "vehicle-001",
    "bookingId": "booking-001",
    "isCompliant": true,
    "mode": "HARD_BLOCK",
    "issues": [],
    "isBlocked": false,
    "requiresApproval": false
  }
}
```

**Status Code:** `200 OK`

**Non-Compliant Response:**
```json
{
  "success": true,
  "data": {
    "vehicleId": "vehicle-001",
    "bookingId": "booking-001",
    "isCompliant": false,
    "mode": "HARD_BLOCK",
    "issues": [
      {
        "documentType": "RC",
        "status": "EXPIRED",
        "severity": "critical",
        "message": "RC expired on Aug 1, 2026"
      }
    ],
    "isBlocked": true,
    "requiresApproval": false
  }
}
```

**Status Code:** `200 OK`

---

### Check Trip Risk

**POST** `/trips/{tripId}/vehicle/risk-check`

Check if vehicle documents are valid for trip dates.

**Request:**
```json
{
  "vehicleId": "vehicle-001",
  "tripStartDate": "2026-08-15",
  "tripEndDate": "2026-08-20"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicleId": "vehicle-001",
    "tripId": "trip-001",
    "riskLevel": "safe",
    "risks": [],
    "recommendedAction": "Trip is safe to proceed"
  }
}
```

**Risk Response:**
```json
{
  "success": true,
  "data": {
    "vehicleId": "vehicle-001",
    "tripId": "trip-001",
    "riskLevel": "critical",
    "risks": [
      {
        "documentType": "RC",
        "expiryDate": "2026-08-18",
        "expiresBeforeTripEnd": true,
        "message": "RC expires in 2 days during trip"
      }
    ],
    "recommendedAction": "Urgent: Renew documents before trip"
  }
}
```

**Status Code:** `200 OK`

---

## Alert Management Endpoints

### Get Vehicle Alerts

**GET** `/vehicles/{vehicleId}/alerts`

Get all active alerts for a vehicle.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert_001",
      "vehicleId": "vehicle-001",
      "documentType": "RC",
      "severity": "CRITICAL",
      "daysUntilExpiry": 2,
      "expiryDate": "2026-08-13",
      "isActive": true,
      "acknowledgedAt": null
    }
  ],
  "count": 1
}
```

**Status Code:** `200 OK`

---

### Get Critical Alerts

**GET** `/alerts/critical`

Get all critical alerts for tenant.

**Query Parameters:**
- `vehicleId` (optional): Filter by vehicle
- `limit` (optional): Results limit (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert_001",
      "vehicleId": "vehicle-001",
      "licensePlate": "MH09AB1234",
      "documentType": "RC",
      "severity": "CRITICAL",
      "daysUntilExpiry": 0,
      "expiryDate": "2026-08-11"
    }
  ],
  "count": 1
}
```

**Status Code:** `200 OK`

---

### Acknowledge Alert

**POST** `/alerts/{alertId}/acknowledge`

Mark an alert as acknowledged.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "alert_001",
    "acknowledgedAt": "2026-08-11T10:50:00Z"
  }
}
```

**Status Code:** `200 OK`

---

### Get Compliance Dashboard

**GET** `/fleet/compliance-dashboard`

Get aggregated compliance data for entire fleet.

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": {
      "total": 150,
      "valid": 140,
      "expiringIn30Days": 8,
      "expiringIn7Days": 2,
      "critical": 1,
      "expired": 0
    },
    "alerts": {
      "total": 15,
      "info": 2,
      "warning": 5,
      "high": 6,
      "critical": 2,
      "criticalAlertCount": 2
    },
    "vehicleReadiness": {
      "roadReady": 40,
      "attentionRequired": 8,
      "notRoadReady": 1
    }
  }
}
```

**Status Code:** `200 OK`

---

## Health Check Endpoints

### Liveness Check

**GET** `/health`

Basic health check.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-08-11T10:55:00Z",
  "uptime": 3600
}
```

**Status Code:** `200 OK`

---

### Readiness Check

**GET** `/ready`

Check database connectivity.

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2026-08-11T10:55:00Z",
  "database": "connected",
  "repositories": {
    "vehicleDocument": true,
    "documentAlert": true,
    "documentHistory": true,
    "complianceConfig": true,
    "documentTypeMaster": true
  }
}
```

**Status Code:** `200 OK`

**Not Ready Response:**
```json
{
  "status": "not_ready",
  "timestamp": "2026-08-11T10:55:00Z",
  "database": "disconnected"
}
```

**Status Code:** `503 Service Unavailable`

---

### Metrics

**GET** `/metrics`

System performance metrics.

**Response:**
```json
{
  "timestamp": "2026-08-11T10:55:00Z",
  "uptime": 3600,
  "memory": {
    "heapUsed": 128,
    "heapTotal": 256,
    "external": 4,
    "rss": 320
  },
  "cpu": {
    "user": 500000,
    "system": 100000
  }
}
```

**Status Code:** `200 OK`

---

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": "Missing required fields: documentType, documentNumber, issueDate, validFrom, expiryDate",
  "timestamp": "2026-08-11T10:55:00Z"
}
```

---

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Unauthorized",
  "timestamp": "2026-08-11T10:55:00Z"
}
```

---

### 404 Not Found

```json
{
  "success": false,
  "error": "Document not found",
  "timestamp": "2026-08-11T10:55:00Z"
}
```

---

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to create document",
  "timestamp": "2026-08-11T10:55:00Z"
}
```

---

## Rate Limiting

- 1000 requests per hour per API key
- Rate limit headers included in responses:
  - `X-RateLimit-Limit: 1000`
  - `X-RateLimit-Remaining: 950`
  - `X-RateLimit-Reset: 1691760000`

---

## Webhooks (Coming Soon)

Subscribe to events:
- `document.created`
- `document.renewed`
- `alert.critical`
- `vehicle.compliance_changed`

---

## SDKs

- JavaScript/TypeScript: `npm install fleetpro-sdk`
- Python: `pip install fleetpro-sdk`
- Go: `go get github.com/fleetpro/sdk-go`

---

**API Version:** 1.0.0  
**Last Updated:** 2026-08-11  
**Status:** Production Ready ✅
