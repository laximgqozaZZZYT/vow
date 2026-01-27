# THLI-24 習慣レベルシステム デプロイ計画

このドキュメントは、THLI-24習慣レベルシステムのデプロイ手順を説明します。

---

## 目次

1. [デプロイ概要](#デプロイ概要)
2. [前提条件](#前提条件)
3. [Step 1: データベースマイグレーション](#step-1-データベースマイグレーション)
4. [Step 2: バックエンドデプロイ（開発環境）](#step-2-バックエンドデプロイ開発環境)
5. [Step 3: フロントエンドデプロイ（開発環境）](#step-3-フロントエンドデプロイ開発環境)
6. [Step 4: 開発環境での動作確認](#step-4-開発環境での動作確認)
7. [Step 5: ユーザー承認](#step-5-ユーザー承認)
8. [Step 6: 本番環境デプロイ](#step-6-本番環境デプロイ)
9. [ロールバック手順](#ロールバック手順)
10. [デプロイチェックリスト](#デプロイチェックリスト)

---

## デプロイ概要

### デプロイフロー

```
┌─────────────────────────────────────────────────────────────────┐
│                      デプロイフロー                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. マイグレーション    2. バックエンド     3. フロントエンド    │
│     (Supabase)            (Lambda)            (Amplify)         │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌───────────┐        ┌───────────┐        ┌───────────┐       │
│  │ 開発DB    │        │ 開発Lambda│        │ 開発Amplify│       │
│  │ (develop) │        │ (develop) │        │ (develop) │       │
│  └───────────┘        └───────────┘        └───────────┘       │
│         │                    │                    │             │
│         └────────────────────┼────────────────────┘             │
│                              │                                  │
│                              ▼                                  │
│                    4. 開発環境テスト                            │
│                              │                                  │
│                              ▼                                  │
│                    5. ユーザー承認                              │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────┐        ┌───────────┐        ┌───────────┐       │
│  │ 本番DB    │        │ 本番Lambda│        │ 本番Amplify│       │
│  │ (main)    │        │ (main)    │        │ (main)    │       │
│  └───────────┘        └───────────┘        └───────────┘       │
│                                                                 │
│                    6. 本番環境デプロイ                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 環境情報

| 環境 | ブランチ | フロントエンドURL | バックエンドAPI |
|------|----------|-------------------|-----------------|
| 開発 | `develop` | https://develop.do1k9oyyorn24.amplifyapp.com | https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development |
| 本番 | `main` | https://main.do1k9oyyorn24.amplifyapp.com | https://cy20h2nht8.execute-api.ap-northeast-1.amazonaws.com/production |

### 新規追加コンポーネント

| コンポーネント | 説明 |
|---------------|------|
| **データベース** | habits/goals テーブル拡張、level_history, level_suggestions, thli_validation_log テーブル |
| **バックエンド** | THLIAssessmentService, LevelManagerService, BabyStepGeneratorService, UsageQuotaService |
| **フロントエンド** | LevelBadge, Modal.LevelDetails, Modal.AssessmentResult, Modal.BabyStepPlan, Section.LevelHistory, Widget.QuotaStatus |
| **スケジュールジョブ** | レベルアップ検出、レベルダウン検出、クォータリセット |

---

## 前提条件

### 必要な権限

- [ ] AWS CLI設定済み（Lambda, S3, Amplify, CloudWatch）
- [ ] Supabase管理者アクセス
- [ ] GitHubリポジトリへのプッシュ権限

### 環境変数確認

```bash
# 開発環境Lambda
aws lambda get-function-configuration \
  --function-name vow-development-api \
  --query 'Environment.Variables' \
  --output table

# 必要な環境変数
# - OPENAI_API_KEY
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
```

### 依存関係確認

```bash
cd backend
npm install
npm run build  # ビルドエラーがないことを確認
```

---

## Step 1: データベースマイグレーション

### 1.1 マイグレーションファイルの確認

```bash
# マイグレーションファイル一覧
ls -la supabase/migrations/

# THLI関連のマイグレーション
# - 20250127000000_add_level_fields_to_habits_goals.sql
# - 20250127000001_create_level_history_table.sql
# - 20250127000002_create_level_suggestions_table.sql
# - 20250127000003_create_thli_validation_log_table.sql
# - 20250127000004_add_thli_quota_type.sql
```

### 1.2 開発環境へのマイグレーション実行

```bash
# Supabase CLIでマイグレーション実行
supabase db push --linked

# または、Supabaseダッシュボードから手動実行
# 1. https://supabase.com/dashboard にアクセス
# 2. プロジェクトを選択
# 3. SQL Editor → New Query
# 4. マイグレーションSQLを貼り付けて実行
```

### 1.3 マイグレーション確認

```sql
-- テーブル存在確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('level_history', 'level_suggestions', 'thli_validation_log');

-- カラム追加確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'habits' 
AND column_name IN ('level', 'level_tier', 'level_assessment_data', 'level_last_assessed_at');

-- インデックス確認
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('habits', 'level_history', 'level_suggestions');
```

### 1.4 既存ユーザーへのクォータ初期化

```sql
-- 既存ユーザーにTHLIクォータを追加
INSERT INTO token_quotas (user_id, quota_type, quota_used, quota_limit, period_start, period_end)
SELECT 
  id,
  'thli_assessments',
  0,
  CASE WHEN subscription_tier = 'premium' THEN -1 ELSE 10 END,
  date_trunc('month', NOW()),
  date_trunc('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 second'
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM token_quotas WHERE quota_type = 'thli_assessments'
);
```

---

## Step 2: バックエンドデプロイ（開発環境）

### 2.1 ビルド

```bash
cd backend

# 依存関係インストール
npm install

# TypeScriptビルド
npm run build

# ビルド成功確認
ls -la dist/
```

### 2.2 Lambdaパッケージ作成

```bash
# Lambda用パッケージ作成スクリプト実行
./scripts/build-lambda.sh

# パッケージサイズ確認（50MB以下であること）
ls -lh lambda-package.zip
```

### 2.3 S3へアップロード

```bash
# 開発環境用S3にアップロード
aws s3 cp lambda-package.zip s3://vow-lambda-deployments/development/lambda.zip

# アップロード確認
aws s3 ls s3://vow-lambda-deployments/development/
```

### 2.4 Lambda関数更新

```bash
# Lambda関数コード更新
aws lambda update-function-code \
  --function-name vow-development-api \
  --s3-bucket vow-lambda-deployments \
  --s3-key development/lambda.zip

# 更新完了待機
aws lambda wait function-updated \
  --function-name vow-development-api

# バージョン確認
aws lambda get-function \
  --function-name vow-development-api \
  --query 'Configuration.LastModified'
```

### 2.5 ヘルスチェック

```bash
# APIヘルスチェック
curl -s https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/health | jq .

# 期待されるレスポンス
# {
#   "status": "healthy",
#   "version": "x.x.x",
#   "timestamp": "2025-01-27T..."
# }
```

---

## Step 3: フロントエンドデプロイ（開発環境）

### 3.1 コード確認

```bash
cd frontend

# 依存関係インストール
npm install

# ローカルビルド確認
npm run build

# TypeScriptエラーがないことを確認
npm run lint
```

### 3.2 developブランチにプッシュ

```bash
# developブランチに切り替え
git checkout develop

# 変更をコミット
git add .
git commit -m "feat: THLI-24 習慣レベルシステム実装"

# プッシュ
git push origin develop
```

### 3.3 Amplifyビルド確認

```bash
# ビルドジョブ一覧
aws amplify list-jobs \
  --app-id do1k9oyyorn24 \
  --branch-name develop \
  --max-items 3 \
  --query 'jobSummaries[*].{jobId:jobId,status:status,commitId:commitId}' \
  --output table

# ビルドが開始されない場合は手動トリガー
aws amplify start-job \
  --app-id do1k9oyyorn24 \
  --branch-name develop \
  --job-type RELEASE
```

### 3.4 デプロイ完了確認

```bash
# ビルドステータス確認（SUCCEEDになるまで待機）
aws amplify get-job \
  --app-id do1k9oyyorn24 \
  --branch-name develop \
  --job-id <JOB_ID> \
  --query 'job.summary.status'

# フロントエンドアクセス確認
curl -s -o /dev/null -w "%{http_code}" https://develop.do1k9oyyorn24.amplifyapp.com/
# 200が返ることを確認
```

---

## Step 4: 開発環境での動作確認

### 4.1 基本機能テスト

以下のテストを実施します。詳細は [THLI_MANUAL_TESTING_GUIDE.md](./THLI_MANUAL_TESTING_GUIDE.md) を参照。

| テスト項目 | 確認内容 | 結果 |
|-----------|---------|------|
| ログイン | 開発環境にログインできる | ⬜ |
| 習慣作成 | 新規習慣を作成できる | ⬜ |
| レベル評価 | THLI-24評価を実行できる | ⬜ |
| レベル表示 | LevelBadgeが正しく表示される | ⬜ |
| レベル詳細 | Modal.LevelDetailsが開く | ⬜ |
| レベル履歴 | Section.LevelHistoryが表示される | ⬜ |
| クォータ表示 | Widget.QuotaStatusが正しい | ⬜ |

### 4.2 APIエンドポイントテスト

```bash
# 認証トークン取得（開発環境でログイン後、ブラウザのDevToolsから取得）
TOKEN="your_access_token"

# クォータ確認
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/users/me/thli-quota" | jq .

# 習慣レベル詳細取得
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/habits/HABIT_ID/level-details" | jq .

# レベル履歴取得
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/habits/HABIT_ID/level-history" | jq .
```

### 4.3 エラーハンドリングテスト

| テスト項目 | 確認内容 | 結果 |
|-----------|---------|------|
| クォータ超過 | 10回評価後にブロックされる | ⬜ |
| 認証エラー | 未認証でアクセス拒否される | ⬜ |
| 存在しない習慣 | 404エラーが返る | ⬜ |

### 4.4 パフォーマンステスト

```bash
# API応答時間測定
time curl -s -H "Authorization: Bearer $TOKEN" \
  "https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/habits/HABIT_ID/level-details" > /dev/null

# 目標: 300ms以下
```

---

## Step 5: ユーザー承認

### 5.1 承認依頼

開発環境でのテストが完了したら、ユーザーに承認を依頼します。

**承認依頼テンプレート:**

```
## THLI-24 習慣レベルシステム - 本番デプロイ承認依頼

### 開発環境URL
https://develop.do1k9oyyorn24.amplifyapp.com

### 新機能
- 習慣の難易度レベル評価（THLI-24フレームワーク）
- レベルに基づくベビーステップ提案
- レベル履歴の追跡
- 月間評価クォータ管理

### テスト結果
- 基本機能テスト: ✅ 完了
- APIテスト: ✅ 完了
- エラーハンドリング: ✅ 完了
- パフォーマンス: ✅ 目標達成

### 確認事項
1. 開発環境で新機能を試してください
2. 問題がなければ本番デプロイを承認してください
3. 問題があれば詳細をお知らせください

### 承認期限
YYYY年MM月DD日
```

### 5.2 承認待機

ユーザーからの承認を待ちます。

- [ ] ユーザーが開発環境で動作確認
- [ ] ユーザーから承認を取得
- [ ] 承認日時を記録: _______________

---

## Step 6: 本番環境デプロイ

**⚠️ 重要: ユーザー承認後にのみ実行してください**

### 6.1 本番データベースマイグレーション

```bash
# 本番環境のSupabaseプロジェクトに接続
supabase link --project-ref <PRODUCTION_PROJECT_REF>

# マイグレーション実行
supabase db push --linked

# または、本番Supabaseダッシュボードから手動実行
```

### 6.2 本番バックエンドデプロイ

```bash
# 本番環境用S3にアップロード
aws s3 cp backend/lambda-package.zip s3://vow-lambda-deployments/production/lambda.zip

# Lambda関数更新
aws lambda update-function-code \
  --function-name vow-production-api \
  --s3-bucket vow-lambda-deployments \
  --s3-key production/lambda.zip

# 更新完了待機
aws lambda wait function-updated \
  --function-name vow-production-api

# ヘルスチェック
curl -s https://cy20h2nht8.execute-api.ap-northeast-1.amazonaws.com/production/health | jq .
```

### 6.3 本番フロントエンドデプロイ

```bash
# mainブランチに切り替え
git checkout main

# developブランチをマージ
git merge develop

# プッシュ
git push origin main

# Amplifyビルド確認
aws amplify list-jobs \
  --app-id do1k9oyyorn24 \
  --branch-name main \
  --max-items 3 \
  --query 'jobSummaries[*].{jobId:jobId,status:status}' \
  --output table
```

### 6.4 本番環境確認

```bash
# フロントエンドアクセス確認
curl -s -o /dev/null -w "%{http_code}" https://main.do1k9oyyorn24.amplifyapp.com/

# APIヘルスチェック
curl -s https://cy20h2nht8.execute-api.ap-northeast-1.amazonaws.com/production/health | jq .
```

### 6.5 モニタリング確認

```bash
# CloudWatchダッシュボードを確認
# https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=THLI-24-Monitoring

# アラートが発生していないことを確認
aws cloudwatch describe-alarms \
  --alarm-name-prefix "THLI-" \
  --state-value ALARM \
  --query 'MetricAlarms[*].AlarmName'
```

---

## ロールバック手順

問題が発生した場合のロールバック手順です。

### バックエンドロールバック

```bash
# 前バージョンのLambdaパッケージを復元
aws s3 cp s3://vow-lambda-deployments/production/lambda-backup.zip s3://vow-lambda-deployments/production/lambda.zip

# Lambda関数更新
aws lambda update-function-code \
  --function-name vow-production-api \
  --s3-bucket vow-lambda-deployments \
  --s3-key production/lambda.zip
```

### フロントエンドロールバック

```bash
# 前のコミットに戻す
git checkout main
git revert HEAD
git push origin main

# または、Amplifyコンソールから前のビルドを再デプロイ
```

### データベースロールバック

```sql
-- 追加したカラムを削除（必要な場合のみ）
ALTER TABLE habits DROP COLUMN IF EXISTS level;
ALTER TABLE habits DROP COLUMN IF EXISTS level_tier;
ALTER TABLE habits DROP COLUMN IF EXISTS level_assessment_data;
ALTER TABLE habits DROP COLUMN IF EXISTS level_last_assessed_at;

-- 追加したテーブルを削除（必要な場合のみ）
DROP TABLE IF EXISTS level_history;
DROP TABLE IF EXISTS level_suggestions;
DROP TABLE IF EXISTS thli_validation_log;
```

**⚠️ 注意: データベースロールバックはデータ損失を伴う可能性があります。慎重に実行してください。**

---

## デプロイチェックリスト

### 開発環境デプロイ

- [ ] マイグレーションファイル確認
- [ ] 開発DBマイグレーション実行
- [ ] マイグレーション確認クエリ実行
- [ ] 既存ユーザークォータ初期化
- [ ] バックエンドビルド成功
- [ ] Lambdaパッケージ作成
- [ ] S3アップロード（開発）
- [ ] Lambda更新（開発）
- [ ] APIヘルスチェック（開発）
- [ ] フロントエンドビルド成功
- [ ] developブランチプッシュ
- [ ] Amplifyビルド成功（開発）
- [ ] 基本機能テスト完了
- [ ] APIエンドポイントテスト完了
- [ ] エラーハンドリングテスト完了
- [ ] パフォーマンステスト完了

### ユーザー承認

- [ ] 承認依頼送信
- [ ] ユーザー動作確認完了
- [ ] 承認取得
- [ ] 承認日時記録

### 本番環境デプロイ

- [ ] 本番DBマイグレーション実行
- [ ] S3アップロード（本番）
- [ ] Lambda更新（本番）
- [ ] APIヘルスチェック（本番）
- [ ] mainブランチマージ
- [ ] Amplifyビルド成功（本番）
- [ ] 本番環境動作確認
- [ ] モニタリングダッシュボード確認
- [ ] アラート状態確認

### デプロイ完了

- [ ] デプロイ完了通知送信
- [ ] ドキュメント更新
- [ ] 次回デプロイ用バックアップ作成

---

## 関連ドキュメント

- [THLI-24 API リファレンス](./THLI_API_REFERENCE.md)
- [THLI-24 ユーザーガイド](./THLI_USER_GUIDE.md)
- [THLI-24 モニタリング](./THLI_MONITORING.md)
- [THLI-24 マニュアルテストガイド](./THLI_MANUAL_TESTING_GUIDE.md)
- [デプロイ手順ガイド](./DEPLOYMENT_GUIDE.md)
