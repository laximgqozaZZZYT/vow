# 要件定義書

## はじめに

本機能は、Habitに設定された累積Load Total(End)値（`workloadTotalEnd`フィールド）に対して、累積Load Countがその値を超えた場合の表示制御を実装するものです。累積完了したHabitは、各セクションで異なる表示処理を行い、ユーザーが達成済みのHabitと進行中のHabitを視覚的に区別できるようにします。

## 用語集

- **Habit**: ユーザーが追跡する習慣。日次の目標値（`workloadTotal`）と累積目標値（`workloadTotalEnd`）を持つことができる
- **Activity**: Habitの完了記録。`amount`フィールドで完了量を記録する
- **Cumulative_Load_Count**: 特定のHabitに対する全Activityの`amount`の合計値
- **Load_Total_End**: Habitの累積目標値（`workloadTotalEnd`フィールド）。この値を超えるとHabitは「累積完了」とみなされる
- **GoalTree**: 左サイドバーに表示されるGoalとHabitの階層ツリー
- **Next_Section**: 次の24時間以内に予定されているHabitを表示するセクション
- **Calendar_Section**: Habitのスケジュールをカレンダー形式で表示するセクション
- **Statistics_Section**: Habitの統計情報を表示するセクション

## 要件

### 要件 1: 累積Load Count計算

**ユーザーストーリー:** 開発者として、Habitの累積Load Countを正確に計算したい。これにより、累積完了状態を判定できるようになる。

#### 受け入れ基準

1. WHEN Habitの累積Load Countを計算する THEN システムは当該HabitのすべてのActivityの`amount`フィールドを合計するものとする
2. WHEN Activityの`amount`がnullまたはundefined THEN システムはそのActivityを0として扱うものとする
3. WHEN Activityの`kind`が'complete'以外 THEN システムはそのActivityの`amount`を累積計算に含めないものとする

### 要件 2: 累積完了状態判定

**ユーザーストーリー:** システムとして、Habitが累積完了状態かどうかを判定したい。これにより、各セクションで適切な表示制御ができるようになる。

#### 受け入れ基準

1. WHEN Habitに`workloadTotalEnd`が設定されている AND 累積Load Countが`workloadTotalEnd`以上 THEN システムは当該Habitを「累積完了」と判定するものとする
2. WHEN Habitに`workloadTotalEnd`が設定されていない THEN システムは当該Habitを「累積完了」と判定しないものとする
3. WHEN Habitの`workloadTotalEnd`が0以下 THEN システムは当該Habitを「累積完了」と判定しないものとする

### 要件 3: GoalTree（左サイドバー）表示

**ユーザーストーリー:** ユーザーとして、累積完了したHabitを左サイドバーで視覚的に区別したい。これにより、達成済みのHabitを一目で確認できるようになる。

#### 受け入れ基準

1. WHEN Habitが累積完了状態 THEN GoalTreeはHabit名に打ち消し線（line-through）スタイルを適用するものとする
2. WHEN Habitが累積完了状態 THEN GoalTreeはHabit名のテキスト色を薄いグレー（text-zinc-400）に変更するものとする
3. WHEN Habitが累積完了状態でない THEN GoalTreeは通常のスタイルでHabit名を表示するものとする
4. WHEN Habitが累積完了状態 THEN GoalTreeは完了ボタンとワークロード入力フィールドを引き続き表示するものとする（追加記録を許可）

### 要件 4: Nextセクション表示

**ユーザーストーリー:** ユーザーとして、累積完了したHabitをNextセクションに表示したくない。これにより、まだ達成していないHabitに集中できるようになる。

#### 受け入れ基準

1. WHEN Habitが累積完了状態 THEN Next_Sectionは当該Habitをリストから除外するものとする
2. WHEN Habitが累積完了状態でない THEN Next_Sectionは通常通り当該Habitを表示するものとする
3. WHEN すべての候補Habitが累積完了状態 THEN Next_Sectionは「No habits starting in the next 24 hours」メッセージを表示するものとする

### 要件 5: Calendarセクション表示

**ユーザーストーリー:** ユーザーとして、累積完了したHabitをカレンダーに表示したくない。これにより、カレンダーが進行中のHabitのみを表示するようになる。

#### 受け入れ基準

1. WHEN Habitが累積完了状態 THEN Calendar_Sectionは当該Habitのイベントを生成しないものとする
2. WHEN Habitが累積完了状態でない THEN Calendar_Sectionは通常通り当該Habitのイベントを生成するものとする
3. WHEN Habitが累積完了状態になった時点以降 THEN Calendar_Sectionは当該Habitの将来のイベントを表示しないものとする

### 要件 6: Statisticsセクション表示

**ユーザーストーリー:** ユーザーとして、累積完了したHabitの達成状況を統計セクションで確認したい。これにより、全体的な進捗を把握できるようになる。

#### 受け入れ基準

1. WHEN Habitが累積完了状態 THEN Statistics_Sectionは当該Habitを「達成済み」として集計するものとする
2. WHEN Habitが累積完了状態 THEN Statistics_Sectionの進捗率計算で当該Habitを100%として扱うものとする
3. WHEN 累積完了Habitの統計を表示する THEN Statistics_Sectionは累積Load Countと`workloadTotalEnd`の両方を表示するものとする
4. WHEN Summaryページで達成率を計算する THEN システムは累積完了Habitを達成済みとしてカウントするものとする

### 要件 7: ユーティリティ関数

**ユーザーストーリー:** 開発者として、累積完了判定ロジックを再利用可能な関数として実装したい。これにより、コードの重複を避け、一貫した判定ができるようになる。

#### 受け入れ基準

1. THE システムは`isHabitCumulativelyCompleted(habit, activities)`関数を提供するものとする
2. THE システムは`calculateCumulativeLoadCount(habitId, activities)`関数を提供するものとする
3. WHEN これらの関数が呼び出される THEN 関数は型安全な引数と戻り値を持つものとする
4. FOR ALL 有効なHabitとActivityの組み合わせ、累積Load Countを計算してから累積完了判定を行うと、直接累積完了判定を行った結果と一致するものとする（ラウンドトリップ特性）
