# ISS-20260204-030: Design Document

## Overview
- **Purpose**: Technical design for fixing the multiple habit candidate display issue
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Architecture

### Current System Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Habit Addition Flow (Current - Broken)                 │
└─────────────────────────────────────────────────────────────────────────────────┘

User: "Add new habit"
         │
         ▼
┌─────────────────────┐
│ show_category_       │
│ selection            │ → Category buttons (Health, Learning, etc.)
│ (habit_category)     │
└─────────────────────┘
         │
         ▼
User selects: "Learning"
         │
         ▼
┌─────────────────────┐
│ show_choice_buttons  │ → Sub-category buttons (Programming, Reading, etc.)
│ (type: 'reply')      │   ← BUG: Should call suggest_habits instead
└─────────────────────┘
         │
         ▼
User selects: "Programming"
         │
         ▼
┌─────────────────────┐
│ show_choice_buttons  │ → Duration buttons (15min, 30min, 1hr)
│ (type: 'reply')      │   ← BUG: Continuing granular flow
└─────────────────────┘
         │
         ▼
... (continues with more single-choice steps)
```

### Expected System Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Habit Addition Flow (Expected - Fixed)                 │
└─────────────────────────────────────────────────────────────────────────────────┘

User: "Add new habit"
         │
         ▼
┌─────────────────────┐
│ show_category_       │ → Category buttons (Health, Learning, etc.)
│ selection            │
│ (habit_category)     │
└─────────────────────┘
         │
         ▼
User selects: "Learning"
         │
         ▼
┌─────────────────────┐     ┌────────────────────────────────────────────────────┐
│ suggest_habits       │ → │ HabitSuggestionResult                               │
│ (category:"learning",│     │ {                                                  │
│  count: 3)           │     │   suggestions: [                                   │
└─────────────────────┘     │     { name: "...", suggestionType: 'habit' },     │
                             │     { name: "...", suggestionType: 'habit' },     │
                             │     { name: "...", suggestionType: 'habit' }      │
                             │   ],                                               │
                             │   followUpActions: [                               │
                             │     { id: "more_specific", label: "More specific" }│
                             │     { id: "easier", label: "Easier" }              │
                             │     { id: "harder", label: "Harder" }              │
                             │     { id: "different", label: "Show more" }        │
                             │   ]                                                │
                             │ }                                                  │
                             └────────────────────────────────────────────────────┘
         │
         ▼
User clicks habit → HabitModal opens with pre-filled data
```

## Technical Design

### Component: System Prompt Enhancement

**File**: `/backend/src/agents/mastra/vow-coach-agent.ts`

**Location**: `generateSystemPrompt()` function (around line 225)

**Changes Required**:

1. Add explicit prohibition against `show_choice_buttons` loop after category selection
2. Add pattern detection for "habit refinement" scenarios
3. Strengthen the instruction to call `suggest_habits` immediately after category

**New Section to Add** (after line 518):

```typescript
// Add after existing category selection rules:

### 禁止パターン: show_choice_buttons ループ

**以下のパターンは絶対に禁止:**

1. カテゴリ選択後に `show_choice_buttons` で習慣のサブカテゴリを表示
2. 習慣の詳細（時間、頻度など）を `show_choice_buttons` で段階的に質問
3. 「プログラミング」「読書」などの具体的な習慣タイプを `show_choice_buttons` で選択させる

**正しい対応:**
カテゴリ選択後は**必ず `suggest_habits` を呼び出し**、AIが最適な習慣候補を複数提案する。
ユーザーに段階的に質問するのではなく、AIがユーザーコンテキストを考慮して最適な候補を提示する。

**判定ルール:**
| シナリオ | 禁止 | 必須 |
|----------|------|------|
| カテゴリ選択後 | show_choice_buttons | suggest_habits(category, count:3) |
| 習慣タイプの選択 | show_choice_buttons | suggest_habits でAIが提案 |
| 時間・頻度の選択 | show_choice_buttons | suggest_habits の結果に含む |

**理由:**
- ユーザーは複数の候補を見比べて選びたい
- 段階的な質問はUXを低下させる
- AIが最適な候補を提案することで、ユーザーの意思決定を支援する
```

