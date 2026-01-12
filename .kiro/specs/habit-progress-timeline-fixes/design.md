# Design Document

## Overview

This design addresses critical synchronization and data visibility issues in the Habit Progress Timeline component. The solution focuses on unifying time coordinate systems, ensuring consistent progress calculations, and improving data visibility across all time ranges.

## Architecture

The fix involves modifications to three key areas:
1. **Time Coordinate Unification**: Standardize time calculations across actual and planned data series
2. **Progress Calculation Harmonization**: Ensure both series use identical baseline and denominator calculations  
3. **Data Filtering Enhancement**: Improve data retrieval and display logic for all time ranges

## Components and Interfaces

### Modified Components

**MultiEventChart Component** (`Widget.MultiEventChart.tsx`)
- Enhanced time domain calculation logic
- Unified progress percentage calculation
- Improved data series generation

**Statistics Section** (`Section.Statistics.tsx`)
- Updated event point building logic
- Enhanced time window management
- Improved data filtering for time ranges

### Key Functions to Modify

**`buildPlannedSeriesForHabit()`**
- Standardize time coordinate calculation
- Ensure consistent baseline from habit registration date
- Align with actual data time calculations

**`buildEventPoints()`**
- Improve time window filtering logic
- Ensure data visibility across all ranges
- Maintain consistent progress calculations

**`computeDomainTs()`**
- Unify domain calculation for both actual and planned series
- Handle edge cases for sparse data
- Ensure proper time range coverage

## Data Models

### Time Coordinate System
```typescript
interface TimeCoordinate {
  ts: number;           // Unix timestamp in milliseconds
  baselineTs: number;   // Habit registration timestamp
  windowStartTs: number; // Selected range start
  windowEndTs: number;   // Selected range end
}
```

### Progress Calculation Model
```typescript
interface ProgressCalculation {
  actualCumulative: number;    // Actual work completed
  plannedCumulative: number;   // Expected work at this time
  totalExpected: number;       // Total expected for full range
  progressRatio: number;       // 0-1 ratio for display
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Time Coordinate System Consistency
*For any* set of habits and time range, all actual and planned data series should use identical time coordinate calculations, ensuring that events at the same timestamp map to the same x-axis position regardless of data type or habit.
**Validates: Requirements 1.1, 1.2, 1.4**

### Property 2: Time Range Alignment Preservation  
*For any* time range change, the x-axis alignment between actual and planned series should remain consistent, with no coordinate drift or misalignment introduced by range modifications.
**Validates: Requirements 1.3**

### Property 3: Daily Progress Rate Aggregation
*For any* selected extended time range (7d/1mo/1y), the timeline should plot daily progress rates by aggregating all habit events within each day and calculating both actual and planned progress percentages for that day.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 4: Daily Cumulative Progress Display
*For any* day within the selected range, the displayed progress rate should represent cumulative progress up to that point in the range, ensuring proper trend visualization over time.
**Validates: Requirements 2.6**

### Property 5: Empty Day Handling
*For any* day with no actual habit events, the timeline should display 0% actual progress while maintaining the correct planned progress rate for that day.
**Validates: Requirements 2.5**

### Property 6: Progress Calculation Consistency
*For any* habit and time range, both actual and planned progress percentages should use the habit's registration date as baseline and identical denominators for calculation, ensuring comparable progress ratios.
**Validates: Requirements 3.1, 3.3**

### Property 7: Perfect Completion Definition
*For any* habit that has been completed exactly as scheduled from registration date through the selected range, the progress percentage should equal 100%.
**Validates: Requirements 3.2**

### Property 8: Active Period Adjustment
*For any* habit that has been active for less time than the selected range, progress calculations should be based on the actual active period rather than the full selected range.
**Validates: Requirements 3.4**

### Property 9: Visual Rendering Correctness
*For any* timeline with data, planned series should render as dashed lines with lower opacity, actual series as solid lines with higher opacity, and both should have appropriate visual markers for data points.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 10: Interactive Information Display
*For any* data point hover event, detailed information should be displayed for both actual and planned values at that specific time coordinate.
**Validates: Requirements 4.4**

## Error Handling

### Time Calculation Errors
- Handle invalid timestamps gracefully by filtering them out
- Provide fallback time coordinates when calculations fail
- Log warnings for time calculation inconsistencies

### Data Availability Issues  
- Display appropriate messages when no data exists in selected range
- Handle sparse data by maintaining existing points without interpolation
- Gracefully handle habits with missing registration dates

### Rendering Failures
- Fallback to basic line rendering if advanced SVG features fail
- Ensure chart remains functional even with partial rendering errors
- Maintain hover functionality even if visual styling fails

## Testing Strategy

### Unit Testing
- Test individual time calculation functions with edge cases
- Verify progress calculation formulas with known inputs
- Test data filtering logic with various time ranges
- Validate SVG rendering output with specific data sets

### Property-Based Testing
- Use property-based testing framework (fast-check for TypeScript)
- Generate random habit data, timestamps, and time ranges
- Run minimum 100 iterations per property test
- Each property test references its design document property
- Tag format: **Feature: habit-progress-timeline-fixes, Property {number}: {property_text}**

### Integration Testing
- Test complete timeline rendering with real habit data
- Verify interaction between Statistics section and MultiEventChart
- Test time range switching with persistent data
- Validate hover interactions across different data densities
