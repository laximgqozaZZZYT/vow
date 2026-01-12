# Requirements Document

## Introduction

This specification addresses critical issues in the Habit Progress Timeline (Actual vs Planned) feature within the Statistics section. The timeline is a KPI visualization that shows habit progress over time, comparing actual performance against planned targets with time on the x-axis and progress percentage on the y-axis.

## Glossary

- **Habit_Progress_Timeline**: The chart component that displays actual vs planned habit progress over time
- **Progress_Percentage**: A value from 0-100% representing completion rate, where 100% means the habit was completed as scheduled for the selected time range
- **X_Axis_Alignment**: The synchronization of time coordinates between actual and planned data series
- **Time_Range**: The selected viewing window (7d/1mo/1y/auto/24h) for displaying habit data
- **Actual_Data**: Real habit completion events recorded by users
- **Planned_Data**: Expected habit completion schedule based on habit timing configuration
- **Registration_Date**: The date when a habit was first created in the system

## Requirements

### Requirement 1: X-Axis Time Alignment

**User Story:** As a user viewing the habit progress timeline, I want the actual and planned data to be properly aligned on the x-axis, so that I can accurately compare my performance against the schedule at any given time.

#### Acceptance Criteria

1. WHEN displaying actual and planned data series, THE Habit_Progress_Timeline SHALL use identical time calculation methods for both series
2. WHEN a habit event occurs at a specific timestamp, THE Habit_Progress_Timeline SHALL plot both actual and planned data points using the same time coordinate system
3. WHEN the time range is changed, THE Habit_Progress_Timeline SHALL maintain consistent x-axis alignment between actual and planned series
4. WHEN multiple habits are displayed, THE Habit_Progress_Timeline SHALL ensure all actual and planned series share the same time coordinate system

### Requirement 2: Daily Progress Rate Display for Extended Time Ranges

**User Story:** As a user, I want to see daily progress rates (both actual and planned) when selecting 7d/1mo/1y time ranges, so that I can analyze my daily habit performance trends over longer periods.

#### Acceptance Criteria

1. WHEN the 7d time range is selected, THE Habit_Progress_Timeline SHALL plot daily progress rates for both actual and planned data for each of the past 7 days
2. WHEN the 1mo time range is selected, THE Habit_Progress_Timeline SHALL plot daily progress rates for both actual and planned data for each of the past 30 days
3. WHEN the 1y time range is selected, THE Habit_Progress_Timeline SHALL plot daily progress rates for both actual and planned data for each of the past 365 days
4. WHEN calculating daily progress rates, THE Habit_Progress_Timeline SHALL aggregate all habit events within each day and calculate the progress percentage for that day
5. WHEN no actual data exists for a specific day, THE Habit_Progress_Timeline SHALL plot 0% actual progress while maintaining the planned progress rate for that day
6. WHEN displaying daily rates, THE Habit_Progress_Timeline SHALL ensure each day shows cumulative progress up to that point in the selected range

### Requirement 3: Progress Percentage Calculation Consistency

**User Story:** As a user, I want the progress percentage to be calculated consistently, so that 100% always represents completing the habit as scheduled for the selected time range from the registration date.

#### Acceptance Criteria

1. WHEN calculating progress percentage, THE Habit_Progress_Timeline SHALL use the habit's Registration_Date as the baseline start point
2. WHEN a habit is viewed in any Time_Range, THE Habit_Progress_Timeline SHALL calculate 100% as the expected completion if the habit was followed perfectly from Registration_Date through the selected range
3. WHEN displaying progress, THE Habit_Progress_Timeline SHALL ensure actual and planned percentages use the same denominator for calculation
4. WHEN a habit has been active for less time than the selected range, THE Habit_Progress_Timeline SHALL calculate percentages based on the actual active period

### Requirement 4: Data Series Rendering

**User Story:** As a user, I want both actual and planned data series to be clearly visible and distinguishable, so that I can easily compare my performance against expectations.

#### Acceptance Criteria

1. WHEN rendering the timeline, THE Habit_Progress_Timeline SHALL display planned data as dashed lines with lower opacity
2. WHEN rendering the timeline, THE Habit_Progress_Timeline SHALL display actual data as solid lines with higher opacity
3. WHEN data points exist, THE Habit_Progress_Timeline SHALL render both actual and planned points with appropriate visual markers
4. WHEN hovering over data points, THE Habit_Progress_Timeline SHALL display detailed information for both actual and planned values at that time