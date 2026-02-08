# VOW Project - Agent Coordination File

> **Note**: このファイルはMCP Remote統合スプリント専用です。
> - AI Agents統合スプリント: `/.kiro/specs/COORDINATION.md`
> - 全体ガイド: `/CLAUDE.md`
> - タスク割り当てボード: `/.claude/coordination/BOARD.md`

## Overview
このファイルは複数のAIエージェント（異なるマシン上のエージェントを含む）間の調整を行うためのものです。
全てのエージェントは作業開始前にこのファイルを確認し、作業完了時に更新してください。

---

## Current Sprint: MCP Remote Integration

### Sprint Goal
MOCセクションへのMCPリモート接続統合により、VOWプロジェクトの改修作業をWeb UIから指示できるようにする。

### Sprint Period
2026-02-03 ~ 2026-02-17 (2 weeks)

### Priority Order
1. Phase 1: Basic Remote Execution (Week 1)
2. Phase 2: Git Integration (Week 1-2)
3. Phase 3: Code Review UI (Week 2)

---

## Active Specifications

| Spec ID | Name | Status | Lead Agent |
|---------|------|--------|------------|
| **MOC-TASK-KANBAN-001** | **MOC Task Kanban + Remote CLI Skill Set** | **Specification Complete** | **vow-spec-architect** |
| **REMOTE-CLI-001** | **Remote CLI Role** | **Specification Complete** | **vow-spec-architect** |
| **MOC-REFACTOR-001** | **Section.MOC.tsx Refactoring** | **Specification Complete** | **vow-spec-architect** |
| **VOW-INSTALLER-001** | **VOW Application Installer** | **Draft** | **vow-spec-architect** |
| **MOC-CANDIDATE-BTN-001** | **MOC Chat Candidate Buttons Enhancement** | **Draft** | **vow-spec-architect** |
| **UNIFIED-001** | **Unified Chat Response Format** | **Draft** | **vow-spec-architect** |
| MOC-MCP-001 | MOC Section MCP Remote Integration | Investigation Complete | vow-spec-architect |
| ISS-20260204-018 | Claude Executor Service | Implementation Complete | vow-spec-architect |
| ISS-20260204-019 | Goal Planner Existing Goals Reference | Implementation Complete | vow-spec-architect |
| CHAT-FIX-001 | Chat No Response Bug Fix | Implementation Complete | vow-spec-architect |
| MCP-MEM-001 | MCP Conversation Memory | Implementation Complete | vow-spec-architect |
| SUGG-BTN-001 | Suggestion Buttons Fix | Implementation Complete | vow-spec-architect |
| CAT-DRILL-001 | Category Drilldown (Fukabori) Feature | Implementation Complete | vow-spec-architect |
| QA-PATROL-001 | QA Patrol Agent Refactor (Static Questions) | Implementation Complete | vow-spec-architect |
| ISS-1b9a14fe | Goal候補ボタン表示修正 | Implementation Complete | vow-spec-architect |
| ISS-20260204-031 | Goal/Habit型ボタン表示問題 | Implementation Complete | vow-spec-architect |
| ISS-20260204-030 | Habit候補複数表示問題 | Implementation Complete | vow-spec-architect |
| E2E-CHAT-001 | WEBUI E2E Chat Test | Specification Complete | vow-spec-architect |

### New Specification: UNIFIED-001

**Unified Chat Response Format** - AIエージェント出力形式の統一化

- **Spec Location**: `/home/ubuntu/Downloads/vow/specs/unified-chat-response-format/`
- **Requirements**: `requirements.md` - 統一JSON形式の詳細仕様
- **Design**: `design.md` - バックエンド/フロントエンド設計
- **Tasks**: `tasks.md` - 18タスク、推定20時間

