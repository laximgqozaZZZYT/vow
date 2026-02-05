# Goal候補ボタン表示修正 - 要件定義

## Overview
- **Purpose**: MOCセクションで「Goalを設定したい」などの質問に対して、Goal候補ボタンが正しく表示されるように修正する
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect
- **Issue ID**: ISS-1b9a14fe

## 問題分析

### 現象
- MOCセクションで「Goalを設定したい」などのGoal関連の質問をした場合
- Goal候補ではなくHabit候補のボタンが表示される
- 提案内容もGoalではなくHabitのものになっている

### 根本原因

調査の結果、以下の問題点を特定した:

1. **`show_category_selection`ツールのデフォルト値問題**
   - ファイル: `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts` (行162-163)
   - `selectionType`パラメータのデフォルト値が`'habit_category'`に設定されている
   - AIがGoal関連リクエストを検出しても、`selectionType`を明示的に指定しない場合にHabit候補が表示される

2. **システムプロンプトでの指示が不十分**
   - ファイル: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`
   - プロンプトには`selectionType: "goal_category"`を使用するよう記載があるが、LLMが常にそれを呼び出すとは限らない
   - 曖昧な質問（「Goalを設定したい」など）でAIがパラメータを省略する可能性がある

3. **意図判定ロジックの問題**
   - ファイル: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/manager-agent.ts` (行54-76)
   - キーワードベースの意図判定で、Goal関連キーワードの検出が不完全
   - 「ゴールを設定したい」→ `goal-planner`に振り分けられるが、プランナーがツールを正しく呼び出さない可能性

## Requirements

### Functional Requirements

- [FR-001] 「Goalを設定したい」「目標を立てたい」「ゴールを作りたい」などのGoal関連リクエストに対して、`show_category_selection`が`selectionType: "goal_category"`で呼び出されること
- [FR-002] Goal候補ボタンがクリックされた後、`suggest_goals`ツールが呼び出されること（`suggest_habits`ではない）
- [FR-003] Goal提案の内容が目標として適切なもの（達成期限付き、マイルストーン分解可能など）であること
- [FR-004] システムがユーザーの意図（Goal vs Habit）を正確に判定すること

### Non-Functional Requirements

- [NFR-001] 既存のHabit関連フローに影響を与えないこと
- [NFR-002] フロントエンドの変更を最小限に抑えること
- [NFR-003] 修正後も日本語・英語両方で正しく動作すること

## 影響範囲

### 変更が必要なファイル

1. `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts`
   - `ShowCategorySelectionSchema`のデフォルト値の見直し

2. `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`
   - システムプロンプトの強化（Goal関連リクエストでの`selectionType`明示指定の強調）

3. `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/manager-agent.ts`
   - 意図判定ロジックの改善

### 変更不要なファイル

- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
  - フロントエンドの`handleQuickReplyClick`は`selectionType`を正しく処理している
  - バックエンドから正しい`selectionType`が返ってくれば動作する

## Acceptance Criteria

- [AC-001] 「Goalを設定したい」と入力したとき、カテゴリ選択ボタンが「健康目標」「キャリア目標」などGoal用のラベルで表示される
- [AC-002] Goalカテゴリを選択した後、Goal候補（目標として適切な提案）がボタンで表示される
- [AC-003] Goal候補ボタンをクリックすると、GoalModalが開く（HabitModalではない）
- [AC-004] 「習慣を始めたい」と入力したときは従来通りHabit候補が表示される（回帰なし）

## Agent Coordination Notes

この修正は主にバックエンドの変更のみで完了可能。フロントエンドの変更は不要（既に`selectionType`を正しく処理している）。

テスト時は以下のシナリオを確認:
1. 「Goalを設定したい」→ Goal候補ボタン表示
2. 「習慣を始めたい」→ Habit候補ボタン表示
3. 「健康の目標を提案して」→ 直接`suggest_goals`呼び出し
4. 「健康の習慣を提案して」→ 直接`suggest_habits`呼び出し
