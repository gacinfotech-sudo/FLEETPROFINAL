# Universal Integration Hub Architecture

## Overview

The Universal Integration Hub (UH) is FleetPro's production-grade infrastructure for supporting multiple third-party providers across different categories:

- **MESSAGING**: WhatsApp, SMS, Email
- **CALLING**: Telephony, Video Calling  
- **GPS**: Location tracking, GPS devices
- **KYC**: Identity verification, DigiLocker
- **ESIGN**: Digital signature, eSign
- **PAYMENT**: Payment processing
- **ANALYTICS**: Analytics and reporting
- **STORAGE**: Cloud storage
- **CUSTOM**: Custom integrations

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  (Routes, Services, API Endpoints)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│             Integration Hub Interface Layer                  │
│  (Request routing, RBAC, Audit logging)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Provider Adapter Layer                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │WhatsApp  │ │Calling   │ │GPS       │ │KYC/eSign │       │
│  │Adapter   │ │Adapter   │ │Adapter   │ │Adapters  │  ...  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  (All extend BaseProviderAdapter)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│             Provider Registry & Discovery                    │
│  (Singleton, manages all provider definitions)              │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│         Multi-Tenant Connection Management                   │
│  (ProviderConnection model - credentials, webhooks)         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                 Database Layer                              │
│  (MongoDB)                                                  │
│  - IntegrationProvider (canonical definitions)              │
│  - ProviderConnection (tenant × provider connections)       │
│  - IntegrationAuditLog (compliance audit trail)             │
│  - ProviderHealth (status monitoring)                       │
│  - WebhookEvent (idempotent event ingestion)                │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Core Infrastructure (COMPLETE)

### Models

#### 1. IntegrationProvider
**Purpose**: Canonical definition of all available providers

**Key Fields**:
- `providerId` (unique): Identifier like "twilio", "whatsapp-business", "google-maps"
- `category`: MESSAGING, CALLING, GPS, KYC, ESIGN, PAYMENT, ANALYTICS, STORAGE, CUSTOM
- `metadata`: Display info, capabilities, required credentials
- `configurationSchema`: JSON schema for validation
- `webhookConfig`: Webhook event types and configuration
- `rateLimiting`: Rate limit defaults for the provider
- `healthCheck`: Health check endpoint and interval

**Indexes**:
- `providerId` (unique, fast lookup)
- `category`, `isActive` (discovery)
- `tags` (categorization)
- `createdAt` (chronological)

**Relationships**:
- One-to-many with `ProviderConnection`
- Referenced by audit logs

#### 2. ProviderConnection
**Purpose**: Tenant-scoped connection to a provider (enforces multi-tenant isolation)

**Key Fields**:
- `providerId`, `tenantId` (compound unique)
- `status`: active, inactive, error, pending_auth, expired
- `credentials`: Encrypted (AES-256-GCM) with IV and auth tag
- `config`: Tenant-specific configuration
- `metadata`: Account ID, name, custom fields
- `accessControl`: RBAC - which users can access this connection
- `webhookConfig`: Unique webhook token per connection
- `stats`: Usage stats, quota tracking
- `autoSync`: Automatic sync configuration

**Encryption**:
- Uses `aes-256-gcm` (authenticated encryption)
- Each record has unique IV and auth tag
- Decryption requires encryption key (stored separately in secrets)

**Virtuals**:
- `isExpired`: Boolean check against `expiresAt`
- `isDisabled`: Boolean check against `disabledUntil`
- `canBeUsed`: Combines status, expiration, and disabled checks

**Indexes**:
- `(tenantId, providerId)` (compound, unique per tenant)
- `status`, `tenantId` (fast filtering)
- `webhookConfig.webhookToken` (webhook routing)
- `accessControl.userId` (RBAC queries)

#### 3. IntegrationAuditLog
**Purpose**: Immutable security audit trail for compliance

