# Suggestion Button Enhancement - Technical Design

## Overview
- **Feature Name**: SuggestionButton機能拡張
- **Status**: Draft
- **Version**: 1.0.0
- **Created**: 2026-02-04
- **Author**: vow-spec-architect

---

## Architecture Overview

### Component Hierarchy

```
ChatMessageBubble
  └── SuggestionCardGroup (NEW)
        ├── SelectAllToggle (NEW)
        ├── SuggestionCard[] (MODIFIED)
        │     ├── CardContent (existing)
        │     └── Checkbox (NEW)
        ├── ActionButtonGroup (NEW)
        │     ├── RefineButton ("もっと具体的に")
        │     ├── SimplifyButton ("もっとかんたんに")
        │     ├── DifficultyButton ("もっと難しく")
        │     ├── ArrangeButton ("もっとアレンジして")
        │     └── AlternativeButton ("他には")
        └── RegisterButton (NEW)
```

### State Management

```typescript
// 新規: 選択状態の管理
interface SuggestionSelectionState {
  messageId: string;
  selectedIndices: Set<number>;  // 選択された候補のインデックス
}

// ChatMessageBubble または親コンポーネントで管理
const [selectionStates, setSelectionStates] = useState<Map<string, SuggestionSelectionState>>();
```

---

## Data Models

### Type Definitions Update

```typescript
// File: Section.MOC.tsx (Line 46付近)

// 既存のタイプを拡張
export type SuggestionButtonType =
  | 'habit'    // 習慣候補
  | 'goal'     // 目標候補
  | 'stickyn'  // スティッキーノート候補
  | 'category' // カテゴリ選択 (NEW)
  | 'text'     // その他テキスト (NEW)
  | 'reply';   // 回答（既存）

// 調整アクションの型 (既存のfollowUpActionsを拡張)
export type RefineActionType =
  | 'more_specific'    // もっと具体的に
  | 'easier'           // もっとかんたんに
  | 'harder'           // もっと難しく
  | 'different'        // もっとアレンジして
  | 'more_suggestions' // 他には
  | 'different_habit'; // 既存

// GroupChatMessage.followUpActions の action フィールドに上記を使用
```

### Selection State Interface

```typescript
// File: Section.MOC.tsx に追加

interface SuggestionSelectionContext {
  // メッセージID -> 選択されたインデックスのSet
  selections: Map<string, Set<number>>;

  // 選択を切り替え
  toggleSelection: (messageId: string, index: number) => void;

  // 全選択/全解除
  toggleSelectAll: (messageId: string, totalCount: number) => void;

  // 選択されている候補を取得
  getSelectedSuggestions: (messageId: string, suggestions: GroupChatMessage['suggestions']) => NonNullable<GroupChatMessage['suggestions']>;

  // 選択をクリア
  clearSelection: (messageId: string) => void;
}
```

---

## Component Specifications

### 1. SuggestionCardGroup (NEW)

**Purpose**: 複数のSuggestionCardをグループ化し、選択・アクション機能を提供

**Props**:
```typescript
interface SuggestionCardGroupProps {
  messageId: string;
  suggestions: NonNullable<GroupChatMessage['suggestions']>;
  locale: 'ja' | 'en';
  suggestionStates?: Record<string, SuggestionState>;
  onSuggestionAction?: (messageId: string, actionId: string, suggestion: NonNullable<GroupChatMessage['suggestion']>) => void;
  onRefineRequest?: (action: RefineActionType, selectedSuggestions: NonNullable<GroupChatMessage['suggestions']>) => void;
  onBatchRegister?: (selectedSuggestions: NonNullable<GroupChatMessage['suggestions']>) => Promise<void>;
}
```

**Internal State**:
```typescript
const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
const [isRegistering, setIsRegistering] = useState(false);
```

### 2. SuggestionCard (MODIFIED)

**Modified Props**:
```typescript
interface SuggestionCardProps {
  messageId: string;
  suggestion: NonNullable<GroupChatMessage['suggestion']>;
  locale: 'ja' | 'en';
  state?: SuggestionState;
  onAction?: (messageId: string, actionId: string, suggestion: NonNullable<GroupChatMessage['suggestion']>) => void;
  // NEW PROPS
  index?: number;  // カード群内でのインデックス
  isSelected?: boolean;  // 選択状態
  onSelectionChange?: (index: number, selected: boolean) => void;  // 選択変更コールバック
  showCheckbox?: boolean;  // チェックボックス表示フラグ (default: true when in group)
}
```

