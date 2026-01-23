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
export class AppError extends Error {
    /**
     * HTTP status code to return.
     */
    statusCode;
    /**
     * Machine-readable error code for programmatic handling.
     */
    code;
    /**
     * Whether the operation can be retried.
     */
    isRetryable;
    constructor(message, statusCode = 500, code, isRetryable = false) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.isRetryable = isRetryable;
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
/**
 * Authentication failed.
 *
 * Raised when user authentication fails due to invalid credentials,
 * missing tokens, or other authentication issues.
 */
export class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR', false);
        this.name = 'AuthenticationError';
    }
}
/**
 * JWT token has expired.
 *
 * Raised when a JWT token is valid but has exceeded its expiration time.
 */
export class TokenExpiredError extends AuthenticationError {
    constructor() {
        super('Token has expired');
        this.name = 'TokenExpiredError';
    }
}
/**
 * Slack API error.
 *
 * Raised when a Slack API call fails. These errors are typically
 * retryable as they may be due to temporary issues.
 */
export class SlackAPIError extends AppError {
    /**
     * The specific error code returned by Slack API.
     */
    errorCode;
    constructor(message, errorCode) {
        super(message, 502, errorCode, true);
        this.name = 'SlackAPIError';
        this.errorCode = errorCode;
    }
}
/**
 * Rate limited by Slack API.
 *
 * Raised when the Slack API returns a rate limit response.
 */
export class RateLimitError extends SlackAPIError {
    /**
     * Number of seconds to wait before retrying.
     */
    retryAfter;
    constructor(retryAfter = 1) {
        super(`Rate limited. Retry after ${retryAfter} seconds`);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}
/**
 * Failed to fetch data from database.
 *
 * Raised when a database query fails. These errors are typically
 * retryable as they may be due to temporary connection issues.
 */
export class DataFetchError extends AppError {
    /**
     * The underlying exception that caused this error.
     */
    originalError;
    constructor(message, originalError) {
        super(message, 500, 'DATA_FETCH_ERROR', true);
        this.name = 'DataFetchError';
        this.originalError = originalError;
    }
}
/**
 * Database connection error.
 *
 * Raised when the application cannot establish a connection to the database.
 * These errors are retryable as they may be due to temporary network issues.
 */
export class ConnectionError extends AppError {
    constructor(message) {
        super(message, 503, 'CONNECTION_ERROR', true);
        this.name = 'ConnectionError';
    }
}
/**
 * Input validation error.
 *
 * Raised when user input fails validation. These errors are not retryable
 * as they require the user to correct their input.
 */
export class ValidationError extends AppError {
    constructor(message) {
        super(message, 400, 'VALIDATION_ERROR', false);
        this.name = 'ValidationError';
    }
}
/**
 * Type guard to check if an error is an AppError.
 */
export function isAppError(error) {
    return error instanceof AppError;
}
/**
 * Type guard to check if an error is retryable.
 */
export function isRetryableError(error) {
    if (isAppError(error)) {
        return error.isRetryable;
    }
    return false;
}
/**
 * Get user-friendly error message in Japanese.
 *
 * Requirements: 4.4, 4.5, 4.6
 */
export function getUserFriendlyMessage(error) {
    if (error instanceof AuthenticationError) {
        return '認証に失敗しました。再度ログインしてください。';
    }
    if (error instanceof TokenExpiredError) {
        return 'セッションの有効期限が切れました。再度ログインしてください。';
    }
    if (error instanceof RateLimitError) {
        return 'リクエストが多すぎます。しばらく待ってから再度お試しください。';
    }
    if (error instanceof SlackAPIError) {
        return 'Slackとの通信中にエラーが発生しました。再度お試しください。';
    }
    if (error instanceof DataFetchError) {
        return 'データの取得に失敗しました。再度お試しください。';
    }
    if (error instanceof ConnectionError) {
        return '接続エラーが発生しました。しばらく待ってから再度お試しください。';
    }
    if (error instanceof ValidationError) {
        return '入力内容に誤りがあります。確認して再度お試しください。';
    }
    if (error instanceof AppError) {
        return '予期しないエラーが発生しました。再度お試しください。';
    }
    return '予期しないエラーが発生しました。再度お試しください。';
}
//# sourceMappingURL=index.js.map