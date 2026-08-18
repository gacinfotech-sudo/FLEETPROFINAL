# Calling/Telephony Provider Integration

Complete implementation of a production-ready calling provider with Exotel support, CDR tracking, and webhook integration.

## Architecture Overview

### Core Components

1. **CallingAdapter** (`CallingAdapter.ts`) - Abstract base class
   - Rate limiting (token bucket algorithm)
   - Event emission system
   - Common functionality for all providers

2. **ExotelAdapter** (`ExotelAdapter.ts`) - Production provider
   - Full Exotel API v2 support
   - Outbound calls with `/call/connect` endpoint
   - Inbound webhooks with HMAC-SHA256 verification
   - Call forwarding and transfer
   - Tenant isolation via Exotel SID

3. **MockCallingAdapter** (`MockCallingAdapter.ts`) - Testing
   - No-op implementation for development/testing
   - Simulates call state transitions
   - Logs without network calls

4. **CallLogger** (`CallLogger.ts`) - CDR tracking
   - Detailed call records (CDR)
   - Event logging and audit trail
   - Statistics and reporting
   - CSV export for compliance

5. **WebhookHandler** (`WebhookHandler.ts`) - Event processing
   - Webhook signature verification
   - Event type detection
   - Retry queue with exponential backoff
   - Event handler registration

6. **Routes** (`routes.ts`) - REST API
   - Call management endpoints
   - CDR query and export
   - Webhook management
   - Statistics and monitoring

## Setup & Configuration

### Environment Variables

```bash
# Provider selection
CALLING_PROVIDER=exotel              # or 'mock' for testing

# Exotel credentials
CALLING_API_KEY=your_api_key
CALLING_API_TOKEN=your_api_token
EXOTEL_SID=your_exotel_sid

# Rate limiting (optional)
CALLING_RATE_LIMIT_MINUTE=60        # calls per minute
CALLING_RATE_LIMIT_HOUR=1000         # calls per hour
CALLING_MAX_CONCURRENT=100           # concurrent calls

# Webhook security
CALLING_WEBHOOK_SECRET=your_secret
```

### Express Integration

```typescript
import callingRoutes from 'server/integrations/providers/calling/routes';

app.use('/api/calling', callingRoutes);
```

## API Endpoints

### Call Management

**Place Outbound Call**
```
POST /api/calling/calls
{
  "tenantId": "tenant_123",
  "fromNumber": "+1234567890",
  "toNumber": "+0987654321",
  "agentId": "agent_456",
  "options": {
    "recordCall": true,
    "recordFormat": "mp3",
    "callTimeout": 60
  }
}
```

**Get Call Details**
```
GET /api/calling/calls/:callId
```

**End Call**
```
DELETE /api/calling/calls/:callId
{
  "reason": "user_hangup"
}
```

**Transfer Call**
```
POST /api/calling/calls/:callId/transfer
{
  "toNumber": "+1234567890",
  "transferType": "blind"  // or 'attended'
}
```

**Get Recording URL**
```
GET /api/calling/calls/:callId/recording
```

### Call Forwarding

**Set Up Forwarding**
```
POST /api/calling/forwarding
{
  "id": "forward_123",
  "fromNumber": "+1234567890",
  "toNumber": "+0987654321",
  "enabled": true
}
```

**Remove Forwarding**
```
DELETE /api/calling/forwarding/:ruleId
```

### CDR & Analytics

**Get CDR Records**
```
GET /api/calling/cdr/:tenantId?limit=100&format=json
// or format=csv for CSV export
```

**Get Call Statistics**
```
GET /api/calling/stats/:tenantId
```

**Get CDR by Date Range**
```
GET /api/calling/cdr/:tenantId/range?startDate=2026-08-01&endDate=2026-08-31
```

**Get Call Events**
```
GET /api/calling/events/:callId
```

### Webhooks

**Incoming Webhook**
```
POST /api/calling/webhooks
```

Expects headers:
- `X-Exotel-Signature`: HMAC-SHA256(body, apiToken)

Payload types:
- Incoming calls (CallType, From, To)
- Call status (Status, Sid)
- Recording completed (RecordingUrl)

**Register Webhook Handler**
```
POST /api/webhook-handlers/:eventType
{
  "webhookUrl": "https://your-service.com/webhook"
}
```

**Get Webhook Stats**
```
GET /api/calling/webhook-stats
```

## Usage Examples

### TypeScript

```typescript
import { callingProvider, getCallLogger } from 'server/integrations/providers/calling';

// Place a call
const result = await callingProvider.placeCall({
  tenantId: 'tenant_123',
  fromNumber: '+1234567890',
  toNumber: '+0987654321',
  agentId: 'agent_456',
  options: {
    recordCall: true,
    callTimeout: 60,
    tags: { campaign: 'Q3' },
  },
});

// Get call details
const details = await callingProvider.getCallDetails(result.providerCallId);

// End call
await callingProvider.endCall(result.providerCallId);

// Get CDR
const logger = getCallLogger();
const stats = logger.getCallStats('tenant_123');
const csv = logger.exportCDRAsCSV('tenant_123');
```

