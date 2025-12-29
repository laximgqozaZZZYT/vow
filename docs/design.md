# 設計書

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

- User (id, firebase_uid, display_name, email, created_at)
- Habit (id, user_id, category_id, name, kind, estimated_minutes, remind_spec, created_at, updated_at)
- Report (id, user_id, habit_id, executed_at, note, created_at)

フィールド詳細
  - id: 整数, 主キー
  - firebase_uid: 文字列, 一意
  - display_name: 文字列
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
- GET /api/reports?habit_id=xxx

## 認証フロー
1. ユーザーはフロントでFirebase Authによりサインインし、IDトークンを取得する。
2. フロントはAPI呼び出し時に Authorization: Bearer <idToken> を付与する。

## マイグレーション
- SQLAlchemy + Alembic を採用し、初期マイグレーションで上記モデルを作成する。
## エラーハンドリング
- バリデーションエラー: 400
- 認証エラー: 401
- 存在しないリソース: 404
- サーバ内部エラー: 500

- サービスアカウントキーは環境変数 / シークレットマネージャで管理
- CORS 設定はフロントの配列（本番ドメイン）に限定
- SQL Injection 対策は ORM を利用

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

## インストールした npm / npx パッケージ (frontend)

- 目的: フロントエンドの初期化で開発に必要なライブラリをプロジェクトに追加しました。すべて `frontend/` ディレクトリでインストールしています。

- 主要パッケージ（プロジェクトに直接インストール）:
  - firebase  (Firebase JS SDK)
  - axios     (HTTP クライアント)
  - swr       (データフェッチ用ライブラリ)

- 推奨・補助パッケージ:
  - react-firebase-hooks  (React 用 Firebase フック)
  - firebaseui            (FirebaseUI - 認証 UI コンポーネント)  <!-- deprecated: removed from recommended install -->
  - @types/node
  - @types/react

インストール時の例（frontend ディレクトリで実行）:

```bash
# 依存関係
npm install firebase axios swr

# 推奨パッケージ
npm install react-firebase-hooks

# 開発時型定義
npm install -D @types/node @types/react
```

## リポジトリ内の主要ファイル一覧（抜粋）

以下は現在の主要ファイル・ディレクトリと簡単な説明の表です。仮想環境内や依存パッケージ等の細かいファイルは除外しています。

| パス | 種類 | 概要 |
|---|---|---|
| `package.json` | file | ルートの npm メタ情報（主にフロントエンド関連スクリプト） |
| `frontend/` | dir | Next.js フロントエンドアプリケーション |
| `frontend/package.json` | file | フロントエンドの依存・スクリプト定義 |
| `frontend/src/app/` | dir | Next.js のページ・レイアウト・スタイル |
| `frontend/src/components/HabitForm.tsx` | file | 習慣入力フォームコンポーネント |
| `frontend/src/components/HabitList.tsx` | file | 習慣一覧を表示するコンポーネント |
| `frontend/src/lib/api.ts` | file | API クライアントラッパ（Authorization ヘッダ付与等） |
| `frontend/src/firebase/clientApp.ts` | file | Firebase クライアント初期化コード |
| `backend/` | dir | FastAPI バックエンド（API サーバ） |
| `backend/app.py` | file | FastAPI アプリケーションのエントリポイント |
| `backend/auth.py` | file | Firebase トークン検証や認証補助関数 |
| `backend/db.py` | file | DB 接続（SQLAlchemy セッション等） |
| `backend/models.py` | file | SQLAlchemy モデル定義（User/Habit/Category/Report 等） |
| `backend/init_db.py` | file | 初期 DB 作成 / マイグレーション用スクリプト（起動補助） |
| `backend/routers/` | dir | API ルーター群（categories, habits, reports 等） |
| `backend/requirements.txt` | file | バックエンドの Python 依存パッケージ |
| `backend/start_uvicorn.sh` | file | 開発用に uvicorn を起動するシンプルスクリプト |
| `backend/serviceAccountKey.json` | file | Firebase 管理用サービスアカウントキー（機密。管理に注意） |
| `docs/` | dir | ドキュメント（本ファイル `design.md` を含む） |
| `docs/requirements.md` | file | 補足の依存・要件メモ |
| `infra/systemd/vow-server.service` | file | systemd 用のサービスユニット（サーバ起動定義） |
| `scripts/create_test_user.js` | file | テスト用ユーザーを Firebase に作るスクリプト（開発用） |

※ 注意: 仮想環境 (`backend/.venv/`) とその内部のライブラリは省略しています。必要なら完全なファイル一覧を生成できます。

インストール状況の確認:

```bash
# frontend ディレクトリで
npm list --depth=0
```

備考:
- `npm fund` を実行すると依存パッケージのスポンサー情報が表示されます（開発に必須ではありません）。
- 将来的に依存関係一覧を `docs/requirements.md` や `frontend/README.md` に同期することを推奨します。
