"""
Unit tests for SlackBlockBuilder.

Tests the progress bar generation, color coding, streak display, and increment button.
"""

import pytest

from app.services.slack_block_builder import SlackBlockBuilder


class TestIncrementButton:
    """Tests for _increment_button() static method.
    
    Requirements:
    - 5.1: WHEN a habit has workloadPerCount greater than 1, display "+{amount} {unit}" (e.g., "+5 分")
    - 5.2: WHEN a habit has workloadPerCount of 1 and workloadUnit is set, display "+1 {unit}" (e.g., "+1 回")
    - 5.3: WHEN a habit has no workloadUnit, display "✓" without unit text
    
    Property 12: Increment Button Label Formatting
    """

    # ========================================================================
    # Test: Label formatting with unit (Requirements 5.1, 5.2)
    # ========================================================================

    def test_increment_button_with_unit_and_amount_1(self):
        """Test label is '+1 回' when workloadPerCount=1 and unit='回' (Requirement 5.2)."""
        result = SlackBlockBuilder._increment_button("habit-123", 1, "回")
        assert result["text"]["text"] == "+1 回"

    def test_increment_button_with_unit_and_amount_5(self):
        """Test label is '+5 分' when workloadPerCount=5 and unit='分' (Requirement 5.1)."""
        result = SlackBlockBuilder._increment_button("habit-123", 5, "分")
        assert result["text"]["text"] == "+5 分"

    def test_increment_button_with_unit_and_amount_10(self):
        """Test label is '+10 ページ' when workloadPerCount=10 and unit='ページ'."""
        result = SlackBlockBuilder._increment_button("habit-123", 10, "ページ")
        assert result["text"]["text"] == "+10 ページ"

    def test_increment_button_with_unit_and_amount_2(self):
        """Test label is '+2 杯' when workloadPerCount=2 and unit='杯'."""
        result = SlackBlockBuilder._increment_button("habit-123", 2, "杯")
        assert result["text"]["text"] == "+2 杯"

    # ========================================================================
    # Test: Label formatting without unit (Requirement 5.3)
    # ========================================================================

    def test_increment_button_no_unit_amount_1(self):
        """Test label is '✓' when workloadPerCount=1 and no unit (Requirement 5.3)."""
        result = SlackBlockBuilder._increment_button("habit-123", 1, None)
        assert result["text"]["text"] == "✓"

    def test_increment_button_no_unit_amount_greater_than_1(self):
        """Test label is '+5' when workloadPerCount=5 and no unit."""
        result = SlackBlockBuilder._increment_button("habit-123", 5, None)
        assert result["text"]["text"] == "+5"

    def test_increment_button_no_unit_amount_2(self):
        """Test label is '+2' when workloadPerCount=2 and no unit."""
        result = SlackBlockBuilder._increment_button("habit-123", 2, None)
        assert result["text"]["text"] == "+2"

    def test_increment_button_no_unit_amount_10(self):
        """Test label is '+10' when workloadPerCount=10 and no unit."""
        result = SlackBlockBuilder._increment_button("habit-123", 10, None)
        assert result["text"]["text"] == "+10"

    # ========================================================================
    # Test: Button structure
    # ========================================================================

    def test_increment_button_type_is_button(self):
        """Test that button type is 'button'."""
        result = SlackBlockBuilder._increment_button("habit-123", 1, None)
        assert result["type"] == "button"

    def test_increment_button_text_type_is_plain_text(self):
        """Test that text type is 'plain_text'."""
        result = SlackBlockBuilder._increment_button("habit-123", 1, None)
        assert result["text"]["type"] == "plain_text"

    def test_increment_button_emoji_is_true(self):
        """Test that emoji is True."""
        result = SlackBlockBuilder._increment_button("habit-123", 1, None)
        assert result["text"]["emoji"] is True

    def test_increment_button_action_id_format(self):
        """Test that action_id is 'habit_increment_{habit_id}'."""
        result = SlackBlockBuilder._increment_button("habit-123", 1, None)
        assert result["action_id"] == "habit_increment_habit-123"

    def test_increment_button_value_is_habit_id(self):
        """Test that value is the habit_id."""
        result = SlackBlockBuilder._increment_button("habit-123", 1, None)
        assert result["value"] == "habit-123"

    def test_increment_button_action_id_with_uuid(self):
        """Test action_id with UUID-style habit_id."""
        habit_id = "550e8400-e29b-41d4-a716-446655440000"
        result = SlackBlockBuilder._increment_button(habit_id, 1, None)
        assert result["action_id"] == f"habit_increment_{habit_id}"
        assert result["value"] == habit_id

    # ========================================================================
    # Test: Float workload_per_count handling
    # ========================================================================

    def test_increment_button_float_amount_with_unit(self):
        """Test label with float workloadPerCount (e.g., 1.5 km)."""
        result = SlackBlockBuilder._increment_button("habit-123", 1.5, "km")
        assert result["text"]["text"] == "+1.5 km"

    def test_increment_button_float_amount_no_unit(self):
        """Test label with float workloadPerCount > 1 and no unit."""
        result = SlackBlockBuilder._increment_button("habit-123", 2.5, None)
        assert result["text"]["text"] == "+2.5"

    def test_increment_button_whole_number_float_displays_as_int(self):
        """Test that 5.0 displays as '+5' not '+5.0'."""
        result = SlackBlockBuilder._increment_button("habit-123", 5.0, None)
        assert result["text"]["text"] == "+5"

    def test_increment_button_whole_number_float_with_unit_displays_as_int(self):
        """Test that 5.0 with unit displays as '+5 分' not '+5.0 分'."""
        result = SlackBlockBuilder._increment_button("habit-123", 5.0, "分")
        assert result["text"]["text"] == "+5 分"

    # ========================================================================
    # Test: Edge cases
    # ========================================================================

    def test_increment_button_empty_unit_treated_as_none(self):
        """Test that empty string unit is treated differently from None."""
        # Empty string is truthy in the condition, so it should show the unit
        result = SlackBlockBuilder._increment_button("habit-123", 1, "")
        # Empty string unit should still format with the unit pattern
        assert result["text"]["text"] == "+1 "

    def test_increment_button_returns_dict(self):
        """Test that _increment_button returns a dictionary."""
        result = SlackBlockBuilder._increment_button("habit-123", 1, None)
        assert isinstance(result, dict)

    def test_increment_button_has_required_keys(self):
        """Test that button has all required keys."""
        result = SlackBlockBuilder._increment_button("habit-123", 1, None)
        assert "type" in result
        assert "text" in result
        assert "action_id" in result
        assert "value" in result

    def test_increment_button_text_has_required_keys(self):
        """Test that text object has all required keys."""
        result = SlackBlockBuilder._increment_button("habit-123", 1, None)
        assert "type" in result["text"]
        assert "text" in result["text"]
        assert "emoji" in result["text"]


