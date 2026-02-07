# AI Coach Hearing Flow - Design Document

## Overview

本ドキュメントは、AIコーチのヒアリングフローの詳細設計を定義します。ユーザーが負担を感じない自然な対話を通じて、習慣/目標の作成と調整に必要な情報を収集します。

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │ Section.Coach  │  │ HearingFlow    │  │ HearingUI Components   │ │
│  │   (Trigger)    │──│   Orchestrator │──│ - ProgressIndicator    │ │
│  └────────────────┘  └────────────────┘  │ - QuestionCard         │ │
│                              │           │ - SummaryCard          │ │
│                              │           │ - ChoiceButtons        │ │
│                              │           └────────────────────────┘ │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ HTTP/WebSocket
┌──────────────────────────────┼──────────────────────────────────────┐
│                         Backend                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │ AICoachService │  │ HearingService │  │ HearingFlowEngine      │ │
│  │   (Router)     │──│   (Session)    │──│ - PhaseManager         │ │
│  └────────────────┘  └────────────────┘  │ - QuestionGenerator    │ │
│                              │           │ - AnswerParser         │ │
│                              │           │ - InferenceEngine      │ │
│                              │           │ - EntityBuilder        │ │
│                              │           └────────────────────────┘ │
│                              │                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Data Layer                                   │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐               │ │
│  │  │ Hearing    │  │ Habit      │  │ Goal       │               │ │
│  │  │ Sessions   │  │ Repository │  │ Repository │               │ │
│  │  └────────────┘  └────────────┘  └────────────┘               │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. HearingService

ヒアリングセッションのライフサイクルを管理するサービス。

```typescript
// backend/src/services/hearingService.ts

import { OpenAI } from 'openai';

export interface HearingService {
  // セッション管理
  startSession(params: StartSessionParams): Promise<HearingSession>;
  getSession(sessionId: string): Promise<HearingSession | null>;
  resumeSession(sessionId: string): Promise<HearingStep>;
  cancelSession(sessionId: string): Promise<void>;

  // 対話処理
  processUserInput(sessionId: string, input: string): Promise<HearingStep>;
  skipQuestion(sessionId: string): Promise<HearingStep>;
  goBackToPrevious(sessionId: string): Promise<HearingStep>;

  // 結果生成
  generateSummary(sessionId: string): Promise<HearingSummary>;
  createEntity(sessionId: string): Promise<Habit | Goal>;
}

interface StartSessionParams {
  userId: string;
  type: HearingType;
  entityId?: string;           // 見直しの場合
  initialMessage?: string;     // トリガーメッセージ
  userContext?: UserContext;   // パーソナライゼーション用
}

type HearingType =
  | 'new_habit'      // 新規習慣作成
  | 'new_goal'       // 新規目標作成
  | 'review_habit'   // 習慣見直し
  | 'review_goal'    // 目標見直し
  | 'thli_assessment'; // THLI評価
```

### 2. HearingFlowEngine

ヒアリングフローのロジックを制御するエンジン。

```typescript
// backend/src/services/hearingFlowEngine.ts

export interface HearingFlowEngine {
  // フロー制御
  getNextQuestion(session: HearingSession): Promise<HearingQuestion | null>;
  shouldSkipQuestion(question: HearingQuestion, session: HearingSession): boolean;
  determineFollowUp(answer: ParsedAnswer, question: HearingQuestion): HearingQuestion | null;

  // フェーズ管理
  getCurrentPhase(session: HearingSession): HearingPhase;
  isPhaseComplete(session: HearingSession): boolean;
  advanceToNextPhase(session: HearingSession): HearingSession;

  // 完了判定
  isSessionComplete(session: HearingSession): boolean;
  canCompleteEarly(session: HearingSession): boolean;
}
```

### 3. QuestionGenerator

コンテキストに応じた質問を生成するコンポーネント。

