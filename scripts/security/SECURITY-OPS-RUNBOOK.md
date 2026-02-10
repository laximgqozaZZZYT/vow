# VOW セキュリティ運用手順書

**作成日**: 2026-02-10
**対象コミット**: `5aff3e98` (コード修正) + `8942019c` (インフラ基盤)

---

## 概要

セキュリティ監査に基づき、以下の変更がdevelopブランチにコミット済みです。
この手順書に従って、順番に適用してください。

| # | 作業 | リスク | 所要時間 | ダウンタイム |
|---|------|--------|----------|-------------|
| Step 0 | Git push (develop → origin) | 低 | 1分 | なし |
| Step 1 | Terraform S3バックエンド移行 | 中 | 5分 | なし |
| Step 2 | Supabase RLSマイグレーション適用 | **高** | 5分 | なし（即時反映） |
| Step 3 | WAF + Secrets Manager適用 (terraform apply) | 中 | 5分 | なし |
| Step 4 | main マージ + 本番デプロイ | 中 | 10分 | 数分 |
| Step 5 | Git履歴クリーニング + シークレットローテーション | **高** | 30-60分 | 5-10分 |
| Step 6 | 最終検証 | 低 | 10分 | なし |

**推奨**: Step 2 (RLS) と Step 5 (ローテーション) は影響範囲が大きいため、メンテナンスウィンドウの確保を推奨します。

---

## 前提条件

```bash
# 必要なツール
aws --version          # AWS CLI v2
terraform --version    # Terraform >= 1.0
npx supabase --version # Supabase CLI (npx経由でもOK)
pip install git-filter-repo  # Step 5で必要
```

---

## Step 0: Git push (develop → origin)

```bash
cd ~/Downloads/vow
git branch  # developにいることを確認

# pushする前にdiffを確認
git log origin/develop..develop --oneline
# 以下の2コミットが表示されるはず:
# 8942019c security(infra): セキュリティ運用基盤の追加
# 5aff3e98 security: セキュリティ監査に基づく脆弱性修正（10件）

git push origin develop
```

**確認**: GitHub上でdevelopブランチに2コミットが反映されていること。

---

## Step 1: Terraform S3バックエンド移行

ローカルの `terraform.tfstate` をS3に移行します。
S3バケットとDynamoDBテーブルは既に作成済みです。

```bash
cd ~/Downloads/vow/infra/terraform

# 現在のステートをバックアップ
cp terraform.tfstate terraform.tfstate.backup-$(date +%Y%m%d)

# S3バックエンドへ移行（対話プロンプトで "yes" と回答）
terraform init -migrate-state
```

**期待される出力**:
```
Initializing the backend...
Do you want to copy existing state to the new backend?
  ...
Enter a value: yes

Successfully configured the backend "s3"!
```

**確認**:
```bash
# S3にステートがアップロードされたことを確認
aws s3 ls s3://vow-terraform-state-257784614320/
# terraform.tfstate が表示されるはず

# terraform planが正常に動くことを確認
terraform plan -var-file=terraform.tfvars 2>&1 | tail -5
```

**失敗した場合**:
```bash
# バックアップから復元
cp terraform.tfstate.backup-* terraform.tfstate
# versions.tf のbackend "s3" ブロックをコメントアウトして再試行
```

---

## Step 2: Supabase RLSマイグレーション適用

**注意**: この変更はデータベースのアクセス制御に直接影響します。

### 変更内容

| テーブル | 変更 | 影響 |
|---------|------|------|
| `api_keys` | `USING(true)` → `auth.uid() = user_id` | 他ユーザーのAPIキーが見えなくなる（正常動作） |
| `rate_limits` | 全`USING(true)`ポリシー削除 | anonアクセス不可（service_roleは引き続きアクセス可能） |
| 9テーブル | `OR owner_id IS NULL` 除去 | owner_id未設定の孤立データにアクセス不可 |

### 適用前の確認

```bash
# Supabase CLIがない場合はnpx経由で実行
cd ~/Downloads/vow

# マイグレーションファイルの確認
cat supabase/migrations/20260215000000_fix_rls_security.sql
```

### 適用方法

**方法A: Supabase CLI (推奨)**
```bash
cd ~/Downloads/vow
npx supabase db push
# または
npx supabase migration up
```

**方法B: Supabase Dashboard (CLIが使えない場合)**
1. https://supabase.com/dashboard → VOWプロジェクト
2. SQL Editor を開く
3. `supabase/migrations/20260215000000_fix_rls_security.sql` の内容を貼り付け
4. 「Run」をクリック

### 適用後の確認

Supabase SQL Editorで以下を実行:

