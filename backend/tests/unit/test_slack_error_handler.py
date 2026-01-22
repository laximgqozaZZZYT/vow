"""
Unit Tests for Slack Error Handler Module

Tests that verify the SlackErrorHandler correctly classifies errors
and returns user-friendly messages.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**
"""

import pytest
from unittest.mock import patch, MagicMock

from app.services.slack_error_handler import (
    SlackErrorHandler,
    ErrorType,
    DataFetchError,
)


# =============================================================================
# Test: ErrorType Enum
# =============================================================================

class TestErrorType:
    """Tests for ErrorType enum."""

    def test_error_type_values(self):
        """Test that ErrorType has expected values."""
        assert ErrorType.CONNECTION_ERROR.value == "connection_error"
        assert ErrorType.DATA_FETCH_ERROR.value == "data_fetch_error"
        assert ErrorType.VALIDATION_ERROR.value == "validation_error"
        assert ErrorType.UNKNOWN_ERROR.value == "unknown_error"


# =============================================================================
# Test: DataFetchError Exception
# =============================================================================

class TestDataFetchError:
    """Tests for DataFetchError custom exception."""

    def test_basic_creation(self):
        """Test basic DataFetchError creation."""
        error = DataFetchError("Failed to fetch data")
        
        assert str(error) == "Failed to fetch data"
        assert error.original_error is None

    def test_with_original_error(self):
        """Test DataFetchError with original error."""
        original = ConnectionError("Connection failed")
        error = DataFetchError("Failed to fetch data", original_error=original)
        
        assert str(error) == "Failed to fetch data"
        assert error.original_error is original


# =============================================================================
# Test: SlackErrorHandler.classify_error
# =============================================================================

class TestClassifyError:
    """
    Tests for SlackErrorHandler.classify_error method.
    
    **Validates: Requirements 3.1, 3.2**
    """

    def test_connection_error_classified_correctly(self):
        """
        Test that ConnectionError is classified as CONNECTION_ERROR.
        
        **Validates: Requirement 3.1**
        """
        error = ConnectionError("Connection refused")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.CONNECTION_ERROR

    def test_timeout_error_classified_correctly(self):
        """
        Test that TimeoutError is classified as CONNECTION_ERROR.
        
        **Validates: Requirement 3.1**
        """
        error = TimeoutError("Operation timed out")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.CONNECTION_ERROR

    def test_connection_reset_error_classified_correctly(self):
        """
        Test that ConnectionResetError is classified as CONNECTION_ERROR.
        
        **Validates: Requirement 3.1**
        """
        error = ConnectionResetError("Connection reset by peer")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.CONNECTION_ERROR

    def test_broken_pipe_error_classified_correctly(self):
        """
        Test that BrokenPipeError is classified as CONNECTION_ERROR.
        
        **Validates: Requirement 3.1**
        """
        error = BrokenPipeError("Broken pipe")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.CONNECTION_ERROR

    def test_os_error_classified_as_connection_error(self):
        """
        Test that OSError is classified as CONNECTION_ERROR.
        
        **Validates: Requirement 3.1**
        """
        error = OSError("Network unreachable")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.CONNECTION_ERROR

    def test_data_fetch_error_classified_correctly(self):
        """
        Test that DataFetchError is classified as DATA_FETCH_ERROR.
        
        **Validates: Requirement 3.2**
        """
        error = DataFetchError("Failed to fetch habits")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.DATA_FETCH_ERROR

    def test_value_error_classified_as_validation(self):
        """Test that ValueError is classified as VALIDATION_ERROR."""
        error = ValueError("Invalid input")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.VALIDATION_ERROR

    def test_type_error_classified_as_validation(self):
        """Test that TypeError is classified as VALIDATION_ERROR."""
        error = TypeError("Type mismatch")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.VALIDATION_ERROR

    def test_unknown_error_classified_correctly(self):
        """Test that unknown errors are classified as UNKNOWN_ERROR."""
        error = RuntimeError("Something unexpected")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.UNKNOWN_ERROR


