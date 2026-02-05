# MOCセクション チャット候補ボタン機能改善 - 設計書

## Overview

- **Purpose**: チャット候補ボタン機能の技術設計とアーキテクチャ
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect
- **Related Requirements**: `requirements.md`

## Architecture (アーキテクチャ)

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (localhost:3000)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        Section.MOC.tsx                            │   │
│  │  ┌────────────┐  ┌─────────────────┐  ┌────────────────────┐     │   │
│  │  │ ChatArea   │  │ CandidateCards  │  │ QuestionFlowPanel  │     │   │
│  │  │            │  │                 │  │                    │     │   │
│  │  │ - Messages │  │ - HabitCard     │  │ - Step Indicator   │     │   │
│  │  │ - Input    │  │ - GoalCard      │  │ - Category Buttons │     │   │
│  │  │            │  │ - StickyNCard   │  │ - SubCat Buttons   │     │   │
│  │  │            │  │ - ReplyButton   │  │                    │     │   │
│  │  └────────────┘  └─────────────────┘  └────────────────────┘     │   │
│  │                                                                   │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │                  ResponseParser (New)                       │  │   │
│  │  │  - parseUnifiedResponse()                                   │  │   │
│  │  │  - convertToGroupChatMessage()                              │  │   │
│  │  │  - validateButtonSchema()                                   │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Hooks Layer                                    │   │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐   │   │
│  │  │useMastraAgent│  │  useMcpChat   │  │useQuestionFlow (New) │   │   │
│  │  └──────────────┘  └───────────────┘  └──────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │ HTTP/WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Backend (localhost:4000)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    AI Agent Layer                                 │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │   │
│  │  │ ManagerAgent    │  │  VowCoachAgent   │  │  GoalPlanner    │  │   │
│  │  │ (Orchestrator)  │  │  (Habit Expert)  │  │  (Goal Expert)  │  │   │
│  │  └─────────────────┘  └──────────────────┘  └─────────────────┘  │   │
│  │             │                   │                   │             │   │
│  │             └───────────────────┼───────────────────┘             │   │
│  │                                 ▼                                 │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │           ResponseFormatter (New)                           │  │   │
│  │  │  - formatUnifiedResponse()                                  │  │   │
│  │  │  - ensureButtonsPresent()                                   │  │   │
│  │  │  - trackUserInfo()                                          │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Tool Layer                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │  show_candidate_buttons (New)                                │ │   │
│  │  │  - Required: type[], label[], comment?[], detail?[]          │ │   │
│  │  │  - Validation: At least 1 button required                    │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │  show_question_flow (New)                                    │ │   │
│  │  │  - step: 'info_type' | 'category' | 'subcategory'            │ │   │
│  │  │  - options: ReplyButton[]                                    │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow (データフロー)

```
User Input
    │
    ▼
┌─────────────────┐
│  Section.MOC    │ ─── inputValue → handleSendMessage()
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ activeAgent.    │ ─── HTTP POST /api/agents/chat
│ sendMessage()   │     (with userInfo context)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Backend AI      │ ─── Process with LLM (OpenAI/Claude)
│ Agent           │     Execute tools
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ ResponseFormatter│ ─── Ensure buttons present
│ (New)           │     Format to unified JSON
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Stream/Response │ ─── SSE or JSON response
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ ResponseParser  │ ─── Parse unified JSON
│ (New)           │     Convert to GroupChatMessage
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Section.MOC     │ ─── Update messages state
│ (render)        │     Render CandidateCards
└─────────────────┘
```

## Component Design (コンポーネント設計)

### Frontend Components

#### 1. CandidateCard Component (New)

