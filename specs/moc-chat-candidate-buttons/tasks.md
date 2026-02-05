# MOCセクション チャット候補ボタン機能改善 - タスク一覧

## Overview

- **Purpose**: 実装タスクの詳細と依存関係
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect
- **Total Tasks**: 25タスク
- **Estimated Time**: 40時間

## Task Summary by Phase

| Phase | Tasks | Est. Hours | Parallelizable |
|-------|-------|------------|----------------|
| Phase 1: Type Definitions | 3 | 4h | Yes |
| Phase 2: Frontend Components | 6 | 10h | Yes |
| Phase 3: Backend Tools | 5 | 10h | Yes |
| Phase 4: Integration | 5 | 10h | Partial |
| Phase 5: Testing | 6 | 6h | Yes |

---

## Phase 1: Type Definitions (型定義)

### Task 1.1: Create Candidate Button Type Definitions

- **ID**: TASK-1.1
- **Priority**: P1 (Critical Path)
- **Estimated**: 2h
- **Assignable To**: Frontend Developer, Backend Developer
- **Dependencies**: None
- **Parallelizable**: Yes

**Description**:
候補ボタン機能に必要な型定義ファイルを作成する。

**Deliverables**:
- [ ] `frontend/app/dashboard/types/candidate-button.types.ts`

**Type Definitions to Include**:
```typescript
// ButtonType, UserInfoContext, UnifiedButton,
// HabitDetail, GoalDetail, StickyNDetail, ReplyDetail,
// UnifiedChatResponse
```

**Acceptance Criteria**:
- [ ] 全ての型がTypeScriptコンパイルを通過
- [ ] JSDocコメント付き
- [ ] exportが正しく設定されている

---

### Task 1.2: Create Zod Validation Schemas

- **ID**: TASK-1.2
- **Priority**: P1 (Critical Path)
- **Estimated**: 1h
- **Assignable To**: Backend Developer
- **Dependencies**: TASK-1.1
- **Parallelizable**: Yes (after 1.1)

**Description**:
バックエンドでの応答検証用Zodスキーマを作成する。

**Deliverables**:
- [ ] `backend/src/schemas/candidate-button.schema.ts`

**Schemas to Include**:
```typescript
// ButtonSchema, UserInfoSchema, UnifiedResponseSchema
```

**Acceptance Criteria**:
- [ ] 全てのスキーマがzodバリデーションテストを通過
- [ ] エラーメッセージが日本語対応

---

### Task 1.3: Export Type Definitions

- **ID**: TASK-1.3
- **Priority**: P2
- **Estimated**: 1h
- **Assignable To**: Any Developer
- **Dependencies**: TASK-1.1, TASK-1.2
- **Parallelizable**: No

**Description**:
型定義をindex.tsからエクスポートし、既存のtypesと統合する。

**Deliverables**:
- [ ] `frontend/app/dashboard/types/index.ts` 更新
- [ ] `backend/src/schemas/index.ts` 更新

**Acceptance Criteria**:
- [ ] 他のファイルからimport可能
- [ ] 既存の型定義と競合しない

---

## Phase 2: Frontend Components (フロントエンドコンポーネント)

### Task 2.1: Create CandidateCard Component

- **ID**: TASK-2.1
- **Priority**: P1 (Critical Path)
- **Estimated**: 3h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-1.1
- **Parallelizable**: Yes

**Description**:
候補カードコンポーネントを作成する。Habit/Goal/Sticky'n型とreply型の両方に対応。

**Deliverables**:
- [ ] `frontend/app/dashboard/components/CandidateCard.tsx`
- [ ] `frontend/app/dashboard/components/CandidateCard.test.tsx`

**Implementation Details**:
- Habit/Goal/Sticky'n型: [採用][却下][詳細]ボタン表示
- reply型: 単一クリックボタン表示
- タイプバッジの色分け
- ホバーエフェクト
- 日本語/英語対応

**Acceptance Criteria**:
- [ ] 4種類のボタンタイプに対応
- [ ] アクションボタンがクリック可能
- [ ] ユニットテスト通過

---

### Task 2.2: Create QuestionFlowIndicator Component

- **ID**: TASK-2.2
- **Priority**: P2
- **Estimated**: 1.5h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-1.1
- **Parallelizable**: Yes

**Description**:
質問フローの進行状況を表示するインジケーターコンポーネントを作成する。

**Deliverables**:
- [ ] `frontend/app/dashboard/components/QuestionFlowIndicator.tsx`
- [ ] `frontend/app/dashboard/components/QuestionFlowIndicator.test.tsx`

**Implementation Details**:
- 3ステップ表示（情報種類、カテゴリ、詳細）
- 現在のステップをハイライト
- 完了したステップにチェックマーク
- 日本語/英語対応

**Acceptance Criteria**:
- [ ] ステップ進行が視覚的に分かる
- [ ] ユニットテスト通過

---

### Task 2.3: Create RefineButtonGroup Component

- **ID**: TASK-2.3
- **Priority**: P2
- **Estimated**: 1h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-1.1
- **Parallelizable**: Yes

**Description**:
「もっと具体的に」「もっと一般的に」ボタングループを作成する。

**Deliverables**:
- [ ] `frontend/app/dashboard/components/RefineButtonGroup.tsx`
- [ ] `frontend/app/dashboard/components/RefineButtonGroup.test.tsx`

**Acceptance Criteria**:
- [ ] 両ボタンがクリック可能
- [ ] コールバック関数が正しく呼ばれる
- [ ] 日本語/英語対応

---

### Task 2.4: Create useQuestionFlow Hook

- **ID**: TASK-2.4
- **Priority**: P1 (Critical Path)
- **Estimated**: 2h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-1.1
- **Parallelizable**: Yes

**Description**:
質問フローの状態を管理するカスタムフックを作成する。

**Deliverables**:
- [ ] `frontend/app/dashboard/hooks/useQuestionFlow.ts`
- [ ] `frontend/app/dashboard/hooks/useQuestionFlow.test.ts`

**Implementation Details**:
```typescript
interface UseQuestionFlowReturn {
  currentStep: QuestionFlowStep;
  userInfo: UserInfoContext;
  setInfoType: (type: string) => void;
  setCategory: (category: string) => void;
  setSubCategory: (subCategory: string) => void;
  reset: () => void;
}
```

**Acceptance Criteria**:
- [ ] 状態遷移が正しく動作
- [ ] リセット機能が動作
- [ ] ユニットテスト通過

---

### Task 2.5: Create Response Parser Utility

- **ID**: TASK-2.5
- **Priority**: P1 (Critical Path)
- **Estimated**: 1.5h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-1.1
- **Parallelizable**: Yes

**Description**:
統一JSON形式をパースしてGroupChatMessageに変換するユーティリティを作成する。

**Deliverables**:
- [ ] `frontend/app/dashboard/utils/responseParser.ts`
- [ ] `frontend/app/dashboard/utils/responseParser.test.ts`

**Functions to Implement**:
```typescript
parseUnifiedResponse(json: string): UnifiedChatResponse;
convertToGroupChatMessage(response: UnifiedChatResponse, messageId: string): GroupChatMessage;
isUnifiedResponse(data: unknown): data is UnifiedChatResponse;
```

**Acceptance Criteria**:
- [ ] JSONパースが正常に動作
- [ ] 不正なJSONでエラーハンドリング
- [ ] 既存形式との後方互換性

---

### Task 2.6: Create CSS Styles

- **ID**: TASK-2.6
- **Priority**: P2
- **Estimated**: 1h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-2.1, TASK-2.2, TASK-2.3
- **Parallelizable**: No

**Description**:
候補カード関連のCSSスタイルを作成する。

**Deliverables**:
- [ ] `frontend/app/dashboard/styles/candidate-card.css` または Tailwind classes

**Acceptance Criteria**:
- [ ] デザインシステムに準拠
- [ ] ダークモード対応
- [ ] レスポンシブ対応

---

## Phase 3: Backend Tools (バックエンドツール)

### Task 3.1: Create ResponseFormatter Service

- **ID**: TASK-3.1
- **Priority**: P1 (Critical Path)
- **Estimated**: 2h
- **Assignable To**: Backend Developer
- **Dependencies**: TASK-1.2
- **Parallelizable**: Yes

**Description**:
AI応答を統一形式にフォーマットするサービスを作成する。

**Deliverables**:
- [ ] `backend/src/services/ResponseFormatter.ts`
- [ ] `backend/src/services/ResponseFormatter.test.ts`

**Methods to Implement**:
```typescript
static ensureButtonsPresent(response: Partial<UnifiedChatResponse>): UnifiedChatResponse;
static validate(response: unknown): UnifiedChatResponse;
static formatHabitSuggestion(habit: HabitSuggestion): UnifiedButton;
static formatGoalSuggestion(goal: GoalSuggestion): UnifiedButton;
```

**Acceptance Criteria**:
- [ ] ボタンが0件の場合にデフォルトボタンが追加される
- [ ] バリデーションエラーが適切にスローされる
- [ ] ユニットテスト通過

---

### Task 3.2: Create Question Flow Tool

- **ID**: TASK-3.2
- **Priority**: P1 (Critical Path)
- **Estimated**: 2h
- **Assignable To**: Backend Developer
- **Dependencies**: TASK-1.2
- **Parallelizable**: Yes

**Description**:
質問フローのステップを表示するMastraツールを作成する。

**Deliverables**:
- [ ] `backend/src/agents/mastra/tools/question-flow.ts`
- [ ] `backend/src/agents/mastra/tools/question-flow.test.ts`

**Implementation Details**:
- `show_question_flow` ツール
- Step定義（info_type, category, subcategory）
- 日本語/英語のラベル定義
- カスタムオプション対応

**Acceptance Criteria**:
- [ ] 各ステップで適切なボタンが返される
- [ ] ローカライズが正しく動作
- [ ] ユニットテスト通過

---

### Task 3.3: Create Candidate Button Prompt

- **ID**: TASK-3.3
- **Priority**: P1 (Critical Path)
- **Estimated**: 2h
- **Assignable To**: Backend Developer
- **Dependencies**: None
- **Parallelizable**: Yes

**Description**:
候補ボタン必須ルールを含むシステムプロンプトを作成する。

**Deliverables**:
- [ ] `backend/src/agents/mastra/prompts/candidate-button-prompt.ts`

**Prompt Sections**:
- 候補ボタン必須ルール
- ボタンタイプの説明
- 質問フローの手順
- 禁止事項
- JSON応答形式

**Acceptance Criteria**:
- [ ] AIが一貫してボタン付き応答を返す
- [ ] 質問フローが正しく実行される

---

### Task 3.4: Update VowCoachAgent

- **ID**: TASK-3.4
- **Priority**: P1 (Critical Path)
- **Estimated**: 2h
- **Assignable To**: Backend Developer
- **Dependencies**: TASK-3.1, TASK-3.2, TASK-3.3
- **Parallelizable**: No

**Description**:
VowCoachAgentに新しいプロンプトとツールを統合する。

**Deliverables**:
- [ ] `backend/src/agents/mastra/vow-coach-agent.ts` 更新

**Changes**:
- システムプロンプトに候補ボタンルール追加
- `show_question_flow` ツール追加
- ResponseFormatterによる出力整形

**Acceptance Criteria**:
- [ ] 既存機能に影響なし
- [ ] 新機能が正しく動作
- [ ] ビルド成功

---

### Task 3.5: Update ManagerAgent

- **ID**: TASK-3.5
- **Priority**: P1 (Critical Path)
- **Estimated**: 2h
- **Assignable To**: Backend Developer
- **Dependencies**: TASK-3.1, TASK-3.2, TASK-3.3
- **Parallelizable**: Yes (with 3.4)

**Description**:
ManagerAgentに新しいプロンプトとツールを統合する。

**Deliverables**:
- [ ] `backend/src/agents/mastra/agents/manager-agent.ts` 更新

**Changes**:
- システムプロンプトに候補ボタンルール追加
- `show_question_flow` ツール追加
- ResponseFormatterによる出力整形

**Acceptance Criteria**:
- [ ] 既存機能に影響なし
- [ ] 新機能が正しく動作
- [ ] ビルド成功

---

## Phase 4: Integration (統合)

### Task 4.1: Integrate CandidateCard into Section.MOC

- **ID**: TASK-4.1
- **Priority**: P1 (Critical Path)
- **Estimated**: 3h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-2.1, TASK-2.5
- **Parallelizable**: No

**Description**:
CandidateCardコンポーネントをSection.MOC.tsxに統合する。

**Deliverables**:
- [ ] `frontend/app/dashboard/components/Section.MOC.tsx` 更新

**Changes**:
- CandidateCardのインポートと使用
- 既存のSuggestionCard置き換え
- ボタンアクションハンドラー接続
- モーダル表示ロジック

**Acceptance Criteria**:
- [ ] 候補カードが正しく表示される
- [ ] [採用][却下][詳細]ボタンが動作する
- [ ] 既存機能に影響なし

---

### Task 4.2: Update useMastraAgent for Unified Response

- **ID**: TASK-4.2
- **Priority**: P1 (Critical Path)
- **Estimated**: 2h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-2.5
- **Parallelizable**: Yes (with 4.3)

**Description**:
useMastraAgentフックを統一応答形式に対応させる。

**Deliverables**:
- [ ] `frontend/app/dashboard/hooks/useMastraAgent.ts` 更新

**Changes**:
- 応答パーサーの統合
- 統一形式の検出と変換
- 後方互換性の維持

**Acceptance Criteria**:
- [ ] 統一形式の応答をパース可能
- [ ] 既存形式との後方互換性
- [ ] ストリーミング対応

---

### Task 4.3: Update useMcpChat for Unified Response

- **ID**: TASK-4.3
- **Priority**: P1 (Critical Path)
- **Estimated**: 2h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-2.5
- **Parallelizable**: Yes (with 4.2)

**Description**:
useMcpChatフックを統一応答形式に対応させる。

**Deliverables**:
- [ ] `frontend/app/dashboard/hooks/useMcpChat.ts` 更新

**Changes**:
- 応答パーサーの統合
- 統一形式の検出と変換
- 後方互換性の維持

**Acceptance Criteria**:
- [ ] 統一形式の応答をパース可能
- [ ] 既存形式との後方互換性
- [ ] ストリーミング対応

---

### Task 4.4: Integrate QuestionFlow Components

- **ID**: TASK-4.4
- **Priority**: P2
- **Estimated**: 2h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-2.2, TASK-2.4, TASK-4.1
- **Parallelizable**: No

**Description**:
質問フローインジケーターとフックをSection.MOCに統合する。

**Deliverables**:
- [ ] `frontend/app/dashboard/components/Section.MOC.tsx` 更新

**Changes**:
- QuestionFlowIndicatorの表示
- useQuestionFlowフックの使用
- ステップ遷移ロジック

**Acceptance Criteria**:
- [ ] インジケーターが正しく表示される
- [ ] ステップ遷移が正しく動作する

---

### Task 4.5: Integrate RefineButtonGroup

- **ID**: TASK-4.5
- **Priority**: P2
- **Estimated**: 1h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-2.3, TASK-4.1
- **Parallelizable**: No

**Description**:
RefineButtonGroupを候補カード表示時に統合する。

**Deliverables**:
- [ ] `frontend/app/dashboard/components/Section.MOC.tsx` 更新

**Changes**:
- RefineButtonGroupの条件付き表示
- 再提案リクエスト送信

**Acceptance Criteria**:
- [ ] 候補表示時にボタンが表示される
- [ ] クリックで再提案が動作する

---

## Phase 5: Testing (テスト)

### Task 5.1: Unit Tests - Frontend Components

- **ID**: TASK-5.1
- **Priority**: P1
- **Estimated**: 1.5h
- **Assignable To**: Frontend Developer
- **Dependencies**: TASK-2.1, TASK-2.2, TASK-2.3
- **Parallelizable**: Yes

**Description**:
フロントエンドコンポーネントのユニットテストを実行・確認する。

**Deliverables**:
- [ ] 全テスト通過確認

**Test Coverage**:
- CandidateCard: 4タイプのレンダリング、アクション
- QuestionFlowIndicator: ステップ表示、ハイライト
- RefineButtonGroup: クリックイベント

**Acceptance Criteria**:
- [ ] カバレッジ80%以上
- [ ] 全テスト通過

---

### Task 5.2: Unit Tests - Backend Services

- **ID**: TASK-5.2
- **Priority**: P1
- **Estimated**: 1h
- **Assignable To**: Backend Developer
- **Dependencies**: TASK-3.1, TASK-3.2
- **Parallelizable**: Yes

**Description**:
バックエンドサービスのユニットテストを実行・確認する。

**Deliverables**:
- [ ] 全テスト通過確認

**Test Coverage**:
- ResponseFormatter: 各メソッド
- QuestionFlowTool: 各ステップ

**Acceptance Criteria**:
- [ ] カバレッジ80%以上
- [ ] 全テスト通過

---

### Task 5.3: Integration Tests

- **ID**: TASK-5.3
- **Priority**: P1
- **Estimated**: 1.5h
- **Assignable To**: Any Developer
- **Dependencies**: Phase 4完了
- **Parallelizable**: Yes (with 5.4)

**Description**:
フロントエンド-バックエンド間の統合テストを実行する。

**Deliverables**:
- [ ] 統合テスト作成・実行

**Test Scenarios**:
- 質問フロー完了フロー
- 候補カードアクション
- モーダル表示

**Acceptance Criteria**:
- [ ] 全テストシナリオ通過

---

### Task 5.4: E2E Tests

- **ID**: TASK-5.4
- **Priority**: P1
- **Estimated**: 1.5h
- **Assignable To**: Any Developer
- **Dependencies**: Phase 4完了
- **Parallelizable**: Yes (with 5.3)

**Description**:
Playwrightによるエンドツーエンドテストを実行する。

**Deliverables**:
- [ ] `frontend/e2e/candidate-buttons.spec.ts`

**Test Scenarios**:
- 質問フロー全ステップ
- 候補カード採用
- 候補カード却下
- 詳細モーダル
- 再提案機能

**Acceptance Criteria**:
- [ ] 全E2Eシナリオ通過

---

### Task 5.5: Manual QA Testing

- **ID**: TASK-5.5
- **Priority**: P1
- **Estimated**: 1h
- **Assignable To**: Any Developer
- **Dependencies**: Phase 4完了
- **Parallelizable**: Yes

**Description**:
手動でのQAテストを実施する。

**Test Items**:
- [ ] 全てのAI応答にボタンが表示される
- [ ] 質問フローが正しく進行する
- [ ] [採用]でモーダルが開く
- [ ] [却下]で別の候補が表示される
- [ ] [詳細]で編集モーダルが開く
- [ ] reply型ボタンで回答が送信される
- [ ] 再提案ボタンが動作する
- [ ] 日本語/英語が正しく表示される

**Acceptance Criteria**:
- [ ] 全チェック項目OK

---

### Task 5.6: Performance Testing

- **ID**: TASK-5.6
- **Priority**: P2
- **Estimated**: 0.5h
- **Assignable To**: Any Developer
- **Dependencies**: Phase 4完了
- **Parallelizable**: Yes

**Description**:
パフォーマンス要件の確認を行う。

**Test Items**:
- [ ] JSONパース: 10ms以内
- [ ] ボタンクリック応答: 100ms以内
- [ ] モーダル表示: 200ms以内

**Acceptance Criteria**:
- [ ] 全パフォーマンス基準クリア

---

## Task Dependency Graph

```
Phase 1: Type Definitions
┌─────────────────────────────────────────────┐
│  TASK-1.1 ──────────────────────────────────┼───┐
│  (Type Definitions)                         │   │
└─────────────────────────────────────────────┘   │
     │                                             │
     ▼                                             │
┌─────────────────────────────────────────────┐   │
│  TASK-1.2                                   │   │
│  (Zod Schemas)                              │   │
└─────────────────────────────────────────────┘   │
     │                                             │
     ▼                                             │
┌─────────────────────────────────────────────┐   │
│  TASK-1.3                                   │   │
│  (Export Types)                             │   │
└─────────────────────────────────────────────┘   │
                                                   │
Phase 2: Frontend (can start after 1.1)            │
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│ TASK-2.1 │ │ TASK-2.2 │ │ TASK-2.3 │ │TASK-2.4 ││
│ Candidate│ │ Question │ │ Refine   │ │Question ││
│ Card     │ │ Flow Ind │ │ Buttons  │ │Flow Hook││
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘│
     │            │            │            │     │
     └────────────┼────────────┼────────────┘     │
                  │            │                  │
                  ▼            │                  │
           ┌──────────┐       │                  │
           │ TASK-2.6 │       │                  │
           │ CSS      │       │                  │
           └──────────┘       │                  │
                              │                  │
┌──────────────────────────────┘                  │
│                                                 │
│  ┌──────────┐                                   │
│  │ TASK-2.5 │◄──────────────────────────────────┘
│  │ Response │
│  │ Parser   │
│  └────┬─────┘
│       │
Phase 3: Backend (can start after 1.2)
│  ┌──────────┐ ┌──────────┐ ┌──────────┐
│  │ TASK-3.1 │ │ TASK-3.2 │ │ TASK-3.3 │
│  │ Response │ │ Question │ │ Prompt   │
│  │ Formatter│ │ Flow Tool│ │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘
│       │            │            │
│       └────────────┼────────────┘
│                    │
│       ┌────────────┼────────────┐
│       ▼            ▼            ▼
│  ┌──────────┐ ┌──────────┐
│  │ TASK-3.4 │ │ TASK-3.5 │
│  │ Update   │ │ Update   │
│  │ VowCoach │ │ Manager  │
│  └────┬─────┘ └────┬─────┘
│       │            │
Phase 4: Integration (after Phase 2 & 3)
│       │            │
│  ┌────┴────────────┴────┐
│  │                      │
│  ▼                      ▼
│  ┌──────────┐    ┌──────────┐ ┌──────────┐
│  │ TASK-4.1 │    │ TASK-4.2 │ │ TASK-4.3 │
│  │ Integrate│    │ Update   │ │ Update   │
│  │ Cards    │◄───┤ Mastra   │ │ McpChat  │
│  └────┬─────┘    └──────────┘ └──────────┘
│       │
│       ▼
│  ┌──────────┐ ┌──────────┐
│  │ TASK-4.4 │ │ TASK-4.5 │
│  │ Question │ │ Refine   │
│  │ Flow     │ │ Buttons  │
│  └────┬─────┘ └────┬─────┘
│       │            │
Phase 5: Testing (after Phase 4)
│       └────────────┘
│              │
│              ▼
│  ┌──────────┐ ┌──────────┐ ┌──────────┐
│  │ TASK-5.1 │ │ TASK-5.2 │ │ TASK-5.3 │
│  │ Unit FE  │ │ Unit BE  │ │ Integr.  │
│  └──────────┘ └──────────┘ └────┬─────┘
│                                 │
│  ┌──────────┐ ┌──────────┐ ┌────┴─────┐
│  │ TASK-5.4 │ │ TASK-5.5 │ │ TASK-5.6 │
│  │ E2E      │ │ Manual QA│ │ Perf     │
│  └──────────┘ └──────────┘ └──────────┘
```

## Parallel Execution Plan

### Recommended Agent Assignment

| Agent Role | Assigned Tasks |
|------------|----------------|
| **Frontend Dev A** | TASK-1.1, TASK-2.1, TASK-2.4, TASK-4.1, TASK-4.4 |
| **Frontend Dev B** | TASK-2.2, TASK-2.3, TASK-2.5, TASK-2.6, TASK-4.5 |
| **Backend Dev A** | TASK-1.2, TASK-3.1, TASK-3.4 |
| **Backend Dev B** | TASK-3.2, TASK-3.3, TASK-3.5 |
| **Tester** | TASK-5.1, TASK-5.2, TASK-5.3, TASK-5.4, TASK-5.5, TASK-5.6 |
| **Any** | TASK-1.3, TASK-4.2, TASK-4.3 |

### Timeline (Parallel Execution)

| Day | Tasks |
|-----|-------|
| Day 1 | TASK-1.1, TASK-1.2, TASK-3.3 (parallel) |
| Day 2 | TASK-1.3, TASK-2.1, TASK-2.2, TASK-2.3, TASK-2.4, TASK-2.5, TASK-3.1, TASK-3.2 (parallel) |
| Day 3 | TASK-2.6, TASK-3.4, TASK-3.5 (parallel) |
| Day 4 | TASK-4.1, TASK-4.2, TASK-4.3 (parallel) |
| Day 5 | TASK-4.4, TASK-4.5 (sequential) |
| Day 6 | TASK-5.1, TASK-5.2, TASK-5.3, TASK-5.4 (parallel) |
| Day 7 | TASK-5.5, TASK-5.6, Buffer |

**Total: 7 working days (with 2+ agents working in parallel)**
