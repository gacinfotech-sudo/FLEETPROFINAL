# Integration Hub Usage Guide

## Quick Start

### 1. Initialize Integration Hub

In your application startup (e.g., `server/index.ts`):

```typescript
import { initializeIntegrationHub } from './integrations';

async function startServer() {
  // ... other initialization ...

  // Initialize integration hub
  await initializeIntegrationHub();
  
  // ... rest of server startup ...
}
```

### 2. Get Provider Registry

```typescript
import { getProviderRegistry } from './integrations';

const registry = getProviderRegistry();

// Get a specific provider
const provider = registry.getProvider('twilio');

// Get all messaging providers
const messagingProviders = registry.getProvidersByCategory('MESSAGING');

// Check if provider exists
if (registry.hasProvider('whatsapp-business')) {
  console.log('WhatsApp is available');
}
```

## Creating Provider Connections

### 1. Create a Connection for a Tenant

```typescript
import { ProviderConnection } from './integrations';
import crypto from 'crypto';

async function createWhatsAppConnection(
  tenantId: string,
  userId: string,
  apiKey: string,
  accountPhoneNumber: string
) {
  // Generate webhook token
  const webhookToken = crypto.randomBytes(32).toString('hex');

  // Create connection
  const connection = new ProviderConnection({
    providerId: 'twilio', // Provider ID
    tenantId: new mongoose.Types.ObjectId(tenantId),
    createdBy: userId,
    displayName: 'Main WhatsApp Business',
    status: 'inactive', // Will be activated after test
    
    // Credentials (will be encrypted)
    credentials: {
      encrypted: '...', // Encrypted by adapter
      algorithm: 'aes-256-gcm',
      iv: '...',
      authTag: '...'
    },
    
    // Configuration
    config: {
      apiKey: apiKey,
      apiEndpoint: 'https://api.twilio.com',
      rateLimitPerMinute: 60,
      timeout: 30000
    },
    
    // Metadata
    metadata: {
      accountId: accountPhoneNumber,
      accountName: 'Main WhatsApp Account',
      provider: 'Twilio'
    },
    
    // Webhook configuration
    webhookConfig: {
      webhookToken: webhookToken,
      webhookUrl: `/webhooks/integrations/${tenantId}/twilio/${webhookToken}`,
      events: ['message.received', 'message.sent', 'message.failed'],
      verified: false
    },
    
    // Access control
    accessControl: [
      {
        userId: userId,
        role: 'admin',
        grantedAt: new Date(),
        grantedBy: 'system'
      }
    ]
  });

  // Save connection
  await connection.save();
  
  return connection;
}
```

### 2. Test Connection

```typescript
import { BaseProviderAdapter } from './integrations';
import { getProviderRegistry } from './integrations';

async function testConnection(connection: IProviderConnection) {
  try {
    // Get adapter factory from registry
    const registry = getProviderRegistry();
    const adapterFactory = registry.getAdapterFactory(connection.providerId);
    
    // Create adapter instance
    const adapter = new adapterFactory({
      tenantContext: {
        tenantId: connection.tenantId.toString(),
        userId: connection.createdBy
      },
      config: connection.config
    });
    
    // Test connection
    const isHealthy = await adapter.testConnection();
    
    if (isHealthy) {
      // Update connection status
      connection.status = 'active';
      connection.lastAuthenticatedAt = new Date();
      connection.failureCount = 0;
    } else {
      connection.status = 'error';
      connection.lastAuthFailureAt = new Date();
      connection.failureCount += 1;
    }
    
    await connection.save();
    
    return isHealthy;
  } catch (error) {
    // Log failure
    connection.status = 'error';
    connection.lastAuthFailureAt = new Date();
    connection.failureCount += 1;
    
    if (connection.failureCount >= connection.maxFailureThreshold!) {
      connection.disabledUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    }
    
    await connection.save();
    throw error;
  }
}
```

### 3. Use Connection to Execute Actions

