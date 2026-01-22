"""
Retry Logic Module

指数バックオフでリトライするデコレータとリトライ設定を提供する。

Requirements:
- 2.1: 接続エラーで失敗した場合、指数バックオフで最大3回リトライする
- 2.2: リトライ間隔は100ms、200ms、400msの指数バックオフを適用する
- 2.4: 接続タイムアウト、接続リセット、一時的なネットワークエラーをリトライ対象とする
- 2.5: リトライ不可能なエラーが発生した場合、即座にエラーを返却する
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, Callable, Optional, Tuple, Type, TypeVar, Union

# Type variable for generic return type
T = TypeVar("T")

# Default retryable exceptions
# These represent transient network/connection errors that may succeed on retry
DEFAULT_RETRYABLE_EXCEPTIONS: Tuple[Type[Exception], ...] = (
    ConnectionError,      # Base class for connection-related errors
    TimeoutError,         # Operation timed out
    ConnectionResetError, # Connection reset by peer
    BrokenPipeError,      # Broken pipe error
    ConnectionRefusedError,  # Connection refused
    ConnectionAbortedError,  # Connection aborted
    OSError,              # Includes socket errors like "Connection reset by peer"
)

# HTTP-related exceptions that are retryable (from httpx/httpcore)
# These are added dynamically if the libraries are available
try:
    import httpx
    DEFAULT_RETRYABLE_EXCEPTIONS = DEFAULT_RETRYABLE_EXCEPTIONS + (
        httpx.ConnectError,
        httpx.ConnectTimeout,
        httpx.ReadTimeout,
        httpx.WriteTimeout,
        httpx.PoolTimeout,
        httpx.NetworkError,
        httpx.RemoteProtocolError,
        httpx.TimeoutException,  # Base class for all timeout exceptions
    )
except ImportError:
    pass

try:
    import httpcore
    DEFAULT_RETRYABLE_EXCEPTIONS = DEFAULT_RETRYABLE_EXCEPTIONS + (
        httpcore.ConnectError,
        httpcore.ConnectTimeout,
        httpcore.ReadTimeout,
        httpcore.WriteTimeout,
        httpcore.NetworkError,
        httpcore.RemoteProtocolError,
    )
except ImportError:
    pass

# Postgrest API errors that indicate connection issues
try:
    from postgrest import APIError as PostgrestAPIError
    # Note: PostgrestAPIError is added to retryable only for specific error codes
    # This is handled in is_retryable method
except ImportError:
    PostgrestAPIError = None


@dataclass
class RetryConfig:
    """
    リトライ設定。
    
    Attributes:
        max_retries: 最大リトライ回数（デフォルト: 3）
        base_delay_ms: 基本遅延時間（ミリ秒）（デフォルト: 100）
        max_delay_ms: 最大遅延時間（ミリ秒）（デフォルト: 1000）
        retryable_exceptions: リトライ対象の例外タプル
        
    Requirements:
    - 2.1: 最大3回リトライする
    - 2.2: 100ms、200ms、400msの指数バックオフを適用する
    """
    max_retries: int = 3
    base_delay_ms: int = 100
    max_delay_ms: int = 1000
    retryable_exceptions: Tuple[Type[Exception], ...] = field(
        default_factory=lambda: DEFAULT_RETRYABLE_EXCEPTIONS
    )
    
    def calculate_delay(self, attempt: int) -> int:
        """
        指定されたリトライ試行回数に対する遅延時間を計算する。
        
        指数バックオフ: base_delay_ms * (2 ^ attempt)
        例: attempt=0 -> 100ms, attempt=1 -> 200ms, attempt=2 -> 400ms
        
        Args:
            attempt: リトライ試行回数（0から開始）
            
        Returns:
            遅延時間（ミリ秒）
            
        Requirement 2.2: 100ms、200ms、400msの指数バックオフを適用する
        """
        delay = self.base_delay_ms * (2 ** attempt)
        return min(delay, self.max_delay_ms)
    
    def is_retryable(self, error: Exception) -> bool:
        """
        エラーがリトライ可能かどうかを判定する。
        
        Args:
            error: 判定対象の例外
            
        Returns:
            リトライ可能な場合True、そうでない場合False
            
        Requirements:
        - 2.4: 接続タイムアウト、接続リセット、一時的なネットワークエラーをリトライ対象とする
        - 2.5: リトライ不可能なエラーが発生した場合、即座にエラーを返却する
        """
        # Check standard retryable exceptions
        if isinstance(error, self.retryable_exceptions):
            return True
        
        # Check for PostgrestAPIError with connection-related error codes
        if PostgrestAPIError is not None and isinstance(error, PostgrestAPIError):
            # Retry on connection-related HTTP status codes
            # 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
            error_code = getattr(error, 'code', None)
            if error_code in ('502', '503', '504', 502, 503, 504):
                return True
            # Also check the message for connection-related errors
            error_message = str(error).lower()
            if any(keyword in error_message for keyword in [
                'connection', 'timeout', 'reset', 'refused', 'unavailable',
                'network', 'socket', 'broken pipe'
            ]):
                return True
        
        # Check for wrapped exceptions (e.g., httpx errors wrapped in other exceptions)
        if hasattr(error, '__cause__') and error.__cause__ is not None:
            return self.is_retryable(error.__cause__)
        
        # Check error message for connection-related keywords
        error_message = str(error).lower()
        connection_keywords = [
            'connection reset', 'connection refused', 'connection timed out',
            'broken pipe', 'network unreachable', 'no route to host',
            'connection aborted', 'socket error', 'read timed out',
            'connect timeout', 'pool timeout'
        ]
        if any(keyword in error_message for keyword in connection_keywords):
            return True
        
        return False


def is_retryable_error(error: Exception, config: Optional[RetryConfig] = None) -> bool:
    """
    エラーがリトライ可能かどうかを判定するユーティリティ関数。
    
    Args:
        error: 判定対象の例外
        config: リトライ設定（省略時はデフォルト設定を使用）
        
    Returns:
        リトライ可能な場合True、そうでない場合False
    """
    if config is None:
        config = RetryConfig()
    return config.is_retryable(error)


def with_retry(config: Optional[RetryConfig] = None) -> Callable:
    """
    指数バックオフでリトライするデコレータ。
    
    同期関数と非同期関数の両方をサポートする。
    
    Args:
        config: リトライ設定（省略時はデフォルト設定を使用）
        
    Returns:
        デコレータ関数
        
    Usage:
        @with_retry()
        async def fetch_data():
            ...
            
        @with_retry(RetryConfig(max_retries=5))
        def sync_operation():
            ...
            
    Requirements:
    - 2.1: 接続エラーで失敗した場合、指数バックオフで最大3回リトライする
    - 2.2: リトライ間隔は100ms、200ms、400msの指数バックオフを適用する
    - 2.4: 接続タイムアウト、接続リセット、一時的なネットワークエラーをリトライ対象とする
    - 2.5: リトライ不可能なエラーが発生した場合、即座にエラーを返却する
    """
    if config is None:
        config = RetryConfig()
    
    logger = logging.getLogger(__name__)
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> T:
            """非同期関数用のラッパー。"""
            last_error: Optional[Exception] = None
            
            for attempt in range(config.max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                    
                except Exception as e:
                    last_error = e
                    
                    # Check if error is retryable (Requirement 2.4, 2.5)
                    if not config.is_retryable(e):
                        logger.warning(
                            f"Non-retryable error in {func.__name__}, raising immediately",
                            extra={
                                "function": func.__name__,
                                "error_type": type(e).__name__,
                                "error_message": str(e),
                                "attempt": attempt + 1,
                            }
                        )
                        raise
                    
                    # Check if we have retries left
                    if attempt >= config.max_retries:
                        logger.error(
                            f"All retries exhausted for {func.__name__}",
                            extra={
                                "function": func.__name__,
                                "error_type": type(e).__name__,
                                "error_message": str(e),
                                "total_attempts": attempt + 1,
                                "max_retries": config.max_retries,
                            }
                        )
                        raise
                    
                    # Calculate delay and wait (Requirement 2.2)
                    delay_ms = config.calculate_delay(attempt)
                    delay_seconds = delay_ms / 1000.0
                    
                    logger.warning(
                        f"Retryable error in {func.__name__}, retrying after {delay_ms}ms",
                        extra={
                            "function": func.__name__,
                            "error_type": type(e).__name__,
                            "error_message": str(e),
                            "attempt": attempt + 1,
                            "max_retries": config.max_retries,
                            "delay_ms": delay_ms,
                        }
                    )
                    
                    await asyncio.sleep(delay_seconds)
            
            # This should never be reached, but just in case
            if last_error is not None:
                raise last_error
            raise RuntimeError(f"Unexpected state in retry logic for {func.__name__}")
        
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> T:
            """同期関数用のラッパー。"""
            last_error: Optional[Exception] = None
            
            for attempt in range(config.max_retries + 1):
                try:
                    return func(*args, **kwargs)
                    
                except Exception as e:
                    last_error = e
                    
                    # Check if error is retryable (Requirement 2.4, 2.5)
                    if not config.is_retryable(e):
                        logger.warning(
                            f"Non-retryable error in {func.__name__}, raising immediately",
                            extra={
                                "function": func.__name__,
                                "error_type": type(e).__name__,
                                "error_message": str(e),
                                "attempt": attempt + 1,
                            }
                        )
                        raise
                    
                    # Check if we have retries left
                    if attempt >= config.max_retries:
                        logger.error(
                            f"All retries exhausted for {func.__name__}",
                            extra={
                                "function": func.__name__,
                                "error_type": type(e).__name__,
                                "error_message": str(e),
                                "total_attempts": attempt + 1,
                                "max_retries": config.max_retries,
                            }
                        )
                        raise
                    
                    # Calculate delay and wait (Requirement 2.2)
                    delay_ms = config.calculate_delay(attempt)
                    delay_seconds = delay_ms / 1000.0
                    
                    logger.warning(
                        f"Retryable error in {func.__name__}, retrying after {delay_ms}ms",
                        extra={
                            "function": func.__name__,
                            "error_type": type(e).__name__,
                            "error_message": str(e),
                            "attempt": attempt + 1,
                            "max_retries": config.max_retries,
                            "delay_ms": delay_ms,
                        }
                    )
                    
                    time.sleep(delay_seconds)
            
            # This should never be reached, but just in case
            if last_error is not None:
                raise last_error
            raise RuntimeError(f"Unexpected state in retry logic for {func.__name__}")
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator
