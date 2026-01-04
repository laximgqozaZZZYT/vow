# 🚀 Supabase完全移行版 WEBサービス公開ガイド

Supabaseをバックエンド・データベース・認証の統合プラットフォームとして使用

## 📋 事前準備

### 必要なアカウント
- **GitHub**（コード管理）- https://github.com
- **Supabase**（バックエンド + DB + 認証）- https://supabase.com
- **Vercel**（フロントエンド）- https://vercel.com

### デプロイ構成
```
┌─────────────────┐    ┌─────────────────┐
│   Vercel        │    │   Supabase      │
│   (Frontend)    │───▶│   (Backend)     │
│   Next.js       │    │   PostgreSQL    │
│   React         │    │   REST API      │
└─────────────────┘    │   Auth          │
                       │   Edge Functions│
                       └─────────────────┘
```

---

## 1️⃣ Supabase設定（統合バックエンド）

### 1.1 プロジェクト作成

1. https://supabase.com にアクセス
2. **Start your project** → **Sign up**（GitHubアカウント推奨）
3. **New project** をクリック

**プロジェクト設定**:
```
Organization: Personal（または新規作成）
Project name: vow-app
Database Password: [強力なパスワードを生成・保存]
Region: Northeast Asia (Tokyo)
Pricing Plan: Free
```

4. **Create new project** をクリック（2-3分待機）

### 1.2 データベーステーブル作成

プロジェクト作成完了後：

1. **SQL Editor** をクリック
2. **New query** をクリック
3. 以下のSQLを貼り付けて実行：

```sql
-- Goal table
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    details TEXT,
    due_date TIMESTAMPTZ,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    parent_id TEXT REFERENCES goals(id),
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habit table
CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    goal_id TEXT NOT NULL REFERENCES goals(id),
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    must INTEGER,
    duration INTEGER,
    reminders JSONB,
    due_date TIMESTAMPTZ,
    time TEXT,
    end_time TEXT,
    repeat TEXT,
    timings JSONB,
    outdates JSONB,
    all_day BOOLEAN,
    notes TEXT,
    workload_unit TEXT,
    workload_total INTEGER,
    workload_per_count INTEGER,
    completed BOOLEAN DEFAULT false,
    last_completed_at TIMESTAMPTZ,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity table
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    kind TEXT NOT NULL,
    habit_id TEXT NOT NULL,
    habit_name TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    amount INTEGER,
    prev_count INTEGER,
    new_count INTEGER,
    duration_seconds INTEGER,
    owner_type TEXT,
    owner_id TEXT
);

-- Preference table
CREATE TABLE IF NOT EXISTS preferences (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(key, owner_type, owner_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_goals_parent_id ON goals(parent_id);
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_habits_goal_id ON habits(goal_id);
CREATE INDEX IF NOT EXISTS idx_habits_owner ON habits(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_activities_owner ON activities(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_preferences_owner ON preferences(owner_type, owner_id);

-- Row Level Security (RLS) 設定
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー（認証ユーザーは自分のデータのみアクセス可能）
CREATE POLICY "Users can access own goals" ON goals
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL  -- ゲストデータ
    );

CREATE POLICY "Users can access own habits" ON habits
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );

CREATE POLICY "Users can access own activities" ON activities
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );

CREATE POLICY "Users can access own preferences" ON preferences
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );
```

4. **RUN** をクリックしてテーブルを作成

### 1.3 API設定確認

1. **Settings** → **API** をクリック
2. 以下の情報をコピー・保存：

```bash
Project URL: https://jamiyzsyclvlvstmeeir.supabase.co
anon public key: sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm
service_role key: [サービスロールキー]
```

### 1.4 認証設定

1. **Authentication** → **Settings** をクリック
2. **General settings**:

```
Site URL: http://localhost:3000
Additional Redirect URLs: 
  http://localhost:3000/dashboard
  (後でVercelドメインを追加)
```

### 1.5 Google OAuth設定

#### Google Cloud Console設定

1. https://console.cloud.google.com にアクセス
2. プロジェクト選択（または新規作成）
3. **APIs & Services** → **Credentials**
4. **+ CREATE CREDENTIALS** → **OAuth 2.0 Client IDs**

**OAuth設定**:
```
Application type: Web application
Name: Vow App
Authorized JavaScript origins:
  https://jamiyzsyclvlvstmeeir.supabase.co
Authorized redirect URIs:
  https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback
```

