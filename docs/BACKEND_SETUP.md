# Backend Setup Guide

FastAPIバックエンドのセットアップと開発ガイドです。

## アーキテクチャ概要

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Amplify        │     │  App Runner     │     │  RDS            │
│  (Next.js)      │────▶│  (FastAPI)      │────▶│  (PostgreSQL)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **フロントエンド**: AWS Amplify Hosting (Next.js SSR)
- **バックエンド**: AWS App Runner (FastAPI + Docker)
- **データベース**: Amazon RDS PostgreSQL

## ローカル開発

### 前提条件

- Docker & Docker Compose
- Python 3.12+
- Node.js 20+ (フロントエンド用)

### クイックスタート

```bash
# 1. リポジトリをクローン
git clone https://github.com/your-username/vow.git
cd vow

# 2. Docker Composeで起動
docker-compose up -d

# 3. サービス確認
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
# - PostgreSQL: localhost:5432
```

### バックエンド単体での開発

```bash
cd backend

# 仮想環境を作成
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 依存関係をインストール
pip install -r requirements.txt -r requirements-dev.txt

# 環境変数を設定
cp .env.example .env
# .envファイルを編集

# 開発サーバーを起動
uvicorn app.main:app --reload --port 8000
```

### 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `DATABASE_URL` | PostgreSQL接続URL | `postgresql+asyncpg://postgres:postgres@localhost:5432/vow_dev` |
| `JWT_SECRET` | JWT署名キー | `dev-secret-key-change-in-production` |
| `DEBUG` | デバッグモード | `false` |
| `CORS_ORIGINS` | 許可するオリジン | `["http://localhost:3000"]` |
| `SLACK_ENABLED` | Slack連携有効化 | `false` |
| `OPENAI_ENABLED` | OpenAI連携有効化 | `false` |

## AWS CDKデプロイ

### 前提条件

- AWS CLI設定済み
- AWS CDK CLI (`npm install -g aws-cdk`)
- Python 3.12+

### CDKセットアップ

```bash
cd infra

# 仮想環境を作成
python -m venv .venv
source .venv/bin/activate

# 依存関係をインストール
pip install -r requirements.txt

# CDKブートストラップ（初回のみ）
cdk bootstrap
```

### デプロイ

```bash
# フロントエンドのみ（既存）
cdk deploy VowDevStack -c github_repo="https://github.com/your-username/vow"

# バックエンド含む全スタック
cdk deploy --all \
  -c github_repo="https://github.com/your-username/vow" \
  -c deploy_backend="true" \
  -c amplify_app_url="https://develop.xxx.amplifyapp.com"
```

### スタック構成

| スタック名 | 説明 | リソース |
|-----------|------|---------|
| `VowDevStack` | フロントエンド | Amplify Hosting |
| `VowDatabaseStack` | データベース | VPC, RDS PostgreSQL, Secrets Manager |
| `VowBackendStack` | バックエンド | ECR, App Runner, VPC Connector |

## Dockerイメージのビルドとプッシュ

```bash
# ECRにログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com

# イメージをビルド
cd backend
docker build -t vow-backend .

# タグ付け
docker tag vow-backend:latest <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/vow-backend:latest

# プッシュ
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/vow-backend:latest
```

## API エンドポイント

### ヘルスチェック

```bash
# 基本ヘルスチェック
curl http://localhost:8000/health

# 詳細ヘルスチェック
curl http://localhost:8000/health/detailed
```

### 認証

すべてのAPIエンドポイント（`/health`、`/docs`を除く）はJWT認証が必要です。

```bash
curl -H "Authorization: Bearer <jwt-token>" http://localhost:8000/api/v1/habits
```

## トラブルシューティング

### Docker Composeが起動しない

```bash
# ログを確認
docker-compose logs backend

# コンテナを再ビルド
docker-compose build --no-cache backend
docker-compose up -d
```

### データベース接続エラー

```bash
# PostgreSQLコンテナの状態確認
docker-compose ps db

# データベースに直接接続
docker-compose exec db psql -U postgres -d vow_dev
```

### App Runnerデプロイエラー

1. ECRイメージが正しくプッシュされているか確認
2. VPCコネクターがRDSにアクセスできるか確認
3. Secrets Managerの権限を確認

## 関連ドキュメント

- [CLOUD_DEV_SETUP.md](./CLOUD_DEV_SETUP.md) - AWS開発環境セットアップ
- [SECURITY.md](./SECURITY.md) - セキュリティガイドライン