**Key Fields**:
- `action`: CREATE_PROVIDER, UPDATE_PROVIDER, etc.
- `result`: success, failure, partial
- `severity`: low, medium, high, critical
- `involvesSensitiveData`: Boolean flag
- `credentialsSensitivity`: Field sensitivity level
- `metadata`: Action-specific details (fields accessed, changed, etc.)
- `correlationId`: Link related events
- `investigation`: Review status and findings
- `changes`: Field-level change tracking

**TTL**:
- Automatic expiration after 90 days (configurable)
- MongoDB TTL index on `expiresAt`

**Compliance Tags**:
- Optional: GDPR, HIPAA, PCI, SOX flags
- For regulatory tracking

**Indexes**:
- `action`, `result` (compliance queries)
- `severity`, `flaggedForReview` (investigation)
- `involvesSensitiveData`, `createdAt` (PII tracking)
- `(createdAt, tenantId)` (audit trail)
- `expiresAt` (TTL index)

### Types (server/integrations/types/index.ts)

**Enums**:
```typescript
type IntegrationCategory = 'MESSAGING' | 'CALLING' | 'GPS' | 'KYC' | 'ESIGN' | ...
type ProviderHealthStatus = 'healthy' | 'degraded' | 'down' | 'unchecked'
type ProviderConnectionStatus = 'active' | 'inactive' | 'error' | 'pending_auth' | 'expired'
type IntegrationRole = 'viewer' | 'operator' | 'admin' | 'super_admin'
type AuditActionType = 'CREATE_PROVIDER' | 'UPDATE_PROVIDER' | ... (15 types)
```

**Core Interfaces**:
- `ProviderConfig`: Configuration data
- `AdapterRequest`: Request to adapter
- `AdapterResponse`: Response from adapter
- `WebhookEventPayload`: Normalized webhook event
- `TenantContext`: Multi-tenant isolation context

**Error Classes**:
- `IntegrationError`: Base error
- `ProviderNotFoundError`: 404 Provider not found
- `ConnectionNotFoundError`: 404 Connection not found
- `AuthenticationError`: 401 Auth failed
- `AuthorizationError`: 403 Access denied
- `RateLimitError`: 429 Rate limited
- `ConfigurationError`: 400 Invalid config
- `WebhookVerificationError`: 401 Webhook validation failed

### BaseProviderAdapter

**Purpose**: Base class for all provider adapters (abstract)

**Responsibilities**:
- Authentication handling (API keys, OAuth tokens)
- Request/response handling with retry logic
- Rate limiting per provider
- Webhook signature verification
- Error normalization
- Multi-tenant context enforcement

**Methods**:
- `abstract executeAction(request: AdapterRequest)`: Provider-specific logic
- `testConnection()`: Health check
- `verifyWebhookEvent()`: Webhook validation
- `makeRequest()`: HTTP with retry logic (exponential backoff)
- `checkRateLimit()`: Token bucket implementation
- `encryptCredentials()`: AES-256-GCM encryption
- `decryptCredentials()`: Authenticated decryption

**Features**:
- Automatic retry with exponential backoff (1s, 2s, 4s, etc.)
- Configurable timeout (default 30s)
- Built-in rate limiting (request count tracking)
- HMAC-SHA256 webhook verification
- Structured logging for debugging
- Tenant isolation enforcement

### ProviderRegistry

**Purpose**: Singleton registry for all providers (factory pattern)

**Responsibilities**:
- Load provider definitions from database on startup
- Provide provider discovery by ID, category
- Manage provider lifecycle (register, deactivate)
- Validate provider configuration
- Return statistics and health info

**Methods**:
- `getInstance()`: Get singleton
- `initialize()`: Load from database
- `registerProvider()`: Add new provider dynamically
- `getProvider(providerId)`: Get by ID
- `getAllProviders()`: Get all active
- `getProvidersByCategory()`: Filter by category
- `getAdapterFactory()`: Get adapter class
- `hasProvider()`: Check existence
- `updateProvider()`: Update metadata
- `deactivateProvider()`: Disable provider
- `getStatistics()`: Count by category
- `validateConfiguration()`: Schema validation

