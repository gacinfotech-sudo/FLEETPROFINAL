/**
 * testing.ts
 * Testing utilities for resilience patterns
 * Simulates various failure scenarios for testing
 */

import { CircuitBreaker } from './CircuitBreaker';
import { BulkheadIsolation } from './BulkheadPattern';
import { TimeoutManager } from './TimeoutManagement';
import { FaultTolerance } from './FaultTolerance';

export enum FailureScenario {
  SUCCESS = 'SUCCESS',
  TRANSIENT_FAILURE = 'TRANSIENT_FAILURE',
  PERMANENT_FAILURE = 'PERMANENT_FAILURE',
  TIMEOUT = 'TIMEOUT',
  CASCADING_FAILURE = 'CASCADING_FAILURE',
}

export interface SimulationConfig {
  totalRequests: number;
  successRate?: number;           // 0-100
  failureRate?: number;           // 0-100
  timeoutRate?: number;           // 0-100
  avgLatency?: number;            // ms
  latencyStdDev?: number;         // ms
  failureScenario?: FailureScenario;
  scenarioDuration?: number;      // ms
}

export interface SimulationResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  timedOutRequests: number;
  circuitBreakerTrips: number;
  bulkheadRejects: number;
  averageLatency: number;
  peakLatency: number;
  minLatency: number;
  successRate: number;
  failureRate: number;
  timeoutRate: number;
  totalDuration: number;
}

/**
 * Simulate operation with specified failure scenario
 */
export async function simulateOperation(
  config: SimulationConfig,
  scenario: FailureScenario = FailureScenario.SUCCESS
): Promise<{ success: boolean; latency: number }> {
  const latency = generateLatency(config.avgLatency || 100, config.latencyStdDev || 20);

  // Add configured delay
  await delay(latency);

  // Generate outcome based on scenario
  switch (scenario) {
    case FailureScenario.SUCCESS:
      return { success: true, latency };

    case FailureScenario.TRANSIENT_FAILURE:
      if (Math.random() < (config.failureRate || 10) / 100) {
        throw new Error('Simulated transient failure');
      }
      return { success: true, latency };

    case FailureScenario.PERMANENT_FAILURE:
      if (Math.random() < (config.failureRate || 10) / 100) {
        throw new Error('Simulated permanent failure (not found)');
      }
      return { success: true, latency };

    case FailureScenario.TIMEOUT:
      if (Math.random() < (config.timeoutRate || 5) / 100) {
        await delay(10000); // Simulate timeout
      }
      return { success: true, latency };

    case FailureScenario.CASCADING_FAILURE:
      // Start with low failure rate, increase over time
      const failureIncline = (config.failureRate || 50) * 2;
      if (Math.random() < failureIncline / 100) {
        throw new Error('Simulated cascading failure');
      }
      return { success: true, latency };

    default:
      return { success: true, latency };
  }
}

/**
 * Run load test against resilience system
 */
