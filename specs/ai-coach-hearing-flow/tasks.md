# AI Coach Hearing Flow - Implementation Tasks

## Overview

本ドキュメントは、AIコーチヒアリングフロー機能の実装タスクを定義します。

## Task Summary

| Phase | Tasks | Priority | Est. Duration |
|-------|-------|----------|---------------|
| 1. 基盤構築 | 4 tasks | High | 3 days |
| 2. ヒアリングエンジン | 5 tasks | High | 4 days |
| 3. フロントエンドUI | 4 tasks | Medium | 3 days |
| 4. THLI連携 | 3 tasks | Medium | 2 days |
| 5. テスト・最適化 | 3 tasks | High | 2 days |

---

## Phase 1: 基盤構築 (Priority: High)

### TASK-1.1: データベーススキーマ作成

**Description**: ヒアリングセッションを保存するためのデータベーステーブルを作成

**Deliverables**:
- [ ] `supabase/migrations/YYYYMMDD_hearing_sessions.sql` マイグレーションファイル
- [ ] hearing_sessions テーブル
- [ ] インデックス作成

**Acceptance Criteria**:
- hearing_sessions テーブルが作成されること
- user_id, type, status でクエリ可能なこと
- facts, answers カラムが JSONB 型であること

**Prerequisite**: None
**Assignable to**: backend-developer
**Estimated**: 2h

---

### TASK-1.2: HearingService 基本実装

**Description**: ヒアリングセッションのライフサイクルを管理するサービスを実装

**Deliverables**:
- [ ] `backend/src/services/hearingService.ts`
- [ ] startSession, getSession, processUserInput メソッド
- [ ] セッション状態管理ロジック

**Acceptance Criteria**:
- 新規セッションを開始できること
- セッションIDでセッションを取得できること
- ユーザー入力を処理し、次のステップを返せること

**Prerequisite**: TASK-1.1
**Assignable to**: backend-developer
**Estimated**: 4h

---

### TASK-1.3: フェーズ・質問定義ファイル作成

**Description**: ヒアリングフェーズと質問テンプレートの定義ファイルを作成

**Deliverables**:
- [ ] `backend/src/data/hearingPhases.ts`
- [ ] NEW_HABIT_PHASES 定義
- [ ] NEW_GOAL_PHASES 定義
- [ ] REVIEW_HABIT_PHASES 定義
- [ ] カテゴリ別質問バリアント

**Acceptance Criteria**:
- 4フェーズの新規習慣ヒアリングが定義されていること
- 各フェーズに2問以下の質問が含まれること
- 質問にfactIdが紐づいていること

**Prerequisite**: None
**Assignable to**: backend-developer
**Estimated**: 3h

---

### TASK-1.4: API ルート作成

**Description**: ヒアリング機能のAPIエンドポイントを作成

**Deliverables**:
- [ ] `backend/src/routes/hearing.ts`
- [ ] POST /api/hearing/start
- [ ] POST /api/hearing/answer
- [ ] POST /api/hearing/skip
- [ ] POST /api/hearing/complete
- [ ] GET /api/hearing/:sessionId

**Acceptance Criteria**:
- 全エンドポイントが認証必須であること
- リクエストバリデーションが実装されていること
- エラーレスポンスが統一フォーマットであること

**Prerequisite**: TASK-1.2
**Assignable to**: backend-developer
**Estimated**: 3h

---

## Phase 2: ヒアリングエンジン (Priority: High)

### TASK-2.1: QuestionGenerator 実装

**Description**: コンテキストに応じた質問を生成するコンポーネントを実装

**Deliverables**:
- [ ] `backend/src/services/questionGenerator.ts`
- [ ] generateQuestion メソッド
- [ ] generateChoices メソッド (動的選択肢)
- [ ] generateHint メソッド

**Acceptance Criteria**:
- 質問テンプレートの変数置換ができること
- ユーザーの既存習慣に基づく選択肢が生成できること
- カテゴリに応じた質問バリアントが適用されること

**Prerequisite**: TASK-1.3
**Assignable to**: backend-developer
**Estimated**: 4h

---

### TASK-2.2: AnswerParser 実装

**Description**: ユーザー回答を解析するコンポーネントを実装

**Deliverables**:
- [ ] `backend/src/services/answerParser.ts`
- [ ] parseAnswer メソッド
- [ ] detectIntent メソッド
- [ ] extractValues メソッド

**Acceptance Criteria**:
- 自由テキスト回答から値を抽出できること
- 「スキップ」「任せる」等の意図を検出できること
- 短い回答（疲労サイン）を検出できること

**Prerequisite**: None
**Assignable to**: backend-developer
**Estimated**: 4h

---

### TASK-2.3: InferenceEngine 実装

**Description**: 収集情報から推論を行うコンポーネントを実装

**Deliverables**:
- [ ] `backend/src/services/inferenceEngine.ts`
- [ ] inferMissingFacts メソッド
- [ ] calculateConfidence メソッド
- [ ] generateDefaults メソッド

**Acceptance Criteria**:
- 回答から関連するfactを推論できること
- 信頼度スコアが計算されること
- カテゴリ・ユーザーレベルに応じたデフォルト値が生成されること

**Prerequisite**: TASK-1.3
**Assignable to**: backend-developer
**Estimated**: 4h

---

### TASK-2.4: HearingFlowEngine 実装

**Description**: ヒアリングフローのロジックを制御するエンジンを実装

**Deliverables**:
- [ ] `backend/src/services/hearingFlowEngine.ts`
- [ ] getNextQuestion メソッド
- [ ] shouldSkipQuestion メソッド
- [ ] isSessionComplete メソッド
- [ ] フェーズ遷移ロジック

**Acceptance Criteria**:
- スキップ条件が正しく評価されること
- フェーズ完了判定が正確であること
- 5ターン以内に完了できるフロー制御

**Prerequisite**: TASK-2.1, TASK-2.2, TASK-2.3
**Assignable to**: backend-developer
**Estimated**: 5h

---

### TASK-2.5: EntityBuilder 実装

**Description**: 収集情報から習慣/目標を構築するコンポーネントを実装

**Deliverables**:
- [ ] `backend/src/services/entityBuilder.ts`
- [ ] buildHabit メソッド
- [ ] buildGoal メソッド
- [ ] generateHabitSuggestions メソッド

**Acceptance Criteria**:
- 収集したfactsから完全なHabitオブジェクトが生成できること
- 必須フィールドが全て埋まっていること
- Goal作成時に習慣提案が生成されること

**Prerequisite**: TASK-2.4
**Assignable to**: backend-developer
**Estimated**: 4h

---

## Phase 3: フロントエンドUI (Priority: Medium)

### TASK-3.1: useHearing カスタムフック作成

**Description**: ヒアリング状態を管理するReactフックを作成

**Deliverables**:
- [ ] `frontend/app/dashboard/hooks/useHearing.ts`
- [ ] startHearing, submitAnswer, skipQuestion メソッド
- [ ] セッション状態管理
- [ ] ローディング・エラー状態

**Acceptance Criteria**:
- ヒアリング開始・回答送信ができること
- セッション状態がリアクティブに更新されること
- エラーハンドリングが実装されていること

**Prerequisite**: TASK-1.4
**Assignable to**: frontend-developer
**Estimated**: 3h

---

### TASK-3.2: HearingQuestionCard コンポーネント作成

**Description**: ヒアリング質問を表示するUIコンポーネントを作成

**Deliverables**:
- [ ] `frontend/app/dashboard/components/Widget.HearingQuestionCard.tsx`
- [ ] テキスト入力タイプ
- [ ] 選択肢タイプ (単一・複数)
- [ ] スライダータイプ
- [ ] 時刻選択タイプ

**Acceptance Criteria**:
- 各回答タイプに対応したUIが表示されること
- ヒントが表示されること
- スキップボタンが任意質問で表示されること

**Prerequisite**: TASK-3.1
**Assignable to**: frontend-developer
**Estimated**: 4h

---

### TASK-3.3: HearingProgressIndicator コンポーネント作成

**Description**: ヒアリング進捗を表示するUIコンポーネントを作成

**Deliverables**:
- [ ] `frontend/app/dashboard/components/Widget.HearingProgressIndicator.tsx`
- [ ] フェーズ表示 (1/4 ステップ)
- [ ] 進捗バー
- [ ] フェーズ名表示

**Acceptance Criteria**:
- 現在のフェーズと全体の進捗が表示されること
- アニメーションがスムーズであること

**Prerequisite**: None
**Assignable to**: frontend-developer
**Estimated**: 2h

---

### TASK-3.4: HearingSummaryCard コンポーネント作成

**Description**: ヒアリング結果サマリーを表示するUIコンポーネントを作成

**Deliverables**:
- [ ] `frontend/app/dashboard/components/Widget.HearingSummaryCard.tsx`
- [ ] 収集データの要約表示
- [ ] 編集ボタン (各フィールド)
- [ ] 確認・キャンセルボタン

**Acceptance Criteria**:
- 収集した情報が一覧表示されること
- 各項目をクリックして編集に戻れること
- 確認ボタンで習慣/目標作成に進めること

**Prerequisite**: TASK-3.2
**Assignable to**: frontend-developer
**Estimated**: 3h

---

## Phase 4: THLI連携 (Priority: Medium)

### TASK-4.1: THLI Fact マッピング

**Description**: ヒアリング質問とTHLI F01-F16 factのマッピングを実装

**Deliverables**:
- [ ] `backend/src/data/thliFactMapping.ts`
- [ ] 質問ID → FactID マッピング
- [ ] 回答 → FactValue 変換ロジック

**Acceptance Criteria**:
- ヒアリング回答がTHLI factsに正しくマッピングされること
- uType, eType が適切に設定されること

**Prerequisite**: TASK-2.4
**Assignable to**: backend-developer
**Estimated**: 3h

