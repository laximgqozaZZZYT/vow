# AWS移行（案A: S3+CloudFront + API + Aurora）

このドキュメントは、このリポジトリの現状（Next.js + Express + Prisma + MySQL + Supabase JWT + guest cookie）を
**AWSのサーバレス構成**へ移行する手順と注意点をまとめたものです。

## ゴール
- Frontend: 静的配信（S3 + CloudFront）
- Backend API: **ECS(Fargate) + ALB**（※Lambda運用から切替）
- DB: Aurora MySQL（serverless instance class）
- シークレット: Secrets Manager
- IaC: CloudFormation（`infra/template.yaml`）

## コストを抑える前提
- ALB/ECSは最小構成（DesiredCount=1）
- WAFやNLBなどは入れない（必要になったら後付け）
- CloudFrontは既存Distributionを拡張して、追加のCDNは作らない

## 前提（コードから確認できる点）
- Frontendの主要ページは `"use client"` が多く、SSR必須の実装は見当たりません。
- API呼び出しは `frontend/lib/api.ts` の `fetch(..., credentials: 'include')` を使用。
  - session cookie（`vow_session`）が必要なので、APIは **CORS with credentials** が必須です。

## CloudFormationで作るもの
`infra/template.yaml`
- VPC（private subnet + NAT: LambdaからSupabase JWKS取得などのため）
- Aurora MySQL cluster/instance
- Secrets Manager（DBのusername/password）
- API: **ALB + ECS(Fargate)**（コンテナでExpressを起動）
- S3 + CloudFront（静的オリジン、OAIで非公開化）

## ビルド/デプロイ手順（最小）

このプロジェクトのAWS更新は、基本的に以下の順で進めると迷いません。

- API（ECS）: **ECRへpush → CloudFormationの `ApiEcrImageUri` 更新**
- DB schema（Prisma migrate）: **migrate専用Lambdaを手動Invoke**（A運用）
- Frontend（静的）: **export → S3 sync → CloudFront invalidation**

AWS CLI のコマンド単位での手順（ランブック）は `docs/aws-userguide.md` に切り出しました。

- `docs/aws-userguide.md`（コピペ用: ECR / CloudFormation / migrate / S3 sync / invalidation まで）


### 0) 事前に決めておく値

- `ProjectName` / `Stage`（例: `vow` / `prod`）
- デプロイ先リージョン（例: `ap-northeast-1`）
- ECRリポジトリ名（例: `vow-api`）
- migrate zipを置くS3バケット（後述: `LambdaCodeS3Bucket`）

### 1) CloudFormationスタック作成（初回）

初回はスタックを作り、Outputs を控えます。

- `infra/template.yaml` をアップロードしてスタック作成
- 主なParameters
  - `DbMasterPassword`: 必須
  - `AllowedCorsOrigin`: ひとまず `*` でも可、運用ではCloudFront/独自ドメインに絞る
  - `ApiRuntime`: `ecs`
  - `ApiEcrImageUri`: ECRのイメージURI（例: `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/vow-api:20260103`）
  - `ApiAlbCertificateArn`: (任意) ALB用のACM証明書ARN（同一リージョン）

スタック作成後、Outputs から以下を取得
- `CloudFrontDomainName`
- `ApiCloudFrontBaseUrl`（フロントが参照するAPIベース。推奨）
- `FrontendBucketName`
- `MigrateFunctionName`

### 2) backend(ECS)のビルドとECR push

ECSでは **backendをコンテナ化**してECRへpushし、CloudFormationの `ApiEcrImageUri` を更新します。

以降の詳細はこの後の「### backend(ECS)のビルドとECR push（詳細）」を参照してください。

### 3) CloudFormation更新（ApiEcrImageUri）

ECRへpushしたイメージURIで、CloudFormation Parameters を更新します。

- `ApiRuntime=ecs`
- `ApiEcrImageUri=<your ECR image uri>`

これでALB配下のECSサービスが新イメージへ差し替わります。

### 4) Prisma migrate（推奨: migrate専用Lambdaを手動Invoke）

**DBスキーマ更新があるリリース**のときだけ実施します（初回デプロイ時も1回は必要です）。