**統一形式の概要:**
```json
{
  "message": "AI応答テキスト",
  "userInfo": {
    "about_type": "Habit" | "Goal" | "Sticky'n(MEMO)" | null,
    "about_operation": "新規提案" | "見直し" | "確認" | "アドバイス" | null,
    "about_category": ["health", "learning"]
  },
  "buttons": [
    { "type": "Habit", "label": "朝の5分ストレッチ", "comment": "説明", "detail": {...} }
  ]
}
```

---

## Task Assignments

### Currently In Progress

| Task ID | Task Name | Assigned To | Started | Status |
|---------|-----------|-------------|---------|--------|
| - | - | - | - | - |

### Ready for Assignment

| Task ID | Task Name | Prerequisites | Recommended Agent |
|---------|-----------|---------------|-------------------|
| 1.1 | Claude Executor Service | None | Backend Developer |
| 1.2 | Remote Task API Endpoint | 1.1 | Backend Developer |
| 1.3 | Output Streaming Endpoint | 1.2 | Backend Developer |
| 1.4 | Remote Task UI - Input Form | 1.2 | Frontend Developer |
| 1.5 | Execution Monitor Component | 1.3 | Frontend Developer |

### Completed

| Task ID | Task Name | Completed By | Date |
|---------|-----------|--------------|------|
| - | - | - | - |

---

## File Locks

エージェントが作業中のファイルは、他のエージェントは編集しないでください。

| File Path | Locked By | Since | Purpose |
|-----------|-----------|-------|---------|
| - | - | - | - |

---

## Integration Points

### Backend <-> Frontend Integration
- API Contract: See `specs/moc-mcp-remote-integration/architecture-design.md`
- Mock Data: TBD

### MCP Task Server <-> Claude Code Integration
- Existing: MCP Bridge (`mcp-config.json`)
- New: Claude Executor Service

---

## Blocking Issues

| Issue | Blocking Tasks | Owner | ETA |
|-------|---------------|-------|-----|
| None | - | - | - |

---

## Communication Log

### 2026-02-05
- **vow-spec-architect**: MOC-REFACTOR-001 Section.MOC.tsx Refactoring Specification completed.
  - Purpose: 4,507行の巨大ファイル Section.MOC.tsx を保守しやすい小さなモジュールに分割する
  - Target File: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
  - Current Size: 4,507 lines
  - Target Size: < 2,000 lines
  - Identified Sub-Components (11):
    - GroupChatView (2699-2818, ~120 lines)
    - ChatMessageBubble (2820-3024, ~205 lines)
    - SuggestionCard (3026-3202, ~177 lines)
    - TaskListView (3204-3296, ~93 lines)
    - TaskSection (3298-3358, ~61 lines)
    - TaskDetailModal (3360-3508, ~149 lines)
    - AgentListView (3510-3943, ~434 lines)
    - RemoteAgentInstaller (3945-4127, ~183 lines)
    - RemoteAgentGuide (4129-4193, ~65 lines)
    - RemoteTaskExecutor (4195-4442, ~248 lines)
    - HistoryView (4444-4501, ~58 lines)
  - Created Files:
    - `/home/ubuntu/Downloads/vow/specs/moc-section-refactoring/requirements.md` - 9 FR + 5 NFR + 5 AC
    - `/home/ubuntu/Downloads/vow/specs/moc-section-refactoring/design.md` - アーキテクチャ、インターフェース契約、マイグレーション戦略
    - `/home/ubuntu/Downloads/vow/specs/moc-section-refactoring/tasks.md` - 42タスク（9フェーズ、推定28時間）
  - Task Phases:
    - Phase 1: Type Definitions (3 tasks, 1.5h) - Low Risk
    - Phase 2: Parser Functions (4 tasks, 3h) - Low Risk
    - Phase 3: SuggestionCard (4 tasks, 2.5h) - Medium Risk
    - Phase 4: ChatMessageBubble (4 tasks, 3h) - Medium Risk
    - Phase 5: Task Components (5 tasks, 2.5h) - Low Risk
    - Phase 6: Agent Components (6 tasks, 5h) - Medium-High Risk
    - Phase 7: Custom Hooks (6 tasks, 6h) - High Risk
    - Phase 8: Integration (5 tasks, 2.5h) - Medium Risk
    - Phase 9: Testing & Cleanup (5 tasks, 2h) - Low Risk
  - Parallel Execution: 3エージェントで12時間（単独28時間）
    - Agent A: Frontend Focus (Phase 1, 3, 4) - 7h
    - Agent B: Backend/Utils Focus (Phase 2, 7 partial) - 7h
    - Agent C: Components Focus (Phase 5, 6) - 7.5h
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/moc-section-refactoring/`
  - Status: Specification complete, ready for implementation
  - Next Steps: Phase 1 - TASK-1.1 Create Type Definition File (`types/moc.types.ts`)

- **vow-spec-architect**: VOW-INSTALLER-001 VOW Application Installer Specification created.
  - Purpose: VOWアプリケーション全体をワンコマンドでセットアップできる統合インストーラ
  - Key Features:
    - ワンコマンド実行 (`./install.sh`)
    - 前提条件チェック（Node.js 20+, npm, git）
    - 対話的セットアップウィザード
    - 環境変数ファイル自動生成（.env.local）
    - 依存関係インストール（Frontend/Backend）
    - ビルド/テスト実行
    - 開発サーバー起動スクリプト生成（start-dev.sh, stop-dev.sh）
    - Docker Compose起動オプション
  - Created Files:
    - `/home/ubuntu/Downloads/vow/specs/vow-installer/requirements.md` - 9 FR + 5 NFR + 7 AC
    - `/home/ubuntu/Downloads/vow/specs/vow-installer/design.md` - アーキテクチャ、コンポーネント設計
    - `/home/ubuntu/Downloads/vow/specs/vow-installer/tasks.md` - 21タスク（4フェーズ、推定16時間）
  - Task Phases:
    - Phase 1: Foundation (9 tasks, 7h) - 3エージェント並列可能
    - Phase 2: Integration (6 tasks, 5.5h)
    - Phase 3: Main Installer (2 tasks, 2h)
    - Phase 4: Testing & Documentation (4 tasks, 4.5h)
  - Parallel Execution: 3エージェントで並列実行可能
    - Agent A: Core Infrastructure (6h)
    - Agent B: Environment Setup (3.5h)
    - Agent C: Service Management (4h)
  - Estimated Timeline: 10 hours (with 3 agents) / 16 hours (single agent)
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/vow-installer/`
  - Status: Specification complete, ready for implementation
  - Next Steps: Phase 1 - TASK-1.1 共通関数ライブラリ作成

