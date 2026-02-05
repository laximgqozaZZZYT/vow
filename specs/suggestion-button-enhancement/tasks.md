# Suggestion Button Enhancement - Implementation Tasks

## Overview
- **Feature Name**: SuggestionButton機能拡張
- **Status**: Ready for Implementation
- **Version**: 1.0.0
- **Created**: 2026-02-04
- **Author**: vow-spec-architect

---

## Task Summary

| Phase | Tasks | Est. Hours | Assignable To |
|-------|-------|------------|---------------|
| Phase 1 | Type & State Preparation | 1h | Any Frontend |
| Phase 2 | SuggestionCard Modification | 2h | Frontend Developer |
| Phase 3 | SuggestionCardGroup | 2h | Frontend Developer |
| Phase 4 | ActionButtonGroup | 1.5h | Frontend Developer |
| Phase 5 | RegisterButton & Batch Logic | 2h | Frontend Developer |
| Phase 6 | Integration & Testing | 1.5h | Tester |
| **Total** | | **10h** | |

---

## Phase 1: Type & State Preparation

### Task 1.1: SuggestionButtonType 拡張
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: Line 46
- **Priority**: High
- **Prerequisites**: None
- **Estimated Time**: 15min

**Current Code**:
```typescript
export type SuggestionButtonType = 'habit' | 'goal' | 'stickyn' | 'reply';
```

**Target Code**:
```typescript
export type SuggestionButtonType = 'habit' | 'goal' | 'stickyn' | 'category' | 'text' | 'reply';
```

- [ ] `category` タイプを追加
- [ ] `text` タイプを追加

### Task 1.2: typeConfig に新タイプを追加
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: Line 3133-3138 (SuggestionCard内)
- **Priority**: High
- **Prerequisites**: Task 1.1
- **Estimated Time**: 15min

**Current Code**:
```typescript
const typeConfig: Record<SuggestionButtonType, { icon: string; label: { ja: string; en: string }; color: string }> = {
  habit: { icon: '📝', label: { ja: 'Habit', en: 'Habit' }, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  goal: { icon: '🎯', label: { ja: 'Goal', en: 'Goal' }, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  stickyn: { icon: '📌', label: { ja: "Sticky'n", en: "Sticky'n" }, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  reply: { icon: '💬', label: { ja: '回答', en: 'Reply' }, color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
};
```

**Target Code**:
```typescript
const typeConfig: Record<SuggestionButtonType, { icon: string; label: { ja: string; en: string }; color: string }> = {
  habit: { icon: '📝', label: { ja: 'Habit', en: 'Habit' }, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  goal: { icon: '🎯', label: { ja: 'Goal', en: 'Goal' }, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  stickyn: { icon: '📌', label: { ja: "Sticky'n", en: "Sticky'n" }, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  category: { icon: '📁', label: { ja: 'Category', en: 'Category' }, color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  text: { icon: '📄', label: { ja: 'Text', en: 'Text' }, color: 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300' },
  reply: { icon: '💬', label: { ja: '回答', en: 'Reply' }, color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
};
```

- [ ] `category` 設定を追加
- [ ] `text` 設定を追加

### Task 1.3: RefineActionType 定義追加
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: Line 47付近（SuggestionButtonType の直後）
- **Priority**: High
- **Prerequisites**: None
- **Estimated Time**: 10min

**Add**:
```typescript
/** Refine action types for suggestion adjustment */
export type RefineActionType =
  | 'more_specific'
  | 'easier'
  | 'harder'
  | 'different'
  | 'more_suggestions'
  | 'different_habit';
```

- [ ] RefineActionType 型定義を追加

---

## Phase 2: SuggestionCard Modification

### Task 2.1: SuggestionCardProps 拡張
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: Line 3119-3125
- **Priority**: High
- **Prerequisites**: Phase 1 完了
- **Estimated Time**: 15min

**Current Code**:
```typescript
interface SuggestionCardProps {
  messageId: string;
  suggestion: NonNullable<GroupChatMessage['suggestion']>;
  locale: 'ja' | 'en';
  state?: SuggestionState;
  onAction?: (messageId: string, actionId: string, suggestion: NonNullable<GroupChatMessage['suggestion']>) => void;
}
```

**Target Code**:
```typescript
interface SuggestionCardProps {
  messageId: string;
  suggestion: NonNullable<GroupChatMessage['suggestion']>;
  locale: 'ja' | 'en';
  state?: SuggestionState;
  onAction?: (messageId: string, actionId: string, suggestion: NonNullable<GroupChatMessage['suggestion']>) => void;
  // NEW: Selection support
  index?: number;
  isSelected?: boolean;
  onSelectionChange?: (index: number, selected: boolean) => void;
  showCheckbox?: boolean;
}
```