#### 4-1) migrate zipを作る（ローカル/CI）

このリポジトリには、migrate用zipを作る補助スクリプトがあります。
（`ApiRuntime=ecs` でも migrate は Lambda を使うため、zipが必要です）

```bash
cd backend

# 依存を入れる
npm ci

# Lambda用にエントリをバンドル
npm run build:bundle

# zipサイズを抑えるため production依存だけにする
npm prune --omit=dev

# API用 / migrate用 のartifactフォルダを作る
npm run build:artifacts

# migrate zipを作る
rm -f lambda-migrate.zip
(cd .lambda-artifact-migrate && zip -qr ../lambda-migrate.zip .)
```

> 注: `lambda-migrate.zip` には prisma CLI が必要なため、`node_modules/` を含みます。
> （より小さくしたい場合は将来 Layer 化などを検討できます）

#### 4-2) S3へアップロード

```bash
AWS_REGION=<your-region>
LAMBDA_ARTIFACT_BUCKET=<your-bucket>
MIGRATE_KEY=vow/artifacts/lambda-migrate-20260103.zip

aws s3 cp backend/lambda-migrate.zip "s3://$LAMBDA_ARTIFACT_BUCKET/$MIGRATE_KEY" --region "$AWS_REGION"
```

#### 4-3) CloudFormation Parameters 更新（migrate zipの場所）

CloudFormationのParametersに以下を設定してスタック更新します。

- `LambdaCodeS3Bucket=$LAMBDA_ARTIFACT_BUCKET`
- `MigrateLambdaCodeS3Key=$MIGRATE_KEY`

これで migrate Lambda のCodeが差し替わります。

#### 4-4) migrate Lambda を手動Invoke

CloudFormation Output `MigrateFunctionName` を使って手動Invokeします。

```bash
aws lambda invoke \
  --function-name <MigrateFunctionName> \
  --payload '{}' \
  /tmp/migrate-result.json

cat /tmp/migrate-result.json
```

失敗時は CloudWatch Logs（`/aws/lambda/<project>-<stage>-migrate`）で詳細を確認してください。

> 注: migrate Lambda は、`LambdaCodeS3Bucket` / `MigrateLambdaCodeS3Key` が未設定でもスタック作成自体は可能ですが、
> その場合は stub が動き「Not deployed」と返します。

### 5) frontend の deploy（静的）

1) `NEXT_PUBLIC_API_URL` に **CloudFormation Output `ApiCloudFrontBaseUrl`** を設定
2) `next build` / `next export`（静的出力）
3) `FrontendBucketName` に `out/` をsync
4) CloudFront invalidation

> invalidationはHTML/JS/CSSの更新がある場合に必要になります（運用に合わせて最適化可能）。

## 環境変数の運用方針

- ローカル開発: **リポジトリ直下の `.env.local` を正**とする
  - `NEXT_PUBLIC_API_URL=http://localhost:4000`（frontend → backend）
  - backendのDB接続は `backend/.env`（Prisma / MySQL）
- AWS: `.env.aws.example` を雛形として **AWS向けのキーセットを別管理**する
  - backendの機密情報（DBパスワード等）は **Secrets Manager / CloudFormation Parameters** を推奨
  - frontendは静的ビルド時に `NEXT_PUBLIC_*` を注入（CI/CDで設定）

### 重要: Output/Parameterの対応（migrate）

- Output: `MigrateFunctionName`
  - 手動InvokeするときのLambda関数名
- Parameters: `LambdaCodeS3Bucket`, `MigrateLambdaCodeS3Key`
  - migrate Lambda のzip配置場所

### 重要: CloudFront配下にAPIを同居させる（/api/*）

`infra/template.yaml` は CloudFront Distribution に **ALBを追加オリジン**として登録し、
`/api/*` をALBへ転送するようにしてあります。

backendは ` /api ` プレフィックスでも同じAPIが動くよう対応しています。
例: `/health` と `/api/health` の両方が200を返します。

これにより、フロントとAPIが同一ドメインになるため
- CORSで悩みにくい
- cookie(session)運用が安定
というメリットがあります。

