# MOC Section Chat Improvement - Design Document

## Overview
- **Feature Name**: MOC Section Chat Improvement
- **Status**: Draft
- **Version**: 1.0.0
- **Created**: 2026-02-05
- **Author**: vow-spec-architect
- **Related Requirements**: `requirements.md`

---

## Architecture Overview

### Component Hierarchy

```
MOCSection
├── ChatTab
│   ├── MessageList
│   │   ├── ChatMessage (user/agent messages)
│   │   ├── SuggestionCard (habit/goal/stickyn candidates)
│   │   │   ├── TypeBadge
│   │   │   ├── CardContent
│   │   │   └── ActionButtons ([採用][却下][詳細])
│   │   ├── QuickReplyButtons (category/option selection)
│   │   └── FollowUpActionButtons ([もっと具体的に] etc.)
│   ├── ChatInput
│   └── ConversationMemory (new)
├── HabitModal
├── GoalModal
└── StickyModal
```

---

## Data Models

### 1. SuggestionButtonType (既存 + 拡張)

```typescript
// 既存の型定義（変更なし）
export type SuggestionButtonType =
  | 'habit'     // Habit候補 -> HabitModal
  | 'goal'      // Goal候補 -> GoalModal
  | 'stickyn'   // Sticky'n候補 -> StickyModal
  | 'category'  // カテゴリ選択
  | 'text'      // テキスト情報
  | 'reply';    // 回答型（クリックでユーザー発言として送信）
```

### 2. ConversationContext (新規)

```typescript
interface ConversationContext {
  /** Current step in the question flow */
  currentStep: 'idle' | 'info_type' | 'category' | 'subcategory' | 'generating';

  /** User's selection for information type (Step 1) */
  infoType?: InfoTypeSelection;

  /** User's category selection (Step 2) */
  category?: CategorySelection;

  /** User's sub-category selection (Step 3) */
  subCategory?: string;

  /** Previously shown suggestions (for exclusion) */
  previousSuggestions: string[];

  /** Timestamp of last interaction */
  lastInteraction: Date;
}

type InfoTypeSelection =
  | 'review_habits'
  | 'habits_for_goal'
  | 'new_goal'
  | 'new_habit'
  | 'check_registered'
  | 'other_advice';

type CategorySelection =
  | 'health'
  | 'career'
  | 'learning'
  | 'hobby'
  | 'relationships'
  | 'finance'
  | 'lifestyle'
  | 'other';
```

### 3. QuestionFlowConfig (新規)

```typescript
interface QuestionFlowConfig {
  /** Step 1: Information type options */
  infoTypeOptions: Array<{
    id: InfoTypeSelection;
    label: { ja: string; en: string };
    icon: string;
    nextStep: 'show_habits' | 'show_goals' | 'category' | 'summary' | 'freeform';
  }>;

  /** Step 2: Category options */
  categoryOptions: Array<{
    id: CategorySelection;
    label: { ja: string; en: string };
    icon: string;
  }>;

  /** Step 3: Sub-category options by category */
  subCategoryOptions: Record<CategorySelection, Array<{
    id: string;
    label: { ja: string; en: string };
  }>>;
}
```

---

## UI Components Design

### 1. SuggestionCard (改善版)

```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────┐                                                    │
│ │ 📝   │ 毎朝10分の瞑想              [Habit]               │
│ └──────┘                                                    │
│ 朝起きたら、静かな場所で10分間の瞑想を行います。            │
│ ─────────────────────────────────────────────────────────── │
│ 頻度: 毎日 | 所要時間: 10分 | 達成目安: 21日                │
│ ─────────────────────────────────────────────────────────── │
│ 💡 瞑想は集中力を高め、ストレス軽減に効果的です。          │
├─────────────────────────────────────────────────────────────┤
│ [✅ 採用]  [❌ 却下]                        [詳細を確認 →] │
└─────────────────────────────────────────────────────────────┘
```

**Button States:**
- Default: Light background, visible border
- Hover: Darker background
- Active: Primary color highlight
- Disabled: Greyed out, no interaction

### 2. QuickReplyButtons (Step 1 - 情報種類選択)

```
┌─────────────────────────────────────────────────────────────┐
│ 🤖 AI Coach                                                 │
│ どのようなサポートが必要ですか？                            │
│                                                             │
│ ┌──────────────────┐ ┌──────────────────┐                  │
│ │ 📋 既存Habitの   │ │ 🎯 既存Goalの    │                  │
│ │    見直し        │ │    新Habit提案   │                  │
│ └──────────────────┘ └──────────────────┘                  │
│ ┌──────────────────┐ ┌──────────────────┐                  │
│ │ ✨ 新しいGoalの  │ │ 📝 新しいHabitの │                  │
│ │    提案          │ │    提案          │                  │
│ └──────────────────┘ └──────────────────┘                  │
│ ┌──────────────────┐ ┌──────────────────┐                  │
│ │ 📊 登録情報の    │ │ 💬 その他        │                  │
│ │    確認          │ │    アドバイス    │                  │
│ └──────────────────┘ └──────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 3. FollowUpActionButtons (詳細度調整)

```
┌─────────────────────────────────────────────────────────────┐
│ [提案1] [提案2] [提案3]                                     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐                    │
│ │ 🔍 もっと具体的に│ │ 🌐 もっと一般的に│                    │
│ └─────────────────┘ └─────────────────┘                    │
│ ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐   │
│ │ 😊 もっと簡単に │ │ 💪 もっと難しく │ │ 🔄 別ジャンル│   │
│ └─────────────────┘ └─────────────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## State Management

