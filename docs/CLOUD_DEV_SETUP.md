# AWS クラウド開発環境セットアップガイド

このドキュメントでは、習慣管理ダッシュボードアプリケーションの開発環境をAWSクラウドに構築する手順を説明します。

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [ローカルDocker開発環境](#ローカルdocker開発環境)
4. [AWS CDKデプロイ](#aws-cdkデプロイ)
5. [Amplify Hosting設定](#amplify-hosting設定)
6. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### アーキテクチャ

```
ローカル開発 → docker-compose up
     ↓ push
GitHub → Amplify Hosting → 開発環境URL (HTTPS)
                ↓
           Supabase (DB/認証)
```

### 使用サービス

| サービス | 用途 | コスト |
|---------|------|--------|
| AWS Amplify Hosting | Next.js SSRホスティング | 無料枠あり |
| AWS Secrets Manager | GitHubトークン管理 | 無料枠あり |
| AWS CDK | インフラのコード化 | 無料 |
| Docker | ローカル開発 | 無料 |

---

## 前提条件

### 必要なツール

```bash
# Node.js 20 LTS
node --version  # v20.x.x

# Docker Desktop
docker --version  # Docker version 24.x.x

# Python 3.9以上
python3 --version  # Python 3.9+

# AWS CLI
aws --version  # aws-cli/2.x.x

# AWS CDK
npm install -g aws-cdk
cdk --version  # 2.x.x
```

### AWSアカウント設定

1. AWSアカウントを作成（または既存のアカウントを使用）
2. IAMユーザーを作成し、AdministratorAccessポリシーを付与
3. AWS CLIを設定:

```bash
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: ap-northeast-1
# Default output format: json
```

---

## ローカルDocker開発環境

### クイックスタート

```bash
# 1. 環境変数ファイルを作成
cp frontend/.env.example frontend/.env.local
# .env.localを編集してSupabase認証情報を設定

# 2. Docker開発環境を起動
docker-compose up

# 3. ブラウザでアクセス
open http://localhost:3000
```

### docker-compose コマンド

```bash
# 開発環境を起動（バックグラウンド）
docker-compose up -d

# ログを確認
docker-compose logs -f frontend

# 開発環境を停止
docker-compose down

# イメージを再ビルド
docker-compose build --no-cache

# 本番環境をテスト（ポート3001）
docker-compose --profile prod up frontend-prod
```

### ホットリロード

ソースコードを変更すると、自動的にブラウザに反映されます。
- `frontend/` ディレクトリ内のファイルを編集
- 変更が即座に反映されることを確認

---

## AWS CDKデプロイ

### 1. CDK環境のセットアップ

```bash
# infraディレクトリに移動
cd infra

# Python仮想環境を作成
python3 -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate  # Windows

# 依存関係をインストール
pip install -r requirements.txt
```

### 2. GitHub OAuthトークンの作成

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 「Generate new token (classic)」をクリック
3. 以下の権限を付与:
   - `repo` (Full control of private repositories)
   - `admin:repo_hook` (Full control of repository hooks)
4. トークンをコピー

5. AWS Secrets Managerに保存:

```bash
aws secretsmanager create-secret \
  --name "github-token" \
  --secret-string '{"token":"YOUR_GITHUB_TOKEN"}' \
  --region ap-northeast-1
```

### 3. CDKデプロイ

```bash
# CDK Bootstrap（初回のみ）
cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-northeast-1

# CloudFormationテンプレートを生成（確認用）
cdk synth -c github_repo="https://github.com/YOUR_USERNAME/YOUR_REPO"

# デプロイ（必須: github_repo、オプション: supabase_url, supabase_anon_key）
cdk deploy \
  -c github_repo="https://github.com/YOUR_USERNAME/YOUR_REPO" \
  -c supabase_url="https://YOUR_PROJECT.supabase.co" \
  -c supabase_anon_key="YOUR_SUPABASE_ANON_KEY"

# または、環境変数はAmplifyコンソールで後から設定する場合
cdk deploy -c github_repo="https://github.com/YOUR_USERNAME/YOUR_REPO"

# デプロイ後の出力を確認
# AmplifyAppUrl: https://develop.xxxxx.amplifyapp.com
```

**注意**: `github_repo` は必須パラメータです。Supabase認証情報はデプロイ時に指定するか、Amplifyコンソールで後から設定できます。

---

## Amplify Hosting設定

### 自動デプロイの確認

1. [Amplify Console](https://ap-northeast-1.console.aws.amazon.com/amplify/home?region=ap-northeast-1) を開く
2. 「vow-dev」アプリを選択
3. 「develop」ブランチを確認
4. GitHubにpushして自動ビルドを確認

### 環境変数の追加（コンソールから）

1. Amplify Console → アプリ → ホスティング → 環境変数
2. 「変数を管理」をクリック
3. **必須**の環境変数を追加:

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `AMPLIFY_MONOREPO_APP_ROOT` | `frontend` | モノレポのアプリルート（必須） |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase Anon Key |
| `NEXT_PUBLIC_USE_SUPABASE_API` | `true` | Supabase API使用フラグ |

**重要**: 環境変数を追加・変更した後は、ビルドを再実行してください。

### カスタムドメイン（オプション）

1. Amplify Console → ドメイン管理
2. 「ドメインを追加」をクリック
3. Route 53またはサードパーティドメインを設定

---

## トラブルシューティング

### Docker関連

#### コンテナが起動しない

```bash
# ログを確認
docker-compose logs frontend

# コンテナを再ビルド
docker-compose build --no-cache
docker-compose up
```

#### ポート3000が使用中

```bash
# 使用中のプロセスを確認
lsof -i :3000

# プロセスを終了
kill -9 <PID>
```

### CDK関連

#### cdk bootstrap エラー

```bash
# AWS認証情報を確認
aws sts get-caller-identity

# 正しいリージョンを指定
cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1
```

#### github_repo パラメータエラー

```bash
# github_repo は必須パラメータです
cdk deploy -c github_repo="https://github.com/YOUR_USERNAME/YOUR_REPO"
```

### Amplify関連

#### ビルドが失敗する

1. Amplify Console → ビルドログを確認
2. よくある原因:
   - `npm ci` の失敗 → package-lock.jsonを確認
   - 環境変数の不足 → Amplify Consoleで設定
   - メモリ不足 → ビルド設定でメモリを増加

#### モノレポエラー: "Cannot read 'next' version in package.json"

このエラーはAmplifyがNext.jsアプリのルートを見つけられない場合に発生します。

**解決方法**:
1. Amplifyコンソール → 環境変数で `AMPLIFY_MONOREPO_APP_ROOT` を `frontend` に設定
2. `amplify.yml` がモノレポ形式（`applications`キーを使用）になっていることを確認

```yaml
# 正しいモノレポ形式
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
```

#### モノレポエラー: "Monorepo spec provided without 'applications' key"

`AMPLIFY_MONOREPO_APP_ROOT` 環境変数が設定されているのに、`amplify.yml` が通常形式の場合に発生します。

**解決方法**:
- `amplify.yml` を `applications` キーを使ったモノレポ形式に変更する
- または `AMPLIFY_MONOREPO_APP_ROOT` 環境変数を削除する（非推奨）

#### 環境変数エラー: "Supabase is not configured"

アプリケーションが起動しても「Supabase is not configured」と表示される場合。

**解決方法**:
1. Amplifyコンソール → ホスティング → 環境変数を確認
2. 以下の変数がすべて設定されていることを確認:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_USE_SUPABASE_API`: `true`
   - `AMPLIFY_MONOREPO_APP_ROOT`: `frontend`
3. 環境変数を追加・変更した後は**ビルドを再実行**する必要があります

#### GitHub連携エラー

1. GitHub OAuthトークンの有効期限を確認
2. トークンに `admin:repo_hook` 権限があることを確認（Webhook作成に必要）
3. Secrets Managerのトークンを更新:

```bash
aws secretsmanager update-secret \
  --secret-id "github-token" \
  --secret-string '{"token":"NEW_GITHUB_TOKEN"}' \
  --region ap-northeast-1
```

#### OAuth認証が動作しない

Supabaseの認証リダイレクトURLにAmplifyのURLを追加する必要があります。

**解決方法**:
1. Supabaseダッシュボード → Authentication → URL Configuration
2. 「Redirect URLs」に追加:
   ```
   https://develop.YOUR_APP_ID.amplifyapp.com/**
   ```

---

## コスト管理

### Amplify Hosting無料枠

| 項目 | 無料枠 |
|------|--------|
| ビルド時間 | 1000分/月 |
| データ転送 | 15GB/月 |
| リクエスト | 500,000/月 |

### コスト最適化のヒント

1. **不要なビルドを避ける**: 頻繁なpushを避け、まとめてpush
2. **ブランチを削除**: 使用しないブランチは削除
3. **使用量を監視**: AWS Cost Explorerで確認

---

## 関連ドキュメント

- [AWS Amplify Hosting ドキュメント](https://docs.aws.amazon.com/amplify/latest/userguide/)
- [AWS CDK Python リファレンス](https://docs.aws.amazon.com/cdk/api/v2/python/)
- [Next.js デプロイガイド](https://nextjs.org/docs/deployment)

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-01-19 | トラブルシューティング追加 - モノレポエラー、環境変数エラー、OAuth設定 |
| 2026-01-18 | 初版作成 - Docker + Amplify Hosting構成 |