```typescript
// frontend/app/dashboard/components/CandidateCard.tsx

interface CandidateCardProps {
  button: UnifiedButton;
  onAccept: (button: UnifiedButton) => void;
  onReject: (button: UnifiedButton) => void;
  onDetail: (button: UnifiedButton) => void;
  locale: 'ja' | 'en';
}

export function CandidateCard({
  button,
  onAccept,
  onReject,
  onDetail,
  locale,
}: CandidateCardProps) {
  const isEntityType = ['Habit', 'Goal', 'Sticky\'n(MEMO)'].includes(button.type);

  return (
    <div className="candidate-card">
      {/* Card Header */}
      <div className="candidate-card-header">
        <span className="type-badge">{getTypeBadge(button.type, locale)}</span>
        <span className="label">{button.label}</span>
      </div>

      {/* Card Body */}
      {button.comment && (
        <div className="candidate-card-body">
          <p className="comment">{button.comment}</p>
        </div>
      )}

      {/* Card Actions */}
      <div className="candidate-card-actions">
        {isEntityType ? (
          <>
            <button onClick={() => onAccept(button)} className="btn-accept">
              {locale === 'ja' ? '採用' : 'Accept'}
            </button>
            <button onClick={() => onReject(button)} className="btn-reject">
              {locale === 'ja' ? '却下' : 'Reject'}
            </button>
            <button onClick={() => onDetail(button)} className="btn-detail">
              {locale === 'ja' ? '詳細' : 'Detail'}
            </button>
          </>
        ) : (
          // Reply type: single click action
          <button
            onClick={() => onAccept(button)}
            className="btn-reply"
          >
            {button.label}
          </button>
        )}
      </div>
    </div>
  );
}
```

#### 2. QuestionFlowIndicator Component (New)

```typescript
// frontend/app/dashboard/components/QuestionFlowIndicator.tsx

interface QuestionFlowIndicatorProps {
  currentStep: QuestionFlowStep;
  userInfo: UserInfoContext;
  locale: 'ja' | 'en';
}

type QuestionFlowStep = 'info_type' | 'category' | 'subcategory' | 'complete';

export function QuestionFlowIndicator({
  currentStep,
  userInfo,
  locale,
}: QuestionFlowIndicatorProps) {
  const steps = [
    { id: 'info_type', label: locale === 'ja' ? '情報種類' : 'Info Type' },
    { id: 'category', label: locale === 'ja' ? 'カテゴリ' : 'Category' },
    { id: 'subcategory', label: locale === 'ja' ? '詳細' : 'Detail' },
  ];

  return (
    <div className="question-flow-indicator">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={`step ${step.id === currentStep ? 'active' : ''} ${
            getStepIndex(currentStep) > index ? 'completed' : ''
          }`}
        >
          <span className="step-number">{index + 1}</span>
          <span className="step-label">{step.label}</span>
        </div>
      ))}
    </div>
  );
}
```

#### 3. RefineButtonGroup Component (New)

```typescript
// frontend/app/dashboard/components/RefineButtonGroup.tsx

interface RefineButtonGroupProps {
  onRefine: (action: 'more_specific' | 'more_general') => void;
  locale: 'ja' | 'en';
}

export function RefineButtonGroup({ onRefine, locale }: RefineButtonGroupProps) {
  return (
    <div className="refine-button-group">
      <button
        onClick={() => onRefine('more_specific')}
        className="btn-refine"
      >
        {locale === 'ja' ? 'もっと具体的に' : 'More Specific'}
      </button>
      <button
        onClick={() => onRefine('more_general')}
        className="btn-refine"
      >
        {locale === 'ja' ? 'もっと一般的に' : 'More General'}
      </button>
    </div>
  );
}
```

### Type Definitions

#### Unified Response Types

```typescript
// frontend/app/dashboard/types/candidate-button.types.ts

/**
 * Button type enumeration
 */
export type ButtonType = 'Habit' | 'Goal' | 'Sticky\'n(MEMO)' | 'reply';

/**
 * User info context for conversation tracking
 */
export interface UserInfoContext {
  about_type: 'None' | 'Habit' | 'Goal' | 'Sticky\'n(MEMO)' | 'others';
  about_operation: 'None' | '見直し' | '新規提案' | '確認' | 'アドバイス' | 'others';
  about_category: string[];
  about_detail: string[];
}

/**
 * Unified button interface
 */
export interface UnifiedButton {
  type: ButtonType;
  label: string;
  comment?: string;
  detail?: HabitDetail | GoalDetail | StickyNDetail | ReplyDetail;
}

/**
 * Habit detail for button
 */
export interface HabitDetail {
  type: 'Habit';
  name: string;
  habitType?: 'do' | 'avoid';
  must?: number;
  duration?: number;
  repeat?: string;
  time?: string;
  endTime?: string;
  notes?: string;
  workloadUnit?: string;
  workloadPerCount?: number;
  timings?: Timing[];
  frequency?: string;
  reason?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * Goal detail for button
 */
export interface GoalDetail {
  type: 'Goal';
  name: string;
  details?: string;
  dueDate?: string;
  parentId?: string | null;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  suggestedHabits?: string[];
  rationale?: string;
}

/**
 * Sticky'n(MEMO) detail for button
 */
export interface StickyNDetail {
  type: 'Sticky\'n(MEMO)';
  name: string;
  description?: string | null;
  parentStickyId?: string | null;
  isReusable?: boolean;
}

/**
 * Reply detail for navigation buttons
 */
export interface ReplyDetail {
  action: string;
  category?: string;
  subCategory?: string;
  existingItemId?: string;
  icon?: string;
}

/**
 * Unified AI response format
 */
export interface UnifiedChatResponse {
  message: string;
  userInfo: UserInfoContext;
  buttons: UnifiedButton[];
}
```