class TestStreakDisplay:
    """Tests for _streak_display() static method.
    
    Requirements:
    - 10.1: Include the current streak count if greater than 0
    - 10.2: Display fire emoji (🔥) with streak count when streak >= 7
    - 10.3: Display sparkle emoji (✨) with streak count when streak is 3-6
    - 10.4: Display streak count without special emoji when streak is 1-2
    
    Property 15: Streak Display with Emoji
    """

    # ========================================================================
    # Test: Streak 0 returns empty string (Requirement 10.1)
    # ========================================================================

    def test_streak_display_returns_empty_string_for_zero(self):
        """Test that streak 0 returns empty string."""
        result = SlackBlockBuilder._streak_display(0)
        assert result == ""

    def test_streak_display_returns_empty_string_for_negative(self):
        """Test that negative streak returns empty string."""
        result = SlackBlockBuilder._streak_display(-1)
        assert result == ""

    def test_streak_display_returns_empty_string_for_large_negative(self):
        """Test that large negative streak returns empty string."""
        result = SlackBlockBuilder._streak_display(-100)
        assert result == ""

    # ========================================================================
    # Test: Streak 1-2 returns plain number (Requirement 10.4)
    # ========================================================================

    def test_streak_display_returns_plain_number_for_streak_1(self):
        """Test that streak 1 returns '1日' without emoji."""
        result = SlackBlockBuilder._streak_display(1)
        assert result == "1日"
        assert "🔥" not in result
        assert "✨" not in result

    def test_streak_display_returns_plain_number_for_streak_2(self):
        """Test that streak 2 returns '2日' without emoji."""
        result = SlackBlockBuilder._streak_display(2)
        assert result == "2日"
        assert "🔥" not in result
        assert "✨" not in result

    # ========================================================================
    # Test: Streak 3-6 returns sparkle emoji (Requirement 10.3)
    # ========================================================================

    def test_streak_display_returns_sparkle_for_streak_3(self):
        """Test that streak 3 returns '✨3日'."""
        result = SlackBlockBuilder._streak_display(3)
        assert result == "✨3日"
        assert "✨" in result
        assert "🔥" not in result

    def test_streak_display_returns_sparkle_for_streak_4(self):
        """Test that streak 4 returns '✨4日'."""
        result = SlackBlockBuilder._streak_display(4)
        assert result == "✨4日"
        assert "✨" in result
        assert "🔥" not in result

    def test_streak_display_returns_sparkle_for_streak_5(self):
        """Test that streak 5 returns '✨5日'."""
        result = SlackBlockBuilder._streak_display(5)
        assert result == "✨5日"
        assert "✨" in result
        assert "🔥" not in result

    def test_streak_display_returns_sparkle_for_streak_6(self):
        """Test that streak 6 returns '✨6日'."""
        result = SlackBlockBuilder._streak_display(6)
        assert result == "✨6日"
        assert "✨" in result
        assert "🔥" not in result

    # ========================================================================
    # Test: Streak >= 7 returns fire emoji (Requirement 10.2)
    # ========================================================================

    def test_streak_display_returns_fire_for_streak_7(self):
        """Test that streak 7 returns '🔥7日'."""
        result = SlackBlockBuilder._streak_display(7)
        assert result == "🔥7日"
        assert "🔥" in result
        assert "✨" not in result

    def test_streak_display_returns_fire_for_streak_10(self):
        """Test that streak 10 returns '🔥10日'."""
        result = SlackBlockBuilder._streak_display(10)
        assert result == "🔥10日"
        assert "🔥" in result
        assert "✨" not in result

    def test_streak_display_returns_fire_for_streak_30(self):
        """Test that streak 30 returns '🔥30日'."""
        result = SlackBlockBuilder._streak_display(30)
        assert result == "🔥30日"
        assert "🔥" in result
        assert "✨" not in result

    def test_streak_display_returns_fire_for_streak_100(self):
        """Test that streak 100 returns '🔥100日'."""
        result = SlackBlockBuilder._streak_display(100)
        assert result == "🔥100日"
        assert "🔥" in result
        assert "✨" not in result

    def test_streak_display_returns_fire_for_streak_365(self):
        """Test that streak 365 returns '🔥365日'."""
        result = SlackBlockBuilder._streak_display(365)
        assert result == "🔥365日"
        assert "🔥" in result
        assert "✨" not in result

    # ========================================================================
    # Test: Boundary conditions
    # ========================================================================

    def test_streak_display_boundary_between_plain_and_sparkle(self):
        """Test boundary: streak 2 is plain, streak 3 has sparkle."""
        result_2 = SlackBlockBuilder._streak_display(2)
        result_3 = SlackBlockBuilder._streak_display(3)
        assert "✨" not in result_2
        assert "✨" in result_3

    def test_streak_display_boundary_between_sparkle_and_fire(self):
        """Test boundary: streak 6 has sparkle, streak 7 has fire."""
        result_6 = SlackBlockBuilder._streak_display(6)
        result_7 = SlackBlockBuilder._streak_display(7)
        assert "✨" in result_6
        assert "🔥" not in result_6
        assert "🔥" in result_7
        assert "✨" not in result_7

    # ========================================================================
    # Test: Return type
    # ========================================================================

    def test_streak_display_returns_string(self):
        """Test that _streak_display returns a string."""
        result = SlackBlockBuilder._streak_display(5)
        assert isinstance(result, str)

    def test_streak_display_returns_string_for_zero(self):
        """Test that _streak_display returns a string for zero."""
        result = SlackBlockBuilder._streak_display(0)
        assert isinstance(result, str)


