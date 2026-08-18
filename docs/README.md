# FleetPro API Documentation

Complete API documentation for FleetPro SaaS Platform with 277+ endpoints.

**Version:** 1.0.0 | **Last Updated:** August 16, 2026

---

## 📚 Documentation Files

### 1. **swagger-ui.html** - Interactive API Explorer
Interactive Swagger UI for exploring and testing all API endpoints.

**Features:**
- Try-it-out functionality to test endpoints directly
- Real-time request/response examples
- Authentication management
- Rate limit information
- Error code reference

**Usage:**
```bash
# Open in browser
open swagger-ui.html

# Or serve with HTTP server
python3 -m http.server 8000
# Then visit http://localhost:8000/swagger-ui.html
```

### 2. **openapi.json** - OpenAPI Specification
Complete OpenAPI 3.0.0 specification for automated tooling integration.

**Features:**
- Standard OpenAPI format
- Compatible with Swagger, ReDoc, Postman
- Full endpoint definitions
- Request/response schemas
- Security schemes

**Usage:**
```bash
# Import into Postman
# File > Import > select openapi.json

# Import into ReDoc
# https://redoc.ly/#/?url=file:///path/to/openapi.json

# Validate OpenAPI spec
npx swagger-cli validate openapi.json
```

### 3. **postman-collection.json** - Postman Collection
Pre-built Postman collection with all API endpoints and example requests.

**Features:**
- 100+ pre-configured requests
- Environment variables for easy setup
- Authentication flow automation
- Request/response examples
- Test scripts

**Usage:**
```bash
# Import into Postman
1. Open Postman
2. File > Import
3. Select postman-collection.json
4. Click Import

# Or use Postman CLI
postman collection run postman-collection.json
```

### 4. **integration-guide.md** - Complete Integration Guide
Comprehensive guide for integrating with FleetPro API.

**Sections:**
- Getting Started
- Authentication (JWT & Session-based)
- API Overview
- Core Resources
- Error Handling
- Rate Limiting
- Webhooks
- Code Examples (JavaScript, Python, cURL)
- Best Practices
- Troubleshooting

**Usage:**
```bash
# View in terminal
less integration-guide.md

# Convert to PDF
pandoc integration-guide.md -o integration-guide.pdf

# View in IDE
code integration-guide.md
```

### 5. **endpoints-reference.md** - Complete Endpoint Reference
Detailed reference for all 277+ API endpoints organized by module.

**Sections:**
- Authentication (5 endpoints)
- Drivers (25+ endpoints)
- Vehicles (18+ endpoints)
- Bookings & Trips (20+ endpoints)
- Analytics & Reports (30+ endpoints)
- Notifications (35+ endpoints)
- Financial Operations (25+ endpoints)
- Safety & Incidents (15+ endpoints)
- Maintenance (12+ endpoints)
- Platform Administration (30+ endpoints)
- Integrations (10+ endpoints)

**Usage:**
- Quick reference for endpoint details
- Request/response examples
- Parameter documentation
- Error code reference

### 6. **swagger-setup.ts** - Swagger Configuration
TypeScript configuration for setting up Swagger/OpenAPI in Express.

**Features:**
- Ready-to-use Swagger setup
- Security scheme configuration
- Custom styling
- Auto-path generation helper
- TypeScript support

**Usage:**
```typescript
import { setupSwagger } from './docs/swagger-setup';

setupSwagger(app, '/api-docs');
```

---

## 🚀 Quick Start

### 1. Access Interactive Documentation

**Option A: Local Swagger UI**
```bash
# Serve documentation locally
cd docs
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/swagger-ui.html
```

**Option B: ReDoc (Alternative UI)**
```bash
# Use ReDoc to view OpenAPI spec
npx redoc-cli serve openapi.json
```

### 2. Import into Postman

```bash
# Open Postman
# File > Import
# Choose postman-collection.json

# Set environment variables:
- base_url: http://localhost:5050/api
- token: [obtained from login]
- tenant_id: [your tenant ID]
```

### 3. Authenticate

**Get JWT Token:**
```bash
curl -X POST http://localhost:5050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fleetpro.com",
    "password": "SecurePassword123!"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": {...},
  "tenant": {...}
}
```

### 4. Make First API Call

**JavaScript:**
```javascript
const response = await fetch('http://localhost:5050/api/drivers', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});
const data = await response.json();
console.log(data);
```

**Python:**
```python
import requests

headers = {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
}
response = requests.get('http://localhost:5050/api/drivers', headers=headers)
print(response.json())
```

**cURL:**
```bash
curl -X GET http://localhost:5050/api/drivers \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 📋 API Overview

### Base URLs

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:5050/api` |
| Staging | `https://staging-api.fleetpro.com/api` |
| Production | `https://api.fleetpro.com/api` |

### Authentication

- **Method:** JWT Bearer Token
- **Header:** `Authorization: Bearer <token>`
- **Token Expiry:** 1 hour
- **Refresh Token Expiry:** 7 days

### Rate Limits

- **Standard:** 1000 requests/hour
- **Login:** 5 attempts/minute
- **File Upload:** 100 MB max
- **Batch Operations:** 1000 items max

### Response Format

