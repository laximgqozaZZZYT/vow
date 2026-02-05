# ISS-20260204-017: Suggestion Button Enhancement - Tasks

## Overview
- **Purpose**: 提案ボタン機能拡張のタスク一覧
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Task List

### Phase 1: Core Hooks (Assignable: any agent)

- [x] Task 1.1: useSnoozedSuggestions フック作成
  - **File**: `frontend/app/dashboard/hooks/useSnoozedSuggestions.ts`
  - **Description**: スヌーズ機能の状態管理フック
  - **Deliverables**:
    - snooze/unsnooze 関数
    - checkExpired 関数
    - localStorage 永続化
  - **Estimated Time**: 45 min
  - **Prerequisite**: None

- [x] Task 1.2: useSuggestionHistory フック作成
  - **File**: `frontend/app/dashboard/hooks/useSuggestionHistory.ts`
  - **Description**: 提案履歴の状態管理フック
  - **Deliverables**:
    - addToHistory 関数
    - filter 関数
    - clear 関数
    - localStorage 永続化（最大100件）
  - **Estimated Time**: 45 min
  - **Prerequisite**: None

- [x] Task 1.3: useBulkSelection フック作成
  - **File**: `frontend/app/dashboard/hooks/useBulkSelection.ts`
  - **Description**: 一括選択の状態管理フック
  - **Deliverables**:
    - toggle/selectAll/clearSelection 関数
    - selectedItems 導出状態
  - **Estimated Time**: 30 min
  - **Prerequisite**: None

### Phase 2: UI Components (Assignable: frontend agent)

- [x] Task 2.1: SuggestionSkeleton コンポーネント作成
  - **File**: `frontend/app/dashboard/components/SuggestionSkeleton.tsx`
  - **Description**: 提案生成中のスケルトンローダー
  - **Deliverables**:
    - アニメーション付きスケルトン
    - 件数指定プロパティ
    - ダークモード対応
  - **Estimated Time**: 30 min
  - **Prerequisite**: None

- [x] Task 2.2: SuggestionFilter コンポーネント作成
  - **File**: `frontend/app/dashboard/components/SuggestionFilter.tsx`
  - **Description**: 提案フィルタリングUI
  - **Deliverables**:
    - 種類/カテゴリ/難易度フィルタ
    - レスポンシブデザイン
  - **Estimated Time**: 30 min
  - **Prerequisite**: None

- [x] Task 2.3: BulkActionBar コンポーネント作成
  - **File**: `frontend/app/dashboard/components/BulkActionBar.tsx`
  - **Description**: 一括操作バー
  - **Deliverables**:
    - 選択件数表示
    - 一括受諾/却下/スヌーズボタン
    - 全選択チェックボックス
  - **Estimated Time**: 30 min
  - **Prerequisite**: Task 1.3

### Phase 3: SuggestionCard 拡張 (Assignable: frontend agent)

- [ ] Task 3.1: SuggestionCard にスヌーズボタン追加
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: 既存のSuggestionCardにスヌーズ機能を追加
  - **Changes**:
    - onSnooze プロパティ追加
    - 「後で」ボタンUI追加
    - スヌーズ状態の表示
  - **Estimated Time**: 30 min
  - **Prerequisite**: Task 1.1

- [ ] Task 3.2: SuggestionCard に選択機能追加
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: 一括選択用のチェックボックス追加
  - **Changes**:
    - isSelected/onSelect プロパティ追加
    - チェックボックスUI追加
    - 選択時のビジュアル変更
  - **Estimated Time**: 20 min
  - **Prerequisite**: Task 1.3

- [ ] Task 3.3: ローディング状態の実装
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: 提案生成中のスケルトン表示
  - **Changes**:
    - isGeneratingSuggestions 状態追加
    - SuggestionSkeleton の条件レンダリング
    - フェードイン・アニメーション
  - **Estimated Time**: 20 min
  - **Prerequisite**: Task 2.1

### Phase 4: Section.MOC.tsx 統合 (Assignable: frontend agent)

- [ ] Task 4.1: フック統合
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: 新規フックをSection.MOCに統合
  - **Changes**:
    - useSnoozedSuggestions 呼び出し追加
    - useSuggestionHistory 呼び出し追加
    - useBulkSelection 呼び出し追加
  - **Estimated Time**: 30 min
  - **Prerequisite**: Task 1.1, 1.2, 1.3