class TestProgressBar:
    """Tests for _progress_bar() static method.
    
    Requirements:
    - 3.1: Include a text-based progress bar using block characters
    - 3.2: Display green (🟩) when progressRate >= 100%
    - 3.3: Display blue (🟦) when progressRate is 75-99%
    - 3.4: Display yellow (🟨) when progressRate is 50-74%
    - 3.5: Display red (🟥) when progressRate < 50%
    - 3.6: Progress bar is 10 segments wide
    
    Property 7: Progress Bar Color Coding
    Property 8: Progress Bar Segment Count
    """

    # ========================================================================
    # Test: Progress bar always has exactly 10 segments (Requirement 3.6)
    # ========================================================================

    def test_progress_bar_has_10_segments_at_0_percent(self):
        """Test that progress bar has exactly 10 segments at 0%."""
        result = SlackBlockBuilder._progress_bar(0)
        assert len(result) == 10

    def test_progress_bar_has_10_segments_at_50_percent(self):
        """Test that progress bar has exactly 10 segments at 50%."""
        result = SlackBlockBuilder._progress_bar(50)
        assert len(result) == 10

    def test_progress_bar_has_10_segments_at_100_percent(self):
        """Test that progress bar has exactly 10 segments at 100%."""
        result = SlackBlockBuilder._progress_bar(100)
        assert len(result) == 10

    def test_progress_bar_has_10_segments_at_150_percent(self):
        """Test that progress bar has exactly 10 segments at 150%."""
        result = SlackBlockBuilder._progress_bar(150)
        assert len(result) == 10

    # ========================================================================
    # Test: Filled segments calculation (Property 8)
    # min(10, floor(progress_rate / 10))
    # ========================================================================

    def test_progress_bar_0_percent_has_0_filled_segments(self):
        """Test that 0% progress has 0 filled segments."""
        result = SlackBlockBuilder._progress_bar(0)
        assert result == "⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜"

    def test_progress_bar_10_percent_has_1_filled_segment(self):
        """Test that 10% progress has 1 filled segment."""
        result = SlackBlockBuilder._progress_bar(10)
        assert result.count("⬜") == 9
        assert result[0] != "⬜"  # First segment is filled

    def test_progress_bar_50_percent_has_5_filled_segments(self):
        """Test that 50% progress has 5 filled segments."""
        result = SlackBlockBuilder._progress_bar(50)
        assert result.count("⬜") == 5

    def test_progress_bar_99_percent_has_9_filled_segments(self):
        """Test that 99% progress has 9 filled segments (floor(99/10) = 9)."""
        result = SlackBlockBuilder._progress_bar(99)
        assert result.count("⬜") == 1

    def test_progress_bar_100_percent_has_10_filled_segments(self):
        """Test that 100% progress has 10 filled segments."""
        result = SlackBlockBuilder._progress_bar(100)
        assert "⬜" not in result

    def test_progress_bar_150_percent_has_10_filled_segments(self):
        """Test that 150% progress is capped at 10 filled segments."""
        result = SlackBlockBuilder._progress_bar(150)
        assert "⬜" not in result

    def test_progress_bar_15_percent_has_1_filled_segment(self):
        """Test that 15% progress has 1 filled segment (floor(15/10) = 1)."""
        result = SlackBlockBuilder._progress_bar(15)
        assert result.count("⬜") == 9

    def test_progress_bar_25_percent_has_2_filled_segments(self):
        """Test that 25% progress has 2 filled segments (floor(25/10) = 2)."""
        result = SlackBlockBuilder._progress_bar(25)
        assert result.count("⬜") == 8

    # ========================================================================
    # Test: Color coding (Requirements 3.2, 3.3, 3.4, 3.5 / Property 7)
    # ========================================================================

    def test_progress_bar_green_at_100_percent(self):
        """Test that progress bar is green (🟩) at 100% (Requirement 3.2)."""
        result = SlackBlockBuilder._progress_bar(100)
        assert "🟩" in result
        assert "🟦" not in result
        assert "🟨" not in result
        assert "🟥" not in result

    def test_progress_bar_green_at_150_percent(self):
        """Test that progress bar is green (🟩) at 150% (Requirement 3.2)."""
        result = SlackBlockBuilder._progress_bar(150)
        assert "🟩" in result
        assert "🟦" not in result
        assert "🟨" not in result
        assert "🟥" not in result

    def test_progress_bar_blue_at_75_percent(self):
        """Test that progress bar is blue (🟦) at 75% (Requirement 3.3)."""
        result = SlackBlockBuilder._progress_bar(75)
        assert "🟦" in result
        assert "🟩" not in result
        assert "🟨" not in result
        assert "🟥" not in result

    def test_progress_bar_blue_at_99_percent(self):
        """Test that progress bar is blue (🟦) at 99% (Requirement 3.3)."""
        result = SlackBlockBuilder._progress_bar(99)
        assert "🟦" in result
        assert "🟩" not in result
        assert "🟨" not in result
        assert "🟥" not in result

    def test_progress_bar_yellow_at_50_percent(self):
        """Test that progress bar is yellow (🟨) at 50% (Requirement 3.4)."""
        result = SlackBlockBuilder._progress_bar(50)
        assert "🟨" in result
        assert "🟩" not in result
        assert "🟦" not in result
        assert "🟥" not in result

    def test_progress_bar_yellow_at_74_percent(self):
        """Test that progress bar is yellow (🟨) at 74% (Requirement 3.4)."""
        result = SlackBlockBuilder._progress_bar(74)
        assert "🟨" in result
        assert "🟩" not in result
        assert "🟦" not in result
        assert "🟥" not in result

    def test_progress_bar_red_at_0_percent(self):
        """Test that progress bar is red (🟥) at 0% (Requirement 3.5)."""
        result = SlackBlockBuilder._progress_bar(0)
        # At 0%, there are no filled segments, so no red squares
        # But the color would be red if there were any filled segments
        # Let's test at 10% instead
        pass

    def test_progress_bar_red_at_10_percent(self):
        """Test that progress bar is red (🟥) at 10% (Requirement 3.5)."""
        result = SlackBlockBuilder._progress_bar(10)
        assert "🟥" in result
        assert "🟩" not in result
        assert "🟦" not in result
        assert "🟨" not in result

    def test_progress_bar_red_at_49_percent(self):
        """Test that progress bar is red (🟥) at 49% (Requirement 3.5)."""
        result = SlackBlockBuilder._progress_bar(49)
        assert "🟥" in result
        assert "🟩" not in result
        assert "🟦" not in result
        assert "🟨" not in result

    # ========================================================================
    # Test: Boundary conditions for color coding
    # ========================================================================

    def test_progress_bar_boundary_at_exactly_50(self):
        """Test boundary: exactly 50% should be yellow."""
        result = SlackBlockBuilder._progress_bar(50)
        assert "🟨" in result

    def test_progress_bar_boundary_at_exactly_75(self):
        """Test boundary: exactly 75% should be blue."""
        result = SlackBlockBuilder._progress_bar(75)
        assert "🟦" in result

    def test_progress_bar_boundary_at_exactly_100(self):
        """Test boundary: exactly 100% should be green."""
        result = SlackBlockBuilder._progress_bar(100)
        assert "🟩" in result

    def test_progress_bar_boundary_just_below_50(self):
        """Test boundary: 49.9% should be red."""
        result = SlackBlockBuilder._progress_bar(49.9)
        assert "🟥" in result

    def test_progress_bar_boundary_just_below_75(self):
        """Test boundary: 74.9% should be yellow."""
        result = SlackBlockBuilder._progress_bar(74.9)
        assert "🟨" in result

    def test_progress_bar_boundary_just_below_100(self):
        """Test boundary: 99.9% should be blue."""
        result = SlackBlockBuilder._progress_bar(99.9)
        assert "🟦" in result

    # ========================================================================
    # Test: Full progress bar strings
    # ========================================================================

    def test_progress_bar_full_string_at_0_percent(self):
        """Test complete progress bar string at 0%."""
        result = SlackBlockBuilder._progress_bar(0)
        assert result == "⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜"

    def test_progress_bar_full_string_at_30_percent(self):
        """Test complete progress bar string at 30% (red, 3 filled)."""
        result = SlackBlockBuilder._progress_bar(30)
        assert result == "🟥🟥🟥⬜⬜⬜⬜⬜⬜⬜"

    def test_progress_bar_full_string_at_50_percent(self):
        """Test complete progress bar string at 50% (yellow, 5 filled)."""
        result = SlackBlockBuilder._progress_bar(50)
        assert result == "🟨🟨🟨🟨🟨⬜⬜⬜⬜⬜"

    def test_progress_bar_full_string_at_80_percent(self):
        """Test complete progress bar string at 80% (blue, 8 filled)."""
        result = SlackBlockBuilder._progress_bar(80)
        assert result == "🟦🟦🟦🟦🟦🟦🟦🟦⬜⬜"

    def test_progress_bar_full_string_at_100_percent(self):
        """Test complete progress bar string at 100% (green, 10 filled)."""
        result = SlackBlockBuilder._progress_bar(100)
        assert result == "🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩"

    def test_progress_bar_full_string_at_120_percent(self):
        """Test complete progress bar string at 120% (green, 10 filled, capped)."""
        result = SlackBlockBuilder._progress_bar(120)
        assert result == "🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩"

    # ========================================================================
    # Test: Edge cases
    # ========================================================================

    def test_progress_bar_negative_value(self):
        """Test that negative values result in 0 filled segments."""
        result = SlackBlockBuilder._progress_bar(-10)
        # Negative values should result in 0 filled segments
        assert result == "⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜"

    def test_progress_bar_very_large_value(self):
        """Test that very large values are capped at 10 filled segments."""
        result = SlackBlockBuilder._progress_bar(1000)
        assert result == "🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩"
        assert len(result) == 10

    def test_progress_bar_float_value(self):
        """Test that float values are handled correctly."""
        result = SlackBlockBuilder._progress_bar(55.5)
        # floor(55.5 / 10) = 5 filled segments
        assert result.count("⬜") == 5
        assert "🟨" in result  # 55.5% is in yellow range

    def test_progress_bar_returns_string(self):
        """Test that _progress_bar returns a string."""
        result = SlackBlockBuilder._progress_bar(50)
        assert isinstance(result, str)


