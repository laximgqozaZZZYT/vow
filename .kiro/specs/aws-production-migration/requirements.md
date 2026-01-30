# 要件定義書

## はじめに

本ドキュメントは、習慣管理ダッシュボードアプリケーションの本番環境をVercel + SupabaseからAWSに移行するための要件を定義します。

現在の構成：
- 本番フロントエンド: Vercel（Next.js）- URL: vow-app.vercel.app
- 本番データベース・認証: Supabase（PostgreSQL + Auth with Google/GitHub OAuth）
- 開発環境: AWS Amplify + Aurora Serverless v2（Terraform管理）

移行後の構成：
- 本番フロントエンド: AWS Amplify Hosting（Next.js SSR）
- 本番データベース: Amazon Aurora Serverless v2（PostgreSQL互換）
- 本番認証: Amazon Cognito（Google/GitHub OAuth対応）
- 本番バックエンドAPI: AWS Lambda + API Gateway（FastAPI with Mangum）
- インフラ管理: Terraform（開発環境と同一モジュール使用）

主な目的：
- ゼロダウンタイム移行の実現
- 旧URL（vow-app.vercel.app）からの自動リダイレクト
- OAuth認証の継続（Google, GitHub）- ダウンタイムなし
- AWS DMSによるデータベース移行
- 開発環境と同一のTerraformモジュール再利用
- ロールバック機能の確保

## 用語集

- **Amplify_Hosting**: AWSのフルマネージドWebホスティングサービス（Next.js SSR対応）
- **Aurora_Serverless_v2**: AWSのサーバレスPostgreSQL互換データベース
- **Cognito**: AWSの認証・認可サービス（OAuth対応）
- **DMS**: AWS Database Migration Service（データベース移行サービス）
- **Supabase**: 現在の本番環境で使用中のBaaS（Database/認証）
- **Migration_Controller**: 移行プロセスを制御するスクリプト群
- **Blue_Green_Deployment**: ダウンタイムなしで新旧環境を切り替えるデプロイ手法
- **DNS_Cutover**: ドメインのDNSレコードを新環境に切り替える作業
- **Terraform**: HashiCorpのInfrastructure as Codeツール
- **Lambda**: AWSのサーバレスコンピューティングサービス
- **API_Gateway**: AWSのフルマネージドAPIサービス
- **Mangum**: FastAPIをLambdaで実行するためのASGIアダプター

## 要件

### 要件 1: URLリダイレクト（Vercel → AWS）

**ユーザーストーリー:** ユーザーとして、旧URL（vow-app.vercel.app）にアクセスしても新しいAWS環境に自動的にリダイレクトされたい。これにより、ブックマークや共有リンクが引き続き機能する。

#### 受け入れ基準

1. WHEN a user accesses vow-app.vercel.app, THE Vercel deployment SHALL redirect to the new AWS production URL with HTTP 301 status
2. THE redirect configuration SHALL preserve the original path and query parameters
3. THE redirect SHALL be active for a minimum transition period of 30 days
4. THE Vercel deployment SHALL display a notification banner informing users of the URL change during transition period
5. WHEN the transition period ends, THE Vercel deployment MAY be decommissioned
6. THE new AWS production URL SHALL be accessible via custom domain or Amplify default domain

### 要件 2: データベース移行（Supabase → Aurora via DMS）

**ユーザーストーリー:** 運用者として、AWS DMSを使用してSupabaseからAurora Serverless v2にデータを移行したい。これにより、最小限のダウンタイムでデータ移行が完了できる。

#### 受け入れ基準

1. THE DMS replication instance SHALL be created in the same VPC as Aurora
2. THE DMS source endpoint SHALL connect to Supabase PostgreSQL via SSL
3. THE DMS target endpoint SHALL connect to Aurora_Serverless_v2
4. THE DMS task SHALL perform full load migration of all tables
5. THE DMS task SHALL enable Change Data Capture (CDC) for ongoing replication
6. THE DMS task SHALL migrate all tables including: habits, habit_logs, goals, tasks, activities
7. WHEN DMS migration completes, THE Migration_Controller SHALL verify row counts match
8. THE DMS task SHALL handle foreign key constraints correctly during migration
9. IF DMS task fails, THE Migration_Controller SHALL provide detailed error logs
10. THE Aurora_Serverless_v2 SHALL use PostgreSQL 15 for Supabase compatibility
11. THE Aurora_Serverless_v2 credentials SHALL be stored in AWS Secrets Manager

### 要件 3: OAuth移行（Supabase Auth → Cognito）- ゼロダウンタイム

**ユーザーストーリー:** ユーザーとして、移行中も移行後も同じOAuthプロバイダー（Google, GitHub）でログインしたい。認証のダウンタイムがあってはならない。

#### 受け入れ基準