### Backend Design

#### 1. ResponseFormatter Service

```typescript
// backend/src/services/ResponseFormatter.ts

import { z } from 'zod';

const ButtonSchema = z.object({
  type: z.enum(['Habit', 'Goal', 'Sticky\'n(MEMO)', 'reply']),
  label: z.string().min(1),
  comment: z.string().optional(),
  detail: z.record(z.unknown()).optional(),
});

const UnifiedResponseSchema = z.object({
  message: z.string(),
  userInfo: z.object({
    about_type: z.enum(['None', 'Habit', 'Goal', 'Sticky\'n(MEMO)', 'others']),
    about_operation: z.enum(['None', '見直し', '新規提案', '確認', 'アドバイス', 'others']),
    about_category: z.array(z.string()),
    about_detail: z.array(z.string()),
  }),
  buttons: z.array(ButtonSchema).min(1), // At least 1 button required
});

export class ResponseFormatter {
  /**
   * Ensures the response has at least one button
   * If no buttons provided, adds a default continuation button
   */
  static ensureButtonsPresent(
    response: Partial<UnifiedChatResponse>,
    locale: 'ja' | 'en' = 'ja'
  ): UnifiedChatResponse {
    const buttons = response.buttons || [];

    if (buttons.length === 0) {
      // Add default continuation button
      buttons.push({
        type: 'reply',
        label: locale === 'ja' ? '続ける' : 'Continue',
        comment: undefined,
        detail: { action: 'continue' },
      });
    }

    return {
      message: response.message || '',
      userInfo: response.userInfo || {
        about_type: 'None',
        about_operation: 'None',
        about_category: [],
        about_detail: [],
      },
      buttons,
    };
  }

  /**
   * Validates response against schema
   */
  static validate(response: unknown): UnifiedChatResponse {
    return UnifiedResponseSchema.parse(response);
  }
}
```

#### 2. Question Flow Tool

```typescript
// backend/src/agents/mastra/tools/question-flow.ts

import { createTool } from '@mastra/core';
import { z } from 'zod';

const QUESTION_FLOW_STEPS = {
  info_type: {
    ja: [
      { label: '既存Habitの見直し', action: 'review_habit' },
      { label: '既存Goalに関する新しいHabitの提案', action: 'habit_for_goal' },
      { label: '新しいGoalの提案', action: 'new_goal' },
      { label: '新しいHabitの提案', action: 'new_habit' },
      { label: '既存の登録情報の確認', action: 'check_existing' },
      { label: 'その他アドバイス', action: 'advice' },
    ],
    en: [
      { label: 'Review existing habits', action: 'review_habit' },
      { label: 'Suggest habits for existing goals', action: 'habit_for_goal' },
      { label: 'Suggest new goals', action: 'new_goal' },
      { label: 'Suggest new habits', action: 'new_habit' },
      { label: 'Check existing data', action: 'check_existing' },
      { label: 'Other advice', action: 'advice' },
    ],
  },
  category: {
    ja: [
      { label: '健康・運動', category: 'health', icon: '💪' },
      { label: 'キャリア・仕事', category: 'career', icon: '💼' },
      { label: '学習・スキルアップ', category: 'learning', icon: '📚' },
      { label: '趣味・リラックス', category: 'hobby', icon: '🎮' },
      { label: '人間関係', category: 'relationship', icon: '👥' },
      { label: 'お金・資産', category: 'finance', icon: '💰' },
      { label: 'ライフスタイル', category: 'lifestyle', icon: '🏠' },
      { label: 'その他', category: 'other', icon: '✨' },
    ],
    en: [
      { label: 'Health & Fitness', category: 'health', icon: '💪' },
      { label: 'Career & Work', category: 'career', icon: '💼' },
      { label: 'Learning & Skills', category: 'learning', icon: '📚' },
      { label: 'Hobbies & Relaxation', category: 'hobby', icon: '🎮' },
      { label: 'Relationships', category: 'relationship', icon: '👥' },
      { label: 'Finance & Assets', category: 'finance', icon: '💰' },
      { label: 'Lifestyle', category: 'lifestyle', icon: '🏠' },
      { label: 'Other', category: 'other', icon: '✨' },
    ],
  },
};

export const showQuestionFlowTool = createTool({
  id: 'show_question_flow',
  description: 'Display question flow step with reply buttons',
  inputSchema: z.object({
    step: z.enum(['info_type', 'category', 'subcategory']),
    locale: z.enum(['ja', 'en']).default('ja'),
    customOptions: z.array(z.object({
      label: z.string(),
      action: z.string().optional(),
      category: z.string().optional(),
      icon: z.string().optional(),
    })).optional(),
  }),
  execute: async ({ step, locale, customOptions }) => {
    let options = customOptions;

    if (!options && step !== 'subcategory') {
      options = QUESTION_FLOW_STEPS[step][locale];
    }

    const buttons = (options || []).map(opt => ({
      type: 'reply' as const,
      label: opt.icon ? `${opt.icon} ${opt.label}` : opt.label,
      detail: {
        action: opt.action || 'select',
        category: opt.category,
      },
    }));

    return { buttons };
  },
});
```

