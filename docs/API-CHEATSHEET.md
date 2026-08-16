# FleetPro API - Quick Reference Cheat Sheet

Essential API reference for quick lookup.

---

## 🔐 Authentication

### Login
```bash
POST /auth/login
{
  "email": "user@fleetpro.com",
  "password": "password123",
  "rememberMe": false
}
```
Returns: `token`, `refreshToken`, `user`, `tenant`

### Refresh Token
```bash
POST /auth/refresh
{ "refreshToken": "token" }
```

### Logout
```bash
POST /auth/logout
```

### Get Current User
```bash
GET /auth/me
Authorization: Bearer {token}
```

### Reset Password
```bash
POST /auth/reset-password
{
  "currentPassword": "old",
  "newPassword": "new",
  "confirmPassword": "new"
}
```

---

## 🚗 Drivers (25+ endpoints)

### List Drivers
```bash
GET /drivers?page=1&limit=20&status=active&search=john
```

### Create Driver
```bash
POST /drivers
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "licenseNumber": "DL0123456",
  "dateOfJoining": "2024-01-15",
  "salary": 50000
}
```

### Get Driver
```bash
GET /drivers/{driverId}
```

### Update Driver
```bash
PUT /drivers/{driverId}
{ "name": "Updated Name", "salary": 55000 }
```

### Delete Driver
```bash
DELETE /drivers/{driverId}
```

### Get Driver Trips
```bash
GET /drivers/{driverId}/trips?page=1&limit=20
```

### Get Driver Salary
```bash
GET /drivers/{driverId}/salary
```

### Get Driver Earnings
```bash
GET /drivers/{driverId}/earnings?startDate=2024-01-01&endDate=2024-01-31
```

### Get Driver Analytics
```bash
GET /drivers/{driverId}/analytics?period=month
```

### Record Attendance
```bash
POST /drivers/{driverId}/attendance
{
  "date": "2024-01-15",
  "status": "present",
  "checkInTime": "09:00:00",
  "checkOutTime": "18:00:00"
}
```

### Update Driver Status
```bash
PATCH /drivers/{driverId}/status
{ "status": "active" }
```

### Set Driver PIN
```bash
POST /drivers/{driverId}/set-login-pin
{ "pin": "1234" }
```

---

## 🚙 Vehicles (18+ endpoints)

### List Vehicles
```bash
GET /vehicles?page=1&limit=20&status=active&type=sedan
```

### Create Vehicle
```bash
POST /vehicles
{
  "registrationNumber": "DL01AB1234",
  "model": "Swift",
  "manufacturer": "Maruti",
  "type": "hatchback",
  "capacity": 5,
  "yearOfManufacture": 2023
}
```

### Get Vehicle
```bash
GET /vehicles/{vehicleId}
```

### Update Vehicle
```bash
PUT /vehicles/{vehicleId}
{ "status": "maintenance" }
```

### Delete Vehicle
```bash
DELETE /vehicles/{vehicleId}
```

### Get Vehicle Location
```bash
GET /vehicles/{vehicleId}/location
```

### Get Tracking History
```bash
GET /vehicles/{vehicleId}/tracking-history?startDate=2024-01-01&endDate=2024-01-31
```

### Get Vehicle Mileage
```bash
GET /vehicles/{vehicleId}/mileage
```

### Record Maintenance
```bash
POST /vehicles/{vehicleId}/maintenance
{
  "type": "service",
  "date": "2024-01-15",
  "cost": 5000,
  "description": "Regular service",
  "nextDueDate": "2024-04-15"
}
```

### Get Maintenance History
```bash
GET /vehicles/{vehicleId}/maintenance
```

### Get Vehicle Trips
```bash
GET /vehicles/{vehicleId}/trips
```

### Get Vehicle Analytics
```bash
GET /vehicles/{vehicleId}/analytics
```

---

## 📱 Bookings (20+ endpoints)

### List Bookings
```bash
GET /bookings?page=1&limit=20&status=pending&customerId=cust_id
```

### Create Booking
```bash
POST /bookings
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
  "pickupTime": "2024-01-15T14:00:00Z"
}
```

### Get Booking
```bash
GET /bookings/{bookingId}
```

### Update Booking
```bash
PUT /bookings/{bookingId}
{ "specialRequirements": "AC required" }
```

