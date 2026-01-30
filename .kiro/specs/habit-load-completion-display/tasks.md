# 実装計画: Habit累積Load完了表示機能

## 概要

Habitの累積Load Total(End)完了表示機能を実装します。累積Load CountがworkloadTotalEndを超えた場合、各UIセクションで適切な表示制御を行います。

## タスク

- [x] 1. ユーティリティ関数の実装
  - [x] 1.1 `habitCompletionUtils.ts`ファイルを作成し、累積Load Count計算関数を実装
    - `calculateCumulativeLoadCount(habitId, activities)`関数を実装
    - kindが'complete'のActivityのamountのみを合計
    - amount がnull/undefinedの場合は0として扱う
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 1.2 累積完了判定関数を実装
    - `isHabitCumulativelyCompleted(habit, activities)`関数を実装
    - _Requirements: 2.1, 2.2, 2.3_
    - workloadTotalEndが正の数で、累積Load Count >= workloadTotalEndの場合にtrueを返す
  
  - [ ]* 1.3 ユーティリティ関数のプロパティテストを作成
    - **Property 1: 累積Load Count計算の正確性**
    - **Property 2: 累積完了判定の正確性**
    - **Property 7: ラウンドトリップ一貫性**
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 7.4**

- [x] 2. チェックポイント - ユーティリティ関数のテスト確認
  - すべてのテストがパスすることを確認し、質問があればユーザーに確認

- [x] 3. GoalTree（左サイドバー）の更新
  - [x] 3.1 Widget.GoalTree.tsxに累積完了判定を追加
    - `isHabitCumulativelyCompleted`をインポート
    - HabitItemコンポーネントに`isCumulativelyCompleted`プロパティを追加
    - 累積完了状態の場合、打ち消し線とtext-zinc-400スタイルを適用
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 3.2 GoalTreeのユニットテストを作成
    - 累積完了Habitのスタイル適用を検証
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 4. Nextセクションの更新
  - [x] 4.1 Section.Next.tsxに累積完了フィルタリングを追加
    - `isHabitCumulativelyCompleted`をインポート
    - activitiesプロパティをコンポーネントに追加
    - candidates生成ループで累積完了Habitを除外
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 4.2 Nextセクションのユニットテストを作成
    - 累積完了Habitがリストから除外されることを検証
    - **Validates: Requirements 4.1, 4.2**

- [x] 5. Calendarセクションの更新
  - [x] 5.1 Widget.Calendar.tsxに累積完了フィルタリングを追加
    - `isHabitCumulativelyCompleted`をインポート
    - activitiesプロパティをコンポーネントに追加（既存の場合は確認）
    - events useMemo内で累積完了Habitを除外
    - 依存配列にactivitiesを追加
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 5.2 Calendarセクションのユニットテストを作成
    - 累積完了Habitのイベントが生成されないことを検証
    - **Validates: Requirements 5.1, 5.2**

- [x] 6. チェックポイント - UIコンポーネントの動作確認
  - すべてのテストがパスすることを確認し、質問があればユーザーに確認

- [x] 7. Statisticsセクションの更新
  - [x] 7.1 Section.Statistics.tsxに累積完了集計を追加
    - `isHabitCumulativelyCompleted`をインポート
    - stats useMemo内で累積完了Habitを達成済みとしてカウント
    - 達成率計算に累積完了Habitを含める
    - _Requirements: 6.1, 6.2, 6.4_
  
  - [x] 7.2 Summaryページに累積完了情報を表示
    - 累積完了Habit数を表示
    - 累積Load CountとworkloadTotalEndを表示
    - _Requirements: 6.3_
  
  - [ ]* 7.3 Statisticsセクションのユニットテストを作成
    - 累積完了Habitが達成済みとしてカウントされることを検証
    - **Validates: Requirements 6.1, 6.2**

- [x] 8. 型定義の更新
  - [x] 8.1 Habit型にworkloadTotalEndを追加（必要な場合）
    - frontend/app/dashboard/types/index.tsを確認・更新
    - workloadTotalEnd?: numberフィールドを追加
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 9. 最終チェックポイント - 全体テスト確認
  - すべてのテストがパスすることを確認し、質問があればユーザーに確認

## 備考

- `*`マークのタスクはオプションで、MVPでは省略可能
- 各タスクは特定の要件を参照しており、トレーサビリティを確保
- チェックポイントで段階的な検証を実施
- プロパティテストはユニバーサルな正確性を検証
- ユニットテストは特定の例とエッジケースを検証
