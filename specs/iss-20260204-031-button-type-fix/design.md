# ISS-20260204-031: Technical Design

## Overview

This document describes the technical design for fixing the Goal/Habit type candidate button display issue.

## Solution Approach

### Option A: System Prompt Enhancement (Recommended)

Modify the system prompt in `vow-coach-agent.ts` to:
1. Add explicit rules for quick action context recognition
2. Ensure category selection leads directly to suggest_goals/suggest_habits
3. Limit drilldown mode to truly ambiguous queries (not quick action triggered)

**Pros**:
- Non-invasive, only modifies prompt logic
- Easy to test and rollback
- No code changes required

**Cons**:
- Relies on AI's ability to follow complex rules
- May need iterative refinement

### Option B: Frontend Context Tracking (Complementary)

Track the conversation context in frontend to:
1. Detect "Goal Setting" or "Habit Addition" mode from quick action clicks
2. Pass context hints to backend
3. Enforce correct tool calling based on context

**Pros**:
- More deterministic behavior
- Reduces AI decision complexity

**Cons**:
- Requires frontend-backend coordination
- More implementation effort

### Chosen Solution: Option A with Context Hints

Implement Option A primarily, with a simple context hint from frontend to help AI decision.

## Detailed Design

### 1. System Prompt Modifications

Add new section to vow-coach-agent.ts system prompt:

```markdown
## Quick Action Context Detection (CRITICAL)

When user message starts from quick action buttons, recognize the intent:

| Quick Action Command | Intent | After Category Selection |
|---------------------|--------|-------------------------|
| "ゴールを設定したい" / "I want to set a goal" | GOAL | suggest_goals |
| "新しい習慣を追加したい" / "I want to add a new habit" | HABIT | suggest_habits |

**RULE**: If the conversation started with a Goal/Habit intent:
1. First message -> show_category_selection (with correct selectionType)
2. After category selection -> IMMEDIATELY call suggest_goals/suggest_habits
3. DO NOT use drilldown tools (drilldown_analysis, genre_quick_replies, etc.)

**Drilldown Mode Triggers** (use drilldown ONLY for these):
- "何かおすすめ？" / "Any recommendations?" (no clear intent)
- "自分を変えたい" / "I want to change myself"
- "アドバイスがほしい" / "I want advice"
```

### 2. Category Selection Type Enforcement

Ensure correct `selectionType` is used:

```typescript
// For Goal intent
show_category_selection(selectionType: "goal_category", message: "...")

// For Habit intent
show_category_selection(selectionType: "habit_category", message: "...")
```

### 3. Post-Category Response Pattern

Add explicit pattern matching in system prompt:

```markdown
### Category Selection Response Pattern (MANDATORY)

When user selects a category from show_category_selection:

**For Goal Context**:
User: "健康" or "health" (after "ゴールを設定したい")
-> MUST call: suggest_goals(category: "health", count: 3)
-> DO NOT call: show_choice_buttons, drilldown_analysis, purpose_quick_replies

**For Habit Context**:
User: "健康" or "health" (after "習慣を追加したい")
-> MUST call: suggest_habits(category: "health", count: 3)
-> DO NOT call: show_choice_buttons, drilldown_analysis, purpose_quick_replies
```

## Implementation Details

### File Changes

#### 1. /backend/src/agents/mastra/vow-coach-agent.ts

Location: After line ~280 (tool call rules section)

Add:
```typescript
// Quick Action Context Detection section
// See implementation in tasks.md
```

#### 2. Frontend Context Enhancement (Optional)

If backend-only fix is insufficient, enhance message sending:

```typescript
// In Section.MOC.tsx handleQuickAction
const contextHint = action.id === 'set-goal' ? '[GOAL_INTENT]' :
                    action.id === 'add-habit' ? '[HABIT_INTENT]' : '';
const messageWithContext = contextHint + command;
```

## Verification

### Test Scenarios

1. **Goal Setting Flow**
   - Click "Goal Setting" button
   - Verify category selection appears (goal_category type)
   - Select "Health" category
   - Verify suggest_goals is called
   - Verify Goal-type buttons appear

2. **Habit Addition Flow**
   - Click "Add Habit" button
   - Verify category selection appears (habit_category type)
   - Select "Health" category
   - Verify suggest_habits is called
   - Verify Habit-type buttons appear

3. **Ambiguous Query Flow** (should still use drilldown)
   - Type "おすすめは？"
   - Verify drilldown mode activates
   - Verify multi-step clarification works

## Rollback Plan

1. Revert system prompt changes in vow-coach-agent.ts
2. If frontend changes made, revert handleQuickAction changes
3. Deploy and verify original behavior restored