フロント側の `NEXT_PUBLIC_API_URL` には、以下のどちらかを設定してください。

- 推奨: CloudFrontを使う場合
  - CloudFormation Output `ApiCloudFrontBaseUrl`
- 代替: ALBへ直アクセス（検証用 / CORS調整が必要）
  - CloudFormation Output `ApiBaseUrl`

> 注: templateの `ApiBaseUrl` はALB DNSを返します。CloudFront経由を選ぶ場合は末尾に `/api` を付けます。

### HTTPS (ACM) について（低コスト優先）

証明書は無料ですが、**発行リージョン**に注意が必要です。

- CloudFrontで独自ドメインを使う証明書: **us-east-1** で発行
- ALBの443に付ける証明書: **スタックのリージョン** で発行

今回のテンプレは、ALBのHTTPSは「任意」にしてあります。

- `ApiAlbCertificateArn` を指定したときだけ ALB:443 を作成
- ALB:80 は 443 に301リダイレクト

コストを抑えつつまず動かすなら、
1) まず CloudFront はそのまま（デフォルトドメインでOK）
2) ALBもデフォルトDNSのまま（証明書は後回し）
3) 問題なければ後から独自ドメイン/ACMを入れる
が安全です。

### backend(ECS)のビルドとECR push（詳細）

ECSでは **backendをコンテナ化**してECRへpushし、CloudFormationの `ApiEcrImageUri` を更新します。

#### 2-1) ECRリポジトリ作成（初回のみ）

例: `vow-api`

```bash
aws ecr create-repository --repository-name vow-api
```

#### 2-2) ECRへログイン → build → push

```bash
AWS_REGION=<your-region>
AWS_ACCOUNT_ID=<your-account-id>

REPO=vow-api
TAG=20260103

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO:$TAG"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

cd backend
docker build -t vow-api:local -f Dockerfile .
docker tag vow-api:local "$ECR_URI"
docker push "$ECR_URI"
```

#### 2-3) CloudFormation Parameters更新

- `ApiRuntime=ecs`
- `ApiEcrImageUri=$ECR_URI`

これでALB配下のECSサービスが新イメージへ差し替わります。

> 注: `PUBLIC_BASE_URL` はテンプレ側でALB DNSを自動注入します。

## 将来のBlue/Greenデプロイについて（土台だけ先に用意）

将来的にダウンタイムを抑えてデプロイできるよう、`infra/template.yaml` には **Blue/Green切替の土台**を入れてあります。

- ALBのTargetGroupを2つ作成します
  - `ApiTargetGroupBlue`
  - `ApiTargetGroupGreen`
- どちらに流すかは CloudFormation Parameters の `ApiActiveColor` で切り替えます
  - `blue` (デフォルト)
  - `green`

また、もう一段“Blue/Greenらしく”するために、2つのECSサービスを同時に常駐させるモードも用意しています。

- `ApiEnableBlueGreen`
  - `false` (デフォルト): 低コスト優先。ECSサービスは1つだけ
  - `true`: Blue/Green用に **ECSサービスを2つ（blue/green）同時に作成**
    - `ApiEcsServiceBlue`（TargetGroupBlueへ登録）
    - `ApiEcsServiceGreen`（TargetGroupGreenへ登録）
    - 初期状態では green は `DesiredCount=0` で待機します

### いま出来ること / 出来ないこと

- ✅ “入口の切替” はできます（ALB Listener の forward先を Blue/Green で切り替え）
- ⚠️ “自動で入替・ロールバック” (AWS CodeDeploy の ECS Blue/Green) はまだいれていません
  - コスト/複雑性を上げずに土台だけ先に置くためです

### 手動での切替手順（概略）

#### A) 低コスト運用（デフォルト: `ApiEnableBlueGreen=false`）

1) **新しいイメージをデプロイしたい色**をアクティブにします
  - `ApiActiveColor=green` に変更してスタック更新
  - （この構成ではECSサービスが1つなので、実質は “切替” = “紐づけTargetGroupの変更” になります）

2) `ApiEcrImageUri` を更新してスタック更新

3) 疎通確認（/api/health など）

4) 問題があれば `ApiActiveColor=blue` に戻してスタック更新