- [ ] `index` prop追加
- [ ] `isSelected` prop追加
- [ ] `onSelectionChange` prop追加
- [ ] `showCheckbox` prop追加

### Task 2.2: SuggestionCard チェックボックスUI実装
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: Line 3183-3293 (SuggestionCard return部分)
- **Priority**: High
- **Prerequisites**: Task 2.1
- **Estimated Time**: 45min

**Implementation Details**:

1. 外側のdivにflex構造を追加し、チェックボックス領域を右端に配置
2. 選択状態で視覚的フィードバック（ring, background）
3. チェックボックスのクリックイベントは伝播を止める

**Target Structure**:
```tsx
<div className={`mt-2 bg-card border border-border rounded-lg shadow-sm max-w-sm overflow-hidden flex ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
  {/* Main content area */}
  <div className="flex-1">
    {/* Existing clickable button content */}
    <button type="button" onClick={handleCardClick} ...>
      {/* ... existing content ... */}
    </button>

    {/* Secondary action buttons */}
    <div className="flex gap-2 px-3 pb-3 pt-1 border-t border-border/50">
      {/* ... existing buttons ... */}
    </div>
  </div>

  {/* NEW: Checkbox area */}
  {showCheckbox && (
    <div
      className="flex items-center justify-center w-14 border-l border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onSelectionChange?.(index!, !isSelected);
      }}
    >
      <input
        type="checkbox"
        checked={isSelected || false}
        onChange={(e) => {
          e.stopPropagation();
          onSelectionChange?.(index!, e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-5 h-5 rounded border-2 border-border text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
        aria-label={locale === 'ja' ? '候補を選択' : 'Select suggestion'}
      />
    </div>
  )}
</div>
```

- [ ] flex構造に変更
- [ ] isSelected時のスタイル追加
- [ ] チェックボックス領域追加
- [ ] イベント伝播制御

### Task 2.3: 処理済み状態のカードにもチェックボックス対応
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: Line 3149-3181 (status !== 'pending' の場合)
- **Priority**: Medium
- **Prerequisites**: Task 2.2
- **Estimated Time**: 20min

**Note**: 処理済みカードは選択不可（チェックボックス非表示）にするか、グレーアウトで表示するかを決定

- [ ] 処理済み状態でのチェックボックス動作を実装

---

## Phase 3: SuggestionCardGroup コンポーネント

### Task 3.1: SuggestionCardGroup コンポーネント作成
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: Line 3295付近（SuggestionCard の直後）
- **Priority**: High
- **Prerequisites**: Phase 2 完了
- **Estimated Time**: 60min

**Implementation**:
```typescript
interface SuggestionCardGroupProps {
  messageId: string;
  suggestions: NonNullable<GroupChatMessage['suggestions']>;
  locale: 'ja' | 'en';
  suggestionStates?: Record<string, SuggestionState>;
  onSuggestionAction?: (messageId: string, actionId: string, suggestion: NonNullable<GroupChatMessage['suggestion']>) => void;
  onRefineRequest?: (action: RefineActionType, selectedSuggestions: NonNullable<GroupChatMessage['suggestions']>) => void;
}

function SuggestionCardGroup({
  messageId,
  suggestions,
  locale,
  suggestionStates,
  onSuggestionAction,
  onRefineRequest,
}: SuggestionCardGroupProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSelectionChange = (index: number, selected: boolean) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === suggestions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(suggestions.map((_, i) => i)));
    }
  };

  const getSelectedSuggestions = () => {
    return suggestions.filter((_, i) => selectedIndices.has(i));
  };

  const handleRefine = (action: RefineActionType) => {
    onRefineRequest?.(action, getSelectedSuggestions());
  };

  const handleBatchRegister = async () => {
    setIsRegistering(true);
    const selected = getSelectedSuggestions();

    for (let i = 0; i < selected.length; i++) {
      const suggestion = selected[i];
      const originalIndex = suggestions.indexOf(suggestion);
      try {
        await onSuggestionAction?.(`${messageId}-${originalIndex}`, 'accept', suggestion);
      } catch (error) {
        console.error('Failed to register suggestion:', error);
      }
    }

    setSelectedIndices(new Set());
    setIsRegistering(false);
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      {/* Select All Toggle */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={selectedIndices.size === suggestions.length && suggestions.length > 0}
          onChange={handleSelectAll}
          className="w-4 h-4 rounded border-border text-primary"
        />
        <span>{locale === 'ja' ? 'すべて選択' : 'Select All'}</span>
        {selectedIndices.size > 0 && (
          <span className="text-primary">({selectedIndices.size}/{suggestions.length})</span>
        )}
      </div>

      {/* Suggestion Cards */}
      {suggestions.map((suggestion, index) => (
        <SuggestionCard
          key={`${messageId}-suggestion-${index}`}
          messageId={`${messageId}-${index}`}
          suggestion={suggestion}
          locale={locale}
          state={suggestionStates?.[`${messageId}-${index}`]}
          onAction={onSuggestionAction}
          index={index}
          isSelected={selectedIndices.has(index)}
          onSelectionChange={handleSelectionChange}
          showCheckbox={true}
        />
      ))}

      {/* Action Buttons */}
      <ActionButtonGroup
        locale={locale}
        selectedCount={selectedIndices.size}
        onRefine={handleRefine}
      />

      {/* Register Button */}
      <RegisterButton
        locale={locale}
        selectedCount={selectedIndices.size}
        isLoading={isRegistering}
        onRegister={handleBatchRegister}
      />
    </div>
  );
}
```

- [ ] SuggestionCardGroupProps 定義
- [ ] 選択状態管理（useState）
- [ ] handleSelectionChange 実装
- [ ] handleSelectAll 実装
- [ ] handleRefine 実装
- [ ] handleBatchRegister 実装
- [ ] JSX構造実装

### Task 3.2: ChatMessageBubble での使用箇所更新
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: Line 3058-3082
- **Priority**: High
- **Prerequisites**: Task 3.1
- **Estimated Time**: 20min

**Current Code**:
```tsx
{/* Suggestion Cards - render ALL suggestions */}
{message.suggestions && message.suggestions.length > 0 && (
  <div className="flex flex-col gap-2 mt-2">
    {message.suggestions.map((suggestion, index) => (
      <SuggestionCard
        key={`${message.id}-suggestion-${index}`}
        messageId={`${message.id}-${index}`}
        suggestion={suggestion}
        locale={locale}
        state={suggestionStates?.[`${message.id}-${index}`]}
        onAction={onSuggestionAction}
      />
    ))}
  </div>
)}
```

**Target Code**:
```tsx
{/* Suggestion Cards Group - with selection and batch actions */}
{message.suggestions && message.suggestions.length > 0 && (
  <SuggestionCardGroup
    messageId={message.id}
    suggestions={message.suggestions}
    locale={locale}
    suggestionStates={suggestionStates}
    onSuggestionAction={onSuggestionAction}
    onRefineRequest={onRefineRequest}  // New prop to pass through
  />
)}
```

- [ ] SuggestionCardGroup を使用するよう変更
- [ ] onRefineRequest prop の追加

---

## Phase 4: ActionButtonGroup

### Task 4.1: ActionButtonGroup コンポーネント作成
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: SuggestionCardGroup の直前
- **Priority**: High
- **Prerequisites**: Task 1.3
- **Estimated Time**: 45min

**Implementation**:
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

interface ActionButtonGroupProps {
  locale: 'ja' | 'en';
  selectedCount: number;
  disabled?: boolean;
  onRefine: (action: RefineActionType) => void;
}

function ActionButtonGroup({ locale, selectedCount, disabled, onRefine }: ActionButtonGroupProps) {
  const isDisabled = disabled || selectedCount === 0;

  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
      {REFINE_ACTIONS.map((action) => (
        <button
          key={action.action}
          onClick={() => onRefine(action.action)}
          disabled={isDisabled}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1
            ${!isDisabled
              ? 'bg-muted hover:bg-muted/80 text-foreground'
              : 'bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50'}`}
        >
          <span>{action.icon}</span>
          <span>{locale === 'ja' ? action.labelJa : action.labelEn}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] REFINE_ACTIONS 定数定義
