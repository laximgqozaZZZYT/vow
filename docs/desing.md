# 設計書

> 注意: ファイル名は`desing.md`（ご指定のとおり）です。後で `design.md` にリネームしても良いでしょう。

この設計書はVOWのアーキテクチャ、データモデル、API仕様、認証フロー、及び簡易ER図を記載します。

## アーキテクチャ概要
- フロントエンド：Next.js（SSR と SSG を必要に応じて併用）
- バックエンド：FastAPI（Python）、REST API を提供
- DB：MySQL（RDS等に移行可能）
- 認証：Firebase Auth（フロントが直接ログインし、IDトークンをバックエンドに送る）
- CI/CD：GitHub Actions（テスト・Lint・ビルド・デプロイ）

フロントはFirebase SDKを使ってログインを行い、取得したIDトークンをAPIリクエストのAuthorization: Bearer <idToken> ヘッダに含めます。バックエンドはFirebase Admin SDK（サービスアカウントキー）でトークン検証を行い、検証が通ればリクエストを許可します。

## コンポーネント
- Next.js アプリ
  - ページ: /login, /habits, /categories, /reports, /stats
  - API クライアント: axios 又は fetch をラップして Authorization ヘッダを自動付与
- FastAPI サービス
  - ルーター: /api/categories, /api/habits, /api/reports, /api/stats
  - ミドルウェア: Firebase トークン検証ミドルウェア
  - DB 層: SQLAlchemy + Alembic（マイグレーション）

## データモデル（概略）

ERのテキスト版:
- User (id, firebase_uid, display_name, email, created_at)
- Category (id, user_id, name, description, deadline, created_at, updated_at)
- Habit (id, user_id, category_id, name, kind, estimated_minutes, remind_spec, created_at, updated_at)
- Report (id, user_id, habit_id, executed_at, note, created_at)

フィールド詳細
- User
  - id: 整数, 主キー
  - firebase_uid: 文字列, 一意
  - display_name: 文字列
  - email: 文字列
  - created_at: タイムスタンプ
- Category
  - name: 文字列
  - description: テキスト
  - deadline: 日付（NULL可）
- Habit
  - kind: Enum ('do', 'dont')
  - remind_spec: JSON （初期は単純な {"time":"08:00","days":[1,2,3,4,5]} など）
- Report
  - executed_at: タイムスタンプ
  - note: テキスト

## API 仕様（主要）
- 認証: Authorization: Bearer <idToken>
- POST /api/categories
  - body: { name, description?, deadline? }
  - response: 201 Created, { id, name, description, deadline }
- GET /api/categories
  - query: ?includeStats=true
  - response: 200 OK, [{ id, name, description, deadline, created_at }]
- POST /api/habits
  - body: { name, category_id, kind, estimated_minutes?, remind_spec? }
- GET /api/habits
  - response: [{ id, name, category_id, kind, estimated_minutes, remind_spec }]
- POST /api/reports
  - body: { habit_id, executed_at, note? }
- GET /api/reports?habit_id=xxx

## 認証フロー
1. ユーザーはフロントでFirebase Authによりサインインし、IDトークンを取得する。
2. フロントはAPI呼び出し時に Authorization: Bearer <idToken> を付与する。
3. バックエンドはFirebase Admin SDKでトークンを検証する。検証成功でfirebase_uidを取り出し、DB上のUserレコードと照合（なければ作成）する。

## マイグレーション
- SQLAlchemy + Alembic を採用し、初期マイグレーションで上記モデルを作成する。

## エラーハンドリング
- バリデーションエラー: 400
- 認証エラー: 401
- 権限エラー: 403
- 存在しないリソース: 404
- サーバ内部エラー: 500

## セキュリティ考慮
- サービスアカウントキーは環境変数 / シークレットマネージャで管理
- CORS 設定はフロントの配列（本番ドメイン）に限定
- SQL Injection 対策は ORM を利用

## ロギング
- FastAPI は標準 logging を利用。重要イベント（ログイン、エラー）は WARN/ERROR ログに出力する。

## 実装上の簡易ER図（ASCII）

User (1) --- (N) Category
User (1) --- (N) Habit
Habit (1) --- (N) Report
Category (1) --- (N) Habit

## 追加注記
- リマインドや通知の実装は初期段階ではスケジューラ（cron）または外部サービス（Firebase Cloud Messaging）を検討
- DB のタイムゾーンは UTC に統一

## プロジェクト構造

/ (repo root)
├─ .github/workflows/        # CI/CD ワークフロー（GitHub Actions）
├─ frontend/                 # Next.js アプリ
├─ backend/                  # FastAPI アプリ
├─ infra/                    # インフラ設定（docker-compose, terraform 等）
├─ docs/                     # 要件・設計・運用ドキュメント
├─ scripts/                  # 開発/運用用スクリプト
├─ .env.example              # 環境変数テンプレート（コミット可）
├─ docker-compose.yml        # 開発用 compose（オプション）
└─ README.md