**Modified Render**:
```tsx
<div className={`... ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
  {/* Existing card content */}
  <button onClick={handleCardClick}>
    {/* ... */}
  </button>

  {/* NEW: Checkbox on the right */}
  {showCheckbox && (
    <div className="flex items-center px-3 py-2 border-l border-border/50">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onSelectionChange?.(index!, e.target.checked);
        }}
        className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
        aria-label={locale === 'ja' ? '候補を選択' : 'Select suggestion'}
      />
    </div>
  )}
</div>
```

### 3. ActionButtonGroup (NEW)

**Purpose**: 候補調整アクションボタンを表示

**Props**:
```typescript
interface ActionButtonGroupProps {
  locale: 'ja' | 'en';
  selectedCount: number;
  disabled?: boolean;
  onRefine: (action: RefineActionType) => void;
}
```

**Actions Configuration**:
```typescript
const REFINE_ACTIONS: Array<{
  action: RefineActionType;
  labelJa: string;
  labelEn: string;
  icon: string;
}> = [
  { action: 'more_specific', labelJa: 'もっと具体的に', labelEn: 'More Specific', icon: '🎯' },
  { action: 'easier', labelJa: 'もっとかんたんに', labelEn: 'Make Easier', icon: '😊' },
  { action: 'harder', labelJa: 'もっと難しく', labelEn: 'Make Harder', icon: '💪' },
  { action: 'different', labelJa: 'もっとアレンジして', labelEn: 'Arrange Differently', icon: '🔄' },
  { action: 'more_suggestions', labelJa: '他には', labelEn: 'More Options', icon: '➕' },
];
```

**Render**:
```tsx
<div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
  {REFINE_ACTIONS.map((action) => (
    <button
      key={action.action}
      onClick={() => onRefine(action.action)}
      disabled={disabled || selectedCount === 0}
      className={`px-3 py-1.5 text-xs rounded-lg transition-colors
        ${selectedCount > 0
          ? 'bg-muted hover:bg-muted/80 text-foreground'
          : 'bg-muted/50 text-muted-foreground cursor-not-allowed'}`}
    >
      <span className="mr-1">{action.icon}</span>
      {locale === 'ja' ? action.labelJa : action.labelEn}
    </button>
  ))}
