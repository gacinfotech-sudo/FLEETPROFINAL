# Webhook Management System - Complete Guide

## Overview

The Webhook Management System is an enterprise-grade webhook handling platform for FleetPro with:
- **HMAC-SHA256 signature verification** for security
- **Exponential backoff retry logic** with configurable policies
- **Dead letter queue** for failed deliveries
- **Real-time delivery tracking** and statistics
- **Comprehensive debugging tools** for troubleshooting
- **Event replay capability** for missed deliveries
- **Professional UI** for webhook management

## Features

### 1. Webhook Management
- ✅ Create, read, update, delete webhooks
- ✅ Subscribe to multiple event types
- ✅ Custom HTTP headers support
- ✅ Enable/disable webhooks dynamically
- ✅ Webhook statistics and performance metrics

### 2. Delivery Reliability
- ✅ HMAC-SHA256 signature verification
- ✅ Exponential backoff retry (5 retries, 1s → 1hr)
- ✅ Configurable timeout (default 30s)
- ✅ Dead letter queue for max retries exceeded
- ✅ Per-webhook rate limiting (optional)

### 3. Event Tracking
- ✅ Full delivery history with timestamps
- ✅ Event status tracking (pending, delivered, failed, retried, discarded)
- ✅ Response codes and error messages
- ✅ Response time measurements
- ✅ 30-day event retention (configurable TTL)

### 4. Debugging & Diagnostics
- ✅ Request/response logging
- ✅ DNS resolution diagnostics
- ✅ TLS/SSL certificate validation
- ✅ Timing breakdown (DNS, TLS, TTFB, download)
- ✅ Payload inspection and validation
- ✅ Test payload generator

### 5. Event Replay
- ✅ Replay individual failed events
- ✅ Batch replay from dead letter queue
- ✅ Event filtering and search
- ✅ Audit trail for all operations

## Architecture

### Components

```
server/integrations/webhooks/
├── WebhookManager.ts          (450+ lines) - Core webhook management
├── WebhookStorage.ts          (350+ lines) - MongoDB storage layer
├── WebhookDebugger.ts         (300+ lines) - Diagnostics & logging
├── routes.ts                  (350+ lines) - API endpoints
├── models.ts                  (100+ lines) - Type definitions
└── index.ts                   (50+ lines)  - Main export

client/src/pages/
└── webhook-management.tsx     (900+ lines) - React UI
```

### Data Flow

```
Event Triggered
    ↓
WebhookManager.deliverWebhook()
    ↓
    ├─→ Generate HMAC-SHA256 signature
    ├─→ POST to webhook URL (30s timeout)
    └─→ Store delivery log
        ↓
        ├─→ Success (2xx) → Log & emit event
        └─→ Failure (3xx, 4xx, 5xx) or Error
            ↓
            Schedule Retry
                ↓
                Calculate Exponential Backoff
                    ↓
                    Attempt 1: 1s + jitter
                    Attempt 2: 2s + jitter
                    Attempt 3: 4s + jitter
                    Attempt 4: 8s + jitter
                    Attempt 5: 16s + jitter
                    ↓
                Max Retries Exceeded
                    ↓
                Move to Dead Letter Queue
                    ↓
                Emit 'delivery:deadletter' event
```

## API Endpoints

### Webhook CRUD

#### Create Webhook
```bash
POST /api/webhooks
Content-Type: application/json

{
  "name": "My Webhook",
  "url": "https://example.com/webhooks/bookings",
  "events": ["booking.created", "booking.completed"],
  "secret": "whsec_xxxxx",
  "description": "Optional description"
}

Response:
{
  "webhook": {
    "_id": "wh_xxxxx",
    "name": "My Webhook",
    "url": "https://example.com/webhooks/bookings",
    "events": ["booking.created", "booking.completed"],
    "isActive": true,
    "stats": {
      "totalDeliveries": 0,
      "successfulDeliveries": 0,
      "failedDeliveries": 0,
      "averageResponseTime": 0
    },
    "createdAt": "2026-08-12T10:30:00Z"
  }
}
```

