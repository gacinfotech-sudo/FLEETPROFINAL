/**
 * Generic retry-with-exponential-backoff helper. Used to wrap a single
 * adapter call (poll) or store attempt (webhook) so a transient failure
 * (network blip, provider rate limit, momentary DB hiccup) doesn't
 * immediately count as a hard failure, while a genuinely down provider
 * still fails fast enough not to block the rest of a poll tick.
 *
 * See this task's report, "Retry/backoff parameters", for the reasoning
 * behind `DEFAULT_RETRY_BACKOFF`'s specific numbers.
 */
export interface RetryBackoffOptions {
  maxAttempts: number;
  baseDelayMs: number;
  factor: number;
  maxDelayMs: number;
}

export interface RetryBackoffRuntimeOptions extends RetryBackoffOptions {
  onAttemptFailure?: (attempt: number, error: unknown) => void;
  /** Injectable for tests — avoids real timers in unit tests. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Default backoff for the polling path: 4 attempts, 2s base delay, ×2
 * factor, capped at 10s per attempt → delays of 2s/4s/8s/10s (last one
 * capped), ~24s total worst case. Reasoning:
 * - 4 attempts is enough to ride out a brief network blip or a provider's
 *   own rate-limit backoff window without treating every transient error as
 *   a hard outage.
 * - The ~24s worst-case total stays comfortably under the polling
 *   scheduler's base tick (15s) × 2 and under the minimum configurable
 *   `GpsConnection.pollingIntervalSeconds` (30s per its schema's `min`), so
 *   one struggling device's retries can't meaningfully starve the same
 *   connection's other devices for more than roughly one polling cycle.
 * - Capping at 10s/attempt (rather than letting ×2 grow unbounded) keeps
 *   any single attempt from waiting longer than a typical polling interval
 *   itself would.
 */
export const DEFAULT_RETRY_BACKOFF: RetryBackoffOptions = {
  maxAttempts: 4,
  baseDelayMs: 2000,
  factor: 2,
  maxDelayMs: 10000,
};

/**
 * Backoff for the webhook path: fewer, faster attempts (3 attempts, 500ms
 * base, capped at 2s) — a webhook handler must respond to the provider
 * within its own retry/timeout budget (most providers' documented webhook
 * timeouts are single-digit seconds), so it can't afford the polling path's
 * ~24s worst case.
 */
export const WEBHOOK_RETRY_BACKOFF: RetryBackoffOptions = {
  maxAttempts: 3,
  baseDelayMs: 500,
  factor: 2,
  maxDelayMs: 2000,
};

export async function withRetryBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: Partial<RetryBackoffRuntimeOptions> = {},
): Promise<T> {
  const opts: RetryBackoffRuntimeOptions = { ...DEFAULT_RETRY_BACKOFF, ...options };
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      opts.onAttemptFailure?.(attempt, error);
      if (attempt === opts.maxAttempts) break;
      const delay = Math.min(opts.baseDelayMs * opts.factor ** (attempt - 1), opts.maxDelayMs);
      await sleep(delay);
    }
  }
  throw lastError;
}
