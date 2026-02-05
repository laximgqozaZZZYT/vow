# Intent Misdetection Fix - Design

## Overview
- **Purpose**: ゴールタイプ選択時のインテント誤判定問題の技術的な修正設計
- **Status**: Implementation Complete
- **Version**: 1.0.0
- **Issue ID**: ISS-20260204-020
- **Last Updated**: 2026-02-04
- **Resolved At**: 2026-02-04T21:10:00Z
- **Author**: vow-spec-architect

## Technical Analysis

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Section.MOC.tsx)                   │
│                                                                  │
│  [User clicks button from show_choice_buttons]                   │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────┐            │
│  │ handleQuickReplyClick(value, label)             │            │
│  │   - Find lastMessageWithQuickReplies            │            │
│  │   - Get selectionType (often undefined)         │            │
│  │   - Send "${label}の習慣を提案して" (default)   │            │
│  └──────────────────────┬──────────────────────────┘            │
│                         │                                        │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (vow-coach-agent.ts)                 │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐            │
│  │ getFallbackResponse(isJa, userMessage, ...)     │            │
│  │   │                                             │            │
│  │   ▼                                             │            │
│  │ detectIntent("達成ゴール...")                    │            │
│  │   │                                             │            │
│  │   +-- includes("達成") → return 'progress' ❌   │            │
│  │                                                  │            │
│  └──────────────────────┬──────────────────────────┘            │
│                         │                                        │
│                         ▼                                        │
│  switch(intent) {                                                │
│    case 'progress': → "進捗を確認しましょう！" ❌                │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Root Cause Identification

**Problem 1: Frontend - Incorrect Message Construction**

Location: `frontend/app/dashboard/components/Section.MOC.tsx` Line 1056-1071

```typescript
// Current code
if (selectionType === 'goal_category') {
  categoryMessage = locale === 'ja'
    ? `${label}の目標を提案して`
    : `Suggest ${label} goals`;
} else {
  // DEFAULT: Assumes habit category
  categoryMessage = locale === 'ja'
    ? `${label}の習慣を提案して`
    : `Suggest ${label} habits`;
}
```

When `selectionType` is undefined (as with show_choice_buttons), the frontend defaults to sending a habit suggestion request, which includes the label text directly.

**Problem 2: Backend - Naive Keyword Matching**

Location: `backend/src/agents/mastra/vow-coach-agent.ts` Line 2194

```typescript
// Current code
if (lowerMsg.includes('進捗') || lowerMsg.includes('状況') ||
    lowerMsg.includes('どのくらい') || lowerMsg.includes('達成')) {
  return 'progress';
}
```

The keyword "達成" appears in both:
- Progress context: 「達成率」「達成状況」「達成できた」
- Goal type context: 「達成ゴール」「達成目標」

The current logic cannot distinguish between these contexts.

## Design Solution

### Solution 1: Add Exclusion Patterns to detectIntent (Recommended)

Modify the detectIntent function to exclude goal-type keywords from progress detection.

**New Logic:**

```typescript
const detectIntent = (msg: string): IntentType => {
  if (!msg) return 'welcome';
  const lowerMsg = msg.toLowerCase();

  // Goal type selection patterns (higher priority)
  const goalTypePatterns = [
    '達成ゴール', '習慣ゴール', '継続ゴール', 'ゴールのタイプ',
    '達成目標', '習慣目標', '目標タイプ', 'タイプ.*ゴール'
  ];
  const isGoalTypeSelection = goalTypePatterns.some(pattern =>
    lowerMsg.includes(pattern.toLowerCase())
  );

  if (isGoalTypeSelection) {
    return 'goal_add';  // Treat as goal addition context
  }

  // Progress detection with exclusions
  const progressKeywords = ['進捗', '状況', 'どのくらい'];
  // Only match "達成" when NOT followed by "ゴール" or "目標"
  const hasProgressKeyword = progressKeywords.some(k => lowerMsg.includes(k));
  const hasAchievementProgress = lowerMsg.includes('達成') &&
    !lowerMsg.includes('達成ゴール') &&
    !lowerMsg.includes('達成目標');

  if (hasProgressKeyword || hasAchievementProgress) {
    return 'progress';
  }

  // ... rest of intent detection
};
```

### Solution 2: Improve Frontend Context Preservation

Modify handleQuickReplyClick to better handle show_choice_buttons responses.

**Changes:**

1. Add `goal_type` as a valid selectionType
2. Detect show_choice_buttons context and preserve conversation flow
3. Send the label directly without modification for non-category selections

```typescript
const handleQuickReplyClick = useCallback((value: string, label: string) => {
  const lastMessageWithQuickReplies = [...messages].reverse()
    .find(m => m.quickReplies && m.quickReplies.length > 0);
  const selectionType = lastMessageWithQuickReplies?.selectionType;

  // Add user message with the selected label
  setMessages(prev => [...prev, {
    id: `user-${Date.now()}`,
    senderId: 'user',
    senderName: 'You',
    senderType: 'user',
    senderIcon: '👤',
    content: label,
    timestamp: new Date(),
  }]);

  // Handle different selection types
  switch (selectionType) {
    case 'goal_category':
      activeAgent.sendMessage(locale === 'ja'
        ? `${label}の目標を提案して`
        : `Suggest ${label} goals`);
      break;

    case 'habit_category':
      activeAgent.sendMessage(locale === 'ja'
        ? `${label}の習慣を提案して`
        : `Suggest ${label} habits`);
      break;

    case 'goal_type':
    case 'choice':  // For show_choice_buttons without specific type
    default:
      // Send label directly - let AI interpret based on conversation context
      activeAgent.sendMessage(label);
      break;
  }
}, [locale, activeAgent, messages]);
```

### Solution 3: Add selectionType to show_choice_buttons Output

Modify the show_choice_buttons tool to optionally include a selectionType.

**File:** `backend/src/agents/shared-tools/coach-tools.ts`

```typescript
export const ShowChoiceButtonsSchema = z.object({
  title: z.string(),
  choices: z.array(z.object({
    id: z.string(),
    label: z.string(),
    icon: z.string().optional(),
    description: z.string().optional(),
  })).min(2).max(6),
  layout: z.enum(['horizontal', 'vertical']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  selectionType: z.enum(['choice', 'goal_type', 'habit_type', 'frequency', 'custom']).optional(),
});
```

## Proposed Implementation

### Phase 1: Backend Fix (Primary)

**File:** `backend/src/agents/mastra/vow-coach-agent.ts`

Modify detectIntent function to handle goal-type keywords correctly:

1. Add goal type pattern detection before progress detection
2. Use exclusion patterns for "達成" keyword
3. Return `goal_add` intent for goal type selections

### Phase 2: Frontend Enhancement (Secondary)

**File:** `frontend/app/dashboard/components/Section.MOC.tsx`

1. Update handleQuickReplyClick to send label directly for unknown selectionTypes
2. Remove automatic habit suggestion message construction for default cases
3. Let the AI interpret the user's selection based on conversation history

### Phase 3: System Prompt Enhancement (Optional)

Add explicit instructions to the system prompt about handling goal type selections:

```
### Goal Type Selection Flow
When user selects a goal type (達成ゴール, 習慣ゴール, etc.), do NOT switch to progress tracking.
Instead, continue the goal creation flow by:
1. Acknowledging the selected goal type
2. Asking for more details about the specific goal
3. Using suggest_goals tool with appropriate category
```

## Implementation Priority

1. **Critical**: Backend detectIntent fix - prevents misclassification
2. **High**: Frontend handleQuickReplyClick fix - improves context preservation
3. **Medium**: System prompt enhancement - improves AI behavior
4. **Low**: show_choice_buttons selectionType - better type safety

## Testing Strategy

### Unit Tests

1. Test detectIntent with various inputs:
   - "達成ゴール" → should NOT return 'progress'
   - "達成率を教えて" → should return 'progress'
   - "習慣ゴール" → should NOT return 'progress'
   - "達成状況" → should return 'progress'

2. Test handleQuickReplyClick with different selectionTypes

### Integration Tests

1. Full flow: "ゴールを設定したい" → select goal type → verify continuation
2. Progress check still works: "達成率を教えて" → verify progress response

### Manual Testing

1. Use browser console to verify intent detection
2. Check that conversation context is preserved
3. Verify no regression in existing flows

## Interfaces

### Updated Intent Type

```typescript
type IntentType =
  | 'habit_add'
  | 'goal_add'
  | 'analyze'
  | 'progress'
  | 'advice'
  | 'welcome'
  | 'unknown';
```

### Updated Selection Type

```typescript
type SelectionType =
  | 'habit_category'
  | 'goal_category'
  | 'difficulty'
  | 'goal_type'      // NEW
  | 'habit_type'     // NEW
  | 'choice'         // NEW - generic choice
  | 'drilldown_genre'
  | 'drilldown_purpose'
  | 'drilldown_response_type';
```

## Rollback Plan

If the fix causes issues:

1. Revert detectIntent changes - restore original keyword matching
2. Revert handleQuickReplyClick changes - restore default behavior
3. Monitor for new issues via error logging

## Dependencies

- vow-coach-agent.ts (backend)
- Section.MOC.tsx (frontend)
- coach-tools.ts (backend, optional)

## Risks

1. **Risk**: Changing keyword matching may affect other legitimate progress checks
   **Mitigation**: Use specific exclusion patterns rather than removing keywords entirely

2. **Risk**: Frontend changes may affect other button click handlers
   **Mitigation**: Only modify behavior for undefined/unknown selectionTypes