```typescript
import { getProviderRegistry } from './integrations';
import { AdapterRequest, AdapterResponse } from './integrations';

async function sendMessage(
  connection: IProviderConnection,
  messageData: {
    to: string;
    text: string;
    mediaUrl?: string;
  }
) {
  // Check if connection can be used
  if (!connection.canBeUsed) {
    throw new Error(`Connection cannot be used. Status: ${connection.status}`);
  }

  // Get adapter factory
  const registry = getProviderRegistry();
  const adapterFactory = registry.getAdapterFactory(connection.providerId);

  // Create adapter instance
  const adapter = new adapterFactory({
    tenantContext: {
      tenantId: connection.tenantId.toString()
    },
    config: connection.config
  });

  // Prepare request
  const request: AdapterRequest = {
    action: 'send_message',
    tenantId: connection.tenantId.toString(),
    data: messageData,
    metadata: {
      connectionId: connection._id.toString(),
      timestamp: new Date().toISOString()
    }
  };

  // Execute action
  const response: AdapterResponse = await adapter.executeAction(request);

  if (response.success) {
    // Update connection stats
    connection.stats = connection.stats || {
      totalRequests: 0,
      totalErrors: 0
    };
    connection.stats.totalRequests += 1;
    connection.stats.lastUsedAt = new Date();
    await connection.save();
  } else {
    // Log error
    connection.stats = connection.stats || {
      totalRequests: 0,
      totalErrors: 0
    };
    connection.stats.totalErrors += 1;
    await connection.save();
  }

  return response;
}
```

## Audit Logging

### 1. Log Audit Events

```typescript
import { IntegrationAuditLog } from './integrations';

async function logAuditEvent(
  action: 'SEND_MESSAGE' | 'CONNECT_PROVIDER' | 'UPDATE_CREDENTIALS',
  tenantId: string,
  userId: string,
  providerId: string,
  result: 'success' | 'failure',
  metadata: Record<string, any> = {}
) {
  const auditLog = new IntegrationAuditLog({
    action,
    result,
    tenantId: new mongoose.Types.ObjectId(tenantId),
    userId,
    providerId,
    
    request: {
      method: 'POST',
      path: `/api/integrations/${providerId}/action`,
      ip: '...',
      userAgent: '...'
    },
    
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString()
    },
    
    severity: result === 'success' ? 'low' : 'high',
    involvesSensitiveData: action === 'UPDATE_CREDENTIALS',
    credentialsSensitivity: 'high',
    
    complianceTags: {
      gdpr: true,
      pci: action.includes('PAYMENT')
    }
  });

  await auditLog.save();
}
```

### 2. Query Audit Logs

```typescript
import { IntegrationAuditLog } from './integrations';

// Get all failed actions in last 24 hours
const failures = await IntegrationAuditLog.find({
  tenantId: tenantId,
  result: 'failure',
  createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
}).sort({ createdAt: -1 });

// Get flagged events requiring investigation
const flagged = await IntegrationAuditLog.find({
  flaggedForReview: true,
  investigation: { $exists: true, $eq: {} }
});

// Get sensitive data access
const sensitiveAccess = await IntegrationAuditLog.find({
  involvesSensitiveData: true,
  createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
});
```

## Webhook Handling

### 1. Receive and Verify Webhook

```typescript
import { BaseProviderAdapter } from './integrations';
import { WebhookEventPayload } from './integrations';

async function handleWebhook(
  payload: string,
  signature: string,
  connection: IProviderConnection
) {
  try {
    // Get adapter
    const registry = getProviderRegistry();
    const adapterFactory = registry.getAdapterFactory(connection.providerId);
    const adapter = new adapterFactory({
      tenantContext: {
        tenantId: connection.tenantId.toString()
      },
      config: connection.config
    });

    // Verify webhook event
    const event: WebhookEventPayload = await adapter.verifyWebhookEvent(
      payload,
      signature
    );

    // Check for duplicate (idempotency)
    const existing = await IntegrationAuditLog.findOne({
      correlationId: event.idempotencyKey,
      action: 'WEBHOOK_RECEIVED'
    });

    if (existing) {
      console.log('Duplicate webhook, ignoring');
      return;
    }

    // Process webhook
    await processWebhookEvent(event, connection);

    // Log successful webhook
    await logAuditEvent(
      'WEBHOOK_RECEIVED',
      connection.tenantId.toString(),
      'system',
      connection.providerId,
      'success',
      {
        eventType: event.eventType,
        eventId: event.data.eventId
      }
    );

  } catch (error) {
    // Log failed webhook
    await logAuditEvent(
      'WEBHOOK_FAILED',
      connection.tenantId.toString(),
      'system',
      connection.providerId,
      'failure',
      {
        error: error.message
      }
    );

    throw error;
  }
}

async function processWebhookEvent(
  event: WebhookEventPayload,
  connection: IProviderConnection
) {
  switch (event.eventType) {
    case 'message.received':
      await handleMessageReceived(event, connection);
      break;
    case 'message.sent':
      await handleMessageSent(event, connection);
      break;
    case 'message.failed':
      await handleMessageFailed(event, connection);
      break;
    // ... other event types
  }
}
```

