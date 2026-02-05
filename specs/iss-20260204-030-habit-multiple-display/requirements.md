# ISS-20260204-030: Habit Candidate Multiple Display Fix

## Overview
- **Purpose**: Fix the issue where multiple Habit candidates are not displayed correctly, and Habit-type buttons are not used in the habit addition flow
- **Status**: Implementation Complete (Pending Verification)
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect
- **Related Issue**: ISS-20260204-031 (Goal/Habit Type Candidate Button Fix)

## Problem Statement

When users go through the habit addition flow:
1. "I want to add a new habit" -> Category selection displayed
2. "Learning & Skills" selected -> Habit type selection displayed (using `show_choice_buttons`)
3. "Programming practice" selected -> Duration selection displayed (using `show_choice_buttons`)
4. "30 minutes" selected -> Time of day selection displayed (using `show_choice_buttons`)
5. "Morning" selected -> Confirmation message

**Root Cause Analysis**:
The AI is using `show_choice_buttons` tool repeatedly for each step instead of calling `suggest_habits` after the initial category selection. This results in:
1. Multiple single-choice steps instead of showing multiple habit candidates at once
2. Buttons not having the `type: 'habit'` attribute (they use default `type: 'reply'`)
3. Users cannot see all habit candidates at once

### Current Behavior (Bug)

```
User: "I want to add a new habit"
  |
  v
AI: show_category_selection(selectionType: "habit_category")
  |
  v
User selects: "Learning & Skills"
  |
  v
AI: show_choice_buttons(choices: [{label: "Programming"}, ...], type: NOT SPECIFIED)  <- BUG
  |
  v
User selects: "Programming"
  |
  v
AI: show_choice_buttons(choices: [{label: "30min"}, ...])  <- BUG: Continues with show_choice_buttons
  |
  v
... (more show_choice_buttons steps)
```

### Expected Behavior

```
User: "I want to add a new habit"
  |
  v
AI: show_category_selection(selectionType: "habit_category")
  |
  v
User selects: "Learning & Skills"
  |
  v
AI: suggest_habits(category: "learning", count: 3)  <- EXPECTED: Multiple habit suggestions
  |
  v
Returns: Multiple habit buttons with suggestionType: 'habit'
         + Follow-up actions (More specific, Easier, Harder, etc.)
```

## Requirements

### Functional Requirements

- [FR-001] After category selection in Habit addition context, AI MUST call `suggest_habits` tool
- [FR-002] `suggest_habits` tool MUST return multiple habit candidates (default: 3) in a single response
- [FR-003] Each habit candidate button MUST have `suggestionType: 'habit'` attribute
- [FR-004] Habit candidate buttons MUST be displayed using Habit-type styling (blue color theme)
- [FR-005] Follow-up action buttons (More specific, Easier, Harder, Show More) MUST be displayed with habit suggestions
- [FR-006] Clicking a habit button MUST open the Habit creation modal with pre-filled data
- [FR-007] When using `show_choice_buttons` for habit-related choices, the `type` attribute MUST be set to 'habit'

### Non-Functional Requirements

- [NFR-001] Fix must not break existing drilldown functionality for genuinely ambiguous queries
- [NFR-002] Fix must be backward compatible with existing API contracts
- [NFR-003] System prompt changes must be minimal and focused on the specific issue

## Technical Analysis

### Root Cause

The AI agent is not following the system prompt instruction after category selection. Instead of calling `suggest_habits`, it continues to use `show_choice_buttons` for granular single-choice steps.

The system prompt (lines 497-518 in vow-coach-agent.ts) clearly states:
```
After habit category selection:
-> suggest_habits(category: "...", count: 3) must be called
-> show_category_selection must NOT be called
```

However, the AI is interpreting the conversation differently and using `show_choice_buttons` for sub-category refinement.

### Relevant Files

| File | Role |
|------|------|
| `/backend/src/agents/mastra/vow-coach-agent.ts` | System prompt and tool orchestration (lines 220-519) |
| `/backend/src/agents/shared-tools/coach-tools.ts` | Tool implementations |
| `/frontend/app/dashboard/components/Section.MOC.tsx` | Button rendering and suggestion parsing |

### Data Flow (Current vs Expected)

**Current (Broken)**:
```
show_category_selection -> show_choice_buttons -> show_choice_buttons -> show_choice_buttons
                           (type: 'reply')       (type: 'reply')       (type: 'reply')
```

**Expected (Fixed)**:
```
show_category_selection -> suggest_habits -> HabitSuggestionResult with:
                                             - suggestions[]: Array with suggestionType: 'habit'
                                             - followUpActions[]: Array with refine options
```

## Acceptance Criteria

- [AC-001] When user starts habit addition flow and selects a category, multiple habit suggestions (3+) MUST appear in a single response
- [AC-002] Each habit suggestion button MUST have `suggestionType: 'habit'`
- [AC-003] Habit suggestion buttons MUST have Habit-colored styling (blue theme per SuggestionCard typeConfig)
- [AC-004] Follow-up actions ("More specific", "Easier", "Harder", "Show More") MUST appear below suggestions
- [AC-005] Clicking a habit suggestion MUST open HabitModal with name and description pre-filled
- [AC-006] The AI MUST NOT use `show_choice_buttons` for habit refinement steps after category selection

## Agent Coordination Notes

This fix requires:
1. **Backend**: Strengthen system prompt to explicitly forbid `show_choice_buttons` after category selection in habit flow
2. **Possibly Frontend**: No changes expected if backend correctly calls `suggest_habits`

The fix should reinforce the direct path (category -> suggest_habits) and explicitly prohibit the `show_choice_buttons` loop pattern.
