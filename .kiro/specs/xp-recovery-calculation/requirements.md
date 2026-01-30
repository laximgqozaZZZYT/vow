# Requirements Document

## Introduction

本機能は、過去の習慣完了履歴（Activity）から経験値を遡及計算し、既存ユーザーのレベルを正しく反映させるためのXPリカバリー機能を提供します。現在のシステムでは習慣完了時にのみ経験値が付与されますが、過去の履歴に対して経験値が付与されていないため、既存ユーザーのレベルが実際の活動量を反映していません。

## Glossary

- **XP_Recovery_Service**: 過去のActivity履歴から経験値を一括計算・付与するサービス
- **Activity**: 習慣の完了・スキップ・部分完了を記録するテーブルのレコード
- **Experience_Log**: 経験値付与の監査ログを保存するテーブル
- **User_Expertise**: ユーザーの各ドメインにおける専門性レベルを保存するテーブル
- **User_Levels**: ユーザーの総合レベルと共通スキル指標を保存するテーブル
- **THLI_24_Level**: 習慣の難易度レベル（0-199）
- **Domain_Code**: 職業分類ドメインコード（JSCO小分類コード）

## Requirements

### Requirement 1: 過去Activity履歴からの経験値一括計算

**User Story:** As a システム管理者, I want to 過去のActivity履歴から経験値を一括計算する機能, so that 既存ユーザーのレベルを正しく反映できる。

#### Acceptance Criteria

1. WHEN XP_Recovery_Service が特定ユーザーの経験値再計算を実行する THEN THE XP_Recovery_Service SHALL activitiesテーブルからkind='complete'のレコードを全て取得する
2. WHEN 完了Activityが取得された THEN THE XP_Recovery_Service SHALL 各Activityに紐づく習慣のTHLI_24_Levelを使用して経験値を計算する
3. WHEN 習慣にTHLI_24_Levelが設定されていない THEN THE XP_Recovery_Service SHALL デフォルト値50を使用して経験値を計算する
4. WHEN 経験値計算が完了した THEN THE XP_Recovery_Service SHALL experience_logテーブルに記録を追加する
5. WHEN experience_logに記録が追加された THEN THE XP_Recovery_Service SHALL user_expertiseとuser_levelsテーブルを更新する

### Requirement 2: 重複付与防止

**User Story:** As a システム管理者, I want to 経験値の重複付与を防止する機能, so that ユーザーの経験値が正確に保たれる。

#### Acceptance Criteria

1. WHEN XP_Recovery_Service が経験値を付与する前 THEN THE XP_Recovery_Service SHALL experience_logテーブルで同一activity_idの記録が存在するかチェックする
2. IF 同一activity_idの記録が既に存在する THEN THE XP_Recovery_Service SHALL そのActivityに対する経験値付与をスキップする
3. WHEN 経験値付与がスキップされた THEN THE XP_Recovery_Service SHALL スキップされたActivity数をログに記録する
4. WHEN 再計算処理が完了した THEN THE XP_Recovery_Service SHALL 付与された経験値の合計とスキップされた数を返却する

### Requirement 3: バッチ処理対応

**User Story:** As a システム管理者, I want to 大量のActivityを効率的に処理する機能, so that システムに過負荷をかけずに再計算できる。

#### Acceptance Criteria

1. WHEN 処理対象のActivity数が100件を超える THEN THE XP_Recovery_Service SHALL バッチサイズ100件ごとに分割して処理する
2. WHEN バッチ処理中にエラーが発生した THEN THE XP_Recovery_Service SHALL エラーをログに記録し次のバッチに進む
3. WHEN 全バッチの処理が完了した THEN THE XP_Recovery_Service SHALL 処理結果サマリー（成功数、失敗数、スキップ数）を返却する
4. WHILE バッチ処理が実行中 THEN THE XP_Recovery_Service SHALL 進捗状況をログに記録する

### Requirement 4: 管理者向けAPIエンドポイント

**User Story:** As a システム管理者, I want to APIから経験値再計算を実行できる機能, so that 必要に応じて手動で再計算をトリガーできる。

#### Acceptance Criteria

1. WHEN POST /api/admin/recalculate-xp が呼び出された THEN THE API SHALL 全ユーザーの経験値再計算を開始する
2. WHEN POST /api/users/:id/recalculate-xp が呼び出された THEN THE API SHALL 指定されたユーザーの経験値再計算を開始する
3. WHEN 再計算APIが呼び出された THEN THE API SHALL 認証済みユーザーのみアクセスを許可する
4. WHEN 再計算が完了した THEN THE API SHALL 処理結果（付与XP合計、処理Activity数、スキップ数）をJSON形式で返却する
5. IF 再計算中にエラーが発生した THEN THE API SHALL エラー詳細を含むレスポンスを返却する

### Requirement 5: フロントエンド再計算トリガー

**User Story:** As a ユーザー, I want to 設定画面から自分の経験値を再計算できる機能, so that 過去の活動が正しくレベルに反映される。

#### Acceptance Criteria

1. WHEN ユーザーが設定画面を開く THEN THE UI SHALL 「経験値を再計算」ボタンを表示する
2. WHEN ユーザーが再計算ボタンをクリックした THEN THE UI SHALL 確認ダイアログを表示する
3. WHEN ユーザーが確認ダイアログで「実行」を選択した THEN THE UI SHALL POST /api/users/:id/recalculate-xp を呼び出す
4. WHILE 再計算が実行中 THEN THE UI SHALL ローディング状態を表示する
5. WHEN 再計算が完了した THEN THE UI SHALL 結果メッセージ（付与されたXP、更新されたレベル）を表示する
6. IF 再計算中にエラーが発生した THEN THE UI SHALL エラーメッセージを日本語で表示する

### Requirement 6: 経験値計算ロジック

**User Story:** As a システム, I want to 一貫した経験値計算ロジックを使用する機能, so that 通常の習慣完了時と同じ計算結果が得られる。

#### Acceptance Criteria

1. THE XP_Recovery_Service SHALL 既存のexperienceCalculatorServiceの計算ロジックを再利用する
2. WHEN 経験値を計算する THEN THE XP_Recovery_Service SHALL 基本XP = habit_level * 10 の式を使用する
3. WHEN ストリークボーナスを計算する THEN THE XP_Recovery_Service SHALL min(streak_days * 2, 50) の式を使用する
4. WHEN 習慣にdomain_codesが設定されている THEN THE XP_Recovery_Service SHALL 経験値を各ドメインに比例配分する
5. WHEN 習慣にdomain_codesが設定されていない THEN THE XP_Recovery_Service SHALL 経験値を一般ドメイン（000）に付与する

### Requirement 7: 処理結果の永続化

**User Story:** As a システム管理者, I want to 再計算処理の履歴を確認できる機能, so that 過去の再計算実行を追跡できる。

#### Acceptance Criteria

1. WHEN 再計算処理が開始された THEN THE XP_Recovery_Service SHALL job_execution_logテーブルに開始記録を追加する
2. WHEN 再計算処理が完了した THEN THE XP_Recovery_Service SHALL job_execution_logテーブルに完了記録を追加する
3. THE job_execution_log SHALL 処理対象ユーザーID、処理Activity数、付与XP合計、処理時間を記録する
4. IF 再計算処理が失敗した THEN THE XP_Recovery_Service SHALL job_execution_logにエラー詳細を記録する