```sql
-- api_keys: USING(true)が残っていないこと
SELECT policyname, qual FROM pg_policies WHERE tablename = 'api_keys';
-- → 全て auth.uid() = user_id を含むはず

-- rate_limits: ポリシーが0件であること
SELECT count(*) FROM pg_policies WHERE tablename = 'rate_limits';
-- → 0

-- goals: owner_id IS NULL が含まれていないこと
SELECT policyname, qual FROM pg_policies WHERE tablename = 'goals';
```

**ロールバック手順** (問題発生時):
```sql
-- api_keysを元に戻す（緊急時のみ）
DROP POLICY IF EXISTS "api_keys_select_policy" ON api_keys;
CREATE POLICY "api_keys_select_policy" ON api_keys FOR SELECT USING (true);
-- ※ これはセキュリティ的に脆弱な状態に戻します
```

---

## Step 3: WAF + Secrets Manager適用 (terraform apply)

```bash
cd ~/Downloads/vow/infra/terraform

# 差分を確認
terraform plan -var-file=terraform.tfvars
```

**期待される新規リソース** (計5-6個):
- `aws_wafv2_web_acl.api[0]`
- `aws_wafv2_web_acl_association.api[0]`
- `aws_api_gateway_method_settings.hono_throttling[0]`
- `aws_secretsmanager_secret.lambda_secrets[0]`
- `aws_secretsmanager_secret_version.lambda_secrets[0]`
- `aws_iam_role_policy.lambda_secrets_manager[0]`

```bash
# 問題なければ適用
terraform apply -var-file=terraform.tfvars
```

**確認**:
```bash
# WAFが作成されたことを確認
aws wafv2 list-web-acls --scope REGIONAL --region ap-northeast-1 \
  --query 'WebACLs[?Name==`vow-production-api-waf`].Name'

# Secrets Managerにシークレットが格納されたことを確認
aws secretsmanager describe-secret \
  --secret-id vow/production/lambda-secrets \
  --region ap-northeast-1 \
  --query 'Name'

# API Gatewayのヘルスチェック（WAF適用後も正常であること）
curl -s https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/production/health
```

---

## Step 4: main マージ + 本番デプロイ

```bash
cd ~/Downloads/vow

# mainにマージ
git checkout main
git pull origin main
git merge develop
git push origin main
```

**注意**: mainへのpushにより GitHub Actions (`deploy-lambda-prod.yml`) が自動実行されます。

```bash
# デプロイ状況を確認
gh run list --branch main --limit 3

# デプロイ完了後のヘルスチェック
curl -s https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/production/health
```

**フロントエンド確認**:
- https://main.do1k9oyyorn24.amplifyapp.com/dashboard
- ログイン/ログアウトが正常に動作すること
- ダッシュボードが表示されること

---

## Step 5: Git履歴クリーニング + シークレットローテーション

**注意**: この作業はGit履歴を書き換えるため、`--force` pushが必要です。

### 5a. 対話式スクリプトの実行

```bash
cd ~/Downloads/vow
./scripts/security/secrets-rotation-runbook.sh
```

スクリプトは4つのフェーズに分かれています:
- **Phase 1**: Git履歴から機密ファイルを除去 (`git filter-repo`)
- **Phase 2**: 全シークレットをローテーション（対話式ガイド）
- **Phase 3**: terraform apply + 動作確認の手順案内
- **Phase 4**: .gitignore に機密ファイルが含まれているか自動チェック

### 5b. Git filter-repo 実行後の注意

`git filter-repo` 実行後は:
1. **全てのコミットハッシュが変わります**
2. **originリモートが削除されます** → スクリプト内で再追加
3. **`--force --all` でpushが必要です**

```bash
# filter-repo後（スクリプトが案内します）
git push origin --force --all
git push origin --force --tags
```

### 5c. シークレットローテーション後の terraform apply

全シークレットを terraform.tfvars に反映後:

