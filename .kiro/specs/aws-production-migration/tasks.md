# 実装計画: AWS本番環境移行

## 概要

本番環境をVercel + SupabaseからAWSに移行するための実装タスクです。既存のTerraformモジュールを再利用し、AWS DMSによるデータベース移行、ゼロダウンタイムOAuth移行、旧URLからのリダイレクトを実現します。

## タスク

- [x] 1. Terraform本番環境設定の追加
  - [x] 1.1 本番用変数ファイルの作成
    - infra/terraform/terraform.production.tfvars作成
    - environment = "production"設定
    - OAuth callback URLs（Cognito用）追加
    - _Requirements: 6.1, 6.7_
  
  - [x] 1.2 variables.tfへの本番用変数追加
    - enable_dms変数追加
    - supabase_host, supabase_database, supabase_username, supabase_password変数追加
    - github_repository_url, github_access_token変数追加
    - custom_domain, alert_email変数追加
    - _Requirements: 6.1, 6.8_
  
  - [x] 1.3 Aurora本番設定の条件分岐追加
    - deletion_protection = true（本番のみ）
    - skip_final_snapshot = false（本番のみ）
    - backup_retention_period = 14（本番のみ）
    - _Requirements: 6.4, 6.5_

- [x] 2. DMS Terraformリソースの作成
  - [x] 2.1 DMS Replication Instanceの作成
    - infra/terraform/dms.tf作成
    - dms.t3.medium インスタンス
    - VPC内Private Subnet配置
    - _Requirements: 2.1_
  
  - [x] 2.2 DMSセキュリティグループの作成
    - DMS用セキュリティグループ
    - Aurora SGへのingress rule追加
    - _Requirements: 2.1, 11.5_
  
  - [x] 2.3 DMS Source/Target Endpointの作成
    - Supabase PostgreSQL source endpoint（SSL有効）
    - Aurora target endpoint（Secrets Manager統合）
    - _Requirements: 2.2, 2.3_
  
  - [x] 2.4 DMS Replication Taskの作成
    - full-load-and-cdc migration type
    - 全テーブル選択ルール
    - ログ有効化
    - _Requirements: 2.4, 2.5, 2.6_

- [x] 3. チェックポイント - Terraformインフラ確認
  - terraform plan実行して本番リソースを確認
  - 問題があればユーザーに確認

- [x] 4. Amplify Terraformリソースの作成
  - [x] 4.1 Amplify Appリソースの作成
    - infra/terraform/amplify.tf作成
    - GitHubリポジトリ接続
    - WEB_COMPUTE platform（SSR対応）
    - 環境変数設定（Cognito, API URL）
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [x] 4.2 Amplify Branch設定
    - mainブランチをPRODUCTIONステージに設定
    - auto_build有効化
    - _Requirements: 4.2_
  
  - [x] 4.3 カスタムドメイン設定（オプション）
    - aws_amplify_domain_association（条件付き）
    - _Requirements: 4.3, 4.4_

- [x] 5. 監視Terraformリソースの作成
  - [x] 5.1 SNSトピックとアラームの作成
    - infra/terraform/monitoring.tf作成
    - SNSトピック（アラート用）
    - Email subscription
    - _Requirements: 9.1, 9.7_
  
  - [x] 5.2 CloudWatchダッシュボードの作成
    - Lambda Invocations/Errors/Duration
    - Aurora CPU/Connections/ACU
    - _Requirements: 9.2_
  
  - [x] 5.3 CloudWatchアラームの作成
    - Lambda errors > 5
    - Lambda p99 duration > 2s
    - Aurora CPU > 80%
    - _Requirements: 9.3, 9.4_

- [x] 6. チェックポイント - 全Terraformリソース確認
  - terraform plan実行して全リソースを確認
  - 問題があればユーザーに確認

- [x] 7. データ移行スクリプトの実装
  - [x] 7.1 データ検証スクリプトの作成
    - scripts/migration/verify_data.py作成
    - 行数比較機能
    - チェックサム比較機能
    - 外部キー整合性検証
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 7.2 データ移行プロパティテスト
    - **Property 2: Data Migration Completeness**
    - **Property 3: Data Integrity - Checksum Verification**
    - **Property 4: Foreign Key Integrity**
    - **Validates: Requirements 2.6, 2.7, 2.8, 8.1, 8.2, 8.3**

- [x] 8. ユーザー移行スクリプトの実装
  - [x] 8.1 Cognitoユーザー移行スクリプトの作成
    - scripts/migration/migrate_users.py作成
    - Supabase auth.usersからユーザー取得
    - Cognito admin_create_user実行
    - supabase_id保持
    - _Requirements: 3.6, 3.9_
  
  - [ ]* 8.2 ユーザー移行プロパティテスト
    - **Property 5: User Migration Preservation**
    - **Validates: Requirements 3.6**

- [x] 9. チェックポイント - 移行スクリプト確認
  - スクリプトの動作確認
  - 問題があればユーザーに確認

- [x] 10. ロールバックスクリプトの実装
  - [x] 10.1 ロールバックスクリプトの作成
    - scripts/migration/rollback.sh作成
    - Vercelリダイレクト解除手順
    - OAuth callback URL戻し確認
    - DMS停止
    - SNS通知
    - _Requirements: 10.3, 10.4, 10.5, 10.7_

- [x] 11. CI/CDワークフローの作成
  - [x] 11.1 本番フロントエンドCI/CDの作成
    - .github/workflows/deploy-frontend-prod.yml作成
    - mainブランチpushトリガー
    - OIDC認証
    - Amplifyビルドトリガー
    - _Requirements: 12.1, 12.3_
  
  - [x] 11.2 本番LambdaCI/CDの作成
    - .github/workflows/deploy-lambda-prod.yml作成
    - mainブランチpushトリガー
    - テスト実行
    - Lambda更新
    - _Requirements: 12.2, 12.3, 12.4, 12.5_

- [x] 12. 移行ドキュメントの作成
  - [x] 12.1 移行手順書の作成
    - docs/AWS_PRODUCTION_MIGRATION.md作成
    - 事前チェックリスト
    - 移行手順（Phase 1-5）
    - ロールバック手順
    - トラブルシューティング
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

- [x] 13. チェックポイント - 全コンポーネント確認
  - 全ファイルの確認
  - 問題があればユーザーに確認

- [ ] 14. 統合テストの実装
  - [ ]* 14.1 JWT検証プロパティテスト
    - **Property 6: JWT Token Compatibility**
    - **Validates: Requirements 3.8**
  
  - [ ]* 14.2 CORSプロパティテスト
    - **Property 7: CORS Configuration**
    - **Validates: Requirements 5.3**
  
  - [ ]* 14.3 CRUD操作プロパティテスト
    - **Property 8: CRUD Operations Verification**
    - **Validates: Requirements 14.3**
  
  - [ ]* 14.4 URLリダイレクトプロパティテスト
    - **Property 1: URL Redirect Path Preservation**
    - **Validates: Requirements 1.2**

- [x] 15. 最終チェックポイント
  - すべてのテストがパスすることを確認
  - 問題があればユーザーに確認

## 備考

- `*` マークのタスクはオプション（テスト関連）
- 各タスクは要件への参照を含む
- チェックポイントで進捗確認
- プロパティテストは設計ドキュメントのプロパティを検証
- Terraformは既存モジュールを再利用し、本番用変数で切り替え
