# Requirements Document

## Introduction

Habit編集画面からの保存やカレンダーのドラッグ&ドロップ操作を行った際に、HabitのTimingのDate/Start/Endが初期化される問題を修正する。この問題は、バックエンドのupdateHabit関数がtimingIndexパラメータを適切に処理していないことが原因である。

## Glossary

- **Habit_Modal**: Habit編集用のモーダルコンポーネント
- **Calendar_Widget**: カレンダー表示とドラッグ&ドロップ機能を提供するコンポーネント
- **Event_Handler**: カレンダーイベントの変更を処理するフック
- **Update_Habit_API**: Habitデータを更新するバックエンドAPI関数
- **Timing_Entry**: Habitの実行タイミングを定義するオブジェクト（type, date, start, end等を含む）
- **Timing_Index**: timings配列内の特定のTimingエントリを指すインデックス

## Requirements

### Requirement 1: Habit Modal Save Preservation

**User Story:** As a user, I want to edit a habit in the modal and save it, so that all timing information is preserved exactly as I configured it.

#### Acceptance Criteria

1. WHEN I edit a habit in the modal and click Save, THE system SHALL preserve all existing timing entries without modification
2. WHEN I modify timing fields in the modal, THE system SHALL only update the fields I actually changed
3. WHEN I save a habit with multiple timing entries, THE system SHALL maintain all timing entries in their original order
4. THE system SHALL not reset timing fields to default values during save operations

### Requirement 2: Calendar Drag and Drop Timing Update

**User Story:** As a user, I want to drag and drop habit events in the calendar, so that only the specific timing entry being moved is updated while preserving other timing data.

#### Acceptance Criteria

1. WHEN I drag a habit event to a new time slot, THE system SHALL update only the specific timing entry associated with that event
2. WHEN a timingIndex is provided in the update request, THE system SHALL update only the timing entry at that index
3. WHEN updating a specific timing entry, THE system SHALL preserve all other timing entries unchanged
4. WHEN no timingIndex is provided, THE system SHALL update the habit's legacy time fields while preserving timing arrays
5. THE system SHALL maintain the original timing entry structure (type, date, start, end) when updating specific fields

### Requirement 3: Backend API Timing Index Support

**User Story:** As a developer, I want the updateHabit API to properly handle timingIndex parameters, so that specific timing entries can be updated without affecting others.

#### Acceptance Criteria

1. WHEN the updateHabit API receives a timingIndex parameter, THE system SHALL update only the timing entry at that specific index
2. WHEN updating a specific timing entry, THE system SHALL merge the provided updates with the existing timing entry data
3. WHEN timingIndex is out of bounds, THE system SHALL handle the error gracefully and not corrupt the timing array
4. THE system SHALL preserve all timing entry fields that are not explicitly being updated
5. WHEN no timingIndex is provided, THE system SHALL fall back to the current behavior of updating the entire timings array

### Requirement 4: Data Consistency and Validation

**User Story:** As a user, I want my habit timing data to remain consistent and valid, so that my scheduling information is never lost or corrupted.

#### Acceptance Criteria

1. THE system SHALL validate timing entry updates to ensure data integrity
2. WHEN updating timing entries, THE system SHALL ensure date formats remain consistent
3. WHEN updating time fields, THE system SHALL validate that start times are before end times
4. THE system SHALL preserve timing entry IDs if they exist
5. THE system SHALL maintain backward compatibility with habits that don't use the timing array structure

### Requirement 5: Error Handling and Recovery

**User Story:** As a user, I want the system to handle errors gracefully during timing updates, so that my data is never lost due to update failures.

#### Acceptance Criteria

1. WHEN a timing update fails, THE system SHALL revert to the previous state
2. WHEN invalid timing data is provided, THE system SHALL return descriptive error messages
3. THE system SHALL log sufficient information for debugging timing update issues
4. WHEN network errors occur during updates, THE system SHALL retry the operation or provide clear feedback to the user
5. THE system SHALL validate timing data before applying updates to prevent data corruption