1. THE Cognito user pool SHALL support Google OAuth authentication using existing GCP OAuth app
2. THE Cognito user pool SHALL support GitHub OAuth authentication using existing GitHub OAuth app
3. THE GCP OAuth app callback URLs SHALL be updated to include both Supabase and Cognito URLs simultaneously
4. THE GitHub OAuth app callback URLs SHALL be updated to include both Supabase and Cognito URLs simultaneously
5. WHEN OAuth apps are updated, THE Supabase Auth SHALL continue functioning without interruption
6. THE Cognito SHALL migrate existing user accounts from Supabase Auth preserving user IDs
7. WHEN a user logs in after migration, THE Cognito SHALL recognize existing user identity via email matching
8. THE Cognito SHALL issue JWT tokens compatible with the Lambda backend
9. IF user migration fails, THE Migration_Controller SHALL log the error and continue with other users
10. THE parallel authentication period SHALL last until all users have successfully logged in via Cognito
11. THE Cognito hosted UI domain SHALL be configured as vow-auth-production

### 要件 4: フロントエンド移行（Vercel → Amplify）

**ユーザーストーリー:** 運用者として、本番フロントエンドをVercelからAWS Amplifyに移行したい。これにより、AWSへの統合が実現できる。

#### 受け入れ基準

1. THE Amplify_Hosting SHALL deploy the production Next.js application with SSR support
2. THE Amplify_Hosting SHALL connect to the main branch for production deployments
3. THE Amplify_Hosting SHALL provide custom domain configuration capability
4. WHEN the custom domain is configured, THE Amplify_Hosting SHALL provision SSL certificate automatically
5. THE Amplify_Hosting SHALL support environment variables for Cognito and API configuration
6. THE Amplify_Hosting SHALL maintain feature parity with current Vercel deployment
7. WHEN deployment fails, THE Amplify_Hosting SHALL automatically rollback to previous version
8. THE Amplify_Hosting SHALL use the same build configuration as development environment

### 要件 5: バックエンドAPI本番デプロイ（Lambda + API Gateway）

**ユーザーストーリー:** 運用者として、FastAPIバックエンドをLambda + API Gateway構成で本番環境にデプロイしたい。これにより、コスト最適化とサーバレス運用が実現できる。

#### 受け入れ基準

1. THE Lambda function SHALL deploy FastAPI backend using Mangum adapter
2. THE Lambda function SHALL have 512MB memory and 30 second timeout
3. THE API_Gateway SHALL expose REST API endpoints with CORS configuration
4. THE API_Gateway SHALL integrate with Cognito for JWT authentication
5. THE Lambda function SHALL connect to Aurora_Serverless_v2 via VPC
6. THE Lambda function SHALL provide health check endpoint at /health
7. WHEN the Lambda function starts, THE cold start time SHALL be less than 3 seconds
8. THE Lambda function SHALL use the same Terraform module as development environment

### 要件 6: Terraform本番環境構築

**ユーザーストーリー:** 運用者として、開発環境と同じTerraformモジュールを使用して本番環境を構築したい。これにより、環境間の一貫性が確保できる。

#### 受け入れ基準

1. THE Terraform configuration SHALL support environment variable for production (environment = "production")
2. THE Terraform modules SHALL be reused from existing infra/terraform/ directory
3. THE production environment SHALL use separate state file from development
4. THE production Aurora_Serverless_v2 SHALL have deletion_protection enabled
5. THE production Aurora_Serverless_v2 SHALL have skip_final_snapshot set to false
6. THE production VPC SHALL use the same CIDR structure as development
7. THE Terraform variables SHALL support production-specific OAuth callback URLs
8. THE Terraform SHALL create DMS resources for database migration

### 要件 7: ゼロダウンタイム移行戦略

**ユーザーストーリー:** ユーザーとして、移行中もサービスを継続して利用したい。これにより、ビジネス継続性が確保できる。

#### 受け入れ基準

1. THE Migration_Controller SHALL implement Blue_Green_Deployment strategy
2. THE Migration_Controller SHALL run both old and new environments in parallel during migration
3. THE DNS_Cutover SHALL be performed with minimal TTL (60 seconds or less)
4. WHEN DNS_Cutover is performed, THE service downtime SHALL be less than 1 minute
5. THE Migration_Controller SHALL provide traffic splitting capability for gradual rollout
6. THE Migration_Controller SHALL monitor error rates during migration
7. IF error rate exceeds 5%, THE Migration_Controller SHALL automatically rollback

### 要件 8: データ整合性検証

**ユーザーストーリー:** 運用者として、移行後のデータ整合性を確認したい。これにより、データ損失がないことを保証できる。

#### 受け入れ基準

1. THE Migration_Controller SHALL verify row counts match between Supabase and Aurora for all tables
2. THE Migration_Controller SHALL compare checksums for critical tables (habits, goals, tasks)
3. THE Migration_Controller SHALL verify foreign key relationships are intact
4. THE Migration_Controller SHALL log all verification results
5. WHEN verification fails, THE Migration_Controller SHALL halt migration and alert operations team
6. THE verification SHALL be automated and repeatable

