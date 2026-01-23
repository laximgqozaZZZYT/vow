/**
 * Error hierarchy for the backend application.
 *
 * This module defines a hierarchy of custom exception classes for consistent
 * error handling throughout the application.
 *
 * Requirements: 4.1, 4.2, 4.3
 */
/**
 * Base application error.
 *
 * All custom application errors should inherit from this class.
 */
export declare class AppError extends Error {
    /**
     * HTTP status code to return.
     */
    readonly statusCode: number;
    /**
     * Machine-readable error code for programmatic handling.
     */
    readonly code: string | undefined;
    /**
     * Whether the operation can be retried.
     */
    readonly isRetryable: boolean;
    constructor(message: string, statusCode?: number, code?: string, isRetryable?: boolean);
}
/**
 * Authentication failed.
 *
 * Raised when user authentication fails due to invalid credentials,
 * missing tokens, or other authentication issues.
 */
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
/**
 * JWT token has expired.
 *
 * Raised when a JWT token is valid but has exceeded its expiration time.
 */
export declare class TokenExpiredError extends AuthenticationError {
    constructor();
}
/**
 * Slack API error.
 *
 * Raised when a Slack API call fails. These errors are typically
 * retryable as they may be due to temporary issues.
 */
export declare class SlackAPIError extends AppError {
    /**
     * The specific error code returned by Slack API.
     */
    readonly errorCode: string | undefined;
    constructor(message: string, errorCode?: string);
}
/**
 * Rate limited by Slack API.
 *
 * Raised when the Slack API returns a rate limit response.
 */
export declare class RateLimitError extends SlackAPIError {
    /**
     * Number of seconds to wait before retrying.
     */
    readonly retryAfter: number;
    constructor(retryAfter?: number);
}
/**
 * Failed to fetch data from database.
 *
 * Raised when a database query fails. These errors are typically
 * retryable as they may be due to temporary connection issues.
 */
export declare class DataFetchError extends AppError {
    /**
     * The underlying exception that caused this error.
     */
    readonly originalError: Error | undefined;
    constructor(message: string, originalError?: Error);
}
/**
 * Database connection error.
 *
 * Raised when the application cannot establish a connection to the database.
 * These errors are retryable as they may be due to temporary network issues.
 */
export declare class ConnectionError extends AppError {
    constructor(message: string);
}
/**
 * Input validation error.
 *
 * Raised when user input fails validation. These errors are not retryable
 * as they require the user to correct their input.
 */
export declare class ValidationError extends AppError {
    constructor(message: string);
}
/**
 * Type guard to check if an error is an AppError.
 */
export declare function isAppError(error: unknown): error is AppError;
/**
 * Type guard to check if an error is retryable.
 */
export declare function isRetryableError(error: unknown): boolean;
/**
 * Get user-friendly error message in Japanese.
 *
 * Requirements: 4.4, 4.5, 4.6
 */
export declare function getUserFriendlyMessage(error: unknown): string;
//# sourceMappingURL=index.d.ts.map