# FleetPro API - Complete Endpoint Reference

Comprehensive reference for all 277+ API endpoints organized by module.

**Version:** 1.0.0 | **Total Endpoints:** 277+

---

## API Endpoint Categories

- [Authentication](#authentication) (5 endpoints)
- [Drivers](#drivers) (25+ endpoints)
- [Vehicles](#vehicles) (18+ endpoints)
- [Bookings & Trips](#bookings--trips) (20+ endpoints)
- [Analytics & Reports](#analytics--reports) (30+ endpoints)
- [Notifications](#notifications) (35+ endpoints)
- [Financial Operations](#financial-operations) (25+ endpoints)
- [Safety & Incidents](#safety--incidents) (15+ endpoints)
- [Maintenance](#maintenance) (12+ endpoints)
- [Platform Administration](#platform-administration) (30+ endpoints)
- [Integrations](#integrations) (10+ endpoints)

---

## Authentication

User login, session management, and token operations.

### Login

```
POST /auth/login
```

**Description:** Authenticate user with email and password

**Request Body:**
```json
{
  "email": "user@fleetpro.com",
  "password": "SecurePassword123!",
  "rememberMe": false
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...},
  "tenant": {...}
}
```

**Status Codes:**
- 200: Login successful
- 401: Invalid credentials
- 429: Too many attempts

---

### Refresh Token

```
POST /auth/refresh
```

**Description:** Get new JWT token using refresh token

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "token": "new_jwt_token",
  "refreshToken": "new_refresh_token"
}
```

---

### Logout

```
POST /auth/logout
```

**Description:** Invalidate current session and token

**Authentication:** Required (Bearer Token)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Get Current User

```
GET /auth/me
```

**Description:** Retrieve authenticated user profile

**Authentication:** Required

**Response (200):**
```json
{
  "id": "user_id",
  "email": "user@fleetpro.com",
  "name": "User Name",
  "role": "admin",
  "tenantId": "tenant_id",
  "permissions": [...],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

### Reset Password

```
POST /auth/reset-password
```

**Description:** Change user password

**Authentication:** Required

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

---

## Drivers

Complete driver management system with 25+ endpoints.

### List All Drivers

```
GET /drivers
```

**Parameters:**
- `page` (query, integer, default: 1)
- `limit` (query, integer, default: 20, max: 100)
- `status` (query, string): active, inactive, on-leave, suspended
- `search` (query, string): Search by name or email

**Response (200):**
```json
{
  "data": [
    {
      "id": "driver_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210",
      "licenseNumber": "DL0123456",
      "status": "active",
      "dateOfJoining": "2024-01-15",
      "salary": 50000,
      "totalTrips": 150,
      "rating": 4.8,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

### Create Driver

```
POST /drivers
```

**Authentication:** Required

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "licenseNumber": "DL0123456",
  "dateOfJoining": "2024-01-15",
  "salary": 50000,
  "documents": {
    "license": "url_to_license",
    "aadhar": "url_to_aadhar",
    "police_clearance": "url_to_clearance"
  }
}
```

**Response (201):**
```json
{
  "id": "driver_id",
  "name": "John Doe",
  ...
}
```

---

### Get Driver Details

```
GET /drivers/{driverId}
```

**Parameters:**
- `driverId` (path, string, required)

**Response (200):** Driver object with full details

---

### Update Driver

```
PUT /drivers/{driverId}
```

**Parameters:**
- `driverId` (path, string, required)

**Request Body:** Partial driver object

**Response (200):** Updated driver object

---

### Delete Driver

```
DELETE /drivers/{driverId}
```

**Response (204):** No content

---

### Get Driver Trips

```
GET /drivers/{driverId}/trips
```

**Parameters:**
- `driverId` (path, string)
- `page` (query, integer)
- `limit` (query, integer)
- `status` (query, string)
- `startDate` (query, date)
- `endDate` (query, date)

**Response (200):** List of trips with pagination

---

### Get Driver Analytics

```
GET /drivers/{driverId}/analytics
```

**Parameters:**
- `driverId` (path, string)
- `period` (query, string): day, week, month, year

**Response (200):**
```json
{
  "totalTrips": 150,
  "totalDistance": 15000,
  "totalEarnings": 75000,
  "averageRating": 4.8,
  "onTimePercentage": 95,
  "safetyScore": 92
}
```

---

### Set Driver PIN

```
POST /drivers/{driverId}/set-login-pin
```

**Request Body:**
```json
{
  "pin": "1234"
}
```

---

### Get Driver Salary

```
GET /drivers/{driverId}/salary
```

**Response (200):**
```json
{
  "driverId": "driver_id",
  "salary": 50000,
  "bonuses": 5000,
  "deductions": 2000,
  "month": "2024-01",
  "status": "paid"
}
```

---

### Record Driver Attendance

```
POST /drivers/{driverId}/attendance
```

**Request Body:**
```json
{
  "date": "2024-01-15",
  "status": "present",
  "checkInTime": "09:00:00",
  "checkOutTime": "18:00:00"
}
```

---

### Get Driver Attendance

```
GET /drivers/{driverId}/attendance
```

**Parameters:**
- `startDate` (query, date)
- `endDate` (query, date)

---

### Update Driver Status

```
PATCH /drivers/{driverId}/status
```

**Request Body:**
```json
{
  "status": "active"
}
```

---

### Get Driver Document

```
GET /drivers/{driverId}/documents/{documentType}
```

---

### Upload Driver Document

```
POST /drivers/{driverId}/documents
```

**Content-Type:** multipart/form-data

---

### Get Driver Earnings

```
GET /drivers/{driverId}/earnings
```

**Parameters:**
- `startDate` (query, date)
- `endDate` (query, date)

---

### Driver Portal - Get My Info

```
GET /driver-portal/me
```

**Authentication:** Driver bearer token

---

### Driver Portal - Get My Trips

```
GET /driver-portal/my-trips
```

---

### Driver Portal - Accept Trip

```
POST /driver-portal/trips/{tripId}/accept
```

---

### Driver Portal - Start Trip

```
POST /driver-portal/trips/{tripId}/start
```

---

### Driver Portal - Complete Trip

```
POST /driver-portal/trips/{tripId}/complete
```

---

## Vehicles

Vehicle management and tracking with 18+ endpoints.

### List All Vehicles

```
GET /vehicles
```

**Parameters:**
- `page` (query, integer)
- `limit` (query, integer)
- `status` (query, string): active, maintenance, retired
- `type` (query, string): sedan, suv, truck, van

**Response (200):** Paginated list of vehicles

---

### Create Vehicle

```
POST /vehicles
```

**Request Body:**
```json
{
  "registrationNumber": "DL01AB1234",
  "model": "Swift",
  "manufacturer": "Maruti",
  "type": "hatchback",
  "capacity": 5,
  "yearOfManufacture": 2023,
  "purchasePrice": 800000
}
```

---

### Get Vehicle Details

```
GET /vehicles/{vehicleId}
```

---

### Update Vehicle

```
PUT /vehicles/{vehicleId}
```

---

### Delete Vehicle

```
DELETE /vehicles/{vehicleId}
```

---

### Get Vehicle Location

```
GET /vehicles/{vehicleId}/location
```

**Response (200):**
```json
{
  "latitude": 28.7041,
  "longitude": 77.1025,
  "speed": 45,
  "heading": 180,
  "timestamp": "2024-01-15T10:30:00Z",
  "address": "Address string"
}
```

---

### Get Vehicle Tracking History

```
GET /vehicles/{vehicleId}/tracking-history
```

**Parameters:**
- `startDate` (query, date)
- `endDate` (query, date)
- `limit` (query, integer)

---

### Get Vehicle Mileage

```
GET /vehicles/{vehicleId}/mileage
```

---

### Record Vehicle Maintenance

```
POST /vehicles/{vehicleId}/maintenance
```

**Request Body:**
```json
{
  "type": "service",
  "date": "2024-01-15",
  "cost": 5000,
  "description": "Regular service",
  "nextDueDate": "2024-04-15"
}
```

---

### Get Vehicle Maintenance History

```
GET /vehicles/{vehicleId}/maintenance
```

---

### Get Vehicle Trips

```
GET /vehicles/{vehicleId}/trips
```

---

### Get Vehicle Analytics

```
GET /vehicles/{vehicleId}/analytics
```

---

## Bookings & Trips

Booking and trip management with 20+ endpoints.

### List Bookings

```
GET /bookings
```

**Parameters:**
- `page` (query, integer)
- `limit` (query, integer)
- `status` (query, string): pending, confirmed, in-progress, completed, cancelled
- `customerId` (query, string)
- `startDate` (query, date)
- `endDate` (query, date)

---

### Create Booking

```
POST /bookings
```

**Request Body:**
```json
{
  "customerId": "customer_id",
  "pickupLocation": {
    "latitude": 28.7041,
    "longitude": 77.1025,
    "address": "Pickup address"
  },
  "dropLocation": {
    "latitude": 28.5355,
    "longitude": 77.3910,
    "address": "Drop address"
  },
  "vehicleType": "sedan",
  "passengers": 4,
  "pickupTime": "2024-01-15T14:00:00Z",
  "specialRequirements": "AC required"
}
```

---

### Get Booking Details

```
GET /bookings/{bookingId}
```

---

### Update Booking

```
PUT /bookings/{bookingId}
```

---

### Cancel Booking

```
DELETE /bookings/{bookingId}
```

---

### Update Booking Status

```
PATCH /bookings/{bookingId}/status
```

**Request Body:**
```json
{
  "status": "confirmed"
}
```

---

### Assign Driver to Booking

```
POST /bookings/{bookingId}/assign-driver
```

**Request Body:**
```json
{
  "driverId": "driver_id"
}
```

---

### Get Booking Trip

```
GET /bookings/{bookingId}/trip
```

---

### List Trips

```
GET /trips
```

**Parameters:**
- `page` (query, integer)
- `limit` (query, integer)
- `status` (query, string)
- `driverId` (query, string)

---

### Get Trip Details

```
GET /trips/{tripId}
```

---

### Start Trip

```
POST /trips/{tripId}/start
```

---

### Complete Trip

```
POST /trips/{tripId}/complete
```

---

### Get Trip Route

```
GET /trips/{tripId}/route
```

---

### Update Trip Status

```
PATCH /trips/{tripId}/status
```

---

## Analytics & Reports

Comprehensive analytics with 30+ endpoints.

### Get Dashboard

```
GET /analytics/dashboard
```

**Parameters:**
- `period` (query, string): today, week, month, quarter, year

**Response (200):**
```json
{
  "summary": {
    "totalTrips": 1500,
    "totalRevenue": 750000,
    "activeDrivers": 50,
    "fleetUtilization": 85.5
  },
  "charts": {...}
}
```

---

### Get Revenue Report

```
GET /analytics/revenue
```

**Parameters:**
- `startDate` (query, date)
- `endDate` (query, date)
- `groupBy` (query, string): day, week, month

---

### Get Performance Metrics

```
GET /analytics/performance
```

---

### Get KPI Tracking

```
GET /analytics/kpis
```

---

### Get Daily Report

```
GET /reports/daily
```

---

### Get Monthly Report

```
GET /reports/monthly
```

---

### Get Vehicle Utilization

```
GET /reports/vehicle-utilization
```

---

### Get Driver Performance

```
GET /reports/driver-performance
```

---

### Get Revenue by Route

```
GET /analytics/revenue-by-route
```

---

### Get Trip Analytics

```
GET /analytics/trips
```

---

### Get Customer Analytics

```
GET /analytics/customers
```

---

### Export Report

```
POST /reports/export
```

**Request Body:**
```json
{
  "reportType": "revenue",
  "format": "pdf",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

---

### Get Real-time Metrics

```
GET /analytics/realtime
```

---

### Get Predictive Analytics

```
GET /analytics/predictions
```

---

### And 15+ more analytics endpoints...

---

## Notifications

Multi-channel notification system with 35+ endpoints.

### List Notifications

```
GET /notifications
```

**Parameters:**
- `page` (query, integer)
- `limit` (query, integer)
- `type` (query, string)
- `read` (query, boolean)

---

### Send Notification

```
POST /notifications
```

**Request Body:**
```json
{
  "title": "New Trip Assignment",
  "message": "You have a new trip",
  "recipients": ["driver_id_1", "driver_id_2"],
  "type": "trip",
  "channels": ["sms", "email", "push"],
  "priority": "high"
}
```

---

### Get Notification

```
GET /notifications/{notificationId}
```

---

### Mark as Read

```
PATCH /notifications/{notificationId}/read
```

---

### Delete Notification

```
DELETE /notifications/{notificationId}
```

---

### List Notification Templates

```
GET /notification-templates
```

---

### Create Notification Template

```
POST /notification-templates
```

---

### Schedule Notification

```
POST /notifications/schedule
```

**Request Body:**
```json
{
  "title": "Monthly Report",
  "message": "Your monthly report is ready",
  "recipients": ["user_id"],
  "scheduledFor": "2024-02-01T09:00:00Z"
}
```

---

### Get Notification Preferences

```
GET /notifications/preferences
```

---

### Update Notification Preferences

```
PUT /notifications/preferences
```

---

### Get Notification Analytics

```
GET /notifications/analytics
```

---

### Setup Webhook

```
POST /notifications/webhooks
```

---

### List Webhooks

```
GET /notifications/webhooks
```

---

### Test Webhook

```
POST /notifications/webhooks/{webhookId}/test
```

---

### And 15+ more notification endpoints...

---

## Financial Operations

Payroll, billing, and financial management with 25+ endpoints.

### Get Driver Salary

```
GET /salary/{driverId}
```

---

### Process Payroll

```
POST /salary/process
```

**Request Body:**
```json
{
  "month": "2024-01",
  "driverIds": ["driver_id_1", "driver_id_2"],
  "processBonus": true,
  "processDeductions": true
}
```

---

### Get Salary Details

```
GET /salary/{driverId}/details
```

---

### List Invoices

```
GET /billing/invoices
```

---

### Create Invoice

```
POST /billing/invoices
```

**Request Body:**
```json
{
  "customerId": "customer_id",
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "items": [
    {
      "description": "Service 1",
      "quantity": 1,
      "unitPrice": 1000
    }
  ]
}
```

---

### Get Invoice

```
GET /billing/invoices/{invoiceId}
```

---

### List Payments

```
GET /billing/payments
```

---

### Process Payment

```
POST /payments/process
```

---

### Get Payment Details

```
GET /payments/{paymentId}
```

---

### Get Financial Reports

```
GET /financial/reports
```

---

### Get GST Report

```
GET /financial/gst-report
```

---

### Calculate GST

```
POST /financial/calculate-gst
```

---

### Generate Tax Report

```
POST /financial/tax-report
```

---

### And 6+ more financial endpoints...

---

## Safety & Incidents

Safety incident management with 15+ endpoints.

### List Incidents

```
GET /incidents
```

---

### Create Incident Report

```
POST /incidents
```

**Request Body:**
```json
{
  "driverId": "driver_id",
  "vehicleId": "vehicle_id",
  "type": "accident",
  "severity": "high",
  "location": {"latitude": 28.7041, "longitude": 77.1025},
  "description": "Minor collision",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Get Incident Details

```
GET /incidents/{incidentId}
```

---

### Update Incident

```
PUT /incidents/{incidentId}
```

---

### Close Incident

```
POST /incidents/{incidentId}/close
```

---

### And 10+ more safety endpoints...

---

## Maintenance

Vehicle maintenance management with 12+ endpoints.

### List Maintenance Records

```
GET /maintenance
```

---

### Create Maintenance Record

```
POST /maintenance
```

---

### Get Maintenance Details

```
GET /maintenance/{maintenanceId}
```

---

### Update Maintenance

```
PUT /maintenance/{maintenanceId}
```

---

### Schedule Maintenance

```
POST /maintenance/schedule
```

---

### And 7+ more maintenance endpoints...

---

## Platform Administration

Admin operations with 30+ endpoints.

### List Tenants

```
GET /admin/tenants
```

**Parameters:**
- `page` (query, integer)
- `limit` (query, integer)
- `status` (query, string)

---

### Create Tenant

```
POST /admin/tenants
```

---

### Get Tenant

```
GET /admin/tenants/{tenantId}
```

---

### Update Tenant

```
PUT /admin/tenants/{tenantId}
```

---

### Delete Tenant

```
DELETE /admin/tenants/{tenantId}
```

---

### Get Admin Dashboard

```
GET /admin/dashboard
```

---

### List Users

```
GET /admin/users
```

---

### Create User

```
POST /admin/users
```

---

### Update User

```
PUT /admin/users/{userId}
```

---

### Delete User

```
DELETE /admin/users/{userId}
```

---

### Get Security Stats

```
GET /admin/security/stats
```

---

### And 19+ more admin endpoints...

---

## Integrations

Third-party integrations with 10+ endpoints.

### List Integrations

```
GET /integrations
```

---

### Connect Integration

```
POST /integrations/{providerId}/connect
```

---

### Get Integration Status

```
GET /integrations/{integrationId}/status
```

---

### Disconnect Integration

```
DELETE /integrations/{integrationId}
```

---

### And 6+ more integration endpoints...

---

## Error Codes Reference

| Code | Message | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request format and parameters |
| 401 | Unauthorized | Provide valid authentication token |
| 403 | Forbidden | Check user permissions |
| 404 | Not Found | Verify resource ID exists |
| 409 | Conflict | Resource already exists |
| 422 | Validation Error | Check field values match schema |
| 429 | Rate Limited | Wait before retry |
| 500 | Server Error | Contact support |

---

## Rate Limits

- **Standard:** 1000 requests/hour
- **Login:** 5 attempts/minute
- **File Upload:** 100 MB max
- **Batch Operations:** 1000 items max

---

**Last Updated:** August 16, 2026  
**Version:** 1.0.0  
**Status:** Complete Documentation
