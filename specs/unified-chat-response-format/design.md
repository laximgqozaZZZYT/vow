# Unified Chat Response Format - Design Document

## Overview

- **Purpose**: バックエンド/フロントエンドの詳細設計と変更箇所の特定
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2025-02-05
- **Author**: vow-spec-architect

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js)                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Section.MOC.tsx                               │   │
│  │  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐  │   │
│  │  │ useMastra   │  │ useMcpChat       │  │ ResponseParser    │  │   │
│  │  │ Agent       │  │                  │  │ (Unified)         │  │   │
│  │  └──────┬──────┘  └────────┬─────────┘  └─────────┬─────────┘  │   │
│  │         │                  │                      │            │   │
│  │         └──────────────────┴──────────────────────┘            │   │
│  │                            │                                    │   │
│  │                   ┌────────▼────────┐                          │   │
│  │                   │ GroupChatMessage│                          │   │
│  │                   │ (Unified Type)  │                          │   │
│  │                   └────────┬────────┘                          │   │
│  │                            │                                    │   │
│  │    ┌───────────────────────┼───────────────────────┐           │   │
│  │    │                       │                       │           │   │
│  │ ┌──▼───┐  ┌───────▼───────┐  ┌──────▼──────┐     │   │
│  │ │Button│  │QuickReply     │  │FollowUp    │            │   │
│  │ │List  │  │Buttons        │  │Actions     │            │   │
│  │ └──────┘  └───────────────┘  └────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Backend (Lambda)                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   vow-coach-agent.ts                             │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │                  Tool Execution                          │   │   │
│  │  │  suggest_habits → suggestHabitsExecute()                │   │   │
│  │  │  suggest_goals  → suggestGoalsExecute()                 │   │   │
│  │  │  show_category_selection → showCategorySelectionExecute()│   │   │
│  │  │  show_choice_buttons → showChoiceButtonsExecute()       │   │   │
│  │  └──────────────────────────┬──────────────────────────────┘   │   │
│  │                             │                                   │   │
│  │                    ┌────────▼────────┐                         │   │
│  │                    │ Response        │                         │   │
│  │                    │ Transformer     │  ← NEW                  │   │
│  │                    │ (to Unified)    │                         │   │
│  │                    └────────┬────────┘                         │   │
│  │                             │                                   │   │
│  │                    ┌────────▼────────┐                         │   │
│  │                    │ UnifiedResponse │                         │   │
│  │                    │ JSON            │                         │   │
│  │                    └─────────────────┘                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Backend Design

### 1. Type Definitions (新規作成)

**Location:** `/home/ubuntu/Downloads/vow/backend/src/types/unified-response.ts`

