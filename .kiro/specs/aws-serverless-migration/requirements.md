# 要件定義書

## はじめに

本ドキュメントは、習慣管理ダッシュボードアプリケーションの本番環境をVercel + SupabaseからAWSサーバレス構成に移行するための要件を定義します。

現在の構成：
- 本番フロントエンド: Vercel（Next.js）
- 本番データベース・認証: Supabase（PostgreSQL + Auth）
- 開発フロントエンド: AWS Amplify Hosting（Next.js）

移行後の構成（コスト優先サーバレス）：
- 本番フロントエンド: AWS Amplify Hosting（Next.js SSR）
- 本番データベース: Amazon Aurora Serverless v2（PostgreSQL互換）
- 本番認証: Amazon Cognito（OAuth対応）
- 本番バックエンドAPI: AWS Lambda + API Gateway（FastAPI with Mangum）

主な目的：
- コスト最適化（月額~$48目標）
- ゼロダウンタイム移行の実現
- データ整合性の確保
- OAuth認証（Google, GitHub）の継続
- 将来のSlack/OpenAI連携を考慮した設計

## 用語集

- **Amplify_Hosting**: AWSのフルマネージドWebホスティングサービス（Next.js SSR対応）
- **Lambda**: AWSのサーバレスコンピューティングサービス
- **API_Gateway**: AWSのフルマネージドAPIサービス
- **Aurora_Serverless_v2**: AWSのサーバレスPostgreSQL互換データベース
- **Cognito**: AWSの認証・認可サービス（OAuth対応）
- **Mangum**: FastAPIをLambdaで実行するためのASGIアダプター
- **Supabase**: 現在の本番環境で使用中のBaaS（Database/認証）
- **Migration_Controller**: 移行プロセスを制御するスクリプト群
- **Blue_Green_Deployment**: ダウンタイムなしで新旧環境を切り替えるデプロイ手法
- **DNS_Cutover**: ドメインのDNSレコードを新環境に切り替える作業
- **Data_Sync**: SupabaseからAuroraへのデータ同期処理
- **CDK**: AWS Cloud Development Kit（Python）
- **ACU**: Aurora Capacity Unit（Aurora Serverlessの課金単位）

## 要件

### 要件 1: フロントエンド移行（Vercel → Amplify）

**ユーザーストーリー:** 運用者として、本番フロントエンドをVercelからAWS Amplifyに移行したい。これにより、AWSへの統合とコスト最適化が実現できる。

#### 受け入れ基準

1. THE Amplify_Hosting SHALL deploy the production Next.js application with SSR support
2. THE Amplify_Hosting SHALL connect to the main branch for production deployments
3. THE Amplify_Hosting SHALL provide custom domain configuration capability
4. WHEN the custom domain is configured, THE Amplify_Hosting SHALL provision SSL certificate automatically
5. THE Amplify_Hosting SHALL support environment variables from SSM Parameter Store
6. THE Amplify_Hosting SHALL maintain feature parity with current Vercel deployment
7. WHEN deployment fails, THE Amplify_Hosting SHALL automatically rollback to previous version
8. THE Amplify_Hosting monthly cost SHALL be within free tier (~$0/month)

### 要件 2: データベース移行（Supabase → Aurora Serverless v2）

**ユーザーストーリー:** 運用者として、本番データベースをSupabaseからAurora Serverless v2に移行したい。これにより、コスト最適化とAWSへの統合が実現できる。

#### 受け入れ基準

1. THE Data_Sync SHALL export all data from Supabase PostgreSQL
2. THE Data_Sync SHALL import data to Aurora_Serverless_v2 preserving all relationships and constraints
3. THE Data_Sync SHALL verify data integrity after migration using checksums
4. THE Aurora_Serverless_v2 SHALL use PostgreSQL 15 or later for compatibility
5. THE Aurora_Serverless_v2 SHALL be configured with minimum 0.5 ACU for cost optimization
6. THE Aurora_Serverless_v2 SHALL scale automatically based on workload
7. THE Aurora_Serverless_v2 credentials SHALL be stored in AWS Secrets Manager
8. WHEN data migration fails, THE Migration_Controller SHALL provide rollback capability
9. THE Aurora_Serverless_v2 monthly cost SHALL be approximately $44/month at minimum ACU

