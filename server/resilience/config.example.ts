/**
 * config.example.ts
 * Example configurations for different notification providers
 * Copy and customize for your environment
 */

import { ResilienceSystemConfig } from './index';

/**
 * SendGrid Email Provider Configuration
 * High throughput, reliable, can handle 100+ concurrent requests
 */
export const sendgridConfig: ResilienceSystemConfig = {
  enabled: true,
  circuitBreakerConfig: {
    failureThreshold: 50,           // 50% error rate triggers open
    failureCount: 5,                // Or 5 consecutive failures
    successThreshold: 2,            // 2 successes in half-open to close
    timeout: 30000,                 // 30s before attempting recovery
    halfOpenRequests: 3,            // Test with 3 requests in half-open
  },
  bulkheadConfig: {
    maxConcurrent: 50,              // 50 concurrent email sends
    maxQueueSize: 500,              // Queue up to 500 pending
    maxQueueWaitTime: 60000,        // Wait max 60s in queue
    rejectionPolicy: 'RETRY',       // Retry if queue full
    timeout: 30000,                 // Operation timeout 30s
  },
  timeoutConfig: {
    initialTimeout: 10000,          // Start with 10s timeout
    minTimeout: 5000,               // Don't go below 5s
    maxTimeout: 30000,              // Cap at 30s
    adaptiveMode: true,             // Enable adaptive tuning
    escalationFactor: 1.5,          // 1.5x for each retry
    maxEscalations: 3,              // Max 3 retry escalations
  },
  faultToleranceConfig: {
    maxRetries: 3,                  // Retry up to 3 times
    retryStrategy: 'EXPONENTIAL',   // Use exponential backoff
    baseDelay: 500,                 // Start with 500ms
    maxDelay: 30000,                // Cap delay at 30s
    jitterFraction: 0.1,            // 10% randomness
  },
};

/**
 * Twilio SMS Provider Configuration
 * Lower throughput than email, strict rate limits
 */
export const twilioConfig: ResilienceSystemConfig = {
  enabled: true,
  circuitBreakerConfig: {
    failureThreshold: 40,           // More sensitive than email
    failureCount: 3,                // Lower threshold for SMS
    successThreshold: 3,            // More successes needed
    timeout: 60000,                 // 60s recovery window
    halfOpenRequests: 2,            // Conservative testing
  },
  bulkheadConfig: {
    maxConcurrent: 10,              // SMS has stricter limits
    maxQueueSize: 100,
    maxQueueWaitTime: 45000,
    rejectionPolicy: 'RETRY',
    timeout: 20000,                 // SMS timeout 20s
  },
  timeoutConfig: {
    initialTimeout: 8000,           // 8s for SMS
    minTimeout: 3000,
    maxTimeout: 20000,
    adaptiveMode: true,
    escalationFactor: 2.0,          // Aggressive escalation
    maxEscalations: 2,              // Only 2 escalations
  },
  faultToleranceConfig: {
    maxRetries: 2,                  // Fewer retries for SMS
    retryStrategy: 'EXPONENTIAL',
    baseDelay: 1000,                // Start with 1s
    maxDelay: 20000,
    jitterFraction: 0.2,            // More jitter for SMS
  },
};

/**
 * Firebase Push Notifications Configuration
 * High throughput, high latency tolerance
 */
export const firebaseConfig: ResilienceSystemConfig = {
  enabled: true,
  circuitBreakerConfig: {
    failureThreshold: 60,           // Tolerates higher error rates
    failureCount: 10,               // High threshold
    successThreshold: 5,            // Needs many successes
    timeout: 45000,                 // 45s recovery
    halfOpenRequests: 5,            // More testing requests
  },
  bulkheadConfig: {
    maxConcurrent: 100,             // High throughput
    maxQueueSize: 1000,
    maxQueueWaitTime: 120000,       // 2min queue wait
    rejectionPolicy: 'CALLER_RUNS', // Run on caller thread if needed
    timeout: 60000,                 // 60s timeout
  },
  timeoutConfig: {
    initialTimeout: 15000,          // 15s for push
    minTimeout: 5000,
    maxTimeout: 60000,
    adaptiveMode: true,
    escalationFactor: 1.3,          // Moderate escalation
    maxEscalations: 4,              // Allow more escalations
  },
  faultToleranceConfig: {
    maxRetries: 4,                  // More retries for push
    retryStrategy: 'LINEAR',        // Predictable backoff
    baseDelay: 2000,
    maxDelay: 60000,
    jitterFraction: 0.05,           // Less jitter
  },
};

/**
 * In-App Notification Configuration
 * Local, fast, no external dependencies
 */
export const inAppConfig: ResilienceSystemConfig = {
  enabled: true,
  circuitBreakerConfig: {
    failureThreshold: 80,           // Very tolerant
    failureCount: 20,               // High threshold
    successThreshold: 1,            // Quick recovery
    timeout: 10000,                 // 10s recovery window
    halfOpenRequests: 10,           // Aggressive testing
  },
  bulkheadConfig: {
    maxConcurrent: 200,             // Very high throughput
    maxQueueSize: 2000,
    maxQueueWaitTime: 30000,
    rejectionPolicy: 'CALLER_RUNS',
    timeout: 5000,                  // 5s timeout
  },
  timeoutConfig: {
    initialTimeout: 3000,           // 3s for in-app
    minTimeout: 1000,
    maxTimeout: 10000,
    adaptiveMode: true,
    escalationFactor: 1.2,
    maxEscalations: 2,
  },
  faultToleranceConfig: {
    maxRetries: 1,                  // Minimal retries
    retryStrategy: 'LINEAR',
    baseDelay: 100,
    maxDelay: 5000,
    jitterFraction: 0.0,            // No jitter needed
  },
};