```typescript
/**
 * Unified Response Format for MOC Chat
 *
 * すべてのAIエージェント応答をこの形式に統一
 */

// Entity Type
export type UnifiedEntityType = 'Habit' | 'Goal' | "Sticky'n(MEMO)" | 'others' | null;

// Operation Type
export type UnifiedOperationType = '見直し' | '新規提案' | '確認' | 'アドバイス' | 'others' | null;

// Button Type
export type UnifiedButtonType = 'Habit' | 'Goal' | "Sticky'n(MEMO)" | 'reply';

// User Info Context
export interface UnifiedUserInfo {
  about_type: UnifiedEntityType;
  about_operation: UnifiedOperationType;
  about_category: string[];
}

// Habit Detail
// @see Habit interface in frontend/app/dashboard/types/index.ts
export interface UnifiedHabitDetail {
  type: 'Habit';
  name: string;
  // DB schema fields
  habitType?: 'do' | 'avoid';  // Maps to CreateHabitPayload.type
  must?: number;               // 目標回数
  duration?: number;           // 所要時間（分）
  repeat?: string;             // 繰り返し設定
  time?: string;               // 開始時刻 (HH:MM)
  endTime?: string;            // 終了時刻 (HH:MM)
  dueDate?: string;            // 期限 (YYYY-MM-DD)
  allDay?: boolean;            // 終日フラグ
  notes?: string;              // メモ
  workloadUnit?: string;       // 負荷の単位
  workloadTotal?: number;      // 負荷の総量
  workloadPerCount?: number;   // 1回あたりの負荷
  timings?: Timing[];          // スケジュール情報
  // Suggestion-specific fields
  frequency?: string;          // 頻度の説明（AI提案用）
  reason?: string;             // 推奨理由（AI提案用）
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  triggerTime?: string;
  anchorHabit?: string;
}

// Goal Detail
// @see Goal interface in frontend/app/dashboard/types/index.ts
export interface UnifiedGoalDetail {
  type: 'Goal';
  name: string;
  // DB schema fields
  details?: string;            // NOTE: NOT "description" - matches Goal.details
  dueDate?: string;            // NOTE: NOT "deadline" - matches Goal.dueDate
  parentId?: string | null;    // 親ゴールID
  isCompleted?: boolean;
  // Suggestion-specific fields
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  suggestedHabits?: string[];
  rationale?: string;
  milestones?: Array<{
    name: string;
    description?: string;
    targetDate?: string;
  }>;
}

// Sticky'n Detail
// @see Sticky interface in frontend/app/dashboard/types/index.ts
export interface UnifiedStickyDetail {
  type: "Sticky'n(MEMO)";
  name: string;
  // DB schema fields
  description?: string | null;
  completed?: boolean;
  displayOrder?: number;       // NOTE: camelCase - NOT "display_order"
  parentStickyId?: string | null;
  depth?: number;              // ネストの深さ (0-2)
  isReusable?: boolean;
}

// Reply Detail (for navigation/actions)
export interface UnifiedReplyDetail {
  action: string;  // 'select_category', 'select_choice', 'easier', 'harder', etc.
  category?: string;
  choiceId?: string;
  icon?: string;
  [key: string]: unknown;  // 拡張可能
}

// Button Definition
export interface UnifiedButton {
  type: UnifiedButtonType;
  label: string;
  comment?: string | null;
  detail?: UnifiedHabitDetail | UnifiedGoalDetail | UnifiedStickyDetail | UnifiedReplyDetail;
}

// Full Response
export interface UnifiedChatResponse {
  message: string;
  userInfo: UnifiedUserInfo;
  buttons: UnifiedButton[];
}
```

### 2. Response Transformer (新規作成)

**Location:** `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/response-transformer.ts`

