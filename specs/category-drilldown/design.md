# Category Drilldown (Fukabori) Feature - Technical Design

## Overview
- **Feature Name**: Category Drilldown System
- **Status**: Implementation Complete
- **Version**: 1.0.0
- **Created**: 2026-02-04
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

---

## Architecture Overview

### Component Hierarchy

```
Manager Agent (manager-agent.ts)
  └── DrilldownController (NEW)
        ├── analyzeNeedsClassification() - 曖昧な質問かどうか判定
        ├── getCurrentDrilldownStep() - 現在のステップを取得
        ├── getNextQuickReplies() - 次の候補ボタンを生成
        └── delegateToSpecialist() - 専門エージェントに委譲

Frontend (Section.MOC.tsx)
  └── handleQuickReplyClick() - 候補ボタンクリック処理
        ├── detectDrilldownSelection() - 掘り下げ選択かどうか判定
        └── sendDrilldownMessage() - 掘り下げメッセージ送信
```

### State Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    Drilldown State Machine                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [Initial] ─────────────────────────────────────────────────►  │
│       │                                                         │
│       ▼ (曖昧な質問検出)                                         │
│   [Genre Selection] ──────────────────────────────────────────► │
│       │                                                         │
│       ▼ (ジャンル選択)                                           │
│   [Purpose Selection] ────────────────────────────────────────► │
│       │                                                         │
│       ▼ (目的選択)                                               │
│   [Response Type Selection] ──────────────────────────────────► │
│       │                                                         │
│       ▼ (回答の型選択)                                           │
│   [Delegate to Agent] ────────────────────────────────────────► │
│       │                                                         │
│       ▼                                                         │
│   [Complete] ◄──────────────────────────────────────────────────│
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Drilldown Step Enum

```typescript
// File: backend/src/agents/mastra/drilldown/types.ts (NEW)

export type DrilldownStep =
  | 'initial'
  | 'genre_selection'
  | 'purpose_selection'
  | 'response_type_selection'
  | 'complete';

export interface DrilldownState {
  step: DrilldownStep;
  genre?: string;
  purpose?: string;
  responseType?: string;
  customInput?: string;  // 「その他」選択時のカスタム入力
}
```

### Genre Categories

