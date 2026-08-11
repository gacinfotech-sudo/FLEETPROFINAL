# FleetPro Complete API Documentation

**Version:** 2.0  
**Last Updated:** 2026-08-12  
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Booking API](#booking-api)
4. [Notification API](#notification-api)
5. [Driver API](#driver-api)
6. [Fleet API](#fleet-api)
7. [Admin API](#admin-api)
8. [Health & Status API](#health--status-api)

---

## Overview

### Base URLs

```
Production:  https://api.fleetpro.example.com
Staging:     https://staging-api.fleetpro.example.com
Development: http://localhost:5050
```

### Rate Limiting

```
Default: 1,000 requests/hour per API key
Peak: 10,000 requests/hour for verified users
Burst: 100 requests/minute

Response Headers:
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1629139200
```

### Response Format

All endpoints return JSON with consistent structure:

```json
{
  "success": true,
  "data": {...},
  "error": null,
  "meta": {
    "timestamp": "2026-08-12T12:34:56Z",
    "version": "2.0"
  }
}
```

Error response:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid booking date",
    "details": {
      "field": "pickup_date",
      "reason": "Must be in future"
    }
  },
  "meta": {
    "timestamp": "2026-08-12T12:34:56Z",
    "version": "2.0"
  }
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200  | OK - Request succeeded |
| 201  | Created - Resource created |
| 400  | Bad Request - Invalid parameters |
| 401  | Unauthorized - Missing/invalid auth |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource not found |
| 409  | Conflict - Resource already exists |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Server Error - Internal error |
| 503  | Service Unavailable - Maintenance |

---

## Authentication

### API Key Authentication

```bash
# Include API key in header
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.fleetpro.example.com/api/bookings

# Or as query parameter (less secure)
curl https://api.fleetpro.example.com/api/bookings?api_key=YOUR_API_KEY
```

### JWT Bearer Token

```bash
# Login to get token
curl -X POST https://api.fleetpro.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password",
    "two_factor_code": "123456"
  }'

# Response
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "expires_in": 86400,
    "refresh_token": "refresh_..."
  }
}

# Use token in subsequent requests
curl -H "Authorization: Bearer eyJhbGc..." \
  https://api.fleetpro.example.com/api/bookings
```

### OAuth 2.0

```bash
# For third-party integrations

# 1. Redirect user to authorization endpoint
https://api.fleetpro.example.com/oauth/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://app.example.com/callback&
  scope=bookings:read+bookings:create&
  state=random_state

# 2. Exchange code for token
curl -X POST https://api.fleetpro.example.com/oauth/token \
  -d "grant_type=authorization_code&
      code=AUTH_CODE&
      client_id=YOUR_CLIENT_ID&
      client_secret=YOUR_CLIENT_SECRET&
      redirect_uri=https://app.example.com/callback"

# 3. Use access token
curl -H "Authorization: Bearer access_token" \
  https://api.fleetpro.example.com/api/bookings
```

---

## Booking API

### Create Booking

**POST** `/api/bookings`

Creates a new vehicle booking.

**Request:**
```json
{
  "vehicle_id": "veh_123456",
  "customer_id": "cust_789012",
  "pickup_date": "2026-08-20",
  "pickup_time": "09:00",
  "dropoff_date": "2026-08-23",
  "dropoff_time": "18:00",
  "pickup_location": "Airport Terminal 1",
  "dropoff_location": "Downtown Hotel",
  "vehicle_type": "sedan",
  "num_passengers": 2,
  "special_requirements": "Need child seat",
  "price_override": null,
  "promocode": "SUMMER20"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "book_123456",
    "status": "confirmed",
    "vehicle_id": "veh_123456",
    "customer_id": "cust_789012",
    "pickup_date": "2026-08-20",
    "pickup_time": "09:00",
    "dropoff_date": "2026-08-23",
    "dropoff_time": "18:00",
    "duration_days": 3,
    "base_price": 450.00,
    "discount": 45.00,
    "tax": 40.95,
    "total_price": 445.95,
    "confirmation_code": "FP2026ABC123",
    "created_at": "2026-08-12T12:34:56Z",
    "updated_at": "2026-08-12T12:34:56Z"
  }
}
```

**Error Responses:**
```json
// Invalid date (past date)
{
  "success": false,
  "error": {
    "code": "INVALID_DATE",
    "message": "Pickup date must be in the future",
    "details": {"field": "pickup_date"}
  }
}

// Vehicle not available
{
  "success": false,
  "error": {
    "code": "VEHICLE_NOT_AVAILABLE",
    "message": "Vehicle not available for selected dates",
    "details": {"available_from": "2026-08-24"}
  }
}

// Invalid promo code
{
  "success": false,
  "error": {
    "code": "INVALID_PROMOCODE",
    "message": "Promo code not found or expired"
  }
}
```

### Get Booking

**GET** `/api/bookings/:id`

Retrieves booking details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "book_123456",
    "status": "confirmed",
    "customer": {
      "id": "cust_789012",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    "vehicle": {
      "id": "veh_123456",
      "registration": "ABC123DE",
      "make": "Toyota",
      "model": "Camry",
      "year": 2023,
      "color": "Silver"
    },
    "booking_details": {
      "pickup_date": "2026-08-20",
      "pickup_time": "09:00",
      "pickup_location": "Airport Terminal 1",
      "dropoff_date": "2026-08-23",
      "dropoff_time": "18:00",
      "dropoff_location": "Downtown Hotel"
    },
    "pricing": {
      "base_price": 450.00,
      "discount": 45.00,
      "tax": 40.95,
      "total_price": 445.95
    },
    "status_history": [
      {
        "status": "confirmed",
        "timestamp": "2026-08-12T12:34:56Z",
        "notes": "Booking confirmed"
      }
    ]
  }
}
```

### List Bookings

**GET** `/api/bookings`

List bookings with filters.

**Query Parameters:**
```
?status=confirmed,pending
&start_date=2026-08-01
&end_date=2026-08-31
&customer_id=cust_789012
&vehicle_id=veh_123456
&page=1
&per_page=50
&sort=-created_at
```

**Response:**
```json
{
  "success": true,
  "data": [
    {"id": "book_123456", "status": "confirmed", ...},
    {"id": "book_789012", "status": "pending", ...}
  ],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 250,
    "pages": 5
  }
}
```

### Update Booking

**PUT** `/api/bookings/:id`

Update booking details (if allowed).

**Request:**
```json
{
  "status": "confirmed",
  "pickup_time": "10:00",
  "special_requirements": "Updated: Need wheelchair access"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "book_123456",
    "status": "confirmed",
    "updated_at": "2026-08-12T13:00:00Z",
    "changes": {
      "pickup_time": {"old": "09:00", "new": "10:00"}
    }
  }
}
```

### Cancel Booking

**POST** `/api/bookings/:id/cancel`

Cancel a booking.

**Request:**
```json
{
  "reason": "Customer requested cancellation",
  "refund_amount": 445.95
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "book_123456",
    "status": "cancelled",
    "cancelled_at": "2026-08-12T13:05:00Z",
    "refund": {
      "amount": 445.95,
      "method": "original_payment",
      "status": "pending",
      "expected_date": "2026-08-14"
    }
  }
}
```

### Process Payment

**POST** `/api/bookings/:id/payment`

Process payment for booking.

**Request:**
```json
{
  "payment_method": "credit_card",
  "card_token": "tok_visa",
  "amount": 445.95,
  "currency": "USD"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": "book_123456",
    "payment_id": "pay_123456",
    "status": "completed",
    "amount": 445.95,
    "currency": "USD",
    "method": "credit_card",
    "transaction_id": "txn_123456",
    "timestamp": "2026-08-12T12:40:00Z"
  }
}
```

---

## Notification API

### Send Notification

**POST** `/api/notifications/send`

Send notification to customer.

**Request:**
```json
{
  "recipient_id": "cust_789012",
  "channels": ["email", "sms", "push"],
  "template": "booking_confirmation",
  "variables": {
    "booking_id": "book_123456",
    "vehicle_make": "Toyota",
    "vehicle_model": "Camry",
    "pickup_date": "2026-08-20"
  },
  "priority": "high",
  "schedule": "immediate"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notification_id": "notif_123456",
    "recipient_id": "cust_789012",
    "channels": [
      {
        "channel": "email",
        "status": "sent",
        "timestamp": "2026-08-12T12:34:56Z"
      },
      {
        "channel": "sms",
        "status": "sent",
        "timestamp": "2026-08-12T12:34:57Z"
      },
      {
        "channel": "push",
        "status": "pending",
        "timestamp": "2026-08-12T12:34:58Z"
      }
    ]
  }
}
```

### Get Notification History

**GET** `/api/notifications/history`

Retrieve notification history for customer.

**Query Parameters:**
```
?customer_id=cust_789012
&start_date=2026-08-01
&end_date=2026-08-31
&channel=email
&page=1
&per_page=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "notif_123456",
      "template": "booking_confirmation",
      "channel": "email",
      "status": "sent",
      "sent_at": "2026-08-12T12:34:56Z",
      "opened_at": "2026-08-12T12:45:00Z",
      "clicked_at": null
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 125
  }
}
```

### Update Notification Preferences

**PUT** `/api/notifications/preferences`

Update customer notification preferences.

**Request:**
```json
{
  "customer_id": "cust_789012",
  "preferences": {
    "booking_confirmation": {
      "email": true,
      "sms": true,
      "push": false
    },
    "booking_reminder": {
      "email": true,
      "sms": false,
      "push": true,
      "hours_before": 24
    },
    "promotional": {
      "email": true,
      "sms": false,
      "push": false
    },
    "quiet_hours": {
      "enabled": true,
      "start_time": "22:00",
      "end_time": "08:00",
      "timezone": "America/New_York"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customer_id": "cust_789012",
    "preferences": {...},
    "updated_at": "2026-08-12T13:00:00Z"
  }
}
```

### Get Notification Templates

**GET** `/api/notifications/templates`

List available notification templates.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "booking_confirmation",
      "name": "Booking Confirmation",
      "description": "Sent when booking is confirmed",
      "variables": [
        "booking_id",
        "vehicle_make",
        "vehicle_model",
        "pickup_date",
        "total_price"
      ],
      "channels": ["email", "sms", "push"]
    },
    {
      "id": "booking_reminder",
      "name": "Booking Reminder",
      "description": "Reminder before pickup",
      "variables": ["booking_id", "pickup_time", "pickup_location"],
      "channels": ["email", "sms", "push"]
    }
  ]
}
```

---

## Driver API

### List Drivers

**GET** `/api/drivers`

List available drivers.

**Query Parameters:**
```
?status=active
&vehicle_id=veh_123456
&city=New York
&availability=2026-08-20
&page=1
&per_page=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "drv_123456",
      "name": "John Smith",
      "phone": "+1234567890",
      "email": "john@example.com",
      "status": "active",
      "rating": 4.8,
      "reviews_count": 156,
      "assigned_vehicle": "veh_123456",
      "hours_today": 8,
      "max_hours_today": 10,
      "current_location": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "address": "Times Square, NYC"
      }
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 1250
  }
}
```

### Get Driver Details

**GET** `/api/drivers/:id`

Get driver profile and details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "drv_123456",
    "profile": {
      "name": "John Smith",
      "phone": "+1234567890",
      "email": "john@example.com",
      "photo_url": "https://...",
      "license_number": "ABC123456",
      "license_expiry": "2027-12-31"
    },
    "statistics": {
      "total_trips": 1500,
      "average_rating": 4.8,
      "reviews_count": 156,
      "acceptance_rate": 98.5,
      "cancellation_rate": 1.2
    },
    "availability": {
      "status": "active",
      "hours_today": 8,
      "max_hours_today": 10,
      "break_time": "13:00-14:00"
    }
  }
}
```

### Update Driver Location

**POST** `/api/drivers/:id/location`

Update driver's current location (typically from mobile app).

**Request:**
```json
{
  "latitude": 40.7580,
  "longitude": -73.9855,
  "accuracy": 10,
  "timestamp": "2026-08-12T12:34:56Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "driver_id": "drv_123456",
    "location": {
      "latitude": 40.7580,
      "longitude": -73.9855,
      "accuracy": 10,
      "address": "Central Park, NYC"
    },
    "updated_at": "2026-08-12T12:34:56Z"
  }
}
```

---

## Fleet API

### List Vehicles

**GET** `/api/fleet`

List all vehicles in fleet.

**Query Parameters:**
```
?status=active
?vehicle_type=sedan
?availability=2026-08-20
?sort=-created_at
?page=1
?per_page=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "veh_123456",
      "registration": "ABC123DE",
      "make": "Toyota",
      "model": "Camry",
      "year": 2023,
      "status": "active",
      "mileage": 15000,
      "color": "Silver",
      "seats": 5,
      "type": "sedan",
      "current_location": "Garage A",
      "assigned_driver": "drv_123456",
      "availability": [
        {"date": "2026-08-13", "available": false},
        {"date": "2026-08-14", "available": true},
        {"date": "2026-08-15", "available": true}
      ]
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 250
  }
}
```

### Get Vehicle Details

**GET** `/api/fleet/:id`

Get vehicle details and maintenance status.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "veh_123456",
    "basic_info": {
      "registration": "ABC123DE",
      "make": "Toyota",
      "model": "Camry",
      "year": 2023,
      "vin": "JTDJ4AE29J0123456"
    },
    "status": {
      "status": "active",
      "mileage": 15000,
      "fuel_level": 85,
      "last_service": "2026-07-01",
      "next_service": "2026-09-01"
    },
    "maintenance": [
      {
        "type": "Oil Change",
        "date": "2026-07-01",
        "cost": 150.00,
        "status": "completed"
      },
      {
        "type": "Tire Rotation",
        "date": "2026-09-01",
        "cost": 100.00,
        "status": "scheduled"
      }
    ],
    "documents": {
      "registration": {
        "document_type": "RC",
        "number": "ABC123DE",
        "expiry_date": "2027-12-31",
        "status": "valid"
      },
      "insurance": {
        "document_type": "Insurance",
        "number": "INS123456",
        "expiry_date": "2026-12-31",
        "status": "valid"
      }
    }
  }
}
```

