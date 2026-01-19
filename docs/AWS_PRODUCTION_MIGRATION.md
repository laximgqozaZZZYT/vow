# VOW 本番環境 AWS 移行手順書

## 概要

本ドキュメントは、VOW本番環境をVercel + SupabaseからAWSに移行するための手順を記載します。

### 移行前後の構成

| 項目 | 移行前 | 移行後 |
|------|--------|--------|
| フロントエンド | Vercel | AWS Amplify |
| データベース | Supabase PostgreSQL | Aurora Serverless v2 |
| 認証 | Supabase Auth | AWS Cognito |
| API | Supabase REST API | Lambda + API Gateway |

### 移行の特徴

- **ゼロダウンタイム**: Blue-Green Deploymentによる無停止移行
- **データ整合性**: AWS DMSによるFull Load + CDC
- **OAuth継続**: Google/GitHub認証の並行運用
- **ロールバック可能**: 30日間の旧環境保持

---

## 事前チェックリスト

### 必須要件

- [ ] AWS CLIがインストール・設定済み
- [ ] Terraformがインストール済み (`~/.local/bin/terraform`)
- [ ] GitHub Personal Access Token（Amplify用）
- [ ] Google OAuth Client ID/Secret
- [ ] GitHub OAuth Client ID/Secret
- [ ] Supabase接続情報（ホスト、ユーザー、パスワード）

### 確認事項

- [ ] 開発環境（AWS）が正常に動作している
- [ ] 本番データのバックアップが取得済み
- [ ] 移行作業の時間帯が確保されている（推奨: 低トラフィック時間帯）

---

## Phase 1: AWSインフラ構築

### 1.1 Terraform変数の設定

```bash
cd infra/terraform

# 本番用変数ファイルをコピー
cp terraform.production.tfvars terraform.production.tfvars.local

# 機密情報を設定
export TF_VAR_google_client_id="YOUR_GOOGLE_CLIENT_ID"
export TF_VAR_google_client_secret="YOUR_GOOGLE_CLIENT_SECRET"
export TF_VAR_github_client_id="YOUR_GITHUB_CLIENT_ID"
export TF_VAR_github_client_secret="YOUR_GITHUB_CLIENT_SECRET"
export TF_VAR_github_access_token="YOUR_GITHUB_PAT"
export TF_VAR_supabase_host="db.jamiyzsyclvlvstmeeir.supabase.co"
export TF_VAR_supabase_password="YOUR_SUPABASE_PASSWORD"
```

### 1.2 Terraformワークスペースの作成

```bash
# 本番用ワークスペース作成
~/.local/bin/terraform workspace new production

# または既存ワークスペースを選択
~/.local/bin/terraform workspace select production
```

### 1.3 インフラのデプロイ

```bash
# プラン確認
~/.local/bin/terraform plan -var-file=terraform.production.tfvars

# デプロイ実行
~/.local/bin/terraform apply -var-file=terraform.production.tfvars
```

### 1.4 出力値の確認

```bash
~/.local/bin/terraform output

# 重要な出力値:
# - cognito_user_pool_id
# - cognito_client_id
# - cognito_domain
# - aurora_cluster_endpoint
# - amplify_production_url
```

---

## Phase 2: OAuth設定の更新

### 2.1 Google OAuth (GCP Console)