#### 3. Updated System Prompt

```typescript
// backend/src/agents/mastra/prompts/candidate-button-prompt.ts

export const CANDIDATE_BUTTON_SYSTEM_PROMPT = `
## 候補ボタン必須ルール（最重要）

あなたの全ての応答には、必ず候補ボタンを含めてください。
テキストのみの応答は禁止です。

### ボタンタイプ

1. **Habit型**: 習慣の提案（[採用][却下][詳細]ボタン付き）
2. **Goal型**: 目標の提案（[採用][却下][詳細]ボタン付き）
3. **Sticky'n(MEMO)型**: メモの提案（[採用][却下][詳細]ボタン付き）
4. **reply型**: 選択肢・回答ボタン（クリックで回答送信）

### 質問フロー

ユーザーとの最初のやり取りでは、以下の順序で質問してください：

**Step 1: 欲しい情報の確認**
\`show_question_flow\` ツールで以下を表示：
- 既存Habitの見直し
- 既存Goalに関する新しいHabitの提案
- 新しいGoalの提案
- 新しいHabitの提案
- 既存の登録情報の確認
- その他アドバイス

**Step 2: カテゴリ確認**
\`show_question_flow\` ツールで以下を表示：
- 健康・運動
- キャリア・仕事
- 学習・スキルアップ
- 趣味・リラックス
- 人間関係
- お金・資産
- ライフスタイル
- その他

**Step 3: サブカテゴリ確認**
選択されたカテゴリに応じたサブカテゴリを表示

### 禁止事項

- 「いつやるか」「どこでやるか」といった質問はしない
- テキストのみの応答は禁止
- 番号リストでの選択肢提示は禁止（必ずボタンを使用）

### JSON応答形式

全ての応答は以下のJSON形式に従ってください：

\`\`\`json
{
  "message": "メッセージテキスト",
  "userInfo": {
    "about_type": "None | Habit | Goal | Sticky'n(MEMO) | others",
    "about_operation": "None | 見直し | 新規提案 | 確認 | アドバイス | others",
    "about_category": [],
    "about_detail": []
  },
  "buttons": [
    {
      "type": "Habit | Goal | Sticky'n(MEMO) | reply",
      "label": "ボタンラベル",
      "comment": "説明（任意）",
      "detail": { ... }
    }
  ]
}
\`\`\`
`;
```

## File Changes Summary

### New Files to Create

| File Path | Description |
|-----------|-------------|
| `frontend/app/dashboard/types/candidate-button.types.ts` | 型定義 |
| `frontend/app/dashboard/components/CandidateCard.tsx` | 候補カードコンポーネント |
| `frontend/app/dashboard/components/QuestionFlowIndicator.tsx` | 質問フローインジケーター |
| `frontend/app/dashboard/components/RefineButtonGroup.tsx` | 再提案ボタングループ |
| `frontend/app/dashboard/hooks/useQuestionFlow.ts` | 質問フロー状態管理フック |
| `frontend/app/dashboard/utils/responseParser.ts` | 応答パーサー |
| `backend/src/services/ResponseFormatter.ts` | 応答フォーマッター |
| `backend/src/agents/mastra/tools/question-flow.ts` | 質問フローツール |
| `backend/src/agents/mastra/prompts/candidate-button-prompt.ts` | システムプロンプト |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `frontend/app/dashboard/components/Section.MOC.tsx` | CandidateCard統合、応答パーサー統合 |
| `frontend/app/dashboard/hooks/useMastraAgent.ts` | 統一応答形式対応 |
| `frontend/app/dashboard/hooks/useMcpChat.ts` | 統一応答形式対応 |
| `backend/src/agents/mastra/vow-coach-agent.ts` | プロンプト更新、ツール追加 |
| `backend/src/agents/mastra/agents/manager-agent.ts` | プロンプト更新、ツール追加 |

## CSS Styling

```css
/* frontend/app/dashboard/styles/candidate-card.css */