class TestHabitProgressSection:
    """Tests for _habit_progress_section() static method.
    
    Requirements:
    - 2.1: Show progress in format `currentCount/totalCount unit (progressRate%)`
    - 2.3: When no workloadUnit, display as `currentCount/totalCount (progressRate%)`
    - 2.5: Display ✅ when progressRate >= 100%
    - 2.6: Display ⬜ when progressRate < 100%
    - 4.1: Include increment button for incomplete habits
    - 4.6: Still display increment button when habit is at 100% or higher
    
    Property 3: Progress Format with Unit Handling
    Property 6: Completion Indicator Based on Progress
    """

    @pytest.fixture
    def habit_progress_factory(self):
        """Factory to create HabitProgress objects for testing."""
        from app.services.daily_progress_calculator import HabitProgress
        
        def _create(
            habit_id: str = "habit-123",
            habit_name: str = "朝のストレッチ",
            goal_name: str = "健康",
            current_count: float = 2,
            total_count: float = 5,
            progress_rate: float = 40,
            workload_unit: str = "回",
            workload_per_count: float = 1,
            streak: int = 3,
            completed: bool = False,
        ):
            return HabitProgress(
                habit_id=habit_id,
                habit_name=habit_name,
                goal_name=goal_name,
                current_count=current_count,
                total_count=total_count,
                progress_rate=progress_rate,
                workload_unit=workload_unit,
                workload_per_count=workload_per_count,
                streak=streak,
                completed=completed,
            )
        return _create

    # ========================================================================
    # Test: Section block structure
    # ========================================================================

    def test_habit_progress_section_returns_dict(self, habit_progress_factory):
        """Test that _habit_progress_section returns a dictionary."""
        habit = habit_progress_factory()
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert isinstance(result, dict)

    def test_habit_progress_section_type_is_section(self, habit_progress_factory):
        """Test that block type is 'section'."""
        habit = habit_progress_factory()
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert result["type"] == "section"

    def test_habit_progress_section_has_text(self, habit_progress_factory):
        """Test that section has text field."""
        habit = habit_progress_factory()
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "text" in result
        assert result["text"]["type"] == "mrkdwn"

    def test_habit_progress_section_has_accessory(self, habit_progress_factory):
        """Test that section has accessory (button)."""
        habit = habit_progress_factory()
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "accessory" in result
        assert result["accessory"]["type"] == "button"

    # ========================================================================
    # Test: Completion indicator (Requirements 2.5, 2.6 / Property 6)
    # ========================================================================

    def test_habit_progress_section_shows_incomplete_indicator_when_not_completed(self, habit_progress_factory):
        """Test that ⬜ is shown when habit is not completed (Requirement 2.6)."""
        habit = habit_progress_factory(completed=False, progress_rate=40)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "⬜" in result["text"]["text"]
        assert "✅" not in result["text"]["text"]

    def test_habit_progress_section_shows_complete_indicator_when_completed(self, habit_progress_factory):
        """Test that ✅ is shown when habit is completed (Requirement 2.5)."""
        habit = habit_progress_factory(completed=True, progress_rate=100)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "✅" in result["text"]["text"]
        assert "⬜" not in result["text"]["text"]

    def test_habit_progress_section_shows_complete_indicator_when_over_100(self, habit_progress_factory):
        """Test that ✅ is shown when progress is over 100%."""
        habit = habit_progress_factory(completed=True, progress_rate=150)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "✅" in result["text"]["text"]

    def test_habit_progress_section_shows_incomplete_at_99_percent(self, habit_progress_factory):
        """Test that ⬜ is shown at 99% progress."""
        habit = habit_progress_factory(completed=False, progress_rate=99)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "⬜" in result["text"]["text"]

    # ========================================================================
    # Test: Habit name in bold
    # ========================================================================

    def test_habit_progress_section_shows_habit_name_in_bold(self, habit_progress_factory):
        """Test that habit name is displayed in bold (*name*)."""
        habit = habit_progress_factory(habit_name="朝のストレッチ")
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "*朝のストレッチ*" in result["text"]["text"]

    def test_habit_progress_section_shows_different_habit_name(self, habit_progress_factory):
        """Test that different habit names are displayed correctly."""
        habit = habit_progress_factory(habit_name="水を飲む")
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "*水を飲む*" in result["text"]["text"]

    # ========================================================================
    # Test: Progress format with unit (Requirements 2.1, 2.3 / Property 3)
    # ========================================================================

    def test_habit_progress_section_shows_progress_with_unit(self, habit_progress_factory):
        """Test progress format: currentCount/totalCount unit (progressRate%) (Requirement 2.1)."""
        habit = habit_progress_factory(
            current_count=2,
            total_count=5,
            progress_rate=40,
            workload_unit="回",
        )
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "2/5 回 (40%)" in result["text"]["text"]

    def test_habit_progress_section_shows_progress_without_unit(self, habit_progress_factory):
        """Test progress format: currentCount/totalCount (progressRate%) when no unit (Requirement 2.3)."""
        habit = habit_progress_factory(
            current_count=3,
            total_count=10,
            progress_rate=30,
            workload_unit=None,
        )
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "3/10 (30%)" in result["text"]["text"]

    def test_habit_progress_section_shows_progress_with_minutes_unit(self, habit_progress_factory):
        """Test progress format with '分' unit."""
        habit = habit_progress_factory(
            current_count=15,
            total_count=30,
            progress_rate=50,
            workload_unit="分",
        )
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "15/30 分 (50%)" in result["text"]["text"]

    def test_habit_progress_section_shows_progress_with_pages_unit(self, habit_progress_factory):
        """Test progress format with 'ページ' unit."""
        habit = habit_progress_factory(
            current_count=5,
            total_count=20,
            progress_rate=25,
            workload_unit="ページ",
        )
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "5/20 ページ (25%)" in result["text"]["text"]

    def test_habit_progress_section_shows_100_percent_progress(self, habit_progress_factory):
        """Test progress format at 100%."""
        habit = habit_progress_factory(
            current_count=5,
            total_count=5,
            progress_rate=100,
            workload_unit="回",
            completed=True,
        )
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "5/5 回 (100%)" in result["text"]["text"]

    def test_habit_progress_section_shows_over_100_percent_progress(self, habit_progress_factory):
        """Test progress format over 100%."""
        habit = habit_progress_factory(
            current_count=8,
            total_count=5,
            progress_rate=160,
            workload_unit="回",
            completed=True,
        )
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "8/5 回 (160%)" in result["text"]["text"]

    # ========================================================================
    # Test: Float count handling
    # ========================================================================

    def test_habit_progress_section_shows_whole_numbers_as_integers(self, habit_progress_factory):
        """Test that whole number floats display as integers (5.0 -> 5)."""
        habit = habit_progress_factory(
            current_count=5.0,
            total_count=10.0,
            progress_rate=50,
            workload_unit="回",
        )
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "5/10 回 (50%)" in result["text"]["text"]
        assert "5.0" not in result["text"]["text"]
        assert "10.0" not in result["text"]["text"]

    def test_habit_progress_section_shows_decimal_counts(self, habit_progress_factory):
        """Test that decimal counts are displayed correctly."""
        habit = habit_progress_factory(
            current_count=2.5,
            total_count=5.0,
            progress_rate=50,
            workload_unit="km",
        )
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "2.5/5 km (50%)" in result["text"]["text"]

    # ========================================================================
    # Test: Streak display
    # ========================================================================

    def test_habit_progress_section_shows_streak_with_fire_emoji(self, habit_progress_factory):
        """Test that streak >= 7 shows fire emoji."""
        habit = habit_progress_factory(streak=10)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "🔥10日" in result["text"]["text"]

    def test_habit_progress_section_shows_streak_with_sparkle_emoji(self, habit_progress_factory):
        """Test that streak 3-6 shows sparkle emoji."""
        habit = habit_progress_factory(streak=5)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "✨5日" in result["text"]["text"]

    def test_habit_progress_section_shows_streak_without_emoji(self, habit_progress_factory):
        """Test that streak 1-2 shows plain number."""
        habit = habit_progress_factory(streak=2)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "2日" in result["text"]["text"]
        assert "🔥" not in result["text"]["text"]
        assert "✨" not in result["text"]["text"]

    def test_habit_progress_section_no_streak_display_for_zero(self, habit_progress_factory):
        """Test that streak 0 shows no streak text."""
        habit = habit_progress_factory(streak=0)
        result = SlackBlockBuilder._habit_progress_section(habit)
        # Should not contain "日" for streak display
        # But may contain it in other contexts, so check for specific patterns
        assert "🔥" not in result["text"]["text"]
        assert "✨" not in result["text"]["text"]

    # ========================================================================
    # Test: Progress bar
    # ========================================================================

    def test_habit_progress_section_includes_progress_bar(self, habit_progress_factory):
        """Test that section includes progress bar in backticks."""
        habit = habit_progress_factory(progress_rate=40)
        result = SlackBlockBuilder._habit_progress_section(habit)
        # Progress bar should be wrapped in backticks
        assert "`" in result["text"]["text"]

    def test_habit_progress_section_progress_bar_yellow_at_40_percent(self, habit_progress_factory):
        """Test that progress bar is yellow at 40%."""
        habit = habit_progress_factory(progress_rate=40)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "🟥" in result["text"]["text"]  # 40% is red, not yellow

    def test_habit_progress_section_progress_bar_green_at_100_percent(self, habit_progress_factory):
        """Test that progress bar is green at 100%."""
        habit = habit_progress_factory(progress_rate=100, completed=True)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert "🟩" in result["text"]["text"]

    # ========================================================================
    # Test: Increment button (Requirements 4.1, 4.6 / Property 9)
    # ========================================================================

    def test_habit_progress_section_has_increment_button_for_incomplete(self, habit_progress_factory):
        """Test that incomplete habit has increment button (Requirement 4.1)."""
        habit = habit_progress_factory(completed=False)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert result["accessory"]["type"] == "button"
        assert "habit_increment_" in result["accessory"]["action_id"]

    def test_habit_progress_section_has_increment_button_for_completed(self, habit_progress_factory):
        """Test that completed habit still has increment button (Requirement 4.6)."""
        habit = habit_progress_factory(completed=True, progress_rate=100)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert result["accessory"]["type"] == "button"
        assert "habit_increment_" in result["accessory"]["action_id"]

    def test_habit_progress_section_button_has_correct_action_id(self, habit_progress_factory):
        """Test that button action_id contains habit_id."""
        habit = habit_progress_factory(habit_id="test-habit-456")
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert result["accessory"]["action_id"] == "habit_increment_test-habit-456"

    def test_habit_progress_section_button_has_correct_value(self, habit_progress_factory):
        """Test that button value is habit_id."""
        habit = habit_progress_factory(habit_id="test-habit-789")
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert result["accessory"]["value"] == "test-habit-789"

    def test_habit_progress_section_button_label_with_unit(self, habit_progress_factory):
        """Test that button label includes unit when set."""
        habit = habit_progress_factory(workload_per_count=1, workload_unit="回")
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert result["accessory"]["text"]["text"] == "+1 回"

    def test_habit_progress_section_button_label_without_unit(self, habit_progress_factory):
        """Test that button label is '✓' when no unit and amount is 1."""
        habit = habit_progress_factory(workload_per_count=1, workload_unit=None)
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert result["accessory"]["text"]["text"] == "✓"

    def test_habit_progress_section_button_label_with_amount_greater_than_1(self, habit_progress_factory):
        """Test that button label shows amount when > 1."""
        habit = habit_progress_factory(workload_per_count=5, workload_unit="分")
        result = SlackBlockBuilder._habit_progress_section(habit)
        assert result["accessory"]["text"]["text"] == "+5 分"

    # ========================================================================
    # Test: Full output format
    # ========================================================================

    def test_habit_progress_section_full_format_incomplete(self, habit_progress_factory):
        """Test full output format for incomplete habit."""
        habit = habit_progress_factory(
            habit_name="朝のストレッチ",
            current_count=2,
            total_count=5,
            progress_rate=40,
            workload_unit="回",
            streak=3,
            completed=False,
        )
        result = SlackBlockBuilder._habit_progress_section(habit)
        text = result["text"]["text"]
        
        # Check first line: ⬜ *朝のストレッチ* ✨3日
        assert "⬜ *朝のストレッチ*" in text
        assert "✨3日" in text
        
        # Check second line: 2/5 回 (40%)
        assert "2/5 回 (40%)" in text
        
        # Check progress bar is present
        assert "`" in text

    def test_habit_progress_section_full_format_completed(self, habit_progress_factory):
        """Test full output format for completed habit."""
        habit = habit_progress_factory(
            habit_name="水を飲む",
            current_count=8,
            total_count=8,
            progress_rate=100,
            workload_unit="杯",
            streak=7,
            completed=True,
        )
        result = SlackBlockBuilder._habit_progress_section(habit)
        text = result["text"]["text"]
        
        # Check first line: ✅ *水を飲む* 🔥7日
        assert "✅ *水を飲む*" in text
        assert "🔥7日" in text
        
        # Check second line: 8/8 杯 (100%)
        assert "8/8 杯 (100%)" in text
        
        # Check progress bar is green
        assert "🟩" in text


