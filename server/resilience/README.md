# Production Hardening - Resilience System

Comprehensive production-grade resilience patterns for distributed notification system with circuit breakers, bulkhead isolation, adaptive timeout management, and fault tolerance.

## Components

### 1. Circuit Breaker (`CircuitBreaker.ts`)
**Purpose**: Prevent cascading failures by fast-failing when a service is unavailable.

**States**:
- `CLOSED`: Normal operation, all requests pass through
- `OPEN`: Failure threshold exceeded, requests fail immediately
- `HALF_OPEN`: Testing if service recovered, limited requests allowed

**Features**:
- Per-provider circuit breakers
- Fail-fast pattern prevents resource waste
- Automatic recovery with half-open testing
- Detailed metrics (success rate, response times, p95/p99)
- Event-driven architecture

**Configuration**:
```typescript
{
  provider: string;
  failureThreshold: number;      // 0-100, % failures to trigger open
  failureCount: number;          // Consecutive failures threshold
  successThreshold: number;      // Consecutive successes to close
  timeout: number;               // Time before half-open testing (ms)
  halfOpenRequests: number;      // Requests to test recovery
  cooldown: number;              // Additional cooldown after failure
}
```

**Usage**:
```typescript
import { circuitBreakerFactory } from './resilience';

const breaker = circuitBreakerFactory.getBreaker('sendgrid');

// Execute with circuit breaker protection
const result = await breaker.execute(
  () => sendEmail(data),
  () => queueEmailForRetry(data) // Fallback
);

// Check status
console.log(breaker.getState());        // CLOSED, OPEN, HALF_OPEN
console.log(breaker.getMetrics());      // Detailed metrics
console.log(breaker.isAvailable());     // Boolean check
```

---

### 2. Bulkhead Pattern (`BulkheadPattern.ts`)
**Purpose**: Isolate resources per provider to prevent one from affecting others.

**Features**:
- Resource isolation (thread pools)
- Queue depth limits with backpressure
- Three rejection policies: ABORT, RETRY, CALLER_RUNS
- Graceful degradation under load
- Real-time utilization monitoring

**Configuration**:
```typescript
{
  provider: string;
  maxConcurrent: number;         // Max concurrent operations
  maxQueueSize: number;          // Max queued operations
  maxQueueWaitTime: number;      // Max queue wait time (ms)
  rejectionPolicy: string;       // ABORT | RETRY | CALLER_RUNS
  timeout: number;               // Operation timeout (ms)
  monitoringInterval: number;    // Metrics update interval (ms)
}
```

**Usage**:
```typescript
import { bulkheadFactory } from './resilience';

const bulkhead = bulkheadFactory.getBulkhead('twilio', {
  maxConcurrent: 10,
  maxQueueSize: 100,
  rejectionPolicy: 'RETRY'
});

// Submit operation to bulkhead
const result = await bulkhead.submit(() => sendSMS(data));

// Check status
console.log(bulkhead.getStatus());     // Utilization, queue size, health
console.log(bulkhead.getMetrics());    // Detailed metrics
```

---

### 3. Timeout Management (`TimeoutManagement.ts`)
**Purpose**: Adaptive timeout tuning and retry budget management.

**Features**:
- Adaptive timeout adjustment based on latency
- Request timeout escalation for retries
- Retry budget per cycle (prevents retry storms)
- Percentile-based adaptation (p95/p99)
- Response time tracking with percentiles

**Configuration**:
```typescript
{
  provider: string;
  initialTimeout: number;        // Starting timeout (ms)
  minTimeout: number;            // Minimum timeout
  maxTimeout: number;            // Maximum timeout
  adaptiveMode: boolean;         // Enable adaptive tuning
  escalationFactor: number;      // Retry timeout multiplier
  maxEscalations: number;        // Max retry escalations
  percentileTarget: number;      // Target percentile (e.g., 95)
  sampleSize: number;            // Latency samples for stats
}
```