</div>
```

### 4. RegisterButton (NEW)

**Purpose**: 選択した候補を一括登録

**Props**:
```typescript
interface RegisterButtonProps {
  locale: 'ja' | 'en';
  selectedCount: number;
  isLoading: boolean;
  onRegister: () => void;
}
```

**Render**:
```tsx
<button
  onClick={onRegister}
  disabled={selectedCount === 0 || isLoading}
  className={`mt-3 w-full px-4 py-2 rounded-lg font-medium transition-colors
    ${selectedCount > 0 && !isLoading
      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
      : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
>
  {isLoading ? (
    <span className="flex items-center justify-center gap-2">
      <LoadingSpinner size="sm" />
      {locale === 'ja' ? '登録中...' : 'Registering...'}
    </span>
  ) : (
    <>
      {locale === 'ja'
        ? `選択した候補を登録 (${selectedCount}件)`
        : `Register Selected (${selectedCount})`}
    </>
  )}
</button>
```

---

## UI Design

### Visual States

```
┌─────────────────────────────────────────────────────────────┐
│  [ ] すべて選択                                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┬─────┐      │
│  │ 📝 毎朝7時に起きる                    [Habit] │ [✓] │ ◀── 選択状態
│  │ 頻度: 毎日 | 所要時間: -                      │     │      (ring-2 ring-primary)
│  │ 💡 規則正しい生活リズムを作るため...          │     │
│  ├─────────────────────────────────────────────┼─────┤
│  │ [⏭️ 後で]  [❌ 不要]      タップで詳細確認   │     │
│  └─────────────────────────────────────────────┴─────┘
│                                                              │
│  ┌─────────────────────────────────────────────┬─────┐      │
│  │ 🎯 TOEIC 800点を取る                  [Goal] │ [ ] │ ◀── 未選択状態
│  │ 達成目安: 6ヶ月                              │     │
│  │ 💡 英語力向上のため...                       │     │
│  ├─────────────────────────────────────────────┼─────┤
│  │ [⏭️ 後で]  [❌ 不要]      タップで詳細確認   │     │
│  └─────────────────────────────────────────────┴─────┘
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  [🎯 もっと具体的に] [😊 もっとかんたんに] [💪 もっと難しく] │
│  [🔄 もっとアレンジして] [➕ 他には]                        │
├─────────────────────────────────────────────────────────────┤
│  [ 選択した候補を登録 (1件) ]                                │
└─────────────────────────────────────────────────────────────┘
```

### Type Badge Colors

| Type | Background | Text | Border |
|------|-----------|------|--------|
| Habit | `bg-blue-100 dark:bg-blue-900/30` | `text-blue-700 dark:text-blue-300` | - |
| Goal | `bg-purple-100 dark:bg-purple-900/30` | `text-purple-700 dark:text-purple-300` | - |
| Sticky'n | `bg-yellow-100 dark:bg-yellow-900/30` | `text-yellow-700 dark:text-yellow-300` | - |
| Category | `bg-green-100 dark:bg-green-900/30` | `text-green-700 dark:text-green-300` | - |
| Text | `bg-gray-100 dark:bg-gray-800/50` | `text-gray-700 dark:text-gray-300` | - |

### Selection Visual Feedback

```css
/* 選択されたカード */
.suggestion-card--selected {
  @apply ring-2 ring-primary bg-primary/5;
}

/* チェックボックス領域 */
.suggestion-card__checkbox {
  @apply flex items-center justify-center w-12 border-l border-border/50;
}

/* チェックボックス自体 */
.suggestion-card__checkbox input[type="checkbox"] {
  @apply w-5 h-5 rounded border-2 border-border
         text-primary focus:ring-primary focus:ring-offset-0
         cursor-pointer;
}
```

---

## API Integration

### Refine Suggestions API Call

調整リクエストは既存のChat機能を使用して送信する:

```typescript
// handleRefineRequest in SuggestionCardGroup
const handleRefineRequest = async (action: RefineActionType) => {
  const selectedSuggestions = getSelectedSuggestions();

  // Construct prompt based on action type
  const prompts: Record<RefineActionType, string> = {
    more_specific: `以下の候補をもっと具体的にしてください:\n${formatSuggestions(selectedSuggestions)}`,
    easier: `以下の候補をもっとかんたんにしてください:\n${formatSuggestions(selectedSuggestions)}`,
    harder: `以下の候補をもっと難しくしてください:\n${formatSuggestions(selectedSuggestions)}`,
    different: `以下の候補を別のアレンジで作り直してください:\n${formatSuggestions(selectedSuggestions)}`,
    more_suggestions: `以下とは全く別の候補を提案してください:\n${formatSuggestions(selectedSuggestions)}`,
    different_habit: `別の習慣を提案してください`,
  };

  // Use existing chat send mechanism
  onRefineRequest?.(action, selectedSuggestions);
};
```

### Batch Registration

```typescript
// handleBatchRegister in SuggestionCardGroup
const handleBatchRegister = async () => {
  setIsRegistering(true);

  const selectedSuggestions = getSelectedSuggestions();
  const results: { index: number; success: boolean; error?: string }[] = [];

  for (const [index, suggestion] of selectedSuggestions.entries()) {
    try {
      // Trigger the same action as individual accept
      await onSuggestionAction?.(
        `${messageId}-${index}`,
        'accept',
        suggestion
      );
      results.push({ index, success: true });
    } catch (error) {
      results.push({
        index,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  setIsRegistering(false);

  // Clear selection for successful registrations
  const successfulIndices = results.filter(r => r.success).map(r => r.index);
  clearSelectionFor(successfulIndices);

  // Report errors if any
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    // Show error toast or notification
  }
};
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `Section.MOC.tsx` | MODIFY | SuggestionButtonType拡張、SuggestionCard修正、SuggestionCardGroup追加 |
| `Section.MOC.tsx` | ADD | ActionButtonGroup、RegisterButton コンポーネント追加 |

---

## Testing Strategy

### Unit Tests
- SuggestionCardGroup: 選択状態の管理
- ActionButtonGroup: ボタンの有効/無効状態
- RegisterButton: ローディング状態

### Integration Tests
- 複数選択 -> 調整リクエスト -> 新しい候補表示
- 複数選択 -> 一括登録 -> 状態更新

### E2E Tests
- チェックボックス操作
- モバイル画面でのタップ操作