---

### TASK-4.2: VOI ベース質問優先度

**Description**: Value of Information に基づく質問優先度を実装

**Deliverables**:
- [ ] `backend/src/services/voiCalculator.ts`
- [ ] calculateVOI メソッド
- [ ] prioritizeQuestions メソッド

**Acceptance Criteria**:
- 各質問のVOIスコアが計算できること
- ICI向上に最も寄与する質問が優先されること

**Prerequisite**: TASK-4.1
**Assignable to**: backend-developer
**Estimated**: 3h

---

### TASK-4.3: THLI評価ヒアリングモード

**Description**: THLI評価専用のヒアリングモードを実装

**Deliverables**:
- [ ] THLI_ASSESSMENT_PHASES 定義追加
- [ ] ICI計算とFirewallチェック
- [ ] レベル評価結果の表示

**Acceptance Criteria**:
- 5ターン以内にICI >= 0.6に到達できること
- 到達しない場合はconservative estimateにフォールバック
- レベル評価結果がユーザーフレンドリーに表示されること

**Prerequisite**: TASK-4.2
**Assignable to**: backend-developer
**Estimated**: 4h

---

## Phase 5: テスト・最適化 (Priority: High)

### TASK-5.1: 単体テスト作成

**Description**: 各コンポーネントの単体テストを作成

**Deliverables**:
- [ ] `backend/__tests__/services/hearingService.test.ts`
- [ ] `backend/__tests__/services/questionGenerator.test.ts`
- [ ] `backend/__tests__/services/answerParser.test.ts`
- [ ] `backend/__tests__/services/inferenceEngine.test.ts`

**Acceptance Criteria**:
- 各サービスの主要メソッドがテストされていること
- カバレッジ80%以上

**Prerequisite**: Phase 2 完了
**Assignable to**: tester
**Estimated**: 4h

---

### TASK-5.2: プロパティベーステスト作成

**Description**: 仕様プロパティを検証するテストを作成

**Deliverables**:
- [ ] `backend/__tests__/properties/hearing.properties.test.ts`
- [ ] Property 2: 質問数上限テスト
- [ ] Property 3: ターン数上限テスト
- [ ] Property 5: 推論信頼度テスト

**Acceptance Criteria**:
- 各プロパティが100回以上のランダム入力でパスすること
- テストがfast-checkを使用していること

**Prerequisite**: TASK-5.1
**Assignable to**: tester
**Estimated**: 3h

---

### TASK-5.3: 統合テスト・E2Eテスト

**Description**: 完全なヒアリングフローの統合テストを作成

**Deliverables**:
- [ ] `backend/__tests__/integration/hearing.integration.test.ts`
- [ ] 新規習慣ヒアリングフロー
- [ ] セッション中断・再開フロー
- [ ] エラーリカバリーフロー

**Acceptance Criteria**:
- 開始から完了までの完全なフローがテストされていること
- 主要な分岐パターンがカバーされていること

**Prerequisite**: TASK-5.1
**Assignable to**: tester
**Estimated**: 4h

---

## Dependency Graph

```
TASK-1.1 ─────┬─> TASK-1.2 ─────┬─> TASK-1.4
              │                  │
TASK-1.3 ─────┼─> TASK-2.1 ─────┤
              │                  │
              ├─> TASK-2.2 ──────┤
              │                  │
              └─> TASK-2.3 ──────┼─> TASK-2.4 ─────> TASK-2.5
                                 │
                                 └─> TASK-1.4 ─────> TASK-3.1 ─────┐
                                                                    │
TASK-3.3 (independent) ────────────────────────────────────────────┤
                                                                    │
                                                    TASK-3.2 ──────┼─> TASK-3.4
                                                                    │
TASK-2.4 ─────> TASK-4.1 ─────> TASK-4.2 ─────> TASK-4.3          │
                                                                    │
Phase 2 完了 ─────> TASK-5.1 ─────> TASK-5.2                        │
                                    │                               │
                                    └─────> TASK-5.3 <──────────────┘
```

## Parallel Development Opportunities

以下のタスクは独立して並列実行可能:

1. **TASK-1.3** (フェーズ定義) と **TASK-2.2** (AnswerParser)
2. **TASK-3.3** (ProgressIndicator) は他タスクと独立
3. **TASK-4.1** (THLIマッピング) は Phase 2 完了後すぐ開始可能

## Agent Coordination Notes

### ファイル競合回避

- **HearingService関連**: backend-developer 1名のみ
- **UIコンポーネント**: frontend-developer 1名のみ
- **テスト**: tester が Phase 2 完了後に着手

### コミュニケーションポイント

- [ ] Phase 1 完了時: API仕様レビュー
- [ ] Phase 2 完了時: エンジンロジックレビュー
- [ ] Phase 3 完了時: UI/UXレビュー
- [ ] Phase 5 完了時: 最終統合テスト

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-06 | vow-spec-architect | Initial task definition |
