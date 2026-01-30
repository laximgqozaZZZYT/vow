# 実装計画: AWSサーバレス移行

## 概要

本番環境をVercel + SupabaseからAWSサーバレス構成（Lambda + API Gateway + Aurora Serverless v2）に移行するための実装タスクです。コスト優先（月額~$48目標）でゼロダウンタイム移行を実現します。

## タスク

- [x] 1. CDKインフラ基盤の構築
  - [x] 1.1 VPCスタックの更新（Lambda用サブネット追加）
    - Private Subnet with NAT Gateway（またはVPC Endpoint）
    - セキュリティグループ設定
    - _Requirements: 4.5, 11.2, 11.5_
  
  - [x] 1.2 Aurora Serverless v2スタックの作成
    - PostgreSQL 15互換クラスター
    - 0.5 ACU最小設定
    - Secrets Manager統合
    - _Requirements: 2.4, 2.5, 2.7, 11.1_
  
  - [x] 1.3 Cognitoスタックの作成
    - User Pool設定
    - Google OAuth IdP設定
    - GitHub OAuth IdP設定（OIDC）
    - App Client設定
    - _Requirements: 3.1, 3.2, 3.8_

- [x] 2. Lambda + API Gateway構築
  - [x] 2.1 FastAPIのMangum対応
    - lambda_handler.py作成
    - main.pyのLifespan更新
    - 環境変数対応
    - _Requirements: 4.1_
  
  - [x] 2.2 Lambdaスタックの作成
    - 512MB、30秒タイムアウト設定
    - VPC接続設定
    - Secrets Manager権限
    - X-Ray有効化
    - _Requirements: 4.2, 4.5, 8.5_
  
  - [x] 2.3 API Gatewayスタックの作成
    - REST API設定
    - CORS設定
    - Lambda統合
    - スロットリング設定
    - _Requirements: 4.3, 4.4_
  
  - [ ]* 2.4 Lambdaヘルスチェックテスト
    - ヘルスチェックエンドポイント検証
    - コールドスタート時間計測
    - _Requirements: 4.6, 4.7_

- [x] 3. チェックポイント - インフラ構築確認
  - すべてのCDKスタックがデプロイ可能であることを確認
  - 問題があればユーザーに確認

- [x] 4. 認証ミドルウェアの更新
  - [x] 4.1 Cognito JWT検証ミドルウェア実装
    - backend/app/middleware/auth.pyの更新
    - Cognito公開鍵取得
    - JWT検証ロジック
    - _Requirements: 3.5, 4.4_
  
  - [ ]* 4.2 JWT検証プロパティテスト
    - **Property 3: Cognito JWT Validation**
    - **Validates: Requirements 3.5, 4.4**

- [x] 5. データ移行スクリプトの実装
  - [x] 5.1 Supabaseエクスポートスクリプト
    - scripts/migration/export_supabase.py
    - 全テーブルエクスポート
    - チェックサム計算
    - _Requirements: 2.1, 6.7_
  
  - [x] 5.2 Auroraインポートスクリプト
    - scripts/migration/import_aurora.py
    - Secrets Manager統合
    - バッチインサート
    - _Requirements: 2.2_
  
  - [x] 5.3 データ検証スクリプト
    - scripts/migration/verify_data.py
    - 行数比較
    - チェックサム比較
    - _Requirements: 2.3, 6.6, 6.7_
  
  - [ ]* 5.4 データ移行プロパティテスト
    - **Property 1: Data Migration Round-Trip**
    - **Validates: Requirements 2.1, 2.2, 2.3, 6.6, 6.7**

- [x] 6. ユーザー移行スクリプトの実装
  - [x] 6.1 Cognito移行スクリプト
    - scripts/migration/migrate_users.py
    - 属性マッピング
    - エラーハンドリング
    - _Requirements: 3.3, 3.6, 3.7_
  
  - [ ]* 6.2 ユーザー移行プロパティテスト
    - **Property 2: User Migration Preservation**
    - **Validates: Requirements 3.3, 3.4, 3.6**

- [x] 7. チェックポイント - 移行スクリプト確認
  - すべての移行スクリプトが動作することを確認
  - 問題があればユーザーに確認

- [x] 8. 増分同期の実装
  - [x] 8.1 増分同期スクリプト
    - scripts/migration/sync_incremental.py
    - タイムスタンプ追跡
    - コンフリクト解決（last write wins）
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]* 8.2 増分同期プロパティテスト
    - **Property 4: Incremental Sync Consistency**
    - **Validates: Requirements 6.1, 6.3**

- [x] 9. 本番Amplifyスタックの作成
  - [x] 9.1 Amplify Hostingスタック
    - infra/stacks/frontend_stack.py
    - mainブランチ接続
    - 環境変数設定
    - _Requirements: 1.1, 1.2, 1.5_

- [x] 10. 監視スタックの作成
  - [x] 10.1 CloudWatch監視スタック
    - infra/stacks/monitoring_stack.py
    - Lambda/API Gateway/Auroraメトリクス
    - アラーム設定
    - SNS通知
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.7_

- [x] 11. ロールバックスクリプトの実装
  - [x] 11.1 ロールバックコントローラー
    - scripts/migration/rollback.py
    - DNS切り戻し
    - 検証ステップ
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 12. CI/CDパイプラインの作成
  - [x] 12.1 Lambda CI/CDワークフロー
    - .github/workflows/deploy-lambda-prod.yml
    - テスト実行
    - デプロイメントパッケージ作成
    - Lambda更新
    - _Requirements: 12.2, 12.3, 12.4, 12.5_
  
  - [x] 12.2 フロントエンドCI/CDワークフロー
    - .github/workflows/deploy-frontend-prod.yml
    - Amplifyビルドトリガー
    - _Requirements: 12.1, 12.3_

- [x] 13. チェックポイント - 全コンポーネント確認
  - すべてのスタックとスクリプトが動作することを確認
  - 問題があればユーザーに確認

- [x] 14. 移行ドキュメントの作成
  - [x] 14.1 移行手順書
    - docs/SERVERLESS_MIGRATION.md
    - 事前チェックリスト
    - 移行手順
    - ロールバック手順
    - トラブルシューティング
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

- [ ] 15. 統合テストの実装
  - [ ]* 15.1 CRUD操作プロパティテスト
    - **Property 5: CRUD Operations Verification**
    - **Validates: Requirements 14.2, 14.5**
  
  - [ ]* 15.2 OAuth認証フローテスト
    - Google OAuth検証
    - GitHub OAuth検証
    - _Requirements: 14.1, 14.3_

- [ ] 16. 最終チェックポイント
  - すべてのテストがパスすることを確認
  - 問題があればユーザーに確認

## 備考

- `*` マークのタスクはオプション（テスト関連）
- 各タスクは要件への参照を含む
- チェックポイントで進捗確認
- プロパティテストは設計ドキュメントのプロパティを検証