**Usage**:
```typescript
import { timeoutManagerFactory } from './resilience';

const manager = timeoutManagerFactory.getManager('sendgrid', {
  initialTimeout: 5000,
  adaptiveMode: true,
  escalationFactor: 1.5
});

// Get timeout for operation
const timeout = manager.getTimeout(isRetry);

// Record operation latency
manager.recordLatency(actualDuration, timedOut);

// Check retry budget
if (manager.canRetry()) {
  manager.spendBudget(1);
  // Perform retry
}

// Check status
console.log(manager.getMetrics());
console.log(manager.getTimeoutStats());
console.log(manager.getBudgetStatus());
```

---

### 4. Fault Tolerance (`FaultTolerance.ts`)
**Purpose**: Comprehensive fault tolerance orchestrating all patterns.

**Retry Strategies**:
- `LINEAR`: 1s, 2s, 3s, 4s, 5s
- `EXPONENTIAL`: 1s, 2s, 4s, 8s, 16s
- `FIBONACCI`: 1s, 1s, 2s, 3s, 5s

**Features**:
- Integrated circuit breaker + bulkhead + timeout
- Configurable retry strategies with jitter
- Fallback chains for degradation
- Cascading failure detection
- Permanent error detection
- Self-healing patterns

**Configuration**:
```typescript
{
  provider: string;
  maxRetries: number;            // Max retry attempts
  retryStrategy: string;         // LINEAR | EXPONENTIAL | FIBONACCI
  baseDelay: number;             // Base delay for backoff (ms)
  maxDelay: number;              // Maximum delay (ms)
  jitterFraction: number;        // 0.0-1.0, randomness in delay
  circuitBreaker: CircuitBreaker;
  bulkhead: BulkheadIsolation;
  timeoutManager: TimeoutManager;
  fallbackChain?: Array<() => Promise<T>>;
}
```

**Usage**:
```typescript
import { initializeResilienceForProvider } from './resilience';

const { faultTolerance } = initializeResilienceForProvider('sendgrid');

// Execute with full fault tolerance
const result = await faultTolerance.execute(
  () => sendEmail(data),
  'sendEmail'
);

// Execute with fallback chain
const result = await faultTolerance.executeWithFallback(
  () => primarySend(data),
  [
    () => fallbackSend1(data),
    () => fallbackSend2(data),
    () => fallbackQueue(data)
  ],
  'sendEmail'
);

// Check health
console.log(faultTolerance.getHealthStatus());
console.log(faultTolerance.getMetrics());
```

---

## API Endpoints

All endpoints are prefixed with `/api/resilience/`.

### Circuit Breaker Endpoints

```
GET    /circuit-breakers                    # Get all circuit breaker status
GET    /circuit-breakers/:provider          # Get specific breaker status
POST   /circuit-breakers/:provider/reset    # Reset specific breaker
POST   /circuit-breakers/reset-all          # Reset all breakers
```

### Bulkhead Endpoints

```
GET    /bulkheads                           # Get all bulkhead status
GET    /bulkheads/:provider                 # Get specific bulkhead status
POST   /bulkheads/:provider/drain           # Drain bulkhead queue
```

### Timeout Endpoints

```
GET    /timeouts                            # Get all timeout stats
GET    /timeouts/:provider                  # Get specific timeout stats
POST   /timeouts/:provider/set              # Set manual timeout
```

### Monitoring Endpoints

```
GET    /health                              # Comprehensive health report
GET    /fault-tolerance/:provider           # Get fault tolerance status
POST   /fault-tolerance/reset               # Reset fault tolerance metrics
GET    /dashboard                           # Complete dashboard data
GET    /metrics/export                      # Prometheus format metrics
```

---

## Integration Example

