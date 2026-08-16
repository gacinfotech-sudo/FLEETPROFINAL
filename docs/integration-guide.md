# FleetPro API Integration Guide

Complete guide for integrating with the FleetPro SaaS Platform API covering 277+ endpoints.

**Version:** 1.0.0 | **Last Updated:** August 16, 2026

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [API Overview](#api-overview)
4. [Core Resources](#core-resources)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Webhooks](#webhooks)
8. [Code Examples](#code-examples)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- FleetPro account with API access enabled
- API key (provided on account dashboard)
- HTTP client library (cURL, requests, axios, etc.)
- Basic understanding of REST APIs

### Base URLs

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:5050/api` |
| Staging | `https://staging-api.fleetpro.com/api` |
| Production | `https://api.fleetpro.com/api` |

### API Version

Current API version: **v1.0**

All endpoints return JSON responses with consistent error handling and status codes.

---

## Authentication

### JWT Bearer Token Authentication

FleetPro API uses JWT (JSON Web Token) Bearer tokens for authentication.

#### Login and Get Token

```bash
curl -X POST http://localhost:5050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fleetpro.com",
    "password": "SecurePassword123!",
    "rememberMe": false
  }'
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MGQ1ZWM0OWMxMjM0NTY3ODkwYWJjIiwiaWF0IjoxNjkyMzQ1NjAwLCJleHAiOjE2OTIzNDkyMDB9.pVeGfEd0B1KNJ7BkGxsJ9m0KxH4pRkLm1vD5nA8bZ2o",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d5ec49c1234567890abc",
    "email": "admin@fleetpro.com",
    "name": "Admin User",
    "role": "admin",
    "permissions": ["all"]
  },
  "tenant": {
    "id": "60d5ec49c1234567890abd",
    "name": "My Fleet Company"
  }
}
```

#### Using the Token

Include the JWT token in the `Authorization` header for all subsequent requests:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Token Refresh

Tokens expire in 1 hour. Use the refresh token to get a new token:

```bash
curl -X POST http://localhost:5050/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

#### Token Expiration

- **Access Token:** 1 hour
- **Refresh Token:** 7 days
- Always refresh tokens before expiry
- Monitor token expiration in your application

### Session-Based Authentication

Alternative to JWT, you can use session-based authentication via cookies. Sessions are created during login and automatically managed.

---

## API Overview

### Supported HTTP Methods

| Method | Purpose |
|--------|---------|
| GET | Retrieve resources |
| POST | Create new resources |
| PUT | Update entire resources |
| PATCH | Partial resource updates |
| DELETE | Delete resources |

### Response Format

All responses are JSON-formatted with the following structure:

```json
{
  "success": true,
  "data": {},
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123abc456def"
  }
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 204 | No Content - Successful with no response body |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing/invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists or conflict |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Maintenance mode |

---

## Core Resources

### Authentication (5+ endpoints)

Manage user authentication and sessions.

**Key Endpoints:**
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user
- `POST /auth/reset-password` - Reset password

### Drivers (20+ endpoints)

Complete driver management system.

**Key Endpoints:**
- `GET /drivers` - List all drivers
- `POST /drivers` - Create new driver
- `GET /drivers/{id}` - Get driver details
- `PUT /drivers/{id}` - Update driver
- `DELETE /drivers/{id}` - Delete driver
- `GET /drivers/{id}/trips` - Get driver trips
- `POST /drivers/{id}/set-login-pin` - Set driver PIN
- `POST /drivers/{id}/attendance` - Record attendance

**Example: Create Driver**

```bash
curl -X POST http://localhost:5050/api/drivers \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "licenseNumber": "DL0123456",
    "dateOfJoining": "2024-01-15",
    "salary": 50000
  }'
```

### Vehicles (15+ endpoints)

Vehicle management and tracking.

**Key Endpoints:**
- `GET /vehicles` - List all vehicles
- `POST /vehicles` - Create vehicle
- `GET /vehicles/{id}` - Get vehicle details
- `PUT /vehicles/{id}` - Update vehicle
- `DELETE /vehicles/{id}` - Delete vehicle
- `GET /vehicles/{id}/location` - Get GPS location
- `POST /vehicles/{id}/maintenance` - Record maintenance
- `GET /vehicles/{id}/mileage` - Get mileage history

### Bookings & Trips (18+ endpoints)

Booking and trip management.

**Key Endpoints:**
- `GET /bookings` - List bookings
- `POST /bookings` - Create booking
- `GET /bookings/{id}` - Get booking details
- `PATCH /bookings/{id}` - Update booking status
- `DELETE /bookings/{id}` - Cancel booking
- `POST /bookings/{id}/assign-driver` - Assign driver
- `PATCH /bookings/{id}/status` - Update status
- `GET /trips` - List trips

### Analytics & Reports (25+ endpoints)

Comprehensive analytics and reporting.

**Key Endpoints:**
- `GET /analytics/dashboard` - Dashboard data
- `GET /analytics/revenue` - Revenue reports
- `GET /analytics/performance` - Performance metrics
- `GET /analytics/kpis` - KPI tracking
- `GET /reports/daily` - Daily reports
- `GET /reports/monthly` - Monthly reports
- `GET /reports/vehicle-utilization` - Vehicle utilization

**Example: Get Dashboard**

```bash
curl -X GET "http://localhost:5050/api/analytics/dashboard?period=month" \
  -H "Authorization: Bearer TOKEN"
```

### Financial (20+ endpoints)

Payroll, billing, and financial operations.

**Key Endpoints:**
- `GET /salary/driver/{id}` - Get driver salary
- `POST /salary/process` - Process payroll
- `GET /billing/invoices` - List invoices
- `POST /billing/invoices` - Create invoice
- `GET /billing/payments` - List payments
- `POST /payments/process` - Process payment
- `GET /financial/reports` - Financial reports

### Notifications (30+ endpoints)

Notification system with multi-channel support.

**Key Endpoints:**
- `GET /notifications` - List notifications
- `POST /notifications` - Send notification
- `GET /notifications/{id}` - Get notification
- `PATCH /notifications/{id}/read` - Mark as read
- `GET /notification-templates` - List templates
- `POST /notification-templates` - Create template
- `POST /notifications/schedule` - Schedule delivery
- `POST /notifications/webhook` - Webhook integration

### Platform Admin (25+ endpoints)

Administrative operations for platform management.

**Key Endpoints:**
- `GET /admin/tenants` - List tenants
- `POST /admin/tenants` - Create tenant
- `PUT /admin/tenants/{id}` - Update tenant
- `DELETE /admin/tenants/{id}` - Delete tenant
- `GET /admin/users` - List users
- `POST /admin/users` - Create user
- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/security/stats` - Security statistics

---

## Error Handling

### Error Response Format

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  },
  "requestId": "req_123abc456def"
}
```

### Common Error Codes

| Error Code | Meaning | Solution |
|-----------|---------|----------|
| `VALIDATION_ERROR` | Request validation failed | Check request parameters |
| `UNAUTHORIZED` | Missing/invalid token | Re-authenticate |
| `FORBIDDEN` | Insufficient permissions | Check user permissions |
| `NOT_FOUND` | Resource doesn't exist | Verify resource ID |
| `DUPLICATE_RESOURCE` | Resource already exists | Use different identifier |
| `RATE_LIMIT_EXCEEDED` | Rate limit hit | Wait before retry |
| `SERVER_ERROR` | Internal server error | Contact support |

### Handling Errors in Code

**JavaScript/Node.js Example:**

```javascript
const response = await fetch('http://localhost:5050/api/drivers', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

if (!response.ok) {
  const error = await response.json();
  console.error(`Error: ${error.code} - ${error.details.message}`);
} else {
  const data = await response.json();
  console.log(data);
}
```

---

## Rate Limiting

### Limits

| Endpoint Type | Limit |
|---------------|-------|
| Standard | 1000 requests/hour |
| Login | 5 attempts/minute |
| File Upload | 100 MB max per file |

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1692345600
X-RateLimit-RetryAfter: 60
```

### Handling Rate Limits

When you receive a 429 status code:

1. Check `X-RateLimit-RetryAfter` header
2. Wait the specified number of seconds
3. Retry the request
4. Implement exponential backoff for retries

---

## Webhooks

### Event Types

Subscribe to real-time events:

- `booking.created` - New booking created
- `booking.updated` - Booking updated
- `booking.completed` - Booking completed
- `driver.trip.started` - Driver started trip
- `driver.trip.completed` - Trip completed
- `vehicle.alert` - Vehicle alert
- `payment.received` - Payment received

### Webhook Registration

```bash
curl -X POST http://localhost:5050/api/webhooks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook",
    "events": ["booking.created", "booking.completed"],
    "active": true
  }'
```

### Webhook Payload

```json
{
  "id": "evt_123abc",
  "type": "booking.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "bookingId": "booking_123",
    "customerId": "customer_123",
    "status": "pending"
  }
}
```

### Webhook Security

- All webhooks are signed with HMAC-SHA256
- Verify signature in `X-Webhook-Signature` header
- Implement webhook retries (3 attempts with exponential backoff)

---

## Code Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class FleetProAPI {
  constructor(baseURL, email, password) {
    this.baseURL = baseURL;
    this.email = email;
    this.password = password;
    this.token = null;
  }

  async authenticate() {
    const response = await axios.post(`${this.baseURL}/auth/login`, {
      email: this.email,
      password: this.password
    });
    this.token = response.data.token;
  }

  async getDrivers(page = 1, limit = 20) {
    const response = await axios.get(`${this.baseURL}/drivers`, {
      params: { page, limit },
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.data;
  }

  async createDriver(driverData) {
    const response = await axios.post(`${this.baseURL}/drivers`, driverData, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.data;
  }

  async getDashboard(period = 'month') {
    const response = await axios.get(`${this.baseURL}/analytics/dashboard`, {
      params: { period },
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.data;
  }
}

// Usage
const api = new FleetProAPI('http://localhost:5050/api', 'admin@fleetpro.com', 'password');
await api.authenticate();
const drivers = await api.getDrivers(1, 20);
console.log(drivers);
```

### Python

```python
import requests
from datetime import datetime, timedelta

class FleetProAPI:
    def __init__(self, base_url, email, password):
        self.base_url = base_url
        self.email = email
        self.password = password
        self.token = None
        self.token_expires_at = None

    def authenticate(self):
        response = requests.post(f'{self.base_url}/auth/login', json={
            'email': self.email,
            'password': self.password
        })
        response.raise_for_status()
        data = response.json()
        self.token = data['token']
        self.token_expires_at = datetime.now() + timedelta(hours=1)

    def get_headers(self):
        return {'Authorization': f'Bearer {self.token}'}

    def get_drivers(self, page=1, limit=20):
        response = requests.get(f'{self.base_url}/drivers',
                              params={'page': page, 'limit': limit},
                              headers=self.get_headers())
        response.raise_for_status()
        return response.json()

    def create_driver(self, driver_data):
        response = requests.post(f'{self.base_url}/drivers',
                                json=driver_data,
                                headers=self.get_headers())
        response.raise_for_status()
        return response.json()

# Usage
api = FleetProAPI('http://localhost:5050/api', 'admin@fleetpro.com', 'password')
api.authenticate()
drivers = api.get_drivers()
print(drivers)
```

### cURL

```bash
#!/bin/bash

BASE_URL="http://localhost:5050/api"
EMAIL="admin@fleetpro.com"
PASSWORD="SecurePassword123!"

# Step 1: Login and get token
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.token')

echo "Token: $TOKEN"

# Step 2: Get drivers list
curl -s -X GET "$BASE_URL/drivers" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Step 3: Create a new driver
curl -s -X POST "$BASE_URL/drivers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "licenseNumber": "DL0123456",
    "salary": 50000
  }' | jq '.'
```

---

## Best Practices

### 1. API Key Management

- Store API keys securely (use environment variables)
- Rotate keys regularly
- Use different keys for different environments
- Never commit keys to version control

```bash
# Good
export FLEETPRO_API_KEY="key_xxx_yyy_zzz"
curl -H "Authorization: Bearer $FLEETPRO_API_KEY" ...

# Bad
curl -H "Authorization: Bearer key_xxx_yyy_zzz" ...  # Visible in history
```

### 2. Error Handling

- Always check response status codes
- Implement proper error handling for all API calls
- Log errors for debugging
- Implement retry logic with exponential backoff

```javascript
async function makeRequest(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
      if (response.status === 429) {
        const retryAfter = response.headers.get('X-RateLimit-RetryAfter');
        await sleep(retryAfter * 1000);
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

### 3. Pagination

- Always use pagination for list endpoints
- Default limit is 20, max is 100
- Handle pagination cursors for large datasets

```javascript
async function getAllDrivers() {
  let page = 1;
  let hasMore = true;
  const allDrivers = [];

  while (hasMore) {
    const response = await api.getDrivers(page, 20);
    allDrivers.push(...response.data);
    hasMore = page < response.pagination.pages;
    page++;
  }

  return allDrivers;
}
```

### 4. Token Refresh

- Implement automatic token refresh before expiry
- Cache tokens in memory/secure storage
- Handle token expiration gracefully

```javascript
class TokenManager {
  constructor(refreshToken) {
    this.refreshToken = refreshToken;
    this.token = null;
    this.expiresAt = null;
  }

  async getValidToken() {
    if (!this.token || this.isExpired()) {
      await this.refresh();
    }
    return this.token;
  }

  isExpired() {
    return Date.now() > this.expiresAt - 60000; // Refresh 1 min before expiry
  }

  async refresh() {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });
    const data = await response.json();
    this.token = data.token;
    this.expiresAt = Date.now() + 3600000; // 1 hour
  }
}
```

### 5. Testing

- Test all endpoints before production
- Use Postman collection for manual testing
- Implement automated API tests
- Test error scenarios

```javascript
describe('Driver API', () => {
  it('should create a driver', async () => {
    const driver = await api.createDriver({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+919876543210',
      licenseNumber: 'DL0123456'
    });

    expect(driver.id).toBeDefined();
    expect(driver.name).toBe('John Doe');
  });

  it('should handle invalid email', async () => {
    try {
      await api.createDriver({
        name: 'John',
        email: 'invalid-email'
      });
      fail('Should have thrown error');
    } catch (error) {
      expect(error.code).toBe('VALIDATION_ERROR');
    }
  });
});
```

---

## Troubleshooting

### Common Issues

#### 1. 401 Unauthorized

**Problem:** Getting 401 even with valid token

**Solutions:**
- Check token format (must be `Bearer TOKEN`)
- Verify token hasn't expired
- Check Authorization header spelling
- Ensure token is being sent in all protected requests

#### 2. 403 Forbidden

**Problem:** Have valid token but getting 403

**Solutions:**
- Check user permissions
- Verify user is assigned to correct role
- Check tenant access
- Contact admin for permission grant

#### 3. 429 Rate Limit

**Problem:** Getting rate limit errors

**Solutions:**
- Implement request queuing
- Reduce request frequency
- Use batch endpoints where available
- Implement exponential backoff
- Contact support for rate limit increase

#### 4. 500 Server Error

**Problem:** Internal server error

**Solutions:**
- Check server status page
- Wait a few seconds and retry
- Verify request format
- Contact support with request ID

#### 5. Connection Timeout

**Problem:** Connection takes too long

**Solutions:**
- Check internet connection
- Verify API base URL
- Check for network issues
- Try different endpoint
- Implement request timeout and retry

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
const api = new FleetProAPI(baseURL, email, password);
api.debug = true; // Logs all requests/responses
```

### Support

- Email: api-support@fleetpro.com
- Documentation: https://docs.fleetpro.com
- Status Page: https://status.fleetpro.com
- Community: https://community.fleetpro.com

---

## Changelog

### Version 1.0.0 (August 16, 2026)

- Initial release
- 277+ endpoints documented
- JWT authentication
- Webhook support
- Comprehensive error handling
- Multi-environment support

---

**Last Updated:** August 16, 2026  
**API Version:** 1.0.0  
**Status:** Production Ready