- **vow-spec-architect**: MOC-CANDIDATE-BTN-001 MOC Chat Candidate Buttons Enhancement Specification created.
  - Purpose: MOCセクションのチャット機能において、AIの応答に必ず候補ボタンを表示する改善
  - Key Features:
    - 候補ボタンの必須表示（テキストのみ応答は禁止）
    - 4種類のボタンタイプ: Habit型、Goal型、Sticky'n(MEMO)型、回答型
    - 質問フロー（3ステップ）: 欲しい情報確認 -> カテゴリ確認 -> サブカテゴリ確認
    - 候補カードアクション: [採用][却下][詳細]ボタン
    - 再提案機能: [もっと具体的に][もっと一般的に]ボタン
    - 禁止事項: 「いつやるか」「どこでやるか」といった質問はしない
  - JSON Response Format:
    ```json
    {
      "message": "候補ラベル以外の文章",
      "userInfo": {
        "about_type": "None | Habit | Goal | Sticky'n(MEMO) | others",
        "about_operation": "None | 見直し | 新規提案 | 確認 | アドバイス | others",
        "about_category": [],
        "about_detail": []
      },
      "buttons": [
        { "type": "Habit | Goal | Sticky'n(MEMO) | reply", "label": "...", "comment": "...", "detail": {...} }
      ]
    }
    ```
  - Created Files:
    - `/home/ubuntu/Downloads/vow/specs/moc-chat-candidate-buttons/requirements.md` - 9 FR + 4 NFR
    - `/home/ubuntu/Downloads/vow/specs/moc-chat-candidate-buttons/design.md` - アーキテクチャ、コンポーネント設計
    - `/home/ubuntu/Downloads/vow/specs/moc-chat-candidate-buttons/tasks.md` - 25タスク（5フェーズ、推定40時間）
  - Task Phases:
    - Phase 1: Type Definitions (3 tasks, 4h)
    - Phase 2: Frontend Components (6 tasks, 10h)
    - Phase 3: Backend Tools (5 tasks, 10h)
    - Phase 4: Integration (5 tasks, 10h)
    - Phase 5: Testing (6 tasks, 6h)
  - Parallel Execution: Frontend/Backend作業は並列実行可能
  - Estimated Timeline: 7 working days (with 2+ agents)
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/moc-chat-candidate-buttons/`
  - Status: Specification complete, ready for implementation
  - Next Steps: Phase 1 (Type Definitions) - TASK-1.1 Create Candidate Button Type Definitions

- **vow-spec-architect**: E2E-CHAT-001 WEBUI E2E Chat Test Specification created.
  - Purpose: VOWアプリケーションのWEBUI E2Eテスト仕様を定義
  - Scope:
    - ログイン機能（Google OAuth: k6285620@gmail.com）
    - AIコーチとのチャット機能（MOCセクション）
    - 候補ラベルの型チェック（Habit/Goal/Sticky'n/Reply型）
    - チャットログの記録と保存
  - Technical Requirements:
    - Playwright v1.40+ with TypeScript
    - CI/CD integration (GitHub Actions)
    - Parallel execution support
  - Created Files:
    - `/home/ubuntu/Downloads/vow/specs/e2e-chat-test/requirements.md` - 10要件 + 4 NFR
    - `/home/ubuntu/Downloads/vow/specs/e2e-chat-test/design.md` - アーキテクチャ、Page Objects、Fixtures
    - `/home/ubuntu/Downloads/vow/specs/e2e-chat-test/tasks.md` - 18タスク（4フェーズ、推定26時間）
    - `/home/ubuntu/Downloads/vow/specs/e2e-chat-test/test-scenarios.md` - 15テストシナリオ（P1: 9件、P2: 6件）
  - Key Components:
    - Page Objects: BasePage, LoginPage, DashboardPage, MOCSectionPage
    - Fixtures: AuthFixture, ChatFixture
    - Utilities: ChatLogger, TestData, WaitHelpers
  - Test Scenarios:
    - TS-001: Google OAuth Login
    - TS-002: Basic Chat Interaction
    - TS-003~007: Category Scenarios (Health, Learning, Productivity)
    - TS-008~010: Suggestion Actions (Accept, Snooze, Dismiss)
    - TS-011: Quick Reply Interaction
    - TS-012: Reply Type Verification
    - TS-013: Chat Log Recording
    - TS-014: Error Handling
    - TS-015: Full E2E Flow
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/e2e-chat-test/`
  - Status: Specification complete, ready for implementation
  - Next Steps: Phase 1 (Test Environment Setup) - Task 1.1 Playwright Configuration

### 2026-02-04
- **vow-spec-architect**: ISS-20260204-030 Habit Multiple Display Fix completed.
  - Problem: Habit addition flow showed step-by-step single-choice buttons instead of multiple habit candidates
  - Root Cause: AI was using `show_choice_buttons` loop pattern after category selection instead of calling `suggest_habits`
  - Solution: Added explicit prohibition rules to system prompt in both Japanese and English versions
  - Modified Files:
    - `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`
      - Added Japanese prohibition section (after line 539): "### 禁止パターン: show_choice_buttons ループ（最重要・絶対禁止）"
      - Added English prohibition section (after line 972): "### Prohibited Pattern: show_choice_buttons Loop (CRITICAL - ABSOLUTELY FORBIDDEN)"
  - Created Spec Files:
    - `/home/ubuntu/Downloads/vow/specs/iss-20260204-030-habit-multiple-display/requirements.md`
    - `/home/ubuntu/Downloads/vow/specs/iss-20260204-030-habit-multiple-display/design.md`
    - `/home/ubuntu/Downloads/vow/specs/iss-20260204-030-habit-multiple-display/tasks.md`
  - Verification: Backend build successful (`npm run build`)
  - Status: Implementation complete, pending manual verification
  - Next Steps: Manual testing of habit addition flow to confirm fix works correctly