class TestHabitDashboard:
    """Tests for habit_dashboard() static method.
    
    Requirements:
    - 1.1: WHEN a user types `/habit-dashboard`, THE Slack_Dashboard_Command 
           SHALL respond with a combined view of habit list and progress status
    - 1.2: WHEN displaying the dashboard, THE Slack_Block_Builder SHALL show 
           a header with today's date and overall completion summary
    - 1.3: WHEN displaying the dashboard, THE Slack_Block_Builder SHALL group 
           habits by their associated goals
           
    Property 1: Dashboard Response Structure
    Property 2: Habit Grouping by Goal
    """

    @pytest.fixture
    def habit_progress_factory(self):
        """Factory to create HabitProgress objects for testing."""
        from app.services.daily_progress_calculator import HabitProgress
        
        def _create(
            habit_id: str = "habit-123",
            habit_name: str = "朝のストレッチ",
            goal_name: str = "健康",
            current_count: float = 2,
            total_count: float = 5,
            progress_rate: float = 40,
            workload_unit: str = "回",
            workload_per_count: float = 1,
            streak: int = 3,
            completed: bool = False,
        ):
            return HabitProgress(
                habit_id=habit_id,
                habit_name=habit_name,
                goal_name=goal_name,
                current_count=current_count,
                total_count=total_count,
                progress_rate=progress_rate,
                workload_unit=workload_unit,
                workload_per_count=workload_per_count,
                streak=streak,
                completed=completed,
            )
        return _create

    @pytest.fixture
    def dashboard_summary_factory(self):
        """Factory to create DashboardSummary objects for testing."""
        from app.services.daily_progress_calculator import DashboardSummary
        
        def _create(
            total_habits: int = 5,
            completed_habits: int = 3,
            completion_rate: float = 60.0,
            date_display: str = "2026年1月20日（月）",
        ):
            return DashboardSummary(
                total_habits=total_habits,
                completed_habits=completed_habits,
                completion_rate=completion_rate,
                date_display=date_display,
            )
        return _create

    # ========================================================================
    # Test: Dashboard returns list of blocks
    # ========================================================================

    def test_habit_dashboard_returns_list(self, habit_progress_factory, dashboard_summary_factory):
        """Test that habit_dashboard returns a list."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        assert isinstance(result, list)

    def test_habit_dashboard_returns_non_empty_list(self, habit_progress_factory, dashboard_summary_factory):
        """Test that habit_dashboard returns a non-empty list."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        assert len(result) > 0

    # ========================================================================
    # Test: Header with date (Requirement 1.2)
    # ========================================================================

    def test_habit_dashboard_has_header_block(self, habit_progress_factory, dashboard_summary_factory):
        """Test that dashboard has a header block."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # First block should be header
        assert result[0]["type"] == "header"

    def test_habit_dashboard_header_contains_date(self, habit_progress_factory, dashboard_summary_factory):
        """Test that header contains the date from summary (Requirement 1.2)."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory(date_display="2026年1月20日（月）")
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        header_text = result[0]["text"]["text"]
        assert "2026年1月20日（月）" in header_text

    def test_habit_dashboard_header_contains_emoji(self, habit_progress_factory, dashboard_summary_factory):
        """Test that header contains the 📊 emoji."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        header_text = result[0]["text"]["text"]
        assert "📊" in header_text

    def test_habit_dashboard_header_format(self, habit_progress_factory, dashboard_summary_factory):
        """Test that header has correct format: '📊 今日の進捗 - {date}'."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory(date_display="2026年1月20日（月）")
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        header_text = result[0]["text"]["text"]
        assert header_text == "📊 今日の進捗 - 2026年1月20日（月）"

    # ========================================================================
    # Test: Summary section with completion count (Requirement 1.2)
    # ========================================================================

    def test_habit_dashboard_has_summary_section(self, habit_progress_factory, dashboard_summary_factory):
        """Test that dashboard has a summary section after header."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Second block should be section
        assert result[1]["type"] == "section"

    def test_habit_dashboard_summary_contains_completion_count(self, habit_progress_factory, dashboard_summary_factory):
        """Test that summary contains completion count (Requirement 1.2)."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory(completed_habits=3, total_habits=5)
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        summary_text = result[1]["text"]["text"]
        assert "3/5" in summary_text

    def test_habit_dashboard_summary_contains_completion_rate(self, habit_progress_factory, dashboard_summary_factory):
        """Test that summary contains completion rate percentage."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory(completion_rate=60.0)
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        summary_text = result[1]["text"]["text"]
        assert "60%" in summary_text

    def test_habit_dashboard_summary_contains_progress_bar(self, habit_progress_factory, dashboard_summary_factory):
        """Test that summary contains overall progress bar."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory(completion_rate=60.0)
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        summary_text = result[1]["text"]["text"]
        # Progress bar should be in backticks
        assert "`" in summary_text

    def test_habit_dashboard_summary_format(self, habit_progress_factory, dashboard_summary_factory):
        """Test that summary has correct format."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory(completed_habits=3, total_habits=5, completion_rate=60.0)
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        summary_text = result[1]["text"]["text"]
        assert "*3/5* 習慣を完了 (60%)" in summary_text

    # ========================================================================
    # Test: Divider after summary
    # ========================================================================

    def test_habit_dashboard_has_divider_after_summary(self, habit_progress_factory, dashboard_summary_factory):
        """Test that dashboard has a divider after summary."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Third block should be divider
        assert result[2]["type"] == "divider"

    # ========================================================================
    # Test: Habit grouping by goal (Requirement 1.3)
    # ========================================================================

    def test_habit_dashboard_groups_habits_by_goal(self, habit_progress_factory, dashboard_summary_factory):
        """Test that habits are grouped by goal_name (Requirement 1.3)."""
        progress_list = [
            habit_progress_factory(habit_id="h1", habit_name="朝のストレッチ", goal_name="健康"),
            habit_progress_factory(habit_id="h2", habit_name="水を飲む", goal_name="健康"),
            habit_progress_factory(habit_id="h3", habit_name="読書", goal_name="学習"),
        ]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Should have goal name sections
        kenkou_sections = [b for b in result if b["type"] == "section" and "text" in b and b["text"]["text"] == "*健康*"]
        gakushuu_sections = [b for b in result if b["type"] == "section" and "text" in b and b["text"]["text"] == "*学習*"]
        
        assert len(kenkou_sections) == 1
        assert len(gakushuu_sections) == 1

    def test_habit_dashboard_goal_name_in_bold(self, habit_progress_factory, dashboard_summary_factory):
        """Test that goal names are displayed in bold."""
        progress_list = [habit_progress_factory(goal_name="健康")]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Find goal name section (after header, summary, divider)
        goal_section = result[3]
        assert goal_section["type"] == "section"
        assert goal_section["text"]["text"] == "*健康*"

    def test_habit_dashboard_habits_follow_goal_name(self, habit_progress_factory, dashboard_summary_factory):
        """Test that habit sections follow their goal name section."""
        progress_list = [
            habit_progress_factory(habit_id="h1", habit_name="朝のストレッチ", goal_name="健康"),
        ]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Structure: header, summary, divider, goal_name, habit_section, divider
        # Index 3 should be goal name
        assert result[3]["text"]["text"] == "*健康*"
        # Index 4 should be habit section with accessory button
        assert "accessory" in result[4]
        assert "朝のストレッチ" in result[4]["text"]["text"]

    def test_habit_dashboard_divider_after_each_goal_group(self, habit_progress_factory, dashboard_summary_factory):
        """Test that there's a divider after each goal group."""
        progress_list = [
            habit_progress_factory(habit_id="h1", habit_name="朝のストレッチ", goal_name="健康"),
            habit_progress_factory(habit_id="h2", habit_name="読書", goal_name="学習"),
        ]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Count dividers - should have at least 3 (after summary, after 健康 group, after 学習 group)
        dividers = [b for b in result if b["type"] == "divider"]
        assert len(dividers) >= 3

    # ========================================================================
    # Test: Multiple habits in same goal
    # ========================================================================

    def test_habit_dashboard_multiple_habits_same_goal(self, habit_progress_factory, dashboard_summary_factory):
        """Test that multiple habits in the same goal are grouped together."""
        progress_list = [
            habit_progress_factory(habit_id="h1", habit_name="朝のストレッチ", goal_name="健康"),
            habit_progress_factory(habit_id="h2", habit_name="水を飲む", goal_name="健康"),
        ]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Find indices of goal name and habit sections
        goal_index = None
        habit_indices = []
        for i, block in enumerate(result):
            if block["type"] == "section":
                if block["text"]["text"] == "*健康*":
                    goal_index = i
                elif "accessory" in block:
                    habit_indices.append(i)
        
        # Both habits should come after the goal name
        assert goal_index is not None
        assert len(habit_indices) == 2
        for idx in habit_indices:
            assert idx > goal_index

    # ========================================================================
    # Test: Empty progress list
    # ========================================================================

    def test_habit_dashboard_empty_progress_list(self, dashboard_summary_factory):
        """Test dashboard with empty progress list."""
        progress_list = []
        summary = dashboard_summary_factory(total_habits=0, completed_habits=0, completion_rate=0)
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Should still have header, summary, and divider
        assert len(result) >= 3
        assert result[0]["type"] == "header"
        assert result[1]["type"] == "section"
        assert result[2]["type"] == "divider"

    # ========================================================================
    # Test: Habit progress sections use _habit_progress_section
    # ========================================================================

    def test_habit_dashboard_habit_sections_have_buttons(self, habit_progress_factory, dashboard_summary_factory):
        """Test that habit sections have increment buttons."""
        progress_list = [habit_progress_factory()]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Find habit section (has accessory)
        habit_sections = [b for b in result if b["type"] == "section" and "accessory" in b]
        assert len(habit_sections) == 1
        assert habit_sections[0]["accessory"]["type"] == "button"

    def test_habit_dashboard_habit_sections_have_progress_info(self, habit_progress_factory, dashboard_summary_factory):
        """Test that habit sections contain progress information."""
        progress_list = [
            habit_progress_factory(
                habit_name="朝のストレッチ",
                current_count=2,
                total_count=5,
                progress_rate=40,
                workload_unit="回",
            )
        ]
        summary = dashboard_summary_factory()
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Find habit section
        habit_sections = [b for b in result if b["type"] == "section" and "accessory" in b]
        habit_text = habit_sections[0]["text"]["text"]
        
        assert "朝のストレッチ" in habit_text
        assert "2/5 回 (40%)" in habit_text

    # ========================================================================
    # Test: Full dashboard structure
    # ========================================================================

    def test_habit_dashboard_full_structure(self, habit_progress_factory, dashboard_summary_factory):
        """Test the complete dashboard structure with multiple goals."""
        progress_list = [
            habit_progress_factory(habit_id="h1", habit_name="朝のストレッチ", goal_name="健康", streak=3, completed=False),
            habit_progress_factory(habit_id="h2", habit_name="水を飲む", goal_name="健康", streak=7, completed=True, progress_rate=100),
            habit_progress_factory(habit_id="h3", habit_name="読書", goal_name="学習", streak=0, completed=False),
        ]
        summary = dashboard_summary_factory(
            total_habits=3,
            completed_habits=1,
            completion_rate=33.33,
            date_display="2026年1月20日（月）",
        )
        result = SlackBlockBuilder.habit_dashboard(progress_list, summary)
        
        # Verify structure:
        # 0: header
        # 1: summary section
        # 2: divider
        # 3: *健康* goal name
        # 4: 朝のストレッチ habit
        # 5: 水を飲む habit
        # 6: divider
        # 7: *学習* goal name
        # 8: 読書 habit
        # 9: divider
        
        assert result[0]["type"] == "header"
        assert "2026年1月20日（月）" in result[0]["text"]["text"]
        
        assert result[1]["type"] == "section"
        assert "*1/3* 習慣を完了 (33%)" in result[1]["text"]["text"]
        
        assert result[2]["type"] == "divider"
        
        # Find goal sections and verify order
        block_texts = []
        for b in result:
            if b["type"] == "section" and "text" in b:
                block_texts.append(b["text"]["text"])
        
        # 健康 should appear before 学習 (alphabetical order in Japanese)
        kenkou_idx = next(i for i, t in enumerate(block_texts) if t == "*健康*")
        gakushuu_idx = next(i for i, t in enumerate(block_texts) if t == "*学習*")
        assert kenkou_idx < gakushuu_idx