```typescript
// backend/src/services/questionGenerator.ts

export interface QuestionGenerator {
  // 質問生成
  generateQuestion(
    template: QuestionTemplate,
    context: HearingContext
  ): Promise<GeneratedQuestion>;

  // 選択肢生成
  generateChoices(
    questionType: string,
    context: HearingContext
  ): Promise<HearingChoice[]>;

  // ヒント生成
  generateHint(
    question: HearingQuestion,
    previousAnswers: HearingAnswer[]
  ): Promise<string>;
}

interface GeneratedQuestion {
  text: string;
  textJa: string;
  choices?: HearingChoice[];
  hint?: string;
  examples?: string[];
}

interface HearingContext {
  userId: string;
  userLevel: 'beginner' | 'intermediate' | 'advanced';
  existingHabits: Habit[];
  existingGoals: Goal[];
  anchorHabits: Habit[];
  previousAnswers: HearingAnswer[];
  hearingType: HearingType;
}
```

### 4. AnswerParser

ユーザーの回答を解析するコンポーネント。

```typescript
// backend/src/services/answerParser.ts

export interface AnswerParser {
  // 回答解析
  parseAnswer(
    rawInput: string,
    question: HearingQuestion,
    context: HearingContext
  ): Promise<ParsedAnswer>;

  // 意図検出
  detectIntent(input: string): AnswerIntent;

  // 値抽出
  extractValues(input: string, expectedType: AnswerType): ExtractedValues;

  // 感情検出
  detectEmotion(input: string): UserEmotion;
}

interface ParsedAnswer {
  value: unknown;
  confidence: number;
  intent: AnswerIntent;
  emotion: UserEmotion;
  needsFollowUp: boolean;
  followUpReason?: string;
}

type AnswerIntent =
  | 'direct_answer'    // 直接回答
  | 'skip'             // スキップ希望
  | 'delegate'         // AIに任せる
  | 'clarify'          // 質問を求める
  | 'cancel'           // キャンセル
  | 'back'             // 前に戻る
  | 'modify_previous'; // 前の回答を修正

type UserEmotion =
  | 'positive'
  | 'neutral'
  | 'uncertain'
  | 'frustrated'
  | 'fatigued';
```

### 5. InferenceEngine

収集した情報から推論を行うコンポーネント。

```typescript
// backend/src/services/inferenceEngine.ts

export interface InferenceEngine {
  // 推論実行
  inferMissingFacts(
    collectedFacts: Record<string, FactValue>,
    context: HearingContext
  ): Promise<InferredFacts>;

  // 信頼度計算
  calculateConfidence(
    fact: string,
    evidence: Evidence[]
  ): number;

  // デフォルト値生成
  generateDefaults(
    category: HabitCategory,
    userLevel: string
  ): DefaultValues;
}

interface InferredFacts {
  facts: Record<string, FactValue>;
  explanations: Record<string, string>;
  confidences: Record<string, number>;
}

interface Evidence {
  source: 'user_answer' | 'habit_data' | 'category_default' | 'user_pattern';
  value: unknown;
  weight: number;
}
```

### 6. EntityBuilder

収集した情報から習慣/目標エンティティを構築するコンポーネント。

```typescript
// backend/src/services/entityBuilder.ts

export interface EntityBuilder {
  // 習慣構築
  buildHabit(
    facts: Record<string, FactValue>,
    context: HearingContext
  ): Promise<Partial<Habit>>;

  // 目標構築
  buildGoal(
    facts: Record<string, FactValue>,
    context: HearingContext
  ): Promise<Partial<Goal>>;

  // マイルストーン生成
  generateMilestones(
    goal: Partial<Goal>,
    context: HearingContext
  ): Promise<Milestone[]>;

  // 習慣提案生成
  generateHabitSuggestions(
    goal: Partial<Goal>,
    context: HearingContext
  ): Promise<HabitSuggestion[]>;
}
```

## Data Models

### HearingSession

