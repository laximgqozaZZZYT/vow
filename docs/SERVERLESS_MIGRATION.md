# VOW AWSサーバレス移行ガイド

本ドキュメントは、VOWアプリケーションをVercel + SupabaseからAWSサーバレス構成（Lambda + API Gateway + Aurora Serverless v2）に移行するための手順書です。

## 目次

1. [概要](#概要)
2. [事前チェックリスト](#事前チェックリスト)
3. [移行手順](#移行手順)
4. [ロールバック手順](#ロールバック手順)
5. [トラブルシューティング](#トラブルシューティング)
6. [移行後の確認](#移行後の確認)

---

## 概要

### アーキテクチャ変更

| コンポーネント | 移行前 | 移行後 |
|--------------|--------|--------|
| フロントエンド | Vercel | AWS Amplify Hosting |
| バックエンド | - | AWS Lambda + API Gateway |
| データベース | Supabase PostgreSQL | Aurora Serverless v2 |
| 認証 | Supabase Auth | Amazon Cognito |
| CDN | Vercel Edge | CloudFront (Amplify) |

### 想定コスト

- 月額目標: ~$48
- Aurora Serverless v2: ~$30 (0.5 ACU最小)
- Lambda: ~$5 (100万リクエスト/月)
- API Gateway: ~$5
- Amplify: ~$5
- その他: ~$3

---

## 事前チェックリスト

### 1. AWS環境

- [ ] AWS CLIがインストールされている
- [ ] AWS認証情報が設定されている
- [ ] 必要なIAM権限がある
  - Lambda, API Gateway, Aurora, Cognito, Amplify, CloudWatch, SNS
- [ ] CDKがインストールされている (`npm install -g aws-cdk`)

### 2. 環境変数

以下の環境変数を設定:

```bash
# AWS
export AWS_REGION=ap-northeast-1
export AWS_ACCOUNT_ID=<your-account-id>

# Supabase (移行元)
export SUPABASE_CONNECTION_STRING=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# Aurora (移行先)
export AURORA_SECRET_ARN=arn:aws:secretsmanager:ap-northeast-1:xxx:secret:rds!cluster-xxx

# Cognito
export COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
```

### 3. バックアップ

- [ ] Supabaseデータベースのバックアップを取得
- [ ] 現在のVercel環境変数をエクスポート
- [ ] OAuth設定（Google, GitHub）をドキュメント化

### 4. 通知設定

- [ ] SNSトピックを作成（アラート用）
- [ ] メール通知を設定

---

## 移行手順

### Phase 1: インフラ構築 (Day 1)

#### 1.1 CDKスタックのデプロイ

```bash
cd infra

# 依存関係インストール
pip install -r requirements.txt

# CDK Bootstrap（初回のみ）
cdk bootstrap

# スタックをデプロイ
cdk deploy --all --require-approval never
```

デプロイされるスタック:
- VowDatabaseStack (Aurora Serverless v2)
- VowAuthStack (Cognito)
- VowBackendStack (Lambda + API Gateway)
- VowFrontendStack (Amplify)
- VowMonitoringStack (CloudWatch)

#### 1.2 デプロイ確認

```bash
# Lambda関数の確認
aws lambda get-function --function-name vow-production-api

# API Gatewayの確認
aws apigateway get-rest-apis

# Auroraクラスターの確認
aws rds describe-db-clusters --db-cluster-identifier vow-production
```

### Phase 2: データ移行 (Day 2)

#### 2.1 Supabaseからデータエクスポート

```bash
cd scripts/migration

# データエクスポート
python export_supabase.py --output ./export_data --include-users

# 出力確認
ls -la ./export_data/
```

#### 2.2 Auroraにデータインポート

```bash
# Dry-run（確認）
python import_aurora.py --input ./export_data --dry-run

# 本番インポート
python import_aurora.py --input ./export_data
```

#### 2.3 データ検証

```bash
python verify_data.py
```

期待される出力:
```
✅ All verifications PASSED!
```

### Phase 3: ユーザー移行 (Day 2)

#### 3.1 Cognitoにユーザー移行

```bash
# Dry-run
python migrate_users.py --dry-run

# 本番移行
python migrate_users.py
```

#### 3.2 OAuth設定更新

**Google OAuth (GCP Console)**:
1. https://console.cloud.google.com/apis/credentials
2. OAuth 2.0 Client IDを選択
3. Authorized redirect URIsに追加:
   ```
   https://<cognito-domain>.auth.ap-northeast-1.amazoncognito.com/oauth2/idpresponse
   ```

**GitHub OAuth**:
1. https://github.com/settings/developers
2. OAuth Appを選択
3. Authorization callback URLを更新:
   ```
   https://<cognito-domain>.auth.ap-northeast-1.amazoncognito.com/oauth2/idpresponse
   ```

### Phase 4: 増分同期 (Day 3-7)

移行期間中、Supabaseの変更をAuroraに同期:

```bash
# 初回同期
python sync_incremental.py --since "2026-01-19T00:00:00" --state ./sync_state.json

# 定期同期（cronで実行）
python sync_incremental.py --state ./sync_state.json
```

### Phase 5: 切り替え (Day 7)

#### 5.1 フロントエンド環境変数更新

Amplifyコンソールで環境変数を設定:
- `NEXT_PUBLIC_API_URL`: API Gateway URL
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`: Cognito User Pool ID
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`: Cognito Client ID
- `NEXT_PUBLIC_COGNITO_DOMAIN`: Cognito Domain
- `NEXT_PUBLIC_AUTH_PROVIDER`: cognito

#### 5.2 DNS切り替え

1. Route53またはDNSプロバイダーでAレコードを更新
2. TTLを短く設定（5分）
3. 切り替え後、TTLを元に戻す

#### 5.3 最終確認

```bash
# ヘルスチェック
curl https://api.your-domain.com/health

# 認証テスト
# ブラウザでログインを確認
```

---

## ロールバック手順

問題が発生した場合のロールバック手順:

### 自動ロールバック

```bash
cd scripts/migration

# Dry-run
python rollback.py --dry-run

# 実行
python rollback.py --execute
```

### 手動ロールバック

#### 1. DNS切り戻し

Route53またはDNSプロバイダーで:
- AレコードをVercelのIPに戻す
- または、CNAMEをVercelドメインに戻す

#### 2. OAuth設定復元

Google/GitHub OAuthのコールバックURLをSupabaseに戻す:
```
https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback
```

#### 3. 増分同期停止

```bash
# DMS停止（使用している場合）
aws dms stop-replication-task --replication-task-arn <task-arn>
```

#### 4. 確認

- Vercelダッシュボードでトラフィックを確認
- Supabaseダッシュボードでデータベース接続を確認
- ログインテストを実行

---

## トラブルシューティング

### Lambda関連

#### コールドスタートが遅い

```bash
# Provisioned Concurrencyを設定
aws lambda put-provisioned-concurrency-config \
  --function-name vow-production-api \
  --qualifier production \
  --provisioned-concurrent-executions 1
```

#### タイムアウトエラー

1. Lambda設定でタイムアウトを増加（最大30秒）
2. データベース接続プールを確認
3. VPCエンドポイントを確認

### Aurora関連

#### 接続エラー

```bash
# セキュリティグループ確認
aws ec2 describe-security-groups --group-ids <sg-id>

# VPCエンドポイント確認
aws ec2 describe-vpc-endpoints
```

#### パフォーマンス問題

```bash
# ACU使用率確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name ServerlessDatabaseCapacity \
  --dimensions Name=DBClusterIdentifier,Value=vow-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

### Cognito関連

#### ログインエラー

1. Cognitoコンソールでユーザーステータスを確認
2. App Client設定を確認
3. OAuth設定（コールバックURL）を確認

#### トークン検証エラー

```bash
# JWKS URLを確認
curl https://cognito-idp.ap-northeast-1.amazonaws.com/<user-pool-id>/.well-known/jwks.json
```

### データ移行関連

#### チェックサム不一致

```bash
# 特定テーブルを再エクスポート/インポート
python export_supabase.py --output ./export_data
python import_aurora.py --input ./export_data --table habits
python verify_data.py
```

#### 増分同期の遅延

```bash
# 同期状態を確認
cat ./sync_state.json

# 手動で特定時点から再同期
python sync_incremental.py --since "2026-01-20T00:00:00"
```

---

## 移行後の確認

### 機能テスト

- [ ] ユーザーログイン（Google OAuth）
- [ ] ユーザーログイン（GitHub OAuth）
- [ ] 習慣の作成/編集/削除
- [ ] 習慣ログの記録
- [ ] ゴールの作成/編集/削除
- [ ] マインドマップの表示/編集
- [ ] 統計情報の表示

### パフォーマンステスト

- [ ] API応答時間 < 500ms
- [ ] ページロード時間 < 3秒
- [ ] コールドスタート時間 < 5秒

### 監視設定

- [ ] CloudWatchダッシュボードを確認
- [ ] アラームが正常に動作することを確認
- [ ] SNS通知が届くことを確認

### コスト確認

- [ ] Cost Explorerで日次コストを確認
- [ ] 予算アラートを設定

---

## 連絡先

問題が発生した場合:
- GitHub Issues: https://github.com/your-org/vow/issues
- Slack: #vow-support

---

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-01-19 | 1.0.0 | 初版作成 |