```typescript
import type { UnifiedChatResponse, UnifiedButton, UnifiedUserInfo } from '../../types/unified-response.js';
import type {
  GoalSuggestionResult,
  HabitSuggestionResult,
  CategorySelectionResult,
  ChoiceButtonsResult,
  AdviceResult,
  HabitImprovementResult,
} from './coach-tools.js';

/**
 * Transform suggest_habits result to unified format
 */
export function transformHabitSuggestions(
  result: HabitSuggestionResult,
  message: string,
  category?: string
): UnifiedChatResponse {
  const buttons: UnifiedButton[] = [];

  // Add habit suggestion buttons
  for (const suggestion of result.suggestions) {
    buttons.push({
      type: 'Habit',
      label: suggestion.name,
      comment: suggestion.description,
      detail: {
        type: 'Habit',
        name: suggestion.name,
        habitType: suggestion.frequency === 'daily' ? 'daily' :
                   suggestion.frequency === 'weekly' ? 'weekly' : 'daily',
        description: suggestion.description,
        category: suggestion.category,
        difficulty: suggestion.difficulty,
      }
    });
  }

  // Add follow-up action buttons
  if (result.followUpActions) {
    for (const action of result.followUpActions) {
      buttons.push({
        type: 'reply',
        label: action.label,
        comment: null,
        detail: {
          action: action.action,
          category: action.category,
        }
      });
    }
  }

  return {
    message,
    userInfo: {
      about_type: 'Habit',
      about_operation: '新規提案',
      about_category: category ? [category] : [],
    },
    buttons,
  };
}

/**
 * Transform suggest_goals result to unified format
 */
export function transformGoalSuggestions(
  result: GoalSuggestionResult,
  message: string,
  category?: string
): UnifiedChatResponse {
  const buttons: UnifiedButton[] = [];

  for (const suggestion of result.suggestions) {
    buttons.push({
      type: 'Goal',
      label: suggestion.name,
      comment: suggestion.description,
      detail: {
        type: 'Goal',
        name: suggestion.name,
        details: suggestion.description,
        category: suggestion.category,
        difficulty: suggestion.difficulty,
        estimatedDuration: suggestion.estimatedDuration,
        suggestedHabits: suggestion.suggestedHabits,
      }
    });
  }

  if (result.followUpActions) {
    for (const action of result.followUpActions) {
      buttons.push({
        type: 'reply',
        label: action.label,
        comment: null,
        detail: {
          action: action.action,
          category: action.category,
        }
      });
    }
  }

  return {
    message,
    userInfo: {
      about_type: 'Goal',
      about_operation: '新規提案',
      about_category: category ? [category] : [],
    },
    buttons,
  };
}

/**
 * Transform show_category_selection result to unified format
 */
export function transformCategorySelection(
  result: CategorySelectionResult
): UnifiedChatResponse {
  const isGoal = result.selectionType === 'goal_category';
  const buttons: UnifiedButton[] = [];

  for (const qr of result.quickReplies) {
    buttons.push({
      type: 'reply',
      label: qr.label,
      comment: null,
      detail: {
        action: 'select_category',
        category: qr.value,
        icon: qr.icon,
      }
    });
  }

  return {
    message: result.message,
    userInfo: {
      about_type: isGoal ? 'Goal' : 'Habit',
      about_operation: '新規提案',
      about_category: [],
    },
    buttons,
  };
}

/**
 * Transform show_choice_buttons result to unified format
 */
export function transformChoiceButtons(
  result: ChoiceButtonsResult
): UnifiedChatResponse {
  const buttons: UnifiedButton[] = [];

  for (const choice of result.data.choices) {
    buttons.push({
      type: choice.type === 'habit' ? 'Habit' :
            choice.type === 'goal' ? 'Goal' :
            choice.type === 'stickyn' ? "Sticky'n(MEMO)" : 'reply',
      label: choice.label,
      comment: choice.description || null,
      detail: {
        action: 'select_choice',
        choiceId: choice.id,
        icon: choice.icon,
      }
    });
  }

  return {
    message: result.data.title,
    userInfo: {
      about_type: null,
      about_operation: null,
      about_category: [],
    },
    buttons,
  };
}

/**
 * Transform generate_advice result to unified format
 */
export function transformAdvice(
  result: AdviceResult
): UnifiedChatResponse {
  const message = `${result.advice}\n\n**Key Insight:** ${result.keyInsight}\n\n${result.motivation}`;

  const buttons: UnifiedButton[] = [];

  for (const action of result.followUpActions) {
    buttons.push({
      type: 'reply',
      label: action.label,
      comment: null,
      detail: {
        action: action.action,
      }
    });
  }

  return {
    message,
    userInfo: {
      about_type: 'others',
      about_operation: 'アドバイス',
      about_category: [],
    },
    buttons,
  };
}

/**
 * Auto-detect and transform any tool result to unified format
 */
export function transformToUnified(
  toolName: string,
  toolResult: unknown,
  customMessage?: string
): UnifiedChatResponse | null {
  switch (toolName) {
    case 'suggest_habits':
    case 'refine_suggestions':
      return transformHabitSuggestions(
        toolResult as HabitSuggestionResult,
        customMessage || '習慣を提案します。',
      );

    case 'suggest_goals':
      return transformGoalSuggestions(
        toolResult as GoalSuggestionResult,
        customMessage || '目標を提案します。',
      );

    case 'show_category_selection':
      return transformCategorySelection(toolResult as CategorySelectionResult);

    case 'show_choice_buttons':
      return transformChoiceButtons(toolResult as ChoiceButtonsResult);

    case 'generate_advice':
      return transformAdvice(toolResult as AdviceResult);

    default:
      return null;
  }
}
```

### 3. Tool Execution Wrapper (変更箇所)