```typescript
interface HearingSession {
  // 識別情報
  id: string;
  userId: string;
  type: HearingType;
  entityId?: string;  // 見直し対象

  // 状態
  status: 'in_progress' | 'completed' | 'cancelled' | 'paused';
  currentPhaseIndex: number;
  currentQuestionIndex: number;

  // 収集データ
  facts: Record<string, FactValue>;
  answers: HearingAnswer[];
  inferences: Record<string, InferredFact>;

  // メトリクス
  turnCount: number;
  questionCount: number;
  skipCount: number;
  backtrackCount: number;

  // タイムスタンプ
  startedAt: Date;
  lastActivityAt: Date;
  completedAt?: Date;

  // コンテキスト
  initialMessage?: string;
  userContext: UserContext;
}
```

### HearingPhase定義

```typescript
// 新規Habit作成フェーズ定義
const NEW_HABIT_PHASES: HearingPhase[] = [
  {
    id: 'goal_clarification',
    name: 'Goal Clarification',
    nameJa: 'ゴール確認',
    description: '習慣の目的と動機を確認',
    questions: [
      {
        id: 'q_what_habit',
        factId: 'habit_intent',
        template: 'What kind of habit do you want to build?',
        templateJa: 'どんな習慣を作りたいですか？',
        answerType: 'text',
        required: false,  // トリガーメッセージがあればスキップ
        inferrable: false,
        skipCondition: (ctx) => !!ctx.initialMessage,
      },
      {
        id: 'q_why',
        factId: 'motivation',
        template: 'What do you want to achieve with this habit?',
        templateJa: 'その習慣で何を達成したいですか？',
        answerType: 'text',
        required: true,
        inferrable: true,
        hint: '例: 健康になりたい、集中力を高めたい、ストレス解消',
      },
    ],
  },
  {
    id: 'action_definition',
    name: 'Action Definition',
    nameJa: '行動の具体化',
    description: '具体的なアクションを定義',
    questions: [
      {
        id: 'q_action',
        factId: 'F01_action_definition',
        template: 'What specific action will you take?',
        templateJa: '具体的にどんなアクションをしますか？',
        answerType: 'choice',
        required: true,
        inferrable: false,
        choiceGenerator: 'action_choices_for_category',
      },
      {
        id: 'q_amount',
        factId: 'F03_typical_duration',
        template: 'How long or how much?',
        templateJa: 'どのくらいの量/時間を目標にしますか？',
        answerType: 'slider',
        required: true,
        inferrable: true,
        sliderConfig: {
          type: 'dynamic',  // カテゴリに応じて変更
          defaults: { min: 5, max: 60, step: 5, unit: '分' },
        },
      },
    ],
  },
  {
    id: 'timing_frequency',
    name: 'Timing & Frequency',
    nameJa: 'タイミングと頻度',
    description: 'いつ、どのくらいの頻度で行うか',
    questions: [
      {
        id: 'q_when',
        factId: 'F06_time_window_fixed',
        template: 'When will you do this?',
        templateJa: 'いつ行いますか？',
        answerType: 'choice',
        required: true,
        inferrable: true,
        choices: [
          { value: 'morning_wake', label: 'After waking up', labelJa: '朝起きたら', icon: '🌅' },
          { value: 'after_breakfast', label: 'After breakfast', labelJa: '朝食後', icon: '🍳' },
          { value: 'lunch_break', label: 'During lunch break', labelJa: '昼休み', icon: '🌤️' },
          { value: 'after_work', label: 'After work', labelJa: '仕事後', icon: '🌆' },
          { value: 'after_dinner', label: 'After dinner', labelJa: '夕食後', icon: '🌙' },
          { value: 'before_bed', label: 'Before bed', labelJa: '寝る前', icon: '🛏️' },
          { value: 'specific_time', label: 'Specific time', labelJa: '特定時刻', icon: '⏰' },
        ],
      },
      {
        id: 'q_frequency',
        factId: 'F05_target_frequency',
        template: 'How often?',
        templateJa: 'どのくらいの頻度で行いますか？',
        answerType: 'choice',
        required: true,
        inferrable: true,
        choices: [
          { value: 'daily', label: 'Every day', labelJa: '毎日', icon: '📅' },
          { value: 'weekdays', label: 'Weekdays only', labelJa: '平日のみ', icon: '💼' },
          { value: '3x_week', label: '3 times a week', labelJa: '週3回', icon: '📊' },
          { value: 'weekends', label: 'Weekends only', labelJa: '週末のみ', icon: '🌴' },
          { value: 'custom', label: 'Custom', labelJa: 'カスタム', icon: '⚙️' },
        ],
      },
      {
        id: 'q_location',
        factId: 'F07_locations',
        template: 'Where will you do this?',
        templateJa: 'どこで行いますか？',
        answerType: 'text',
        required: false,
        inferrable: true,
        hint: '例: 自宅、ジム、公園、オフィス',
      },
    ],
  },
  {
    id: 'barrier_mitigation',
    name: 'Barrier Mitigation',
    nameJa: '障壁対策',
    description: '継続を妨げる要因への対策',
    questions: [
      {
        id: 'q_obstacles',
        factId: 'F16_avoidance_signals',
        template: 'What might prevent you from doing this?',
        templateJa: '続かなくなりそうな時、何が原因だと思いますか？',
        answerType: 'choice',
        required: true,
        inferrable: true,
        multiSelect: true,
        choices: [
          { value: 'no_time', label: 'No time', labelJa: '時間がない', icon: '⏰' },
          { value: 'tired', label: 'Too tired', labelJa: '疲れている', icon: '😴' },
          { value: 'forget', label: 'Forget', labelJa: '忘れる', icon: '🤔' },
          { value: 'no_motivation', label: 'No motivation', labelJa: 'やる気が出ない', icon: '😐' },
          { value: 'environment', label: 'Environment issues', labelJa: '環境の問題', icon: '🏠' },
          { value: 'other', label: 'Other', labelJa: 'その他', icon: '📝' },
        ],
      },
      {
        id: 'q_habit_stacking',
        factId: 'anchor_habit',
        template: 'Would you like to combine with an existing habit?',
        templateJa: '既存の習慣と組み合わせませんか？',
        answerType: 'choice',
        required: false,
        inferrable: false,
        choiceGenerator: 'anchor_habit_choices',
        skipCondition: (ctx) => ctx.anchorHabits.length === 0,
      },
    ],
  },
];
```

