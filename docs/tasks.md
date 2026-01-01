# 実装タスク一覧 (日本語)

以下はプロジェクトを構築し、MVP をリリースするためのタスク一覧です。小さな単位に分割して優先度順に並べています。

## 重要な前提（現状の実装）
- フロント: Next.js（TypeScript, App Router）
- バックエンド: Express + TypeScript + Prisma
- DB: MySQL
- 認証: 暫定で `X-User-Id` ヘッダ（将来は Cognito 等で JWT）
- CI/CD: GitHub Actions（未整備。AWS 移行に合わせて整備する）

---

## フェーズ0 — 準備
- [ ] 1. レポジトリ初期化
   - [ ] GitHub リポジトリ作成
   - [ ] `.gitignore` 追加（`node_modules`, `.venv`, `.env` 等）
- [ ] 2. リポジトリ構成の決定
   - [ ] `/frontend` (Next.js)
   - [ ] `/backend` (Express + Prisma)
   - [ ] `/infra` (任意: Terraform, k8s, db migration scripts)

## フェーズ1 — スキャフォールド（MVP）
- [ ] 1. フロント初期化
   - [ ] Next.js + TypeScript の雛形作成
   - [ ] 認証（Cognito など）を見据えたログイン画面を用意（MVP は未実装でも可）
   - [ ] Axios / SWR を導入
   
   次の推奨タスク（優先度順）:
   1. バックエンドの認証導入（Cognito 等で JWT を検証し、ユーザー情報を取り扱う）
   2. `/dashboard` の UI を本来のランディング（またはダッシュボード）に差し替え
   3. Next.js の `next.config.js` にある `experimental.turbopack` 周りの警告を解消（設定を削除するか Next のサポート状況に合わせて修正）
- [ ] 2. バックエンド初期化
   - [x] Express + TypeScript プロジェクト作成
   - [x] Prisma を導入
   - [x] MySQL 接続設定（環境変数で管理）
- [ ] 3. CI 基本設定
   - [ ] GitHub Actions のワークフローを追加（Lint, Tests）

## フェーズ2 — 基本機能実装
- [ ] 1. DB モデル実装
   - [x] User, Goal, Habit, Activity, Preference を Prisma で定義
   - [x] migrate により MySQL に反映
- [ ] 2. 認証ミドルウェア
   - [ ] Authorization ヘッダの ID トークン検証を実装
   - [ ] トークンから subject（例: `sub`）を抽出し、User レコードを作成/参照
- [ ] 3. Goals/Habits/Activities/Prefs CRUD API
   - [x] Goals CRUD
   - [x] Habits CRUD（goalId 未指定時 Inbox Goal にアタッチ）
   - [x] Activities CRUD
   - [x] Preferences/Layout

## フェーズ3 — フロント実装
- [ ] 1. 認証フロー実装（Next.js）
   - [ ] Cognito 等の Hosted UI / 独自 UI でログイン
   - [ ] トークンを取得して API クライアントに設定
- [ ] 2. ページ作成
   - [ ] `/habits`: 習慣一覧・作成・編集
   - [ ] `/stats`: 習慣・カテゴリー統計表示
- [ ] 3. UI/UX 改善
   - [ ] 日付ピッカー、時間入力、モバイル対応

## フェーズ4 — テスト、CI/CD、デプロイ
- [ ] 1. テスト
   - [ ] backend（Express）のエンドポイントテスト（認証モック）
   - [ ] Next.js の基本的なレンダリングテスト（Jest）
- [ ] 2. CI/CD
   - [ ] GitHub Actions で Lint, Tests を実行
   - [ ] 本番デプロイ（例：Vercel for frontend、Cloud Run / ECS for backend）
- [ ] 3. インフラ（AWS移行）
    - [ ] VPC 作成（public/private subnet）
    - [ ] RDS MySQL 作成（private subnet）
    - [ ] ECR 作成（backend image）
    - [ ] ECS Fargate + ALB 構築（backend）
    - [ ] Amplify Hosting 構築（frontend）
    - [ ] Secrets Manager に `DATABASE_URL` を格納
    - [ ] 環境変数 `NEXT_PUBLIC_API_URL` を Amplify に設定
    - [ ] Migration 実行導線（ECS RunTask で `prisma migrate deploy`）
    - [ ] ログ（CloudWatch Logs）、アラーム、バックアップ（RDS）

## AWS 移行チェックリスト（最小）

- [ ] ドメイン/証明書
   - [ ] Route53（任意）
   - [ ] ACM 証明書（ALB/CloudFront/Amplify 用）
- [ ] API
   - [ ] ALB 側で HTTPS
   - [ ] CORS origin を本番ドメインに合わせる
- [ ] DB
   - [ ] セキュリティグループが ECS -> RDS のみ許可
   - [ ] RDS パラメータ/照合順序の確認
- [ ] データ移行（必要なら）
   - [ ] 既存 MySQL から dump/restore
   - [ ] マイグレーション適用順序の確定

## フェーズ5 — 追加機能（オプション）
- [ ] リマインダーのスケジューラ（crontab / Celery / Cloud Tasks）
- [ ] プッシュ通知（SNS / WebPush / 任意サービス）
- [ ] UX 向上（分析ダッシュボード、CSVエクスポート）

## スプリント分割（3週間スプリントの例）
- [ ] Sprint 1 (Week1-3): フェーズ0 + フェーズ1
- [ ] Sprint 2 (Week4-6): フェーズ2 の 1-3
- [ ] Sprint 3 (Week7-9): フェーズ2 の残り + フェーズ3 の一部
- [ ] Sprint 4 (Week10-12): フェーズ3 残り + フェーズ4

## 受け入れ基準（例）
- [ ] (暫定/本番) 認証後、ユーザー毎にデータが分離される
- [ ] ログイン後、Goal と Habit を作成できる
- [ ] Activity が保存され、リロード後も履歴が表示される

## 次のアクション
- [ ] あなたの確認のあと、リポジトリのスキャフォールドを作成します。

