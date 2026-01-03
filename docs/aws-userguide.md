# AWS User Guide（運用手順 / AWS CLI ランブック）

このドキュメントは、VOW を AWS へデプロイ・更新する際に、**AWS CLI のコマンド単位**で作業できるようにまとめたランブックです。

対象アーキテクチャ（現状）:
- Frontend: S3 + CloudFront（Next.js 静的出力）
- Backend API: ECS(Fargate) + ALB（CloudFront の `/api/*` で同一ドメイン運用）
- DB: Aurora MySQL + Secrets Manager
- DB migration: **migrate 専用 Lambda を手動 Invoke（A運用）**
- IaC: CloudFormation（`infra/template.yaml`）

関連ドキュメント:
- 設計と背景: `docs/aws-migration.md`

---

## AWS Web UIでの事前準備（最初に1回）

この章は、AWS CLI を叩く前に **AWSのWeb UI（マネジメントコンソール）で済ませておくべき準備**をまとめたものです。
特に SSO（IAM Identity Center）を使う場合、ここで得られる値（`sso_start_url`, `sso_region`）が `aws configure sso` に必要になります。

### 1) IAM Identity Center（SSO）を確認（SSOを使う場合）

1. AWS マネジメントコンソールにログイン
2. サービス検索で **IAM Identity Center**（旧: AWS SSO）を開く

#### 1-1) SSO のリージョン（= `sso_region`）を確認

IAM Identity Center は「有効化しているリージョン」で運用されます。

- IAM Identity Center 画面右上の **リージョン**表示を確認

例: `ap-northeast-1`

#### 1-2) AWS access portal URL（= `sso_start_url`）をコピー

IAM Identity Center の画面内に、以下の名前で表示されています。

- **AWS access portal URL**（または Access portal URL）

例: `https://d-xxxxxxxxxx.awsapps.com/start`

このURLが `aws configure sso` の **SSO start URL** に対応します。

#### 1-3) 自分（または所属グループ）が AWSアカウントへ割り当てられているか

IAM Identity Center で以下を確認します。

- **Users**（または **Groups**）に自分が存在する
- **AWS accounts** → 対象アカウント → **Assignments** で以下が割り当て済み
	- 自分（または所属グループ）
	- 利用する **Permission set**（例: AdministratorAccess / PowerUserAccess 等）

割り当てが無いと、SSOログインしても CLI から使えるロールが見つかりません。

### 2) （任意）ACM 証明書（HTTPS をやる場合）

最初はコスト優先で後回しでもOKです。

- **ALB の HTTPS(443)** を有効化する場合: **スタックと同一リージョン**で ACM 証明書を発行し、ARN を控える
	- CloudFormation Parameter: `ApiAlbCertificateArn`
- **CloudFront 独自ドメイン**を使う場合: 証明書は原則 **us-east-1** で発行（CloudFront の仕様）

### 3) （任意）ECR / CloudFormation / S3 の権限確認

CloudFormation を使うため、実行主体（SSOのPermission set または IAM User）には最低限以下の操作権限が必要です。

- CloudFormation（create/update/describe）
- ECR（create repo / push）
- ECS / ALB / VPC（テンプレが作成する範囲）
- S3 / CloudFront / Lambda / RDS / Secrets Manager / IAM / Logs

---

## AWS CLI ランブック（コマンド単位 / コピペ用）

この章は「AWSコンソールを極力使わずに、AWS CLIだけで初回デプロイ〜更新まで完走する」ための手順です。

### 事前準備: AWS CLI を利用できるようにする

このランブックは `aws` コマンドの実行を前提にしています。初めての環境では以下を先に済ませてください。

#### 1) AWS CLI v2 のインストール確認

```bash
aws --version
```

`aws-cli/2.x` が出ればOKです。

#### 2) 認証設定（Access Key 方式 or SSO 方式）

どちらか一方でOKです。

##### A. Access Key 方式（IAM User / CI など）

```bash
aws configure
```

入力項目の目安:
- `AWS Access Key ID` / `AWS Secret Access Key`
- `Default region name`: 例 `ap-northeast-1`
- `Default output format`: `json`

##### B. AWS SSO 方式（推奨: ローカル開発端末）

`aws configure sso` で聞かれる **SSO start URL / SSO region** は、
このドキュメントの「AWS Web UIでの事前準備」→「IAM Identity Center（SSO）を確認」で確認した値を入力してください。

```bash
aws configure sso
```

セットアップ後、以降のコマンドはプロファイル付きで実行できます。

```bash
export AWS_PROFILE=your-sso-profile

# ブラウザが開いてログインが完了すると、この端末からAWS APIを呼べるようになります
aws sso login
```

`aws configure sso` の最後に出る `Profile name [...]` が、ここで指定するプロファイル名です。

例:

```bash
export AWS_PROFILE=AdministratorAccess-257784614320
aws sso login
aws sts get-caller-identity
```

> 以降の例では `AWS_PROFILE` を設定していれば自動で使われます。

#### 3) 認証できているか確認（最重要）

```bash
aws sts get-caller-identity
```

ここで Account / Arn が表示されれば認証OKです。

SSOプロファイルを使う場合は、次のどちらかでOKです。

```bash
# 1) AWS_PROFILE を export 済み
aws sts get-caller-identity

# 2) 都度 --profile を付ける
aws sts get-caller-identity --profile AdministratorAccess-257784614320
```

#### 4) リージョンの扱い

このランブックでは明示的に `--region "$AWS_REGION"` を付ける箇所が多いです。
ただし、コマンドによっては `--region` を付けていないものもあるので、
事故防止のために環境変数としてもセットしておくのが安全です。

```bash
# NOTE: AWS_PROFILE を使っている場合は、先に `export AWS_PROFILE=...` を設定しておくこと。
# ワンライナー（aws configure の region を優先。未設定なら fallback）
export AWS_REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || true)}"; export AWS_REGION="${AWS_REGION:-ap-northeast-1}"
```

#### 4-1) Account ID を自動取得（推奨）

`AWS_ACCOUNT_ID` は手入力よりも STS から取得する方が安全です。

```bash
export AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
```

#### 4-2) 変数セットを楽にする（推奨）

このリポジトリには、`aws configure` / STS の情報を使って環境変数をセットする補助スクリプト `scripts/aws-env.sh` を用意しています。

```bash
# SSO の場合は先にログイン
# export AWS_PROFILE=your-sso-profile
# aws sso login

# NOTE: SSO を使う場合は、`aws sts get-caller-identity --profile ...` が通るプロファイルを export してから source してください。
#       （プロファイル未指定だと、default プロファイルを見に行って失敗→AWS_ACCOUNT_ID が空のままになることがあります）
source scripts/aws-env.sh || true
```

> `scripts/aws-env.sh` は、実行時点で有効な認証情報（`AWS_PROFILE` / デフォルトプロファイル）を使って `aws configure get ...` や `aws sts ...` を呼びます。SSO の場合は必ず先に `aws sso login` を済ませてください。

これで最低限、以下が自動設定されます。
- `AWS_REGION`（aws configureの値を優先）
- `AWS_ACCOUNT_ID`（STSから取得）
- `PROJECT_NAME` / `STAGE` / `STACK_NAME`
- `ECR_REPO` / `IMAGE_TAG` / `ECR_URI`
- `CFN_BUCKET` / `TEMPLATE_URL`（CloudFormation テンプレ用）
- `MIGRATE_KEY`（migrate Lambda zip の S3 key）

> トラブルシュート: ターミナルが「エラーで落ちる」場合
>
> - シェルに `set -e` / `set -u`（例: `set -euo pipefail`）が入っていると、
>   変数未定義やコマンド失敗の瞬間にシェルが終了して「ウィンドウが閉じた」ように見えることがあります。
> - AWS CLI 操作中は、まず `set +e; set +u`（もしくは新しいシェルを開く）で進めるのが安全です。
> - それでもセッション切断が起きる場合は、`tmux`/`screen` の中で作業するか、`script -q -f /tmp/vow.log` でログを残すと復帰が楽です。

#### 5) 必要な権限（目安）

最小で以下の操作を行える権限が必要です。

- CloudFormation: `cloudformation:*`（少なくとも create/update/describe/wait）
- ECR: `ecr:*`（リポジトリ作成、ログイン、push）
- ECS / ELB / EC2(VPC系): サービス作成・更新に必要な範囲
- CloudFront: distribution list, invalidation
- S3: フロント配布バケットへの sync、artifact zip の upload
- Lambda: migrate 関数の invoke
- RDS / SecretsManager / IAM / Logs: テンプレが作成するリソースに必要な範囲

組織のポリシー上 `*` が難しい場合は、スタック作成/更新に必要なアクションを段階的に絞ってください。

前提:
- `aws` CLI が設定済み（`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` もしくは SSO 等）
- `docker` が使える
- `zip` コマンドが使える

> 注意: CloudFormationの `--parameter-overrides` は **スペース区切り**で `Key=Value` を並べます。

### 0) 変数をセット（最初に1回）

以下を自分の環境で埋めてください。

目的: 「必要な値はできるだけ自動で取得し、手入力は secrets だけにする」

```bash
## (1) SSO のときは、まずプロファイルを選んでログイン（任意だが推奨）
## export AWS_PROFILE=AdministratorAccess-257784614320
## aws sso login

## (2) 推奨: aws configure / STS から値を自動セット（ワンライナー）
export AWS_REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || true)}"; export AWS_REGION="${AWS_REGION:-ap-northeast-1}"
export AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"

## (3) プロジェクト系（必要ならここだけ手で上書き）
export PROJECT_NAME="${PROJECT_NAME:-vow}"
export STAGE="${STAGE:-prod}"
export STACK_NAME="${STACK_NAME:-$PROJECT_NAME-$STAGE}"
export ECR_REPO="${ECR_REPO:-$PROJECT_NAME-$STAGE-api}"
export IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d)}"
export ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG"

## (4) CORS（最初は '*' でも動作確認可。運用では CloudFront/独自ドメインに絞る）
export ALLOWED_CORS_ORIGIN="${ALLOWED_CORS_ORIGIN:-*}"

## (5) CloudFormation Outputs をワンライナーで取得（スタック作成後に実行）
## NOTE: ここは CloudFormation のスタックが作成/更新され、Outputs が出た「後」に実行してください。
##       （未作成の状態で実行すると describe-stacks が失敗します）
export CF_DOMAIN="${CF_DOMAIN:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" --output text)}"
export API_BASE_CF="${API_BASE_CF:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ApiCloudFrontBaseUrl'].OutputValue" --output text)}"
export API_BASE_DIRECT="${API_BASE_DIRECT:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text)}"
export FRONTEND_BUCKET="${FRONTEND_BUCKET:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)}"
export MIGRATE_FN="${MIGRATE_FN:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='MigrateFunctionName'].OutputValue" --output text)}"
export LAMBDA_ARTIFACT_BUCKET="${LAMBDA_ARTIFACT_BUCKET:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='LambdaArtifactBucketName'].OutputValue" --output text)}"
export MIGRATE_KEY="${MIGRATE_KEY:-$PROJECT_NAME/$STAGE/artifacts/lambda-migrate-$IMAGE_TAG.zip}"

## (6) secrets / 手入力が必要なもの（ここだけは自動化しない）
## NOTE: Aurora MySQL の master password は 41 文字を超えるとエラーになります。
##       記号を含めてもOKですが、長すぎると弾かれるので注意してください。
##       例（40文字の英数）:
##         DB_MASTER_PASSWORD=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 40)
export DB_MASTER_PASSWORD="${DB_MASTER_PASSWORD:-REPLACE_ME_STRONG_PASSWORD_UP_TO_41_CHARS}"

## （任意）Supabase JWT 検証を使う場合
export SUPABASE_JWKS_URL="${SUPABASE_JWKS_URL:-}"
export SUPABASE_JWT_ISS="${SUPABASE_JWT_ISS:-}"
export SUPABASE_JWT_AUD="${SUPABASE_JWT_AUD:-}"

## （任意）OAuth（使わないなら空でOK）
export GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
export GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
export GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-}"
export GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-}"

## （任意）ALB HTTPS を有効化する場合（同一リージョンのACM証明書ARN）
export API_ALB_CERT_ARN="${API_ALB_CERT_ARN:-}"
```

### 1) ECR リポジトリ作成（初回のみ）

```bash
aws ecr describe-repositories \
	--region "$AWS_REGION" \
	--repository-names "$ECR_REPO" >/dev/null 2>&1 \
|| aws ecr create-repository \
	--region "$AWS_REGION" \
	--repository-name "$ECR_REPO"
```

### 2) backend(ECS) を build → ECR push

