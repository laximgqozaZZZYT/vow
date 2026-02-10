# VOW Infrastructure Audit Report

**Date**: 2026-02-10
**Scope**: Terraform definitions vs AWS actual resources

## 1. 監査の経緯

### セキュリティ監査
2026-02-10にVOWプロジェクト全体のセキュリティ監査を実施。
4つの並列エージェントで以下を調査:
- Track A: シークレット・認証情報スキャン
- Track B: フロントエンドセキュリティ（XSS, innerHTML, debug flags）
- Track C: バックエンドAPIセキュリティ（認証, 入力検証, MCP）
- Track D: インフラ・IAM監査（Terraform, RLS, WAF）

### 発見された脆弱性（修正済み）
1. Mermaid XSS脆弱性 — securityLevel: strict に変更
2. innerHTML使用 — textContent に変更
3. MCP debug: true — false に固定
4. Markdownサニタイズ不足 — rehype-sanitize 追加
5. MCP認証不足 — トークンベース認証追加
6. Slack署名検証の順序問題 — 修正
7. JWT default secret — 除去 + timing-safe比較
8. dangerouslySkipPermissions — admin制限追加
9. Amplifyセキュリティヘッダー不足 — HSTS等追加
10. Supabase RLS USING(true) — 適切なポリシーに修正

### インフラ基盤追加（未適用）
1. WAFv2 Web ACL (4ルール: rate-limit, common, bad-inputs, sqli)
2. Secrets Manager (9シークレット一元管理)
3. Terraform S3 Backend (ステート管理のリモート化)
4. RLSマイグレーション (api_keys, rate_limits, 9テーブル)
5. シークレットローテーション手順書

## 2. リソース3方向比較

### 凡例
- TF定義: Terraform .tfファイルに定義あり
- TFステート: terraform.tfstateに管理対象として存在
- AWS実環境: AWSに実際に存在

| カテゴリ | TF定義 | TFステート | AWS実環境 | 備考 |
|---------|--------|-----------|-----------|------|
| Lambda (production) | api[0] | あり | vow-production-api | 正常 |
| Lambda (development) | api[0] | なし | vow-development-api | TF管理外 |
| Lambda (hono) | hono_api[0] | なし | 存在しない | 未デプロイ |
| API GW REST (prod) | main[0] | あり | cy20h2nht8 | 正常 |
| API GW REST (dev) | main[0] | なし | lyry9riumg | TF管理外 |
| API GW HTTP v2 | なし | なし | 2oumxeqxq1 (CDK) | CDK管理 |
| Amplify | frontend[0] | なし | do1k9oyyorn24 | ステート未反映 |
| Cognito (prod) | main | あり | ap-northeast-1_4geU2CR4i | 正常 |
| Cognito (dev) | なし | なし | ap-northeast-1_69kS6Me8O | TF管理外 |
| VPC (prod) | main | あり | vpc-02235966f4c795af4 | 正常 |
| VPC (dev) | なし | なし | vpc-01a96e246176dfa3a (CFn) | CFn管理 |
| NAT GW (prod) | main | あり | nat-021d23b5bfa4b2cd4 | $32.40/月 |
| NAT GW (dev) | なし | なし | nat-03e1c4cc94c765236 (CFn) | $32.40/月 |
| Aurora | aurora[0] | あり(stale!) | 存在しない | 要state rm |
| DynamoDB 3テーブル | 3定義 | なし | 3テーブル存在 | ステート未反映 |
| EventBridge Scheduler | 3定義 | なし | 3スケジュール稼働 | ステート未反映 |
| SNS | alerts[0] | なし | vow-production-alerts | ステート未反映 |
| CloudWatch Alarms | 4定義 | なし | 2アラーム | 部分反映 |
| WAF | api[0] (新規) | なし | なし | 未apply |
| Secrets Manager | lambda_secrets[0] (新規) | なし | なし | 未apply |
| S3 (state bucket) | terraform_state | なし | vow-terraform-state-257784614320 | ステート未反映 |
| S3 (deploy bucket) | なし | なし | vow-lambda-deployments | 手動作成 |
| S3 (CDK残骸) | なし | なし | vow-prod-lambdaartifactbucket-* x9 | 要削除検討 |
| OIDC Provider | なし | なし | token.actions.githubusercontent.com | 手動作成 |
| CloudFormation | なし | なし | 3スタック稼働 | CDK管理 |

## 3. 重大な問題点

### Critical
1. **GitHub Actionsデプロイが壊れている**: deploy-lambda-prod.yml が `vow-production-hono-api` を参照（存在しない）→ 修正済み
2. **TFステートにAurora残骸**: 実体のないAuroraリソースがステートに存在 → state rm実施済み
3. **WAF/SecretsのTF条件ミスマッチ**: lambda_nodejs_s3_bucket条件 → lambda_s3_bucket条件に修正済み

### High
4. NAT Gateway x2が$65/月のコスト（Aurora不使用）
5. 開発環境がTerraform管理外
6. DynamoDB/EventBridge/SNSがステート未反映

### Medium
7. CDKスタック(VowBackendTsStack)の扱い未決定
8. CDK残骸S3バケット(9個)の削除
9. OIDC/デプロイロールのTerraform化

## 4. CloudFormationスタック一覧

| スタック名 | 状態 | 管理リソース |
|-----------|------|------------|
| VowBackendTsStack | CREATE_COMPLETE | Lambda(vow-backend-ts), HTTP API v2, EventBridge Rules x3 |
| vow-development-network | CREATE_COMPLETE | VPC, Subnets, NAT GW, Security Groups (開発環境全体) |
| VowDevStack | CREATE_COMPLETE | Amplify App(d1zmna50iwo9dv, 削除済み), IAM Role |

## 5. 推奨アクション

### 即時（実施済み）
- [x] deploy-lambda-prod.yml の Lambda名修正
- [x] Terraform state から stale Aurora除去
- [x] WAF/Secrets Manager の条件修正

### 短期
- [ ] terraform init -migrate-state (S3バックエンド移行)
- [ ] terraform apply (WAF + Secrets Manager適用)
- [ ] Supabase RLSマイグレーション適用
- [ ] NAT Gateway削除検討（コスト$780/年削減）

### 中期
- [ ] 開発環境のTerraform workspace統合
- [ ] DynamoDB/EventBridge/SNSのterraform import
- [ ] CDKスタックの扱い決定
- [ ] OIDC/デプロイロールのTerraform化
- [ ] 不要S3バケット削除

## 6. コスト分析

| リソース | 月額 | 年額 | 必要性 |
|---------|------|------|--------|
| NAT Gateway (prod) | $32.40 | $389 | Aurora不使用なら不要 |
| NAT Gateway (dev) | $32.40 | $389 | Aurora不使用なら不要 |
| Lambda x2 | ~$5 | ~$60 | 必要 |
| API Gateway x2 | ~$3 | ~$36 | 必要 |
| DynamoDB x3 | ~$1 | ~$12 | 必要 |
| **合計** | **~$74** | **~$886** | |
| **最適化後** | **~$9** | **~$108** | NAT GW削除時 |