**Thread Safety**:
- Singleton pattern with in-memory cache
- Database as source of truth
- Safe for concurrent reads

## Phase 2-7: Provider Implementations (Planned)

### Phase 2: WhatsApp Adapter
- Message sending
- Media support (images, documents)
- Template management
- Webhook integration
- Rate limiting (60 messages/minute default)

### Phase 3: Calling/Telephony Adapter
- Call initiation
- Call state tracking
- Recording handling
- IVR integration
- Webhook for call events

### Phase 4: GPS Adapter
- Real-time location updates
- Geofencing
- Route tracking
- Device management
- Webhook for location events

### Phase 5: KYC/DigiLocker Adapter
- Document verification
- eKYC flow
- DigiLocker integration
- Compliance tracking
- Document lifecycle

### Phase 6: eSign Adapter
- Document signing
- Signature verification
- Audit trail
- Compliance (IT Act)
- Webhook for sign events

### Phase 7: Payment Adapter
- Multi-gateway support
- Webhook normalization
- Refund handling
- Settlement tracking

## Multi-Tenant Isolation

### Tenant Context
Every request includes `TenantContext`:
```typescript
interface TenantContext {
  tenantId: string;
  userId?: string;
  role?: IntegrationRole;
  permissions?: string[];
}
```

### Data Isolation
- **IntegrationProvider**: Shared across all tenants (read-only after creation)
- **ProviderConnection**: Unique per tenant per provider
  - Compound index: `(tenantId, providerId)`
  - Credentials encrypted with tenant-specific key
- **IntegrationAuditLog**: Filtered by `tenantId`
  - Index on `(tenantId, action, createdAt)`

### Access Control
- **Viewer**: Read-only access to connection status
- **Operator**: Can use connections for operations
- **Admin**: Can create/modify/delete connections
- **Super Admin**: Platform-wide management

### Webhook Isolation
- Each connection has unique `webhookToken`
- Webhook URL format: `/webhooks/integrations/{connectionId}/{webhookToken}`
- Token is checked before processing webhook

## Failure Isolation

### Provider Failures Don't Break Core
- Adapter exceptions are caught and logged
- Core booking/payment flows continue
- User sees graceful degradation message
- Failure count triggers auto-disable after threshold

### Health Monitoring
- Per-provider health checks
- Track consecutive failures
- Auto-disable if failures exceed threshold
- Require manual re-enable or auto-recovery after TTL

### Error Tracking
- All errors logged to IntegrationAuditLog
- Flagged for review if critical
- Correlation IDs link related failures
- Investigation workflow for security incidents

## Webhook Handling

### Idempotency
- Each webhook has `idempotencyKey`
- Check for duplicate processing
- Store processed webhooks in database
- TTL for idempotency records (24 hours default)

### Verification
- HMAC-SHA256 signature verification
- Timing-safe comparison
- Signature secret per connection
- Reject unsigned webhooks

### Processing
- Asynchronous webhook handler
- Queue-based processing
- Retry logic for failed processing
- Dead-letter queue for unprocessable events

## Security Considerations

### Credential Storage
- **Never in logs**: Credentials never logged
- **Encrypted at rest**: AES-256-GCM
- **Encrypted in transit**: HTTPS only
- **Rotation support**: Can update credentials without downtime
- **Audit trail**: Every credential access logged

### Rate Limiting
- Per-provider default limits
- Per-connection override capability
- Token bucket algorithm
- Backpressure handling

### RBAC
- Tenant-scoped roles
- Connection-specific access control
- Audit logging of access changes
- Regular access reviews

### Compliance
- GDPR-compliant data handling
- Audit trail for regulatory inspection
- Data retention policies
- Right to be forgotten support

## Performance Optimizations

### Indexes
```
IntegrationProvider:
  - providerId (unique)
  - (category, isActive)
  - tags

ProviderConnection:
  - (tenantId, providerId) unique
  - (status, tenantId)
  - (accessControl.userId)
  - (webhookConfig.webhookToken)

IntegrationAuditLog:
  - (action, result)
  - (severity, flaggedForReview)
  - expiresAt (TTL)
```