### 1. Conversation Memory Hook

```typescript
// New hook: useConversationMemory.ts
export function useConversationMemory() {
  const [context, setContext] = useState<ConversationContext>({
    currentStep: 'idle',
    previousSuggestions: [],
    lastInteraction: new Date(),
  });

  const setInfoType = useCallback((type: InfoTypeSelection) => {
    setContext(prev => ({
      ...prev,
      infoType: type,
      currentStep: getNextStep(type),
      lastInteraction: new Date(),
    }));
  }, []);

  const setCategory = useCallback((category: CategorySelection) => {
    setContext(prev => ({
      ...prev,
      category,
      currentStep: 'subcategory',
      lastInteraction: new Date(),
    }));
  }, []);

  const setSubCategory = useCallback((subCategory: string) => {
    setContext(prev => ({
      ...prev,
      subCategory,
      currentStep: 'generating',
      lastInteraction: new Date(),
    }));
  }, []);

  const addPreviousSuggestion = useCallback((name: string) => {
    setContext(prev => ({
      ...prev,
      previousSuggestions: [...prev.previousSuggestions, name].slice(-20),
    }));
  }, []);

  const reset = useCallback(() => {
    setContext({
      currentStep: 'idle',
      previousSuggestions: [],
      lastInteraction: new Date(),
    });
  }, []);

  return {
    context,
    setInfoType,
    setCategory,
    setSubCategory,
    addPreviousSuggestion,
    reset,
  };
}
```

### 2. Question Flow State Machine

```
                    ┌─────────────┐
                    │    idle     │
                    └──────┬──────┘
                           │ User starts conversation
                           ▼
                    ┌─────────────┐
                    │  info_type  │ ← Show Step 1 buttons
                    └──────┬──────┘
                           │ User selects info type
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │show_habits│  │show_goals │  │ category  │
    └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
          │              │              │
          │              │              ▼
          │              │        ┌───────────┐
          │              │        │subcategory│
          │              │        └─────┬─────┘
          │              │              │
          ▼              ▼              ▼
                    ┌─────────────┐
                    │ generating  │ ← AI generates suggestions
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   idle      │ ← Ready for next flow
                    └─────────────┘
```

---

## API Integration

### 1. Refinement Request Format

```typescript
interface RefinementRequest {
  action: 'more_specific' | 'more_general' | 'easier' | 'harder' | 'different';
  context: ConversationContext;
  previousSuggestions: string[];
  locale: 'ja' | 'en';
}
```

### 2. AI Prompt Templates

**Step 1 Prompt (情報種類確認):**
```
ユーザーがチャットを開始しました。
まず、どのようなサポートが必要か確認してください。

以下の選択肢をボタンとして表示してください：
1. 既存Habitの見直し
2. 既存Goalに関する新しいHabitの提案
3. 新しいGoalの提案
4. 新しいHabitの提案
5. 既存の登録情報の確認
6. その他アドバイス
```

**More Specific Prompt:**
```
ユーザーが「もっと具体的に」を選択しました。
カテゴリ: {category}
前回の提案: {previousSuggestions}

より具体的で実践しやすい提案を3つ生成してください。
- 具体的な行動内容を含める
- 時間、場所、頻度を明示する
- すぐに始められるステップを示す
```

**More General Prompt:**
```
ユーザーが「もっと一般的に」を選択しました。
カテゴリ: {category}
前回の提案: {previousSuggestions}

より幅広い適用可能性のある提案を3つ生成してください。
- 柔軟に調整できる内容にする
- 複数のアプローチを提示する
- 個人の状況に合わせやすくする
```

---

## Error Handling

### 1. AI Response Failures

```typescript
const handleAIError = (error: Error) => {
  // Show error message to user
  addSystemMessage({
    type: 'error',
    content: locale === 'ja'
      ? 'AI応答でエラーが発生しました。もう一度お試しください。'
      : 'An error occurred with AI response. Please try again.',
  });

  // Reset conversation to last stable state
  resetToLastStableState();

  // Log for debugging
  console.error('[MOC Chat] AI error:', error);
};
```

### 2. Modal State Recovery

```typescript
const handleModalCancel = (modalType: 'habit' | 'goal' | 'stickyn') => {
  // Keep suggestion in pending state (not dismissed)
  // User can click again to reopen modal
  setSuggestionStates(prev => ({
    ...prev,
    [currentSuggestionId]: { status: 'pending' },
  }));
};
```

---

## Testing Strategy

### 1. Unit Tests
- `useConversationMemory` hook state transitions
- `SuggestionCard` button click handlers
- `QuickReplyButtons` selection handlers
- `FollowUpActionButtons` refinement requests

### 2. Integration Tests
- Complete question flow (Step 1 -> Step 2 -> Step 3 -> Suggestions)
- Modal open/close transitions
- AI response parsing and display

### 3. E2E Tests
- Full user journey from chat start to habit creation
- Error recovery scenarios
- Locale switching during conversation

---

## Migration Notes

### Breaking Changes
None - all changes are additive or modify internal behavior

### Backward Compatibility
- Existing `suggestion.type` handling remains unchanged
- New `suggestionType` field takes precedence when present
- Old messages without new fields continue to work
