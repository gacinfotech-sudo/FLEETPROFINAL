# FleetPro API Documentation

## Base URL
```
https://localhost:5051/api
```

## Authentication

All endpoints (except login) require Bearer token authentication:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

## Authentication Endpoints

### Login
```http
POST /platform/auth/login
Content-Type: application/json

{
  "email": "root@fleetpro.local",
  "password": "password"
}

Response:
{
  "token": "eyJhbGc...",
  "user": {
    "id": "user_id",
    "userId": "root_qa_test",
    "role": "admin",
    "platformRole": "PLATFORM_ROOT"
  }
}
```

### Get Current User
```http
GET /auth/me
Authorization: Bearer {token}

Response:
{
  "user": {
    "id": "user_id",
    "userId": "root_qa_test",
    "role": "admin",
    "platformRole": "PLATFORM_ROOT",
    "tenantId": null,
    "isActive": true
  }
}
```

### Logout
```http
POST /auth/logout
Authorization: Bearer {token}

Response:
{
  "message": "Logged out successfully"
}
```

---

## Vehicle Management Endpoints

### List Vehicles
```http
GET /vehicles
Authorization: Bearer {token}
Query Parameters: page=1, limit=50, status=available

Response:
[
  {
    "id": "vehicle_id",
    "licensePlate": "DL01AB0001",
    "model": "Innova",
    "color": "White",
    "capacity": 7,
    "fuelType": "Diesel",
    "mileage": 15000,
    "status": "available"
  }
]
```

### Create Vehicle
```http
POST /vehicles
Authorization: Bearer {token}
Content-Type: application/json

{
  "licensePlate": "DL01AB0001",
  "model": "Innova",
  "color": "White",
  "capacity": 7,
  "fuelType": "Diesel",
  "mileage": 15000
}

Response:
{
  "id": "vehicle_id",
  "message": "Vehicle created"
}
```

### Get Vehicle Details
```http
GET /vehicles/{vehicleId}
Authorization: Bearer {token}
```

### Update Vehicle
```http
PUT /vehicles/{vehicleId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "mileage": 16000,
  "status": "maintenance"
}
```

### Delete Vehicle
```http
DELETE /vehicles/{vehicleId}
Authorization: Bearer {token}
```

---

## Driver Management Endpoints

### List Drivers
```http
GET /drivers
Authorization: Bearer {token}
Query Parameters: page=1, limit=50, status=active

Response:
[
  {
    "id": "driver_id",
    "name": "Rajesh Kumar",
    "phone": "+919876543210",
    "licenseNo": "DL0120170001",
    "status": "active",
    "experience": 5,
    "rating": 4.8
  }
]
```

### Create Driver
```http
POST /drivers
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Rajesh Kumar",
  "phone": "+919876543210",
  "licenseNo": "DL0120170001",
  "experience": 5
}

Response:
{
  "id": "driver_id",
  "message": "Driver created"
}
```

### Get Driver Details
```http
GET /drivers/{driverId}
Authorization: Bearer {token}
```

### Update Driver
```http
PUT /drivers/{driverId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "rating": 4.9,
  "status": "active"
}
```

---

## Booking Management Endpoints

### List Bookings
```http
GET /bookings
Authorization: Bearer {token}
Query Parameters: page=1, limit=50, status=pending

Response:
[
  {
    "id": "booking_id",
    "customerId": "customer_id",
    "vehicleId": "vehicle_id",
    "driverId": "driver_id",
    "pickupLocation": "Delhi",
    "dropoffLocation": "Gurugram",
    "bookingDate": "2026-08-16",
    "fare": 2500,
    "status": "pending"
  }
]
```

### Create Booking
```http
POST /bookings
Authorization: Bearer {token}
Content-Type: application/json

{
  "customerId": "customer_id",
  "vehicleId": "vehicle_id",
  "driverId": "driver_id",
  "pickupLocation": "Delhi",
  "dropoffLocation": "Gurugram",
  "bookingDate": "2026-08-16",
  "fare": 2500
}

Response:
{
  "id": "booking_id",
  "message": "Booking created"
}
```