### Caching
- In-memory provider registry
- Registry reloads on startup
- Cache invalidation on provider update

### Connection Pooling
- HTTP connection pooling via native fetch
- Timeout handling (default 30s)
- Retry with exponential backoff

## Usage Examples

### 1. Initialize Hub
```typescript
import { initializeIntegrationHub } from './server/integrations';

async function startServer() {
  await initializeIntegrationHub();
  // Start server...
}
```

### 2. Get Provider Registry
```typescript
import { getProviderRegistry } from './server/integrations';

const registry = getProviderRegistry();
const provider = registry.getProvider('twilio');
const whatsappProviders = registry.getProvidersByCategory('MESSAGING');
```

### 3. Create Adapter (Phase 2+)
```typescript
import { getProviderRegistry } from './server/integrations';

const registry = getProviderRegistry();
const adapterFactory = registry.getAdapterFactory('whatsapp-business');

const adapter = new adapterFactory({
  tenantContext: { tenantId: 'tenant123' },
  config: { apiKey: '...' }
});

const response = await adapter.executeAction({
  action: 'send_message',
  tenantId: 'tenant123',
  data: { to: '+91999...', text: 'Hello' }
});
```

### 4. Create Connection
```typescript
import { ProviderConnection } from './server/integrations';

const connection = new ProviderConnection({
  providerId: 'twilio',
  tenantId: tenantId,
  createdBy: userId,
  displayName: 'Main WhatsApp Business',
  credentials: encryptedCreds,
  config: { apiKey: '...' },
  webhookConfig: {
    webhookToken: generateToken(),
    webhookUrl: `/webhooks/integrations/...`,
    events: ['message.received', 'message.sent']
  }
});

await connection.save();
```

### 5. Log Audit Event
```typescript
import { IntegrationAuditLog } from './server/integrations';

const auditLog = new IntegrationAuditLog({
  action: 'SEND_MESSAGE',
  result: 'success',
  tenantId: tenantId,
  userId: userId,
  providerId: 'twilio',
  connectionId: connectionId,
  metadata: { messageCount: 1 },
  severity: 'low'
});

await auditLog.save();
```

## Database Schema Relationships

```
IntegrationProvider (1)
  ├─── n ProviderConnection
  │     ├─── n IntegrationAuditLog
  │     └─── n WebhookEvent
  │
  └─── n ProviderHealth

Tenant (1)
  └─── n ProviderConnection
        └─── n IntegrationAuditLog

User (1)
  └─── n ProviderConnection (accessControl)
```

## Deployment Checklist

- [ ] Database indexes created
- [ ] Encryption keys configured
- [ ] Provider registry initialized
- [ ] Webhook endpoints configured
- [ ] RBAC roles created
- [ ] Audit logging enabled
- [ ] Health checks configured
- [ ] Rate limits set
- [ ] Credential rotation policy documented
- [ ] Disaster recovery tested

## Troubleshooting

### Provider Not Found
- Check `IntegrationProvider` collection
- Verify `isActive: true`
- Check registry initialization

### Connection Failures
- Check `ProviderConnection` status
- Verify credentials not expired
- Check rate limit state
- Review audit logs for errors

### Webhook Not Received
- Verify webhook token matches
- Check signature verification
- Review webhook delivery logs
- Check firewall rules

### Rate Limit Exceeded
- Check provider rate limit config
- Verify quota not exceeded
- Review usage statistics
- Consider upgrading plan

## Future Enhancements

- [ ] OAuth 2.0 provider authentication
- [ ] Provider marketplace UI
- [ ] Advanced analytics dashboard
- [ ] Webhook replay functionality
- [ ] Automatic failover to backup provider
- [ ] Cost tracking per provider
- [ ] Provider performance benchmarking
- [ ] Custom alert rules
- [ ] Provider A/B testing
- [ ] Batch operations API

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-12  
**Status**: Phase 1 Complete - Production Ready
