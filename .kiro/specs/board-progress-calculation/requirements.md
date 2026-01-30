# Requirements Document

## Introduction

本機能は、BoardセクションのGanttチャートにおける進捗率計算ロジックを改善します。現在の実装では単純に `completedWorkload / workloadTotal * 100` で進捗率を計算していますが、これでは時間経過に基づく期待進捗率が考慮されていません。

本改善により、Goal/Habitの期限と登録日を考慮した時間ベースの進捗率計算を実装し、ユーザーが「予定通り進んでいるか」を視覚的に把握できるようにします。

## Glossary

- **Progress_Calculator**: 進捗率を計算するユーティリティモジュール
- **Effective_Deadline**: 実効期限（Goalの期限継承ルールを適用した後の期限）
- **Expected_Progress**: 経過時間に基づく期待進捗率
- **Actual_Progress**: 実際のworkload完了に基づく進捗率
- **Goal**: 目標を表すエンティティ（親子関係を持つ）
- **Habit**: 習慣を表すエンティティ（Goalに紐づく）
- **Workload_Total**: Habitの総作業量
- **Completed_Workload**: 完了した作業量（Activityから集計）

## Requirements

### Requirement 1: Goalの実効期限決定

**User Story:** As a ユーザー, I want to Goalの期限が自動的に継承される機能, so that 期限を設定していないGoalでも適切な期限が適用される。

#### Acceptance Criteria

1. WHEN Goalに期限（dueDate）が設定されている THEN THE Progress_Calculator SHALL そのGoalの期限をそのまま使用する
2. WHEN Goalに期限が設定されておらず、親Goalに期限が設定されている THEN THE Progress_Calculator SHALL 親Goalの期限を継承する
3. WHEN Goalに期限が設定されておらず、親Goalにも期限が設定されていない THEN THE Progress_Calculator SHALL 祖先Goalを再帰的に探索して期限を継承する
4. WHEN Goalおよび全ての祖先Goalに期限が設定されていない THEN THE Progress_Calculator SHALL Goalの登録日（createdAt）から1年後を実効期限とする
5. WHEN 実効期限を計算する THEN THE Progress_Calculator SHALL 全てのGoalに対して一貫した期限継承ロジックを適用する

### Requirement 2: Habitの実効期限決定

**User Story:** As a ユーザー, I want to Habitの期限が適切に決定される機能, so that 期限を設定していないHabitでも親Goalの期限に基づいて進捗が計算される。

#### Acceptance Criteria

1. WHEN Habitに期限（dueDate）が設定されている THEN THE Progress_Calculator SHALL そのHabitの期限をそのまま使用する
2. WHEN Habitに期限が設定されていない THEN THE Progress_Calculator SHALL 紐づくGoalの実効期限を使用する
3. WHEN Habitに期限が設定されておらず、紐づくGoalも存在しない THEN THE Progress_Calculator SHALL Habitの登録日（createdAt）から1年後を実効期限とする

### Requirement 3: 時間ベースの進捗率計算

**User Story:** As a ユーザー, I want to 時間経過に基づいた進捗率を確認できる機能, so that 予定通りに進んでいるかを把握できる。

#### Acceptance Criteria

1. WHEN Habitの進捗率を計算する THEN THE Progress_Calculator SHALL 登録日から実効期限までの期間を基準期間とする
2. WHEN 基準期間が決定された THEN THE Progress_Calculator SHALL 現在日時の経過割合を計算する（経過日数 / 総日数）
3. WHEN 実際の進捗率を計算する THEN THE Progress_Calculator SHALL completedWorkload / workloadTotal * 100 を使用する
4. WHEN workloadTotalが0または未設定の場合 THEN THE Progress_Calculator SHALL 進捗率を0として扱う
5. WHEN Habitが完了済み（completed=true）の場合 THEN THE Progress_Calculator SHALL 進捗率を100として扱う

### Requirement 4: Goalの進捗率集計

**User Story:** As a ユーザー, I want to Goalの進捗率が子Habitの進捗率から集計される機能, so that Goal全体の進捗状況を把握できる。

#### Acceptance Criteria

1. WHEN Goalの進捗率を計算する THEN THE Progress_Calculator SHALL 直接紐づく全てのHabitの進捗率の平均を計算する
2. WHEN Goalに紐づくHabitが存在しない THEN THE Progress_Calculator SHALL 進捗率を0として扱う
3. WHEN Goalが完了済み（isCompleted=true）の場合 THEN THE Progress_Calculator SHALL 進捗率を100として扱う

### Requirement 5: Ganttチャートでの進捗表示

**User Story:** As a ユーザー, I want to Ganttチャートで進捗状況を視覚的に確認できる機能, so that 予定と実績の差を一目で把握できる。

#### Acceptance Criteria

1. WHEN Ganttチャートのバーを描画する THEN THE UI SHALL 実際の進捗率に基づいてバーを塗りつぶす
2. WHEN 進捗バーを表示する THEN THE UI SHALL 進捗率0-100%の範囲でバーの塗りつぶし幅を決定する
3. WHEN 完了済みアイテムを表示する THEN THE UI SHALL バー全体を完了色で塗りつぶす

### Requirement 6: エッジケースの処理

**User Story:** As a システム, I want to 異常なデータを適切に処理する機能, so that エラーなく進捗率が計算される。

#### Acceptance Criteria

1. IF 登録日が実効期限より後の場合 THEN THE Progress_Calculator SHALL 進捗率を0として扱う
2. IF 現在日時が実効期限を過ぎている場合 THEN THE Progress_Calculator SHALL 経過割合を100%として扱う
3. IF 現在日時が登録日より前の場合 THEN THE Progress_Calculator SHALL 経過割合を0%として扱う
4. IF workloadTotalが負の値の場合 THEN THE Progress_Calculator SHALL workloadTotalを0として扱う
5. IF completedWorkloadが負の値の場合 THEN THE Progress_Calculator SHALL completedWorkloadを0として扱う