class TestClassifyErrorByKeyword:
    """Tests for error classification by keyword matching."""

    def test_connection_keyword_in_message(self):
        """Test that 'connection' keyword triggers CONNECTION_ERROR."""
        error = Exception("Database connection failed")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.CONNECTION_ERROR

    def test_timeout_keyword_in_message(self):
        """Test that 'timeout' keyword triggers CONNECTION_ERROR."""
        error = Exception("Request timeout occurred")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.CONNECTION_ERROR

    def test_network_keyword_in_message(self):
        """Test that 'network' keyword triggers CONNECTION_ERROR."""
        error = Exception("Network error")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.CONNECTION_ERROR

    def test_database_keyword_in_message(self):
        """
        Test that 'database' keyword triggers DATA_FETCH_ERROR.
        
        **Validates: Requirement 3.2**
        """
        error = Exception("Database query failed")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.DATA_FETCH_ERROR

    def test_supabase_keyword_in_message(self):
        """
        Test that 'supabase' keyword triggers DATA_FETCH_ERROR.
        
        **Validates: Requirement 3.2**
        """
        error = Exception("Supabase error occurred")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.DATA_FETCH_ERROR

    def test_validation_keyword_in_message(self):
        """Test that 'validation' keyword triggers VALIDATION_ERROR."""
        error = Exception("Validation failed for input")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.VALIDATION_ERROR


# =============================================================================
# Test: SlackErrorHandler.handle_error
# =============================================================================

class TestHandleError:
    """
    Tests for SlackErrorHandler.handle_error method.
    
    **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    """

    def test_connection_error_returns_user_friendly_message(self):
        """
        Test that connection error returns user-friendly message.
        
        **Validates: Requirement 3.1**
        """
        error = ConnectionError("Connection refused")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error)
        
        assert "一時的な接続エラーが発生しました" in result["text"]
        assert "しばらくしてから再度お試しください" in result["text"]
        # Technical details should NOT be in the message
        assert "Connection refused" not in result["text"]

    def test_data_fetch_error_returns_correct_message(self):
        """
        Test that data fetch error returns correct message.
        
        **Validates: Requirement 3.2**
        """
        error = DataFetchError("Query failed")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error)
        
        assert "データの取得に失敗しました" in result["text"]
        # Should NOT say "習慣がありません"
        assert "習慣がありません" not in result["text"]
        # Technical details should NOT be in the message
        assert "Query failed" not in result["text"]

    def test_validation_error_returns_correct_message(self):
        """Test that validation error returns correct message."""
        error = ValueError("Invalid input")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error)
        
        assert "入力内容に問題があります" in result["text"]

    def test_unknown_error_returns_generic_message(self):
        """Test that unknown error returns generic message."""
        error = RuntimeError("Something unexpected")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error)
        
        assert "予期しないエラーが発生しました" in result["text"]

    def test_returns_slack_block_format(self):
        """
        Test that response is in Slack block format.
        
        **Validates: Requirement 3.3**
        """
        error = ConnectionError("Test error")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error)
        
        assert "response_type" in result
        assert result["response_type"] == "ephemeral"
        assert "text" in result
        assert "blocks" in result
        assert isinstance(result["blocks"], list)
        assert len(result["blocks"]) > 0
        assert result["blocks"][0]["type"] == "section"

    def test_logs_error_details(self):
        """
        Test that error details are logged.
        
        **Validates: Requirement 3.4**
        """
        error = ConnectionError("Connection refused")
        mock_logger = MagicMock()
        
        with patch.object(SlackErrorHandler, '_logger', mock_logger):
            SlackErrorHandler.handle_error(error)
        
        mock_logger.error.assert_called_once()
        call_args = mock_logger.error.call_args
        assert "connection_error" in str(call_args)

    def test_logs_context_information(self):
        """
        Test that context information is included in logs.
        
        **Validates: Requirement 3.4**
        """
        error = ConnectionError("Connection refused")
        context = {"command": "/habit-done", "user_id": "U123"}
        mock_logger = MagicMock()
        
        with patch.object(SlackErrorHandler, '_logger', mock_logger):
            SlackErrorHandler.handle_error(error, context=context)
        
        mock_logger.error.assert_called_once()
        call_kwargs = mock_logger.error.call_args[1]
        assert call_kwargs.get("command") == "/habit-done"
        assert call_kwargs.get("user_id") == "U123"