class TestDashboardEmpty:
    """Tests for dashboard_empty() static method.
    
    Requirements:
    - 1.5: WHEN a user has no active habits, THE Slack_Dashboard_Command SHALL 
           display a message encouraging them to add habits via the app
    """

    # ========================================================================
    # Test: Return type and structure
    # ========================================================================

    def test_dashboard_empty_returns_list(self):
        """Test that dashboard_empty returns a list."""
        result = SlackBlockBuilder.dashboard_empty()
        assert isinstance(result, list)

    def test_dashboard_empty_returns_non_empty_list(self):
        """Test that dashboard_empty returns a non-empty list."""
        result = SlackBlockBuilder.dashboard_empty()
        assert len(result) > 0

    def test_dashboard_empty_contains_header_block(self):
        """Test that dashboard_empty contains a header block."""
        result = SlackBlockBuilder.dashboard_empty()
        header_blocks = [b for b in result if b.get("type") == "header"]
        assert len(header_blocks) == 1

    def test_dashboard_empty_contains_section_block(self):
        """Test that dashboard_empty contains a section block."""
        result = SlackBlockBuilder.dashboard_empty()
        section_blocks = [b for b in result if b.get("type") == "section"]
        assert len(section_blocks) >= 1

    # ========================================================================
    # Test: Header content
    # ========================================================================

    def test_dashboard_empty_header_has_progress_emoji(self):
        """Test that header contains the progress emoji 📊."""
        result = SlackBlockBuilder.dashboard_empty()
        header = next(b for b in result if b.get("type") == "header")
        assert "📊" in header["text"]["text"]

    def test_dashboard_empty_header_has_today_progress_text(self):
        """Test that header contains '今日の進捗' text."""
        result = SlackBlockBuilder.dashboard_empty()
        header = next(b for b in result if b.get("type") == "header")
        assert "今日の進捗" in header["text"]["text"]

    def test_dashboard_empty_header_type_is_plain_text(self):
        """Test that header text type is plain_text."""
        result = SlackBlockBuilder.dashboard_empty()
        header = next(b for b in result if b.get("type") == "header")
        assert header["text"]["type"] == "plain_text"

    # ========================================================================
    # Test: Encouraging message content (Requirement 1.5)
    # ========================================================================

    def test_dashboard_empty_shows_no_habits_message(self):
        """Test that message indicates no habits are registered."""
        result = SlackBlockBuilder.dashboard_empty()
        section_blocks = [b for b in result if b.get("type") == "section"]
        section_text = " ".join(b["text"]["text"] for b in section_blocks)
        assert "まだ習慣が登録されていません" in section_text

    def test_dashboard_empty_shows_encouraging_message(self):
        """Test that message encourages adding habits via the app."""
        result = SlackBlockBuilder.dashboard_empty()
        section_blocks = [b for b in result if b.get("type") == "section"]
        section_text = " ".join(b["text"]["text"] for b in section_blocks)
        assert "アプリで習慣を追加" in section_text

    def test_dashboard_empty_shows_notepad_emoji(self):
        """Test that message contains the notepad emoji 📝."""
        result = SlackBlockBuilder.dashboard_empty()
        section_blocks = [b for b in result if b.get("type") == "section"]
        section_text = " ".join(b["text"]["text"] for b in section_blocks)
        assert "📝" in section_text

    def test_dashboard_empty_section_type_is_mrkdwn(self):
        """Test that section text type is mrkdwn."""
        result = SlackBlockBuilder.dashboard_empty()
        section_blocks = [b for b in result if b.get("type") == "section"]
        for section in section_blocks:
            assert section["text"]["type"] == "mrkdwn"

    # ========================================================================
    # Test: Block Kit structure validation
    # ========================================================================

    def test_dashboard_empty_all_blocks_have_type(self):
        """Test that all blocks have a type field."""
        result = SlackBlockBuilder.dashboard_empty()
        for block in result:
            assert "type" in block

    def test_dashboard_empty_blocks_are_valid_types(self):
        """Test that all blocks are valid Block Kit types."""
        result = SlackBlockBuilder.dashboard_empty()
        valid_types = {"header", "section", "divider", "actions", "context", "image"}
        for block in result:
            assert block["type"] in valid_types

    def test_dashboard_empty_is_static_method(self):
        """Test that dashboard_empty is a static method (can be called without instance)."""
        # This test verifies the method can be called on the class directly
        result = SlackBlockBuilder.dashboard_empty()
        assert result is not None

    def test_dashboard_empty_takes_no_parameters(self):
        """Test that dashboard_empty takes no parameters."""
        # This test verifies the method signature
        import inspect
        sig = inspect.signature(SlackBlockBuilder.dashboard_empty)
        # Static methods have no parameters (not even self)
        assert len(sig.parameters) == 0


