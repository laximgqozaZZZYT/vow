# infra (CloudFormation)

VOWを**案A**（Static Frontend + Serverless API + Aurora）でAWSへ載せるためのCloudFormationテンプレ一式です。

- Frontend: **S3 + CloudFront**（Next.jsを静的出力して配信）
- Backend API: **ECS(Fargate) + ALB**（CloudFront配下 `/api/*` で同一ドメイン運用）
- DB: **Aurora MySQL (serverless instance class) + Secrets Manager**

また、DBマイグレーション用に **migrate専用Lambda** を常に作成します（推奨運用: 手動Invoke）。

> メモ: `infra/template.yaml` は通常のYAMLで、`!Ref`/`!Sub` 等のCloudFormation拡張タグを使います。
> VS CodeのYAML拡張や静的lintによっては「Unresolved tag」表示になりますが、CloudFormationとしては正常です。

## 生成される主なリソース
- VPC（private subnets + NAT）
- Aurora MySQL cluster / instance
- Secrets Manager（DBユーザー/パスワード）
- ALB + ECS(Fargate)（Express API）
- S3 バケット（フロント配信）
- CloudFront distribution
- migrate Lambda（`prisma migrate deploy` をVPC内から実行）

## 値として必要なもの
- DB master password（Parameters: `DbMasterPassword`）
- 本番CORS Origin（Parameters: `AllowedCorsOrigin`）
  - まずは `*` で動作確認し、運用では CloudFront ドメイン/独自ドメインに絞るのを推奨
- Supabase JWT検証（任意）
  - `SupabaseJwksUrl` / `SupabaseJwtAud` / `SupabaseJwtIss`

## デプロイの流れ（概要）
1. スタック作成: `infra/template.yaml` をCloudFormationに投入
2. backendをビルドしてECRへpushし、Parameters `ApiEcrImageUri` を更新
3. （スキーマ更新がある場合）migrate Lambda を手動Invoke
4. frontendをビルド（静的出力）してS3へ同期
5. 必要なら CloudFront invalidation

詳細手順は `docs/aws-migration.md` にまとめます。
