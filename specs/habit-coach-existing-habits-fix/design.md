# Habit Coach Agent Fix - Technical Design

## Overview
- **Issue ID**: ISS-20260204-018
- **Purpose**: Technical design for fixing Habit Coach Agent
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Mastra Multi-Agent System                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Manager Agent   │  │ Habit Coach Agent│  │ Goal Planner Agent│  │
│  │  (router.ts)     │  │ (habit-coach-    │  │ (goal-planner-   │  │
│  │                  │  │  agent.ts)       │  │  agent.ts)       │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│           │                    │                    │               │
│           └────────────────────┴────────────────────┘               │
│                                │                                    │
│                    ┌───────────▼───────────┐                        │
│                    │   agents/index.ts     │                        │
│                    │   (exports all)       │                        │
│                    └───────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ Called from
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    routers/agents.ts                                │
│  POST /api/agents/multi-chat                                        │
│  - Receives user query                                              │
│  - Routes to appropriate agent(s)                                   │
│  - Returns aggregated response                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Problem Analysis

### habit-coach-agent.ts Current Implementation (Lines 69-107)

```typescript
const suggestHabitsTool = createTool({
  id: 'suggest_habits',
  // ...
  execute: async (inputData) => {
    const count = inputData.count ?? 3;

    return {
      suggestions: [
        {
          name: '朝の瞑想',
          description: '5分間の呼吸瞑想で一日をスタート',
          frequency: '毎日',
          estimatedTime: '5分',
          stackingTip: '歯磨きの後に行うと定着しやすいです',
          // ❌ Missing: suggestionType: 'habit'
        },
        // ... more hardcoded suggestions
      ].slice(0, count),
    };
  },
});
```

### Issues:
1. **Hardcoded suggestions** - Always returns same habits
2. **Missing `suggestionType`** - Frontend cannot identify button type
3. **No user context** - Doesn't check existing habits

---

## Solution Design

### Option A: Add suggestionType to Existing Implementation (Minimal Change)

Add `suggestionType: 'habit' as const` to each suggestion in the output.

**Pros:**
- Minimal code change
- Low risk

**Cons:**
- Doesn't fix the hardcoded suggestions issue
- Doesn't address duplicate prevention

### Option B: Delegate to Shared Tools (Recommended for Full Fix)

Refactor to use `suggestHabitsExecute` from `coach-tools.ts`.

**Pros:**
- Full feature parity with vow-coach-agent
- Automatic duplicate prevention
- AI-generated suggestions

**Cons:**
- More extensive changes
- Requires passing proper context

### Selected Approach: Option A (Immediate Fix)

For this issue, we will implement Option A to fix the immediate bug (missing suggestionType).
The hardcoded suggestions issue is a separate concern that can be addressed in a follow-up task.

---

## Implementation Details

### Changes to habit-coach-agent.ts

#### 1. Update suggestHabitsTool output schema

```typescript
outputSchema: z.object({
  suggestions: z.array(z.object({
    name: z.string(),
    description: z.string(),
    frequency: z.string(),
    estimatedTime: z.string(),
    stackingTip: z.string().optional(),
    suggestionType: z.literal('habit'),  // ADD THIS
  })),
}),
```

#### 2. Update execute function return values

```typescript
return {
  suggestions: [
    {
      name: '朝の瞑想',
      description: '5分間の呼吸瞑想で一日をスタート',
      frequency: '毎日',
      estimatedTime: '5分',
      stackingTip: '歯磨きの後に行うと定着しやすいです',
      suggestionType: 'habit' as const,  // ADD THIS
    },
    // ... same for all other suggestions
  ].slice(0, count),
};
```

#### 3. Update analyzeHabitsTool (for consistency)

If it returns any suggestions, ensure they also have `suggestionType`.

---

## Frontend Compatibility

The frontend (`Section.MOC.tsx`) already handles `suggestionType`:

```typescript
// Line 2117-2118
const suggestionType = (suggestion.suggestionType as SuggestionButtonType)
  || (isGoal ? 'goal' : 'habit');
```

With our fix:
- If `suggestionType: 'habit'` is present, it will be used directly
- The fallback logic will no longer be needed for habit suggestions

---

## Type Definitions

### HabitSuggestionResult (from coach-tools.ts)

```typescript
export interface HabitSuggestionResult {
  suggestions: {
    name: string;
    description: string;
    category: string;
    difficulty: LevelTier;
    frequency: 'daily' | 'weekly' | '3x/week';
    estimatedTime: string;
    estimatedDuration: string;
    rationale: string;
    suggestionType: 'goal' | 'habit' | 'stickyn' | 'reply';  // ← THIS
  }[];
  followUpActions?: { ... }[];
}
```

The `habit-coach-agent.ts` should align with this interface.

---

## Testing Strategy

### Manual Testing

1. Start the backend server
2. Make a request to `/api/agents/multi-chat` with a habit suggestion query
3. Verify response includes `suggestionType: 'habit'` for each suggestion
4. Verify frontend renders suggestions with "Habit" badge

### Automated Testing

Build verification only for this minimal fix.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Type mismatch | Low | Medium | Verify with TypeScript build |
| Frontend regression | Low | Low | Frontend already handles this type |
| API contract break | Low | Medium | Only adding new field, not removing |

---

## Rollback Plan

If issues arise, revert the single file change to `habit-coach-agent.ts`.
