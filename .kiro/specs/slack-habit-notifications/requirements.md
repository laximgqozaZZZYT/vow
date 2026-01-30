# 要件定義書

## はじめに

本ドキュメントは、VOW習慣管理アプリにおけるSlack通知機能の要件を定義します。既存のSlack OAuth連携を活用し、習慣リマインダー、フォローアップメッセージ、週次レポート、およびスラッシュコマンドを実装します。

## 用語集

- **Notification_Scheduler**: AWS EventBridgeを使用してLambda関数をスケジュール実行するコンポーネント
- **Reminder_Service**: 習慣のtrigger_timeに基づいてSlack DMにリマインダーを送信するサービス
- **Follow_Up_Agent**: 未完了の習慣に対してフォローアップメッセージを送信するエージェント
- **Weekly_Report_Generator**: 週次の習慣完了レポートを生成・送信するサービス
- **Slack_Interaction_Handler**: Slackのボタンクリックやスラッシュコマンドを処理するハンドラー
- **Timezone_Manager**: ユーザーのタイムゾーンに基づいて適切な時刻を計算するコンポーネント
- **Rate_Limiter**: Slack APIのレート制限を管理するコンポーネント

## 要件

### 要件 1: 習慣リマインダー通知

**ユーザーストーリー:** ユーザーとして、設定したtrigger_timeにSlack DMでリマインダーを受け取りたい。これにより、習慣を忘れずに実行できる。

#### 受け入れ基準

1. WHEN 習慣のtrigger_timeが到来した場合 THEN THE Reminder_Service SHALL ユーザーのSlack DMにリマインダーメッセージを送信する
2. WHEN リマインダーを送信する場合 THEN THE Reminder_Service SHALL Done/Skip/Remind Laterの3つのインタラクティブボタンを含める
3. WHILE ユーザーのslack_notifications_enabledがfalseの場合 THE Reminder_Service SHALL リマインダーを送信しない
4. WHEN 習慣が既に当日完了済みの場合 THEN THE Reminder_Service SHALL リマインダーを送信しない
5. WHEN 同じ習慣に対して当日既にリマインダーを送信済みの場合 THEN THE Reminder_Service SHALL 重複送信を防止する
6. WHEN ユーザーのSlack接続が無効な場合 THEN THE Reminder_Service SHALL アプリ内通知にフォールバックする

### 要件 2: フォローアップメッセージ

**ユーザーストーリー:** ユーザーとして、trigger_timeから一定時間経過後も習慣が未完了の場合にフォローアップメッセージを受け取りたい。これにより、習慣の実行を促される。

#### 受け入れ基準

1. WHEN trigger_timeから2時間以上経過し習慣が未完了の場合 THEN THE Follow_Up_Agent SHALL フォローアップメッセージを送信する
2. WHEN フォローアップメッセージを送信する場合 THEN THE Follow_Up_Agent SHALL 経過時間を含むメッセージとDone/Skip/Remind Laterボタンを含める
3. WHEN 同じ習慣に対して当日既にフォローアップを送信済みの場合 THEN THE Follow_Up_Agent SHALL 重複送信を防止する
4. WHEN ユーザーがSkipボタンをクリックした場合 THEN THE Follow_Up_Agent SHALL 当日のその習慣に対する追加通知を停止する
5. WHEN ユーザーがRemind Laterボタンをクリックした場合 THEN THE Follow_Up_Agent SHALL 60分後に再度リマインダーを送信する

### 要件 3: インタラクティブボタン処理

**ユーザーストーリー:** ユーザーとして、Slackメッセージ内のボタンをクリックして習慣を完了・スキップ・後でリマインドできるようにしたい。これにより、アプリを開かずに習慣を管理できる。

#### 受け入れ基準

1. WHEN ユーザーがDoneボタンをクリックした場合 THEN THE Slack_Interaction_Handler SHALL 習慣を完了としてマークし確認メッセージを返す
2. WHEN ユーザーがSkipボタンをクリックした場合 THEN THE Slack_Interaction_Handler SHALL 当日のスキップを記録し確認メッセージを返す
3. WHEN ユーザーがRemind Laterボタンをクリックした場合 THEN THE Slack_Interaction_Handler SHALL remind_later_atを設定し確認メッセージを返す
4. WHEN 習慣完了時にストリークが存在する場合 THEN THE Slack_Interaction_Handler SHALL ストリーク数を含む確認メッセージを返す
5. WHEN 習慣が既に当日完了済みの場合 THEN THE Slack_Interaction_Handler SHALL 既に完了済みである旨のメッセージを返す
6. IF Slack APIエラーが発生した場合 THEN THE Slack_Interaction_Handler SHALL エラーをログに記録しユーザーにエラーメッセージを返す

### 要件 4: 週次サマリーレポート