- [ ] Task 4.2: 一括操作バーの統合
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: BulkActionBar をチャットエリアに統合
  - **Changes**:
    - selectedIds.size > 0 の場合に表示
    - 一括アクションの実装
  - **Estimated Time**: 20 min
  - **Prerequisite**: Task 2.3, 4.1

- [ ] Task 4.3: フィルタUIの統合
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: SuggestionFilter をチャットエリアに統合
  - **Changes**:
    - フィルタ状態の管理
    - フィルタ結果の表示
  - **Estimated Time**: 20 min
  - **Prerequisite**: Task 2.2, 4.1

### Phase 5: History Tab 拡張 (Assignable: frontend agent)

- [ ] Task 5.1: スヌーズセクション追加
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: History タブにスヌーズ中の提案セクション追加
  - **Changes**:
    - 「スヌーズ中」セクションUI
    - スヌーズ解除ボタン
    - 残り時間表示
  - **Estimated Time**: 30 min
  - **Prerequisite**: Task 1.1

- [ ] Task 5.2: 履歴フィルタ追加
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: History タブにフィルタ機能追加
  - **Changes**:
    - 状態フィルタ（受諾/却下/スヌーズ）
    - 種類フィルタ（習慣/目標）
  - **Estimated Time**: 20 min
  - **Prerequisite**: Task 1.2, 2.2

- [ ] Task 5.3: 履歴詳細表示
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: 履歴アイテムの詳細表示
  - **Changes**:
    - 作成日時表示
    - ステータス変更日時表示
    - 再提案ボタン
  - **Estimated Time**: 20 min
  - **Prerequisite**: Task 5.2

### Phase 6: Testing (Assignable: tester agent)

- [ ] Task 6.1: フックの単体テスト
  - **Files**:
    - `frontend/app/dashboard/hooks/__tests__/useSnoozedSuggestions.test.ts`
    - `frontend/app/dashboard/hooks/__tests__/useSuggestionHistory.test.ts`
    - `frontend/app/dashboard/hooks/__tests__/useBulkSelection.test.ts`
  - **Description**: 各フックの単体テスト
  - **Estimated Time**: 60 min
  - **Prerequisite**: Task 1.1, 1.2, 1.3

- [ ] Task 6.2: コンポーネントの単体テスト
  - **Files**:
    - `frontend/app/dashboard/components/__tests__/SuggestionSkeleton.test.tsx`
    - `frontend/app/dashboard/components/__tests__/SuggestionFilter.test.tsx`
    - `frontend/app/dashboard/components/__tests__/BulkActionBar.test.tsx`
  - **Description**: 各コンポーネントの単体テスト
  - **Estimated Time**: 60 min
  - **Prerequisite**: Task 2.1, 2.2, 2.3

- [ ] Task 6.3: 統合テスト
  - **File**: `frontend/app/dashboard/components/__tests__/Section.MOC.suggestion.test.tsx`
  - **Description**: 提案機能の統合テスト
  - **Test Cases**:
    - スヌーズフロー
    - 一括選択フロー
    - フィルタフロー
    - 履歴フロー
  - **Estimated Time**: 90 min
  - **Prerequisite**: Task 4.1, 4.2, 4.3, 5.3

### Phase 7: Polish & Documentation (Assignable: any agent)

- [ ] Task 7.1: アクセシビリティ改善
  - **Files**: 全UIコンポーネント
  - **Description**: ARIA属性、キーボード操作の追加
  - **Estimated Time**: 30 min
  - **Prerequisite**: Phase 6

- [ ] Task 7.2: レスポンシブ対応
  - **Files**: 全UIコンポーネント
  - **Description**: モバイル表示の最適化
  - **Estimated Time**: 30 min
  - **Prerequisite**: Phase 6

- [ ] Task 7.3: 仕様書更新
  - **Files**: `specs/iss-20260204-017/*.md`
  - **Description**: 実装内容を仕様書に反映
  - **Estimated Time**: 15 min
  - **Prerequisite**: Task 7.2

## Task Dependencies Graph