### Get Booking Details
```http
GET /bookings/{bookingId}
Authorization: Bearer {token}
```

### Update Booking Status
```http
PUT /bookings/{bookingId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "confirmed"
}
```

### Cancel Booking
```http
DELETE /bookings/{bookingId}
Authorization: Bearer {token}
```

---

## Dashboard Endpoints

### Dashboard Overview
```http
GET /dashboard/overview
Authorization: Bearer {token}

Response:
{
  "periodDays": 30,
  "kpis": {
    "revenue": {
      "allTime": 0,
      "period": 0,
      "completedTrips": 0
    },
    "bookings": {
      "total": 0,
      "active": 0,
      "pipeline": 0
    },
    "vehicles": {
      "total": 3,
      "available": 2,
      "onTrip": 1
    },
    "drivers": {
      "total": 3,
      "available": 2,
      "onDuty": 1
    }
  }
}
```

### Upcoming Bookings
```http
GET /dashboard/upcoming-bookings
Authorization: Bearer {token}

Response: [array of upcoming bookings]
```

### Daily Summary
```http
GET /operations/daily-summary
Authorization: Bearer {token}

Response:
{
  "date": "2026-08-16",
  "totalBookings": 10,
  "completedBookings": 8,
  "cancelledBookings": 1,
  "revenue": 25000,
  "avgRating": 4.7
}
```

---

## Operations Endpoints

### Live Bookings
```http
GET /operations/live-bookings
Authorization: Bearer {token}

Response: [array of active bookings]
```

### Alerts
```http
GET /operations/alerts?status=open
Authorization: Bearer {token}

Response: [array of open alerts]
```

### Alert Details
```http
GET /operations/alerts/{alertId}
Authorization: Bearer {token}
```

---

## Reports Endpoints

### Revenue Report
```http
GET /reports/revenue?startDate=2026-08-01&endDate=2026-08-31
Authorization: Bearer {token}

Response:
{
  "startDate": "2026-08-01",
  "endDate": "2026-08-31",
  "totalRevenue": 250000,
  "avgPerBooking": 2500,
  "totalBookings": 100
}
```

### Driver Performance Report
```http
GET /reports/driver-performance?driverId={driverId}&days=30
Authorization: Bearer {token}

Response:
{
  "driverId": "driver_id",
  "totalTrips": 50,
  "totalEarnings": 125000,
  "avgRating": 4.8,
  "completionRate": 98.5
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "status": 400
}
```

### Common Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests (Rate Limited)
- `500` - Internal Server Error

---

## Rate Limiting

API rate limits: **10 requests per minute per IP**

Rate limit headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1629129600
```

---

## Pagination

All list endpoints support pagination:

```http
GET /vehicles?page=1&limit=50

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 200,
    "pages": 4
  }
}
```

---

## Filtering & Sorting

### Filtering
```http
GET /bookings?status=pending&vehicleId=123
```

### Sorting
```http
GET /drivers?sort=name&order=asc
GET /bookings?sort=createdAt&order=desc
```

---

## Testing the API

### Using cURL
```bash
# Login
TOKEN=$(curl -s -X POST https://localhost:5051/api/platform/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"root@fleetpro.local","password":"password"}' | jq -r '.token')

# Get vehicles
curl -s -H "Authorization: Bearer $TOKEN" \
  https://localhost:5051/api/vehicles | jq '.'
```

### Using Postman
1. Create a new request
2. Set `Authorization` header: `Bearer YOUR_TOKEN`
3. Import the collection from OpenAPI spec (if available)

---

## API Versioning

Current API Version: **1.0**

Future versions will be available at `/api/v2/`, etc.

---

## Support

For API issues:
1. Check error message and status code
2. Verify token is valid
3. Check rate limit status
4. Review logs for more details
5. Contact support team

---

**API Documentation Last Updated:** 2026-08-16  
**API Version:** 1.0.0  
**Status:** Production Ready
