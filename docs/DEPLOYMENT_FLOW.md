# VOW デプロイフロー

このドキュメントでは、VOWプロジェクトの開発環境から本番環境へのデプロイフローを説明します。

## 概要

VOWは2つの環境を持ちます：

| 環境 | 用途 | ブランチ | URL |
|------|------|---------|-----|
| Development | 開発・検証 | develop | develop.do1k9oyyorn24.amplifyapp.com |
| Production | 本番 | main | main.do1k9oyyorn24.amplifyapp.com |

## デプロイフロー図

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           開発フロー                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │  Local   │───▶│  develop │───▶│   PR     │───▶│      main        │  │
│  │   Dev    │    │  branch  │    │  Review  │    │     branch       │  │
│  └──────────┘    └────┬─────┘    └──────────┘    └────────┬─────────┘  │
│                       │                                    │            │
│                       ▼                                    ▼            │
│              ┌────────────────┐                  ┌────────────────┐    │
│              │  Development   │                  │   Production   │    │
│              │  Environment   │                  │   Environment  │    │
│              └────────────────┘                  └────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 詳細フロー

### 1. ローカル開発

```bash
# 機能ブランチを作成
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# 開発・テスト
npm run dev
npm test

# コミット・プッシュ
git add .
git commit -m "feat: add new feature"
git push origin feature/my-feature
```

### 2. developブランチへのマージ

```bash
# PRを作成してレビュー後マージ
# または直接プッシュ（小さな変更の場合）
git checkout develop
git merge feature/my-feature
git push origin develop
```

**自動実行されるアクション：**
- GitHub Actions: `deploy-lambda-dev.yml`
  - テスト実行
  - Lambdaパッケージのビルド
  - 開発環境Lambdaへデプロイ
- Amplify: developブランチの自動ビルド・デプロイ

### 3. 開発環境での検証

開発環境で以下を確認：
- フロントエンド: https://develop.do1k9oyyorn24.amplifyapp.com
- バックエンドAPI: Lambda関数 `vow-development-api`

```bash
# ヘルスチェック
./infra/scripts/health-check.sh development
```

### 4. 本番環境へのプロモーション

```bash
# develop → main へのPRを作成
# GitHub UIで作成するか、以下のコマンドを使用
gh pr create --base main --head develop --title "Release: v1.x.x"
```

**PRチェック：**
- テストの実行
- ビルドの確認
- レビュー承認

### 5. 本番デプロイ

PRをマージすると自動的に本番デプロイが実行されます：

**自動実行されるアクション：**
- GitHub Actions: `deploy-lambda-prod.yml`
  - テスト実行
  - Lambdaパッケージのビルド
  - 本番環境Lambdaへデプロイ
  - ヘルスチェック
  - SNS通知（設定時）
- Amplify: mainブランチの自動ビルド・デプロイ

### 6. 本番環境の確認

```bash
# ヘルスチェック
./infra/scripts/health-check.sh production
```

## ロールバック手順

### Lambda ロールバック

1. GitHub Actions → "Deploy Lambda to AWS (Production)"
2. "Run workflow" をクリック
3. `rollback: true` を選択
4. バージョンを指定（空欄で前バージョン）
5. "Run workflow" を実行

```bash
# CLIでのロールバック
aws lambda update-alias \
  --function-name vow-production-api \
  --name production \
  --function-version <VERSION>
```

### Amplify ロールバック

1. AWS Amplify コンソールを開く
2. アプリを選択 → "Hosting" → "Deployments"
3. 前回のデプロイを選択
4. "Redeploy this version" をクリック

## Terraform による環境管理

### 環境切り替え

```bash
cd infra/terraform

# 開発環境
./scripts/switch-env.sh development plan
./scripts/switch-env.sh development apply

# 本番環境
./scripts/switch-env.sh production plan
./scripts/switch-env.sh production apply
```

### 環境設定の検証

```bash
# 設定ファイルの検証
./infra/scripts/validate-env.sh development
./infra/scripts/validate-env.sh production
```

## GitHub Secrets 設定

以下のシークレットをGitHubリポジトリに設定してください：

| シークレット | 説明 | 必須 |
|------------|------|------|
| `AWS_LAMBDA_DEPLOY_ROLE_ARN` | Lambda デプロイ用IAMロールARN | ✓ |
| `SNS_ALERTS_TOPIC_ARN` | 通知用SNSトピックARN | - |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase匿名キー | ✓ |
| `VERCEL_TOKEN` | Vercelデプロイトークン | - |
| `VERCEL_ORG_ID` | Vercel組織ID | - |
| `VERCEL_PROJECT_ID` | VercelプロジェクトID | - |

## トラブルシューティング

### デプロイが失敗した場合

1. GitHub Actions のログを確認
2. エラーメッセージを確認
3. 必要に応じてロールバック

### 開発環境と本番環境の差異

開発環境と本番環境で異なる設定：

| 設定 | Development | Production |
|------|-------------|------------|
| Lambda関数名 | vow-development-api | vow-production-api |
| Lambda エイリアス | development | production |
| Amplify ステージ | DEVELOPMENT | PRODUCTION |
| NODE_ENV | development | production |

### 環境変数の確認

```bash
# Terraform変数の確認
cat infra/terraform/terraform.development.tfvars
cat infra/terraform/terraform.production.tfvars
```

## 参考リンク

- [Terraform README](../infra/terraform/README.md)
- [GitHub Actions ワークフロー](../.github/workflows/)
- [AWS Amplify ドキュメント](https://docs.aws.amazon.com/amplify/)
- [AWS Lambda ドキュメント](https://docs.aws.amazon.com/lambda/)