- [ ] ActionButtonGroupProps 定義
- [ ] ActionButtonGroup コンポーネント実装

---

## Phase 5: RegisterButton & Batch Logic

### Task 5.1: RegisterButton コンポーネント作成
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: ActionButtonGroup の直後
- **Priority**: High
- **Prerequisites**: Phase 4 完了
- **Estimated Time**: 30min

**Implementation**:
```typescript
interface RegisterButtonProps {
  locale: 'ja' | 'en';
  selectedCount: number;
  isLoading: boolean;
  onRegister: () => void;
}

function RegisterButton({ locale, selectedCount, isLoading, onRegister }: RegisterButtonProps) {
  const isDisabled = selectedCount === 0 || isLoading;

  return (
    <button
      onClick={onRegister}
      disabled={isDisabled}
      className={`mt-2 w-full px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
        ${!isDisabled
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
    >
      {isLoading ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{locale === 'ja' ? '登録中...' : 'Registering...'}</span>
        </>
      ) : (
        <span>
          {locale === 'ja'
            ? `選択した候補を登録 (${selectedCount}件)`
            : `Register Selected (${selectedCount})`}
        </span>
      )}
    </button>
  );
}
```

- [ ] RegisterButtonProps 定義
- [ ] RegisterButton コンポーネント実装
- [ ] ローディングスピナー実装

### Task 5.2: onRefineRequest ハンドラの実装
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: MOCSection コンポーネント内
- **Priority**: High
- **Prerequisites**: Task 5.1
- **Estimated Time**: 45min

**Implementation Details**:

1. MOCSection に handleRefineRequest 関数を追加
2. 選択された候補を元にプロンプトを生成
3. 既存のsendMessage機能を使用してリクエスト送信

```typescript
const handleRefineRequest = useCallback((
  action: RefineActionType,
  selectedSuggestions: NonNullable<GroupChatMessage['suggestions']>
) => {
  const suggestionNames = selectedSuggestions.map(s => s.data.name || 'Unknown').join(', ');

  const prompts: Record<RefineActionType, string> = {
    more_specific: `「${suggestionNames}」をもっと具体的な内容にしてください。`,
    easier: `「${suggestionNames}」をもっとかんたんな内容にしてください。`,
    harder: `「${suggestionNames}」をもっと難しい内容にしてください。`,
    different: `「${suggestionNames}」を別のアレンジで作り直してください。`,
    more_suggestions: `「${suggestionNames}」とは全く別の候補を提案してください。`,
    different_habit: '別の習慣を提案してください。',
  };

  const prompt = prompts[action];
  // Use existing sendMessage mechanism
  handleSendMessage(prompt);
}, [handleSendMessage]);
```

- [ ] handleRefineRequest 実装
- [ ] プロンプトテンプレート定義
- [ ] ChatMessageBubble/GroupChatView への prop 伝達

### Task 5.3: Props チェーンの整備
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Location**: GroupChatView, ChatMessageBubble
- **Priority**: High
- **Prerequisites**: Task 5.2
- **Estimated Time**: 30min

**Changes needed**:

1. GroupChatViewProps に onRefineRequest 追加
2. ChatMessageBubbleProps に onRefineRequest 追加
3. 各コンポーネントで prop を子に伝達

- [ ] GroupChatViewProps 更新
- [ ] ChatMessageBubbleProps 更新
- [ ] prop 伝達の実装

---

## Phase 6: Integration & Testing

### Task 6.1: ビルド確認
- **Priority**: High
- **Prerequisites**: Phase 5 完了
- **Estimated Time**: 20min

```bash
cd /home/ubuntu/Downloads/vow/frontend
npm run build
```

- [ ] TypeScript エラーなし
- [ ] ビルド成功

### Task 6.2: 手動テスト
- **Priority**: High
- **Prerequisites**: Task 6.1
- **Estimated Time**: 40min

**Test Cases**:

1. **チェックボックス操作**
   - [ ] 個別選択/解除
   - [ ] 全選択/全解除
   - [ ] 選択状態の視覚的フィードバック

2. **アクションボタン**
   - [ ] 選択なし時は無効化
   - [ ] 選択あり時にクリック可能
   - [ ] クリックでチャット送信

3. **一括登録**
   - [ ] 選択した候補のみ登録
   - [ ] ローディング表示
   - [ ] 登録後の状態更新

4. **レスポンシブ**
   - [ ] モバイル画面でのチェックボックス操作
   - [ ] アクションボタンの折り返し

### Task 6.3: エッジケーステスト
- **Priority**: Medium
- **Prerequisites**: Task 6.2
- **Estimated Time**: 20min

- [ ] 候補0件の場合（グループ非表示）
- [ ] 候補1件の場合
- [ ] 候補50件の場合（パフォーマンス）
- [ ] 登録途中でエラー発生時

---

## Completion Checklist

- [ ] Phase 1: Type & State Preparation (3 tasks)
- [ ] Phase 2: SuggestionCard Modification (3 tasks)
- [ ] Phase 3: SuggestionCardGroup (2 tasks)
- [ ] Phase 4: ActionButtonGroup (1 task)
- [ ] Phase 5: RegisterButton & Batch Logic (3 tasks)
- [ ] Phase 6: Integration & Testing (3 tasks)
- [ ] COORDINATION.md 更新
- [ ] コミット作成

---

## Notes for Implementing Agents

1. **File Backup**: 大きな変更前に `Section.MOC.tsx` のバックアップを推奨
2. **Incremental Testing**: 各Phase完了ごとにビルド確認
3. **Line Numbers**: 本ドキュメントの行番号は2026-02-04時点のもの。実装前に最新を確認
4. **Existing Functionality**: 既存の候補カード機能を壊さないよう注意