- **vow-spec-architect**: QA-PATROL-BTN-001 QA Patrol Button Coverage Test Design completed.
  - Purpose: MOCセクションの候補ボタン機能を網羅するブラックボックステスト設計
  - Created Files:
    - `/home/ubuntu/Downloads/vow/specs/qa-patrol-refactor/test-coverage.md` - テストカバレッジ設計書
      - SuggestionButtonType網羅 (habit/goal/stickyn/category/text/reply): 45テストケース
      - RefineActionType網羅 (more_specific/easier/harder/different/more_suggestions/different_habit): 30テストケース
      - DrilldownStep網羅 (genre_selection/purpose_selection/response_type_selection): 30テストケース
      - 特殊フロー (existing selection/multi-selection/batch registration): 30テストケース
      - E2Eフロー: 10テストケース
      - 合計: 145テストケース
    - `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol-button-coverage.json` - 候補ボタン網羅用質問データ (100件)
  - Modified Files:
    - `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol-types.ts`
      - SuggestionButtonType型追加
      - RefineActionType型追加
      - DrilldownStep型追加
      - DrilldownSelectionType型追加
      - CoverageTarget interface追加
      - TestQuestion.coverageTargetフィールド追加
    - `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol-questions.ts`
      - loadButtonCoverageQuestions関数追加
      - getSuccessKeywordsFromCoverage関数追加
      - BUTTON_COVERAGE_QUESTIONS配列追加
      - ALL_QUESTIONSに候補ボタン網羅用質問を統合
      - getButtonCoverageQuestions関数追加
      - getQuestionsByCoverageTarget関数追加
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/qa-patrol-refactor/`
  - Status: Design complete, ready for implementation

- **vow-spec-architect**: QA-PATROL-001 QA Patrol Agent Refactor completed.
  - Problem: QA巡回エージェントの質問が詳細すぎて、AIの掘り下げ能力をテストできない
  - Solution: シンプルな質問データを使用した新テストスイートを追加
    - `qa-patrol-types.ts`: 型定義（TestQuestion, TestResult等）
    - `qa-patrol-questions.ts`: 静的質問データ（12件）
      - HABIT_QUESTIONS: 4件（習慣追加関連）
      - GOAL_QUESTIONS: 3件（目標設定関連）
      - LEVEL_QUESTIONS: 2件（レベル設定関連）
      - ADVICE_QUESTIONS: 3件（アドバイス関連）
    - `qa-patrol.spec.ts`: 新テストスイート "Simple Question Tests" 追加
  - Features:
    - シンプルな質問文（15文字以内目安）
    - followUpResponsesパターンマッチングによる自動応答
    - 回答の型検出（habit_cards / goal_cards / category_buttons / text_advice）
    - 品質スコア計算（0-100）
    - 目的別テスト（Habit/Goal/Advice）
  - Created Files:
    - `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol-types.ts`
    - `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol-questions.ts`
  - Modified Files:
    - `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol.spec.ts`
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/qa-patrol-refactor/`
  - Status: Implementation complete, build successful

