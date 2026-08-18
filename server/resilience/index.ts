/**
 * resilience/index.ts
 * Central export point for all resilience patterns and utilities
 */

export {
  CircuitBreaker,
  CircuitState,
  CircuitEvent,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerEvent,
  CircuitBreakerFactory,
  circuitBreakerFactory,
} from './CircuitBreaker';

export {
  BulkheadIsolation,
  BulkheadConfig,
  BulkheadMetrics,
  BulkheadEvent,
  BulkheadFactory,
  bulkheadFactory,
} from './BulkheadPattern';

export {
  TimeoutManager,
  TimeoutConfig,
  TimeoutMetrics,
  RetryBudget,
  TimeoutManagerFactory,
  timeoutManagerFactory,
} from './TimeoutManagement';

export {
  FaultTolerance,
  FaultToleranceConfig,
  FaultToleranceMetrics,
  RetryContext,
  RetryStrategy,
  FaultToleranceOrchestrator,
  faultToleranceOrchestrator,
} from './FaultTolerance';

export { default as resilienceRoutes } from './routes';

// ============ Type Definitions ============

export interface ResilienceSystemConfig {
  enabled: boolean;
  circuitBreakerConfig?: {
    failureThreshold?: number;
    failureCount?: number;
    successThreshold?: number;
    timeout?: number;
    halfOpenRequests?: number;
  };
  bulkheadConfig?: {
    maxConcurrent?: number;
    maxQueueSize?: number;
    maxQueueWaitTime?: number;
    rejectionPolicy?: 'ABORT' | 'RETRY' | 'CALLER_RUNS';
    timeout?: number;
  };
  timeoutConfig?: {
    initialTimeout?: number;
    minTimeout?: number;
    maxTimeout?: number;
    adaptiveMode?: boolean;
    escalationFactor?: number;
    maxEscalations?: number;
  };
  faultToleranceConfig?: {
    maxRetries?: number;
    retryStrategy?: 'LINEAR' | 'EXPONENTIAL' | 'FIBONACCI';
    baseDelay?: number;
    maxDelay?: number;
    jitterFraction?: number;
  };
}

/**
 * Initialize resilience system for a provider
 */
export function initializeResilienceForProvider(
  provider: string,
  config?: ResilienceSystemConfig
): {
  circuitBreaker: CircuitBreaker;
  bulkhead: BulkheadIsolation;
  timeoutManager: TimeoutManager;
  faultTolerance: FaultTolerance;
} {
  const circuitBreaker = circuitBreakerFactory.getBreaker(provider, config?.circuitBreakerConfig);
  const bulkhead = bulkheadFactory.getBulkhead(provider, config?.bulkheadConfig);
  const timeoutManager = timeoutManagerFactory.getManager(provider, config?.timeoutConfig);

  const faultTolerance = new FaultTolerance({
    provider,
    maxRetries: config?.faultToleranceConfig?.maxRetries || 3,
    retryStrategy: config?.faultToleranceConfig?.retryStrategy || 'EXPONENTIAL',
    baseDelay: config?.faultToleranceConfig?.baseDelay || 100,
    maxDelay: config?.faultToleranceConfig?.maxDelay || 30000,
    jitterFraction: config?.faultToleranceConfig?.jitterFraction || 0.1,
    circuitBreaker,
    bulkhead,
    timeoutManager,
  });

  faultToleranceOrchestrator.register(faultTolerance, provider);

  return {
    circuitBreaker,
    bulkhead,
    timeoutManager,
    faultTolerance,
  };
}

/**
 * Cleanup resilience system
 */
export function cleanupResilienceSystem(): void {
  // Shutdown all bulkheads
  bulkheadFactory.shutdownAll();

  // Shutdown all timeout managers
  timeoutManagerFactory.shutdownAll();
}