#### List Webhooks
```bash
GET /api/webhooks

Response:
{
  "webhooks": [...],
  "total": 5
}
```

#### Get Webhook Details
```bash
GET /api/webhooks/:webhookId

Response:
{
  "webhook": {...},
  "stats": {
    "webhookId": "wh_xxxxx",
    "activeRetries": 2,
    "deadLetterCount": 1,
    "timestamp": "2026-08-12T10:30:00Z"
  }
}
```

#### Update Webhook
```bash
PUT /api/webhooks/:webhookId
Content-Type: application/json

{
  "url": "https://example.com/webhooks/new-url",
  "events": ["booking.created"],
  "isActive": false
}
```

#### Delete Webhook
```bash
DELETE /api/webhooks/:webhookId

Response:
{
  "message": "Webhook deleted successfully"
}
```

### Testing & Delivery

#### Test Webhook
```bash
POST /api/webhooks/:webhookId/test

Response:
{
  "success": true,
  "delivery": {
    "success": true,
    "statusCode": 200,
    "responseTime": 245,
    "retryCount": 0
  },
  "diagnostics": {
    "dnsResolution": true,
    "tlsValid": true,
    "timeout": false,
    "statusCode": 200,
    "responseTime": 245,
    "issues": [],
    "recommendations": []
  }
}
```

### Delivery History

#### Get Delivery History
```bash
GET /api/webhooks/:webhookId/delivery-history?limit=50&offset=0&status=failed

Response:
{
  "events": [
    {
      "_id": "evt_xxxxx",
      "eventType": "booking.created",
      "status": "delivered",
      "statusCode": 200,
      "responseTime": 245,
      "createdAt": "2026-08-12T10:30:00Z"
    }
  ],
  "total": 125,
  "limit": 50,
  "offset": 0
}
```

#### Get Event Details
```bash
GET /api/webhooks/:webhookId/events/:eventId

Response:
{
  "event": {
    "_id": "evt_xxxxx",
    "webhookId": "wh_xxxxx",
    "eventType": "booking.created",
    "payload": {...},
    "status": "failed",
    "statusCode": 500,
    "error": "Connection timeout",
    "retryHistory": [
      {
        "attemptNumber": 1,
        "timestamp": "2026-08-12T10:30:00Z",
        "statusCode": 500,
        "error": "Connection timeout",
        "responseTime": 30001
      }
    ]
  },
  "debugLogs": [...]
}
```

#### Replay Event
```bash
POST /api/webhooks/:webhookId/events/:eventId/replay

Response:
{
  "success": true,
  "result": {
    "success": true,
    "statusCode": 200,
    "responseTime": 250,
    "retryCount": 0
  }
}
```

### Dead Letter Queue

#### Get Dead Letter Queue
```bash
GET /api/webhooks/:webhookId/dead-letter-queue?limit=50

Response:
{
  "events": [
    {
      "_id": "evt_xxxxx",
      "webhookId": "wh_xxxxx",
      "eventType": "booking.created",
      "payload": {...},
      "status": "discarded",
      "createdAt": "2026-08-12T10:30:00Z"
    }
  ],
  "count": 3
}
```

#### Replay Dead Letter Event
```bash
POST /api/webhooks/:webhookId/dead-letter-queue/:eventId/replay

Response:
{
  "success": true,
  "result": {...}
}
```

### Debugging