```typescript
import {
  initializeResilienceForProvider,
  faultToleranceOrchestrator
} from './resilience';

// Initialize for each provider
const sendgridResilience = initializeResilienceForProvider('sendgrid', {
  circuitBreakerConfig: {
    failureThreshold: 50,
    timeout: 30000
  },
  bulkheadConfig: {
    maxConcurrent: 10,
    maxQueueSize: 100,
    rejectionPolicy: 'RETRY'
  },
  timeoutConfig: {
    initialTimeout: 5000,
    adaptiveMode: true
  },
  faultToleranceConfig: {
    maxRetries: 3,
    retryStrategy: 'EXPONENTIAL'
  }
});

const twilioResilience = initializeResilienceForProvider('twilio', {
  bulkheadConfig: {
    maxConcurrent: 20,
    maxQueueSize: 50
  }
});

// Use in application
async function sendNotification(channel: 'email' | 'sms', data: any) {
  const resilience = 
    channel === 'email' ? sendgridResilience : twilioResilience;

  try {
    return await resilience.faultTolerance.execute(
      () => channelSend(channel, data),
      `send${channel}Notification`
    );
  } catch (error) {
    logger.error(`Failed to send ${channel}:`, error);
    throw error;
  }
}

// Monitor health
app.get('/api/health/resilience', (req, res) => {
  const report = faultToleranceOrchestrator.getHealthReport();
  res.json(report);
});
```

---

## Monitoring & Alerts

### Key Metrics

1. **Circuit Breaker**
   - State (CLOSED/OPEN/HALF_OPEN)
   - Request counts (total, success, failed, rejected)
   - Response times (avg, p95, p99)
   - State change count

2. **Bulkhead**
   - Concurrent operations count
   - Queue depth and peak size
   - Wait times (avg, max)
   - Utilization percent

3. **Timeout**
   - Current timeout
   - Latency percentiles (p50, p95, p99)
   - Timeout count and rate
   - Adaptive adjustments

4. **Fault Tolerance**
   - Success rate
   - Retry rate
   - Fallback usage
   - Cascading failure risk

### Alert Conditions

- **CRITICAL**: Circuit breaker open, cascading failures detected
- **HIGH**: Bulkhead queue full, very high utilization, timeout escalation
- **MEDIUM**: Circuit breaker in half-open, moderate utilization increase
- **LOW**: Adaptive timeout adjustment, retry budget high usage

---

## Best Practices

1. **Configuration Per Provider**
   - Tailor settings to provider characteristics
   - Use different thresholds for different channels
   - Monitor and adjust based on metrics

2. **Fallback Chains**
   - Always have degraded service capability
   - Chain multiple fallback strategies
   - Prefer caching/queueing over complete failure

3. **Monitoring**
   - Set up alerts for open circuit breakers
   - Track timeout escalation trends
   - Monitor cascading failure detection

4. **Graceful Degradation**
   - Reject new requests rather than queuing indefinitely
   - Implement customer notifications
   - Prefer partial success over complete failure

5. **Testing**
   - Test circuit breaker transitions
   - Load test bulkhead queue limits
   - Simulate timeout scenarios

---

## Performance Characteristics

- **Circuit Breaker**: O(1) state checking, ~1ms overhead per operation
- **Bulkhead**: O(1) queue operations, ~2ms queue wait on average
- **Timeout**: O(1) timeout calculation, adaptive adjustment every 10+ samples
- **Fault Tolerance**: O(retries) with exponential/fibonacci backoff

---

## Troubleshooting

### Circuit Breaker Won't Close
- Check if service is actually healthy
- Verify half-open testing is succeeding
- Check timeout configuration for recovery window

### High Bulkhead Queue
- Increase `maxConcurrent` if provider can handle it
- Change `rejectionPolicy` to `CALLER_RUNS`
- Add more resources to provider

### Timeout Escalating Too Much
- Reduce initial timeout
- Disable adaptive mode if too aggressive
- Check if provider is genuinely slow

### Cascading Failures Detected
- Check downstream services
- Review circuit breaker state of all providers
- Look for resource contention

---

## Production Deployment

1. Monitor metrics for 24 hours before production
2. Set conservative thresholds initially
3. Gradually increase thresholds based on metrics
4. Enable alerts for all critical conditions
5. Have runbooks for common issues
6. Test circuit breaker recovery procedures