# =============================================================================
# Test: SlackErrorHandler Helper Methods
# =============================================================================

class TestHelperMethods:
    """Tests for SlackErrorHandler helper methods."""

    def test_create_connection_error_response(self):
        """
        Test create_connection_error_response method.
        
        **Validates: Requirement 3.1**
        """
        result = SlackErrorHandler.create_connection_error_response()
        
        assert "一時的な接続エラーが発生しました" in result["text"]
        assert result["response_type"] == "ephemeral"
        assert "blocks" in result

    def test_create_data_fetch_error_response(self):
        """
        Test create_data_fetch_error_response method.
        
        **Validates: Requirement 3.2**
        """
        result = SlackErrorHandler.create_data_fetch_error_response()
        
        assert "データの取得に失敗しました" in result["text"]
        assert result["response_type"] == "ephemeral"
        assert "blocks" in result

    def test_create_validation_error_response_without_details(self):
        """Test create_validation_error_response without details."""
        result = SlackErrorHandler.create_validation_error_response()
        
        assert "入力内容に問題があります" in result["text"]
        assert result["response_type"] == "ephemeral"

    def test_create_validation_error_response_with_details(self):
        """Test create_validation_error_response with details."""
        result = SlackErrorHandler.create_validation_error_response(
            details="習慣名を入力してください。"
        )
        
        assert "入力内容に問題があります" in result["text"]
        assert "習慣名を入力してください" in result["text"]


# =============================================================================
# Test: Error Icons
# =============================================================================

class TestErrorIcons:
    """Tests for error icon selection."""

    def test_connection_error_icon(self):
        """Test that connection error uses plug icon."""
        error = ConnectionError("Test")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error)
        
        block_text = result["blocks"][0]["text"]["text"]
        assert "🔌" in block_text

    def test_data_fetch_error_icon(self):
        """Test that data fetch error uses chart icon."""
        error = DataFetchError("Test")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error)
        
        block_text = result["blocks"][0]["text"]["text"]
        assert "📊" in block_text

    def test_validation_error_icon(self):
        """Test that validation error uses warning icon."""
        error = ValueError("Test")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error)
        
        block_text = result["blocks"][0]["text"]["text"]
        assert "⚠️" in block_text

    def test_unknown_error_icon(self):
        """Test that unknown error uses X icon."""
        error = RuntimeError("Test")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error)
        
        block_text = result["blocks"][0]["text"]["text"]
        assert "❌" in block_text


# =============================================================================
# Test: Edge Cases
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases in SlackErrorHandler."""

    def test_empty_error_message(self):
        """Test handling of error with empty message."""
        error = Exception("")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error)
        
        # Should still return a valid response
        assert "response_type" in result
        assert "blocks" in result

    def test_none_context(self):
        """Test handling with None context."""
        error = ConnectionError("Test")
        
        with patch.object(SlackErrorHandler, '_logger'):
            result = SlackErrorHandler.handle_error(error, context=None)
        
        assert "response_type" in result

    def test_data_fetch_error_with_original_error_logged(self):
        """Test that DataFetchError's original error is logged."""
        original = ConnectionError("Original connection error")
        error = DataFetchError("Failed to fetch", original_error=original)
        mock_logger = MagicMock()
        
        with patch.object(SlackErrorHandler, '_logger', mock_logger):
            SlackErrorHandler.handle_error(error)
        
        call_kwargs = mock_logger.error.call_args[1]
        assert call_kwargs.get("original_error_class") == "ConnectionError"
        assert "Original connection error" in call_kwargs.get("original_error_message", "")

    def test_ssl_error_classified_as_connection(self):
        """Test that SSL-related errors are classified as connection errors."""
        error = Exception("SSL certificate verification failed")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.CONNECTION_ERROR

    def test_postgrest_error_classified_as_data_fetch(self):
        """Test that PostgREST errors are classified as data fetch errors."""
        error = Exception("PostgREST error: relation not found")
        result = SlackErrorHandler.classify_error(error)
        
        assert result == ErrorType.DATA_FETCH_ERROR