#### Get Debug Logs
```bash
GET /api/webhooks/:webhookId/debug-logs?limit=50

Response:
{
  "logs": [
    {
      "id": "log_xxxxx",
      "timestamp": "2026-08-12T10:30:00Z",
      "webhookId": "wh_xxxxx",
      "request": {
        "url": "https://example.com/webhooks",
        "method": "POST",
        "headers": {...},
        "body": {...},
        "bodySize": 1024
      },
      "response": {
        "statusCode": 200,
        "headers": {...},
        "body": {...},
        "bodySize": 512
      },
      "timing": {
        "totalTime": 245,
        "dnsTime": 10,
        "connectTime": 50,
        "tlsTime": 30,
        "firstByteTime": 100,
        "downloadTime": 55
      },
      "errors": null
    }
  ],
  "statistics": {
    "totalRequests": 50,
    "successCount": 48,
    "failureCount": 2,
    "errorCount": 0,
    "successRate": 96,
    "averageResponseTime": 248,
    "minResponseTime": 150,
    "maxResponseTime": 450
  }
}
```

#### Test Delivery with Diagnostics
```bash
POST /api/webhooks/test-delivery
Content-Type: application/json

{
  "url": "https://example.com/webhooks/test",
  "payload": {
    "id": "evt_test",
    "eventType": "webhook.test",
    "timestamp": "2026-08-12T10:30:00Z",
    "data": {...}
  },
  "secret": "whsec_xxxxx"
}

Response:
{
  "success": false,
  "diagnostics": {
    "dnsResolution": false,
    "tlsValid": true,
    "timeout": false,
    "statusCode": 0,
    "responseTime": 5234,
    "issues": ["DNS resolution failed"],
    "recommendations": ["Verify webhook URL domain is valid"]
  },
  "log": {...}
}
```

### Payload Management

#### Inspect Payload
```bash
POST /api/webhooks/payload/inspect
Content-Type: application/json

{
  "id": "evt_xxxxx",
  "eventType": "booking.created",
  "timestamp": "2026-08-12T10:30:00Z",
  "data": {...}
}

Response:
{
  "inspection": {
    "valid": true,
    "size": 2048,
    "sizeFormatted": "2 KB",
    "structure": {...},
    "eventType": "booking.created",
    "timestamp": "2026-08-12T10:30:00Z",
    "dataFields": ["bookingId", "customerId", "amount"],
    "issues": []
  }
}
```

#### Generate Test Payload
```bash
POST /api/webhooks/generate-test-payload
Content-Type: application/json

{
  "eventType": "booking.created",
  "customData": {
    "customField": "customValue"
  }
}

Response:
{
  "payload": {
    "id": "evt_xxxxx",
    "eventType": "booking.created",
    "timestamp": "2026-08-12T10:30:00Z",
    "data": {
      "bookingId": "BK001",
      "customerId": "CUST001",
      "customField": "customValue"
    },
    "tenantId": "test_tenant",
    "version": "1.0.0"
  }
}
```

### Statistics

#### Get Webhook Statistics
```bash
GET /api/webhooks/statistics

Response:
{
  "totalEvents": 1250,
  "deliveredCount": 1200,
  "failedCount": 50,
  "pendingCount": 0,
  "discardedCount": 5,
  "successRate": 96,
  "averageResponseTime": 245,
  "timestamp": "2026-08-12T10:30:00Z"
}
```

## Webhook Signature Verification

### How It Works

1. **Generate Signature**
   ```javascript
   const crypto = require('crypto');
   const payload = JSON.stringify(eventData);
   const secret = 'whsec_xxxxx';
   const signature = crypto
     .createHmac('sha256', secret)
     .update(payload)
     .digest('hex');
   // Result: "sha256=abc123..."
   ```

2. **Verify on Receiver**
   ```javascript
   const crypto = require('crypto');
   const received = req.headers['x-webhook-signature'];
   const payload = req.rawBody; // Raw JSON bytes
   const secret = 'whsec_xxxxx';
   
   const expectedSignature = crypto
     .createHmac('sha256', secret)
     .update(payload)
     .digest('hex');
   
   const isValid = received === `sha256=${expectedSignature}`;
   ```

### Headers Sent

```
X-Webhook-Signature: sha256=abc123...
X-Webhook-ID: wh_xxxxx
X-Delivery-ID: del_xxxxx
X-Timestamp: 2026-08-12T10:30:00Z
X-Retry-Count: 0
User-Agent: FleetPro-Webhook/1.0.0
```

## Event Types

### Booking Events
- `booking.created` - New booking created
- `booking.updated` - Booking details updated
- `booking.completed` - Booking completed
- `booking.cancelled` - Booking cancelled

### Payment Events
- `payment.received` - Payment received
- `payment.failed` - Payment failed
- `payment.refunded` - Payment refunded

### Driver Events
- `driver.assigned` - Driver assigned to booking
- `driver.updated` - Driver information updated
- `driver.status_changed` - Driver availability changed

### Customer Events
- `customer.created` - New customer
- `customer.updated` - Customer information updated
- `customer.deleted` - Customer deleted

### Vehicle Events
- `vehicle.created` - New vehicle
- `vehicle.updated` - Vehicle information updated
- `vehicle.maintenance` - Vehicle maintenance needed

### System Events
- `webhook.test` - Test webhook delivery

## Retry Policy

### Default Configuration
```javascript
{
  maxRetries: 5,
  backoffMultiplier: 2,
  initialDelayMs: 1000,
  maxDelayMs: 3600000 // 1 hour
}
```

### Retry Schedule
```
Attempt 1: ~1 second (1000ms + jitter)
Attempt 2: ~2 seconds (2000ms + jitter)
Attempt 3: ~4 seconds (4000ms + jitter)
Attempt 4: ~8 seconds (8000ms + jitter)
Attempt 5: ~16 seconds (16000ms + jitter)
Total: ~31 seconds + jitter for all retries
```

## Error Handling

### Status Code Handling
```
2xx (200-299)   → Success
3xx (300-399)   → Retry
4xx (400-499)   → Retry
5xx (500-599)   → Retry
Network Error   → Retry
Timeout         → Retry
```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| DNS resolution failed | Invalid domain | Verify webhook URL is valid |
| TLS certificate error | Invalid SSL cert | Update certificate or use HTTP (dev only) |
| Connection timeout | Server slow/down | Check endpoint health, increase timeout |
| 401 Unauthorized | Invalid credentials | Verify API key/token in headers |
| 404 Not Found | Wrong endpoint | Verify webhook URL matches receiver |
| 500 Server Error | Receiver error | Check receiver logs, fix issue, replay |

## Usage Examples

### Node.js / Express Receiver

```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

// Middleware to get raw body for signature verification
app.use(express.raw({ type: 'application/json' }));

// Webhook endpoint
app.post('/webhooks', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;
  
  // Verify signature
  const payload = req.body;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  if (signature !== `sha256=${expectedSignature}`) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Parse payload
  const event = JSON.parse(payload);
  
  // Handle event
  console.log('Received event:', event.eventType);
  console.log('Event data:', event.data);
  
  // Return 2xx to acknowledge
  res.status(200).json({ success: true });
});

app.listen(3000);
```

### Python / Flask Receiver

```python
from flask import Flask, request, jsonify
import hmac
import hashlib
import json

app = Flask(__name__)
WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET')

@app.route('/webhooks', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.data
    
    # Verify signature
    expected_signature = 'sha256=' + hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature, expected_signature):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Parse event
    event = json.loads(payload)
    print(f"Received event: {event['eventType']}")
    print(f"Event data: {event['data']}")
    
    # Process event
    handle_event(event)
    
    return jsonify({'success': True}), 200

def handle_event(event):
    if event['eventType'] == 'booking.created':
        # Handle booking creation
        pass
    elif event['eventType'] == 'payment.received':
        # Handle payment
        pass
    # ... handle other event types
```

## Monitoring & Metrics

### Key Metrics to Track
- **Success Rate**: Percentage of successful deliveries
- **Average Response Time**: Mean delivery latency
- **Failure Rate**: Percentage of failed deliveries
- **Retry Count**: Average retries per event
- **Dead Letter Queue Size**: Events unable to deliver
- **Webhook Coverage**: % of critical events being delivered

