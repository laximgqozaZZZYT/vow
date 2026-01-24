# Vow AWS Terraform Infrastructure

開発環境・本番環境のAWSサーバレスインフラをTerraformで構築します。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Cloud                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Cognito   │    │ API Gateway │    │  Amplify Hosting    │ │
│  │   (OAuth)   │    │  (REST API) │    │    (Next.js)        │ │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘ │
│                            │                                     │
│                     ┌──────▼──────┐                             │
│                     │   Lambda    │                             │
│                     │   (Hono)    │                             │
│                     └──────┬──────┘                             │
│                            │                                     │
│                     ┌──────▼──────┐                             │
│                     │  Supabase   │                             │
│                     │ (PostgreSQL)│                             │
│                     └─────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## 環境構成

| 環境 | ブランチ | Lambda関数名 | Amplify URL |
|------|---------|-------------|-------------|
| Development | develop | vow-development-api | develop.do1k9oyyorn24.amplifyapp.com |
| Production | main | vow-production-api | main.do1k9oyyorn24.amplifyapp.com |

## 前提条件

1. Terraform >= 1.5.0
2. AWS CLI がインストール・設定済み
3. 適切なIAM権限

## クイックスタート

### 1. 初期化

```bash
cd infra/terraform
terraform init
```

### 2. 環境切り替え

```bash
# 開発環境に切り替え
./scripts/switch-env.sh development

# 本番環境に切り替え
./scripts/switch-env.sh production
```

### 3. プラン確認

```bash
# 開発環境
terraform plan -var-file="terraform.development.tfvars"

# 本番環境
terraform plan -var-file="terraform.production.tfvars"
```

### 4. デプロイ

```bash
# 開発環境
terraform apply -var-file="terraform.development.tfvars"

# 本番環境（確認プロンプトあり）
terraform apply -var-file="terraform.production.tfvars"
```

## S3バックエンド設定（推奨）

チーム開発やCI/CDでの利用には、S3バックエンドを設定してください。

### 1. バックエンドリソースの作成

```bash
# 初回のみ：S3バケットとDynamoDBテーブルを作成
terraform apply -target=aws_s3_bucket.terraform_state -target=aws_dynamodb_table.terraform_locks
```

### 2. バックエンド設定の有効化

`versions.tf` のS3バックエンドブロックのコメントを解除：

```hcl
backend "s3" {
  bucket         = "vow-terraform-state-257784614320"
  key            = "terraform.tfstate"
  region         = "ap-northeast-1"
  encrypt        = true
  dynamodb_table = "vow-terraform-locks"
}
```

### 3. ステートの移行

```bash
terraform init -migrate-state
```

### 4. Workspaceの作成

```bash
# 開発環境用Workspace
terraform workspace new development

# 本番環境用Workspace
terraform workspace new production
```

## 環境変数（シークレット）

機密情報は `TF_VAR_` 環境変数で設定してください：

```bash
# Supabase
export TF_VAR_supabase_url="https://xxx.supabase.co"
export TF_VAR_supabase_anon_key="eyJ..."

# Slack
export TF_VAR_slack_client_id="xxx"
export TF_VAR_slack_client_secret="xxx"
export TF_VAR_slack_signing_secret="xxx"
export TF_VAR_token_encryption_key="xxx"

# GitHub (Amplify用)
export TF_VAR_github_access_token="ghp_xxx"
```

## デプロイフロー

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   develop   │────▶│    main     │────▶│ Production  │
│   branch    │ PR  │   branch    │     │ Environment │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       
       ▼                                       
┌─────────────┐                               
│ Development │                               
│ Environment │                               
└─────────────┘                               
```

1. `develop` ブランチにプッシュ → 開発環境へ自動デプロイ
2. 開発環境で検証
3. `develop` → `main` へPR作成・マージ
4. `main` ブランチへマージ → 本番環境へ自動デプロイ

## 検証スクリプト

### 環境設定の検証

```bash
# 開発環境の設定を検証
../scripts/validate-env.sh development

# 本番環境の設定を検証
../scripts/validate-env.sh production
```

### ヘルスチェック

```bash
# 開発環境のヘルスチェック
../scripts/health-check.sh development

# 本番環境のヘルスチェック
../scripts/health-check.sh production

# 両環境のヘルスチェック
../scripts/health-check.sh all
```

## 出力値

デプロイ後、以下の値が出力されます：

| 出力 | 説明 |
|------|------|
| `api_gateway_url` | API Gateway URL |
| `lambda_function_name` | Lambda関数名 |
| `amplify_app_url` | Amplify アプリURL |
| `cognito_user_pool_id` | Cognito User Pool ID |
| `cognito_client_id` | App Client ID |

## ロールバック

### Lambda ロールバック

GitHub Actions の `workflow_dispatch` を使用：

1. Actions タブを開く
2. "Deploy Lambda to AWS (Production)" を選択
3. "Run workflow" をクリック
4. `rollback: true` を選択
5. 必要に応じてバージョンを指定

### Amplify ロールバック

1. AWS Amplify コンソールを開く
2. 対象のアプリを選択
3. "Hosting" → "Deployments" を選択
4. 前回のデプロイを選択して "Redeploy" をクリック

## トラブルシューティング

### Lambda タイムアウト

1. VPC 設定を確認（NAT Gateway 経由でインターネットアクセス可能か）
2. セキュリティグループのアウトバウンドルールを確認
3. Supabase への接続を確認

### Amplify ビルド失敗

1. Amplify コンソールでビルドログを確認
2. 環境変数が正しく設定されているか確認
3. `package.json` の依存関係を確認

### Terraform ステートロック

```bash
# ロックを強制解除（注意して使用）
terraform force-unlock <LOCK_ID>
```

## GitHub Secrets 設定

GitHub Actions で使用するシークレット：

| シークレット名 | 説明 |
|--------------|------|
| `AWS_LAMBDA_DEPLOY_ROLE_ARN` | Lambda デプロイ用IAMロールARN |
| `SNS_ALERTS_TOPIC_ARN` | 通知用SNSトピックARN（オプション） |
