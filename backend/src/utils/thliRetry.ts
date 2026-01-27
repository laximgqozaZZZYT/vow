/**
 * THLI Assessment Retry Logic
 *
 * Implements exponential backoff retry specifically for THLI-24 assessments.
 *
 * Requirements:
 * - 18.1: Retry OpenAI API calls up to 3 times with exponential backoff (2s, 4s, 8s)
 * - 18.2: Save conversation state on failure
 */

import { getLogger } from './logger.js';
import {
  isOpenAIRetryable,
  wrapOpenAIError,
  type OpenAIAPIError,
} from '../errors/openaiErrors.js';

const logger = getLogger('thliRetry');

/**
 * THLI Retry Configuration
 *
 * Requirements: 18.1 - Use delays: 2s, 4s, 8s
 */
export interface THLIRetryConfig {
  /**
   * Maximum number of retries (default: 3)
   */
  maxRetries: number;

  /**
   * Base delay in milliseconds (default: 2000 = 2s)
   */
  baseDelayMs: number;

  /**
   * Custom function to determine if error is retryable
   */
  isRetryable?: (error: unknown) => boolean;

  /**
   * Callback called before each retry attempt
   */
  onRetry?: (attempt: number, delay: number, error: Error) => void;

  /**
   * Callback called when all retries are exhausted
   */
  onExhausted?: (error: Error, attempts: number) => void;
}

/**
 * Default THLI retry configuration
 *
 * Requirements: 18.1 - Retry up to 3 times with delays 2s, 4s, 8s
 */
export const DEFAULT_THLI_RETRY_CONFIG: THLIRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 2000, // 2 seconds
};

/**
 * Result of a retry operation
 */
export interface THLIRetryResult<T> {
  success: boolean;
  result?: T;
  error?: OpenAIAPIError | undefined;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Calculate delay for a given attempt using exponential backoff.
 *
 * Requirements: 18.1 - Use delays: 2s, 4s, 8s
 *
 * @param attempt - The attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Delay in milliseconds
 *
 * @example
 * calculateTHLIDelay(0, 2000) // 2000ms (2s)
 * calculateTHLIDelay(1, 2000) // 4000ms (4s)
 * calculateTHLIDelay(2, 2000) // 8000ms (8s)
 */
export function calculateTHLIDelay(attempt: number, baseDelayMs: number = 2000): number {
  // Exponential backoff: baseDelay * 2^attempt
  // attempt 0: 2000 * 2^0 = 2000ms (2s)
  // attempt 1: 2000 * 2^1 = 4000ms (4s)
  // attempt 2: 2000 * 2^2 = 8000ms (8s)
  return baseDelayMs * Math.pow(2, attempt);
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with THLI-specific retry logic.
 *
 * Requirements:
 * - 18.1: Retry OpenAI API calls up to 3 times with exponential backoff (2s, 4s, 8s)
 * - 18.1: Only retry on retryable errors (429, 5xx)
 *
 * @param fn - The async function to execute
 * @param config - Retry configuration
 * @returns Result with success status, result/error, and attempt info
 *
 * @example
 * const result = await withTHLIRetry(
 *   () => openai.chat.completions.create({ ... }),
 *   { maxRetries: 3, baseDelayMs: 2000 }
 * );
 *
 * if (result.success) {
 *   console.log('Success:', result.result);
 * } else {
 *   console.log('Failed after', result.attempts, 'attempts');
 *   // Save state for resumption
 * }
 */
export async function withTHLIRetry<T>(
  fn: () => Promise<T>,
  config: Partial<THLIRetryConfig> = {}
): Promise<THLIRetryResult<T>> {
  const fullConfig: THLIRetryConfig = { ...DEFAULT_THLI_RETRY_CONFIG, ...config };
  const isRetryable = fullConfig.isRetryable ?? isOpenAIRetryable;

  let lastError: OpenAIAPIError | undefined;
  let totalDelayMs = 0;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      const result = await fn();

      logger.debug('THLI retry succeeded', {
        attempt: attempt + 1,
        totalAttempts: attempt + 1,
        totalDelayMs,
      });

      return {
        success: true,
        result,
        attempts: attempt + 1,
        totalDelayMs,
      };
    } catch (error) {
      lastError = wrapOpenAIError(error);

      // Check if error is retryable
      if (!isRetryable(error)) {
        logger.warning('THLI non-retryable error, failing immediately', {
          errorType: lastError.name,
          errorMessage: lastError.message,
          attempt: attempt + 1,
        });

        fullConfig.onExhausted?.(lastError, attempt + 1);

        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalDelayMs,
        };
      }

      // Check if we have retries left
      if (attempt >= fullConfig.maxRetries) {
        logger.error('THLI all retries exhausted', lastError, {
          totalAttempts: attempt + 1,
          maxRetries: fullConfig.maxRetries,
          totalDelayMs,
        });

        fullConfig.onExhausted?.(lastError, attempt + 1);

        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalDelayMs,
        };
      }

      // Calculate delay and wait
      const delayMs = calculateTHLIDelay(attempt, fullConfig.baseDelayMs);
      totalDelayMs += delayMs;

      logger.warning('THLI retry attempt', {
        attempt: attempt + 1,
        maxRetries: fullConfig.maxRetries,
        delayMs,
        errorType: lastError.name,
        errorMessage: lastError.message,
      });

      fullConfig.onRetry?.(attempt + 1, delayMs, lastError);

      await sleep(delayMs);
    }
  }

  // This should never be reached, but just in case
  return {
    success: false,
    error: lastError,
    attempts: fullConfig.maxRetries + 1,
    totalDelayMs,
  };
}

/**
 * Execute a function with THLI retry logic, throwing on failure.
 *
 * This is a convenience wrapper that throws the error if all retries fail,
 * similar to the standard retry pattern.
 *
 * @param fn - The async function to execute
 * @param config - Retry configuration
 * @returns The result of the function
 * @throws OpenAIAPIError if all retries fail
 */
export async function withTHLIRetryOrThrow<T>(
  fn: () => Promise<T>,
  config: Partial<THLIRetryConfig> = {}
): Promise<T> {
  const result = await withTHLIRetry(fn, config);

  if (!result.success) {
    throw result.error;
  }

  return result.result!;
}

/**
 * Check if an error indicates that the assessment should be saved for resumption.
 *
 * Requirements: 18.2 - Save conversation state on failure
 *
 * @param error - The error to check
 * @returns true if the assessment state should be saved
 */
export function shouldSaveForResumption(error: unknown): boolean {
  // Save state for any retryable error that exhausted retries
  if (isOpenAIRetryable(error)) {
    return true;
  }

  // Also save for server errors
  if (error instanceof Error) {
    const errorAny = error as { status?: number };
    if (errorAny.status && errorAny.status >= 500) {
      return true;
    }
  }

  return false;
}