### Health Checks
```bash
# Check webhook system health
curl -X GET http://localhost:5050/api/webhooks/statistics
```

## Security Best Practices

1. **Signature Verification**
   - Always verify HMAC-SHA256 signatures
   - Use constant-time comparison
   - Never trust raw payloads

2. **Secret Management**
   - Store secrets in environment variables
   - Rotate secrets periodically
   - Never commit secrets to version control

3. **HTTPS Only**
   - Always use HTTPS for webhook URLs
   - Verify TLS certificates
   - Use certificate pinning for sensitive scenarios

4. **Rate Limiting**
   - Implement rate limiting on receiver
   - Queue events for batch processing
   - Use backpressure mechanisms

5. **Idempotency**
   - Store event IDs to detect duplicates
   - Implement idempotent handlers
   - Avoid side effects on retries

## Performance Tuning

### Optimize Webhook Receiver
```javascript
// Use async/await for non-blocking I/O
app.post('/webhooks', async (req, res) => {
  // Acknowledge immediately
  res.status(202).json({ received: true });
  
  // Process asynchronously
  processWebhookAsync(req.body);
});

async function processWebhookAsync(event) {
  try {
    // Do work here
    await updateDatabase(event);
  } catch (error) {
    // Log error, don't throw
    console.error('Webhook processing error:', error);
  }
}
```

### Batch Processing
```javascript
// Process events in batches
const batch = [];
const BATCH_SIZE = 100;

async function addToBatch(event) {
  batch.push(event);
  if (batch.length >= BATCH_SIZE) {
    await processBatch();
  }
}

async function processBatch() {
  const events = batch.splice(0, BATCH_SIZE);
  await database.collection('webhooks').insertMany(events);
}
```

## Troubleshooting

### Debug Mode
```bash
# Enable detailed logging
DEBUG=webhook:* npm run dev
```

### Check Webhook Logs
```bash
# Get recent failed deliveries
curl -X GET "http://localhost:5050/api/webhooks/:webhookId/delivery-history?status=failed"

# Get debug logs with timing info
curl -X GET "http://localhost:5050/api/webhooks/:webhookId/debug-logs"
```

### Replay Events
```bash
# Replay specific failed event
curl -X POST "http://localhost:5050/api/webhooks/:webhookId/events/:eventId/replay"

# Replay all DLQ events
curl -X POST "http://localhost:5050/api/webhooks/:webhookId/dead-letter-queue/:eventId/replay"
```

## Database Cleanup

### Manual Cleanup
```javascript
// Clean events older than 30 days
const storage = new WebhookStorageService();
await storage.cleanupOldEvents(30);
```

### Automatic TTL Cleanup
- MongoDB TTL index automatically deletes events after 30 days
- Configurable via `expiresAt` field in webhook event schema

## Production Deployment

### Environment Variables
```bash
MONGODB_URI=mongodb://localhost:27017/fleetpro
WEBHOOK_MAX_RETRIES=5
WEBHOOK_TIMEOUT_MS=30000
WEBHOOK_CLEANUP_DAYS=30
LOG_LEVEL=info
```

### Monitoring Setup
```javascript
// Emit events for monitoring
webhookManager.on('delivery:success', (data) => {
  console.log('Delivery success:', data);
  // Send to monitoring system
});

webhookManager.on('delivery:failed', (data) => {
  console.log('Delivery failed:', data);
  // Alert team
});

webhookManager.on('delivery:deadletter', (data) => {
  console.log('DLQ entry:', data);
  // Trigger investigation
});
```

## Support & Troubleshooting

For issues or questions:
1. Check delivery history in UI
2. Review debug logs
3. Test webhook manually in UI
4. Check receiver logs
5. Review this documentation
6. Contact support with webhook ID and event ID

---

**Version**: 1.0.0  
**Last Updated**: 2026-08-12  
**Status**: Production Ready
