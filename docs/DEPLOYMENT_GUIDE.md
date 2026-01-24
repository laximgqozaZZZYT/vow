# デプロイ手順ガイド

このドキュメントは、VOWアプリケーションのデプロイ手順を説明します。

## 概要

デプロイは以下の流れで行います：

1. **開発環境へデプロイ** - `develop` ブランチにプッシュ
2. **ユーザーによる動作確認** - 開発環境で機能をテスト
3. **本番環境へデプロイ** - `main` ブランチにマージ

## 環境情報

| 環境 | ブランチ | フロントエンドURL | バックエンドAPI |
|------|----------|-------------------|-----------------|
| 開発 | `develop` | https://develop.do1k9oyyorn24.amplifyapp.com | https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development |
| 本番 | `main` | https://main.do1k9oyyorn24.amplifyapp.com | https://cy20h2nht8.execute-api.ap-northeast-1.amazonaws.com/production |

## デプロイ手順

### Step 1: 開発環境へデプロイ

#### フロントエンド（自動デプロイ）

```bash
# 1. developブランチに切り替え
git checkout develop

# 2. 変更をコミット
git add .
git commit -m "feat: 機能の説明"

# 3. developブランチにプッシュ
git push origin develop
```

プッシュ後、AWS Amplifyが自動的にビルド・デプロイを実行します。

**ビルド状況の確認:**
```bash
aws amplify list-jobs --app-id do1k9oyyorn24 --branch-name develop --max-items 3 \
  --query 'jobSummaries[*].{jobId:jobId,status:status,commitId:commitId}' --output table
```

**手動でビルドをトリガーする場合:**
```bash
aws amplify start-job --app-id do1k9oyyorn24 --branch-name develop --job-type RELEASE
```

#### バックエンド（Lambda）

バックエンドの変更がある場合は、以下の手順でデプロイします：

```bash
# 1. バックエンドディレクトリに移動
cd backend

# 2. ビルド
npm run build

# 3. Lambda用パッケージを作成
./scripts/build-lambda.sh

# 4. S3にアップロード
aws s3 cp lambda-package.zip s3://vow-lambda-deployments/development/lambda.zip

# 5. Lambda関数を更新
aws lambda update-function-code \
  --function-name vow-development-api \
  --s3-bucket vow-lambda-deployments \
  --s3-key development/lambda.zip

# 6. ヘルスチェック
curl https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/health
```

### Step 2: 動作確認

開発環境で以下を確認します：

- [ ] https://develop.do1k9oyyorn24.amplifyapp.com/dashboard にアクセス
- [ ] ログイン機能が正常に動作する
- [ ] 新機能が期待通りに動作する
- [ ] 既存機能に影響がない

### Step 3: 本番環境へデプロイ

動作確認が完了したら、本番環境にデプロイします。

#### フロントエンド

```bash
# 1. mainブランチに切り替え
git checkout main

# 2. developブランチをマージ
git merge develop

# 3. mainブランチにプッシュ
git push origin main
```

プッシュ後、AWS Amplifyが自動的にビルド・デプロイを実行します。

**ビルド状況の確認:**
```bash
aws amplify list-jobs --app-id do1k9oyyorn24 --branch-name main --max-items 3 \
  --query 'jobSummaries[*].{jobId:jobId,status:status,commitId:commitId}' --output table
```

#### バックエンド（Lambda）

```bash
# 1. S3にアップロード（本番用）
aws s3 cp backend/lambda-package.zip s3://vow-lambda-deployments/production/lambda.zip

# 2. Lambda関数を更新
aws lambda update-function-code \
  --function-name vow-production-api \
  --s3-bucket vow-lambda-deployments \
  --s3-key production/lambda.zip

# 3. ヘルスチェック
curl https://cy20h2nht8.execute-api.ap-northeast-1.amazonaws.com/production/health
```

## トラブルシューティング

### Amplifyビルドが失敗した場合

```bash
# ビルドログを確認
aws amplify get-job --app-id do1k9oyyorn24 --branch-name develop --job-id <JOB_ID> \
  --query 'job.steps[*].{stepName:stepName,status:status}' --output table
```

### Lambda更新後にエラーが発生した場合

```bash
# CloudWatchログを確認
aws logs tail /aws/lambda/vow-development-api --follow
```

### 開発環境でログインが本番に飛ばされる場合

Supabaseダッシュボードで、Authentication → URL Configuration → Redirect URLs に以下を追加：
- `https://develop.do1k9oyyorn24.amplifyapp.com/**`

## 重要な注意事項

1. **本番環境への直接デプロイは禁止** - 必ず開発環境で動作確認後にデプロイ
2. **tfvarsファイルはgit管理外** - 認証情報が含まれるため
3. **Lambdaの環境変数変更時** - AWS Consoleまたは`aws lambda update-function-configuration`で更新

## 関連ドキュメント

- [デプロイフロー詳細](./DEPLOYMENT_FLOW.md)
- [バックエンドセットアップ](./BACKEND_SETUP.md)
- [Slack連携セットアップ](./SLACK_INTEGRATION_SETUP.md)