```bash
export ECR_URI="${ECR_URI:-$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG}"

aws ecr get-login-password --region "$AWS_REGION" \
	| docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

cd backend
docker build -t "$ECR_REPO:local" -f Dockerfile .
docker tag "$ECR_REPO:local" "$ECR_URI"
docker push "$ECR_URI"
cd -
```

### 3) CloudFormation（初回: create-stack / 2回目以降: update-stack）

> 重要: CloudFront の制約について（/api の認証）
>
> CloudFront の `OriginRequestPolicy` では、標準の `Authorization` ヘッダや `X-Forwarded-Proto` など一部ヘッダを許可できません。
> そのため `/api/*` を CloudFront 経由で運用する場合は、
> 認証を **Cookie（セッション）** 等に寄せるか、別の許可ヘッダ名に載せ替えるなどの設計が必要です。
> 本テンプレートは CloudFront の制約に合わせて、該当ヘッダは転送しない構成になっています。

> create-stack が失敗して `ROLLBACK_COMPLETE` になった場合
>
> `ROLLBACK_COMPLETE` のスタックは同名で `create-stack` をやり直せないため、いったん削除してから再作成します。
>
> ```bash
> aws cloudformation delete-stack --region "$AWS_REGION" --stack-name "$STACK_NAME"
> aws cloudformation wait stack-delete-complete --region "$AWS_REGION" --stack-name "$STACK_NAME"
> ```

#### 3-1) まずはテンプレをAWSへアップロード（任意だが推奨）

CloudFormationはローカルファイルでも実行できますが、サイズや追跡の都合でS3に置く運用の方が安定します。

```bash
export CFN_BUCKET="$PROJECT_NAME-$STAGE-cfn-$AWS_ACCOUNT_ID-$AWS_REGION"

aws s3api head-bucket --bucket "$CFN_BUCKET" >/dev/null 2>&1 \
|| aws s3api create-bucket \
	--bucket "$CFN_BUCKET" \
	--region "$AWS_REGION" \
	--create-bucket-configuration LocationConstraint="$AWS_REGION"

aws s3 cp infra/template.yaml "s3://$CFN_BUCKET/template.yaml" --region "$AWS_REGION"
export TEMPLATE_URL="https://$CFN_BUCKET.s3.$AWS_REGION.amazonaws.com/template.yaml"
```

> バケット名が衝突する場合は `CFN_BUCKET` を適宜変更してください。

#### 3-2) create-stack（初回のみ）

> トラブルシュート用: rollback/delete を速くしたい（Fast mode）
>
> CloudFormation の失敗時に rollback/delete が遅くなる最大要因は、Aurora(RDS)・NAT Gateway・CloudFront などの
> "重い" リソースが作成されることです。
> 初回の疎通やテンプレ調整中は、DB を作らないモードでスタックを立ち上げると
> 失敗しても後片付けが速くなります。
>
> ```bash
> # DB を作らずに検証する（rollback/delete が速い）
> # NOTE: アプリは DB が無い状態で起動するため、DB を使う機能は動きません。
> export ENABLE_DATABASE=false
> ```

> さらに削除/ロールバックを速くしたい場合は `DeploymentMode=minimal` を使います。
>
> - `DeploymentMode=minimal`: CloudFront/S3 フロント、NAT Gateway を作りません（ECS + セキュリティ中心）。
> - `DeploymentMode=full`: 従来どおり（フロント/CloudFront + NAT を含むフル構成）。
>
> ```bash
> # 最小構成で検証（rollback/delete をさらに速くする）
> export DEPLOYMENT_MODE=minimal
> ```

> NOTE: AWS のブログ等で言及される "optimistic stabilization" は、利用者がテンプレ側で ON/OFF できる設定ではありません。
> 本リポジトリでは「待ち時間の主因となるリソースをスタックから省く / 分ける」ことで同等の改善を狙います。

> Fast mode（`ENABLE_DATABASE=false`）では DB を作らないため、`DbMasterPassword` は実質使われません。
> そのため、create-stack 時に DB パスワードを指定/export していなくても進められます。

> 重要: `MigrateLambdaCodeS3Key` を指定する場合は、
> `s3://$LAMBDA_ARTIFACT_BUCKET/$MIGRATE_KEY` に **事前に zip をアップロード**しておく必要があります。
> （未アップロードのまま create-stack を実行すると `MigrateLambda` が `NoSuchKey` で `CREATE_FAILED` になります）
>
> 初回から migrate Lambda をデプロイしたい場合は、先に **5章（migrate zip 作成/アップロード）**を実施してください。
> 先にスタックだけ作りたい場合は、create-stack では `MigrateLambdaCodeS3Key` を空にしておき、
> 後で 5章→3-3 update-stack で反映してください。