### Get Vehicle Maintenance

**GET** `/api/fleet/:id/maintenance`

Get maintenance history and schedule.

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicle_id": "veh_123456",
    "past_maintenance": [
      {
        "date": "2026-07-01",
        "type": "Oil Change",
        "cost": 150.00,
        "notes": "Regular maintenance",
        "status": "completed"
      }
    ],
    "upcoming_maintenance": [
      {
        "date": "2026-09-01",
        "type": "Tire Rotation",
        "cost": 100.00,
        "priority": "normal"
      },
      {
        "date": "2026-12-31",
        "type": "Annual Inspection",
        "cost": 500.00,
        "priority": "high"
      }
    ]
  }
}
```

---

## Admin API

### Get Users

**GET** `/api/admin/users`

List all system users.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "usr_123456",
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "admin",
      "status": "active",
      "created_at": "2026-01-01T00:00:00Z",
      "last_login": "2026-08-12T12:00:00Z"
    }
  ]
}
```

### Get Reports

**GET** `/api/admin/reports`

Retrieve system reports.

**Query Parameters:**
```
?report_type=revenue,usage,performance
&start_date=2026-08-01
&end_date=2026-08-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "revenue": {
      "total": 45000,
      "by_vehicle_type": {...},
      "by_customer_segment": {...}
    },
    "usage": {
      "total_bookings": 1250,
      "active_customers": 450,
      "vehicles_in_use": 150
    }
  }
}
```