```typescript
// File: backend/src/agents/mastra/drilldown/categories.ts (NEW)

export interface GenreCategory {
  id: string;
  labelJa: string;
  labelEn: string;
  icon: string;
  purposes: PurposeOption[];
}

export interface PurposeOption {
  id: string;
  labelJa: string;
  labelEn: string;
}

export interface ResponseTypeOption {
  id: string;
  labelJa: string;
  labelEn: string;
  targetAgent: 'habit-coach' | 'goal-planner' | 'manager';
}

export const GENRE_CATEGORIES: GenreCategory[] = [
  {
    id: 'health',
    labelJa: '健康・運動',
    labelEn: 'Health & Fitness',
    icon: '💪',
    purposes: [
      { id: 'lose_weight', labelJa: '体重を減らしたい', labelEn: 'Want to lose weight' },
      { id: 'build_muscle', labelJa: '筋力をつけたい', labelEn: 'Want to build muscle' },
      { id: 'improve_health', labelJa: '体調を整えたい', labelEn: 'Want to improve health' },
      { id: 'reduce_stress', labelJa: 'ストレス解消', labelEn: 'Reduce stress' },
      { id: 'improve_sleep', labelJa: '睡眠を改善したい', labelEn: 'Want to improve sleep' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'career',
    labelJa: 'キャリア・仕事',
    labelEn: 'Career & Work',
    icon: '💼',
    purposes: [
      { id: 'get_promoted', labelJa: '昇進・昇格したい', labelEn: 'Want to get promoted' },
      { id: 'change_job', labelJa: '転職したい', labelEn: 'Want to change jobs' },
      { id: 'improve_skills', labelJa: 'スキルアップしたい', labelEn: 'Want to improve skills' },
      { id: 'productivity', labelJa: '生産性を上げたい', labelEn: 'Want to increase productivity' },
      { id: 'work_life_balance', labelJa: 'ワークライフバランス', labelEn: 'Work-life balance' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'learning',
    labelJa: '学習・スキル',
    labelEn: 'Learning & Skills',
    icon: '📚',
    purposes: [
      { id: 'new_language', labelJa: '新しい言語を学びたい', labelEn: 'Want to learn a new language' },
      { id: 'certification', labelJa: '資格を取りたい', labelEn: 'Want to get certified' },
      { id: 'programming', labelJa: 'プログラミングを学びたい', labelEn: 'Want to learn programming' },
      { id: 'reading', labelJa: '読書習慣をつけたい', labelEn: 'Want to build reading habit' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'hobby',
    labelJa: '趣味・創作',
    labelEn: 'Hobbies & Creation',
    icon: '🎨',
    purposes: [
      { id: 'start_hobby', labelJa: '新しい趣味を始めたい', labelEn: 'Want to start a new hobby' },
      { id: 'improve_hobby', labelJa: '趣味のスキルを上げたい', labelEn: 'Want to improve hobby skills' },
      { id: 'create_something', labelJa: '何か作りたい', labelEn: 'Want to create something' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'relationships',
    labelJa: '人間関係',
    labelEn: 'Relationships',
    icon: '🤝',
    purposes: [
      { id: 'family', labelJa: '家族との時間を増やしたい', labelEn: 'Want more family time' },
      { id: 'friends', labelJa: '友人関係を広げたい', labelEn: 'Want to expand friendships' },
      { id: 'communication', labelJa: 'コミュニケーション力を上げたい', labelEn: 'Want to improve communication' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'finance',
    labelJa: 'お金・資産',
    labelEn: 'Finance & Assets',
    icon: '💰',
    purposes: [
      { id: 'save_money', labelJa: '貯金を増やしたい', labelEn: 'Want to save more money' },
      { id: 'invest', labelJa: '投資を始めたい', labelEn: 'Want to start investing' },
      { id: 'reduce_expenses', labelJa: '支出を減らしたい', labelEn: 'Want to reduce expenses' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'lifestyle',
    labelJa: 'ライフスタイル',
    labelEn: 'Lifestyle',
    icon: '🏠',
    purposes: [
      { id: 'morning_routine', labelJa: '朝活を始めたい', labelEn: 'Want to start morning routine' },
      { id: 'organization', labelJa: '整理整頓したい', labelEn: 'Want to get organized' },
      { id: 'time_management', labelJa: '時間管理を改善したい', labelEn: 'Want to improve time management' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'other',
    labelJa: 'その他',
    labelEn: 'Other',
    icon: '❓',
    purposes: [
      { id: 'other', labelJa: '自由に入力', labelEn: 'Enter freely' },
    ],
  },
];

export const RESPONSE_TYPE_OPTIONS: ResponseTypeOption[] = [
  { id: 'habit_suggestion', labelJa: '具体的な習慣を提案', labelEn: 'Suggest specific habits', targetAgent: 'habit-coach' },
  { id: 'goal_setting', labelJa: '目標設定をサポート', labelEn: 'Support goal setting', targetAgent: 'goal-planner' },
  { id: 'information', labelJa: 'まず情報を知りたい', labelEn: 'Want information first', targetAgent: 'manager' },
  { id: 'advice', labelJa: 'アドバイスがほしい', labelEn: 'Want advice', targetAgent: 'manager' },
];
```

### QuickReply Extension for Drilldown

```typescript
// File: frontend/app/dashboard/components/Section.MOC.tsx (MODIFY)

// 既存のGroupChatMessage.quickRepliesに新しいselectionTypeを追加
export interface GroupChatMessage {
  // ... existing fields ...

  /** Selection type for quick replies */
  selectionType?:
    | 'habit_category'     // 既存
    | 'goal_category'      // 既存
    | 'difficulty'         // 既存
    | 'drilldown_genre'    // NEW: ジャンル選択
    | 'drilldown_purpose'  // NEW: 目的選択
    | 'drilldown_response_type';  // NEW: 回答の型選択
}
```

---

## Component Specifications

### 1. DrilldownController (NEW - Backend)