**Location:** `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`

ツール実行後にレスポンス変換を適用するラッパーを追加:

```typescript
// 既存のツール実行後に変換を適用
async function executeToolWithTransform(
  toolName: string,
  toolInput: unknown,
  context: CoachExecutionContext
): Promise<{ raw: unknown; unified: UnifiedChatResponse | null }> {
  // 既存のツール実行
  const raw = await executeToolRaw(toolName, toolInput, context);

  // 統一形式に変換
  const unified = transformToUnified(toolName, raw);

  return { raw, unified };
}
```

### 4. Backend Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/types/unified-response.ts` | NEW | 統一レスポンス型定義 |
| `backend/src/agents/shared-tools/response-transformer.ts` | NEW | 変換関数群 |
| `backend/src/agents/shared-tools/index.ts` | MODIFY | 新規エクスポート追加 |
| `backend/src/agents/mastra/vow-coach-agent.ts` | MODIFY | ツール実行後に変換適用 |
| `backend/src/agents/shared-tools/coach-tools.ts` | MODIFY | 各ツールの出力にunifiedフィールド追加（オプション） |

## Frontend Design

### 1. Type Definitions (新規/更新)

**Location:** `/home/ubuntu/Downloads/vow/frontend/app/dashboard/types/unified-response.ts`

```typescript
// バックエンドと同じ型定義をフロントエンド用に用意
// (共有パッケージがない場合はコピー)

export type UnifiedEntityType = 'Habit' | 'Goal' | "Sticky'n(MEMO)" | 'others' | null;
export type UnifiedOperationType = '見直し' | '新規提案' | '確認' | 'アドバイス' | 'others' | null;
export type UnifiedButtonType = 'Habit' | 'Goal' | "Sticky'n(MEMO)" | 'reply';

// ... (残りは requirements.md と同じ)
```

### 2. Response Parser (変更)

**Location:** `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

既存のパーサー関数を統一形式対応に更新:

```typescript
/**
 * Parse unified response format or legacy tool call format
 *
 * 統一形式を優先し、フォールバックとして旧形式をサポート
 */
function parseResponse(msg: MastraMessage): ParsedResponse {
  // 1. Check for unified format in tool output
  for (const toolCall of msg.toolCalls || []) {
    const output = toolCall.output as Record<string, unknown>;

    // Unified format detection
    if (output?.userInfo && output?.buttons && typeof output?.message === 'string') {
      return parseUnifiedResponse(output as UnifiedChatResponse);
    }
  }

  // 2. Fallback to legacy parsers
  return {
    suggestions: parseSuggestions(msg),
    quickReplies: parseQuickReplies(msg),
    followUpActions: parseFollowUpActions(msg),
  };
}

/**
 * Parse unified response to GroupChatMessage properties
 */
function parseUnifiedResponse(response: UnifiedChatResponse): ParsedResponse {
  const suggestions: GroupChatMessage['suggestions'] = [];
  const quickReplies: GroupChatMessage['quickReplies'] = [];
  const followUpActions: GroupChatMessage['followUpActions'] = [];

  for (const button of response.buttons) {
    if (button.type === 'Habit') {
      suggestions.push({
        type: 'habit',
        suggestionType: 'habit',
        data: button.detail || { name: button.label },
        actions: getDefaultActions(),
      });
    } else if (button.type === 'Goal') {
      suggestions.push({
        type: 'goal',
        suggestionType: 'goal',
        data: button.detail || { name: button.label },
        actions: getDefaultActions(),
      });
    } else if (button.type === "Sticky'n(MEMO)") {
      suggestions.push({
        type: 'goal', // Will open sticky modal based on suggestionType
        suggestionType: 'stickyn',
        data: button.detail || { name: button.label },
        actions: getDefaultActions(),
      });
    } else if (button.type === 'reply') {
      const detail = button.detail as UnifiedReplyDetail | undefined;

      if (detail?.action === 'select_category') {
        quickReplies.push({
          id: detail.category || button.label,
          label: button.label,
          value: detail.category || button.label,
          icon: detail.icon,
        });
      } else if (isFollowUpAction(detail?.action)) {
        followUpActions.push({
          id: detail?.action || button.label,
          label: button.label,
          action: detail?.action as RefineActionType,
          category: detail?.category,
        });
      } else {
        // Generic reply button → quickReply
        quickReplies.push({
          id: detail?.choiceId || button.label,
          label: button.label,
          value: detail?.choiceId || button.label,
          icon: detail?.icon,
        });
      }
    }
  }

  // Determine selectionType from userInfo
  let selectionType: GroupChatMessage['selectionType'] = undefined;
  if (response.userInfo.about_type === 'Habit' && quickReplies.length > 0) {
    selectionType = 'habit_category';
  } else if (response.userInfo.about_type === 'Goal' && quickReplies.length > 0) {
    selectionType = 'goal_category';
  }

  return {
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
    followUpActions: followUpActions.length > 0 ? followUpActions : undefined,
    selectionType,
    userInfo: response.userInfo, // 追加: userInfoを保持
  };
}

