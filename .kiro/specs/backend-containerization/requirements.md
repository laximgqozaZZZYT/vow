# 要件定義書

## はじめに

本ドキュメントは、習慣管理ダッシュボードアプリケーションのバックエンドAPIをコンテナ化し、将来的なSupabase脱却の準備を行うための要件を定義します。また、Slack/OpenAI連携の基盤を構築します。

主な目的：
- FastAPIバックエンドのDockerコンテナ化
- AWS App Runnerへのデプロイ
- Amazon RDS (PostgreSQL) によるデータベース移行準備
- Supabaseとの並行運用期間の確保
- 外部連携（Slack/OpenAI）の基盤構築
- AWS CDK（Python）によるインフラのコード化

## 用語集

- **FastAPI_Backend**: Python 3.12で構築されたFastAPIベースのバックエンドAPIサービス
- **App_Runner**: AWSのフルマネージドコンテナサービス（サーバーレス）
- **ECR**: Elastic Container Registry（Dockerイメージの保存先）
- **RDS_PostgreSQL**: Amazon RDS上のPostgreSQLデータベースインスタンス
- **Supabase**: 現在使用中のBaaS（Database/認証）
- **JWT_Middleware**: JSON Web Tokenによる認証ミドルウェア
- **CDK**: AWS Cloud Development Kit（Python）
- **SQLAlchemy**: PythonのORMライブラリ
- **Pydantic**: Pythonのデータバリデーションライブラリ
- **Migration_Script**: SupabaseからRDSへのデータ移行スクリプト

## 要件

### 要件 1: FastAPIバックエンドの構築

**ユーザーストーリー:** 開発者として、FastAPIでバックエンドAPIを構築したい。これにより、型安全で高性能なAPIを提供できる。

#### 受け入れ基準

1. THE FastAPI_Backend SHALL be built using Python 3.12 and FastAPI framework
2. THE FastAPI_Backend SHALL use SQLAlchemy as ORM for database operations
3. THE FastAPI_Backend SHALL use Pydantic for request/response validation
4. THE FastAPI_Backend SHALL provide a health check endpoint at `/health`
5. WHEN the health check endpoint is called, THE FastAPI_Backend SHALL return status 200 with JSON response containing service status
6. THE FastAPI_Backend SHALL follow layered architecture pattern (router, service, repository layers)

### 要件 2: 認証ミドルウェア

**ユーザーストーリー:** 開発者として、JWTベースの認証ミドルウェアを実装したい。これにより、APIエンドポイントを保護できる。

#### 受け入れ基準

1. THE JWT_Middleware SHALL validate JWT tokens from Authorization header
2. WHEN a valid JWT token is provided, THE JWT_Middleware SHALL extract user information and attach to request context
3. WHEN an invalid or expired JWT token is provided, THE JWT_Middleware SHALL return 401 Unauthorized response
4. WHEN no JWT token is provided for protected endpoints, THE JWT_Middleware SHALL return 401 Unauthorized response
5. THE JWT_Middleware SHALL support Supabase JWT format during migration period
6. THE JWT_Middleware SHALL be configurable to support custom JWT issuers

### 要件 3: Dockerコンテナ化

**ユーザーストーリー:** 開発者として、FastAPIバックエンドをDockerコンテナ化したい。これにより、環境の一貫性と移植性が確保できる。

#### 受け入れ基準

1. THE Dockerfile SHALL be created for FastAPI_Backend application
2. THE Container SHALL use Python 3.12-slim as base image
3. THE Container SHALL use multi-stage build for optimized image size
4. THE Container SHALL expose port 8000 for the API
5. THE Container SHALL run as non-root user for security
6. THE docker-compose.yml SHALL be created for local development with hot reload
7. WHEN building the container, THE image size SHALL be under 500MB

### 要件 4: AWS App Runnerへのデプロイ

**ユーザーストーリー:** 開発者として、FastAPIバックエンドをAWS App Runnerにデプロイしたい。これにより、フルマネージドでスケーラブルなAPIホスティングが実現できる。

#### 受け入れ基準

1. THE App_Runner service SHALL deploy from ECR image
2. THE App_Runner service SHALL have 1 vCPU and 2GB memory for development
3. THE App_Runner service SHALL auto-scale based on traffic (min 1, max 4 instances)
4. THE App_Runner service SHALL provide HTTPS endpoint automatically
5. THE App_Runner service SHALL support environment variables from SSM Parameter Store
6. THE App_Runner service SHALL have VPC connector for RDS access
7. WHEN the container starts, THE App_Runner service SHALL pass health check within 60 seconds

### 要件 5: ECRリポジトリのセットアップ

**ユーザーストーリー:** 開発者として、DockerイメージをAWS ECRに保存したい。

#### 受け入れ基準

1. THE ECR repository SHALL be created for the FastAPI_Backend application
2. THE ECR repository SHALL use private visibility
3. THE image lifecycle policy SHALL retain only the last 10 images
4. THE ECR repository SHALL be in ap-northeast-1 (Tokyo) region
5. THE ECR repository SHALL enable image scanning on push

### 要件 6: Amazon RDS PostgreSQLの構築

**ユーザーストーリー:** 開発者として、Amazon RDS PostgreSQLを構築したい。これにより、将来的なSupabase脱却の準備ができる。

#### 受け入れ基準

