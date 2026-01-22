"""
Error hierarchy for the backend application.

This module defines a hierarchy of custom exception classes for consistent
error handling throughout the application.

Requirements: 4.1, 4.2, 4.3
"""
from typing import Optional


class AppError(Exception):
    """Base application error.
    
    All custom application errors should inherit from this class.
    
    Attributes:
        message: Human-readable error message.
        status_code: HTTP status code to return.
        code: Machine-readable error code for programmatic handling.
        is_retryable: Whether the operation can be retried.
    """
    
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        code: Optional[str] = None,
        is_retryable: bool = False
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.is_retryable = is_retryable


class AuthenticationError(AppError):
    """Authentication failed.
    
    Raised when user authentication fails due to invalid credentials,
    missing tokens, or other authentication issues.
    """
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, 401, "AUTHENTICATION_ERROR", False)


class TokenExpiredError(AuthenticationError):
    """JWT token has expired.
    
    Raised when a JWT token is valid but has exceeded its expiration time.
    """
    
    def __init__(self):
        super().__init__("Token has expired")


class SlackAPIError(AppError):
    """Slack API error.
    
    Raised when a Slack API call fails. These errors are typically
    retryable as they may be due to temporary issues.
    
    Attributes:
        error_code: The specific error code returned by Slack API.
    """
    
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message, 502, error_code, True)


class RateLimitError(SlackAPIError):
    """Rate limited by Slack API.
    
    Raised when the Slack API returns a rate limit response.
    
    Attributes:
        retry_after: Number of seconds to wait before retrying.
    """
    
    def __init__(self, retry_after: int = 1):
        super().__init__(f"Rate limited. Retry after {retry_after} seconds")
        self.retry_after = retry_after


class DataFetchError(AppError):
    """Failed to fetch data from database.
    
    Raised when a database query fails. These errors are typically
    retryable as they may be due to temporary connection issues.
    
    Attributes:
        original_error: The underlying exception that caused this error.
    """
    
    def __init__(self, message: str, original_error: Optional[Exception] = None):
        super().__init__(message, 500, "DATA_FETCH_ERROR", True)
        self.original_error = original_error


class ConnectionError(AppError):
    """Database connection error.
    
    Raised when the application cannot establish a connection to the database.
    These errors are retryable as they may be due to temporary network issues.
    """
    
    def __init__(self, message: str):
        super().__init__(message, 503, "CONNECTION_ERROR", True)


class ValidationError(AppError):
    """Input validation error.
    
    Raised when user input fails validation. These errors are not retryable
    as they require the user to correct their input.
    """
    
    def __init__(self, message: str):
        super().__init__(message, 400, "VALIDATION_ERROR", False)


# Export all error classes for convenient imports
__all__ = [
    "AppError",
    "AuthenticationError",
    "TokenExpiredError",
    "SlackAPIError",
    "RateLimitError",
    "DataFetchError",
    "ConnectionError",
    "ValidationError",
]