### 質問テンプレートカテゴリ

```typescript
// 運動系習慣の質問テンプレート
const EXERCISE_QUESTIONS: QuestionVariant = {
  q_action: {
    choices: [
      { value: 'stretching', labelJa: 'ストレッチ', icon: '🤸' },
      { value: 'jogging', labelJa: 'ジョギング', icon: '🏃' },
      { value: 'strength', labelJa: '筋トレ', icon: '💪' },
      { value: 'yoga', labelJa: 'ヨガ', icon: '🧘' },
      { value: 'walking', labelJa: 'ウォーキング', icon: '🚶' },
      { value: 'other', labelJa: 'その他', icon: '📝' },
    ],
  },
  q_amount: {
    sliderConfig: { min: 5, max: 60, step: 5, unit: '分' },
    defaults: { beginner: 10, intermediate: 20, advanced: 30 },
  },
};

// 読書系習慣の質問テンプレート
const READING_QUESTIONS: QuestionVariant = {
  q_action: {
    choices: [
      { value: 'book', labelJa: '書籍', icon: '📚' },
      { value: 'article', labelJa: '記事', icon: '📰' },
      { value: 'audiobook', labelJa: 'オーディオブック', icon: '🎧' },
      { value: 'newsletter', labelJa: 'ニュースレター', icon: '📧' },
    ],
  },
  q_amount: {
    sliderConfig: { min: 5, max: 60, step: 5, unit: '分' },
    alternativeConfig: { min: 1, max: 50, step: 1, unit: 'ページ' },
    defaults: { beginner: 10, intermediate: 20, advanced: 30 },
  },
};

// 学習系習慣の質問テンプレート
const LEARNING_QUESTIONS: QuestionVariant = {
  q_action: {
    choices: [
      { value: 'language', labelJa: '語学学習', icon: '🌍' },
      { value: 'programming', labelJa: 'プログラミング', icon: '💻' },
      { value: 'course', labelJa: 'オンラインコース', icon: '🎓' },
      { value: 'practice', labelJa: '実践練習', icon: '✏️' },
    ],
  },
  q_amount: {
    sliderConfig: { min: 10, max: 120, step: 10, unit: '分' },
    defaults: { beginner: 15, intermediate: 30, advanced: 60 },
  },
};
```