- **vow-spec-architect**: SUGG-BTN-ENH-001 Suggestion Button Enhancement completed.
  - Feature: 候補ボタン（SuggestionButton）機能拡張
  - Implemented:
    - [FR-001] 候補ボタンの型（種類）表示 - category/textタイプ追加
    - [FR-002] 詳細確認機能 - 既存機能を活用
    - [FR-003] チェックボタン（複数選択） - SuggestionCardにチェックボックス追加
    - [FR-004] アクションボタン群 - もっと具体的に/かんたんに/難しく/アレンジ/他には
    - [FR-005] 一括登録機能 - 選択した候補を一括登録
  - Created Components:
    - `SuggestionCardGroup` - 複数候補のグループ管理
    - `ActionButtonGroup` - 調整アクションボタン群
    - `RegisterButton` - 一括登録ボタン
  - Modified Files:
    - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
      - SuggestionButtonType拡張: category/text追加
      - RefineActionType追加
      - SuggestionCardProps拡張: index/isSelected/onSelectionChange/showCheckbox
      - SuggestionCard修正: チェックボックスUI追加
      - handleRefineRequest実装
    - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useSnoozedSuggestions.ts` - 型修正
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/suggestion-button-enhancement/`
  - Status: Implementation complete, build successful

- **vow-spec-architect**: CAT-DRILL-001 Category Drilldown (Fukabori) Feature completed.
  - Problem: 曖昧な質問に対して、ユーザーの意図を段階的に明確化する機能が必要
  - Solution: 掘り下げ（フカボリ）機能を実装
    - ジャンル -> 目的 -> 回答の型 の3段階で掘り下げ
    - 各ステップで候補ボタン（QuickReply）を必須表示
    - 8つのジャンルカテゴリ（健康、キャリア、学習、趣味、人間関係、お金、ライフスタイル、その他）
    - 各ジャンルに対応した目的選択肢
    - 4つの回答の型（習慣提案、目標設定、情報提供、アドバイス）
    - 選択完了後、適切なエージェント（Habit Coach / Goal Planner）に自動委譲
  - Created Files:
    - `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/drilldown/types.ts` - 型定義
    - `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/drilldown/categories.ts` - カテゴリデータ
    - `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/drilldown/controller.ts` - DrilldownController
    - `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/drilldown/tools.ts` - Mastraツール
    - `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/drilldown/index.ts` - モジュールエクスポート
  - Modified Files:
    - `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/manager-agent.ts` - drilldownツール統合
    - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx` - selectionType拡張
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/category-drilldown/`
  - Status: Implementation complete, backend build successful

- **vow-spec-architect**: ISS-20260204-017 Suggestion Button Enhancement - Phase 1 & 2 complete.
  - Problem: AIコーチからの提案ボタン機能の拡張（スヌーズ、履歴、一括操作）
  - Created Hooks:
    - `useSnoozedSuggestions.ts` - スヌーズ機能（localStorage永続化）
    - `useSuggestionHistory.ts` - 提案履歴管理（localStorage永続化）
    - `useBulkSelection.ts` - 一括選択機能
  - Created Components:
    - `SuggestionSkeleton.tsx` - ローディングスケルトン
    - `SuggestionFilter.tsx` - フィルタリングUI
    - `BulkActionBar.tsx` - 一括操作バー
  - Modified Files:
    - `Section.MOC.tsx` - 新フック統合、handleSuggestionAction更新
    - `hooks/index.ts` - 新フックエクスポート追加
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/iss-20260204-017/`
  - Status: Phase 1-2 complete (6/21 tasks), Phase 3-7 remaining

- **vow-spec-architect**: ISS-20260204-019 Goal Planner Existing Goals Reference bug fixed.
  - Modified: agents.ts, goal-planner-agent.ts, manager-agent.ts
  - Added PersonalizationEngine integration to pass existingGoalNames to AI prompts
  - Issue closed in Supabase
- **vow-spec-architect**: ISS-20260204-018 Claude Executor Service completed.
  - Issue: Claude Codeを子プロセスとして実行し、出力をストリーミングで返却するExecutorサービスが必要
  - Solution: ClaudeExecutorクラスを実装
    - execute(): プロンプト実行とリアルタイム出力ストリーミング
    - cancel(): 実行中タスクのキャンセル
    - getStatus()/listExecutions(): 実行状態管理
    - タイムアウト処理（デフォルト30分、SIGTERM->SIGKILL段階的終了）
    - 最大5並列実行サポート
  - Created Files:
    - `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/claude-executor.ts`
  - Modified Files:
    - `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/types.ts` (ExecutionOptions, ExecutionState等追加)
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/iss-20260204-018/`
  - Status: Implementation complete
  - Next: Task 1.2 Remote Task API Endpoint でserver.tsに統合予定