5. **Create** をクリック
6. **Client ID** と **Client Secret** をコピー

#### Supabase OAuth設定

1. Supabase → **Authentication** → **Providers**
2. **Google** をクリック
3. **Enable Google provider** をON

```
Client ID: [Google Cloud Consoleからコピー]
Client Secret: [Google Cloud Consoleからコピー]
```

4. **Save** をクリック

---

## 2️⃣ Vercel設定（フロントエンド）

### 2.1 アカウント作成・ログイン

1. https://vercel.com にアクセス
2. **Sign Up** → **Continue with GitHub**
3. GitHubアカウントで認証

### 2.2 プロジェクト作成

1. **Add New...** → **Project** をクリック
2. **Import Git Repository** で `vow` リポジトリを選択
3. **Import** をクリック

### 2.3 プロジェクト設定

**Configure Project**画面で：

```
Framework Preset: Next.js
Root Directory: frontend
Build Command: npm run build
Output Directory: (空白のまま)
Install Command: npm install
```

### 2.4 環境変数設定

**Environment Variables** セクションで以下を追加：

```bash
# Supabase設定（認証 + データベース + API）
NEXT_PUBLIC_SUPABASE_URL=https://jamiyzsyclvlvstmeeir.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm

# Supabase REST APIを使用
NEXT_PUBLIC_API_URL=https://jamiyzsyclvlvstmeeir.supabase.co/rest/v1
NEXT_PUBLIC_USE_SUPABASE_API=true
```

### 2.5 デプロイ実行

1. **Deploy** をクリック
2. ビルド完了まで待機（3-5分）
3. 生成されたドメインをコピー（例：`vow-app.vercel.app`）

---

## 3️⃣ 最終設定更新

### 3.1 Supabase URL更新

1. Supabase → **Authentication** → **Settings**
2. **Site URL**: `https://vow-app.vercel.app`
3. **Additional Redirect URLs**に追加:
   ```
   https://vow-app.vercel.app/dashboard
   https://vow-app.vercel.app/login
   ```

### 3.2 Google OAuth Redirect URI更新

1. Google Cloud Console → **Credentials**
2. OAuth 2.0 Client IDを編集
3. **Authorized redirect URIs**に追加:
   ```
   https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback
   ```

---

## 4️⃣ 動作確認

### 4.1 基本機能テスト

1. `https://vow-app.vercel.app` にアクセス
2. **Login** ページでGoogleログインをテスト
3. ダッシュボードでデータ作成・表示をテスト

### 4.2 Supabase Dashboard確認

1. Supabase → **Table Editor**
2. `goals`, `habits`, `activities` テーブルにデータが作成されることを確認

---

## 📊 完了チェックリスト

### ✅ Supabase
- [ ] プロジェクト作成完了
- [ ] データベーステーブル作成完了
- [ ] RLS ポリシー設定完了
- [ ] Google OAuth設定完了
- [ ] Site URL・Redirect URL設定完了
- [ ] API情報取得・保存完了

### ✅ Vercel
- [ ] GitHubリポジトリ接続完了
- [ ] 環境変数設定完了
- [ ] デプロイ成功確認
- [ ] カスタムドメイン取得完了

### ✅ 最終設定
- [ ] Supabase URL更新完了
- [ ] Google OAuth URI更新完了
- [ ] 動作確認完了

---

## 💰 コスト概算（月額）

| サービス | 無料枠 | 有料プラン |
|---------|--------|-----------|
| Supabase | 無料 | $25/月〜 |
| Vercel | 無料 | $20/月〜 |
| **合計** | **無料** | **$45/月〜** |

---

## ⏱️ 推定所要時間

- **初回（アカウント作成から）**: 20-30分
- **アカウント準備済み**: 10-15分
- **高速デプロイ（経験者）**: 5-10分

---

## 🎉 公開完了！

すべての設定が完了すると、以下のURLでアクセス可能になります：

- **WEBアプリ**: `https://vow-app.vercel.app`
- **API**: `https://jamiyzsyclvlvstmeeir.supabase.co/rest/v1`
- **データベース**: Supabase Dashboard

---

## 🔄 従来のExpress APIとの切り替え

環境変数 `NEXT_PUBLIC_USE_SUPABASE_API` を `false` に設定することで、従来のExpress APIに戻すことができます。

**最終更新**: 2026年1月4日  
**対象バージョン**: v2.0.0 (Supabase完全移行版)