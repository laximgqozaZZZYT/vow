# AI Coach Hearing Flow Specification

## Overview

- **Purpose**: AIコーチがユーザーの習慣/目標についてヒアリングを行い、適切な設定と継続可能な計画を策定するためのフローを定義する
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-06
- **Author**: vow-spec-architect (Claude Code)

### 背景と目的

VOWのAIコーチ機能は、ユーザーが習慣や目標を設定する際に対話的なサポートを提供します。本仕様では、以下のシナリオにおけるヒアリングフローを定義します:

1. **新規Habit/Goal作成時**: ユーザーが「運動したい」などの曖昧な希望を具体的な習慣/目標に落とし込む
2. **既存Habit/Goal見直し時**: 達成率が低い習慣の原因分析と調整提案
3. **THLI評価連携**: 習慣の難易度レベルを正確に評価するための情報収集

### ヒアリングの基本原則

1. **負担最小化**: 質問は1ターンあたり最大2問、全体で5ターン以内
2. **推論活用**: ユーザーの回答から推論可能な情報は自動補完
3. **段階的深掘り**: 必要に応じて詳細を確認、不要な質問はスキップ
4. **即座のフィードバック**: 収集した情報を随時要約して確認

---

## Requirements

### Requirement 1: ヒアリングトリガーの検出

**User Story:** ユーザーとして、習慣や目標について話すと、AIコーチが適切なヒアリングを開始してほしい。

#### Acceptance Criteria

1. THE System SHALL detect habit creation intent from natural language (e.g., "運動したい", "読書を習慣にしたい", "5kg痩せたい")
2. THE System SHALL detect goal creation intent (e.g., "TOEIC800点取りたい", "マラソン完走したい")
3. THE System SHALL detect review/adjustment intent (e.g., "全然続かない", "もう少し楽にしたい", "もっとやりたい")
4. THE System SHALL distinguish between quick add (具体的な習慣名のみ) and detailed hearing (曖昧な希望)
5. WHEN user provides complete habit information, THE System SHALL skip hearing and create directly

### Requirement 2: 新規Habit作成ヒアリングフロー

**User Story:** ユーザーとして、曖昧な希望から具体的な習慣を一緒に作りたい。

#### Acceptance Criteria

1. THE System SHALL implement a 4-phase hearing flow:
   - Phase 1: ゴール確認 (What do you want to achieve?)
   - Phase 2: 具体化 (What exactly will you do?)
   - Phase 3: 実現可能性 (When/Where/How often?)
   - Phase 4: 障壁対策 (What might prevent you?)
2. THE System SHALL complete hearing within 5 conversation turns maximum
3. THE System SHALL ask maximum 2 questions per turn
4. THE System SHALL provide default values based on category when user is unsure
5. THE System SHALL show progress indicator (e.g., "2/4 ステップ完了")
6. THE System SHALL allow skipping optional questions with "スキップ" or similar input

### Requirement 3: 新規Goal作成ヒアリングフロー

**User Story:** ユーザーとして、大きな目標から具体的なマイルストーンと習慣を設計したい。

#### Acceptance Criteria

1. THE System SHALL implement a 4-phase hearing flow for goals:
   - Phase 1: ビジョン確認 (What is your ultimate goal?)
   - Phase 2: 期限設定 (When do you want to achieve it?)
   - Phase 3: 現状把握 (Where are you now?)
   - Phase 4: 習慣提案 (What daily actions will get you there?)
2. THE System SHALL generate 2-4 habit suggestions based on goal
3. THE System SHALL propose milestones based on deadline
4. THE System SHALL link generated habits to the goal automatically

### Requirement 4: 既存Habit/Goal見直しヒアリングフロー

**User Story:** 達成率が低い習慣について、原因を分析して改善提案を受けたい。

#### Acceptance Criteria

