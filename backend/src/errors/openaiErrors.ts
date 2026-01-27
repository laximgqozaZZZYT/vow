/**
 * OpenAI-specific Error Types
 *
 * Custom error classes for handling OpenAI API errors with proper
 * retry logic and user-friendly messages.
 *
 * Requirements: 18.1, 18.2
 */

import { AppError } from './index.js';

/**
 * OpenAI API Error
 *
 * Base class for OpenAI-specific errors.
 */
export class OpenAIAPIError extends AppError {
  /**
   * HTTP status code from OpenAI API.
   */
  readonly apiStatus: number | undefined;

  /**
   * Original error from OpenAI SDK.
   */
  readonly originalError: Error | undefined;

  constructor(
    message: string,
    apiStatus?: number,
    originalError?: Error,
    isRetryable = false
  ) {
    super(message, apiStatus || 500, 'OPENAI_API_ERROR', isRetryable);
    this.name = 'OpenAIAPIError';
    this.apiStatus = apiStatus;
    this.originalError = originalError;
  }
}

/**
 * OpenAI Rate Limit Error
 *
 * Raised when OpenAI API returns 429 (rate limit exceeded).
 * These errors are retryable with exponential backoff.
 */
export class OpenAIRateLimitError extends OpenAIAPIError {
  /**
   * Number of seconds to wait before retrying.
   */
  readonly retryAfter: number;

  constructor(retryAfter = 60, originalError?: Error) {
    super(
      `OpenAI API rate limit exceeded. Retry after ${retryAfter} seconds.`,
      429,
      originalError,
      true
    );
    this.name = 'OpenAIRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * OpenAI Server Error
 *
 * Raised when OpenAI API returns 5xx errors.
 * These errors are retryable with exponential backoff.
 */
export class OpenAIServerError extends OpenAIAPIError {
  constructor(status: number, message?: string, originalError?: Error) {
    super(
      message || `OpenAI API server error (${status})`,
      status,
      originalError,
      true
    );
    this.name = 'OpenAIServerError';
  }
}

/**
 * OpenAI Timeout Error
 *
 * Raised when OpenAI API call times out.
 * These errors are retryable with exponential backoff.
 */
export class OpenAITimeoutError extends OpenAIAPIError {
  constructor(originalError?: Error) {
    super(
      'OpenAI API request timed out',
      408,
      originalError,
      true
    );
    this.name = 'OpenAITimeoutError';
  }
}

/**
 * OpenAI Authentication Error
 *
 * Raised when OpenAI API returns 401 (unauthorized).
 * These errors are NOT retryable.
 */
export class OpenAIAuthError extends OpenAIAPIError {
  constructor(originalError?: Error) {
    super(
      'OpenAI API authentication failed',
      401,
      originalError,
      false
    );
    this.name = 'OpenAIAuthError';
  }
}

/**
 * OpenAI Quota Exceeded Error
 *
 * Raised when OpenAI API returns quota exceeded error.
 * These errors are NOT retryable.
 */
export class OpenAIQuotaExceededError extends OpenAIAPIError {
  constructor(originalError?: Error) {
    super(
      'OpenAI API quota exceeded',
      402,
      originalError,
      false
    );
    this.name = 'OpenAIQuotaExceededError';
  }
}

/**
 * Check if an error is retryable for OpenAI API calls.
 *
 * Requirements: 18.1 - Only retry on retryable errors (429, 5xx)
 *
 * @param error - The error to check
 * @returns true if the error is retryable
 */
export function isOpenAIRetryable(error: unknown): boolean {
  // Check for our custom OpenAI errors
  if (error instanceof OpenAIAPIError) {
    return error.isRetryable;
  }

  // Check for OpenAI SDK errors
  if (error instanceof Error) {
    const errorAny = error as { status?: number; code?: string };

    // Rate limit errors (429)
    if (errorAny.status === 429) {
      return true;
    }

    // Server errors (5xx)
    if (errorAny.status && errorAny.status >= 500 && errorAny.status < 600) {
      return true;
    }

    // Timeout errors
    if (
      error.name === 'TimeoutError' ||
      error.message.toLowerCase().includes('timeout') ||
      error.message.toLowerCase().includes('timed out')
    ) {
      return true;
    }

    // Connection errors
    if (
      error.message.toLowerCase().includes('econnreset') ||
      error.message.toLowerCase().includes('econnrefused') ||
      error.message.toLowerCase().includes('connection')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Convert an OpenAI SDK error to our custom error type.
 *
 * @param error - The error from OpenAI SDK
 * @returns Our custom OpenAI error type
 */
export function wrapOpenAIError(error: unknown): OpenAIAPIError {
  if (error instanceof OpenAIAPIError) {
    return error;
  }

  if (error instanceof Error) {
    const errorAny = error as { status?: number; code?: string; headers?: Record<string, string> };

    // Rate limit error
    if (errorAny.status === 429) {
      const retryAfter = errorAny.headers?.['retry-after']
        ? parseInt(errorAny.headers['retry-after'], 10)
        : 60;
      return new OpenAIRateLimitError(retryAfter, error);
    }

    // Server errors
    if (errorAny.status && errorAny.status >= 500) {
      return new OpenAIServerError(errorAny.status, error.message, error);
    }

    // Auth errors
    if (errorAny.status === 401) {
      return new OpenAIAuthError(error);
    }

    // Quota exceeded
    if (errorAny.status === 402 || errorAny.code === 'insufficient_quota') {
      return new OpenAIQuotaExceededError(error);
    }

    // Timeout errors
    if (
      error.name === 'TimeoutError' ||
      error.message.toLowerCase().includes('timeout')
    ) {
      return new OpenAITimeoutError(error);
    }

    // Generic API error
    return new OpenAIAPIError(
      error.message,
      errorAny.status,
      error,
      isOpenAIRetryable(error)
    );
  }

  // Unknown error
  return new OpenAIAPIError(
    String(error),
    undefined,
    undefined,
    false
  );
}

/**
 * Get user-friendly error message in Japanese for OpenAI errors.
 *
 * @param error - The OpenAI error
 * @returns User-friendly message in Japanese
 */
export function getOpenAIUserFriendlyMessage(error: unknown): string {
  if (error instanceof OpenAIRateLimitError) {
    return 'AIサービスが混雑しています。しばらく待ってから再度お試しください。';
  }
  if (error instanceof OpenAIServerError) {
    return 'AIサービスで一時的なエラーが発生しました。再度お試しください。';
  }
  if (error instanceof OpenAITimeoutError) {
    return 'AIサービスへの接続がタイムアウトしました。再度お試しください。';
  }
  if (error instanceof OpenAIAuthError) {
    return 'AIサービスの認証に失敗しました。管理者にお問い合わせください。';
  }
  if (error instanceof OpenAIQuotaExceededError) {
    return 'AIサービスの利用上限に達しました。';
  }
  if (error instanceof OpenAIAPIError) {
    return 'AI処理中にエラーが発生しました。再度お試しください。';
  }
  return '予期しないエラーが発生しました。再度お試しください。';
}