**ユーザーストーリー:** ユーザーとして、週次の習慣完了レポートをSlackで受け取りたい。これにより、自分の進捗を振り返ることができる。

#### 受け入れ基準

1. WHEN ユーザーが設定したweekly_report_dayとweekly_report_timeが到来した場合 THEN THE Weekly_Report_Generator SHALL 週次レポートを送信する
2. WHEN 週次レポートを生成する場合 THEN THE Weekly_Report_Generator SHALL 完了率、完了数/総数、最長ストリーク、注意が必要な習慣を含める
3. WHILE ユーザーのweekly_slack_report_enabledがfalseの場合 THE Weekly_Report_Generator SHALL レポートを送信しない
4. WHEN 週次レポートを送信する場合 THEN THE Weekly_Report_Generator SHALL アプリ内の詳細レポートへのリンクボタンを含める
5. WHEN ユーザーが当週に習慣を追跡していない場合 THEN THE Weekly_Report_Generator SHALL 習慣追加を促すメッセージを送信する

### 要件 5: スラッシュコマンド（オプション）

**ユーザーストーリー:** ユーザーとして、Slackのスラッシュコマンドで習慣を管理したい。これにより、Slackから直接習慣を操作できる。

#### 受け入れ基準

1. WHEN ユーザーが/habit-done [name]コマンドを実行した場合 THEN THE Slack_Interaction_Handler SHALL 指定された習慣を完了としてマークする
2. WHEN ユーザーが/habit-done（名前なし）コマンドを実行した場合 THEN THE Slack_Interaction_Handler SHALL 未完了の習慣リストをボタン付きで表示する
3. WHEN ユーザーが/habit-statusコマンドを実行した場合 THEN THE Slack_Interaction_Handler SHALL 当日の進捗サマリーを表示する
4. WHEN ユーザーが/habit-listコマンドを実行した場合 THEN THE Slack_Interaction_Handler SHALL ゴール別にグループ化された習慣リストを表示する
5. WHEN 指定された習慣名が見つからない場合 THEN THE Slack_Interaction_Handler SHALL 類似の習慣名を提案する
6. WHEN ユーザーのSlack接続が存在しない場合 THEN THE Slack_Interaction_Handler SHALL 接続を促すメッセージを返す

### 要件 6: AWS Lambda スケジューリング

**ユーザーストーリー:** システム管理者として、通知処理を定期的に自動実行したい。これにより、ユーザーに適切なタイミングで通知を届けられる。

#### 受け入れ基準

1. THE Notification_Scheduler SHALL 5分間隔でリマインダーチェックLambda関数を実行する
2. THE Notification_Scheduler SHALL 15分間隔でフォローアップチェックLambda関数を実行する
3. THE Notification_Scheduler SHALL 15分間隔でRemind Laterチェックを実行する
4. THE Notification_Scheduler SHALL 15分間隔で週次レポート送信チェックを実行する
5. WHEN Lambda関数が実行される場合 THEN THE Notification_Scheduler SHALL 処理結果（送信数、エラー数）をCloudWatchにログ出力する

### 要件 7: タイムゾーン処理

**ユーザーストーリー:** ユーザーとして、自分のタイムゾーンに基づいた時刻でリマインダーを受け取りたい。これにより、適切な時刻に通知を受け取れる。

#### 受け入れ基準

1. WHEN リマインダー時刻を計算する場合 THEN THE Timezone_Manager SHALL ユーザーのタイムゾーン設定を考慮する
2. WHEN ユーザーのタイムゾーンが設定されていない場合 THEN THE Timezone_Manager SHALL デフォルトでAsia/Tokyoを使用する
3. WHEN 週次レポートの送信時刻を計算する場合 THEN THE Timezone_Manager SHALL ユーザーのタイムゾーンに基づいて判定する

### 要件 8: エラーハンドリングとレート制限

**ユーザーストーリー:** システム管理者として、Slack APIのエラーとレート制限を適切に処理したい。これにより、システムの安定性を維持できる。

#### 受け入れ基準

1. WHEN Slack APIがレート制限エラーを返した場合 THEN THE Rate_Limiter SHALL Retry-Afterヘッダーに基づいて指数バックオフでリトライする
2. WHEN Slack APIが3回連続で失敗した場合 THEN THE Rate_Limiter SHALL サーキットブレーカーを開いて一時的にリクエストを停止する
3. WHEN トークンが期限切れの場合 THEN THE Slack_Interaction_Handler SHALL リフレッシュトークンを使用して新しいトークンを取得する
4. WHEN トークンのリフレッシュに失敗した場合 THEN THE Slack_Interaction_Handler SHALL 接続を無効としてマークしユーザーに再接続を促す
5. IF 予期しないエラーが発生した場合 THEN THE Slack_Interaction_Handler SHALL エラーをCloudWatchにログ出力し処理を継続する