1. [GCP Console](https://console.cloud.google.com/apis/credentials) にアクセス
2. OAuth 2.0 クライアントを選択
3. 「承認済みのリダイレクト URI」に追加:
   ```
   https://vow-auth-production.auth.ap-northeast-1.amazoncognito.com/oauth2/idpresponse
   ```
4. **既存のSupabase URIは削除しない**（並行運用のため）

### 2.2 GitHub OAuth (Developer Settings)

1. [GitHub Developer Settings](https://github.com/settings/developers) にアクセス
2. OAuth Appを選択
3. 「Authorization callback URL」に追加:
   ```
   https://vow-auth-production.auth.ap-northeast-1.amazoncognito.com/oauth2/idpresponse
   ```
4. **既存のSupabase URIは削除しない**

---

## Phase 3: データベース移行 (DMS)

### 3.1 DMS設定の有効化

```bash
# terraform.production.tfvars を編集
enable_dms = true
supabase_host = "db.jamiyzsyclvlvstmeeir.supabase.co"

# 再デプロイ
~/.local/bin/terraform apply -var-file=terraform.production.tfvars
```

### 3.2 DMSタスクの開始

```bash
# AWS Console または CLI で DMS タスクを開始
aws dms start-replication-task \
  --replication-task-arn $(terraform output -raw dms_replication_task_arn) \
  --start-replication-task-type start-replication \
  --region ap-northeast-1
```

### 3.3 移行状況の監視

```bash
# タスク状況確認
aws dms describe-replication-tasks \
  --filters "Name=replication-task-id,Values=vow-production-migration" \
  --query "ReplicationTasks[0].{Status:Status,Progress:ReplicationTaskStats}" \
  --region ap-northeast-1
```

### 3.4 データ検証

```bash
cd scripts/migration

# 環境変数設定
export SUPABASE_CONNECTION_STRING="postgresql://postgres:PASSWORD@db.jamiyzsyclvlvstmeeir.supabase.co:5432/postgres"
export AURORA_SECRET_ARN=$(cd ../../infra/terraform && terraform output -raw aurora_secret_arn)

# 検証実行
python verify_data.py
```

---

## Phase 4: ユーザー移行

### 4.1 Cognitoカスタム属性の追加

Cognito User Poolに以下のカスタム属性を追加（Terraformで自動作成されない場合）:

- `custom:supabase_id` (String)
- `custom:created_at` (String)
- `custom:auth_provider` (String)

### 4.2 ユーザー移行の実行

```bash
cd scripts/migration

# 環境変数設定
export COGNITO_USER_POOL_ID=$(cd ../../infra/terraform && terraform output -raw cognito_user_pool_id)

# ドライラン（確認のみ）
python migrate_users.py --dry-run

# 本番実行
python migrate_users.py
```

---

## Phase 5: トラフィック切り替え

### 5.1 Vercelリダイレクト設定

`frontend/vercel.json` を作成または更新:

```json
{
  "redirects": [
    {
      "source": "/(.*)",
      "destination": "https://main.YOUR_AMPLIFY_DOMAIN/$1",
      "permanent": true
    }
  ]
}
```

### 5.2 リダイレクトのデプロイ

```bash
cd frontend
vercel --prod
```

### 5.3 DMS CDCの停止

```bash
# 最終同期を待ってからCDCを停止
aws dms stop-replication-task \
  --replication-task-arn $(terraform output -raw dms_replication_task_arn) \
  --region ap-northeast-1
```

---

## Phase 6: 検証

### 6.1 機能検証チェックリスト

- [ ] AWS Amplify URLでアプリにアクセスできる
- [ ] Google OAuthでログインできる
- [ ] GitHub OAuthでログインできる
- [ ] 習慣の作成・編集・削除ができる
- [ ] 目標の作成・編集・削除ができる
- [ ] マインドマップが正常に表示される
- [ ] カレンダーが正常に表示される

### 6.2 パフォーマンス検証

- [ ] ページ読み込み時間が許容範囲内
- [ ] API応答時間が許容範囲内（p99 < 2秒）
- [ ] エラー率が許容範囲内（< 1%）

### 6.3 監視確認

- [ ] CloudWatchダッシュボードでメトリクスが表示される
- [ ] アラームが正常に設定されている

---

## ロールバック手順

問題が発生した場合のロールバック手順:

### 即時ロールバック（5分以内）

```bash
cd scripts/migration
./rollback.sh
```

### 手動ロールバック

1. **Vercelリダイレクト解除**
   - `frontend/vercel.json` からリダイレクト設定を削除
   - `vercel --prod` で再デプロイ

2. **OAuth設定確認**
   - Google/GitHub OAuthのCallback URLにSupabase URLが残っていることを確認

3. **DMS停止**
   ```bash
   aws dms stop-replication-task \
     --replication-task-arn TASK_ARN \
     --region ap-northeast-1
   ```

4. **通知**
   - 関係者にロールバック完了を通知

---

## トラブルシューティング

### DMS接続エラー

**症状**: DMSがSupabaseに接続できない

**対処**:
1. Supabaseの接続プーリング設定を確認
2. SSL設定を確認（`ssl_mode = "require"`）
3. Supabaseのファイアウォール設定を確認

### Cognito認証エラー

**症状**: OAuthログインが失敗する

**対処**:
1. Callback URLが正しく設定されているか確認
2. Cognitoドメインが正しいか確認
3. CloudWatch Logsでエラー詳細を確認

### Aurora接続エラー

**症状**: Lambdaからデータベースに接続できない

**対処**:
1. セキュリティグループの設定を確認
2. VPCサブネットの設定を確認
3. Secrets Managerの認証情報を確認

---

## 移行後の作業

### 30日後

- [ ] Vercelプロジェクトの停止
- [ ] Supabaseプロジェクトの停止（データバックアップ後）
- [ ] OAuth設定から旧Callback URLを削除
- [ ] DMSリソースの削除

### コスト最適化

- [ ] Aurora ACU使用量の監視と調整
- [ ] Lambda メモリ設定の最適化
- [ ] 不要なCloudWatch Logsの削除

---

## 連絡先

移行中に問題が発生した場合:

- CloudWatch Alarms → SNS → Email通知
- AWS Support（必要に応じて）