/**
 * Custom Provider Configuration (Template)
 * Adjust these values based on provider characteristics
 */
export const customProviderTemplate: ResilienceSystemConfig = {
  enabled: true,
  circuitBreakerConfig: {
    failureThreshold: 50,           // Adjust 0-100
    failureCount: 5,                // Adjust based on load
    successThreshold: 2,
    timeout: 30000,                 // Adjust based on recovery time
    halfOpenRequests: 3,
  },
  bulkheadConfig: {
    maxConcurrent: 10,              // Adjust to provider limits
    maxQueueSize: 100,              // 10x concurrent usually good
    maxQueueWaitTime: 30000,
    rejectionPolicy: 'RETRY',
    timeout: 30000,
  },
  timeoutConfig: {
    initialTimeout: 5000,           // Adjust to typical latency
    minTimeout: 1000,               // 1/5 of initial
    maxTimeout: 30000,              // 6x initial
    adaptiveMode: true,
    escalationFactor: 1.5,
    maxEscalations: 3,
  },
  faultToleranceConfig: {
    maxRetries: 3,
    retryStrategy: 'EXPONENTIAL',
    baseDelay: 500,                 // Adjust based on tolerance
    maxDelay: 30000,
    jitterFraction: 0.1,
  },
};

/**
 * Aggressive Configuration (High Reliability)
 * For critical paths that must succeed
 */
export const aggressiveConfig: ResilienceSystemConfig = {
  enabled: true,
  circuitBreakerConfig: {
    failureThreshold: 30,           // Very low threshold
    failureCount: 2,                // Quick open
    successThreshold: 5,            // Many successes needed
    timeout: 60000,                 // Long recovery window
    halfOpenRequests: 1,            // Conservative testing
  },
  bulkheadConfig: {
    maxConcurrent: 5,               // Very limited
    maxQueueSize: 50,
    maxQueueWaitTime: 120000,       // 2min wait
    rejectionPolicy: 'CALLER_RUNS', // Never lose requests
    timeout: 60000,
  },
  timeoutConfig: {
    initialTimeout: 20000,          // Generous timeout
    minTimeout: 10000,
    maxTimeout: 120000,
    adaptiveMode: true,
    escalationFactor: 2.0,          // Aggressive escalation
    maxEscalations: 5,              // Many escalations
  },
  faultToleranceConfig: {
    maxRetries: 5,                  // Many retries
    retryStrategy: 'FIBONACCI',     // Smooth backoff
    baseDelay: 1000,
    maxDelay: 120000,
    jitterFraction: 0.05,
  },
};

/**
 * Lenient Configuration (Best Effort)
 * For non-critical notifications where delivery can be delayed
 */
export const lenientConfig: ResilienceSystemConfig = {
  enabled: true,
  circuitBreakerConfig: {
    failureThreshold: 80,           // High tolerance
    failureCount: 20,               // Very high threshold
    successThreshold: 1,            // Quick recovery
    timeout: 10000,                 // Short recovery window
    halfOpenRequests: 10,           // Aggressive testing
  },
  bulkheadConfig: {
    maxConcurrent: 50,              // Allow many
    maxQueueSize: 1000,             // Large queue
    maxQueueWaitTime: 60000,        // 1min wait
    rejectionPolicy: 'RETRY',       // Always retry
    timeout: 10000,
  },
  timeoutConfig: {
    initialTimeout: 3000,           // Short timeout
    minTimeout: 1000,
    maxTimeout: 10000,
    adaptiveMode: true,
    escalationFactor: 1.2,          // Small escalation
    maxEscalations: 2,
  },
  faultToleranceConfig: {
    maxRetries: 1,                  // Minimal retries
    retryStrategy: 'LINEAR',
    baseDelay: 100,                 // Quick retries
    maxDelay: 5000,
    jitterFraction: 0.2,
  },
};

/**
 * Multi-Provider Configuration Collection
 */
export const providerConfigs = {
  sendgrid: sendgridConfig,
  twilio: twilioConfig,
  firebase: firebaseConfig,
  'in-app': inAppConfig,
};

/**
 * Get configuration for provider
 */
export function getProviderConfig(provider: string): ResilienceSystemConfig {
  return (
    providerConfigs[provider as keyof typeof providerConfigs] ||
    customProviderTemplate
  );
}

/**
 * Get predefined configuration by strategy
 */
export function getConfigByStrategy(
  strategy: 'aggressive' | 'lenient' | 'balanced'
): ResilienceSystemConfig {
  switch (strategy) {
    case 'aggressive':
      return aggressiveConfig;
    case 'lenient':
      return lenientConfig;
    case 'balanced':
    default:
      return sendgridConfig; // Use SendGrid as baseline
  }
}

/**
 * Example: Initialize all providers with their configs
 */
export function initializeAllProviders() {
  const { initializeResilienceForProvider } = require('./index');

  const providers = Object.entries(providerConfigs);
  return providers.map(([provider, config]) => {
    return {
      provider,
      resilience: initializeResilienceForProvider(provider, config),
    };
  });
}
