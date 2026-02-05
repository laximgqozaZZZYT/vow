# QA Patrol Agent Refactor - Design

## Overview
- **Purpose**: QA巡回エージェントのリファクタリング設計
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Architecture

### File Structure

```
frontend/e2e/
├── qa-patrol.spec.ts           # メインテストファイル（修正）
├── qa-patrol-questions.ts      # 静的質問データ（新規）
└── qa-patrol-types.ts          # 型定義（新規）
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    qa-patrol.spec.ts                        │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  Test Runner    │  │  CLI API Client │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                           │
│           ▼                    ▼                           │
│  ┌─────────────────────────────────────────┐              │
│  │       Multi-Turn Conversation           │              │
│  │         (Modified Logic)                │              │
│  └────────────────────┬────────────────────┘              │
│                       │                                    │
└───────────────────────┼────────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│qa-patrol-   │ │qa-patrol-   │ │  Backend    │
│questions.ts │ │types.ts     │ │  CLI API    │
│(Static Data)│ │(Interfaces) │ │             │
└─────────────┘ └─────────────┘ └─────────────┘
```

## Interface Design

### qa-patrol-types.ts

```typescript
/**
 * テスト質問の目的
 */
export type DesiredPurpose =
  | 'habit_suggestion'  // 習慣提案を希望
  | 'goal_setting'      // 目標設定を希望
  | 'level_setting'     // レベル設定を希望
  | 'advice';           // アドバイスを希望

/**
 * 期待する回答の型
 */
export type DesiredResponseType =
  | 'habit_cards'       // 習慣カード（選択可能な候補）
  | 'goal_cards'        // 目標カード（選択可能な候補）
  | 'text_advice'       // テキストアドバイス
  | 'category_buttons'; // カテゴリ選択ボタン（掘り下げ）

/**
 * テスト質問インターフェース
 */
export interface TestQuestion {
  /** 質問の一意識別子 */
  id: string;

  /** シンプルな質問文（情報粒度を低く） */
  question: string;

  /** 最終的に欲しい目的 */
  desiredPurpose: DesiredPurpose;

  /** 最終的に欲しい回答の型 */
  desiredResponseType: DesiredResponseType;

  /** 期待するジャンル */
  expectedGenre: string;

  /** フォローアップ質問（掘り下げ対応用） */
  followUpResponses: Record<string, string>;

  /** 成功判定キーワード */
  successKeywords?: string[];

  /** 最大やり取り回数 */
  maxExchanges?: number;

  /** カテゴリタグ（フィルタリング用） */
  tags?: string[];
}

/**
 * テスト結果
 */
export interface TestResult {
  questionId: string;
  passed: boolean;
  exchangeCount: number;
  finalResponse: string | null;
  matchedKeywords: string[];
  missingKeywords: string[];
  failureReason?: string;
  qualityScore: number;
  conversationLog: ConversationMessage[];
}

/**
 * 会話メッセージ
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

## Data Design

### qa-patrol-questions.ts Structure

```typescript
import { TestQuestion } from './qa-patrol-types';

/**
 * 習慣追加関連の質問
 */
export const HABIT_QUESTIONS: TestQuestion[] = [
  // ... 習慣関連質問
];

/**
 * 目標設定関連の質問
 */
export const GOAL_QUESTIONS: TestQuestion[] = [
  // ... 目標関連質問
];

/**
 * レベル設定関連の質問
 */
export const LEVEL_QUESTIONS: TestQuestion[] = [
  // ... レベル関連質問
];

/**
 * アドバイス関連の質問
 */
export const ADVICE_QUESTIONS: TestQuestion[] = [
  // ... アドバイス関連質問
];

/**
 * 全質問（エクスポート用）
 */
export const ALL_QUESTIONS: TestQuestion[] = [
  ...HABIT_QUESTIONS,
  ...GOAL_QUESTIONS,
  ...LEVEL_QUESTIONS,
  ...ADVICE_QUESTIONS,
];