#### B) Blue/Green常駐運用（`ApiEnableBlueGreen=true`）

1) `ApiEnableBlueGreen=true` でスタック更新
  - blueサービスが稼働、greenサービスは `DesiredCount=0`

2) green側を起動
  - ECSサービス `ApiEcsServiceGreen` の DesiredCount を 1 に上げる（手動変更でもOK）
  - ここは将来的に「green専用のDesiredCount Parameter」を追加して自動化できます

3) 疎通確認
  - `https://<CloudFrontDomainName>/api/health`
  - 認証が絡む場合、`Authorization`(Supabase JWT) と `vow_session` cookie がCloudFront→ALBへ転送される前提です

4) **入口を切替**
  - `ApiActiveColor=green` に変更してスタック更新
  - 現状はALB Listenerが ForwardConfig（weight）で 100/0 を切り替えるので、切替が明確です

5) ロールバック
  - `ApiActiveColor=blue` に戻すだけで即戻せます

2) 疎通確認（/api/health など）
  - CloudFront経由の `https://<CloudFrontDomainName>/api/health` でOK
  - 認証が絡む場合、`Authorization`(Supabase JWT) と `vow_session` cookie がCloudFront→ALBへ転送される前提です

3) **入口を切替**
  - `ApiActiveColor=green` に変更してスタック更新

4) 問題があれば即戻す
  - `ApiActiveColor=blue` に戻してスタック更新

> 注: “段階移行（10%→50%→100%）”は、ForwardConfigのWeightをParameter化すれば拡張できます。
> さらに本格的にやる場合は CodeDeploy(ECS Blue/Green) を使うのが王道です。

### （参考）backend(Lambda)のビルド

`ApiRuntime=lambda` を選ぶ場合は引き続きzipデプロイ方式も使えます。
（ただし現在はECSに切替済みのため、通常は不要です）

Lambda zip の作り方（例）

```bash
cd backend
npm ci

# (推奨) esbuildでlambda/migrateをバンドル（node_modulesを丸ごと含めない前提）
npm run build:bundle

# production依存だけに絞る（zipサイズ削減）
npm prune --omit=dev

# zip化（API用とmigrate用で分離）
rm -f lambda-api.zip lambda-migrate.zip

mkdir -p .lambda-artifact-api .lambda-artifact-migrate
rm -rf .lambda-artifact-api/* .lambda-artifact-migrate/*

# API artifact
cp -R dist-bundle .lambda-artifact-api/dist
cp package.json .lambda-artifact-api/
cp -R node_modules .lambda-artifact-api/node_modules
(cd .lambda-artifact-api && zip -qr ../lambda-api.zip .)

# migrate artifact
cp -R dist-bundle .lambda-artifact-migrate/dist
cp -R prisma .lambda-artifact-migrate/prisma
cp package.json .lambda-artifact-migrate/
cp -R node_modules .lambda-artifact-migrate/node_modules
(cd .lambda-artifact-migrate && zip -qr ../lambda-migrate.zip .)
```

S3へ配置したら、CloudFormationのParametersで
`LambdaCodeS3Bucket` / `ApiLambdaCodeS3Key` / `MigrateLambdaCodeS3Key` を更新してください。

> 注: 現状は `node_modules` を丸ごと入れる形です。
> さらに小さくしたい場合は、API zipから `prisma` CLIを除外（= migrate zipにだけ含める）や
> Prisma関連をLambda Layer化するのが次の改善候補です。

### 3) frontendのビルドとS3同期

#### 3-1) `NEXT_PUBLIC_API_URL` を注入してビルド

- `NEXT_PUBLIC_API_URL` は **ビルド時に埋め込まれる**ため、必ず本番API URLにしてからビルドします。
  - 値: CloudFormation Output `ApiBaseUrl`

例（CI/CDやローカルで一時的に設定する場合）

```bash
cd frontend
export NEXT_PUBLIC_API_URL="https://<api-id>.execute-api.<region>.amazonaws.com"
npm ci
npm run build
```

`next.config.ts` はすでに `output: 'export'` を設定済みなので、ビルド後に `frontend/out/` が生成されます。

