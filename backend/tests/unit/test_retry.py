"""
Unit Tests for Retry Logic Module

Tests that verify the RetryConfig and with_retry decorator work correctly
for exponential backoff retry behavior.

**Validates: Requirements 2.1, 2.2, 2.4, 2.5**
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import time

from app.utils.retry import (
    RetryConfig,
    with_retry,
    is_retryable_error,
    DEFAULT_RETRYABLE_EXCEPTIONS,
)


# =============================================================================
# Test: RetryConfig
# =============================================================================

class TestRetryConfig:
    """Tests for RetryConfig dataclass."""

    def test_default_values(self):
        """Test that default values are set correctly."""
        config = RetryConfig()
        
        assert config.max_retries == 3
        assert config.base_delay_ms == 100
        assert config.max_delay_ms == 1000
        assert config.retryable_exceptions == DEFAULT_RETRYABLE_EXCEPTIONS

    def test_custom_values(self):
        """Test that custom values can be set."""
        config = RetryConfig(
            max_retries=5,
            base_delay_ms=200,
            max_delay_ms=2000,
            retryable_exceptions=(ValueError,),
        )
        
        assert config.max_retries == 5
        assert config.base_delay_ms == 200
        assert config.max_delay_ms == 2000
        assert config.retryable_exceptions == (ValueError,)


class TestRetryConfigCalculateDelay:
    """
    Tests for RetryConfig.calculate_delay method.
    
    **Validates: Requirement 2.2**
    """

    def test_exponential_backoff_attempt_0(self):
        """
        Test delay for first retry attempt (attempt=0).
        
        **Validates: Requirement 2.2** - 100ms for first retry
        """
        config = RetryConfig(base_delay_ms=100)
        delay = config.calculate_delay(attempt=0)
        
        assert delay == 100  # 100 * 2^0 = 100ms

    def test_exponential_backoff_attempt_1(self):
        """
        Test delay for second retry attempt (attempt=1).
        
        **Validates: Requirement 2.2** - 200ms for second retry
        """
        config = RetryConfig(base_delay_ms=100)
        delay = config.calculate_delay(attempt=1)
        
        assert delay == 200  # 100 * 2^1 = 200ms

    def test_exponential_backoff_attempt_2(self):
        """
        Test delay for third retry attempt (attempt=2).
        
        **Validates: Requirement 2.2** - 400ms for third retry
        """
        config = RetryConfig(base_delay_ms=100)
        delay = config.calculate_delay(attempt=2)
        
        assert delay == 400  # 100 * 2^2 = 400ms

    def test_delay_capped_at_max(self):
        """Test that delay is capped at max_delay_ms."""
        config = RetryConfig(base_delay_ms=100, max_delay_ms=300)
        
        # attempt=2 would give 400ms, but should be capped at 300ms
        delay = config.calculate_delay(attempt=2)
        
        assert delay == 300

    def test_all_three_delays_correct(self):
        """
        Test all three retry delays match the specification.
        
        **Validates: Requirement 2.2** - 100ms, 200ms, 400ms
        """
        config = RetryConfig(base_delay_ms=100, max_delay_ms=1000)
        
        delays = [config.calculate_delay(i) for i in range(3)]
        
        assert delays == [100, 200, 400]


class TestRetryConfigIsRetryable:
    """
    Tests for RetryConfig.is_retryable method.
    
    **Validates: Requirements 2.4, 2.5**
    """

    def test_connection_error_is_retryable(self):
        """
        Test that ConnectionError is retryable.
        
        **Validates: Requirement 2.4**
        """
        config = RetryConfig()
        error = ConnectionError("Connection failed")
        
        assert config.is_retryable(error) is True

    def test_timeout_error_is_retryable(self):
        """
        Test that TimeoutError is retryable.
        
        **Validates: Requirement 2.4**
        """
        config = RetryConfig()
        error = TimeoutError("Operation timed out")
        
        assert config.is_retryable(error) is True

    def test_connection_reset_error_is_retryable(self):
        """
        Test that ConnectionResetError is retryable.
        
        **Validates: Requirement 2.4**
        """
        config = RetryConfig()
        error = ConnectionResetError("Connection reset by peer")
        
        assert config.is_retryable(error) is True

    def test_broken_pipe_error_is_retryable(self):
        """
        Test that BrokenPipeError is retryable.
        
        **Validates: Requirement 2.4**
        """
        config = RetryConfig()
        error = BrokenPipeError("Broken pipe")
        
        assert config.is_retryable(error) is True

    def test_value_error_is_not_retryable(self):
        """
        Test that ValueError is not retryable.
        
        **Validates: Requirement 2.5**
        """
        config = RetryConfig()
        error = ValueError("Invalid value")
        
        assert config.is_retryable(error) is False

    def test_key_error_is_not_retryable(self):
        """
        Test that KeyError is not retryable.
        
        **Validates: Requirement 2.5**
        """
        config = RetryConfig()
        error = KeyError("Missing key")
        
        assert config.is_retryable(error) is False

    def test_type_error_is_not_retryable(self):
        """
        Test that TypeError is not retryable.
        
        **Validates: Requirement 2.5**
        """
        config = RetryConfig()
        error = TypeError("Type mismatch")
        
        assert config.is_retryable(error) is False

    def test_custom_retryable_exceptions(self):
        """Test that custom retryable exceptions work."""
        config = RetryConfig(retryable_exceptions=(ValueError, KeyError))
        
        assert config.is_retryable(ValueError("test")) is True
        assert config.is_retryable(KeyError("test")) is True
        assert config.is_retryable(ConnectionError("test")) is False


class TestIsRetryableErrorFunction:
    """Tests for the is_retryable_error utility function."""

    def test_with_default_config(self):
        """Test is_retryable_error with default config."""
        assert is_retryable_error(ConnectionError("test")) is True
        assert is_retryable_error(ValueError("test")) is False

    def test_with_custom_config(self):
        """Test is_retryable_error with custom config."""
        config = RetryConfig(retryable_exceptions=(ValueError,))
        
        assert is_retryable_error(ValueError("test"), config) is True
        assert is_retryable_error(ConnectionError("test"), config) is False


# =============================================================================
# Test: with_retry Decorator - Async Functions
# =============================================================================

class TestWithRetryAsyncSuccess:
    """Tests for with_retry decorator with async functions that succeed."""

    @pytest.mark.asyncio
    async def test_successful_call_no_retry(self):
        """Test that successful calls don't trigger retries."""
        call_count = 0
        
        @with_retry()
        async def successful_func():
            nonlocal call_count
            call_count += 1
            return "success"
        
        result = await successful_func()
        
        assert result == "success"
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_success_after_one_retry(self):
        """
        Test that function succeeds after one retry.
        
        **Validates: Requirement 2.1**
        """
        call_count = 0
        
        @with_retry()
        async def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ConnectionError("Temporary failure")
            return "success"
        
        with patch("app.utils.retry.asyncio.sleep", new_callable=AsyncMock):
            result = await flaky_func()
        
        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_success_after_two_retries(self):
        """
        Test that function succeeds after two retries.
        
        **Validates: Requirement 2.1**
        """
        call_count = 0
        
        @with_retry()
        async def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise TimeoutError("Temporary failure")
            return "success"
        
        with patch("app.utils.retry.asyncio.sleep", new_callable=AsyncMock):
            result = await flaky_func()
        
        assert result == "success"
        assert call_count == 3