```json
{
  "success": true,
  "data": {...},
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

### Error Response

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

---

## 🔐 Authentication Guide

### Step 1: Login

```bash
curl -X POST http://localhost:5050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fleetpro.com",
    "password": "SecurePassword123!"
  }'
```

### Step 2: Use Token

```bash
curl -X GET http://localhost:5050/api/drivers \
  -H "Authorization: Bearer <token_from_login>"
```

### Step 3: Refresh Token (Before Expiry)

```bash
curl -X POST http://localhost:5050/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refresh_token_from_login>"
  }'
```

### Step 4: Logout

```bash
curl -X POST http://localhost:5050/api/auth/logout \
  -H "Authorization: Bearer <token>"
```

---

## 🛠️ Common Use Cases

### Create a Driver

```bash
curl -X POST http://localhost:5050/api/drivers \
  -H "Authorization: Bearer <token>" \
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

### List All Drivers

```bash
curl -X GET "http://localhost:5050/api/drivers?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

### Get Dashboard Analytics

```bash
curl -X GET "http://localhost:5050/api/analytics/dashboard?period=month" \
  -H "Authorization: Bearer <token>"
```

### Send Notification

```bash
curl -X POST http://localhost:5050/api/notifications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Trip Assignment",
    "message": "New trip assigned",
    "recipients": ["driver_id_1"],
    "type": "trip",
    "channels": ["sms", "email", "push"]
  }'
```

---

## 📞 Support & Troubleshooting

### Common Issues

**401 Unauthorized**
- Check token is included in Authorization header
- Verify token hasn't expired
- Use correct token format: `Bearer TOKEN`

**403 Forbidden**
- Check user permissions
- Verify user is assigned to correct role
- Contact admin for permission grant

**429 Too Many Requests**
- Wait before retrying
- Implement exponential backoff
- Check rate limit headers

**500 Server Error**
- Check server logs
- Verify request format
- Contact support with request ID

### Getting Help

- **Documentation:** https://docs.fleetpro.com
- **Email Support:** api-support@fleetpro.com
- **Status Page:** https://status.fleetpro.com
- **Community Forum:** https://community.fleetpro.com

---

## 🔧 Development Setup

### Install Dependencies

```bash
npm install
npm install --save-dev swagger-ui-express swagger-jsdoc
```

### Setup Swagger in Server

```typescript
import { setupSwagger } from './docs/swagger-setup';
import express from 'express';

const app = express();

// ... other middleware

setupSwagger(app, '/api-docs');

app.listen(5050, () => {
  console.log('Server running on :5050');
  console.log('Swagger docs: http://localhost:5050/api-docs');
});
```

### Access Swagger UI

```
http://localhost:5050/api-docs
```

### Export OpenAPI Spec

```bash
# From running server
curl http://localhost:5050/api-docs/openapi.json > docs/openapi.json
```

---

## 📈 Documentation Statistics

| Category | Count |
|----------|-------|
| Total Endpoints | 277+ |
| Authentication Endpoints | 5 |
| Driver Management | 25+ |
| Vehicle Management | 18+ |
| Bookings & Trips | 20+ |
| Analytics & Reports | 30+ |
| Notifications | 35+ |
| Financial Operations | 25+ |
| Safety & Incidents | 15+ |
| Maintenance | 12+ |
| Platform Admin | 30+ |
| Integrations | 10+ |

---

## 📚 Additional Resources

### OpenAPI/Swagger Tools

- **Swagger Editor:** https://editor.swagger.io
- **ReDoc:** https://redoc.ly
- **Postman:** https://www.postman.com
- **Insomnia:** https://insomnia.rest
- **Thunder Client:** https://www.thunderclient.com

### API Best Practices

- **REST API Best Practices:** https://restfulapi.net
- **OpenAPI Specification:** https://spec.openapis.org
- **Authentication:** https://tools.ietf.org/html/rfc7519 (JWT)
- **HTTP Status Codes:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Status

### Code Examples

Full code examples available in `integration-guide.md` for:
- JavaScript/Node.js
- Python
- cURL
- HTTP

---

## 🚀 Next Steps

1. **Read Integration Guide** - Start with `integration-guide.md`
2. **Explore with Swagger UI** - Use `swagger-ui.html` to test endpoints
3. **Import Postman Collection** - Use `postman-collection.json` for manual testing
4. **Check Endpoint Reference** - Reference `endpoints-reference.md` for specific endpoints
5. **Set Up in Your App** - Follow setup instructions for your tech stack

---

## 📝 File Structure

```
docs/
├── README.md                    # This file
├── swagger-ui.html             # Interactive API explorer
├── openapi.json               # OpenAPI 3.0 specification
├── postman-collection.json    # Postman collection
├── integration-guide.md        # Complete integration guide
├── endpoints-reference.md      # All 277+ endpoints reference
└── swagger-setup.ts           # Express Swagger setup
```

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-08-16 | Initial release - 277+ endpoints documented |

---

## 📄 License

Proprietary - FleetPro SaaS Platform
All rights reserved.

---

**Last Updated:** August 16, 2026  
**Documentation Version:** 1.0.0  
**API Version:** 1.0.0

For questions or feedback, contact: api-support@fleetpro.com
