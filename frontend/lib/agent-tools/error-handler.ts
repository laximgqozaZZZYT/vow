/**
 * Agent Tools - Error Handler
 *
 * Error handling utilities for AI agent tool execution.
 * Includes retry with exponential backoff and circuit breaker patterns.
 */

// ============================================================================
// Retry Configuration
// ============================================================================

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds (doubles each attempt) */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number;
  /** Whether to add jitter to delays (recommended for distributed systems) */
  jitter: boolean;
  /** Custom function to determine if an error should be retried */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 16000,
  jitter: true,
};

// ============================================================================
// Retry Implementation
// ============================================================================

/**
 * Execute a function with retry logic using exponential backoff.
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration options
 * @returns Promise resolving to the function result
 * @throws Last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchFromAPI(),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, jitter, shouldRetry } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error = new Error('No attempts made');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't delay after the last attempt
      if (attempt < maxRetries) {
        const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Calculate delay for the current attempt with exponential backoff.
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter: boolean
): number {
  // Exponential backoff: base * 2^attempt
  let delay = baseDelayMs * Math.pow(2, attempt);

  // Cap at maximum
  delay = Math.min(delay, maxDelayMs);

  // Add jitter (0-50% of delay) to prevent thundering herd
  if (jitter) {
    delay = delay + Math.random() * delay * 0.5;
  }

  return Math.floor(delay);
}

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit breaker states.
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Configuration for circuit breaker.
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in milliseconds before attempting to reset */
  resetTimeMs: number;
  /** Number of successful calls in half-open state before closing */
  successThreshold: number;
  /** Custom function to determine if an error counts as failure */
  isFailure?: (error: Error) => boolean;
}

/**
 * Default circuit breaker configuration.
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeMs: 60000,
  successThreshold: 2,
};

/**
 * Circuit breaker error thrown when circuit is open.
 */
export class CircuitOpenError extends Error {
  constructor(
    message: string,
    public readonly resetAt: Date
  ) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Circuit Breaker implementation for fault tolerance.
 *
 * Prevents cascading failures by temporarily disabling calls to a failing service.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold exceeded, requests blocked
 * - HALF-OPEN: Testing if service recovered, limited requests allowed
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeMs: 30000 });
 *
 * try {
 *   const result = await breaker.execute(() => callExternalService());
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     console.log('Service temporarily unavailable');
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private lastFailure: Date | null = null;
  private state: CircuitState = 'closed';
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * @param fn - Async function to execute
   * @returns Promise resolving to the function result
   * @throws CircuitOpenError if circuit is open
   * @throws Original error if execution fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      const resetAt = new Date((this.lastFailure?.getTime() ?? 0) + this.config.resetTimeMs);

      if (Date.now() >= resetAt.getTime()) {
        this.state = 'half-open';
        this.successes = 0;
      } else {
        throw new CircuitOpenError(
          `Circuit breaker is open. Will retry after ${resetAt.toISOString()}`,
          resetAt
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if this error should count as a failure
      if (this.config.isFailure && !this.config.isFailure(err)) {
        throw error;
      }

      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution.
   */
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.reset();
      }
    } else {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution.
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === 'half-open') {
      // Any failure in half-open returns to open
      this.state = 'open';
      this.successes = 0;
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * Reset the circuit breaker to closed state.
   */
  private reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
  }

  /**
   * Get current circuit breaker state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure count.
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Manually force the circuit to open.
   */
  forceOpen(): void {
    this.state = 'open';
    this.lastFailure = new Date();
  }

  /**
   * Manually force the circuit to close.
   */
  forceClose(): void {
    this.reset();
  }
}

// ============================================================================
// Combined Utilities
// ============================================================================

/**
 * Execute a function with both circuit breaker and retry logic.
 *
 * The circuit breaker wraps the retry logic, so if the circuit opens,
 * retries will not be attempted until the circuit resets.
 *
 * @param fn - Async function to execute
 * @param circuitBreaker - Circuit breaker instance
 * @param retryConfig - Retry configuration
 * @returns Promise resolving to the function result
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker();
 *
 * const result = await withCircuitBreakerAndRetry(
 *   () => callExternalService(),
 *   breaker,
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function withCircuitBreakerAndRetry<T>(
  fn: () => Promise<T>,
  circuitBreaker: CircuitBreaker,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  return circuitBreaker.execute(() => withRetry(fn, retryConfig));
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Check if an error is retryable (transient).
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('econnreset')
  ) {
    return true;
  }

  // Rate limiting
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return true;
  }

  // Server errors (5xx)
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return true;
  }

  return false;
}

/**
 * Check if an error indicates a permanent failure (should not retry).
 */
export function isPermanentError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Authentication/Authorization errors
  if (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return true;
  }

  // Not found
  if (message.includes('not found') || message.includes('404')) {
    return true;
  }

  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    return true;
  }

  return false;
}