### 2. Webhook Endpoint Setup

```typescript
import express from 'express';
import { ProviderConnection } from './integrations';

const app = express();

// Webhook route
app.post('/webhooks/integrations/:tenantId/:providerId/:webhookToken', async (req, res) => {
  try {
    const { tenantId, providerId, webhookToken } = req.params;
    const payload = JSON.stringify(req.body);
    const signature = req.headers['x-signature'] as string;

    // Find connection
    const connection = await ProviderConnection.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      providerId,
      'webhookConfig.webhookToken': webhookToken
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Handle webhook
    await handleWebhook(payload, signature, connection);

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## Error Handling

### 1. Handle Integration Errors

```typescript
import {
  IntegrationError,
  ProviderNotFoundError,
  AuthenticationError,
  RateLimitError,
  ConnectionNotFoundError
} from './integrations';

async function executeIntegrationAction() {
  try {
    // ... action ...
  } catch (error) {
    if (error instanceof ProviderNotFoundError) {
      // Provider doesn't exist
      return res.status(404).json({ error: 'Provider not available' });
    } else if (error instanceof AuthenticationError) {
      // Auth failed
      return res.status(401).json({ error: 'Authentication failed' });
    } else if (error instanceof RateLimitError) {
      // Rate limited
      return res.status(429).json({ error: 'Rate limit exceeded' });
    } else if (error instanceof IntegrationError) {
      // Generic integration error
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    } else {
      // Unknown error
      return res.status(500).json({ error: 'Unknown error' });
    }
  }
}
```

## RBAC - Access Control

### 1. Grant Connection Access

```typescript
import { IProviderConnection } from './integrations';

async function grantConnectionAccess(
  connection: IProviderConnection,
  userId: string,
  role: 'viewer' | 'operator' | 'admin'
) {
  connection.accessControl = connection.accessControl || [];

  // Check if user already has access
  const existing = connection.accessControl.find(ac => ac.userId === userId);

  if (existing) {
    existing.role = role;
  } else {
    connection.accessControl.push({
      userId,
      role,
      grantedAt: new Date(),
      grantedBy: 'admin-id'
    });
  }

  await connection.save();
}
```

### 2. Check Access

```typescript
function hasConnectionAccess(
  connection: IProviderConnection,
  userId: string,
  requiredRole: 'viewer' | 'operator' | 'admin'
): boolean {
  const access = connection.accessControl?.find(ac => ac.userId === userId);
  
  if (!access) return false;

  // Role hierarchy: admin > operator > viewer
  const roleHierarchy: Record<string, number> = {
    viewer: 1,
    operator: 2,
    admin: 3
  };

  return roleHierarchy[access.role] >= roleHierarchy[requiredRole];
}
```

## Connection Management

### 1. Update Connection

```typescript
async function updateConnection(
  connectionId: string,
  updates: Partial<IProviderConnection>
) {
  const connection = await ProviderConnection.findById(connectionId);
  
  if (!connection) {
    throw new Error('Connection not found');
  }

  // Update fields
  Object.assign(connection, updates);

  // Log audit
  await logAuditEvent(
    'UPDATE_CREDENTIALS',
    connection.tenantId.toString(),
    'user-id',
    connection.providerId,
    'success',
    { fields: Object.keys(updates) }
  );

  await connection.save();
  
  return connection;
}
```

### 2. Disable Connection

```typescript
async function disableConnection(
  connectionId: string,
  reason: string
) {
  const connection = await ProviderConnection.findById(connectionId);
  
  if (!connection) {
    throw new Error('Connection not found');
  }

  connection.status = 'inactive';
  connection.disabledUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  await connection.save();

  // Log audit
  await logAuditEvent(
    'DISCONNECT_PROVIDER',
    connection.tenantId.toString(),
    'system',
    connection.providerId,
    'success',
    { reason }
  );
}
```

### 3. Re-enable Connection

```typescript
async function reEnableConnection(connectionId: string) {
  const connection = await ProviderConnection.findById(connectionId);
  
  if (!connection) {
    throw new Error('Connection not found');
  }

  // Test connection first
  const isHealthy = await testConnection(connection);

  if (isHealthy) {
    connection.status = 'active';
    connection.disabledUntil = undefined;
    connection.failureCount = 0;
  }

  await connection.save();
  
  return isHealthy;
}
```

## Statistics and Monitoring

### 1. Get Connection Stats

```typescript
async function getConnectionStats(connectionId: string) {
  const connection = await ProviderConnection.findById(connectionId);
  
  if (!connection) {
    throw new Error('Connection not found');
  }

  return {
    status: connection.status,
    totalRequests: connection.stats?.totalRequests || 0,
    totalErrors: connection.stats?.totalErrors || 0,
    errorRate: connection.stats?.totalRequests 
      ? (connection.stats.totalErrors / connection.stats.totalRequests * 100).toFixed(2)
      : 0,
    lastUsedAt: connection.stats?.lastUsedAt,
    quotaUsed: connection.stats?.quotaUsed || 0,
    quotaLimit: connection.stats?.quotaLimit,
    isHealthy: connection.canBeUsed,
    nextAutoSync: connection.autoSync?.nextSyncAt
  };
}
```

### 2. Get Provider Stats

```typescript
function getProviderStatistics() {
  const registry = getProviderRegistry();
  return registry.getStatistics();
  // Returns: {
  //   totalProviders: 15,
  //   byCategory: { MESSAGING: 3, CALLING: 2, GPS: 1, ... },
  //   active: 12,
  //   inactive: 3
  // }
}
```

## Testing

### 1. Unit Test Adapter

```typescript
import { BaseProviderAdapter } from './integrations';