class TestWithRetryAsyncFailure:
    """Tests for with_retry decorator with async functions that fail."""

    @pytest.mark.asyncio
    async def test_all_retries_exhausted(self):
        """
        Test that exception is raised after all retries are exhausted.
        
        **Validates: Requirement 2.1** - max 3 retries
        """
        call_count = 0
        
        @with_retry()
        async def always_fails():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("Always fails")
        
        with patch("app.utils.retry.asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(ConnectionError, match="Always fails"):
                await always_fails()
        
        # Initial call + 3 retries = 4 total calls
        assert call_count == 4

    @pytest.mark.asyncio
    async def test_non_retryable_error_raises_immediately(self):
        """
        Test that non-retryable errors are raised immediately.
        
        **Validates: Requirement 2.5**
        """
        call_count = 0
        
        @with_retry()
        async def raises_value_error():
            nonlocal call_count
            call_count += 1
            raise ValueError("Not retryable")
        
        with pytest.raises(ValueError, match="Not retryable"):
            await raises_value_error()
        
        # Should only be called once - no retries
        assert call_count == 1


class TestWithRetryAsyncDelays:
    """Tests for with_retry decorator delay behavior."""

    @pytest.mark.asyncio
    async def test_correct_delays_applied(self):
        """
        Test that correct exponential backoff delays are applied.
        
        **Validates: Requirement 2.2** - 100ms, 200ms, 400ms
        """
        call_count = 0
        sleep_calls = []
        
        async def mock_sleep(seconds):
            sleep_calls.append(seconds * 1000)  # Convert to ms
        
        @with_retry()
        async def always_fails():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("Always fails")
        
        with patch("app.utils.retry.asyncio.sleep", side_effect=mock_sleep):
            with pytest.raises(ConnectionError):
                await always_fails()
        
        # Should have 3 sleep calls (after each failed attempt except the last)
        assert len(sleep_calls) == 3
        assert sleep_calls == [100, 200, 400]


# =============================================================================
# Test: with_retry Decorator - Sync Functions
# =============================================================================

class TestWithRetrySyncSuccess:
    """Tests for with_retry decorator with sync functions that succeed."""

    def test_successful_call_no_retry(self):
        """Test that successful sync calls don't trigger retries."""
        call_count = 0
        
        @with_retry()
        def successful_func():
            nonlocal call_count
            call_count += 1
            return "success"
        
        result = successful_func()
        
        assert result == "success"
        assert call_count == 1

    def test_success_after_one_retry(self):
        """
        Test that sync function succeeds after one retry.
        
        **Validates: Requirement 2.1**
        """
        call_count = 0
        
        @with_retry()
        def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ConnectionError("Temporary failure")
            return "success"
        
        with patch("app.utils.retry.time.sleep"):
            result = flaky_func()
        
        assert result == "success"
        assert call_count == 2


class TestWithRetrySyncFailure:
    """Tests for with_retry decorator with sync functions that fail."""

    def test_all_retries_exhausted(self):
        """
        Test that exception is raised after all retries are exhausted.
        
        **Validates: Requirement 2.1**
        """
        call_count = 0
        
        @with_retry()
        def always_fails():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("Always fails")
        
        with patch("app.utils.retry.time.sleep"):
            with pytest.raises(ConnectionError, match="Always fails"):
                always_fails()
        
        assert call_count == 4

    def test_non_retryable_error_raises_immediately(self):
        """
        Test that non-retryable errors are raised immediately for sync functions.
        
        **Validates: Requirement 2.5**
        """
        call_count = 0
        
        @with_retry()
        def raises_type_error():
            nonlocal call_count
            call_count += 1
            raise TypeError("Not retryable")
        
        with pytest.raises(TypeError, match="Not retryable"):
            raises_type_error()
        
        assert call_count == 1


class TestWithRetrySyncDelays:
    """Tests for with_retry decorator delay behavior with sync functions."""

    def test_correct_delays_applied(self):
        """
        Test that correct exponential backoff delays are applied for sync functions.
        
        **Validates: Requirement 2.2**
        """
        call_count = 0
        sleep_calls = []
        
        def mock_sleep(seconds):
            sleep_calls.append(seconds * 1000)  # Convert to ms
        
        @with_retry()
        def always_fails():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("Always fails")
        
        with patch("app.utils.retry.time.sleep", side_effect=mock_sleep):
            with pytest.raises(ConnectionError):
                always_fails()
        
        assert len(sleep_calls) == 3
        assert sleep_calls == [100, 200, 400]


# =============================================================================
# Test: with_retry Decorator - Custom Config
# =============================================================================

class TestWithRetryCustomConfig:
    """Tests for with_retry decorator with custom configuration."""

    @pytest.mark.asyncio
    async def test_custom_max_retries(self):
        """Test that custom max_retries is respected."""
        call_count = 0
        config = RetryConfig(max_retries=5)
        
        @with_retry(config)
        async def always_fails():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("Always fails")
        
        with patch("app.utils.retry.asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(ConnectionError):
                await always_fails()
        
        # Initial call + 5 retries = 6 total calls
        assert call_count == 6

    @pytest.mark.asyncio
    async def test_custom_base_delay(self):
        """Test that custom base_delay_ms is used."""
        sleep_calls = []
        config = RetryConfig(max_retries=2, base_delay_ms=50)
        
        async def mock_sleep(seconds):
            sleep_calls.append(seconds * 1000)
        
        @with_retry(config)
        async def always_fails():
            raise ConnectionError("Always fails")
        
        with patch("app.utils.retry.asyncio.sleep", side_effect=mock_sleep):
            with pytest.raises(ConnectionError):
                await always_fails()
        
        # 50ms, 100ms (50 * 2^0, 50 * 2^1)
        assert sleep_calls == [50, 100]

    @pytest.mark.asyncio
    async def test_custom_retryable_exceptions(self):
        """Test that custom retryable_exceptions are used."""
        call_count = 0
        config = RetryConfig(retryable_exceptions=(ValueError,))
        
        @with_retry(config)
        async def raises_value_error():
            nonlocal call_count
            call_count += 1
            raise ValueError("Now retryable")
        
        with patch("app.utils.retry.asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(ValueError):
                await raises_value_error()
        
        # Should retry because ValueError is now retryable
        assert call_count == 4


# =============================================================================
# Test: with_retry Decorator - Logging
# =============================================================================

class TestWithRetryLogging:
    """Tests for with_retry decorator logging behavior."""

    @pytest.mark.asyncio
    async def test_logs_retry_attempts(self, caplog):
        """Test that retry attempts are logged."""
        import logging
        caplog.set_level(logging.WARNING)
        
        call_count = 0
        
        @with_retry()
        async def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("Temporary failure")
            return "success"
        
        with patch("app.utils.retry.asyncio.sleep", new_callable=AsyncMock):
            result = await flaky_func()
        
        assert result == "success"
        # Should have logged 2 warning messages for the 2 retries
        warning_logs = [r for r in caplog.records if r.levelname == "WARNING"]
        assert len(warning_logs) == 2
        assert "Retryable error" in warning_logs[0].message
        assert "100ms" in warning_logs[0].message
        assert "200ms" in warning_logs[1].message

    @pytest.mark.asyncio
    async def test_logs_final_failure(self, caplog):
        """Test that final failure is logged as error."""
        import logging
        caplog.set_level(logging.WARNING)
        
        @with_retry()
        async def always_fails():
            raise ConnectionError("Always fails")
        
        with patch("app.utils.retry.asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(ConnectionError):
                await always_fails()
        
        # Should have logged 3 warnings (for retries) and 1 error (final failure)
        warning_logs = [r for r in caplog.records if r.levelname == "WARNING"]
        error_logs = [r for r in caplog.records if r.levelname == "ERROR"]
        assert len(warning_logs) == 3
        assert len(error_logs) == 1
        assert "All retries exhausted" in error_logs[0].message

    @pytest.mark.asyncio
    async def test_logs_non_retryable_error(self, caplog):
        """Test that non-retryable errors are logged as warning."""
        import logging
        caplog.set_level(logging.WARNING)
        
        @with_retry()
        async def raises_value_error():
            raise ValueError("Not retryable")
        
        with pytest.raises(ValueError):
            await raises_value_error()
        
        # Should have logged 1 warning for non-retryable error
        warning_logs = [r for r in caplog.records if r.levelname == "WARNING"]
        assert len(warning_logs) == 1
        assert "Non-retryable error" in warning_logs[0].message


# =============================================================================
# Test: Edge Cases
# =============================================================================

class TestWithRetryEdgeCases:
    """Tests for edge cases in with_retry decorator."""

    @pytest.mark.asyncio
    async def test_zero_retries(self):
        """Test behavior with max_retries=0 (no retries)."""
        call_count = 0
        config = RetryConfig(max_retries=0)
        
        @with_retry(config)
        async def always_fails():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("Always fails")
        
        with pytest.raises(ConnectionError):
            await always_fails()
        
        # Only initial call, no retries
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_preserves_function_metadata(self):
        """Test that decorator preserves function metadata."""
        @with_retry()
        async def my_function():
            """My docstring."""
            return "result"
        
        assert my_function.__name__ == "my_function"
        assert my_function.__doc__ == "My docstring."

    @pytest.mark.asyncio
    async def test_passes_arguments_correctly(self):
        """Test that arguments are passed correctly to decorated function."""
        @with_retry()
        async def func_with_args(a, b, c=None):
            return (a, b, c)
        
        result = await func_with_args(1, 2, c=3)
        
        assert result == (1, 2, 3)

    @pytest.mark.asyncio
    async def test_handles_exception_subclasses(self):
        """Test that exception subclasses are handled correctly."""
        call_count = 0
        
        @with_retry()
        async def raises_connection_reset():
            nonlocal call_count
            call_count += 1
            # ConnectionResetError is a subclass of ConnectionError
            raise ConnectionResetError("Connection reset")
        
        with patch("app.utils.retry.asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(ConnectionResetError):
                await raises_connection_reset()
        
        # Should retry because ConnectionResetError is retryable
        assert call_count == 4