### Cancel Booking
```bash
DELETE /bookings/{bookingId}
```

### Update Booking Status
```bash
PATCH /bookings/{bookingId}/status
{ "status": "confirmed" }
```

### Assign Driver
```bash
POST /bookings/{bookingId}/assign-driver
{ "driverId": "driver_id" }
```

### Get Booking Trip
```bash
GET /bookings/{bookingId}/trip
```

### List Trips
```bash
GET /trips?page=1&limit=20&status=completed&driverId=driver_id
```

### Get Trip Details
```bash
GET /trips/{tripId}
```

### Start Trip
```bash
POST /trips/{tripId}/start
```

### Complete Trip
```bash
POST /trips/{tripId}/complete
```

### Get Trip Route
```bash
GET /trips/{tripId}/route
```

---

## 📊 Analytics (30+ endpoints)

### Get Dashboard
```bash
GET /analytics/dashboard?period=month
```

### Get Revenue Report
```bash
GET /analytics/revenue?startDate=2024-01-01&endDate=2024-01-31&groupBy=day
```

### Get Performance Metrics
```bash
GET /analytics/performance
```

### Get KPI Tracking
```bash
GET /analytics/kpis
```

### Get Daily Report
```bash
GET /reports/daily
```

### Get Monthly Report
```bash
GET /reports/monthly
```

### Get Vehicle Utilization
```bash
GET /reports/vehicle-utilization
```

### Get Driver Performance
```bash
GET /reports/driver-performance
```

### Get Revenue by Route
```bash
GET /analytics/revenue-by-route
```

### Get Trip Analytics
```bash
GET /analytics/trips
```

### Get Customer Analytics
```bash
GET /analytics/customers
```

### Export Report
```bash
POST /reports/export
{
  "reportType": "revenue",
  "format": "pdf",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

### Get Real-time Metrics
```bash
GET /analytics/realtime
```

### Get Predictive Analytics
```bash
GET /analytics/predictions
```

---

## 🔔 Notifications (35+ endpoints)

### List Notifications
```bash
GET /notifications?page=1&limit=20&type=trip&read=false
```

### Send Notification
```bash
POST /notifications
{
  "title": "Trip Assignment",
  "message": "You have a new trip",
  "recipients": ["driver_id"],
  "type": "trip",
  "channels": ["sms", "email", "push"],
  "priority": "high"
}
```

### Get Notification
```bash
GET /notifications/{notificationId}
```

### Mark as Read
```bash
PATCH /notifications/{notificationId}/read
{ "read": true }
```

### Delete Notification
```bash
DELETE /notifications/{notificationId}
```

### List Templates
```bash
GET /notification-templates
```

### Create Template
```bash
POST /notification-templates
{
  "name": "Trip Assignment",
  "content": "You have a new trip: {tripDetails}",
  "channels": ["sms", "email", "push"]
}
```

### Schedule Notification
```bash
POST /notifications/schedule
{
  "title": "Report Ready",
  "message": "Your monthly report is ready",
  "recipients": ["user_id"],
  "scheduledFor": "2024-02-01T09:00:00Z"
}
```

### Get Notification Preferences
```bash
GET /notifications/preferences
```

### Update Notification Preferences
```bash
PUT /notifications/preferences
{
  "emailNotifications": true,
  "smsNotifications": true,
  "pushNotifications": true
}
```

### Get Notification Analytics
```bash
GET /notifications/analytics
```

### Setup Webhook
```bash
POST /notifications/webhooks
{
  "url": "https://your-domain.com/webhook",
  "events": ["booking.created", "booking.completed"],
  "active": true
}
```

### List Webhooks
```bash
GET /notifications/webhooks
```

### Test Webhook
```bash
POST /notifications/webhooks/{webhookId}/test
```

---

## 💰 Financial (25+ endpoints)

### Get Driver Salary
```bash
GET /salary/{driverId}
```

### Process Payroll
```bash
POST /salary/process
{
  "month": "2024-01",
  "driverIds": ["driver_id_1", "driver_id_2"],
  "processBonus": true
}
```

### Get Salary Details
```bash
GET /salary/{driverId}/details?month=2024-01
```

### List Invoices
```bash
GET /billing/invoices?page=1&limit=20&customerId=cust_id
```

### Create Invoice
```bash
POST /billing/invoices
{
  "customerId": "customer_id",
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "items": [
    {
      "description": "Transportation",
      "quantity": 10,
      "unitPrice": 1000
    }
  ]
}
```

### Get Invoice
```bash
GET /billing/invoices/{invoiceId}
```

### List Payments
```bash
GET /billing/payments?page=1&limit=20
```

### Process Payment
```bash
POST /payments/process
{
  "invoiceId": "invoice_id",
  "amount": 10000,
  "method": "bank_transfer"
}
```

### Get Payment Details
```bash
GET /payments/{paymentId}
```

### Get Financial Reports
```bash
GET /financial/reports
```

### Get GST Report
```bash
GET /financial/gst-report?startDate=2024-01-01&endDate=2024-01-31
```

### Calculate GST
```bash
POST /financial/calculate-gst
{
  "amount": 10000,
  "taxRate": 18
}
```

### Generate Tax Report
```bash
POST /financial/tax-report
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "format": "pdf"
}
```

---

## 🚨 Safety & Incidents (15+ endpoints)

### List Incidents
```bash
GET /incidents?page=1&limit=20&status=open
```

### Create Incident Report
```bash
POST /incidents
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

