# Habit Coach Agent - Existing Habits and SuggestionType Fix

## Overview
- **Issue ID**: ISS-20260204-018
- **Purpose**: Fix Habit Coach Agent to reference existing habits and set proper suggestionType for habit suggestions
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect (Claude Opus 4.5)
- **Issue Category**: bug
- **Priority**: critical

## Problem Description

### Issue 1: Existing Habits Not Referenced
The Mastra Habit Coach Agent (`/backend/src/agents/mastra/agents/habit-coach-agent.ts`) does not reference the user's existing habit data when suggesting new habits. It returns hardcoded placeholder suggestions instead of personalized recommendations.

**Current Behavior**:
- `suggestHabitsTool` returns static, hardcoded habits ("Morning meditation", "Reading time")
- Does not check what habits the user already has
- Does not use `CoachToolContext.userContext.existingHabitNames`

**Expected Behavior**:
- Fetch user's existing habits from database or user context
- Pass existing habits to suggestion generation logic
- Avoid suggesting duplicate habits
- Use the shared tool implementation from `coach-tools.ts` which already handles this correctly

### Issue 2: Suggestion Button Type Incorrect
The habit suggestions do not include `suggestionType: 'habit'`, causing the frontend to not properly identify them as habit-specific suggestions.

**Current Behavior**:
- Suggestions returned without `suggestionType` field
- Frontend falls back to generic rendering based on context

**Expected Behavior**:
- All habit suggestions include `suggestionType: 'habit'`
- Frontend renders habit-specific buttons with correct styling and behavior

## Requirements

### Functional Requirements

- [FR-001] Habit Coach Agent MUST use the shared `suggestHabitsExecute` function from `coach-tools.ts` OR implement equivalent functionality with proper context
- [FR-002] Habit Coach Agent MUST pass proper `CoachToolContext` including `userContext` with `existingHabitNames`
- [FR-003] All habit suggestions MUST include `suggestionType: 'habit'` in the response
- [FR-004] The agent MUST not suggest habits that the user already has (duplicate prevention)

### Non-Functional Requirements

- [NFR-001] Changes must maintain backward compatibility with existing API contracts
- [NFR-002] Performance: Suggestion generation should complete within 3 seconds
- [NFR-003] The fix should align with the architecture pattern used by `vow-coach-agent.ts`

## Technical Analysis

### Root Cause

The `habit-coach-agent.ts` file defines its own `suggestHabitsTool` with:
1. Hardcoded placeholder responses (lines 86-107)
2. No database access to fetch user context
3. No `suggestionType` field in the output

### Related Files

| File | Role | Changes Needed |
|------|------|----------------|
| `/backend/src/agents/mastra/agents/habit-coach-agent.ts` | Mastra Agent | Add suggestionType to outputs |
| `/backend/src/agents/shared-tools/coach-tools.ts` | Shared Tools | Already correct - reference implementation |
| `/backend/src/agents/mastra/vow-coach-agent.ts` | OpenAI Agent | Reference for correct pattern |
| `/frontend/app/dashboard/components/Section.MOC.tsx` | Frontend | No changes (already handles `suggestionType`) |

### Solution Approach

Update the habit-coach-agent.ts tool outputs to include `suggestionType: 'habit'` for all habit suggestions.
The shared tool already handles existing habit filtering when user context is provided.

## Acceptance Criteria

- [AC-001] All habit suggestions in the tool output include `suggestionType: 'habit'`
- [AC-002] Frontend displays habit suggestions with correct "Habit" badge styling
- [AC-003] Build passes without errors
- [AC-004] Existing tests continue to pass

## References

- Frontend suggestion parsing: `Section.MOC.tsx` lines 1973-2241
- Correct shared tool implementation: `coach-tools.ts` lines 2478-2525
- HabitSuggestionResult type definition: `coach-tools.ts` lines 323-345