### Get Audit Logs

**POST** `/api/admin/audit`

Query audit logs.

**Request:**
```json
{
  "action": "CREATE",
  "resource_type": "BOOKING",
  "user_id": "usr_123456",
  "start_date": "2026-08-01",
  "end_date": "2026-08-31",
  "page": 1,
  "per_page": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "audit_123456",
      "action": "CREATE",
      "resource_type": "BOOKING",
      "resource_id": "book_123456",
      "user_id": "usr_789012",
      "user_email": "admin@example.com",
      "timestamp": "2026-08-12T12:34:56Z",
      "details": {
        "customer_id": "cust_789012",
        "vehicle_id": "veh_123456"
      }
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 15000
  }
}
```

---

## Health & Status API

### Health Check

**GET** `/health`

Basic health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-08-12T12:34:56Z",
  "uptime_seconds": 864000
}
```

### Detailed Health Check

**GET** `/health/detailed`

Comprehensive system health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-08-12T12:34:56Z",
  "services": {
    "database": {
      "status": "healthy",
      "response_time_ms": 25,
      "connections": {
        "active": 45,
        "available": 55,
        "total": 100
      }
    },
    "cache": {
      "status": "healthy",
      "response_time_ms": 2,
      "memory_mb": 256
    },
    "notifications": {
      "status": "healthy",
      "queue_depth": 342,
      "delivery_rate": 0.95
    },
    "storage": {
      "status": "healthy",
      "disk_usage_percent": 45,
      "available_gb": 150
    }
  }
}
```