### 要件 3: 認証移行（Supabase Auth → Cognito）

**ユーザーストーリー:** ユーザーとして、移行後も同じOAuthプロバイダー（Google, GitHub）でログインしたい。これにより、シームレスな移行体験が実現できる。

#### 受け入れ基準

1. THE Cognito user pool SHALL support Google OAuth authentication
2. THE Cognito user pool SHALL support GitHub OAuth authentication
3. THE Cognito SHALL migrate existing user accounts from Supabase Auth
4. WHEN a user logs in after migration, THE Cognito SHALL recognize existing user identity
5. THE Cognito SHALL issue JWT tokens compatible with the Lambda backend
6. THE Cognito SHALL support user attribute mapping from Supabase Auth
7. IF user migration fails, THE Migration_Controller SHALL log the error and continue with other users
8. THE Cognito hosted UI SHALL be customizable to match application branding

### 要件 4: バックエンドAPI本番デプロイ（Lambda + API Gateway）

**ユーザーストーリー:** 運用者として、FastAPIバックエンドをLambda + API Gateway構成で本番環境にデプロイしたい。これにより、コスト最適化とサーバレス運用が実現できる。

#### 受け入れ基準

1. THE Lambda function SHALL deploy FastAPI backend using Mangum adapter
2. THE Lambda function SHALL have 512MB memory and 30 second timeout
3. THE API_Gateway SHALL expose REST API endpoints with CORS configuration
4. THE API_Gateway SHALL integrate with Cognito for JWT authentication
5. THE Lambda function SHALL connect to Aurora_Serverless_v2 via VPC
6. THE Lambda function SHALL provide health check endpoint
7. WHEN the Lambda function starts, THE cold start time SHALL be less than 3 seconds
8. THE Lambda monthly cost SHALL be approximately $0.20/month for 1 million requests
9. THE API_Gateway monthly cost SHALL be approximately $3.50/month

### 要件 5: ゼロダウンタイム移行

**ユーザーストーリー:** ユーザーとして、移行中もサービスを継続して利用したい。これにより、ビジネス継続性が確保できる。

#### 受け入れ基準

1. THE Migration_Controller SHALL implement Blue_Green_Deployment strategy
2. THE Migration_Controller SHALL run both old and new environments in parallel during migration
3. THE DNS_Cutover SHALL be performed with minimal TTL (60 seconds or less)
4. WHEN DNS_Cutover is performed, THE service downtime SHALL be less than 1 minute
5. THE Migration_Controller SHALL provide traffic splitting capability for gradual rollout
6. THE Migration_Controller SHALL monitor error rates during migration
7. IF error rate exceeds threshold, THE Migration_Controller SHALL automatically rollback

### 要件 6: データ同期と整合性

**ユーザーストーリー:** 運用者として、移行中のデータ整合性を確保したい。これにより、データ損失なく移行が完了できる。

#### 受け入れ基準

1. THE Data_Sync SHALL support incremental synchronization during migration period
2. THE Data_Sync SHALL track last sync timestamp for each table
3. THE Data_Sync SHALL handle conflicts with "last write wins" strategy
4. THE Data_Sync SHALL log all sync operations for audit
5. WHEN sync conflict occurs, THE Data_Sync SHALL record conflict details
6. THE Data_Sync SHALL verify row counts match between source and target
7. THE Data_Sync SHALL compare checksums for critical tables

### 要件 7: DNS・ドメイン設定

**ユーザーストーリー:** 運用者として、カスタムドメインを新環境に設定したい。これにより、ユーザーは同じURLでサービスにアクセスできる。

#### 受け入れ基準

1. THE Amplify_Hosting SHALL support custom domain configuration
2. THE custom domain SSL certificate SHALL be provisioned via AWS Certificate Manager
3. THE DNS records SHALL be configurable via Route 53 or external DNS provider
4. THE DNS_Cutover SHALL support gradual traffic migration using weighted routing
5. WHEN using Route 53, THE health checks SHALL be configured for automatic failover
6. THE old Vercel deployment SHALL remain accessible via alternative URL during migration