export async function runLoadTest(
  faultTolerance: FaultTolerance,
  config: SimulationConfig
): Promise<SimulationResult> {
  const startTime = Date.now();
  const results: Awaited<ReturnType<typeof simulateOperation>>[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  let rejectedRequests = 0;
  let timedOutRequests = 0;
  let circuitBreakerTrips = 0;
  let bulkheadRejects = 0;

  for (let i = 0; i < config.totalRequests; i++) {
    try {
      const result = await faultTolerance.execute(
        () =>
          simulateOperation(config, config.failureScenario || FailureScenario.SUCCESS),
        `loadtest-${i}`
      );
      successfulRequests++;
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('Circuit breaker')) {
        circuitBreakerTrips++;
      } else if (message.includes('Queue')) {
        bulkheadRejects++;
      } else if (message.includes('timeout')) {
        timedOutRequests++;
      } else {
        failedRequests++;
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  const latencies = results.map((r) => r.latency);

  return {
    totalRequests: config.totalRequests,
    successfulRequests,
    failedRequests,
    rejectedRequests,
    timedOutRequests,
    circuitBreakerTrips,
    bulkheadRejects,
    averageLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 0,
    peakLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
    minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
    successRate: (successfulRequests / config.totalRequests) * 100,
    failureRate: (failedRequests / config.totalRequests) * 100,
    timeoutRate: (timedOutRequests / config.totalRequests) * 100,
    totalDuration,
  };
}

/**
 * Test circuit breaker state transitions
 */
export async function testCircuitBreakerTransitions(
  breaker: CircuitBreaker
): Promise<{ transitions: string[]; passed: boolean }> {
  const transitions: string[] = [];

  // Test CLOSED state
  transitions.push(`Initial state: ${breaker.getState()}`);
  if (breaker.getState() !== 'CLOSED') {
    return { transitions, passed: false };
  }

  // Simulate failures to trigger OPEN
  for (let i = 0; i < 10; i++) {
    try {
      await breaker.execute(() => {
        throw new Error('Simulated failure');
      });
    } catch {
      // Expected
    }
  }

  transitions.push(`After failures: ${breaker.getState()}`);
  if (breaker.getState() !== 'OPEN') {
    return { transitions, passed: false };
  }

  // Wait for half-open timeout
  await delay(35000);
  transitions.push(`After timeout: ${breaker.getState()}`);

  // Simulate successful recovery
  try {
    await breaker.execute(() => Promise.resolve('success'));
  } catch {
    // Expected during half-open
  }

  transitions.push(`After recovery attempts: ${breaker.getState()}`);

  return {
    transitions,
    passed: true,
  };
}

/**
 * Test bulkhead queue behavior
 */
export async function testBulkheadQueueing(
  bulkhead: BulkheadIsolation,
  maxConcurrent: number
): Promise<{ queueDepth: number; peakQueueDepth: number; passed: boolean }> {
  const longRunningTasks: Promise<any>[] = [];

  // Submit more tasks than maxConcurrent
  for (let i = 0; i < maxConcurrent * 2; i++) {
    longRunningTasks.push(
      bulkhead
        .submit(() => delay(100))
        .catch(() => {}) // Ignore failures
    );
  }

  const status = bulkhead.getStatus();
  const metrics = bulkhead.getMetrics();

  await Promise.all(longRunningTasks);

  return {
    queueDepth: metrics.currentQueueSize,
    peakQueueDepth: metrics.peakQueueSize,
    passed: metrics.peakQueueSize > 0,
  };
}

/**
 * Test timeout adaptation
 */
export async function testTimeoutAdaptation(
  manager: TimeoutManager,
  samples: number = 50
): Promise<{ adaptations: number; initialTimeout: number; finalTimeout: number }> {
  const initialTimeout = manager.getMetrics().currentTimeout;
  const initialAdjustments = manager.getMetrics().adjustments;

  // Simulate operations with varying latency
  for (let i = 0; i < samples; i++) {
    const latency = Math.random() * 5000; // 0-5s latency
    manager.recordLatency(latency);
  }

  const finalTimeout = manager.getMetrics().currentTimeout;
  const adaptations = manager.getMetrics().adjustments - initialAdjustments;

  return {
    adaptations,
    initialTimeout,
    finalTimeout,
  };
}

/**
 * Test retry logic
 */
export async function testRetryLogic(
  faultTolerance: FaultTolerance,
  config: SimulationConfig
): Promise<{ retries: number; successAfterRetry: number; totalAttempts: number }> {
  const initialMetrics = faultTolerance.getMetrics();
  let successAfterRetry = 0;

  // Simulate operations that might fail and retry
  for (let i = 0; i < config.totalRequests; i++) {
    try {
      await faultTolerance.execute(
        () => simulateOperation(config, FailureScenario.TRANSIENT_FAILURE),
        `retry-test-${i}`
      );
      successAfterRetry++;
    } catch {
      // Expected for some operations
    }
  }

  const finalMetrics = faultTolerance.getMetrics();

  return {
    retries: finalMetrics.retries - initialMetrics.retries,
    successAfterRetry,
    totalAttempts: finalMetrics.totalAttempts - initialMetrics.totalAttempts,
  };
}

/**
 * Test cascading failure detection
 */
export async function testCascadingFailureDetection(
  faultTolerance: FaultTolerance,
  failureRate: number = 90
): Promise<{ cascadingFailuresDetected: number; passed: boolean }> {
  const initialMetrics = faultTolerance.getMetrics();

  // Simulate high failure rate
  for (let i = 0; i < 50; i++) {
    try {
      await faultTolerance.execute(
        () =>
          simulateOperation({ totalRequests: 1, failureRate }, FailureScenario.TRANSIENT_FAILURE),
        `cascading-test-${i}`
      );
    } catch {
      // Expected
    }
  }

  const finalMetrics = faultTolerance.getMetrics();
  const cascadingDetected =
    finalMetrics.cascadingFailuresPrevented -
    initialMetrics.cascadingFailuresPrevented;

  return {
    cascadingFailuresDetected: cascadingDetected,
    passed: cascadingDetected > 0,
  };
}

/**
 * Generate latency with normal distribution
 */
function generateLatency(mean: number, stdDev: number): number {
  // Box-Muller transform for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const latency = mean + z * stdDev;
  return Math.max(1, latency); // Ensure positive
}

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run comprehensive resilience test suite
 */
export async function runComprehensiveTests(
  faultTolerance: FaultTolerance,
  circuitBreaker: CircuitBreaker,
  bulkhead: BulkheadIsolation,
  timeoutManager: TimeoutManager
): Promise<Record<string, any>> {
  const results: Record<string, any> = {
    timestamp: new Date(),
    tests: {},
  };

  // Test 1: Load test
  try {
    results.tests.loadTest = await runLoadTest(faultTolerance, {
      totalRequests: 100,
      failureRate: 10,
    });
  } catch (error) {
    results.tests.loadTest = { error: error instanceof Error ? error.message : String(error) };
  }

  // Test 2: Circuit breaker transitions
  try {
    results.tests.circuitBreakerTransitions = await testCircuitBreakerTransitions(
      circuitBreaker
    );
  } catch (error) {
    results.tests.circuitBreakerTransitions = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Test 3: Bulkhead queueing
  try {
    results.tests.bulkheadQueueing = await testBulkheadQueueing(bulkhead, 5);
  } catch (error) {
    results.tests.bulkheadQueueing = { error: error instanceof Error ? error.message : String(error) };
  }

  // Test 4: Timeout adaptation
  try {
    results.tests.timeoutAdaptation = await testTimeoutAdaptation(timeoutManager);
  } catch (error) {
    results.tests.timeoutAdaptation = { error: error instanceof Error ? error.message : String(error) };
  }

  // Test 5: Retry logic
  try {
    results.tests.retryLogic = await testRetryLogic(faultTolerance, {
      totalRequests: 50,
      failureRate: 30,
    });
  } catch (error) {
    results.tests.retryLogic = { error: error instanceof Error ? error.message : String(error) };
  }

  return results;
}