> RDS が "Cannot find version ... for aurora-mysql" で失敗する場合
>
> Aurora MySQL の EngineVersion はリージョン/時期で利用可能な値が変わります。
> その場合は、利用可能なバージョンを確認して `DbEngineVersion` を指定してください。
>
> ```bash
> aws rds describe-db-engine-versions --engine aurora-mysql --region "$AWS_REGION" \
>   --query 'DBEngineVersions[].EngineVersion' --output text
> ```

```bash
aws cloudformation create-stack \
	--region "$AWS_REGION" \
	--stack-name "$STACK_NAME" \
	--template-url "$TEMPLATE_URL" \
	--capabilities CAPABILITY_NAMED_IAM \
	--parameters \
		ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
		ParameterKey=Stage,ParameterValue="$STAGE" \
		ParameterKey=DeploymentMode,ParameterValue="${DEPLOYMENT_MODE:-full}" \
		ParameterKey=ApiRuntime,ParameterValue=ecs \
		ParameterKey=ApiEcrImageUri,ParameterValue="$ECR_URI" \
		ParameterKey=AllowedCorsOrigin,ParameterValue="$ALLOWED_CORS_ORIGIN" \
		ParameterKey=EnableDatabase,ParameterValue="${ENABLE_DATABASE:-true}" \
		ParameterKey=DbEngineVersion,ParameterValue="${DB_ENGINE_VERSION:-8.0.mysql_aurora.3.07.1}" \
		ParameterKey=DbMasterPassword,ParameterValue="$DB_MASTER_PASSWORD" \
		# 初回は空でもOK（後で 5章→3-3 update-stack で設定）
		ParameterKey=MigrateLambdaCodeS3Key,ParameterValue="${MIGRATE_KEY:-}" \
		ParameterKey=SupabaseJwksUrl,ParameterValue="$SUPABASE_JWKS_URL" \
		ParameterKey=SupabaseJwtIss,ParameterValue="$SUPABASE_JWT_ISS" \
		ParameterKey=SupabaseJwtAud,ParameterValue="$SUPABASE_JWT_AUD" \
		ParameterKey=GoogleClientId,ParameterValue="$GOOGLE_CLIENT_ID" \
		ParameterKey=GoogleClientSecret,ParameterValue="$GOOGLE_CLIENT_SECRET" \
		ParameterKey=GithubClientId,ParameterValue="$GITHUB_CLIENT_ID" \
		ParameterKey=GithubClientSecret,ParameterValue="$GITHUB_CLIENT_SECRET" \
		ParameterKey=ApiAlbCertificateArn,ParameterValue="$API_ALB_CERT_ARN"

aws cloudformation wait stack-create-complete --region "$AWS_REGION" --stack-name "$STACK_NAME"
```

#### 3-3) update-stack（更新時）

```bash
aws cloudformation update-stack \
	--region "$AWS_REGION" \
	--stack-name "$STACK_NAME" \
	--template-url "$TEMPLATE_URL" \
	--capabilities CAPABILITY_NAMED_IAM \
	--parameters \
		ParameterKey=ProjectName,UsePreviousValue=true \
		ParameterKey=Stage,UsePreviousValue=true \
		ParameterKey=ApiRuntime,ParameterValue=ecs \
		ParameterKey=ApiEcrImageUri,ParameterValue="$ECR_URI" \
		ParameterKey=AllowedCorsOrigin,ParameterValue="$ALLOWED_CORS_ORIGIN" \
		ParameterKey=DbMasterPassword,UsePreviousValue=true \
		ParameterKey=MigrateLambdaCodeS3Key,ParameterValue="$MIGRATE_KEY" \
		ParameterKey=SupabaseJwksUrl,ParameterValue="$SUPABASE_JWKS_URL" \
		ParameterKey=SupabaseJwtIss,ParameterValue="$SUPABASE_JWT_ISS" \
		ParameterKey=SupabaseJwtAud,ParameterValue="$SUPABASE_JWT_AUD" \
		ParameterKey=GoogleClientId,ParameterValue="$GOOGLE_CLIENT_ID" \
		ParameterKey=GoogleClientSecret,ParameterValue="$GOOGLE_CLIENT_SECRET" \
		ParameterKey=GithubClientId,ParameterValue="$GITHUB_CLIENT_ID" \
		ParameterKey=GithubClientSecret,ParameterValue="$GITHUB_CLIENT_SECRET" \
		ParameterKey=ApiAlbCertificateArn,ParameterValue="$API_ALB_CERT_ARN" \
|| true

# "No updates are to be performed" の場合もあるので wait は条件付きにする
aws cloudformation wait stack-update-complete --region "$AWS_REGION" --stack-name "$STACK_NAME" || true
```