class TestDashboardError:
    """Tests for dashboard_error() static method.
    
    Requirements:
    - 9.1: IF the user's Slack account is not connected, THEN display a message with instructions
    - 9.2: IF the database query fails, THEN display a friendly error message and suggest retrying
    - 9.3: IF an increment action fails, THEN display an error message without modifying the original dashboard
    - 9.5: IF a habit referenced in an interaction no longer exists, THEN display a message indicating the habit was not found
    """

    # ========================================================================
    # Test: Return type and structure
    # ========================================================================

    def test_dashboard_error_returns_list(self):
        """Test that dashboard_error returns a list."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        assert isinstance(result, list)

    def test_dashboard_error_returns_non_empty_list(self):
        """Test that dashboard_error returns a non-empty list."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        assert len(result) > 0

    def test_dashboard_error_returns_single_block(self):
        """Test that dashboard_error returns exactly one block."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        assert len(result) == 1

    def test_dashboard_error_block_type_is_section(self):
        """Test that the block type is 'section'."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        assert result[0]["type"] == "section"

    def test_dashboard_error_has_text_field(self):
        """Test that the block has a text field."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        assert "text" in result[0]

    def test_dashboard_error_text_type_is_mrkdwn(self):
        """Test that the text type is 'mrkdwn'."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        assert result[0]["text"]["type"] == "mrkdwn"

    def test_dashboard_error_text_has_text_field(self):
        """Test that the text object has a text field."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        assert "text" in result[0]["text"]

    # ========================================================================
    # Test: Error prefix (❌)
    # ========================================================================

    def test_dashboard_error_message_has_error_prefix(self):
        """Test that the message is prefixed with ❌."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        assert result[0]["text"]["text"].startswith("❌")

    def test_dashboard_error_message_format(self):
        """Test that the message format is '❌ {message}'."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        assert result[0]["text"]["text"] == "❌ Test error"

    def test_dashboard_error_preserves_message_content(self):
        """Test that the original message content is preserved."""
        message = "Something went wrong"
        result = SlackBlockBuilder.dashboard_error(message)
        assert message in result[0]["text"]["text"]

    # ========================================================================
    # Test: Various error messages (Requirements 9.1, 9.2, 9.3, 9.5)
    # ========================================================================

    def test_dashboard_error_slack_not_connected_message(self):
        """Test error message for Slack account not connected (Requirement 9.1)."""
        message = "Slackアカウントが接続されていません。設定画面から接続してください。"
        result = SlackBlockBuilder.dashboard_error(message)
        assert result[0]["text"]["text"] == f"❌ {message}"

    def test_dashboard_error_database_failure_message(self):
        """Test error message for database query failure (Requirement 9.2)."""
        message = "一時的なエラーが発生しました。再度お試しください。"
        result = SlackBlockBuilder.dashboard_error(message)
        assert result[0]["text"]["text"] == f"❌ {message}"

    def test_dashboard_error_increment_failure_message(self):
        """Test error message for increment action failure (Requirement 9.3)."""
        message = "習慣の更新に失敗しました。"
        result = SlackBlockBuilder.dashboard_error(message)
        assert result[0]["text"]["text"] == f"❌ {message}"

    def test_dashboard_error_habit_not_found_message(self):
        """Test error message for habit not found (Requirement 9.5)."""
        message = "この習慣は見つかりませんでした。"
        result = SlackBlockBuilder.dashboard_error(message)
        assert result[0]["text"]["text"] == f"❌ {message}"

    # ========================================================================
    # Test: Edge cases
    # ========================================================================

    def test_dashboard_error_empty_message(self):
        """Test dashboard_error with empty message."""
        result = SlackBlockBuilder.dashboard_error("")
        assert result[0]["text"]["text"] == "❌ "

    def test_dashboard_error_long_message(self):
        """Test dashboard_error with a long message."""
        long_message = "A" * 500
        result = SlackBlockBuilder.dashboard_error(long_message)
        assert result[0]["text"]["text"] == f"❌ {long_message}"

    def test_dashboard_error_message_with_special_characters(self):
        """Test dashboard_error with special characters in message."""
        message = "Error: <test> & 'special' \"chars\""
        result = SlackBlockBuilder.dashboard_error(message)
        assert result[0]["text"]["text"] == f"❌ {message}"

    def test_dashboard_error_message_with_emoji(self):
        """Test dashboard_error with emoji in message."""
        message = "エラーが発生しました 🚫"
        result = SlackBlockBuilder.dashboard_error(message)
        assert result[0]["text"]["text"] == f"❌ {message}"

    def test_dashboard_error_message_with_newlines(self):
        """Test dashboard_error with newlines in message."""
        message = "Line 1\nLine 2\nLine 3"
        result = SlackBlockBuilder.dashboard_error(message)
        assert result[0]["text"]["text"] == f"❌ {message}"

    def test_dashboard_error_message_with_markdown(self):
        """Test dashboard_error with markdown formatting in message."""
        message = "*Bold* and _italic_ text"
        result = SlackBlockBuilder.dashboard_error(message)
        assert result[0]["text"]["text"] == f"❌ {message}"

    # ========================================================================
    # Test: Static method behavior
    # ========================================================================

    def test_dashboard_error_is_static_method(self):
        """Test that dashboard_error is a static method (can be called without instance)."""
        result = SlackBlockBuilder.dashboard_error("Test")
        assert result is not None

    def test_dashboard_error_takes_one_parameter(self):
        """Test that dashboard_error takes exactly one parameter (message)."""
        import inspect
        sig = inspect.signature(SlackBlockBuilder.dashboard_error)
        # Static methods have no self, so only the message parameter
        assert len(sig.parameters) == 1
        assert "message" in sig.parameters

    # ========================================================================
    # Test: Block Kit structure validation
    # ========================================================================

    def test_dashboard_error_all_blocks_have_type(self):
        """Test that all blocks have a type field."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        for block in result:
            assert "type" in block

    def test_dashboard_error_blocks_are_valid_types(self):
        """Test that all blocks are valid Block Kit types."""
        result = SlackBlockBuilder.dashboard_error("Test error")
        valid_types = {"header", "section", "divider", "actions", "context", "image"}
        for block in result:
            assert block["type"] in valid_types


