# セキュリティ監査 — 手動修正手順書

**作成日**: 2026-02-11
**対象**: VOWプロジェクト AWS本番/開発環境

## 概要

セキュリティ監査で発見された脆弱性のうち、自動修正が完了した7件に加えて、
手動対応が必要な5件をこのドキュメントにまとめます。

### 自動修正済み（参考）

| # | 修正内容 | 重要度 | ファイル |
|---|---------|--------|---------|
| 1 | Slackトークンプレフィックスのログ出力削除 | CRITICAL | `backend/src/routers/slackOAuth.ts` |
| 2 | Stripe APIバージョン環境変数化 | CRITICAL | `backend/src/middleware/stripeWebhook.ts` |
| 3 | .env.local OIDCトークン削除 | CRITICAL | `frontend/.env.local` |
| 4 | redirect_uri検証強化 + ホワイトリスト | HIGH | `backend/src/routers/slackOAuth.ts` |
| 5 | Rate limiter fail-closed化 | HIGH | `backend/src/middleware/rateLimiter.ts` |
| 6 | middleware.ts HTMLエスケープ追加 | HIGH | `frontend/middleware.ts` |
| 7 | npm audit 全脆弱性修正 | HIGH | `frontend/package.json` |

---

## 手動対応 1: S3 MFA Delete 有効化（Terraform Stateバケット）

**重要度**: MEDIUM
**理由**: MFA Deleteを有効にすると、S3オブジェクトの削除にMFA認証が必要になり、誤削除や不正削除を防止できます。Terraformステートファイルは特に重要な資産です。
**制約**: AWSルートアカウントでのみ設定可能。Terraform/IAMユーザーでは不可。

### 手順

```bash
# 1. AWSアカウントIDを確認
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account ID: $ACCOUNT_ID"

# 2. バケット名を確認
BUCKET_NAME="vow-terraform-state-${ACCOUNT_ID}"
echo "Bucket: $BUCKET_NAME"

# 3. 現在のバージョニング設定を確認
aws s3api get-bucket-versioning --bucket "$BUCKET_NAME"
# 期待される出力: {"Status": "Enabled"}

# 4. ルートアカウントの認証情報でAWS CLIを設定
#    - AWSマネジメントコンソールにルートアカウントでログイン
#    - IAM > セキュリティ認証情報 > アクセスキー で一時的なキーを作成
#    - または AWS CloudShell を使用

# 5. MFA Delete を有効化
#    MFA_SERIAL: ルートアカウントのMFAデバイスARN
#    TOTP_CODE: MFAデバイスに表示されている6桁コード
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "arn:aws:iam::${ACCOUNT_ID}:mfa/root-account-mfa-device TOTP_CODE"

# 6. 設定を確認
aws s3api get-bucket-versioning --bucket "$BUCKET_NAME"
# 期待される出力: {"Status": "Enabled", "MFADelete": "Enabled"}

# 7. ルートアカウントのアクセスキーを無効化/削除（重要！）
```

### 注意事項
- ルートアカウントのアクセスキーは作業後に**必ず削除**してください
- MFA Deleteを有効にした後、バージョニングの無効化にもMFAが必要になります
- Terraformでは `mfa_delete` の状態を管理できないため、設定後は手動管理となります

---

## 手動対応 2: S3 MFA Delete 有効化（CloudTrail Logsバケット）

**重要度**: MEDIUM
**理由**: CloudTrailログは監査証跡であり、改ざん・削除防止が重要です。
**制約**: 上記と同様、ルートアカウントでのみ設定可能。

### 手順

```bash
# 1. バケット名を確認（環境変数に依存）
#    パターン: vow-{environment}-cloudtrail-logs-{ACCOUNT_ID}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="vow-development-cloudtrail-logs-${ACCOUNT_ID}"
echo "Bucket: $BUCKET_NAME"

# 2. 現在の設定を確認
aws s3api get-bucket-versioning --bucket "$BUCKET_NAME"

# 3. MFA Delete を有効化（ルートアカウントで実行）
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "arn:aws:iam::${ACCOUNT_ID}:mfa/root-account-mfa-device TOTP_CODE"

# 4. 確認
aws s3api get-bucket-versioning --bucket "$BUCKET_NAME"
```

### 本番環境の場合
```bash
# 本番バケット名が異なる場合は environment を置換
BUCKET_NAME="vow-production-cloudtrail-logs-${ACCOUNT_ID}"
```

---

## 手動対応 3: DMS supabase_ip_ranges 設定

**重要度**: HIGH
**現状**: **対応不要** — `enable_dms = false` (デフォルト) のためDMSリソースは未作成。
DMS を有効化する際に以下の手順で設定すること。
**前提**: DMS機能が有効（`enable_dms = true`）の場合のみ該当。

### 手順

```bash
# 1. Supabase Pooler ホストのIPを確認
#    <project-ref> は Supabase プロジェクトのリファレンスID
nslookup jamiyzsyclvlvstmeeir.pooler.supabase.com

# 出力例:
# Name:    jamiyzsyclvlvstmeeir.pooler.supabase.com
# Address: 13.210.xxx.xxx

# 2. 解決されたIPアドレスをメモ（複数の場合もあり）
SUPABASE_IP="13.210.xxx.xxx"

# 3. terraform.tfvars を編集
#    ファイル: infra/terraform/terraform.tfvars
```

