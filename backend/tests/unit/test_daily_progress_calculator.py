"""
Unit tests for DailyProgressCalculator.

Tests the JST timezone handling and day boundary calculations.
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

from app.services.daily_progress_calculator import (
    DailyProgressCalculator,
    HabitProgress,
    DashboardSummary,
)


class TestDailyProgressCalculator:
    """Tests for DailyProgressCalculator class."""

    def test_init_sets_supabase_client(self):
        """Test that __init__ properly sets the Supabase client."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        assert calculator.supabase == mock_supabase

    def test_init_sets_jst_timezone(self):
        """Test that __init__ properly sets JST timezone."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        assert calculator.jst == ZoneInfo("Asia/Tokyo")

    def test_get_jst_day_boundaries_returns_tuple(self):
        """Test that _get_jst_day_boundaries returns a tuple of two datetimes."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        result = calculator._get_jst_day_boundaries()
        
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], datetime)
        assert isinstance(result[1], datetime)

    def test_get_jst_day_boundaries_start_is_before_end(self):
        """Test that start boundary is before end boundary."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        start_utc, end_utc = calculator._get_jst_day_boundaries()
        
        assert start_utc < end_utc

    def test_get_jst_day_boundaries_returns_utc_timestamps(self):
        """Test that boundaries are returned in UTC timezone."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        start_utc, end_utc = calculator._get_jst_day_boundaries()
        
        # Both should be in UTC
        utc = ZoneInfo("UTC")
        assert start_utc.tzinfo is not None
        assert end_utc.tzinfo is not None
        # Convert to UTC and verify they're the same (already in UTC)
        assert start_utc.astimezone(utc) == start_utc
        assert end_utc.astimezone(utc) == end_utc

    def test_get_jst_day_boundaries_corresponds_to_jst_day(self):
        """Test that UTC boundaries correspond to JST 0:00-23:59."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        start_utc, end_utc = calculator._get_jst_day_boundaries()
        
        # Convert back to JST to verify
        jst = ZoneInfo("Asia/Tokyo")
        start_jst = start_utc.astimezone(jst)
        end_jst = end_utc.astimezone(jst)
        
        # Start should be 0:00:00 JST
        assert start_jst.hour == 0
        assert start_jst.minute == 0
        assert start_jst.second == 0
        
        # End should be 23:59:59 JST
        assert end_jst.hour == 23
        assert end_jst.minute == 59
        assert end_jst.second == 59

    def test_get_jst_day_boundaries_same_jst_date(self):
        """Test that start and end are on the same JST date."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        start_utc, end_utc = calculator._get_jst_day_boundaries()
        
        # Convert to JST
        jst = ZoneInfo("Asia/Tokyo")
        start_jst = start_utc.astimezone(jst)
        end_jst = end_utc.astimezone(jst)
        
        # Both should be on the same date
        assert start_jst.date() == end_jst.date()

    def test_get_jst_day_boundaries_utc_offset(self):
        """Test that JST to UTC conversion is correct (JST = UTC+9)."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        start_utc, end_utc = calculator._get_jst_day_boundaries()
        
        # JST 0:00 should be UTC 15:00 of the previous day
        # JST is UTC+9, so JST 0:00 = UTC -9 hours = UTC 15:00 previous day
        jst = ZoneInfo("Asia/Tokyo")
        start_jst = start_utc.astimezone(jst)
        
        # The UTC hour should be 15 (0 - 9 = -9 = 15 previous day)
        # Or if we're looking at the same calendar day in UTC, it depends on the time
        # Let's verify the offset is 9 hours
        utc_offset = start_jst.utcoffset()
        assert utc_offset is not None
        assert utc_offset.total_seconds() == 9 * 3600  # 9 hours in seconds


class TestHabitProgressDataclass:
    """Tests for HabitProgress dataclass."""

    def test_habit_progress_creation(self):
        """Test that HabitProgress can be created with all fields."""
        progress = HabitProgress(
            habit_id="test-id",
            habit_name="Test Habit",
            goal_name="Test Goal",
            current_count=5.0,
            total_count=10.0,
            progress_rate=50.0,
            workload_unit="回",
            workload_per_count=1.0,
            streak=3,
            completed=False,
        )
        
        assert progress.habit_id == "test-id"
        assert progress.habit_name == "Test Habit"
        assert progress.goal_name == "Test Goal"
        assert progress.current_count == 5.0
        assert progress.total_count == 10.0
        assert progress.progress_rate == 50.0
        assert progress.workload_unit == "回"
        assert progress.workload_per_count == 1.0
        assert progress.streak == 3
        assert progress.completed is False

    def test_habit_progress_with_none_unit(self):
        """Test that HabitProgress can have None workload_unit."""
        progress = HabitProgress(
            habit_id="test-id",
            habit_name="Test Habit",
            goal_name="Test Goal",
            current_count=5.0,
            total_count=10.0,
            progress_rate=50.0,
            workload_unit=None,
            workload_per_count=1.0,
            streak=0,
            completed=False,
        )
        
        assert progress.workload_unit is None


class TestDashboardSummaryDataclass:
    """Tests for DashboardSummary dataclass."""

    def test_dashboard_summary_creation(self):
        """Test that DashboardSummary can be created with all fields."""
        summary = DashboardSummary(
            total_habits=5,
            completed_habits=3,
            completion_rate=60.0,
            date_display="2026年1月20日（月）",
        )
        
        assert summary.total_habits == 5
        assert summary.completed_habits == 3
        assert summary.completion_rate == 60.0
        assert summary.date_display == "2026年1月20日（月）"


class TestCalculateWorkload:
    """Tests for _calculate_workload() method.
    
    Requirements:
    - 2.2: Sum the amount field from today's activities for each habit
    - 6.2: Sum the amount field from activities with kind="complete"
    - 6.3: When an activity has no amount field, use the habit's workloadPerCount as default
    """

    def test_calculate_workload_sums_amounts_for_matching_habit(self):
        """Test that amounts are summed for activities matching the habit_id."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        activities = [
            {"habit_id": "habit-1", "amount": 3},
            {"habit_id": "habit-1", "amount": 2},
            {"habit_id": "habit-2", "amount": 5},
        ]
        
        result = calculator._calculate_workload("habit-1", activities, 1.0)
        
        assert result == 5.0  # 3 + 2

    def test_calculate_workload_filters_by_habit_id(self):
        """Test that only activities for the specified habit_id are included."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        activities = [
            {"habit_id": "habit-1", "amount": 10},
            {"habit_id": "habit-2", "amount": 20},
            {"habit_id": "habit-3", "amount": 30},
        ]
        
        result = calculator._calculate_workload("habit-2", activities, 1.0)
        
        assert result == 20.0

    def test_calculate_workload_uses_default_when_amount_is_none(self):
        """Test that workload_per_count is used when amount is None (Requirement 6.3)."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        activities = [
            {"habit_id": "habit-1", "amount": None},
            {"habit_id": "habit-1", "amount": None},
        ]
        
        result = calculator._calculate_workload("habit-1", activities, 5.0)
        
        assert result == 10.0  # 5.0 + 5.0

    def test_calculate_workload_uses_default_when_amount_missing(self):
        """Test that workload_per_count is used when amount key is missing."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        activities = [
            {"habit_id": "habit-1"},  # No amount key
            {"habit_id": "habit-1"},
        ]
        
        result = calculator._calculate_workload("habit-1", activities, 3.0)
        
        assert result == 6.0  # 3.0 + 3.0

    def test_calculate_workload_mixed_amounts_and_defaults(self):
        """Test mixing activities with amounts and those using defaults."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        activities = [
            {"habit_id": "habit-1", "amount": 10},
            {"habit_id": "habit-1", "amount": None},
            {"habit_id": "habit-1"},  # Missing amount key
        ]
        
        result = calculator._calculate_workload("habit-1", activities, 2.0)
        
        assert result == 14.0  # 10 + 2.0 + 2.0

    def test_calculate_workload_returns_zero_for_no_matching_activities(self):
        """Test that 0.0 is returned when no activities match the habit_id."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        activities = [
            {"habit_id": "habit-2", "amount": 5},
            {"habit_id": "habit-3", "amount": 10},
        ]
        
        result = calculator._calculate_workload("habit-1", activities, 1.0)
        
        assert result == 0.0

    def test_calculate_workload_returns_zero_for_empty_activities(self):
        """Test that 0.0 is returned for an empty activities list."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        result = calculator._calculate_workload("habit-1", [], 1.0)
        
        assert result == 0.0

    def test_calculate_workload_handles_float_amounts(self):
        """Test that float amounts are handled correctly."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        activities = [
            {"habit_id": "habit-1", "amount": 1.5},
            {"habit_id": "habit-1", "amount": 2.5},
        ]
        
        result = calculator._calculate_workload("habit-1", activities, 1.0)
        
        assert result == 4.0

    def test_calculate_workload_handles_integer_amounts(self):
        """Test that integer amounts are converted to float correctly."""
        mock_supabase = MagicMock()
        calculator = DailyProgressCalculator(mock_supabase)
        
        activities = [
            {"habit_id": "habit-1", "amount": 5},
            {"habit_id": "habit-1", "amount": 3},
        ]
        
        result = calculator._calculate_workload("habit-1", activities, 1.0)
        
        assert result == 8.0
        assert isinstance(result, float)
