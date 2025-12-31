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

## データベーススキーマ（MySQL DDL）

以下はアプリで使用する主要テーブルの設計（正規化を念頭に置いた MySQL 用の DDL 例）です。初期実装では SQLAlchemy のモデルと Alembic マイグレーションを用いてこれらを作成します。

-- users
```sql
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  firebase_uid VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

-- categories
```sql
CREATE TABLE categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  deadline DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_categories_user ON categories(user_id);
```

-- habits
```sql
CREATE TABLE habits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  kind ENUM('do','avoid') NOT NULL DEFAULT 'do',
  estimated_minutes INT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  due_date DATE DEFAULT NULL,
  time TIME DEFAULT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  remind_spec JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
CREATE INDEX idx_habits_user ON habits(user_id);
CREATE INDEX idx_habits_category ON habits(category_id);
```

-- habit_recurrences
```sql
-- 繰り返しルールを別テーブルで管理（将来的に rrule 文字列や構造化したルールを保存）
CREATE TABLE habit_recurrences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  habit_id BIGINT UNSIGNED NOT NULL,
  rrule TEXT NOT NULL, -- 例: RFC5545 RRULE 文字列や独自の JSON で表現
  effective_from DATE DEFAULT NULL,
  effective_to DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);
CREATE INDEX idx_recurrences_habit ON habit_recurrences(habit_id);
```

-- reminders
```sql
-- リマインダー単位で保存（push/通知など）
CREATE TABLE reminders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  habit_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('absolute','relative') NOT NULL,
  at_time TIME DEFAULT NULL, -- absolute のとき
  weekdays JSON DEFAULT NULL, -- absolute のとき: [0,1,2] など
  minutes_before INT DEFAULT NULL, -- relative のとき
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);
CREATE INDEX idx_reminders_habit ON reminders(habit_id);
```

-- reports (実行ログ)
```sql
CREATE TABLE reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  habit_id BIGINT UNSIGNED NOT NULL,
  executed_at TIMESTAMP NOT NULL,
  note TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);
CREATE INDEX idx_reports_habit ON reports(habit_id);
CREATE INDEX idx_reports_user ON reports(user_id);
```

### 補足: JSONカラムと互換性
- `remind_spec` や `reminders.weekdays` は JSON 型で柔軟に保持します。初期はフロントで扱いやすい単純構造（例: { "time":"08:00", "days":[1,2,3,4,5] }）を用います。将来的に `reminders` テーブルで詳細化します。

### マッピング: UI フィールド → DB カラム
- name -> `habits.name`
- categoryId -> `habits.category_id`
- type(kind) -> `habits.kind`
- dueDate -> `habits.due_date` (YYYY-MM-DD)
- startTime -> `habits.time` (HH:MM:SS)
- endTime -> (UI のみ / 将来的に `habits.end_time` を追加可)
- allDay -> `habits.all_day`
- notes -> `habits.notes`
- repeat / カスタム繰り返し -> `habit_recurrences.rrule`（簡易版は `habits.remind_spec` に格納）
- reminders -> `reminders` テーブル（または `habits.remind_spec` JSON）

### サンプル: 新規 Habit の登録ペイロード → SQL 挿入（簡易）
```sql
INSERT INTO habits (user_id, category_id, name, kind, estimated_minutes, due_date, time, all_day, notes, remind_spec)
VALUES (:user_id, :category_id, :name, :kind, :estimated_minutes, :due_date, :time, :all_day, :notes, JSON_ARRAY(:remind_spec));
```

### マイグレーション / 実装ノート
- SQLAlchemy のモデルに合わせて Alembic の初期マイグレーションを作成します。
- JSON カラムを使う箇所は DB ベンダーのバージョン依存性に注意（MySQL 5.7+ / MariaDB 対応を確認）。
- 大量データを扱う場合、`reports` はパーティショニング（日時ベース）を検討します。
- 繰り返しルール（rrule）を文字列で保存するか、独自の正規化テーブルを作るかは運用負荷とクエリ頻度で決定します。

### API レスポンスの例（habit を取得したとき）
```json
{
  "id": 123,
  "user_id": 1,
  "category_id": 10,
  "name": "朝ジョギング",
  "kind": "do",
  "due_date": "2025-12-31",
  "time": "07:00:00",
  "all_day": false,
  "notes": "5km",
  "remind_spec": { "time": "07:00", "days": [1,2,3,4,5] },
  "created_at": "2025-12-30T10:00:00Z",
  "updated_at": "2025-12-30T10:00:00Z"
}
```

---


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