```
Phase 1 (Parallel)          Phase 2 (Parallel)          Phase 3            Phase 4          Phase 5          Phase 6          Phase 7
┌─────────────┐            ┌─────────────┐            ┌──────────┐       ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Task 1.1    │──────┬────►│ Task 3.1    │──────┬────►│ Task 4.1 │──────►│ Task 5.1 │────►│ Task 6.1 │────►│ Task 7.1 │
│ (Snooze)    │      │     └─────────────┘      │     └──────────┘       └──────────┘     │          │     └──────────┘
└─────────────┘      │     ┌─────────────┐      │     ┌──────────┐     ┌──────────┐       │          │     ┌──────────┐
┌─────────────┐      │     │ Task 2.1    │──────┼────►│ Task 3.3 │     │ Task 5.2 │──────┤ Task 6.2 │────►│ Task 7.2 │
│ Task 1.2    │──────┼────►│ (Skeleton)  │      │     └──────────┘     └──────────┘       │          │     └──────────┘
│ (History)   │      │     └─────────────┘      │                       ┌──────────┐       │          │     ┌──────────┐
└─────────────┘      │     ┌─────────────┐      │     ┌──────────┐     │ Task 5.3 │──────┤ Task 6.3 │────►│ Task 7.3 │
┌─────────────┐      │     │ Task 2.2    │──────┼────►│ Task 4.3 │────►└──────────┘       └──────────┘     └──────────┘
│ Task 1.3    │──────┼────►│ (Filter)    │      │     └──────────┘
│ (Selection) │      │     └─────────────┘      │
└─────────────┘      │     ┌─────────────┐      │     ┌──────────┐
                     └────►│ Task 2.3    │──────┴────►│ Task 4.2 │
                           │ (BulkBar)   │            └──────────┘
                           └─────────────┘
                           ┌─────────────┐
                           │ Task 3.2    │
                           │ (Checkbox)  │
                           └─────────────┘
```

## Parallel Execution Opportunities

以下のタスクは並行実行可能:

### Batch 1 (Phase 1)
- Task 1.1, 1.2, 1.3 は独立して並行実行可能

### Batch 2 (Phase 2)
- Task 2.1, 2.2 は Phase 1 完了後に並行実行可能
- Task 2.3 は Task 1.3 完了後に開始

### Batch 3 (Phase 3)
- Task 3.1, 3.2, 3.3 は並行実行可能

### Batch 4-5 (Phase 4-5)
- Task 4.1-4.3 は順次実行
- Task 5.1-5.3 は Task 4.1 後に並行実行可能

## Agent Assignment Suggestions

| Task Range | Suggested Agent | Reason |
|------------|-----------------|--------|
| 1.1-1.3 | implementer-1 | フック実装（状態管理） |
| 2.1-2.3 | implementer-2 | UIコンポーネント作成 |
| 3.1-3.3 | implementer-1 | 既存コンポーネント拡張 |
| 4.1-4.3 | implementer-1 | 統合作業 |
| 5.1-5.3 | implementer-2 | Historyタブ拡張 |
| 6.1-6.3 | tester | テスト実装 |
| 7.1-7.3 | code-reviewer | 品質改善 |

## Current Progress

- Phase 1: **Complete** (3/3 tasks)
- Phase 2: **Complete** (3/3 tasks)
- Phase 3: **Not Started** (0/3 tasks)
- Phase 4: **Not Started** (0/3 tasks)
- Phase 5: **Not Started** (0/3 tasks)
- Phase 6: **Not Started** (0/3 tasks)
- Phase 7: **Not Started** (0/3 tasks)

**Overall Progress**: 6/21 tasks (29%)

## Time Estimate

| Phase | Estimated Time |
|-------|----------------|
| Phase 1 | 2 hours |
| Phase 2 | 1.5 hours |
| Phase 3 | 1.25 hours |
| Phase 4 | 1.25 hours |
| Phase 5 | 1.25 hours |
| Phase 6 | 3.5 hours |
| Phase 7 | 1.25 hours |
| **Total** | **12 hours** |

## Notes

- Phase 1-3 は並行実行で約3時間に短縮可能
- テスト（Phase 6）は実装完了後に集中して実施
- 段階的なマージを推奨（Phase完了ごと）
