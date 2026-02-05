# ISS-20260204-031: Goal/Habit Type Candidate Button Fix

## Overview
- **Purpose**: Fix the issue where Goal/Habit type candidate buttons are not displayed correctly
- **Status**: Implemented
- **Version**: 1.1.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Problem Statement

When users explicitly request Goal setting or Habit addition via quick action buttons or direct messages, the system displays category-type buttons (from `show_category_selection` or `show_choice_buttons`) instead of the expected Goal-type or Habit-type suggestion buttons (from `suggest_goals` or `suggest_habits`).

### Current Behavior (Bug)

1. User clicks "Goal Setting" quick action -> sends "I want to set a goal"
2. AI calls `show_category_selection` or `drilldown_analysis` -> category buttons displayed
3. User selects category (e.g., "Health")
4. **BUG**: AI calls `show_choice_buttons` or more drilldown tools
5. Only category-type buttons are displayed (no Goal/Habit type buttons)

### Expected Behavior

1. User clicks "Goal Setting" quick action -> sends "I want to set a goal"
2. AI calls `show_category_selection(selectionType: "goal_category")` -> category buttons displayed
3. User selects category (e.g., "Health")
4. **EXPECTED**: AI calls `suggest_goals(category: "health")` or `suggest_habits(category: "health")`
5. Goal-type or Habit-type suggestion buttons are displayed

## Requirements

### Functional Requirements

- [FR-001] After category selection in Goal setting context, AI MUST call `suggest_goals` tool
- [FR-002] After category selection in Habit addition context, AI MUST call `suggest_habits` tool
- [FR-003] Drilldown mode should NOT override the direct path to suggest_goals/suggest_habits after category selection
- [FR-004] The `suggestionType` field from tool output MUST be preserved and passed to frontend
- [FR-005] Frontend must display buttons with correct styling based on `suggestionType`:
  - `goal` type -> Goal-colored button
  - `habit` type -> Habit-colored button
  - `category` type -> Category-colored button

### Non-Functional Requirements

- [NFR-001] Fix must not break existing drilldown functionality for genuinely ambiguous queries
- [NFR-002] Fix must be backward compatible with existing API contracts

## Technical Analysis

### Root Cause

The system has competing logic paths:

1. **Category Selection Path** (Line 276-280 in vow-coach-agent.ts):
   - Category specified -> `suggest_goals` / `suggest_habits`
   - Category not specified -> `show_category_selection`

2. **Drilldown Path** (Line 491-509 in vow-coach-agent.ts):
   - Ambiguous query -> `drilldown_analysis` -> `genre_quick_replies` -> `purpose_quick_replies` -> `response_type_quick_replies`
   - All drilldown tools return category-type buttons

The problem occurs when:
- Quick action commands ("I want to set a goal") trigger the drilldown path
- Even after category selection, the drilldown continues instead of switching to suggest_goals/suggest_habits

### Relevant Files

| File | Role |
|------|------|
| `/backend/src/agents/mastra/vow-coach-agent.ts` | System prompt and tool orchestration |
| `/backend/src/agents/shared-tools/coach-tools.ts` | Tool implementations |
| `/frontend/app/dashboard/components/Section.MOC.tsx` | Button rendering logic |

### Data Flow

```
User Message
    |
    v
vow-coach-agent.ts (AI decision)
    |
    +-- drilldown_analysis (if ambiguous)
    |       |
    |       v
    |   genre_quick_replies -> category buttons
    |       |
    |       v
    |   purpose_quick_replies -> category buttons
    |       |
    |       v
    |   response_type_quick_replies -> category buttons
    |
    +-- suggest_goals / suggest_habits (if category known)
            |
            v
        Goal/Habit type buttons with suggestionType: 'goal' / 'habit'
```

## Acceptance Criteria

- [AC-001] When user clicks "Goal Setting" and selects a category, Goal-type suggestion buttons MUST appear
- [AC-002] When user clicks "Add Habit" and selects a category, Habit-type suggestion buttons MUST appear
- [AC-003] Each suggestion button MUST have correct `suggestionType` ('goal' or 'habit')
- [AC-004] The button color/style MUST reflect the suggestion type
- [AC-005] Follow-up actions ("More specific", "Easier", "Harder") MUST appear with suggestions

## Agent Coordination Notes

This fix requires coordination between:
- Backend system prompt modification
- Possibly frontend parsing logic adjustment

The fix should prioritize the direct path (category -> suggest_*) over the drilldown path when the user's intent (Goal or Habit) is already clear.

---

## Implementation Summary (2026-02-04)

### Changes Made

#### 1. Backend: System Prompt Enhancement
**File**: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`
**Lines**: 347-389

Added "Quick Action Context Detection" section with:
- Intent recognition rules for "Goal Setting" and "Habit Addition" quick actions
- Explicit prohibition of drilldown tools when Goal/Habit intent is clear
- Mandatory `suggest_goals`/`suggest_habits` call after category selection
- Clear `selectionType` guidance (`goal_category` vs `habit_category`)

#### 2. Backend: Tool Output Enhancement
**File**: `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts`
**Lines**: 1315, 1338, 2300, 2328, 2475

All suggestion tools now correctly set `suggestionType`:
- `suggest_goals` -> `suggestionType: 'goal'`
- `suggest_habits` -> `suggestionType: 'habit'`

#### 3. Frontend: SuggestionType Parsing
**File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
**Lines**: 2247-2373

Frontend correctly parses `suggestionType` from tool outputs:
- Extracts `suggestionType` from each suggestion in the array
- Falls back to tool-based inference (`suggest_goals` -> 'goal', etc.)
- Applies correct styling based on `suggestionType`

### Verification Results

- TypeScript compilation: Backend OK, Frontend OK
- System prompt rules: Implemented at lines 347-389
- Tool outputs: `suggestionType` field present in all suggestion results
- Frontend parsing: `suggestionType` correctly extracted and used for styling

### Remaining Work

- Manual E2E testing to verify user flows work as expected
