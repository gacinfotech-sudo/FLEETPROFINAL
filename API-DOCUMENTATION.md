# FleetPro 360° - Complete API Documentation

## Base URL
```
http://localhost:5050/api
```

## Authentication
All endpoints (except `/csrf-token`) require:
- Valid session (from login)
- CSRF token in `X-CSRF-Token` header

## Response Format
```json
{
  "data": {},
  "status": 200,
  "message": "success"
}
```

---

## WAVE 1: Itinerary & Timeline

### Create Itinerary
```
POST /api/bookings/:bookingId/itinerary
Body: {
  tripStartDate, tripEndDate, dayWisePlan[],
  passengerInstructions, responsibilities,
  driverAllowance, amountToCollect
}
Response: { itineraryId, status: 'Draft' }
```

### Get Itinerary
```
GET /api/bookings/:bookingId/itinerary
Response: Complete itinerary with version history
```

### Approve Itinerary
```
POST /api/bookings/:bookingId/itinerary/approve
Response: { status: 'Approved' }
```

### Get Itinerary Versions
```
GET /api/bookings/:bookingId/itinerary/versions
Response: Array of all previous versions
```

### Get Customer View
```
GET /api/bookings/:bookingId/itinerary/customer-view
Response: Customer-friendly itinerary format
```

### Get Driver View
```
GET /api/bookings/:bookingId/itinerary/driver-view
Response: Driver-friendly itinerary format
```

### Archive Itinerary
```
POST /api/bookings/:bookingId/itinerary/archive
Response: { status: 'Archived' }
```

---

## WAVE 2: Customer 360 & Booking 360

### Get Customer 360
```
GET /api/customers/:customerId/360
Response: {
  customer, bookingHistory, inquiries, leads,
  financial, whatsappStatus, googleReviews,
  preferredRoutes, timeline, alerts
}
```

### Get Booking 360
```
GET /api/bookings/:bookingId/360
Response: {
  booking, vehicle, driver, vendor, itinerary,
  financial, operationalStatus, invoices,
  timeline, actions, alerts
}
```

---

## WAVE 3: Driver 360

### Get Driver 360
```
GET /api/drivers/:driverId/360
Response: {
  driver, availability, currentBooking,
  tripHistory, documents, complianceStatus,
  performance, incidents, alerts
}
```

### Get Driver KPIs
```
GET /api/drivers/:driverId/360/kpis
Response: KPI summary (status, completedTrips, rating)
```

### Get Driver Actions
```
GET /api/drivers/:driverId/360/actions
Response: Array of available quick actions
```

---

## WAVE 4: Vehicle 360

### Get Vehicle 360
```
GET /api/vehicles/:vehicleId/360
Response: {
  vehicle, status, availability, currentBooking,
  totalKilometers, averageRating, financial,
  maintenanceRecords, complianceStatus, alerts
}
```

### Get Vehicle KPIs
```
GET /api/vehicles/:vehicleId/360/kpis
Response: KPI summary
```

### Get Vehicle Actions
```
GET /api/vehicles/:vehicleId/360/actions
Response: Array of available actions
```

---

## WAVE 5: Vendor 360

### Get Vendor 360
```
GET /api/vendors/:vendorId/360
Response: Complete vendor data with performance
```

### Get Vendor KPIs
```
GET /api/vendors/:vendorId/360/kpis
Response: Vendor KPI summary
```

---

## WAVE 6: Expense 360

### Get Expense Analysis
```
GET /api/expenses/360?startDate=&endDate=
Query Params:
  - startDate: YYYY-MM-DD (default: 30 days ago)
  - endDate: YYYY-MM-DD (default: today)

Response: {
  period, revenue, expenses (by category),
  financial (profitability), vehicle-wise breakdown,
  driver-wise breakdown, daily trends, alerts
}
```

---

## WAVE 7: User/RBAC 360

### Get User 360
```
GET /api/users/:userId/360
Response: User profile, role, activity, assignments
```

### Get All Roles
```
GET /api/rbac/roles
Response: Array of all roles with permissions
```

### Get Role Config
```
GET /api/rbac/role/:roleId
Response: Role details and permissions
```

---

## WAVE 8: Invoice 360

### Get Invoice Tracking
```
GET /api/invoices/360?startDate=&endDate=
Query Params:
  - startDate: YYYY-MM-DD
  - endDate: YYYY-MM-DD

Response: {
  invoices[], summary (totals), customer-wise outstanding
}
```

---

## WAVE 10: GPS Unified

### Get GPS Dashboard
```
GET /api/gps/dashboard
Response: {
  activeTrips[], geofences[], alerts[], analytics
}
```

### Get Vehicle Track
```
GET /api/vehicles/:vehicleId/track?hours=24
Query Params:
  - hours: 24|48|72 (default: 24)

Response: Array of GPS coordinates with timestamps
```

---

## WAVE 11: Payment Timeline

### Get Payment Timeline
```
GET /api/payments/timeline?startDate=&endDate=
Response: Payment history with aggregates
```

### Get Customer Payment Status
```
GET /api/customers/:customerId/payments
Response: Customer payment history and outstanding
```

---

## WAVE 12: Unified Search & Analytics

### Search Across All Entities
```
GET /api/search?q=searchquery
Query Params:
  - q: search term (min 2 chars)

Response: {
  customers[], bookings[], drivers[], vehicles[],
  vendors[], invoices[]
}
```

### Get Analytics Dashboard
```
GET /api/analytics/dashboard
Response: {
  summary (total entities),
  performance (completion rate, utilization),
  financials (revenue, expenses, profit)
}
```

---

## Error Responses

### 401 Unauthorized
```json
{ "message": "Unauthorized" }
```

### 400 Bad Request
```json
{ "message": "Invalid parameters" }
```

### 404 Not Found
```json
{ "message": "Resource not found" }
```

### 500 Server Error
```json
{ "message": "Internal server error" }
```

---

## Rate Limits
- Login: 5 attempts / 5 minutes
- General API: 100 requests / minute
- Search: 50 requests / minute

---

## Common Workflows

### 1. Create and manage a booking
```
1. Create itinerary: POST /api/bookings/{id}/itinerary
2. Approve itinerary: POST /api/bookings/{id}/itinerary/approve
3. Get booking 360: GET /api/bookings/{id}/360
4. Record payment: (handled via booking 360 actions)
5. Generate invoice: (via booking 360 actions)
```

### 2. Track a trip in real-time
```
1. Get active bookings: GET /api/bookings/360
2. Get GPS dashboard: GET /api/gps/dashboard
3. Get vehicle track: GET /api/vehicles/{id}/track
4. Monitor driver: GET /api/drivers/{id}/360
```

### 3. Generate financial reports
```
1. Get expense analysis: GET /api/expenses/360
2. Get payment timeline: GET /api/payments/timeline
3. Get analytics: GET /api/analytics/dashboard
```

---

## Support
For API issues, check:
- DEPLOYMENT-MANIFEST.md (full deployment guide)
- GOLDEN-UI-PROTECTION.md (UI protection rules)
- Server logs: /tmp/fleetpro-deployment.log
