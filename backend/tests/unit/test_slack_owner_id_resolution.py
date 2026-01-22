"""
Unit Tests for Slack Owner ID Resolution

Tests that verify the owner_id is correctly extracted from slack_connections
and used for habit queries, NOT the slack_user_id.

**Validates: Requirements 1.1, 1.2, 1.4**
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
from io import BytesIO

from app.schemas.slack import SlackConnectionResponse
from app.routers.slack_webhook import (
    handle_slash_command,
    handle_interaction,
    _handle_habit_list,
    _handle_habit_status,
    _handle_habit_done,
)


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def mock_connection_distinct_ids():
    """
    Create a mock SlackConnectionResponse where owner_id (VOW UUID) is 
    distinctly different from slack_user_id (Slack ID).
    
    This is the critical test case - the bug was using slack_user_id 
    instead of owner_id for habit queries.
    """
    return SlackConnectionResponse(
        id="conn-123",
        owner_type="user",
        owner_id="2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47",  # VOW user UUID
        slack_user_id="U0A9L0TME1Y",  # Slack user ID (different!)
        slack_team_id="T0A9L0TME1X",
        slack_team_name="Test Workspace",
        slack_user_name="testuser",
        connected_at=datetime.now(),
        is_valid=True,
    )


@pytest.fixture
def mock_connection_team_owner():
    """
    Create a mock SlackConnectionResponse for a team owner type.
    """
    return SlackConnectionResponse(
        id="conn-456",
        owner_type="team",
        owner_id="team-uuid-12345678-abcd-efgh-ijkl",  # VOW team UUID
        slack_user_id="U0B8M1UNF2Z",  # Slack user ID
        slack_team_id="T0B8M1UNF2Y",
        slack_team_name="Team Workspace",
        slack_user_name="teamadmin",
        connected_at=datetime.now(),
        is_valid=True,
    )


@pytest.fixture
def mock_habits():
    """Sample habits for testing."""
    return [
        {
            "id": "habit-1",
            "name": "Morning Exercise",
            "owner_type": "user",
            "owner_id": "2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47",
            "active": True,
            "completed": False,
            "streak": 5,
            "goal_name": "Health",
        },
        {
            "id": "habit-2",
            "name": "Read 30 minutes",
            "owner_type": "user",
            "owner_id": "2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47",
            "active": True,
            "completed": True,
            "streak": 10,
            "goal_name": "Learning",
        },
    ]


@pytest.fixture
def mock_today_summary():
    """Sample today summary for testing."""
    return {
        "completed": 1,
        "total": 2,
        "completion_rate": 50.0,
        "habits": [
            {"id": "habit-1", "name": "Morning Exercise", "completed": False},
            {"id": "habit-2", "name": "Read 30 minutes", "completed": True},
        ],
    }


# =============================================================================
# Test: Owner ID Resolution in Slash Commands
# =============================================================================

class TestOwnerIdResolutionSlashCommands:
    """
    Tests that verify owner_id from connection is used for habit queries,
    NOT slack_user_id.
    
    **Validates: Requirements 1.1, 1.2, 1.4**
    """

    @pytest.mark.asyncio
    async def test_habit_list_uses_owner_id_not_slack_user_id(
        self, mock_connection_distinct_ids, mock_habits
    ):
        """
        Test that /habit-list command uses connection.owner_id for queries,
        NOT connection.slack_user_id.
        
        **Validates: Requirements 1.1, 1.2**
        
        This is the core bug fix test - the original code incorrectly used:
            owner_id = connection.slack_user_id  # BUG
        Instead of:
            owner_id = connection.owner_id  # CORRECT
        """
        # Create mock HabitCompletionReporter
        mock_reporter = AsyncMock()
        mock_reporter.get_all_habits_with_status = AsyncMock(return_value=mock_habits)
        
        # Call the handler with the correct owner_id
        result = await _handle_habit_list(
            reporter=mock_reporter,
            owner_id=mock_connection_distinct_ids.owner_id,  # Should be VOW UUID
            owner_type=mock_connection_distinct_ids.owner_type,
        )
        
        # Verify the reporter was called with the VOW owner_id, NOT slack_user_id
        mock_reporter.get_all_habits_with_status.assert_called_once_with(
            "2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47",  # VOW UUID
            "user",
        )
        
        # Verify it was NOT called with the Slack user ID
        call_args = mock_reporter.get_all_habits_with_status.call_args
        assert call_args[0][0] != "U0A9L0TME1Y", \
            "Should NOT use slack_user_id for habit queries"
        
        # Verify response structure
        assert "blocks" in result
        assert result.get("response_type") == "ephemeral"

    @pytest.mark.asyncio
    async def test_habit_status_uses_owner_id_not_slack_user_id(
        self, mock_connection_distinct_ids, mock_today_summary
    ):
        """
        Test that /habit-status command uses connection.owner_id for queries.
        
        **Validates: Requirements 1.1, 1.4**
        """
        mock_reporter = AsyncMock()
        mock_reporter.get_today_summary = AsyncMock(return_value=mock_today_summary)
        
        result = await _handle_habit_status(
            reporter=mock_reporter,
            owner_id=mock_connection_distinct_ids.owner_id,
            owner_type=mock_connection_distinct_ids.owner_type,
        )
        
        # Verify called with VOW owner_id
        mock_reporter.get_today_summary.assert_called_once_with(
            "2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47",
            "user",
        )
        
        # Verify NOT called with Slack user ID
        call_args = mock_reporter.get_today_summary.call_args
        assert call_args[0][0] != "U0A9L0TME1Y"

    @pytest.mark.asyncio
    async def test_habit_done_uses_owner_id_not_slack_user_id(
        self, mock_connection_distinct_ids
    ):
        """
        Test that /habit-done command uses connection.owner_id for queries.
        
        **Validates: Requirements 1.1, 1.4**
        """
        mock_reporter = AsyncMock()
        mock_reporter.complete_habit_by_name = AsyncMock(
            return_value=(True, "Habit completed", {
                "habit": {"id": "habit-1", "name": "Morning Exercise"},
                "streak": 6,
            })
        )
        
        result = await _handle_habit_done(
            reporter=mock_reporter,
            owner_id=mock_connection_distinct_ids.owner_id,
            owner_type=mock_connection_distinct_ids.owner_type,
            habit_name="Morning Exercise",
        )
        
        # Verify called with VOW owner_id
        mock_reporter.complete_habit_by_name.assert_called_once()
        call_args = mock_reporter.complete_habit_by_name.call_args
        
        # First positional arg should be owner_id (VOW UUID)
        assert call_args[0][0] == "2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47"
        assert call_args[0][0] != "U0A9L0TME1Y", \
            "Should NOT use slack_user_id for habit completion"

    @pytest.mark.asyncio
    async def test_habit_done_without_name_uses_owner_id(
        self, mock_connection_distinct_ids, mock_habits
    ):
        """
        Test that /habit-done without a habit name uses owner_id for 
        fetching incomplete habits.
        
        **Validates: Requirements 1.1, 1.4**
        """
        mock_reporter = AsyncMock()
        mock_reporter.get_incomplete_habits_today = AsyncMock(return_value=mock_habits)
        
        result = await _handle_habit_done(
            reporter=mock_reporter,
            owner_id=mock_connection_distinct_ids.owner_id,
            owner_type=mock_connection_distinct_ids.owner_type,
            habit_name="",  # Empty name triggers incomplete habits list
        )
        
        # Verify called with VOW owner_id
        mock_reporter.get_incomplete_habits_today.assert_called_once_with(
            "2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47",
            "user",
        )


# =============================================================================
# Test: Owner ID Resolution with Different Owner Types
# =============================================================================

class TestOwnerIdResolutionOwnerTypes:
    """
    Tests that verify owner_type is also correctly extracted from connection.
    """

    @pytest.mark.asyncio
    async def test_team_owner_type_is_preserved(
        self, mock_connection_team_owner, mock_habits
    ):
        """
        Test that owner_type="team" is correctly passed to habit queries.
        """
        mock_reporter = AsyncMock()
        mock_reporter.get_all_habits_with_status = AsyncMock(return_value=mock_habits)
        
        result = await _handle_habit_list(
            reporter=mock_reporter,
            owner_id=mock_connection_team_owner.owner_id,
            owner_type=mock_connection_team_owner.owner_type,
        )
        
        # Verify called with team owner_type
        mock_reporter.get_all_habits_with_status.assert_called_once_with(
            "team-uuid-12345678-abcd-efgh-ijkl",
            "team",
        )


# =============================================================================
# Test: Missing Connection Error Handling
# =============================================================================

class TestMissingConnectionHandling:
    """
    Tests that verify appropriate error responses when no connection is found.
    
    **Validates: Requirement 1.4**
    """

    @pytest.mark.asyncio
    async def test_missing_connection_returns_not_connected_error(self):
        """
        Test that when no slack_connection is found, an appropriate 
        "not connected" error response is returned.
        
        **Validates: Requirement 1.4**
        """
        # Create mock request
        mock_request = AsyncMock()
        mock_request.body = AsyncMock(return_value=b"command=/habit-list&user_id=U_UNKNOWN&team_id=T_UNKNOWN&response_url=https://hooks.slack.com/test")
        mock_request.headers = {
            "X-Slack-Request-Timestamp": "1234567890",
            "X-Slack-Signature": "v0=test_signature",
        }
        
        # Mock the slack service to pass signature verification
        with patch("app.routers.slack_webhook.get_slack_service") as mock_get_service:
            mock_service = MagicMock()
            mock_service.verify_signature = MagicMock(return_value=True)
            mock_get_service.return_value = mock_service
            
            # Mock supabase and repository - need to mock get_supabase_with_retry
            with patch("app.routers.slack_webhook.get_supabase_with_retry") as mock_get_supabase:
                mock_supabase = MagicMock()
                mock_get_supabase.return_value = mock_supabase
                
                with patch("app.routers.slack_webhook.SlackRepository") as MockSlackRepo:
                    mock_repo = AsyncMock()
                    # Return None to simulate no connection found
                    mock_repo.get_connection_by_slack_user = AsyncMock(return_value=None)
                    MockSlackRepo.return_value = mock_repo
                    
                    # Call the handler
                    result = await handle_slash_command(mock_request)
                    
                    # Verify "not connected" response
                    assert result.get("response_type") == "ephemeral"
                    assert "blocks" in result
                    
                    # The SlackBlockBuilder.not_connected() should be called
                    # which returns blocks indicating user needs to connect

    @pytest.mark.asyncio
    async def test_connection_lookup_called_with_correct_params(self):
        """
        Test that connection lookup is called with the correct 
        slack_user_id and team_id from the command payload.
        """
        mock_request = AsyncMock()
        mock_request.body = AsyncMock(
            return_value=b"command=/habit-list&user_id=U0A9L0TME1Y&team_id=T0A9L0TME1X&response_url=https://hooks.slack.com/test"
        )
        mock_request.headers = {
            "X-Slack-Request-Timestamp": "1234567890",
            "X-Slack-Signature": "v0=test_signature",
        }
        
        with patch("app.routers.slack_webhook.get_slack_service") as mock_get_service:
            mock_service = MagicMock()
            mock_service.verify_signature = MagicMock(return_value=True)
            mock_get_service.return_value = mock_service
            
            # Mock get_supabase_with_retry instead of get_supabase
            with patch("app.routers.slack_webhook.get_supabase_with_retry") as mock_get_supabase:
                mock_supabase = MagicMock()
                mock_get_supabase.return_value = mock_supabase
                
                with patch("app.routers.slack_webhook.SlackRepository") as MockSlackRepo:
                    mock_repo = AsyncMock()
                    mock_repo.get_connection_by_slack_user = AsyncMock(return_value=None)
                    MockSlackRepo.return_value = mock_repo
                    
                    await handle_slash_command(mock_request)
                    
                    # Verify lookup was called with correct Slack IDs
                    mock_repo.get_connection_by_slack_user.assert_called_once_with(
                        "U0A9L0TME1Y",  # slack_user_id
                        "T0A9L0TME1X",  # slack_team_id
                    )


# =============================================================================
# Test: Full Slash Command Flow with Owner ID Resolution
# =============================================================================

class TestFullSlashCommandFlow:
    """
    Integration-style tests that verify the full flow from command receipt
    to habit query with correct owner_id.
    """

    @pytest.mark.asyncio
    async def test_full_habit_list_flow_uses_correct_owner_id(
        self, mock_connection_distinct_ids, mock_habits
    ):
        """
        Test the full /habit-list flow ensures owner_id from connection
        is used, not slack_user_id.
        
        **Validates: Requirements 1.1, 1.2, 1.4**
        """
        mock_request = AsyncMock()
        mock_request.body = AsyncMock(
            return_value=b"command=/habit-list&user_id=U0A9L0TME1Y&team_id=T0A9L0TME1X&response_url=https://hooks.slack.com/test"
        )
        mock_request.headers = {
            "X-Slack-Request-Timestamp": "1234567890",
            "X-Slack-Signature": "v0=test_signature",
        }
        
        with patch("app.routers.slack_webhook.get_slack_service") as mock_get_service:
            mock_service = MagicMock()
            mock_service.verify_signature = MagicMock(return_value=True)
            mock_get_service.return_value = mock_service
            
            # Mock get_supabase_with_retry instead of get_supabase
            with patch("app.routers.slack_webhook.get_supabase_with_retry") as mock_get_supabase:
                mock_supabase = MagicMock()
                mock_get_supabase.return_value = mock_supabase
                
                with patch("app.routers.slack_webhook.SlackRepository") as MockSlackRepo:
                    mock_repo = AsyncMock()
                    mock_repo.get_connection_by_slack_user = AsyncMock(
                        return_value=mock_connection_distinct_ids
                    )
                    MockSlackRepo.return_value = mock_repo
                    
                    with patch("app.routers.slack_webhook.HabitCompletionReporter") as MockReporter:
                        mock_reporter = AsyncMock()
                        mock_reporter.get_all_habits_with_status = AsyncMock(
                            return_value=mock_habits
                        )
                        MockReporter.return_value = mock_reporter
                        
                        result = await handle_slash_command(mock_request)
                        
                        # Verify HabitCompletionReporter was called with VOW owner_id
                        mock_reporter.get_all_habits_with_status.assert_called_once_with(
                            "2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47",  # VOW UUID
                            "user",
                        )
                        
                        # Verify it was NOT called with Slack user ID
                        call_args = mock_reporter.get_all_habits_with_status.call_args
                        assert call_args[0][0] != "U0A9L0TME1Y", \
                            "BUG: Should not use slack_user_id for habit queries!"

    @pytest.mark.asyncio
    async def test_full_habit_status_flow_uses_correct_owner_id(
        self, mock_connection_distinct_ids, mock_today_summary
    ):
        """
        Test the full /habit-status flow uses correct owner_id.
        
        **Validates: Requirements 1.1, 1.2, 1.4**
        """
        mock_request = AsyncMock()
        mock_request.body = AsyncMock(
            return_value=b"command=/habit-status&user_id=U0A9L0TME1Y&team_id=T0A9L0TME1X&response_url=https://hooks.slack.com/test"
        )
        mock_request.headers = {
            "X-Slack-Request-Timestamp": "1234567890",
            "X-Slack-Signature": "v0=test_signature",
        }
        
        with patch("app.routers.slack_webhook.get_slack_service") as mock_get_service:
            mock_service = MagicMock()
            mock_service.verify_signature = MagicMock(return_value=True)
            mock_get_service.return_value = mock_service
            
            # Mock get_supabase_with_retry instead of get_supabase
            with patch("app.routers.slack_webhook.get_supabase_with_retry") as mock_get_supabase:
                mock_supabase = MagicMock()
                mock_get_supabase.return_value = mock_supabase
                
                with patch("app.routers.slack_webhook.SlackRepository") as MockSlackRepo:
                    mock_repo = AsyncMock()
                    mock_repo.get_connection_by_slack_user = AsyncMock(
                        return_value=mock_connection_distinct_ids
                    )
                    MockSlackRepo.return_value = mock_repo
                    
                    with patch("app.routers.slack_webhook.HabitCompletionReporter") as MockReporter:
                        mock_reporter = AsyncMock()
                        mock_reporter.get_today_summary = AsyncMock(
                            return_value=mock_today_summary
                        )
                        MockReporter.return_value = mock_reporter
                        
                        result = await handle_slash_command(mock_request)
                        
                        # Verify called with VOW owner_id
                        mock_reporter.get_today_summary.assert_called_once_with(
                            "2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47",
                            "user",
                        )

    @pytest.mark.asyncio
    async def test_full_habit_done_flow_uses_correct_owner_id(
        self, mock_connection_distinct_ids
    ):
        """
        Test the full /habit-done flow uses correct owner_id.
        
        **Validates: Requirements 1.1, 1.2, 1.4**
        """
        mock_request = AsyncMock()
        mock_request.body = AsyncMock(
            return_value=b"command=/habit-done&text=Morning Exercise&user_id=U0A9L0TME1Y&team_id=T0A9L0TME1X&response_url=https://hooks.slack.com/test"
        )
        mock_request.headers = {
            "X-Slack-Request-Timestamp": "1234567890",
            "X-Slack-Signature": "v0=test_signature",
        }
        
        with patch("app.routers.slack_webhook.get_slack_service") as mock_get_service:
            mock_service = MagicMock()
            mock_service.verify_signature = MagicMock(return_value=True)
            mock_get_service.return_value = mock_service
            
            # Mock get_supabase_with_retry instead of get_supabase
            with patch("app.routers.slack_webhook.get_supabase_with_retry") as mock_get_supabase:
                mock_supabase = MagicMock()
                mock_get_supabase.return_value = mock_supabase
                
                with patch("app.routers.slack_webhook.SlackRepository") as MockSlackRepo:
                    mock_repo = AsyncMock()
                    mock_repo.get_connection_by_slack_user = AsyncMock(
                        return_value=mock_connection_distinct_ids
                    )
                    MockSlackRepo.return_value = mock_repo
                    
                    with patch("app.routers.slack_webhook.HabitCompletionReporter") as MockReporter:
                        mock_reporter = AsyncMock()
                        mock_reporter.complete_habit_by_name = AsyncMock(
                            return_value=(True, "Completed", {
                                "habit": {"name": "Morning Exercise"},
                                "streak": 6,
                            })
                        )
                        MockReporter.return_value = mock_reporter
                        
                        result = await handle_slash_command(mock_request)
                        
                        # Verify called with VOW owner_id
                        mock_reporter.complete_habit_by_name.assert_called_once()
                        call_args = mock_reporter.complete_habit_by_name.call_args
                        assert call_args[0][0] == "2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47"


# =============================================================================
# Test: Connection Schema Validation
# =============================================================================

class TestConnectionSchemaValidation:
    """
    Tests that verify SlackConnectionResponse correctly preserves
    owner_id and slack_user_id as distinct fields.
    """

    def test_connection_response_preserves_distinct_ids(self):
        """
        Test that SlackConnectionResponse correctly stores both
        owner_id (VOW UUID) and slack_user_id (Slack ID) as separate fields.
        """
        connection = SlackConnectionResponse(
            id="conn-123",
            owner_type="user",
            owner_id="2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47",
            slack_user_id="U0A9L0TME1Y",
            slack_team_id="T0A9L0TME1X",
            slack_team_name="Test",
            slack_user_name="testuser",
            connected_at=datetime.now(),
            is_valid=True,
        )
        
        # Verify both IDs are preserved and distinct
        assert connection.owner_id == "2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47"
        assert connection.slack_user_id == "U0A9L0TME1Y"
        assert connection.owner_id != connection.slack_user_id

    def test_connection_response_owner_type_preserved(self):
        """
        Test that owner_type is correctly preserved in the connection.
        """
        connection = SlackConnectionResponse(
            id="conn-123",
            owner_type="team",
            owner_id="team-uuid-123",
            slack_user_id="U0A9L0TME1Y",
            slack_team_id="T0A9L0TME1X",
            slack_team_name="Test",
            slack_user_name="testuser",
            connected_at=datetime.now(),
            is_valid=True,
        )
        
        assert connection.owner_type == "team"