### 4) CloudFormation Outputs を取得（API/Frontend/DBの確認に使う）

```bash
aws cloudformation describe-stacks \
	--region "$AWS_REGION" \
	--stack-name "$STACK_NAME" \
	--query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' \
	--output table

# 0) 変数をセット のワンライナーをまだ実行していない場合は、ここで取得して export してください
export CF_DOMAIN="${CF_DOMAIN:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" --output text)}"
export API_BASE_CF="${API_BASE_CF:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ApiCloudFrontBaseUrl'].OutputValue" --output text)}"
export FRONTEND_BUCKET="${FRONTEND_BUCKET:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)}"
export MIGRATE_FN="${MIGRATE_FN:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='MigrateFunctionName'].OutputValue" --output text)}"
export LAMBDA_ARTIFACT_BUCKET="${LAMBDA_ARTIFACT_BUCKET:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='LambdaArtifactBucketName'].OutputValue" --output text)}"

echo "CloudFrontDomainName: $CF_DOMAIN"
echo "ApiCloudFrontBaseUrl: $API_BASE_CF"
echo "FrontendBucketName:   $FRONTEND_BUCKET"
echo "LambdaArtifactBucket: $LAMBDA_ARTIFACT_BUCKET"
echo "MigrateFunctionName:  $MIGRATE_FN"
```

### 5) Prisma migrate（A運用: migrate専用Lambdaを手動Invoke）

#### 5-1) migrate zip 作成

```bash
cd backend
npm ci
npm run build:bundle
npm prune --omit=dev
npm run build:artifacts

rm -f lambda-migrate.zip
(cd .lambda-artifact-migrate && zip -qr ../lambda-migrate.zip .)
cd -
```

#### 5-2) S3 へアップロード

```bash
aws s3 cp backend/lambda-migrate.zip "s3://$LAMBDA_ARTIFACT_BUCKET/$MIGRATE_KEY" --region "$AWS_REGION"

# 任意: 事前確認（create/update-stack の前にやると安全）
aws s3api head-object --bucket "$LAMBDA_ARTIFACT_BUCKET" --key "$MIGRATE_KEY" --region "$AWS_REGION"
```

#### 5-3) migrate zip の場所を CloudFormation に反映（update-stack）

「3-3 update-stack」を実行してください（`LambdaCodeS3Bucket` / `MigrateLambdaCodeS3Key` を更新）。

#### 5-4) migrate Lambda invoke

```bash
aws lambda invoke \
	--region "$AWS_REGION" \
	--function-name "$MIGRATE_FN" \
	--payload '{}' \
	/tmp/migrate-result.json

cat /tmp/migrate-result.json
```

### 6) frontend を build → S3 sync

#### 6-1) 静的ビルド（API URL を注入）

```bash
cd frontend

export NEXT_PUBLIC_API_URL="$API_BASE_CF"
npm ci
npm run build

cd -
```

#### 6-2) S3 sync

```bash
aws s3 sync frontend/out "s3://$FRONTEND_BUCKET/" --delete --region "$AWS_REGION"
```

### 7) CloudFront invalidation

テンプレは現状 DistributionId を Outputs に出していないため、CLIだけで invalidation するには **DistributionId を検索**します。

```bash
export CF_DIST_ID=$(aws cloudfront list-distributions \
	--query "DistributionList.Items[?DomainName=='$CF_DOMAIN'].Id | [0]" \
	--output text)

aws cloudfront create-invalidation --distribution-id "$CF_DIST_ID" --paths '/*'
```

### 8) 疎通確認

```bash
curl -i "https://$CF_DOMAIN/api/health"
curl -i "https://$CF_DOMAIN/"
```