### 要件 9: 監視・ログ・アラート

**ユーザーストーリー:** 運用者として、移行後の本番環境を監視したい。これにより、問題を早期に検知して対応できる。

#### 受け入れ基準

1. THE CloudWatch SHALL collect logs from Amplify, Lambda, API Gateway, and Aurora
2. THE CloudWatch SHALL create dashboards for key metrics (latency, error rate, cold starts)
3. THE CloudWatch Alarms SHALL notify on error rate threshold breach (>5%)
4. THE CloudWatch Alarms SHALL notify on latency threshold breach (p99 > 2s)
5. THE X-Ray SHALL be enabled for distributed tracing
6. THE CloudWatch Logs SHALL retain logs for 30 days
7. WHEN alarm triggers, THE SNS SHALL send notification to operations team

### 要件 10: ロールバック機能

**ユーザーストーリー:** 運用者として、問題発生時に旧環境にロールバックしたい。これにより、サービス継続性が確保できる。

#### 受け入れ基準

1. THE Migration_Controller SHALL maintain Vercel deployment as rollback target for 30 days
2. THE Migration_Controller SHALL maintain Supabase as rollback database for 30 days
3. THE rollback procedure SHALL be executable within 5 minutes
4. THE rollback procedure SHALL include DNS revert to Vercel
5. THE rollback procedure SHALL include OAuth callback URL revert
6. THE rollback procedure SHALL be documented and tested before migration
7. WHEN rollback is triggered, THE Migration_Controller SHALL notify operations team

### 要件 11: セキュリティ

**ユーザーストーリー:** 運用者として、移行後もセキュリティを維持したい。これにより、ユーザーデータを保護できる。

#### 受け入れ基準

1. THE Aurora_Serverless_v2 SHALL use encrypted storage (AES-256)
2. THE Aurora_Serverless_v2 SHALL be deployed in isolated subnet (no public access)
3. THE Secrets Manager SHALL store all sensitive credentials (database, OAuth secrets)
4. THE IAM roles SHALL follow least privilege principle
5. THE VPC security groups SHALL restrict access to necessary ports only
6. THE Lambda function SHALL run in private subnet with NAT Gateway for external access
7. THE SSL/TLS SHALL be enforced for all connections
8. THE DMS replication instance SHALL use SSL for source and target connections

### 要件 12: CI/CDパイプライン更新

**ユーザーストーリー:** 開発者として、移行後も自動デプロイを継続したい。これにより、開発効率を維持できる。

#### 受け入れ基準

1. THE GitHub Actions workflow SHALL deploy frontend to Amplify on main branch push
2. THE GitHub Actions workflow SHALL deploy Lambda function on main branch push
3. THE workflow SHALL use OIDC for AWS authentication
4. THE workflow SHALL run tests before deployment
5. IF tests fail, THE workflow SHALL NOT proceed with deployment
6. THE workflow SHALL support manual rollback trigger
7. THE workflow SHALL notify on deployment success or failure

### 要件 13: 移行ドキュメント

**ユーザーストーリー:** 運用者として、移行手順を参照したい。これにより、移行作業を確実に実行できる。

#### 受け入れ基準

1. THE documentation SHALL include pre-migration checklist
2. THE documentation SHALL include step-by-step migration procedure
3. THE documentation SHALL include rollback procedure
4. THE documentation SHALL include post-migration verification steps
5. THE documentation SHALL include troubleshooting guide for common issues
6. THE documentation SHALL be maintained in repository (docs/AWS_PRODUCTION_MIGRATION.md)

### 要件 14: 移行後の検証

**ユーザーストーリー:** 運用者として、移行後の動作を検証したい。これにより、移行の成功を確認できる。

#### 受け入れ基準

1. THE verification SHALL include user authentication flow test (Google OAuth)
2. THE verification SHALL include user authentication flow test (GitHub OAuth)
3. THE verification SHALL include CRUD operations test for all entities
4. THE verification SHALL include performance benchmark comparison with Vercel/Supabase
5. THE verification SHALL include data integrity verification
6. THE verification checklist SHALL be documented
7. WHEN all verifications pass, THE migration SHALL be considered complete

### 要件 15: コスト最適化

**ユーザーストーリー:** 運用者として、AWS移行後のコストを最適化したい。これにより、運用コストを適切に管理できる。

#### 受け入れ基準

1. THE Aurora_Serverless_v2 SHALL use 0.5 ACU minimum for cost optimization (~$44/month)
2. THE Lambda SHALL use 512MB memory for cost-performance balance
3. THE Amplify_Hosting SHALL leverage free tier where possible
4. THE NAT Gateway SHALL be single instance for cost optimization
5. THE cost estimate SHALL be documented before migration
6. THE monthly cost SHALL be monitored via AWS Cost Explorer
7. THE cost alerts SHALL be configured for budget threshold ($100/month)