/**
 * IDで質問を取得
 */
export function getQuestionById(id: string): TestQuestion | undefined {
  return ALL_QUESTIONS.find(q => q.id === id);
}

/**
 * 目的で質問をフィルタ
 */
export function getQuestionsByPurpose(purpose: DesiredPurpose): TestQuestion[] {
  return ALL_QUESTIONS.filter(q => q.desiredPurpose === purpose);
}

/**
 * ランダムに質問を選択
 */
export function getRandomQuestions(count: number): TestQuestion[] {
  const shuffled = [...ALL_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

## Algorithm Design

### Multi-Turn Conversation Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Start Test                                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  1. Load TestQuestion from qa-patrol-questions.ts            │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  2. Send question.question via CLI API                       │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  3. Receive AI Response                                      │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  4. Check Response Type:                                     │
│     - category_buttons? → Continue to step 5                 │
│     - habit_cards/goal_cards? → Check success keywords       │
│     - text_advice? → Check success keywords                  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  5. If AI asks for clarification:                            │
│     - Match AI question against followUpResponses patterns   │
│     - Send matched response                                  │
│     - Increment exchange count                               │
│     - Loop back to step 3                                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  6. Success Check:                                           │
│     - exchangeCount <= maxExchanges?                         │
│     - successKeywords found in response?                     │
│     - desiredResponseType matched?                           │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  7. Generate TestResult                                      │
└──────────────────────────────────────────────────────────────┘
```

### Response Type Detection

```typescript
function detectResponseType(
  response: string,
  toolCalls: ToolCall[] | undefined
): DesiredResponseType {
  // 1. Check tool calls for suggestion tools
  if (toolCalls?.some(tc => tc.toolName.includes('suggest_habits'))) {
    return 'habit_cards';
  }
  if (toolCalls?.some(tc => tc.toolName.includes('suggest_goals'))) {
    return 'goal_cards';
  }

  // 2. Check for category/drilldown patterns
  if (toolCalls?.some(tc => tc.toolName.includes('drilldown'))) {
    return 'category_buttons';
  }

  // 3. Check response text for patterns
  if (/どのジャンル|カテゴリ|分野/.test(response)) {
    return 'category_buttons';
  }

  // 4. Default to text advice
  return 'text_advice';
}
```

### Follow-up Response Matching

```typescript
function matchFollowUpResponse(
  aiResponse: string,
  followUpResponses: Record<string, string>
): string | null {
  for (const [pattern, response] of Object.entries(followUpResponses)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(aiResponse)) {
      return response;
    }
  }
  return null;
}
```

## Migration Strategy

### Phase 1: Create New Files
1. Create `qa-patrol-types.ts` with interfaces
2. Create `qa-patrol-questions.ts` with static data
3. Verify TypeScript compilation

### Phase 2: Modify qa-patrol.spec.ts
1. Import new types and questions
2. Remove inline Persona definitions (optional: keep for compatibility)
3. Add new test cases using TestQuestion
4. Remove any OpenAI-related code (if exists)

### Phase 3: Verify & Clean Up
1. Run tests to verify functionality
2. Remove deprecated code
3. Update documentation

## Test Strategy

### Unit Tests
- Type validation for TestQuestion
- followUpResponses pattern matching

### Integration Tests
- CLI API communication
- Multi-turn conversation flow

### End-to-End Tests
- Full test suite execution
- Issue creation verification

## Rollback Plan

既存の`qa-patrol.spec.ts`のペルソナ定義はそのまま維持し、新しいTestQuestion方式は追加として実装します。問題が発生した場合は、TestQuestion関連のテストのみを無効化することで、既存機能への影響を最小化します。

## Security Considerations

- テスト質問に個人情報を含めない
- APIキーはテストデータに含めない
- ログ出力時に機密情報をマスクする

## Performance Considerations

- 静的データのため、ファイル読み込みは初回のみ
- 質問数が増えてもメモリ使用量は最小限
- 並列テスト実行をサポート