### Metrics

**GET** `/metrics`

Prometheus metrics endpoint.

**Response:**
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{endpoint="/api/bookings",method="GET"} 50000
http_requests_total{endpoint="/api/bookings",method="POST"} 15000

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{endpoint="/api/bookings",le="0.1"} 40000
http_request_duration_seconds_bucket{endpoint="/api/bookings",le="0.5"} 49500
http_request_duration_seconds_bucket{endpoint="/api/bookings",le="1"} 49900
http_request_duration_seconds_bucket{endpoint="/api/bookings",le="+Inf"} 50000
http_request_duration_seconds_sum{endpoint="/api/bookings"} 12500
http_request_duration_seconds_count{endpoint="/api/bookings"} 50000
```

---

## Error Codes Reference

| Code | HTTP | Description | Cause |
|------|------|-------------|-------|
| INVALID_REQUEST | 400 | Invalid request parameters | Missing or invalid fields |
| UNAUTHORIZED | 401 | Missing or invalid authentication | No token or expired token |
| FORBIDDEN | 403 | Insufficient permissions | User lacks required role |
| NOT_FOUND | 404 | Resource not found | ID doesn't exist |
| CONFLICT | 409 | Resource already exists | Duplicate creation |
| RATE_LIMITED | 429 | Too many requests | Rate limit exceeded |
| SERVER_ERROR | 500 | Internal server error | Unexpected error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable | Maintenance mode |

---

*Last Updated: 2026-08-12 by Operations Team*  
*Next Review: 2026-09-12*  
*Status: ACTIVE AND ENFORCED*