`infra/terraform/terraform.tfvars` に以下を追加:

```hcl
# Supabase Pooler IP ranges（DMS Security Group egress制限用）
# nslookup jamiyzsyclvlvstmeeir.pooler.supabase.com の結果を設定
supabase_ip_ranges = ["13.210.xxx.xxx/32"]

# 複数IPの場合:
# supabase_ip_ranges = ["13.210.xxx.xxx/32", "13.210.yyy.yyy/32"]
```

```bash
# 4. Terraform plan で確認
cd infra/terraform
terraform plan -var-file=terraform.tfvars

# 5. 変更内容を確認後、apply
terraform apply -var-file=terraform.tfvars
```

### 注意事項
- Supabase Pooler のIPは変更される可能性があります（プロジェクト移行時など）
- DMS接続エラーが発生した場合は、IPが変更されていないか確認してください
- `enable_dms = false` の場合、このリソースは作成されないため対応不要です

---

## 手動対応 4: SSE トークン in URL の緩和

**重要度**: HIGH
**理由**: EventSource APIの仕様制限により、認証トークンをURLクエリパラメータで送信しています。これによりサーバーログ、ブラウザ履歴、Refererヘッダーにトークンが漏洩するリスクがあります。
**制約**: EventSource APIの根本的な制限のため、アーキテクチャ変更が必要。

### 現状

```
frontend/app/dashboard/hooks/useUnifiedSSE.ts (L441-446)
```

```typescript
// 現在の実装: authTokenをURLクエリパラメータとして付加
if (authToken) {
  const urlObj = new URL(url, window.location.origin);
  urlObj.searchParams.set('token', authToken);
  finalUrl = urlObj.toString();
}
```

### 緩和策の選択肢

#### Option A: WebSocket への移行（推奨・根本解決）

WebSocketはハンドシェイク時にカスタムヘッダーを送信できるため、Authorizationヘッダーでトークンを送信可能。

**メリット**: トークンがURLに露出しない、双方向通信可能
**デメリット**: バックエンド（Lambda）側の大幅改修が必要、API Gatewayの WebSocket API設定が必要

```
実装工数: 大（2-3日）
関連ファイル:
  - frontend/app/dashboard/hooks/useUnifiedSSE.ts
  - backend/src/routers/ (新規WebSocketハンドラ)
  - infra/terraform/ (API Gateway WebSocket API)
```

#### Option B: fetch + ReadableStream（中間策）

POST リクエストでストリーミングを行い、Authorizationヘッダーで認証。

**メリット**: バックエンド変更が少ない、`useUnifiedSSE`に`startFetchStream`が既に実装済み
**デメリット**: 自動再接続を自前実装する必要がある

```typescript
// 既に useUnifiedSSE.ts に startFetchStream メソッドが存在 (L594-716)
// EventSource使用箇所をfetch + ReadableStreamに置き換える
```

#### Option C: 短命トークンの導入（緩和策）

URLに含めるトークンを短命（30秒）にし、漏洩リスクを軽減。

**メリット**: 変更が最小限
**デメリット**: 根本解決ではない。トークンリフレッシュのロジック追加が必要

### 推奨

**短期**: Option C（短命トークン）で漏洩リスクを軽減
**中期**: Option B（fetch + ReadableStream）で段階的に移行
**長期**: Option A（WebSocket）で根本解決

---

## ~~手動対応 5: トークン利用カウンターの Race Condition 修正~~ (修正済み)

**重要度**: MEDIUM
**現状**: **修正完了**
- Supabase: `increment_used_quota()` 関数を作成（アトミックなインクリメント）
- Backend: `tokenRepository.ts` の `incrementUsedQuota()` を RPC 呼び出しに変更
- 旧コード: read-then-write パターン（SELECT → アプリ側加算 → UPDATE）で Lost Update の可能性
- 新コード: `UPDATE token_quotas SET used_quota = used_quota + $amount` で PostgreSQL が行ロックを自動取得

---

## 付録: 監査で検出された MEDIUM/LOW 項目（参考）

優先度は低いですが、将来的に対応を検討すべき項目です。

### MEDIUM

| # | 項目 | 詳細 |
|---|------|------|
| 1 | CloudTrail マルチリージョン | `is_multi_region_trail = false` → `true` に変更推奨 |
| 2 | S3 Access Logging | `enable_s3_access_logging = true` (デフォルト有効化済み) → terraform apply必要 |
| 3 | DMS HTTPS egress制限 | 0.0.0.0/0 → VPC Endpoint経由に変更推奨 |
| 4 | API Gateway WAF | WAF定義済み → terraform apply必要 |

### LOW

| # | 項目 | 詳細 |
|---|------|------|
| 1 | Cognito MFA | `mfa_configuration = "OPTIONAL"` → ユーザー自身が有効化する必要あり |
| 2 | Lambda Reserved Concurrency | デフォルト100に設定済み |
| 3 | DynamoDB暗号化 | server_side_encryption有効 |
| 4 | CloudTrail ログ検証 | `enable_log_file_validation = true` 設定済み |