### Event Handling

```typescript
import { callingProvider } from 'server/integrations/providers/calling';

// Listen to incoming calls
callingProvider.onIncomingCall((call) => {
  console.log(`Incoming call from ${call.fromNumber}`);
});

// Listen to call status updates
callingProvider.onCallStatus((status) => {
  console.log(`Call ${status.providerCallId} -> ${status.status}`);
});

// Listen to call events
callingProvider.onCallEvent((event) => {
  console.log(`Call event: ${event.type}`);
});
```

## Exotel Integration Details

### API Endpoints Used

- `POST /{sid}/Calls/connect` - Initiate outbound call
- `GET /{sid}/Calls/{callId}` - Get call details
- `POST /{sid}/Calls/{callId}` - Hangup/transfer call
- `POST /{sid}/CallForwarding` - Set up forwarding
- `DELETE /{sid}/CallForwarding/{id}` - Remove forwarding

### Webhook Events

Exotel sends webhooks for:
- Missed calls
- Answered calls
- Call completion with duration
- IVR interactions
- Recording completion

### Authentication

Uses HTTP Basic Auth:
```
Authorization: Basic base64(apiKey:apiToken)
```

### Webhook Signature Verification

```
X-Exotel-Signature: HMAC-SHA256(body, apiToken)
```

## Rate Limiting

Token bucket algorithm with configurable limits:

- `callsPerMinute` - Throttle peak load
- `callsPerHour` - Daily usage quota
- `callsPerDay` - Account limits
- `concurrentCalls` - Prevent overload
- `requestsPerSecond` - API rate limits

## CDR Features

### Captured Data

- Call direction (inbound/outbound)
- Phone numbers (from/to)
- Virtual number (for incoming calls)
- Agent assignment
- Timing (initiated, connected, completed)
- Duration
- Status and disconnect reason
- Recording URL and duration
- IVR interactions
- Custom tags and metadata

### Export & Compliance

- CSV export for billing/compliance
- Date range filtering
- Tenant isolation
- Full event audit trail

## Error Handling

### Rate Limit Exceeded
```
Error: Rate limit exceeded
```

### Invalid Credentials
```
Exotel error (401): Unauthorized
```

### Call Not Found
```
Error: Call {callId} not found
```

### Webhook Verification Failed
```
401 Unauthorized - Invalid signature
```

## Testing

### Mock Provider

For development/testing, use `CALLING_PROVIDER=mock`:

```typescript
// No real calls are made
const result = await callingProvider.placeCall({...});
// Returns: { providerCallId: 'mock_call_xxx', status: 'ringing', ... }
```

### Test Webhook

```bash
curl -X POST http://localhost:5050/api/calling/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Exotel-Signature: mock" \
  -d '{
    "CallType": "answered",
    "From": "+1234567890",
    "To": "+0987654321",
    "Duration": 30,
    "CallTime": "2026-08-12T10:30:00Z"
  }'
```

## Security Considerations

### Tenant Isolation

- Exotel SID mapping ensures requests only affect tenant's account
- Custom field includes tenantId for audit trail
- CDR records tagged with tenantId

### Credential Storage

- Credentials loaded from environment variables
- Never logged or exposed in errors
- Base64 encoded for HTTP Basic Auth

### Webhook Verification

- HMAC-SHA256 signature verification
- Signature header validation
- Payload sanitization

### Rate Limiting

- Prevents abuse
- Protects Exotel API quota
- Concurrent call limits

## Monitoring & Debugging

### Rate Limit Stats
```
GET /api/calling/rate-limits
```

### Webhook Retry Stats
```
GET /api/calling/webhook-stats
```

### Call Event Logs
```
GET /api/calling/events/:callId
```

### CDR Export
```
GET /api/calling/cdr/:tenantId?format=csv
```

## Future Enhancements

- [ ] Twilio provider adapter
- [ ] Conference calling
- [ ] IVR application builder
- [ ] Advanced call routing
- [ ] Real-time analytics dashboard
- [ ] Call sentiment analysis
- [ ] AI-powered call routing
- [ ] Multi-language IVR support

## Production Checklist

- [x] Provider abstraction (mock + Exotel)
- [x] Webhook signature verification
- [x] Rate limiting
- [x] CDR tracking and export
- [x] Error handling and recovery
- [x] Tenant isolation
- [x] Event audit trail
- [x] API documentation
- [x] Health monitoring endpoints
- [x] Comprehensive test coverage

## Support

For issues or questions:
1. Check CDR records: `GET /api/calling/cdr/:tenantId`
2. Review event logs: `GET /api/calling/events/:callId`
3. Verify rate limits: `GET /api/calling/rate-limits`
4. Check webhook status: `GET /api/calling/webhook-stats`