### Component: show_choice_buttons Type Enforcement

**File**: `/backend/src/agents/shared-tools/coach-tools.ts`

**Current Issue**: When `show_choice_buttons` is called without explicit `type`, it defaults to `'reply'`.

**Solution**: No code change needed. The fix is in the system prompt to prevent `show_choice_buttons` usage after category selection.

However, we should ensure that IF `show_choice_buttons` is used for habit-related scenarios (edge cases), the AI is instructed to use `type: 'habit'`.

### Component: Frontend Display (Verification Only)

**File**: `/frontend/app/dashboard/components/Section.MOC.tsx`

**Current Behavior**:
- `parseSuggestions()` correctly extracts suggestions from `suggest_habits` tool output (line 2247-2273)
- `SuggestionCard` correctly uses `suggestionType` for styling (line 3385-3398)

**No changes needed** - Frontend already handles multiple suggestions correctly when `suggest_habits` is called.

## Interfaces

### Input: User Message After Category Selection

```typescript
// After user selects "Learning" category:
userMessage: "学習"  // or "learning" or "📚 学習・スキル"
```

### Output: suggest_habits Tool Result

```typescript
interface HabitSuggestionResult {
  suggestions: Array<{
    name: string;                    // e.g., "Daily Reading"
    description: string;             // e.g., "Read for 15 minutes every morning"
    category: string;                // e.g., "learning"
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    frequency: 'daily' | 'weekly' | '3x/week';
    estimatedTime: string;           // e.g., "15 minutes"
    estimatedDuration: string;       // e.g., "2-3 weeks to establish"
    rationale: string;               // e.g., "Reading regularly improves..."
    suggestionType: 'habit';         // CRITICAL: Must be 'habit'
  }>;
  followUpActions: Array<{
    id: string;                      // e.g., "more_specific"
    label: string;                   // e.g., "More specific"
    action: 'more_specific' | 'easier' | 'harder' | 'different';
    category: string;                // e.g., "learning"
  }>;
}
```

### Frontend Rendering

```typescript
// In ChatMessageBubble, suggestions are rendered as:
{message.suggestions && message.suggestions.length > 0 && (
  <SuggestionCardGroup
    messageId={message.id}
    suggestions={message.suggestions}  // Array of suggestions with suggestionType: 'habit'
    locale={locale}
    suggestionStates={suggestionStates}
    onSuggestionAction={onSuggestionAction}
    onRefineRequest={onRefineRequest}
  />
)}
```

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| OpenAI API | N/A | LLM for generating responses |
| zod | ^3.x | Schema validation for tool inputs |
| @supabase/supabase-js | ^2.x | User context retrieval |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI ignores updated prompt | High | Add explicit examples and stronger language |
| Regression in drilldown flow | Medium | Keep drilldown logic intact for ambiguous queries |
| Backward compatibility | Low | Changes are additive to system prompt |

## Testing Strategy

### Manual Testing Scenarios

1. **Happy Path**: "Add new habit" -> Select "Learning" -> Verify 3+ habit suggestions appear
2. **Button Type**: Verify each suggestion has `suggestionType: 'habit'`
3. **Follow-up Actions**: Verify "More specific", "Easier", "Harder", "Show more" buttons appear
4. **Modal Integration**: Click suggestion -> Verify HabitModal opens with pre-filled data
5. **Non-regression**: "What's recommended?" (ambiguous) -> Verify drilldown flow still works

### Automated Testing

Add test case to QA patrol:
```typescript
{
  question: "新しい習慣を追加したい",
  category: "habit-addition",
  expectedToolCalls: ["show_category_selection"],
  followUp: {
    question: "学習",
    expectedToolCalls: ["suggest_habits"],
    expectedOutput: {
      suggestions: { minCount: 3 },
      suggestionType: "habit"
    }
  }
}
```