1. THE RDS_PostgreSQL instance SHALL use PostgreSQL 15 or later
2. THE RDS_PostgreSQL instance SHALL use db.t3.micro for development (Free Tier eligible)
3. THE RDS_PostgreSQL instance SHALL be deployed in private subnet
4. THE RDS_PostgreSQL instance SHALL have automated backups enabled (7 days retention)
5. THE RDS_PostgreSQL instance SHALL use encrypted storage
6. THE RDS_PostgreSQL credentials SHALL be stored in AWS Secrets Manager
7. THE RDS_PostgreSQL instance SHALL be accessible only from App_Runner VPC connector

### 要件 7: データベース移行準備

**ユーザーストーリー:** 開発者として、SupabaseからRDSへのデータ移行を準備したい。これにより、段階的な移行が可能になる。

#### 受け入れ基準

1. THE Migration_Script SHALL export data from Supabase PostgreSQL
2. THE Migration_Script SHALL import data to RDS_PostgreSQL
3. THE Migration_Script SHALL preserve data integrity during migration
4. THE FastAPI_Backend SHALL support dual database configuration (Supabase and RDS)
5. WHEN in migration mode, THE FastAPI_Backend SHALL read from Supabase and write to both databases
6. THE Migration_Script SHALL provide rollback capability

### 要件 8: フロントエンド連携

**ユーザーストーリー:** 開発者として、Next.jsフロントエンドからFastAPIバックエンドを呼び出したい。

#### 受け入れ基準

1. THE Next.js frontend SHALL call FastAPI_Backend via environment variable configured URL
2. THE FastAPI_Backend SHALL support CORS for frontend domain
3. WHEN NEXT_PUBLIC_API_URL is set, THE frontend SHALL use FastAPI_Backend instead of Supabase direct calls
4. THE frontend SHALL gracefully fallback to Supabase if FastAPI_Backend is unavailable
5. THE API response format SHALL be compatible with existing frontend data structures

### 要件 9: Slack連携基盤

**ユーザーストーリー:** 開発者として、Slack Webhook連携の基盤を構築したい。これにより、将来的な通知機能が実装できる。

#### 受け入れ基準

1. THE FastAPI_Backend SHALL provide Slack notification service interface
2. THE Slack webhook URL SHALL be stored in SSM Parameter Store
3. THE Slack notification service SHALL support message formatting
4. WHEN sending notification fails, THE service SHALL log error and not block main operation
5. THE Slack integration SHALL be optional and configurable via environment variable

### 要件 10: OpenAI連携基盤

**ユーザーストーリー:** 開発者として、OpenAI API連携の基盤を構築したい。これにより、将来的なAI機能が実装できる。

#### 受け入れ基準

1. THE FastAPI_Backend SHALL provide OpenAI service interface
2. THE OpenAI API key SHALL be stored in AWS Secrets Manager
3. THE OpenAI service SHALL support configurable model selection
4. WHEN OpenAI API call fails, THE service SHALL return graceful error response
5. THE OpenAI integration SHALL be optional and configurable via environment variable
6. THE OpenAI service SHALL implement rate limiting to control costs

### 要件 11: インフラのコード化（IaC）

**ユーザーストーリー:** 開発者として、インフラをコードで管理したい。

#### 受け入れ基準

1. THE infrastructure SHALL be defined using AWS CDK (Python)
2. THE CDK stack SHALL include ECR, App Runner, RDS, VPC, and security groups
3. THE CDK code SHALL use snake_case for functions and PascalCase for classes
4. THE CDK code SHALL use L2 constructs as default
5. THE CDK code SHALL be version controlled in repository (infra/ directory)
6. THE infrastructure SHALL be deployable with `cdk deploy`
7. THE CDK SHALL follow AWS Well-Architected best practices

### 要件 12: CI/CDパイプライン

**ユーザーストーリー:** 開発者として、コードをプッシュしたら自動でビルド・デプロイされるようにしたい。

#### 受け入れ基準

1. THE GitHub Actions workflow SHALL build Docker image on push to main/develop branch
2. THE workflow SHALL push Docker image to ECR
3. THE workflow SHALL trigger App Runner deployment
4. THE workflow SHALL use OIDC for AWS authentication (no long-lived credentials)
5. THE workflow SHALL run tests before building image
6. IF tests fail, THE workflow SHALL NOT proceed with deployment

### 要件 13: 環境変数と機密情報

**ユーザーストーリー:** 開発者として、環境変数を安全に管理したい。

#### 受け入れ基準

1. THE deployment SHALL use environment variables for configuration
2. THE database credentials SHALL be stored in AWS Secrets Manager
3. THE API keys (OpenAI, Slack) SHALL be stored in SSM Parameter Store or Secrets Manager
4. THE sensitive values SHALL NOT be committed to repository
5. THE .env.example file SHALL document required environment variables
6. THE FastAPI_Backend SHALL validate required environment variables on startup

### 要件 14: ローカル開発環境

**ユーザーストーリー:** 開発者として、ローカルでもコンテナを使って開発したい。

#### 受け入れ基準

1. THE docker-compose.yml SHALL support local development with hot reload
2. THE local environment SHALL include PostgreSQL container for testing
3. THE local environment SHALL mirror the AWS environment configuration
4. THE developer SHALL be able to run `docker-compose up` to start development
5. THE local PostgreSQL SHALL be pre-seeded with test data

### 要件 15: ドキュメント

**ユーザーストーリー:** 開発者として、セットアップ手順を参照したい。

#### 受け入れ基準

1. THE documentation SHALL include FastAPI backend setup steps
2. THE documentation SHALL include Docker development workflow
3. THE documentation SHALL include AWS CDK deployment steps
4. THE documentation SHALL include database migration guide
5. THE documentation SHALL include API endpoint reference
6. THE documentation SHALL be maintained in repository (docs/BACKEND_SETUP.md)
