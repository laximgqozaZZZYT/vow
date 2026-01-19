# Vow AWS Terraform Infrastructure

開発環境用のAWSサーバレスインフラをTerraformで構築します。

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
│                     │  (FastAPI)  │                             │
│                     └──────┬──────┘                             │
│                            │                                     │
│  ┌─────────────────────────▼─────────────────────────────────┐ │
│  │                        VPC                                  │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│ │
│  │  │   Public    │  │   Private   │  │      Isolated       ││ │
│  │  │   Subnet    │  │   Subnet    │  │       Subnet        ││ │
│  │  │  (NAT GW)   │  │  (Lambda)   │  │  (Aurora Serverless)││ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘│ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## コスト見積もり（月額）

| サービス | 仕様 | コスト |
|---------|------|--------|
| Lambda | 512MB, 1M requests | ~$0.20 |
| API Gateway | REST API, 1M requests | ~$3.50 |
| Aurora Serverless v2 | 0.5 ACU minimum | ~$44.00 |
| NAT Gateway | 1 AZ | ~$32.00 |
| Cognito | 無料枠 | ~$0.00 |
| **合計** | | **~$80/月** |

## 前提条件

1. Terraform >= 1.5.0
2. AWS CLI がインストール・設定済み
3. 適切なIAM権限

## クイックスタート

### 1. 変数ファイルの作成

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars を編集
```

### 2. 初期化

```bash
terraform init
```

### 3. プラン確認

```bash
terraform plan
```

### 4. デプロイ

```bash
terraform apply
```

### 5. 削除（必要な場合）

```bash
terraform destroy
```

## Lambda デプロイパッケージの準備

Lambda をデプロイする場合は、事前にパッケージを S3 にアップロードします：

```bash
# backend ディレクトリでパッケージを作成
cd backend
pip install -r requirements.txt -t package/
cp -r app package/
cp lambda_handler.py package/
cd package && zip -r ../lambda.zip . && cd ..

# S3 バケットを作成（初回のみ）
aws s3 mb s3://vow-deployment-${AWS_ACCOUNT_ID}

# S3 にアップロード
aws s3 cp lambda.zip s3://vow-deployment-${AWS_ACCOUNT_ID}/lambda/vow-api.zip

# terraform.tfvars を更新
# lambda_s3_bucket = "vow-deployment-${AWS_ACCOUNT_ID}"
# lambda_s3_key    = "lambda/vow-api.zip"
```

## 出力値

デプロイ後、以下の値が出力されます：

| 出力 | 説明 |
|------|------|
| `vpc_id` | VPC ID |
| `aurora_cluster_endpoint` | Aurora エンドポイント |
| `aurora_secret_arn` | 認証情報の Secret ARN |
| `cognito_user_pool_id` | Cognito User Pool ID |
| `cognito_client_id` | App Client ID |
| `api_gateway_url` | API Gateway URL（Lambda デプロイ時のみ） |

## 本番環境への移行

本番環境用の設定は各ファイルでコメントアウトされています。
移行時は以下を変更：

1. `variables.tf`: `environment` に `production` を追加
2. `aurora.tf`: `deletion_protection = true` に変更
3. `variables.tf`: `callback_urls` / `logout_urls` に本番 URL を追加
4. `versions.tf`: S3 バックエンドを有効化

## トラブルシューティング

### Aurora バージョンエラー

```
Cannot find version X.X for aurora-postgresql
```

→ `aurora.tf` の `engine_version` を利用可能なバージョンに更新

利用可能なバージョンを確認：
```bash
aws rds describe-db-engine-versions \
  --engine aurora-postgresql \
  --query 'DBEngineVersions[?SupportedEngineModes[?contains(@, `provisioned`)]].EngineVersion' \
  --region ap-northeast-1
```

### Lambda タイムアウト

1. VPC 設定を確認（NAT Gateway 経由でインターネットアクセス可能か）
2. セキュリティグループのアウトバウンドルールを確認
3. Aurora への接続を確認