## Correctness Properties

### Property 1: セッション一貫性

*For any* ヒアリングセッション, 収集された facts と answers の整合性が保たれること。すなわち、answers に含まれる回答は対応する facts にマッピングされていること。

**Validates: Requirement 7.1**

### Property 2: 質問数上限

*For any* ヒアリングターン, 提示される質問の数は最大2個であること。

**Validates: Requirement 2.3**

### Property 3: ターン数上限

*For any* 新規習慣ヒアリング, 完了までのターン数は5以下であること。

**Validates: Requirement 2.2**

### Property 4: スキップ可能性

*For any* required=false の質問, ユーザーが「スキップ」と回答した場合、次の質問に進むこと。

**Validates: Requirement 2.6**

### Property 5: 推論信頼度

*For any* 推論された fact, その confidence が 0.7 以上の場合のみ自動採用され、それ未満の場合はユーザーに確認を求めること。

**Validates: Requirement 6.3**

### Property 6: THLI ICI 達成

*For any* THLI評価ヒアリング, 5ターン以内に ICI >= 0.6 に到達するか、または conservative estimate にフォールバックすること。

**Validates: Requirement 5.3, 5.4**

### Property 7: エンティティ完全性

*For any* 完了したヒアリングセッション, 生成される Habit/Goal エンティティは必須フィールド (name, type, frequency, target_count) を全て含むこと。

**Validates: Requirement 7.2**

### Property 8: 進捗保存

*For any* 中断されたセッション, 再開時に以前の回答が保持されていること。

**Validates: Requirement NFR-003.2**

### Property 9: 疲労検出

*For any* 連続する3つ以上の短い回答 (5文字以下), システムはフロー短縮オプションを提示すること。

**Validates: Requirement 8.4**

### Property 10: デフォルト値整合性

*For any* 「任せる」回答, 適用されるデフォルト値はユーザーレベルとカテゴリに適したものであること。

**Validates: Requirement 6.5**

## Error Handling

### 入力エラー

| エラー状況 | 処理 |
|-----------|------|
| 空の入力 | 「何か入力してください」とプロンプト |
| 認識不能な入力 | 選択肢を再提示、または自由回答を求める |
| 矛盾する回答 | 前の回答との矛盾を指摘し、確認を求める |

### セッションエラー

| エラー状況 | 処理 |
|-----------|------|
| セッションタイムアウト | 自動保存し、再開オプションを提示 |
| API失敗 | リトライ (3回)、失敗時はフォールバック質問を使用 |
| データ保存失敗 | ローカルストレージにバックアップ、再試行 |

### ビジネスロジックエラー

| エラー状況 | 処理 |
|-----------|------|
| 重複習慣検出 | 警告表示、既存習慣との違いを確認 |
| 過負荷検出 | ワークロード警告、軽量化オプション提示 |
| 無効な組み合わせ | 理由を説明し、代替案を提案 |

## Testing Strategy

### 単体テスト

1. **QuestionGenerator テスト**
   - カテゴリ別質問生成
   - コンテキストに応じた選択肢生成
   - ヒント生成

2. **AnswerParser テスト**
   - 各回答タイプの解析
   - 意図検出精度
   - 感情検出精度

3. **InferenceEngine テスト**
   - 推論ロジック
   - 信頼度計算
   - デフォルト値生成

4. **EntityBuilder テスト**
   - Habit構築
   - Goal構築
   - マイルストーン生成

### プロパティベーステスト