1. THE System SHALL detect struggling habits (completion rate < 50% over 14 days)
2. THE System SHALL implement a 3-phase review hearing:
   - Phase 1: 状況確認 (What's been difficult?)
   - Phase 2: 原因分析 (Why do you think it's hard?)
   - Phase 3: 調整提案 (Baby step or alternative approach)
3. THE System SHALL offer Lv.50 and Lv.10 baby step options
4. THE System SHALL preserve original habit and create adjusted version
5. THE System SHALL suggest habit stacking with existing successful habits

### Requirement 5: THLI評価連携ヒアリング

**User Story:** ユーザーとして、習慣の難易度を正確に評価してもらいたい。

#### Acceptance Criteria

1. THE System SHALL collect THLI-24 facts (F01-F16) through natural conversation
2. THE System SHALL prioritize high-impact questions based on VOI (Value of Information)
3. THE System SHALL reach ICI (Information Completeness Index) >= 0.6 within 5 turns
4. WHEN ICI < 0.6 after hearing, THE System SHALL use conservative estimates
5. THE System SHALL explain level assessment result in user-friendly language
6. THE System SHALL offer to adjust habit if level is too high for user's experience

### Requirement 6: 質問生成と回答解析

**User Story:** ユーザーとして、自然な会話の中で情報を伝えたい。

#### Acceptance Criteria

1. THE System SHALL generate contextual questions in natural Japanese
2. THE System SHALL support multiple answer formats (free text, choice buttons, sliders)
3. THE System SHALL infer missing information from context when confidence > 0.7
4. THE System SHALL confirm inferred information before finalizing
5. THE System SHALL handle "わからない" / "任せる" responses with sensible defaults
6. THE System SHALL remember previous answers within session

### Requirement 7: データ収集と保存

**User Story:** 収集した情報を正確に保存し、習慣/目標作成に反映したい。

#### Acceptance Criteria

1. THE System SHALL collect and store:
   - Basic info: name, type (do/avoid), frequency, target_count
   - Timing info: trigger_time, duration, days_of_week
   - Context info: location, anchor_habit, tools_required
   - Motivation info: why, benefits, identity_statement
   - Barriers: common_obstacles, mitigation_strategies
2. THE System SHALL generate habit JSON from collected data
3. THE System SHALL pre-fill habit creation modal with hearing results
4. THE System SHALL store hearing session for future reference
5. THE System SHALL track question-answer pairs for model improvement

### Requirement 8: アダプティブフロー制御

**User Story:** 私の回答に応じて、質問の流れを調整してほしい。

#### Acceptance Criteria

1. THE System SHALL skip questions when answer is already provided
2. THE System SHALL ask follow-up questions for concerning answers
3. THE System SHALL adjust question depth based on user engagement
4. THE System SHALL detect user fatigue (short answers, "はい"のみ) and accelerate
5. THE System SHALL offer to save progress and continue later

---

## Non-Functional Requirements

### NFR-001: 応答速度

1. THE System SHALL generate next question within 2 seconds
2. THE System SHALL complete hearing summary within 3 seconds

### NFR-002: 質問品質

1. THE System SHALL use encouraging and supportive language
2. THE System SHALL avoid jargon and technical terms
3. THE System SHALL provide examples when asking abstract questions

### NFR-003: エラー耐性

1. THE System SHALL handle API failures gracefully
2. THE System SHALL preserve hearing progress on connection loss
3. THE System SHALL allow resuming interrupted hearing sessions

---

## Technical Design

### ヒアリングフェーズ定義

```typescript
type HearingType = 'new_habit' | 'new_goal' | 'review_habit' | 'review_goal' | 'thli_assessment';

interface HearingPhase {
  id: string;
  name: string;
  nameJa: string;
  questions: HearingQuestion[];
  requiredFacts: string[];
  skipCondition?: (context: HearingContext) => boolean;
}

interface HearingQuestion {
  id: string;
  factId: string; // Maps to THLI F01-F16 or custom facts
  template: string; // Question template with {{variables}}
  templateJa: string;
  answerType: 'text' | 'choice' | 'slider' | 'time' | 'frequency';
  choices?: HearingChoice[];
  sliderConfig?: { min: number; max: number; step: number; unit: string };
  required: boolean;
  inferrable: boolean;
  defaultValue?: unknown;
  followUp?: (answer: unknown) => HearingQuestion | null;
}

interface HearingChoice {
  value: string;
  label: string;
  labelJa: string;
  icon?: string;
}
```

### ヒアリングセッション状態

```typescript
interface HearingSession {
  id: string;
  userId: string;
  type: HearingType;
  entityId?: string; // For review: existing habit/goal ID

  // Progress
  currentPhase: number;
  currentQuestion: number;
  totalPhases: number;
  completedAt?: Date;

  // Collected data
  facts: Record<string, FactValue>;
  answers: HearingAnswer[];

  // Output
  generatedEntity?: Partial<Habit | Goal>;
  suggestions?: HabitSuggestion[];

  // Metadata
  startedAt: Date;
  lastActivityAt: Date;
  turnCount: number;
}

interface HearingAnswer {
  questionId: string;
  factId: string;
  rawAnswer: string;
  parsedValue: unknown;
  confidence: number;
  source: 'user_stated' | 'inferred' | 'default';
  timestamp: Date;
}

interface FactValue {
  value: unknown;
  uType: 'U0' | 'U1' | 'U2' | 'U3' | 'U4';
  eType: 'E0' | 'E1' | 'E2' | 'E3';
  source: 'user_stated' | 'inferred' | 'default';
}
```

### ヒアリングサービスインターフェース

```typescript
interface HearingService {
  /**
   * 新しいヒアリングセッションを開始
   */
  startHearing(
    userId: string,
    type: HearingType,
    initialContext?: string
  ): Promise<HearingSessionStart>;

  /**
   * ユーザーの回答を処理し、次の質問を生成
   */
  processAnswer(
    sessionId: string,
    answer: string
  ): Promise<HearingStep>;

  /**
   * ヒアリングをスキップして完了
   */
  skipRemaining(
    sessionId: string
  ): Promise<HearingResult>;

  /**
   * ヒアリング結果から習慣/目標を生成
   */
  generateEntity(
    sessionId: string
  ): Promise<GeneratedEntity>;

  /**
   * セッションを再開
   */
  resumeHearing(
    sessionId: string
  ): Promise<HearingStep>;
}

interface HearingSessionStart {
  sessionId: string;
  type: HearingType;
  firstQuestion: HearingStep;
}

interface HearingStep {
  status: 'in_progress' | 'completed' | 'needs_confirmation';

  // Current state
  phase: { current: number; total: number; name: string };
  question?: {
    id: string;
    text: string;
    answerType: string;
    choices?: HearingChoice[];
    sliderConfig?: object;
    hint?: string;
  };

  // Progress summary
  collectedSummary?: string;

  // For completion
  result?: HearingResult;
}

interface HearingResult {
  sessionId: string;
  type: HearingType;
  facts: Record<string, FactValue>;
  generatedEntity: Partial<Habit | Goal>;
  suggestions?: HabitSuggestion[];
  thliEstimate?: {
    level: number;
    tier: string;
    confidence: number;
  };
  summary: string;
}
```

---

## ヒアリングフロー詳細設計

### 新規Habit作成フロー

```
Phase 1: ゴール確認 (目的の明確化)
├── Q1: "どんな習慣を作りたいですか？" (初回のみ、トリガーメッセージがあればスキップ)
└── Q2: "その習慣で何を達成したいですか？" (動機の確認)

Phase 2: 具体化 (行動の定義)
├── Q3: "具体的にどんなアクションをしますか？"
│   └── 選択肢例: [ストレッチ, ジョギング, 筋トレ, ヨガ, その他]
└── Q4: "どのくらいの量/時間を目標にしますか？"
    └── スライダー: 5分〜60分 (運動の場合)

Phase 3: 実現可能性 (タイミングと頻度)
├── Q5: "いつ行いますか？"
│   └── 選択肢: [朝起きたら, 朝食後, 昼休み, 仕事後, 夕食後, 寝る前, 特定時刻]
├── Q6: "どのくらいの頻度で行いますか？"
│   └── 選択肢: [毎日, 平日のみ, 週3回, 週末のみ, カスタム]
└── Q7: (任意) "どこで行いますか？"

Phase 4: 障壁対策 (継続のための工夫)
├── Q8: "続かなくなりそうな時、何が原因だと思いますか？"
│   └── 選択肢: [時間がない, 疲れている, 忘れる, やる気が出ない, その他]
└── Q9: (任意) "既存の習慣と組み合わせませんか？" (習慣スタッキング提案)
    └── 選択肢: ユーザーの高達成率習慣をリスト

確認フェーズ:
└── "以下の内容でよろしいですか？" + 習慣サマリーカード
```

### 新規Goal作成フロー

```
Phase 1: ビジョン確認
├── Q1: "どんなゴールを達成したいですか？"
└── Q2: "それを達成すると、どんな良いことがありますか？"

Phase 2: 期限設定
├── Q3: "いつまでに達成したいですか？"
│   └── 選択肢: [1ヶ月後, 3ヶ月後, 6ヶ月後, 1年後, 特定日]
└── Q4: (自動計算) マイルストーン提案

Phase 3: 現状把握
├── Q5: "現在の状況を教えてください"
│   └── 例: TOEIC → 現在のスコア、ダイエット → 現在の体重
└── Q6: "これまで似たような挑戦をしたことはありますか？"

Phase 4: 習慣提案
└── Q7: "以下の習慣でゴールに近づけます。どれを追加しますか？"
    └── 複数選択: AI生成の習慣提案リスト (2-4個)

確認フェーズ:
└── "ゴールと習慣を作成しますか？" + ゴールサマリーカード
```

### 既存Habit見直しフロー

```
Phase 1: 状況確認
├── Q1: "「{{habit_name}}」について、最近どうですか？"
│   └── 選択肢: [順調, 少し大変, かなり苦戦, 完全にストップ]
└── Q2: "どんな時に難しいと感じますか？"

Phase 2: 原因分析
├── Q3: "なぜ続けにくいと思いますか？" (自由回答)
└── Q4: (THLIデータ活用) "{{high_load_variable}}が高いようです。調整しますか？"

Phase 3: 調整提案
├── Option A: Lv.50プラン
│   └── "まず{{current_duration}}の半分、{{new_duration}}で始めませんか？"
├── Option B: Lv.10プラン
│   └── "最小限の「{{minimal_action}}」から始めませんか？"
└── Option C: 習慣スタッキング
    └── "{{anchor_habit}}の後に組み合わせませんか？"

確認フェーズ:
└── "どのプランで調整しますか？" + 選択ボタン
```

### THLI評価ヒアリングフロー

```
優先度順の質問 (VOIベース):
1. F01: アクション定義 "具体的に何をしますか？"
2. F02: 完了条件 "どうなったら「完了」ですか？"
3. F03: 所要時間 "通常どのくらい時間がかかりますか？"
4. F04: 実際頻度 "実際どのくらいの頻度で行っていますか？"
5. F06: 時間固定 "決まった時間に行いますか？"
6. F07: 場所 "どこで行いますか？"
7. F09: 道具 "必要な道具はありますか？"
8. F10: 準備 "始める前に準備は必要ですか？"
9. F13: 可視性 "他の人から見える習慣ですか？"
10. F16: 回避シグナル "やりたくないと感じる時のサインは？"

ICI >= 0.6 到達で次フェーズへ
```

---

## UI コンポーネント設計

### HearingProgressIndicator

```typescript
interface HearingProgressIndicatorProps {
  currentPhase: number;
  totalPhases: number;
  phaseName: string;
  completionPercentage: number;
}
```

### HearingQuestionCard

```typescript
interface HearingQuestionCardProps {
  question: string;
  hint?: string;
  answerType: 'text' | 'choice' | 'slider' | 'time' | 'frequency';
  choices?: HearingChoice[];
  sliderConfig?: SliderConfig;
  onAnswer: (answer: unknown) => void;
  onSkip?: () => void;
  isRequired: boolean;
}
```

### HearingSummaryCard

```typescript
interface HearingSummaryCardProps {
  collectedData: Record<string, string>;
  entityType: 'habit' | 'goal';
  onEdit: (field: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}
```

---

## 分岐ロジック

### 回答による分岐

| 回答パターン | 処理 |
|-------------|------|
| 具体的な回答 | 次の質問へ進む |
| "わからない" / "任せる" | デフォルト値を使用、確認を求める |
| 短い回答 (3文字以下) | フォローアップ質問で詳細を確認 |
| 否定的な回答 | 代替案を提示 |
| "スキップ" | 任意質問はスキップ、必須質問は別アプローチで再質問 |
| "やめる" / "キャンセル" | 確認ダイアログ表示、進捗保存オプション提示 |

### コンテキストによる分岐

| コンテキスト | 処理 |
|-------------|------|
| ユーザーレベル = beginner | 質問を簡略化、デフォルト値を多用 |
| ユーザーレベル = advanced | 詳細オプションを表示 |
| 類似習慣が存在 | 重複警告、既存習慣との違いを確認 |
| 高負荷習慣が多い | ワークロード警告、軽い習慣を提案 |
| アンカー習慣あり | 習慣スタッキングを積極提案 |

---

## 関連仕様

- `.kiro/specs/habit-goal-level-system/design.md`: THLI-24評価システム詳細
- `.kiro/specs/ai-coach-quality-improvement/design.md`: パーソナライゼーションエンジン
- `.kiro/specs/ai-agents-integration/design.md`: AI Agents統合UI
- `.kiro/specs/ai-coach-usability-enhancement/design.md`: 会話品質ガイドライン

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-06 | vow-spec-architect | Initial specification |
