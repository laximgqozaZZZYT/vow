# 実装計画: Slack習慣通知

## 概要

既存のSlack OAuth連携を活用し、AWS EventBridgeによるスケジュール実行を追加して、習慣リマインダー、フォローアップメッセージ、週次レポート、スラッシュコマンドを実装します。
## タスク


- [x] 1. データベースマイグレーションとスキーマ更新
  - [x] 1.1 usersテーブルにtimezone列を追加するマイグレーション作成
    - `supabase/migrations/`にマイグレーションファイル作成
    - timezone列（TEXT DEFAULT 'Asia/Tokyo'）を追加
    - _Requirements: 7.1, 7.2_

- [x] 2. Lambdaハンドラーの実装
  - [x] 2.1 リマインダーハンドラーの作成
    - `backend/app/handlers/reminder_handler.py`を作成
    - EventBridgeからのトリガーを処理
    - ReminderServiceを呼び出してリマインダー送信
    - _Requirements: 1.1, 6.1, 6.5_
  
  - [x] 2.2 フォローアップハンドラーの作成
    - `backend/app/handlers/follow_up_handler.py`を作成
    - フォローアップとRemind Laterの両方を処理
    - _Requirements: 2.1, 6.2, 6.3, 6.5_
  
  - [x] 2.3 週次レポートハンドラーの作成
    - `backend/app/handlers/weekly_report_handler.py`を作成
    - WeeklyReportGeneratorを呼び出してレポート送信
    - _Requirements: 4.1, 6.4, 6.5_
  
  - [x] 2.4 統合Lambdaハンドラーの更新
    - `backend/lambda_handler.py`を更新
    - EventBridgeとAPI Gatewayの両方に対応
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 3. ReminderServiceの実装
  - [x] 3.1 ReminderServiceクラスの作成
    - `backend/app/services/reminder_service.py`を作成
    - タイムゾーン対応のリマインダーチェック
    - 送信条件の検証（通知設定、完了状態、重複チェック）
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 7.1, 7.2_
  
  - [ ]* 3.2 ReminderServiceのプロパティテスト
    - **Property 1: リマインダー送信条件**
    - **Property 16: タイムゾーン処理**
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 1.6, 7.1, 7.2**

- [x] 4. Slack Interaction Routerの実装
  - [x] 4.1 インタラクションエンドポイントの作成
    - `backend/app/routers/slack_interactions.py`を作成
    - 署名検証の実装
    - ボタンクリック処理（Done/Skip/Remind Later）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [x] 4.2 スラッシュコマンドエンドポイントの作成
    - /habit-done, /habit-status, /habit-listコマンドの処理
    - 習慣名の類似検索
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 4.3 メインアプリにルーターを登録
    - `backend/app/main.py`にslack_interactionsルーターを追加
    - _Requirements: 3.1, 5.1_
  
  - [ ]* 4.4 Interaction Routerのプロパティテスト
    - **Property 6: ボタンアクション処理**
    - **Property 7: ストリーク表示**
    - **Property 8: 重複完了処理**
    - **Property 12: スラッシュコマンド処理**
    - **Property 13: 習慣名の類似検索**
    - **Property 14: 未接続ユーザーへのメッセージ**
    - **Validates: Requirements 3.1-3.6, 5.1-5.6**

- [x] 5. チェックポイント - 基本機能の確認
  - すべてのテストが通ることを確認
  - 質問があればユーザーに確認

- [x] 6. FollowUpAgentの拡張
  - [x] 6.1 既存のFollowUpAgentにRemind Later処理を追加
    - `backend/app/services/follow_up_agent.py`を更新
    - remind_later_atが到来したリマインダーの再送信
    - _Requirements: 2.5_
  
  - [ ]* 6.2 FollowUpAgentのプロパティテスト
    - **Property 3: フォローアップ送信条件**
    - **Property 4: フォローアップメッセージフォーマット**
    - **Property 5: Remind Later処理**
    - **Validates: Requirements 2.1-2.5**

- [x] 7. WeeklyReportGeneratorの拡張
  - [x] 7.1 タイムゾーン対応の追加
    - `backend/app/services/weekly_report_generator.py`を更新
    - ユーザーのタイムゾーンに基づく送信時刻判定
    - _Requirements: 7.3_
  
  - [ ]* 7.2 WeeklyReportGeneratorのプロパティテスト
    - **Property 9: 週次レポート送信条件**
    - **Property 10: 週次レポート内容**
    - **Property 11: アクティビティなしの週次レポート**
    - **Validates: Requirements 4.1-4.5**

- [x] 8. SlackBlockBuilderの拡張
  - [x] 8.1 日本語メッセージの追加
    - `backend/app/services/slack_block_builder.py`を更新
    - 日本語のメッセージテンプレートを追加
    - _Requirements: 1.2, 2.2_
  
  - [ ]* 8.2 SlackBlockBuilderのプロパティテスト
    - **Property 2: リマインダーメッセージフォーマット**
    - **Validates: Requirements 1.2, 2.2**

- [x] 9. エラーハンドリングの強化
  - [x] 9.1 トークンリフレッシュ処理の追加
    - `backend/app/services/slack_service.py`を更新
    - 期限切れトークンの自動リフレッシュ
    - リフレッシュ失敗時の接続無効化
    - _Requirements: 8.3, 8.4_
  
  - [ ]* 9.2 エラーハンドリングのプロパティテスト
    - **Property 17: レート制限とサーキットブレーカー**
    - **Property 18: トークンリフレッシュ**
    - **Property 19: エラーハンドリング**
    - **Validates: Requirements 8.1-8.5**

- [x] 10. チェックポイント - サービス層の確認
  - すべてのテストが通ることを確認
  - 質問があればユーザーに確認

- [x] 11. Terraformインフラ設定
  - [x] 11.1 EventBridgeスケジュールの作成
    - `infra/terraform/eventbridge.tf`を作成
    - リマインダーチェック（5分間隔）
    - フォローアップチェック（15分間隔）
    - 週次レポート（15分間隔）
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 11.2 IAMロールとポリシーの作成
    - EventBridgeからLambdaを呼び出すためのIAMロール
    - _Requirements: 6.1_

- [x] 12. Lambda パッケージの更新
  - [x] 12.1 新しいハンドラーをLambdaパッケージに追加
    - `backend/lambda_package/app/handlers/`にハンドラーをコピー
    - `backend/lambda_package/app/services/`にサービスをコピー
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 13. 統合テストの作成
  - [ ]* 13.1 エンドツーエンドテストの作成
    - Slack APIモックを使用したテスト
    - EventBridgeトリガーのシミュレーション
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [x] 14. 最終チェックポイント
  - すべてのテストが通ることを確認
  - 質問があればユーザーに確認

## 注意事項

- `*`マークのタスクはオプションで、MVPでは省略可能
- 各タスクは特定の要件を参照しトレーサビリティを確保
- チェックポイントで段階的に検証を実施
- プロパティテストは設計書のプロパティを検証