function isFollowUpAction(action?: string): boolean {
  const followUpActions = [
    'more_specific', 'more_general', 'easier', 'harder',
    'different', 'more_suggestions', 'different_habit',
    'more_advice', 'deeper', 'different_angle', 'action_plan'
  ];
  return action ? followUpActions.includes(action) : false;
}

function getDefaultActions() {
  return [
    { id: 'accept', label: '採用', variant: 'primary' as const },
    { id: 'snooze', label: '後で', variant: 'secondary' as const },
    { id: 'dismiss', label: '不要', variant: 'ghost' as const },
  ];
}
```

### 3. Button Click Handler Updates

**Location:** `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

```typescript
/**
 * Handle unified button click
 */
const handleUnifiedButtonClick = useCallback((
  button: UnifiedButton,
  messageId: string
) => {
  if (button.type === 'Habit') {
    // Open HabitModal with pre-filled data
    const detail = button.detail as UnifiedHabitDetail | undefined;
    setHabitModalInitial({
      name: detail?.name || button.label,
      type: detail?.habitType === 'quit' ? 'avoid' : 'do',
      description: detail?.description,
      // ... other fields
    });
    setHabitModalOpen(true);
  } else if (button.type === 'Goal') {
    // Open GoalModal with pre-filled data
    const detail = button.detail as UnifiedGoalDetail | undefined;
    setGoalModalInitial({
      name: detail?.name || button.label,
      details: detail?.details,
      // ... other fields
    });
    setGoalModalOpen(true);
  } else if (button.type === "Sticky'n(MEMO)") {
    // Open StickyModal with pre-filled data
    const detail = button.detail as UnifiedStickyDetail | undefined;
    setStickyModalInitial({
      id: '',
      name: detail?.name || button.label,
      content: detail?.content,
      // ... other fields
    } as Sticky);
    setStickyModalOpen(true);
  } else if (button.type === 'reply') {
    // Send reply message to AI
    const detail = button.detail as UnifiedReplyDetail | undefined;
    if (detail?.action === 'select_category') {
      handleQuickReplyClick(detail.category || '', button.label);
    } else {
      handleFollowUpActionClick(
        detail?.action as RefineActionType || 'different',
        detail?.category
      );
    }
  }
}, [handleQuickReplyClick, handleFollowUpActionClick]);
```

### 4. Frontend Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/app/dashboard/types/unified-response.ts` | NEW | 統一レスポンス型定義 |
| `frontend/app/dashboard/components/Section.MOC.tsx` | MODIFY | パーサー・ハンドラー更新 |
| `frontend/app/dashboard/types/index.ts` | MODIFY | 新規型のエクスポート |

## MCP Server Compatibility

### MCP Claude Code Agent

MCPサーバー経由のClaudeも同じ形式を出力するよう、プロンプトに統一形式の指示を追加:

**System Prompt Addition:**
```
## Response Format

All responses MUST include a JSON block in the following unified format:

```json
{
  "message": "Your main response text here",
  "userInfo": {
    "about_type": null | "Habit" | "Goal" | "Sticky'n(MEMO)" | "others",
    "about_operation": null | "見直し" | "新規提案" | "確認" | "アドバイス" | "others",
    "about_category": ["category1"]
  },
  "buttons": [
    {
      "type": "Habit" | "Goal" | "Sticky'n(MEMO)" | "reply",
      "label": "Button label",
      "comment": "Optional description",
      "detail": { ... }
    }
  ]
}
```
```

### Fallback Handling

MCPからのレスポンスが統一形式でない場合のフォールバック:

```typescript
function parseMcpResponse(content: string): UnifiedChatResponse | null {
  // Try to extract JSON from markdown code block
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (isUnifiedResponse(parsed)) {
        return parsed;
      }
    } catch {
      // Invalid JSON, fall through
    }
  }

  // Return null to trigger legacy parsing
  return null;
}

function isUnifiedResponse(obj: unknown): obj is UnifiedChatResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'message' in obj &&
    'userInfo' in obj &&
    'buttons' in obj
  );
}
```

## Migration Strategy

### Phase 1: Preparation (準備)

1. 型定義ファイルの作成 (backend/frontend)
2. Response Transformer の実装
3. 統一パーサーの実装 (両形式対応)

### Phase 2: Backend Integration (バックエンド統合)

1. 各ツールの execute 関数に変換処理を追加
2. ツール出力に `_unified` フィールドを追加（オプション）
3. テストで両形式の出力を検証

### Phase 3: Frontend Integration (フロントエンド統合)

1. 統一パーサーを有効化
2. 旧形式パーサーをフォールバックとして維持
3. ボタンクリックハンドラーを更新

### Phase 4: Cleanup (クリーンアップ)

1. 旧形式のパーサーを削除
2. デバッグログを整理
3. ドキュメント更新

## Testing Strategy

### Unit Tests

```typescript
// backend/src/agents/shared-tools/__tests__/response-transformer.test.ts

describe('transformHabitSuggestions', () => {
  it('should transform habit suggestions to unified format', () => {
    const input: HabitSuggestionResult = {
      suggestions: [{
        name: '朝の5分ストレッチ',
        description: 'テスト',
        category: 'health',
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: '5分',
        estimatedDuration: '2週間',
        rationale: 'テスト',
        suggestionType: 'habit',
      }],
      followUpActions: [],
    };

    const result = transformHabitSuggestions(input, 'テストメッセージ', 'health');

    expect(result.message).toBe('テストメッセージ');
    expect(result.userInfo.about_type).toBe('Habit');
    expect(result.buttons).toHaveLength(1);
    expect(result.buttons[0].type).toBe('Habit');
  });
});
```

### Integration Tests

```typescript
// frontend/app/dashboard/components/__tests__/Section.MOC.integration.test.tsx

describe('MOCSection unified response', () => {
  it('should parse unified response and display buttons', async () => {
    const unifiedResponse: UnifiedChatResponse = {
      message: 'テスト',
      userInfo: { about_type: 'Habit', about_operation: '新規提案', about_category: [] },
      buttons: [
        { type: 'Habit', label: 'テスト習慣', comment: null, detail: { type: 'Habit', name: 'テスト習慣', habitType: 'daily' } }
      ],
    };

    // Mock tool call with unified response
    // ...

    // Assert buttons are rendered
    // ...
  });
});
```

## Rollback Plan

問題発生時のロールバック手順:

1. フロントエンドの統一パーサーを無効化 (フラグで切り替え)
2. バックエンドの変換処理をスキップ (環境変数で制御)
3. 旧形式のパーサーにフォールバック

```typescript
// Feature flag
const USE_UNIFIED_FORMAT = process.env.NEXT_PUBLIC_USE_UNIFIED_FORMAT === 'true';

function parseResponse(msg: MastraMessage): ParsedResponse {
  if (USE_UNIFIED_FORMAT) {
    // Try unified first
    const unified = tryParseUnified(msg);
    if (unified) return unified;
  }

  // Legacy parsing
  return parseLegacy(msg);
}
```
