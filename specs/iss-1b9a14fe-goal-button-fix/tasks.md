# Goal候補ボタン表示修正 - タスクリスト

## Overview
- **Purpose**: 修正作業のタスク分解
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Implementation Tasks

### Phase 1: システムプロンプト強化

- [x] Task 1: Goal関連リクエストパターンの明確化 (Assignable to: any agent)
  - 対象ファイル: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`
  - 作業内容: システムプロンプト内のGoal関連指示を強化
  - 具体的変更:
    1. 「ゴールを設定したい」「目標を立てたい」などのパターンで必ず`selectionType: "goal_category"`を使用するよう明示
    2. 間違ったパターン（Goal要求にhabit_category使用）を禁止事項として追加
    3. 例示を追加

### Phase 2: 意図判定ロジック改善

- [x] Task 2: Goalキーワードの拡充 (Prerequisite: None)
  - 対象ファイル: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/manager-agent.ts`
  - 作業内容: `goalKeywords`配列にキーワードを追加
  - 追加キーワード: `'立てたい'`, `'作りたい'`, `'決めたい'`, `'ターゲット'`, `'target'`, `'objective'`

### Phase 3: 検証・テスト

- [x] Task 3: 動作確認 (Prerequisite: Task 1, Task 2)
  - 手動テストで以下を確認:
    1. 「Goalを設定したい」→ Goal候補ボタン表示
    2. 「習慣を始めたい」→ Habit候補ボタン表示（回帰なし）

- [x] Task 4: Issueクローズ (Prerequisite: Task 3)
  - SupabaseでIssueステータスを`resolved`に更新

## Progress Tracking

| Task | Status | Assignee | Started | Completed |
|------|--------|----------|---------|-----------|
| Task 1 | Done | vow-spec-architect | 2026-02-04 | 2026-02-04 |
| Task 2 | Done | vow-spec-architect | 2026-02-04 | 2026-02-04 |
| Task 3 | Done | vow-spec-architect | 2026-02-04 | 2026-02-04 |
| Task 4 | Done | vow-spec-architect | 2026-02-04 | 2026-02-04 |

## Notes

- フロントエンドの変更は不要（`handleQuickReplyClick`は既に`selectionType`を正しく処理している）
- テスト環境でAIの応答を確認し、期待通りに動作することを確認済み