**File**: `backend/src/agents/mastra/drilldown/controller.ts`

**Purpose**: 掘り下げフローの制御とQuickReply生成

```typescript
export class DrilldownController {
  /**
   * クエリが曖昧で掘り下げが必要かどうかを判定
   */
  needsDrilldown(query: string, conversationHistory: ConversationMessage[]): boolean;

  /**
   * 現在の掘り下げステップを取得
   */
  getCurrentStep(conversationHistory: ConversationMessage[]): DrilldownStep;

  /**
   * 選択済みの掘り下げ状態を取得
   */
  getDrilldownState(conversationHistory: ConversationMessage[]): DrilldownState;

  /**
   * 次のステップのQuickRepliesを生成
   */
  generateQuickReplies(
    step: DrilldownStep,
    state: DrilldownState,
    locale: 'ja' | 'en'
  ): QuickReply[];

  /**
   * 掘り下げ完了後のプロンプトを生成
   */
  generateDelegationPrompt(state: DrilldownState, locale: 'ja' | 'en'): string;

  /**
   * 委譲先のエージェントを決定
   */
  getTargetAgent(state: DrilldownState): 'habit-coach' | 'goal-planner' | 'manager';
}
```

### 2. Manager Agent Extension

**File**: `backend/src/agents/mastra/agents/manager-agent.ts` (MODIFY)

```typescript
// Add drilldown handling to manager agent instructions
const MANAGER_INSTRUCTIONS_WITH_DRILLDOWN = `
あなたはVOW習慣・目標トラッカーのマネージャーAIです。

## 掘り下げモード（フカボリ）
ユーザーの質問が曖昧な場合（ジャンル、目的、回答の型が不明確）は、
掘り下げモードに入り、段階的に情報を収集します。

### 曖昧な質問の例
- 「何か新しいことを始めたい」
- 「もっと良い生活を送りたい」
- 「自分を変えたい」
- 「習慣を作りたい」（具体性なし）

### 掘り下げフロー
1. ジャンルを確認（候補ボタンで提示）
2. 目的を確認（候補ボタンで提示）
3. 回答の型を確認（候補ボタンで提示）
4. 適切なエージェントに引き継ぎ

### 重要
- 必ず候補ボタンを使用して選択肢を提示
- テキストのみの応答は避ける
- 「その他」オプションも用意する
`;
```

### 3. drilldownAnalysisTool (NEW)

**File**: `backend/src/agents/mastra/drilldown/tools.ts`

```typescript
export const drilldownAnalysisTool = createTool({
  id: 'drilldown_analysis',
  description: 'Analyze if a query needs category drilldown and generate appropriate quick replies',
  inputSchema: z.object({
    query: z.string().describe('User query to analyze'),
    conversationHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).optional(),
    locale: z.enum(['ja', 'en']).default('ja'),
  }),
  outputSchema: z.object({
    needsDrilldown: z.boolean(),
    currentStep: z.enum(['initial', 'genre_selection', 'purpose_selection', 'response_type_selection', 'complete']),
    drilldownState: z.object({
      step: z.string(),
      genre: z.string().optional(),
      purpose: z.string().optional(),
      responseType: z.string().optional(),
    }),
    quickReplies: z.array(z.object({
      id: z.string(),
      label: z.string(),
      value: z.string(),
      icon: z.string().optional(),
    })),
    message: z.string().describe('Message to display to user'),
    selectionType: z.enum([
      'drilldown_genre',
      'drilldown_purpose',
      'drilldown_response_type',
    ]).optional(),
    targetAgent: z.enum(['habit-coach', 'goal-planner', 'manager']).optional(),
  }),
  execute: async (input) => {
    const controller = new DrilldownController();
    // Implementation details...
  },
});
```

---

## Frontend Integration

### QuickReply Click Handler Extension