```bash
cd ~/Downloads/vow/infra/terraform
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

### 5d. ローテーション対象一覧

| # | シークレット | 更新先 | 影響 |
|---|------------|--------|------|
| 1 | GitHub PAT | terraform.tfvars | Amplifyビルド |
| 2 | Supabase anon_key + service_role_key | terraform.tfvars + Amplify | 全API、フロントエンド認証 |
| 3 | Stripe secret_key + webhook_secret | terraform.tfvars | 決済機能 |
| 4 | Slack client_secret + signing_secret | terraform.tfvars | Slack連携 |
| 5 | OpenAI API key | terraform.tfvars | AIコーチ |
| 6 | JWT Secret | terraform.tfvars | **全ユーザーセッション無効化** |
| 7 | Fernet Token Encryption Key | terraform.tfvars | **既存Slackトークン復号不可 → 再連携必要** |
| 8 | Credentials Encryption Key | terraform.tfvars | **DynamoDB暗号化データ復号不可** |

---

## Step 6: 最終検証

全ステップ完了後、以下を確認してください。

### API ヘルスチェック
```bash
curl -s https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/production/health | jq .
```

### フロントエンド動作確認
- [ ] https://main.do1k9oyyorn24.amplifyapp.com/dashboard にアクセス可能
- [ ] ログイン/ログアウトが正常動作
- [ ] 習慣・目標の表示/編集が正常
- [ ] Slack連携が動作（ローテーション後は再連携が必要）
- [ ] AIコーチが応答する

### WAF確認
```bash
# WAFメトリクスの確認（適用後しばらくしてから）
aws wafv2 get-sampled-requests \
  --web-acl-arn $(aws wafv2 list-web-acls --scope REGIONAL --region ap-northeast-1 \
    --query 'WebACLs[?Name==`vow-production-api-waf`].ARN' --output text) \
  --rule-metric-name rate-limit \
  --scope REGIONAL \
  --time-window StartTime=$(date -d '1 hour ago' +%s),EndTime=$(date +%s) \
  --max-items 5 \
  --region ap-northeast-1
```

### RLS確認
Supabase SQL Editorで:
```sql
-- ユーザーAがユーザーBのapi_keyを見えないことを確認
-- (テスト用に異なるJWTでリクエスト)
SELECT count(*) FROM api_keys;  -- 自分のキーのみ返るはず
```

### Git履歴確認
```bash
# 機密ファイルが履歴に残っていないこと
git log --all --full-history -- infra/terraform/terraform.development.tfvars
# → 結果が空であること

git log --all --full-history -- infra/terraform/terraform.tfvars
# → 結果が空であること
```

---

## トラブルシューティング

### terraform init -migrate-state が失敗する
```bash
# S3バケットへのアクセス権を確認
aws s3 ls s3://vow-terraform-state-257784614320/
# Access Denied → IAMポリシーを確認

# DynamoDBテーブルの存在確認
aws dynamodb describe-table --table-name vow-terraform-locks --region ap-northeast-1
```

### RLS適用後にフロントエンドでエラーが出る
```bash
# Supabase SQL Editorでポリシーを確認
SELECT tablename, policyname, qual FROM pg_policies
WHERE tablename IN ('api_keys', 'rate_limits', 'goals')
ORDER BY tablename, policyname;
```

### WAF適用後にAPIがブロックされる
```bash
# WAFのログを確認
aws wafv2 get-logging-configuration \
  --resource-arn <WAF_ACL_ARN> \
  --region ap-northeast-1

# 一時的にWAFを無効化する場合
# terraform.tfvarsで lambda_nodejs_s3_bucket = "" に設定して terraform apply
# ※ これによりWAF関連リソースが全て削除されます
```

### terraform apply後にLambdaが起動しない
```bash
# Lambda設定を確認
aws lambda get-function-configuration \
  --function-name vow-production-hono-api \
  --region ap-northeast-1

# CloudWatchログを確認
aws logs tail /aws/lambda/vow-production-hono-api \
  --since 10m --region ap-northeast-1
```

---

## 変更されたファイル一覧

### Commit 1: `5aff3e98` (コード修正 — 10件)
| ファイル | 変更内容 |
|---------|----------|
| frontend/app/dashboard/components/Widget.MermaidPreview.tsx | Mermaid securityLevel: strict |
| frontend/app/dashboard/components/Section.MOC.tsx | innerHTML → textContent |
| frontend/app/dashboard/hooks/useMcpChat.ts | debug: false 固定 |
| frontend/app/dashboard/utils/markdownRenderer.ts | rehype-sanitize 追加 |
| backend/src/services/mcpService.ts | MCP認証 + トークンheader化 |
| backend/src/routers/slack.ts | Slack署名検証順序修正 |
| backend/src/middleware/auth.ts | JWT default secret 除去 + timing-safe比較 |
| backend/src/routers/agents.ts | dangerouslySkipPermissions admin制限 |
| infra/terraform/amplify.tf | セキュリティヘッダー追加 |

### Commit 2: `8942019c` (インフラ基盤 — 5件)
| ファイル | 変更内容 |
|---------|----------|
| supabase/migrations/20260215000000_fix_rls_security.sql | RLS脆弱性修正 |
| infra/terraform/waf.tf | WAFv2 + API Gatewayスロットリング |
| infra/terraform/secrets.tf | Secrets Manager設定 |
| infra/terraform/versions.tf | S3バックエンド有効化 |
| scripts/security/secrets-rotation-runbook.sh | ローテーション手順書 |
