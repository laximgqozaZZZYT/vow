# 実装計画: AWS本番環境セットアップとSlack連携修正

## 概要

本実装計画は、Slack OAuth連携の修正（Phase 1）、AWS本番環境の構築（Phase 2）、Slack連携機能の動作確認（Phase 3）を段階的に実施します。

## タスク

- [x] 1. Phase 1: Slack OAuth修正（緊急）
  - [x] 1.1 認証ミドルウェアのステージプレフィックス対応
    - `backend/app/middleware/auth.py`を修正
    - `_strip_stage_prefix`メソッドを追加
    - `_is_excluded_path`メソッドを修正してプレフィックスを除去してから照合
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ]* 1.2 ステージプレフィックス処理のプロパティテスト作成
    - **Property 1: ステージプレフィックス処理**
    - **Validates: Requirements 2.1, 2.2, 2.3**
  
  - [x] 1.3 Terraform変数の追加
    - `infra/terraform/variables.tf`にSlack/Supabase変数を追加
    - `slack_client_id`, `slack_client_secret`, `slack_signing_secret`
    - `token_encryption_key`, `supabase_url`, `supabase_anon_key`
    - `cors_origins`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 1.4 Lambda環境変数の設定（Terraform）
    - `infra/terraform/lambda.tf`の環境変数ブロックを更新
    - Slack関連環境変数を追加
    - Supabase関連環境変数を追加
    - CORS_ORIGINS環境変数を追加
    - SLACK_CALLBACK_URIを動的に生成
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  
  - [x] 1.5 環境変数検証機能の追加
    - `backend/app/config.py`に`validate_slack_settings`メソッドを追加
    - 起動時に環境変数を検証してログ出力
    - _Requirements: 1.6, 10.1, 10.2, 10.3_
  
  - [ ]* 1.6 環境変数検証のプロパティテスト作成
    - **Property 8: 環境変数検証**
    - **Validates: Requirements 1.6**

- [ ] 2. チェックポイント - Phase 1完了確認
  - Terraformの変更を適用（`terraform apply`）
  - Lambda環境変数が正しく設定されていることを確認
  - Slack OAuth連携をテスト（Connect Slack → 認証 → コールバック）
  - 問題があればユーザーに確認

- [x] 3. Phase 2: AWS本番環境構築
  - [x] 3.1 本番環境用tfvarsファイルの作成
    - `infra/terraform/terraform.production.tfvars`を作成
    - 本番環境固有の設定値を定義
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 3.2 Aurora本番設定の条件追加
    - `infra/terraform/aurora.tf`に本番環境条件を追加
    - `deletion_protection = true`（本番のみ）
    - `skip_final_snapshot = false`（本番のみ）
    - バックアップ保持期間を14日に延長（本番のみ）
    - _Requirements: 4.4, 4.5_
  
  - [x] 3.3 本番Terraformワークスペースの作成
    - `terraform workspace new production`
    - 本番用state fileの分離
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 3.4 本番Amplify環境変数の設定
    - `NEXT_PUBLIC_API_URL`を本番API Gatewayに設定
    - `NEXT_PUBLIC_SLACK_API_URL`を本番API Gatewayに設定
    - Cognito関連環境変数を設定
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 4. チェックポイント - Phase 2完了確認
  - 本番Terraformワークスペースで`terraform plan`を実行
  - 本番環境のリソースが正しく計画されていることを確認
  - 問題があればユーザーに確認

- [ ] 5. Phase 3: Slack連携機能の動作確認
  - [ ] 5.1 Slackコマンドハンドラーの確認
    - `/habit-status`コマンドの動作確認
    - `/habit-list`コマンドの動作確認
    - `/habit-done`コマンドの動作確認
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 5.2 Slackコマンド応答のプロパティテスト作成
    - **Property 3: Slackコマンド応答**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  
  - [ ] 5.3 Slackインタラクションハンドラーの確認
    - ボタンクリックによる習慣完了の動作確認
    - Block_Kitフォーマットの確認
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ]* 5.4 署名検証のプロパティテスト作成
    - **Property 5: 署名検証**
    - **Validates: Requirements 8.4, 8.5**
  
  - [ ] 5.5 週次レポート機能の確認
    - レポート生成ロジックの確認
    - 条件付き送信の確認
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 5.6 週次レポートのプロパティテスト作成
    - **Property 6: 週次レポート内容**
    - **Property 7: 週次レポート条件付き送信**
    - **Validates: Requirements 9.2, 9.4**

- [ ] 6. チェックポイント - Phase 3完了確認
  - すべてのテストが通過することを確認
  - Slack連携機能が正常に動作することを確認
  - 問題があればユーザーに確認

- [ ] 7. CORS設定の確認
  - [ ] 7.1 CORS設定の検証
    - `backend/app/main.py`のCORS設定を確認
    - 開発環境と本番環境のオリジンが含まれていることを確認
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 8. 接続テスト機能の確認
  - [ ] 8.1 テスト接続エンドポイントの確認
    - `/api/slack/test`エンドポイントの動作確認
    - テストメッセージがSlack DMに送信されることを確認
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 9. 最終チェックポイント
  - すべてのテストが通過することを確認
  - 開発環境でSlack OAuth連携が正常に動作することを確認
  - 問題があればユーザーに確認

## 備考

- タスクに`*`マークが付いているものはオプション（テスト関連）
- 各チェックポイントでユーザーに確認を取る
- 本番環境へのデプロイは、開発環境での動作確認後に実施
- Terraform applyは手動で実行（自動実行しない）
