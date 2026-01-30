# Implementation Plan: Sticky-Habit Subtask Integration

## Overview

Sticky'nとHabitの親子関係を強化し、BoardセクションのカンバンビューでHabitに属するサブタスク（Sticky'n）を展開表示する機能を実装します。TypeScript/Reactで実装し、既存のコンポーネント構造を拡張します。

## Tasks

- [x] 1. カスタムフックの実装
  - [x] 1.1 useHabitSubtasks フックを作成
    - `frontend/app/dashboard/hooks/useHabitSubtasks.ts` を作成
    - stickiesとhabitsからsubtasksByHabitマップを構築
    - `hasSubtasks`, `getSubtaskCount`, `getIncompleteCount`, `needsWarning` 関数を実装
    - _Requirements: 1.1, 5.1, 5.2_
  
  - [x] 1.2 useHabitSubtasks のプロパティテストを作成
    - **Property 1: Subtask Grouping by Habit**
    - **Property 9: Warning Indicator Logic**
    - **Validates: Requirements 1.1, 5.1, 5.2**
  
  - [x] 1.3 useExpandedHabits フックを作成
    - `frontend/app/dashboard/hooks/useExpandedHabits.ts` を作成
    - LocalStorageからの読み込み/保存を実装
    - `isExpanded`, `toggleExpanded`, `setExpanded` 関数を実装
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 1.4 useExpandedHabits のプロパティテストを作成
    - **Property 12: Expanded State Persistence Round-Trip**
    - **Validates: Requirements 7.1, 7.2**

- [x] 2. Checkpoint - フック実装の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. UIコンポーネントの実装
  - [x] 3.1 ExpandButton コンポーネントを作成
    - `frontend/app/dashboard/components/Board.ExpandButton.tsx` を作成
    - 展開/折りたたみアイコン（▼/▲）の切り替え
    - 44x44px以上のタッチターゲット
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 3.2 WarningIndicator コンポーネントを作成
    - `frontend/app/dashboard/components/Board.WarningIndicator.tsx` を作成
    - ⚠️アイコンまたは警告色での表示
    - ツールチップ対応
    - _Requirements: 5.4_
  
  - [x] 3.3 SubtaskList コンポーネントを作成
    - `frontend/app/dashboard/components/Board.SubtaskList.tsx` を作成
    - 既存のPendingStickyCardと同じ体裁で表示
    - チェックボックスと名前クリックのハンドラー
    - _Requirements: 3.2, 3.3, 6.1, 6.2_

- [x] 4. HabitCard コンポーネントの拡張
  - [x] 4.1 HabitCard に新しいpropsを追加
    - `subtasks`, `isExpanded`, `onToggleExpand`, `onSubtaskComplete`, `onSubtaskEdit`, `showWarning` を追加
    - _Requirements: 2.1, 3.1_
  
  - [x] 4.2 HabitCard に展開ボタンを追加
    - サブタスクがある場合のみ表示
    - カード右下に配置
    - _Requirements: 2.1, 2.2_
  
  - [x] 4.3 HabitCard に警告マークを追加
    - `showWarning` が true の場合に表示
    - カード名の横に配置
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 4.4 HabitCard にサブタスクリストを追加
    - `isExpanded` が true の場合に SubtaskList を表示
    - カード下部に展開
    - _Requirements: 3.1, 3.4_
  
  - [x] 4.5 HabitCard のプロパティテストを作成
    - **Property 3: Expand Button Visibility**
    - **Property 5: Expand Toggle Behavior**
    - **Validates: Requirements 2.1, 2.2, 3.1**

- [x] 5. Checkpoint - コンポーネント実装の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. KanbanLayout の統合
  - [x] 6.1 KanbanLayout に useHabitSubtasks を統合
    - stickies から subtasksByHabit を計算
    - 各 HabitCard に subtasks を渡す
    - _Requirements: 1.1_
  
  - [x] 6.2 KanbanLayout に useExpandedHabits を統合
    - 展開状態の管理と永続化
    - 各 HabitCard に isExpanded と onToggleExpand を渡す
    - _Requirements: 7.1, 7.2_
  
  - [x] 6.3 KanbanLayout にサブタスク操作コールバックを追加
    - onSubtaskComplete と onSubtaskEdit を各 HabitCard に渡す
    - 既存の onStickyComplete と onStickyEdit を再利用
    - _Requirements: 6.1, 6.2_
  
  - [x] 6.4 警告マーク表示ロジックを統合
    - needsWarning 関数を使用して showWarning を計算
    - _Requirements: 5.1, 5.2, 5.5_

- [x] 7. Habit完了時の挙動確認
  - [x] 7.1 Habit完了時にサブタスクが変更されないことを確認
    - 既存の onHabitAction がサブタスクに影響しないことを確認
    - 必要に応じてコードを調整
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 7.2 Habit完了独立性のプロパティテストを作成
    - **Property 8: Habit Completion Independence**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 8. hooks/index.ts のエクスポート更新
  - 新しいフックをエクスポートに追加
  - _Requirements: N/A (コード整理)_

- [x] 9. Final Checkpoint - 全機能の確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- すべてのテストタスクは必須として実装
- 既存のsticky-habit関連APIを活用し、バックエンド変更は不要
- デザインシステムのカラートークンとスペーシングを使用
- タッチターゲットは最小44x44pxを確保