#### 3-2) `out/` をS3へ同期

CloudFormation Output `FrontendBucketName` を使って同期します。

```bash
aws s3 sync frontend/out s3://<FrontendBucketName>/ --delete
```

#### 3-3) CloudFrontキャッシュ無効化（更新が反映されない場合）

初回以外はキャッシュが残ることがあるので、更新時はInvalidationします。

```bash
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths '/*'
```

> DistributionId はコンソールから確認するか、必要ならCloudFormation Outputsに追加してください。

### 4) CORS/Cookieの注意
- フロントは `credentials: 'include'` を使うため
  - API Gateway側は `Access-Control-Allow-Credentials: true`
  - `Access-Control-Allow-Origin` は `*` ではなく **厳密なOrigin** が望ましい
- backend側のcookie
  - 本番はHTTPS前提なので `secure: true` を推奨
    - このリポジトリでは `VOW_COOKIE_SECURE=true` で secure cookie を有効化できます

## CloudFront → ALB の転送を最小化する（推奨）

`/api/*` は認証cookie（`vow_session`）が必要なため、テンプレではCookieを転送しています。
APIのレスポンスは基本キャッシュしない（=CloudFrontは単なるリバプロとして使う）方針だと安全です。

現在のテンプレは `/api/*` に AWS managed の **CachingDisabled**（CloudFront Cache Policy）を適用し、
APIレスポンスをキャッシュしないようにしています。

より最適化する場合は、
- `/api/*` 用のCachePolicyを CachingDisabled にする
- Forwardするヘッダ/クッキーを必要最小限にする

といった調整が効果的です（必要になったらテンプレを更新します）。

## Prisma migrate 運用

本番は `prisma migrate deploy` を使います（shadow DBは不要）。

ECS運用でも、DBマイグレーションは「毎回のコンテナ起動時に自動実行」ではなく、
**明示的なワンショット実行**にするのが安全です（意図せず複数回走る、起動が遅い、失敗時にサービスが落ちる等を避けるため）。

### 推奨: migrate専用Lambdaを「手動Invoke」

サーバレス構成では「一度だけ実行するジョブ」が必要ですが、CloudFormationのカスタムリソースで自動実行すると
失敗時のリトライや更新タイミングで**意図せず複数回**走るリスクがあります。

そのため本リポジトリでは、

- **migrate専用Lambda**（VPC内からDBへ接続、Secrets ManagerでDB資格情報を取得）
- 必要なタイミングで **手動でInvoke**（CLI/Console）

という運用を推奨します。

安全性:
- `prisma migrate deploy` は適用済みのmigrationを再適用しないため冪等
- ただし「どの環境に対して実行しているか」を間違えないよう、Lambda環境変数とログで明確化します

#### CloudFormation

`infra/template.yaml` は migrate 専用Lambda（Output: `MigrateFunctionName`）を作成します。
Lambdaコードは API用zipとは別のmigrate用zipを参照します（Parameters: `LambdaCodeS3Bucket`, `MigrateLambdaCodeS3Key`）。

#### zipに含めるもの（重要）

migrate実行には少なくとも以下が必要です。

- `dist/`（`dist/migrate.js` が含まれること）
- `node_modules/`（prisma CLI と依存）
- `prisma/`（`schema.prisma` と `migrations/`）
- `package.json`（prismaが参照することがある）

#### 実行方法（例: AWS CLI）

```bash
aws lambda invoke \
  --function-name <MigrateFunctionName> \
  --payload '{}' \
  /tmp/migrate-result.json

cat /tmp/migrate-result.json
```

成功/失敗の詳細は CloudWatch Logs（`/aws/lambda/<project>-<stage>-migrate`）を確認してください。

#### 注意点

- 初回はDB作成直後なので時間がかかることがあります（Timeoutは300秒に設定）
- migrationが増えると実行時間も伸びます。必要ならTimeout/Memoryを増やしてください

## 追加でやると良いこと
- CloudWatch Logsの構造化（requestId等）
- DB接続数対策（RDS Proxy導入）
- WAF / Rate limit
- 独自ドメイン + ACM（CloudFront）
