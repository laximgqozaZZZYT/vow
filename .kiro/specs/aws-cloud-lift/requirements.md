# 要件定義書

## はじめに

本ドキュメントは、習慣管理ダッシュボードアプリケーションの開発環境をAWSクラウドにサーバーレスアーキテクチャで構築するための要件を定義します。本番環境（Vercel + Supabase）は現状維持とし、開発環境のみをAWSに構築します。

主な目的：
- Next.jsアプリケーションのAWSサーバーレスデプロイ
- コンテナ化による環境の一貫性確保
- ローカルからのリモート開発アクセス
- AWS無料枠・低コスト運用
- AWS CDK（Python）によるインフラのコード化

## 用語集

- **Amplify_Hosting**: AWSのフルマネージドWebホスティングサービス（Next.js SSR対応）
- **App_Runner**: AWSのフルマネージドコンテナサービス（サーバーレス）
- **ECR**: Elastic Container Registry（Dockerイメージの保存先）
- **Container**: Dockerコンテナ化されたNext.jsアプリケーション
- **Dev_Environment**: AWS上の開発環境全体
- **CDK**: AWS Cloud Development Kit（Python）

## 要件

### 要件 1: デプロイ方式の選択

**ユーザーストーリー:** 開発者として、コストと管理負担を考慮して最適なデプロイ方式を選択したい。

#### 受け入れ基準

1. THE deployment SHALL support two options: Amplify Hosting (recommended) or App Runner
2. THE Amplify Hosting option SHALL be the default for cost optimization (Free Tier available)
3. THE App Runner option SHALL be available for container-based deployment needs
4. THE documentation SHALL explain trade-offs between both options
5. WHEN using Amplify Hosting, THE Next.js SSR SHALL be fully supported

### 要件 2: アプリケーションのコンテナ化

**ユーザーストーリー:** 開発者として、Next.jsアプリケーションをDockerコンテナ化したい。これにより、環境の一貫性と移植性が確保できる。

#### 受け入れ基準

1. THE Dockerfile SHALL be created for Next.js application
2. THE Container SHALL use Node.js 20 LTS as base image
3. THE Container SHALL support both development and production modes
4. THE Container SHALL expose port 3000 for the application
5. THE docker-compose.yml SHALL be created for local development
6. THE Container image size SHALL be optimized (multi-stage build)

### 要件 3: AWS Amplify Hosting（推奨オプション）

**ユーザーストーリー:** 開発者として、AWS Amplify Hostingで開発環境をホストしたい。これにより、最小限の設定でNext.jsアプリをデプロイできる。

#### 受け入れ基準

1. THE Amplify app SHALL be created via CDK
2. THE Amplify app SHALL connect to GitHub repository
3. THE Amplify app SHALL support Next.js SSR (Server-Side Rendering)
4. THE Amplify app SHALL auto-deploy on branch push
5. THE Amplify app SHALL provide HTTPS endpoint automatically
6. THE Amplify app SHALL support environment variables
7. THE monthly cost SHALL stay within Free Tier limits for development usage

### 要件 4: AWS App Runner（コンテナオプション）

**ユーザーストーリー:** 開発者として、コンテナベースのデプロイが必要な場合はApp Runnerを使用したい。

#### 受け入れ基準

1. THE App_Runner service SHALL deploy from ECR image
2. THE App_Runner service SHALL auto-scale based on traffic (min 0, max 1 for dev)
3. THE App_Runner service SHALL have 1 vCPU and 2GB memory
4. THE App_Runner service SHALL support environment variables
5. THE App_Runner service SHALL provide HTTPS endpoint automatically
6. THE App_Runner service SHALL pause when idle to reduce costs

### 要件 5: ECRリポジトリのセットアップ（App Runnerオプション用）

**ユーザーストーリー:** 開発者として、DockerイメージをAWS ECRに保存したい。

#### 受け入れ基準

1. THE ECR repository SHALL be created for the application
2. THE ECR repository SHALL use private visibility
3. THE image lifecycle policy SHALL delete old images to save storage
4. THE ECR repository SHALL be in ap-northeast-1 (Tokyo) region

### 要件 6: 環境変数と機密情報

**ユーザーストーリー:** 開発者として、環境変数を安全に管理したい。

#### 受け入れ基準

1. THE deployment SHALL use environment variables for configuration
2. THE Supabase credentials SHALL be configured as environment variables
3. THE sensitive values SHALL be stored in AWS Secrets Manager or SSM Parameter Store
4. THE sensitive values SHALL NOT be committed to repository
5. THE .env.example file SHALL document required environment variables

### 要件 7: CI/CDパイプライン

**ユーザーストーリー:** 開発者として、コードをプッシュしたら自動でデプロイされるようにしたい。

#### 受け入れ基準

1. FOR Amplify Hosting, THE auto-deploy SHALL be configured via Amplify Console
2. FOR App Runner, THE GitHub Actions workflow SHALL build and push Docker image
3. THE deployment SHALL only occur on specific branches (e.g., develop)
4. THE workflow SHALL use OIDC for AWS authentication (no long-lived credentials)

### 要件 8: ローカル開発環境

**ユーザーストーリー:** 開発者として、ローカルでもコンテナを使って開発したい。

#### 受け入れ基準

1. THE docker-compose.yml SHALL support local development with hot reload
2. THE local environment SHALL mirror the AWS environment
3. THE local environment SHALL connect to development Supabase
4. THE developer SHALL be able to run `docker-compose up` to start development

### 要件 9: コスト最適化

**ユーザーストーリー:** 開発者として、AWS利用料を最小化したい。

#### 受け入れ基準

1. THE Amplify Hosting SHALL leverage Free Tier (1000 build minutes/month, 15GB served/month)
2. FOR App Runner, THE service SHALL use "pause when idle" feature
3. THE ECR storage SHALL be minimized with lifecycle policies
4. THE monthly cost estimate SHALL be documented
5. THE estimated monthly cost SHALL be under $5 for development usage with Amplify

### 要件 10: インフラのコード化（IaC）

**ユーザーストーリー:** 開発者として、インフラをコードで管理したい。

#### 受け入れ基準

1. THE infrastructure SHALL be defined using AWS CDK (Python)
2. THE CDK stack SHALL follow single-stack design pattern
3. THE CDK code SHALL use snake_case for functions and PascalCase for classes
4. THE CDK code SHALL use L2 constructs as default
5. THE CDK code SHALL be version controlled in repository (infra/ directory)
6. THE infrastructure SHALL be deployable with `cdk deploy`
7. THE CDK SHALL follow AWS Well-Architected best practices

### 要件 11: ドキュメント

**ユーザーストーリー:** 開発者として、セットアップ手順を参照したい。

#### 受け入れ基準

1. THE documentation SHALL include Docker setup steps
2. THE documentation SHALL include AWS CDK deployment steps
3. THE documentation SHALL include local development workflow
4. THE documentation SHALL include troubleshooting guide
5. THE documentation SHALL compare Amplify vs App Runner options
6. THE documentation SHALL be maintained in repository (docs/CLOUD_DEV_SETUP.md)

### 要件 12: 将来のクラウドIDE対応（オプション）

**ユーザーストーリー:** 開発者として、将来的にブラウザからアクセスできるIDEを使用したい。

#### 受け入れ基準

1. THE architecture SHALL support future addition of Cloud9 or code-server
2. THE Container SHALL be extensible for IDE integration
3. THE documentation SHALL note future enhancement options