- **vow-spec-architect**: Suggestion Buttons Fix completed.
  - Problem: MCPサーバー・OpenAIいずれを使用しても候補ボタン（SuggestionCard）が表示されない
  - Root Cause: Section.MOC.tsx Line 611 の条件 `isComplete && msg.toolCalls?.length` が
    toolCalls が空/undefined の場合に parseSuggestions を呼び出さなかった
  - Fixed Files:
    - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
      - Line 611: 条件を `isComplete` に変更し、parseSuggestions を常に呼び出す
      - parseSuggestionsFromText 関数追加でテキストフォールバック対応
    - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMastraAgent.ts` - デバッグログ強化
    - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMcpChat.ts` - デバッグログ強化
    - `/home/ubuntu/Downloads/vow/backend/src/routers/agents.ts` - デバッグログ強化
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/suggestion-buttons-fix/`
  - Status: Implementation complete, testing recommended (Phase 4)

- **vow-spec-architect**: MCP Conversation Memory bug fix completed.
  - Problem: 会話履歴がサーバー側で記憶されない
  - Root Cause:
    1. Frontend: sessionIdがページリロードで毎回新規生成されていた
    2. Backend: インメモリストレージのみで永続化なし
  - Fixed Files:
    - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMcpChat.ts` - localStorage persistence for sessionId
    - `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts` - SessionManager class with file persistence
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/mcp-conversation-memory/`
  - Status: Implementation complete, tested

- **vow-spec-architect**: Chat "No Response" bug fix completed.
  - Root Cause: Claude CLIが出力を生成しない場合、stderrの内容がクライアントに伝わらない
  - Fixed Files:
    - `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts` - stderr propagation & timeout
    - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMcpChat.ts` - Error handling improvement
  - Spec Location: `/home/ubuntu/Downloads/vow/specs/chat-no-response-fix/`
  - Status: Implementation complete, testing recommended

### 2026-02-03
- **vow-spec-architect**: Investigation complete. Created specification documents for MOC-MCP Remote Integration.
  - Location: `/home/ubuntu/Downloads/vow/specs/moc-mcp-remote-integration/`
  - Files: `investigation-report.md`, `architecture-design.md`, `requirements.md`, `tasks.md`
  - Recommendation: Start with Task 1.1 (Claude Executor Service)

---

## Agent Check-in Protocol

### Before Starting Work
1. Pull latest from `develop` branch
2. Read this COORDINATION.md file
3. Check Task Assignments section
4. Claim your task by updating this file
5. Lock files you'll be modifying

### After Completing Work
1. Update task status in this file
2. Release file locks
3. Add entry to Communication Log
4. Push changes to feature branch
5. Create PR if ready for review

### Conflict Resolution
1. Check File Locks before editing
2. If conflict detected, communicate via Communication Log
3. Spec Architect (vow-spec-architect) has final say on design decisions

---

## Quick Reference

### Spec Location
```
/home/ubuntu/Downloads/vow/specs/moc-mcp-remote-integration/
```

### MCP Task Server
```
Location: /home/ubuntu/.mcp-multi-agent/    # 注意: ドット(.)付き！
Config: mcp-config.json
Server Port: 3456
```

### VOW Project
```
Location: /home/ubuntu/Downloads/vow/
Frontend: frontend/
Backend: backend/
MCP Components: frontend/app/dashboard/hooks/useMultiAgentServer.ts
                frontend/app/dashboard/hooks/useMcpChat.ts
                frontend/app/dashboard/components/Section.MOC.tsx
```
