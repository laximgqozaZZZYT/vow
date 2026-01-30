# Implementation Plan: Board Progress Calculation

## Overview

BoardセクションのGanttチャートにおける進捗率計算ロジックを改善します。Goal/Habitの期限継承ロジックと時間ベースの進捗率計算を実装します。

実装言語: TypeScript（既存のフロントエンドコードベースに合わせる）

## Tasks

- [ ] 1. 実効期限計算関数の実装
  - [x] 1.1 `getGoalEffectiveDeadline`関数を`ganttDataUtils.ts`に追加
    - Goalの期限継承ロジックを実装（自身→親→祖先→デフォルト）
    - 循環参照防止のための訪問済みID追跡を実装
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 1.2 `getHabitEffectiveDeadline`関数を`ganttDataUtils.ts`に追加
    - Habitの期限継承ロジックを実装（自身→Goal→デフォルト）
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ]* 1.3 実効期限計算のプロパティテストを作成
    - **Property 1: 自身の期限使用**
    - **Property 2: 親Goalの期限継承**
    - **Property 3: 祖先Goalの期限継承**
    - **Property 4: デフォルト期限（登録日+1年）**
    - **Property 5: Habitの期限継承**
    - **Validates: Requirements 1.1-1.4, 2.1-2.3**

- [ ] 2. 進捗率計算関数の改善
  - [x] 2.1 `calculateHabitProgress`関数を拡張
    - 引数に`allGoals`を追加
    - 実効期限を使用した進捗率計算を実装
    - エッジケース処理（workloadTotal <= 0、completed = true）を実装
    - _Requirements: 3.3, 3.4, 3.5_
  
  - [x] 2.2 `calculateGoalProgress`関数を拡張
    - 引数に`allGoals`を追加
    - 子Habitの進捗率平均を計算
    - エッジケース処理（Habitなし、isCompleted = true）を実装
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 2.3 進捗率計算のプロパティテストを作成
    - **Property 6: 進捗率計算**
    - **Property 7: 完了済みアイテムの進捗率**
    - **Property 8: Goalの進捗率集計**
    - **Validates: Requirements 3.3, 3.5, 4.1, 4.3**

- [x] 3. Checkpoint - 進捗率計算ロジックの検証
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Ganttチャートへの統合
  - [x] 4.1 `buildGanttRows`関数を更新
    - `addGoalRow`で`getGoalEffectiveDeadline`を使用してendDateを設定
    - `addHabitRow`で`getHabitEffectiveDeadline`を使用してendDateを設定
    - 更新された進捗率計算関数を呼び出し
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 4.2 `useGanttData`フックの更新
    - 必要に応じてインターフェースを調整
    - _Requirements: 5.1_
  
  - [ ]* 4.3 統合テストを作成
    - `buildGanttRows`が正しい進捗率とendDateを返すことを検証
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 5. エッジケース処理の実装
  - [x] 5.1 無効なデータのハンドリングを追加
    - 無効な日付文字列のフォールバック処理
    - 負の値の正規化処理
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 5.2 エッジケースのユニットテストを作成
    - 登録日 > 期限
    - 現在日時 > 期限
    - 現在日時 < 登録日
    - workloadTotal <= 0
    - completedWorkload < 0
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6. Final Checkpoint - 全テスト実行
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 既存の`ganttDataUtils.ts`を拡張する形で実装
- 既存のテストがある場合は、新しいテストと統合
- Property-based testsには`fast-check`ライブラリを使用
