# AI Coach Guardrails - Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Section.Coach.tsx)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Chat Input  │  │ Messages    │  │ HabitForm Component │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (/api/ai/chat)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AICoachService                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 Guardrails Layer                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │ Scope Check │  │ Clarify     │  │ Safety      │  │    │
│  │  │ isWithin    │  │ needsClar   │  │ Filters     │  │    │
│  │  │ Scope()     │  │ ification() │  │             │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              System Prompt (from Spec)               │    │
│  │  - Role Definition                                   │    │
│  │  - Guardrails                                        │    │
│  │  - Conversation Guidelines                           │    │
│  │  - Habit Guidelines                                  │    │
│  │  - Response Format                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              OpenAI Function Calling                 │    │
│  │  - analyze_habits                                    │    │
│  │  - get_workload_summary                              │    │
│  │  - suggest_habit_stacking                            │    │
│  │  - etc.                                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. aiCoachSpec.ts - Spec Definition

```typescript
// 役割定義
export const AI_COACH_ROLE = `...`;

// ガードレール（禁止事項）
export const AI_COACH_GUARDRAILS = `...`;

// 会話ガイドライン
export const AI_COACH_CONVERSATION_GUIDELINES = `...`;

// 習慣提案ガイドライン
export const AI_COACH_HABIT_GUIDELINES = `...`;

// 応答フォーマット
export const AI_COACH_RESPONSE_FORMAT = `...`;

// システムプロンプト生成
export function buildCoachSystemPrompt(): string;

// ユーティリティ関数
export function shouldProceedWithoutClarification(userMessage: string): boolean;
export function isWithinScope(userMessage: string): boolean;
export function needsClarification(userMessage: string): { needed: boolean; questions: string[] };
```

### 2. Guardrail Flow

```
User Input
    │
    ▼
┌─────────────────┐
│ isWithinScope() │──No──▶ Return "習慣管理に関することで..."
└─────────────────┘
    │ Yes
    ▼
┌─────────────────────────┐
│ needsClarification()    │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ shouldProceedWithoutClarification() │
└─────────────────────────────────┘
    │
    ├─ Yes ──▶ Proceed without clarification
    │
    └─ No ──▶ Add clarification hint to system prompt
              │
              ▼
         OpenAI API Call
              │
              ▼
         AI Response (may include clarification questions)
```

### 3. Response Format for Habit Suggestions

```
【提案】毎朝のジョギング
・頻度: 毎日
・目標: 30分
・おすすめ時間帯: 朝6:00-7:00
・理由: 朝の運動はコルチゾールレベルが高く、習慣化しやすい

この内容でよろしいですか？調整したい点があればお知らせください。
```

## Data Flow

### Chat Request
```json
{
  "message": "運動する習慣を作りたい",
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

### Chat Response
```json
{
  "response": "どんな運動をお考えですか？\n\n例えば：\n・ジョギング\n・筋トレ\n・ストレッチ\n・ヨガ\n\nまた、どのくらいの頻度で行いたいですか？",
  "toolsUsed": [],
  "tokensUsed": 150,
  "data": null
}
```

## Correctness Properties

### P1: Scope Enforcement
- 習慣管理に関係のない質問には、習慣管理に関する案内を返す
- 医療・法律・金融アドバイスは行わない

### P2: Clarification Behavior
- 曖昧な入力に対しては確認質問を行う
- ユーザーが「それで進めて」と言った場合は確認せずに進める

### P3: Safety Filters
- 危険な習慣は提案しない
- 依存性のある行動は推奨しない

### P4: Response Format
- 習慣提案時は構造化されたフォーマットを使用する
- フロントエンドのUIコンポーネントと連携可能な形式で出力する