.candidate-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  background: var(--card-bg);
}

.candidate-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.type-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.type-badge.habit { background: #e8f5e9; color: #2e7d32; }
.type-badge.goal { background: #e3f2fd; color: #1565c0; }
.type-badge.stickyn { background: #fff3e0; color: #ef6c00; }
.type-badge.reply { background: #f3e5f5; color: #7b1fa2; }

.candidate-card-body {
  margin-bottom: 12px;
}

.comment {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.candidate-card-actions {
  display: flex;
  gap: 8px;
}

.btn-accept {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-reject {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-detail {
  background: transparent;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-reply {
  background: var(--surface-color);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reply:hover {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

/* Question Flow Indicator */
.question-flow-indicator {
  display: flex;
  gap: 16px;
  padding: 12px;
  background: var(--surface-color);
  border-radius: 8px;
  margin-bottom: 16px;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.5;
}

.step.active {
  opacity: 1;
  font-weight: 500;
}

.step.completed {
  opacity: 0.7;
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.step.active .step-number {
  background: var(--primary-color);
  color: white;
}

.step.completed .step-number {
  background: var(--success-color);
  color: white;
}

/* Refine Button Group */
.refine-button-group {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: center;
}

.btn-refine {
  background: transparent;
  color: var(--text-secondary);
  border: 1px dashed var(--border-color);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-refine:hover {
  border-style: solid;
  color: var(--primary-color);
  border-color: var(--primary-color);
}
```

## Test Strategy

### Unit Tests

```typescript
// frontend/app/dashboard/components/__tests__/CandidateCard.test.tsx

describe('CandidateCard', () => {
  it('renders Habit type with accept/reject/detail buttons', () => {
    const button = {
      type: 'Habit' as const,
      label: 'Morning stretch',
      comment: '5 minute stretching routine',
    };
    render(<CandidateCard button={button} {...mockHandlers} locale="en" />);

    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('Detail')).toBeInTheDocument();
  });

  it('renders reply type with single button', () => {
    const button = {
      type: 'reply' as const,
      label: 'Health & Fitness',
    };
    render(<CandidateCard button={button} {...mockHandlers} locale="en" />);

    expect(screen.getByText('Health & Fitness')).toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// frontend/e2e/candidate-buttons.spec.ts

test('question flow completes with candidate buttons', async ({ page }) => {
  await page.goto('/dashboard');

  // Step 1: Info type selection
  await expect(page.getByText('新しいHabitの提案')).toBeVisible();
  await page.click('text=新しいHabitの提案');

  // Step 2: Category selection
  await expect(page.getByText('健康・運動')).toBeVisible();
  await page.click('text=健康・運動');

  // Step 3: Candidates displayed
  await expect(page.locator('.candidate-card')).toHaveCount({ min: 1 });
  await expect(page.getByText('採用')).toBeVisible();
});
```

## Migration Plan

### Phase 1: Type Definitions & Parser (Day 1-2)
- Create `candidate-button.types.ts`
- Create `responseParser.ts`
- No breaking changes

### Phase 2: Frontend Components (Day 3-4)
- Create `CandidateCard.tsx`
- Create `QuestionFlowIndicator.tsx`
- Create `RefineButtonGroup.tsx`
- No breaking changes (components not yet integrated)

### Phase 3: Backend Tools (Day 5-6)
- Create `ResponseFormatter.ts`
- Create `question-flow.ts` tool
- Update prompts
- Feature flag for new format

### Phase 4: Integration (Day 7-8)
- Integrate components into `Section.MOC.tsx`
- Update hooks for unified response
- Enable feature flag

### Phase 5: Testing & Validation (Day 9-10)
- E2E testing
- QA verification
- Bug fixes