### Get Incident Details
```bash
GET /incidents/{incidentId}
```

### Update Incident
```bash
PUT /incidents/{incidentId}
{ "status": "investigating" }
```

### Close Incident
```bash
POST /incidents/{incidentId}/close
{ "resolution": "Resolved" }
```

---

## 🔧 Maintenance (12+ endpoints)

### List Maintenance Records
```bash
GET /maintenance?page=1&limit=20&vehicleId=vehicle_id
```

### Create Maintenance Record
```bash
POST /maintenance
{
  "vehicleId": "vehicle_id",
  "type": "service",
  "date": "2024-01-15",
  "cost": 5000,
  "description": "Regular service"
}
```

### Get Maintenance Details
```bash
GET /maintenance/{maintenanceId}
```

### Update Maintenance
```bash
PUT /maintenance/{maintenanceId}
{ "status": "completed" }
```

### Schedule Maintenance
```bash
POST /maintenance/schedule
{
  "vehicleId": "vehicle_id",
  "scheduledDate": "2024-02-15",
  "type": "service"
}
```

---

## 👥 Platform Admin (30+ endpoints)

### List Tenants
```bash
GET /admin/tenants?page=1&limit=20&status=active
```

### Create Tenant
```bash
POST /admin/tenants
{
  "name": "Fleet Company",
  "businessType": "logistics",
  "email": "contact@fleet.com",
  "subscriptionPlan": "professional"
}
```

### Get Tenant
```bash
GET /admin/tenants/{tenantId}
```

### Update Tenant
```bash
PUT /admin/tenants/{tenantId}
{ "subscriptionPlan": "enterprise" }
```

### Delete Tenant
```bash
DELETE /admin/tenants/{tenantId}
```

### Get Admin Dashboard
```bash
GET /admin/dashboard
```

### List Users
```bash
GET /admin/users?page=1&limit=20
```

### Create User
```bash
POST /admin/users
{
  "email": "user@company.com",
  "name": "User Name",
  "role": "manager",
  "tenantId": "tenant_id"
}
```

### Update User
```bash
PUT /admin/users/{userId}
{ "role": "admin" }
```

### Delete User
```bash
DELETE /admin/users/{userId}
```

### Get Security Stats
```bash
GET /admin/security/stats
```

---

## 📤 General Headers

```
Authorization: Bearer {token}
Content-Type: application/json
X-Tenant-ID: {tenant_id}
X-Request-ID: {request_id}
```

---

## 🔄 Common Status Values

**Driver Status:** active, inactive, on-leave, suspended
**Vehicle Status:** active, maintenance, retired
**Booking Status:** pending, confirmed, in-progress, completed, cancelled
**Incident Status:** open, investigating, resolved, closed
**Payment Status:** pending, processing, completed, failed

---

## ⚠️ Error Codes

| Code | Message |
|------|---------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Server Error |

---

## 🔗 Rate Limits

- **Standard:** 1000/hour
- **Login:** 5/minute
- **Batch:** 1000 items max

---

**Last Updated:** August 16, 2026