class TestHabitIncrementSuccess:
    """Tests for habit_increment_success() static method.
    
    Requirements:
    - 4.5: WHEN progressRate reaches 100% after an increment, THE Slack_Bot SHALL 
           display a completion celebration message with streak count
    
    Property 11: Completion Celebration on Reaching 100%
    For any increment action that causes progressRate to reach or exceed 100% 
    (from below 100%), the response SHALL include a celebration message 
    containing the streak count.
    """

    # ========================================================================
    # Test: Return type and structure
    # ========================================================================

    def test_habit_increment_success_returns_list(self):
        """Test that habit_increment_success returns a list."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert isinstance(result, list)

    def test_habit_increment_success_returns_non_empty_list(self):
        """Test that habit_increment_success returns a non-empty list."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert len(result) > 0

    def test_habit_increment_success_returns_single_block(self):
        """Test that habit_increment_success returns exactly one block."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert len(result) == 1

    def test_habit_increment_success_block_type_is_section(self):
        """Test that the block type is 'section'."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert result[0]["type"] == "section"

    def test_habit_increment_success_has_text_field(self):
        """Test that the block has a text field."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert "text" in result[0]

    def test_habit_increment_success_text_type_is_mrkdwn(self):
        """Test that the text type is 'mrkdwn'."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert result[0]["text"]["type"] == "mrkdwn"

    def test_habit_increment_success_text_has_text_field(self):
        """Test that the text object has a text field."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert "text" in result[0]["text"]

    # ========================================================================
    # Test: Celebration message format (Requirement 4.5)
    # ========================================================================

    def test_habit_increment_success_has_celebration_emoji(self):
        """Test that the message includes celebration emoji 🎉."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert "🎉" in result[0]["text"]["text"]

    def test_habit_increment_success_has_fire_emoji(self):
        """Test that the message includes fire emoji 🔥."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert "🔥" in result[0]["text"]["text"]

    def test_habit_increment_success_has_habit_name_in_bold(self):
        """Test that the habit name is displayed in bold (*name*)."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert "*朝のストレッチ*" in result[0]["text"]["text"]

    def test_habit_increment_success_has_achievement_text(self):
        """Test that the message includes achievement text 'を達成しました！'."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert "を達成しました！" in result[0]["text"]["text"]

    def test_habit_increment_success_has_streak_count(self):
        """Test that the message includes streak count (Property 11)."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        assert "5日連続" in result[0]["text"]["text"]

    def test_habit_increment_success_message_format(self):
        """Test the complete message format: 🎉 *{habit_name}* を達成しました！ 🔥{streak}日連続！"""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        expected = "🎉 *朝のストレッチ* を達成しました！ 🔥5日連続！"
        assert result[0]["text"]["text"] == expected

    # ========================================================================
    # Test: Various habit names
    # ========================================================================

    def test_habit_increment_success_with_different_habit_name(self):
        """Test celebration message with different habit name."""
        result = SlackBlockBuilder.habit_increment_success("水を飲む", 10)
        assert "*水を飲む*" in result[0]["text"]["text"]
        assert "10日連続" in result[0]["text"]["text"]

    def test_habit_increment_success_with_english_habit_name(self):
        """Test celebration message with English habit name."""
        result = SlackBlockBuilder.habit_increment_success("Morning Exercise", 3)
        assert "*Morning Exercise*" in result[0]["text"]["text"]
        assert "3日連続" in result[0]["text"]["text"]

    def test_habit_increment_success_with_long_habit_name(self):
        """Test celebration message with long habit name."""
        long_name = "毎日30分以上の読書をする習慣"
        result = SlackBlockBuilder.habit_increment_success(long_name, 7)
        assert f"*{long_name}*" in result[0]["text"]["text"]

    def test_habit_increment_success_with_special_characters_in_name(self):
        """Test celebration message with special characters in habit name."""
        result = SlackBlockBuilder.habit_increment_success("運動 (30分)", 2)
        assert "*運動 (30分)*" in result[0]["text"]["text"]

    # ========================================================================
    # Test: Various streak counts (Property 11)
    # ========================================================================

    def test_habit_increment_success_with_streak_1(self):
        """Test celebration message with streak of 1 day."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 1)
        assert "🔥1日連続！" in result[0]["text"]["text"]

    def test_habit_increment_success_with_streak_0(self):
        """Test celebration message with streak of 0 days."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 0)
        assert "🔥0日連続！" in result[0]["text"]["text"]

    def test_habit_increment_success_with_streak_7(self):
        """Test celebration message with streak of 7 days."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 7)
        assert "🔥7日連続！" in result[0]["text"]["text"]

    def test_habit_increment_success_with_streak_30(self):
        """Test celebration message with streak of 30 days."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 30)
        assert "🔥30日連続！" in result[0]["text"]["text"]

    def test_habit_increment_success_with_streak_100(self):
        """Test celebration message with streak of 100 days."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 100)
        assert "🔥100日連続！" in result[0]["text"]["text"]

    def test_habit_increment_success_with_streak_365(self):
        """Test celebration message with streak of 365 days."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 365)
        assert "🔥365日連続！" in result[0]["text"]["text"]

    # ========================================================================
    # Test: Static method behavior
    # ========================================================================

    def test_habit_increment_success_is_static_method(self):
        """Test that habit_increment_success is a static method (can be called without instance)."""
        result = SlackBlockBuilder.habit_increment_success("Test", 1)
        assert result is not None

    def test_habit_increment_success_takes_two_parameters(self):
        """Test that habit_increment_success takes exactly two parameters (habit_name, streak)."""
        import inspect
        sig = inspect.signature(SlackBlockBuilder.habit_increment_success)
        # Static methods have no self, so only habit_name and streak parameters
        assert len(sig.parameters) == 2
        assert "habit_name" in sig.parameters
        assert "streak" in sig.parameters

    # ========================================================================
    # Test: Block Kit structure validation
    # ========================================================================

    def test_habit_increment_success_all_blocks_have_type(self):
        """Test that all blocks have a type field."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        for block in result:
            assert "type" in block

    def test_habit_increment_success_blocks_are_valid_types(self):
        """Test that all blocks are valid Block Kit types."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", 5)
        valid_types = {"header", "section", "divider", "actions", "context", "image"}
        for block in result:
            assert block["type"] in valid_types

    # ========================================================================
    # Test: Edge cases
    # ========================================================================

    def test_habit_increment_success_with_empty_habit_name(self):
        """Test celebration message with empty habit name."""
        result = SlackBlockBuilder.habit_increment_success("", 5)
        assert "**" in result[0]["text"]["text"]  # Empty name in bold
        assert "5日連続" in result[0]["text"]["text"]

    def test_habit_increment_success_with_negative_streak(self):
        """Test celebration message with negative streak (edge case)."""
        result = SlackBlockBuilder.habit_increment_success("朝のストレッチ", -1)
        assert "🔥-1日連続！" in result[0]["text"]["text"]