```typescript
import fc from 'fast-check';

describe('HearingService Properties', () => {
  it('Property 2: Maximum 2 questions per turn', () => {
    fc.assert(
      fc.property(
        fc.record({
          sessionId: fc.uuid(),
          userInput: fc.string({ minLength: 1 }),
        }),
        async ({ sessionId, userInput }) => {
          const step = await hearingService.processUserInput(sessionId, userInput);
          const questionCount = step.questions?.length ?? 0;
          return questionCount <= 2;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3: Maximum 5 turns for new habit hearing', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        async (userInputs) => {
          const session = await hearingService.startSession({
            userId: 'test-user',
            type: 'new_habit',
          });

          let turnCount = 0;
          for (const input of userInputs) {
            const step = await hearingService.processUserInput(session.id, input);
            turnCount++;
            if (step.status === 'completed') break;
          }

          return turnCount <= 5 || session.status === 'completed';
        }
      ),
      { numRuns: 50 }
    );
  });
});
```

### 統合テスト

1. **完全なヒアリングフロー**
   - 新規習慣: 開始 -> 質問応答 -> 完了 -> エンティティ生成
   - 見直し: 開始 -> 原因分析 -> 調整提案 -> 適用

2. **中断・再開フロー**
   - セッション中断 -> 保存確認 -> 再開 -> 継続

3. **エラーリカバリー**
   - API失敗 -> リトライ -> 成功
   - タイムアウト -> 保存 -> 再開

## Implementation Notes

### フロントエンド実装

```typescript
// frontend/app/dashboard/hooks/useHearing.ts

export function useHearing() {
  const [session, setSession] = useState<HearingSession | null>(null);
  const [currentStep, setCurrentStep] = useState<HearingStep | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startHearing = useCallback(async (type: HearingType, initialMessage?: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/hearing/start', {
        method: 'POST',
        body: JSON.stringify({ type, initialMessage }),
      });
      const data = await response.json();
      setSession(data.session);
      setCurrentStep(data.firstStep);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitAnswer = useCallback(async (answer: string) => {
    if (!session) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/hearing/answer', {
        method: 'POST',
        body: JSON.stringify({ sessionId: session.id, answer }),
      });
      const data = await response.json();
      setCurrentStep(data);
      if (data.status === 'completed') {
        // 完了処理
      }
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  return {
    session,
    currentStep,
    isLoading,
    startHearing,
    submitAnswer,
  };
}
```

### バックエンドAPI

```typescript
// backend/src/routes/hearing.ts

router.post('/start', async (req, res) => {
  const { userId } = req.auth;
  const { type, initialMessage, entityId } = req.body;

  const session = await hearingService.startSession({
    userId,
    type,
    initialMessage,
    entityId,
  });

  res.json({
    session,
    firstStep: await hearingService.getNextStep(session.id),
  });
});

router.post('/answer', async (req, res) => {
  const { sessionId, answer } = req.body;
  const step = await hearingService.processUserInput(sessionId, answer);
  res.json(step);
});

router.post('/complete', async (req, res) => {
  const { sessionId } = req.body;
  const entity = await hearingService.createEntity(sessionId);
  res.json({ entity });
});
```

### データベーススキーマ

```sql
-- hearing_sessions テーブル
CREATE TABLE hearing_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_habit', 'new_goal', 'review_habit', 'review_goal', 'thli_assessment')),
  entity_id TEXT, -- 見直し対象のhabit_id or goal_id

  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled', 'paused')),
  current_phase_index INTEGER NOT NULL DEFAULT 0,
  current_question_index INTEGER NOT NULL DEFAULT 0,

  facts JSONB NOT NULL DEFAULT '{}',
  answers JSONB NOT NULL DEFAULT '[]',
  inferences JSONB NOT NULL DEFAULT '{}',

  turn_count INTEGER NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,

  initial_message TEXT,
  user_context JSONB,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hearing_sessions_user ON hearing_sessions(user_id, status);
CREATE INDEX idx_hearing_sessions_type ON hearing_sessions(type);
```

## 関連仕様

- `requirements.md`: 本設計の要件定義
- `.kiro/specs/habit-goal-level-system/design.md`: THLI-24評価システム
- `.kiro/specs/ai-coach-quality-improvement/design.md`: パーソナライゼーション
- `.kiro/specs/ai-coach-usability-enhancement/design.md`: 会話品質ガイドライン