class MockAdapter extends BaseProviderAdapter {
  getProviderId(): string {
    return 'mock-provider';
  }

  async executeAction(request) {
    if (request.action === 'fail') {
      return this.buildResponse(false, undefined, {
        code: 'TEST_ERROR',
        message: 'Test error'
      });
    }

    return this.buildResponse(true, { result: 'success' });
  }
}

// Test
const adapter = new MockAdapter({
  tenantContext: { tenantId: 'test' },
  config: { apiKey: 'test' }
});

const response = await adapter.executeAction({
  action: 'test',
  tenantId: 'test',
  data: {}
});

expect(response.success).toBe(true);
```

## Environment Variables

```bash
# Integration Hub Configuration
INTEGRATION_ENCRYPTION_KEY=your-secret-key
PROVIDER_HEALTH_CHECK_INTERVAL=300000  # 5 minutes
WEBHOOK_TIMEOUT=30000  # 30 seconds
WEBHOOK_RETRY_ATTEMPTS=3

# Legacy providers (backward compatibility)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=...
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
```

## Troubleshooting

### Provider Not Available
```typescript
// Check if provider is registered
const registry = getProviderRegistry();
const stats = registry.getStatistics();
console.log('Available providers:', stats);

// Check provider details
try {
  const provider = registry.getProvider('twilio');
  console.log('Provider active:', provider.isActive);
} catch (error) {
  console.error('Provider not found');
}
```

### Connection Not Working
```typescript
// Check connection status
const connection = await ProviderConnection.findById(connectionId);
console.log('Status:', connection.status);
console.log('Can be used:', connection.canBeUsed);
console.log('Failure count:', connection.failureCount);
console.log('Is expired:', connection.isExpired);
console.log('Is disabled:', connection.isDisabled);

// Test connection
const isHealthy = await testConnection(connection);
console.log('Health:', isHealthy);
```

### Webhook Issues
```typescript
// Check webhook configuration
const connection = await ProviderConnection.findById(connectionId);
console.log('Webhook token:', connection.webhookConfig?.webhookToken);
console.log('Webhook verified:', connection.webhookConfig?.verified);
console.log('Events:', connection.webhookConfig?.events);

// Verify webhook manually
try {
  const event = await adapter.verifyWebhookEvent(payload, signature);
  console.log('Webhook verified:', event);
} catch (error) {
  console.error('Webhook verification failed:', error.message);
}
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-12  
**Status**: Ready for Use