```typescript
// File: frontend/app/dashboard/components/Section.MOC.tsx (MODIFY Line ~970)

const handleQuickReplyClick = useCallback((value: string, label: string) => {
  const lastMessageWithQuickReplies = [...messages].reverse().find(m => m.quickReplies && m.quickReplies.length > 0);
  const selectionType = lastMessageWithQuickReplies?.selectionType;

  // Handle drilldown selections
  if (selectionType?.startsWith('drilldown_')) {
    // For drilldown, send the selection as a structured message
    // The backend will interpret this and continue the drilldown flow
    const drilldownMessage = JSON.stringify({
      type: 'drilldown_selection',
      selectionType,
      value,
      label,
    });

    // Send as user message (will be interpreted by manager agent)
    setInputValue(label);
    handleSend();
    return;
  }

  // ... existing category selection handling ...
}, [messages, handleSend]);
```

### QuickReply Rendering for Drilldown

候補ボタンのレンダリングは既存の実装を使用（Line ~3087）。
`selectionType` が `drilldown_*` の場合も同じボタンスタイルを適用。

---

## API Changes

### Multi-Agent Chat Response Extension

```typescript
// Response now includes drilldown state
interface MultiAgentChatResponse {
  // ... existing fields ...

  // NEW: Drilldown information
  drilldown?: {
    active: boolean;
    currentStep: DrilldownStep;
    state: DrilldownState;
  };
}
```

---

## Message Flow Example

```
┌─────────────────────────────────────────────────────────────────┐
│ User: 「何か新しいことを始めたい」                                │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Manager Agent:                                                   │
│   1. drilldownAnalysisTool() → needsDrilldown: true             │
│   2. currentStep: 'genre_selection'                              │
│   3. Generate response with quickReplies                         │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ AI Response:                                                     │
│   「素晴らしいですね！どんな分野に興味がありますか？」             │
│                                                                  │
│   [💪 健康・運動] [💼 キャリア・仕事] [📚 学習・スキル]           │
│   [🎨 趣味・創作] [🤝 人間関係] [❓ その他]                       │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ User clicks: [💪 健康・運動]                                     │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Manager Agent:                                                   │
│   1. drilldownAnalysisTool() → currentStep: 'purpose_selection' │
│   2. state.genre = 'health'                                      │
│   3. Generate purpose quickReplies for health category           │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ AI Response:                                                     │
│   「健康・運動に興味があるんですね！具体的にはどうなりたいですか？」│
│                                                                  │
│   [体重を減らしたい] [筋力をつけたい] [体調を整えたい]            │
│   [ストレス解消] [睡眠を改善したい] [その他]                      │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
... (continues until response_type_selection) ...
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Manager Agent:                                                   │
│   1. currentStep: 'complete'                                     │
│   2. state = { genre: 'health', purpose: 'lose_weight',         │
│               responseType: 'habit_suggestion' }                 │
│   3. Delegate to habit-coach with full context                   │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Habit Coach Agent:                                               │
│   「体重を減らすための具体的な習慣を提案しますね！」              │
│                                                                  │
│   [📝 毎朝体重を測る (Habit)]                                    │
│   [📝 1日8000歩歩く (Habit)]                                     │
│   [📝 夕食は19時までに済ませる (Habit)]                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/agents/mastra/drilldown/types.ts` | NEW | Type definitions |
| `backend/src/agents/mastra/drilldown/categories.ts` | NEW | Category data |
| `backend/src/agents/mastra/drilldown/controller.ts` | NEW | DrilldownController class |
| `backend/src/agents/mastra/drilldown/tools.ts` | NEW | drilldownAnalysisTool |
| `backend/src/agents/mastra/drilldown/index.ts` | NEW | Module exports |
| `backend/src/agents/mastra/agents/manager-agent.ts` | MODIFY | Add drilldown tool and instructions |
| `frontend/app/dashboard/components/Section.MOC.tsx` | MODIFY | Add drilldown selectionTypes |

---

## Testing Strategy

### Unit Tests
- DrilldownController: needsDrilldown判定
- DrilldownController: QuickReply生成
- DrilldownController: 状態遷移

### Integration Tests
- Manager Agent + DrilldownController連携
- フロントエンド候補ボタン表示

### E2E Tests
- 完全な掘り下げフロー（ジャンル→目的→回答の型→提案）
- 「その他」選択時のカスタム入力
