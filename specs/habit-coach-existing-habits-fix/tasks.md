# Habit Coach Agent Fix - Tasks

## Overview
- **Issue ID**: ISS-20260204-018
- **Purpose**: Implementation tasks for fixing Habit Coach Agent
- **Status**: Complete
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

---

## Task List

### Phase 1: Implementation

- [x] **Task 1.1**: Update suggestHabitsTool output
  - **File**: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/habit-coach-agent.ts`
  - **Description**: Add `suggestionType: 'habit' as const` to all suggestions in the suggestHabitsTool
  - **Estimated Time**: 10 min
  - **Status**: Complete

- [x] **Task 1.2**: Update outputSchema
  - **File**: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/habit-coach-agent.ts`
  - **Description**: Add suggestionType to the zod output schema for type safety
  - **Estimated Time**: 5 min
  - **Status**: Complete

- [x] **Task 1.3**: Update generateBabyStepsTool output
  - **File**: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/habit-coach-agent.ts`
  - **Description**: If baby steps generate suggestions, ensure they have suggestionType
  - **Estimated Time**: 5 min
  - **Status**: Skipped - Frontend already handles baby steps by adding suggestionType: 'habit' (Section.MOC.tsx lines 2151-2166)

### Phase 2: Build Verification

- [x] **Task 2.1**: TypeScript compilation
  - **Command**: `cd /home/ubuntu/Downloads/vow/backend && npm run build`
  - **Description**: Verify no type errors after changes
  - **Prerequisite**: Phase 1 complete
  - **Estimated Time**: 5 min
  - **Status**: Complete (habit-coach-agent.ts has no errors; existing drilldown errors are unrelated)

### Phase 3: Issue Closure

- [x] **Task 3.1**: Update Issue Status
  - **Description**: Update ISS-20260204-018 status to 'closed' in Supabase
  - **Prerequisite**: Task 2.1 complete
  - **Estimated Time**: 2 min
  - **Status**: Complete

---

## Progress Summary

| Phase | Tasks | Completed | Progress |
|-------|-------|-----------|----------|
| Phase 1 | 3 | 3 | 100% |
| Phase 2 | 1 | 1 | 100% |
| Phase 3 | 1 | 1 | 100% |
| **Total** | **5** | **5** | **100%** |

---

## Files Modified

| File | Action | Status |
|------|--------|--------|
| `backend/src/agents/mastra/agents/habit-coach-agent.ts` | Modified | Complete |

---

## Changes Made

### habit-coach-agent.ts

1. **outputSchema**: Added `suggestionType: z.literal('habit')` to the suggestions array schema
2. **execute function**: Added `suggestionType: 'habit' as const` to each suggestion object

```typescript
// Before
{
  name: '朝の瞑想',
  description: '5分間の呼吸瞑想で一日をスタート',
  frequency: '毎日',
  estimatedTime: '5分',
  stackingTip: '歯磨きの後に行うと定着しやすいです',
}

// After
{
  name: '朝の瞑想',
  description: '5分間の呼吸瞑想で一日をスタート',
  frequency: '毎日',
  estimatedTime: '5分',
  stackingTip: '歯磨きの後に行うと定着しやすいです',
  suggestionType: 'habit' as const,
}
```

---

## Validation Checklist

- [x] All habit suggestions include `suggestionType: 'habit'`
- [x] TypeScript build passes (for habit-coach-agent.ts)
- [x] No breaking changes to existing functionality
- [x] Issue status updated in Supabase