### 要件 8: 監視・ログ・アラート

**ユーザーストーリー:** 運用者として、移行後の本番環境を監視したい。これにより、問題を早期に検知して対応できる。

#### 受け入れ基準

1. THE CloudWatch SHALL collect logs from Amplify, Lambda, API Gateway, and Aurora
2. THE CloudWatch SHALL create dashboards for key metrics (latency, error rate, cold starts)
3. THE CloudWatch Alarms SHALL notify on error rate threshold breach
4. THE CloudWatch Alarms SHALL notify on latency threshold breach
5. THE X-Ray SHALL be enabled for distributed tracing
6. THE CloudWatch Logs SHALL retain logs for 30 days
7. WHEN alarm triggers, THE SNS SHALL send notification to operations team

### 要件 9: ロールバック機能

**ユーザーストーリー:** 運用者として、問題発生時に旧環境にロールバックしたい。これにより、サービス継続性が確保できる。

#### 受け入れ基準

1. THE Migration_Controller SHALL maintain Vercel deployment as rollback target
2. THE Migration_Controller SHALL maintain Supabase as rollback database
3. THE rollback procedure SHALL be executable within 5 minutes
4. THE rollback procedure SHALL include DNS revert
5. THE rollback procedure SHALL include data sync from Aurora to Supabase (if needed)
6. THE rollback procedure SHALL be documented and tested
7. WHEN rollback is triggered, THE Migration_Controller SHALL notify operations team

### 要件 10: コスト最適化

**ユーザーストーリー:** 運用者として、AWS移行後のコストを月額~$48に抑えたい。これにより、運用コストを大幅に削減できる。

#### 受け入れ基準

1. THE total monthly cost SHALL be approximately $48/month
2. THE Lambda cost SHALL be approximately $0.20/month (1 million requests)
3. THE API_Gateway cost SHALL be approximately $3.50/month
4. THE Aurora_Serverless_v2 cost SHALL be approximately $44/month (0.5 ACU minimum)
5. THE Amplify_Hosting cost SHALL be within free tier (~$0/month)
6. THE cost estimate SHALL be documented before migration
7. THE monthly cost SHALL be monitored via AWS Cost Explorer
8. THE cost alerts SHALL be configured for budget threshold

### 要件 11: セキュリティ

**ユーザーストーリー:** 運用者として、移行後もセキュリティを維持したい。これにより、ユーザーデータを保護できる。

#### 受け入れ基準

1. THE Aurora_Serverless_v2 SHALL use encrypted storage (AES-256)
2. THE Aurora_Serverless_v2 SHALL be deployed in private subnet (no public access)
3. THE Secrets Manager SHALL store all sensitive credentials
4. THE IAM roles SHALL follow least privilege principle
5. THE VPC security groups SHALL restrict access to necessary ports only
6. THE Lambda function SHALL run in VPC for database access
7. THE SSL/TLS SHALL be enforced for all connections

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
5. THE documentation SHALL include troubleshooting guide
6. THE documentation SHALL be maintained in repository (docs/SERVERLESS_MIGRATION.md)

### 要件 14: 移行後の検証

**ユーザーストーリー:** 運用者として、移行後の動作を検証したい。これにより、移行の成功を確認できる。

#### 受け入れ基準

1. THE verification SHALL include user authentication flow test
2. THE verification SHALL include CRUD operations test for all entities
3. THE verification SHALL include OAuth login test (Google, GitHub)
4. THE verification SHALL include performance benchmark comparison
5. THE verification SHALL include data integrity verification
6. THE verification checklist SHALL be documented
7. WHEN all verifications pass, THE migration SHALL be considered complete

### 要件 15: 将来拡張性

**ユーザーストーリー:** 運用者として、将来のSlack/OpenAI連携を考慮した設計にしたい。これにより、機能拡張が容易になる。

#### 受け入れ基準

1. THE Lambda architecture SHALL support adding new API endpoints easily
2. THE API_Gateway SHALL support adding new routes without major changes
3. THE VPC configuration SHALL allow outbound internet access for external API calls
4. THE IAM roles SHALL be extensible for new service integrations
5. THE architecture SHALL support adding SQS/SNS for async processing
