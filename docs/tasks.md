# 実装タスク一覧 (日本語)

以下はプロジェクトを構築し、MVP をリリースするためのタスク一覧です。小さな単位に分割して優先度順に並べています。

## 重要な前提
- フロント: Next.js（TypeScript）
- バックエンド: FastAPI（Python）
- DB: MySQL
- 認証: Firebase Auth
- CI/CD: GitHub Actions

---

## フェーズ0 — 準備
- [ ] 1. レポジトリ初期化
   - [ ] GitHub リポジトリ作成
   - [ ] `.gitignore` 追加（`node_modules`, `.venv`, `.env` 等）
- [ ] 2. リポジトリ構成の決定
   - [ ] `/frontend` (Next.js)
   - [ ] `/backend` (FastAPI)
   - [ ] `/infra` (任意: Terraform, k8s, db migration scripts)

## フェーズ1 — スキャフォールド（MVP）
- [ ] 1. フロント初期化
   - [ ] Next.js + TypeScript の雛形作成
   - [ ] Firebase SDK を導入し、ログイン画面を作る（Email/Password と OAuth）
   - [ ] Axios / SWR を導入
   
  
   **状態更新 (2025-12-29)**
   - [ ] フロント側で Firebase Auth を用いたログイン画面の動作確認を完了しました。
      - 実施内容: `/login` ページ実装、クライアントサイドの認証監視を `src/app/page.tsx` に追加して未認証は `/login` にリダイレクト、認証済みは `/dashboard` に遷移するフローを追加。
      - `/dashboard` の簡易ページを追加し、サインアウト機能を実装しました。
      - テスト: ローカル開発サーバーでログイン成功を確認済み。

   次の推奨タスク（優先度順）:
   1. バックエンドの認証検証（FastAPI 側で Authorization ヘッダの ID トークンを検証し、ユーザー情報を取り扱う）
   2. `/dashboard` の UI を本来のランディング（またはダッシュボード）に差し替え
   3. Next.js の `next.config.js` にある `experimental.turbopack` 周りの警告を解消（設定を削除するか Next のサポート状況に合わせて修正）
- [ ] 2. バックエンド初期化
   - [ ] FastAPI プロジェクト作成
   - [ ] SQLAlchemy と Alembic を導入
   - [ ] MySQL 接続設定（環境変数で管理）
   - [ ] Firebase Admin SDK を導入（サービスアカウント設定）
- [ ] 3. CI 基本設定
   - [ ] GitHub Actions のワークフローを追加（Lint, Tests）

## フェーズ2 — 基本機能実装
- [ ] 1. DB モデル実装
   - [ ] User, Category, Habit, Report のモデル作成
   - [ ] 初期マイグレーションを作成して適用
- [ ] 2. 認証ミドルウェア
   - [ ] Authorization ヘッダの ID トークン検証を実装
   - [ ] トークンから firebase_uid を抽出し、User レコードを作成/参照
- [ ] 3. カテゴリー CRUD API
   - [ ] POST/GET/PUT/DELETE を実装。ユーザー単位でのスコープを適用
- [ ] 4. 習慣 CRUD API
   - [ ] POST/GET/PUT/DELETE を実装。リマインドは JSON で保存
- [ ] 5. 報告 API
   - [ ] POST/GET を実装。報告作成時に habit と user の整合性をチェック
- [ ] 6. 統計 API
   - [ ] 習慣別統計（累計回数、最終実行からの経過時間）
   - [ ] カテゴリー統計（カテゴリ内の合計回数、最終実行日）

## フェーズ3 — フロント実装
- [ ] 1. 認証フロー実装（Next.js）
   - [ ] Firebase UI コンポーネントでログイン
   - [ ] トークンを取得して API クライアントに設定
- [ ] 2. ページ作成
   - [ ] `/habits`: 習慣一覧・作成・編集
   - [ ] `/categories`: カテゴリー一覧・作成・編集
   - [ ] `/reports`: 報告作成・一覧
   - [ ] `/stats`: 習慣・カテゴリー統計表示
- [ ] 3. UI/UX 改善
   - [ ] 日付ピッカー、時間入力、モバイル対応

## フェーズ4 — テスト、CI/CD、デプロイ
- [ ] 1. テスト
   - [ ] FastAPI で pytest によるエンドポイントテスト（認証モック）
   - [ ] Next.js の基本的なレンダリングテスト（Jest）
- [ ] 2. CI/CD
   - [ ] GitHub Actions で Lint, Tests を実行
   - [ ] 本番デプロイ（例：Vercel for frontend、Cloud Run / ECS for backend）
- [ ] 3. インフラ
   - [ ] MySQL（RDS）への接続設定
   - [ ] 環境変数/Secrets の設定

## フェーズ5 — 追加機能（オプション）
- [ ] リマインダーのスケジューラ（crontab / Celery / Cloud Tasks）
- [ ] プッシュ通知（Firebase Cloud Messaging）
- [ ] UX 向上（分析ダッシュボード、CSVエクスポート）

## スプリント分割（3週間スプリントの例）
- [ ] Sprint 1 (Week1-3): フェーズ0 + フェーズ1
- [ ] Sprint 2 (Week4-6): フェーズ2 の 1-3
- [ ] Sprint 3 (Week7-9): フェーズ2 の残り + フェーズ3 の一部
- [ ] Sprint 4 (Week10-12): フェーズ3 残り + フェーズ4

## 受け入れ基準（例）
- [ ] ユーザーは Firebase でログインできる
- [ ] ログイン後、カテゴリーと習慣を作成できる
- [ ] 習慣に対して報告を作成でき、統計が確認できる

## 次のアクション
- [ ] あなたの確認のあと、リポジトリのスキャフォールドを作成します。

