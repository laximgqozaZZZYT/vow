# 🚀 WEBサービス公開ガイド

**Supabase統合による簡素化されたデプロイ手順**

## 📋 事前準備

### 必要なアカウント
- **GitHub**（コード管理）- https://github.com
- **Supabase**（フルスタック統合プラットフォーム）- https://supabase.com

### デプロイ構成
```
┌─────────────────────────────────────────────────────────┐
│                    Supabase                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │  Frontend   │ │ Database    │ │   Auth/OAuth    │   │
│  │  Hosting    │ │ PostgreSQL  │ │   Google/GitHub │   │
│  │  (Static)   │ │ + RLS       │ │   JWT Tokens    │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**アーキテクチャ**: 開発・本番環境ともにSupabase統合プラットフォームを使用します。フロントエンドは静的ホスティング、データベースはSupabase PostgreSQL、認証はSupabase Authを使用します。

---

## 1️⃣ GitHub設定（コード管理）

### 1.1 リポジトリ作成・プッシュ

```bash
# 現在のプロジェクトをGitHubにプッシュ
git init
git add .
git commit -m "Initial commit - Vow app ready for Supabase deployment"

# GitHubでリポジトリ作成後
git remote add origin https://github.com/yourusername/vow.git
git branch -M main
git push -u origin main
```

### 1.2 GitHub設定確認

1. https://github.com にアクセス
2. **New repository** をクリック
3. Repository name: `vow`
4. Public または Private を選択
5. **Create repository** をクリック

---

## 2️⃣ Supabase設定（統合プラットフォーム）

### 2.1 プロジェクト作成

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

### 2.2 プロジェクト情報取得

プロジェクト作成完了後：

1. **Settings** → **API** をクリック
2. 以下の情報をコピー・保存：

```bash
# 重要な情報
Project URL: https://abcdefghijklmnop.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.3 データベース設定

1. **SQL Editor** をクリック
2. 以下のSQLを実行してテーブルを作成：

```sql
-- データベーススキーマの作成
-- 詳細は scripts/supabase-schema.sql を参照

-- 基本テーブル作成
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_type TEXT NOT NULL DEFAULT 'user',
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_type TEXT NOT NULL DEFAULT 'user',
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_type TEXT NOT NULL DEFAULT 'user',
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diary_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  front_md TEXT NOT NULL,
  back_md TEXT NOT NULL,
  owner_type TEXT NOT NULL DEFAULT 'user',
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diary_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  owner_type TEXT NOT NULL DEFAULT 'user',
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 有効化
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_tags ENABLE ROW LEVEL SECURITY;

-- RLSポリシー作成（厳密なデータ分離）
CREATE POLICY "Users can only access their own goals" ON goals
  FOR ALL USING (owner_type = 'user' AND owner_id = auth.uid());

CREATE POLICY "Users can only access their own habits" ON habits
  FOR ALL USING (owner_type = 'user' AND owner_id = auth.uid());

CREATE POLICY "Users can only access their own activities" ON activities
  FOR ALL USING (owner_type = 'user' AND owner_id = auth.uid());

CREATE POLICY "Users can only access their own diary cards" ON diary_cards
  FOR ALL USING (owner_type = 'user' AND owner_id = auth.uid());

CREATE POLICY "Users can only access their own diary tags" ON diary_tags
  FOR ALL USING (owner_type = 'user' AND owner_id = auth.uid());
```

### 2.4 認証設定

1. **Authentication** → **Settings** をクリック
2. **General settings**:

```
Site URL: https://abcdefghijklmnop.supabase.co
Additional Redirect URLs: 
  https://abcdefghijklmnop.supabase.co/dashboard
  https://abcdefghijklmnop.supabase.co/login
```

### 2.5 Google OAuth設定

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
  https://abcdefghijklmnop.supabase.co
Authorized redirect URIs:
  https://abcdefghijklmnop.supabase.co/auth/v1/callback
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

### 2.6 セキュリティ設定

1. **Authentication** → **Settings** → **Security**
2. **Enable password protection** をONにする
3. **Minimum password length**: 8文字以上に設定

### 2.7 Storage設定（静的ファイルホスティング用）

1. **Storage** をクリック
2. **Create a new bucket** をクリック
3. Bucket name: `website`
4. **Public bucket** をONにする
5. **Create bucket** をクリック

---

## 3️⃣ フロントエンド設定とビルド

### 3.1 環境変数設定

プロジェクトルートの `frontend/.env.local` ファイルを作成・更新：

```bash
# Supabase設定（Step 2.2で取得した情報を使用）
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase統合版設定
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
```

### 3.2 ローカルテスト

```bash
# フロントエンドディレクトリに移動
cd frontend

# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev
```

1. http://localhost:3000 にアクセス
2. Googleログインをテスト
3. ダッシュボードでデータ作成・表示をテスト

### 3.3 本番ビルド

```bash
# 本番用ビルド
npm run build

# ビルド成功を確認
# ✓ Compiled successfully が表示されることを確認
```

---

## 4️⃣ Supabase静的ホスティングデプロイ

### 4.1 Supabase CLI インストール

```bash
# macOS
brew install supabase/tap/supabase

# Windows (PowerShell)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux/WSL
curl -fsSL https://supabase.com/install.sh | sh

# npm (全プラットフォーム)
npm install -g supabase
```

### 4.2 プロジェクトとの接続

```bash
# プロジェクトルートで実行
supabase login

# プロジェクトIDを使用してリンク（Step 2.2のProject URLから取得）
supabase link --project-ref abcdefghijklmnop
```

### 4.3 Next.js Static Export設定

フロントエンドをSupabase Storageで静的ホスティングするため、Next.jsの設定を更新：

```bash
# frontend/next.config.ts を確認・更新
```

`next.config.ts`に以下を追加：
```typescript
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // 既存の設定...
};
```

### 4.4 静的サイトビルドとデプロイ

```bash
# フロントエンドディレクトリに移動
cd frontend

# 静的サイト用ビルド
npm run build

# outディレクトリが生成されることを確認
ls -la out/

# Supabase Storageにアップロード
supabase storage cp -r out/* supabase://website/

# アップロード確認
supabase storage ls website
```

### 4.5 Supabase Storage公開設定

1. Supabase Dashboard → **Storage** → **website** bucket
2. **Settings** → **Public** をONにする
3. **Public URL**を確認（例：`https://abcdefghijklmnop.supabase.co/storage/v1/object/public/website/`）

### 4.6 カスタムドメイン設定（オプション）

1. Supabase Dashboard → **Settings** → **Custom Domains**
2. 独自ドメインを追加（例：`vow-app.com`）
3. DNS設定でCNAMEレコードを追加
4. SSL証明書の自動発行を待機

---

## 5️⃣ 動作確認とテスト

### 5.1 基本機能テスト

**Supabase静的ホスティングの場合**:
1. `https://abcdefghijklmnop.supabase.co/storage/v1/object/public/website/index.html` にアクセス

**共通テスト項目**:
2. **Login** ページでGoogleログインをテスト
3. ダッシュボードでデータ作成・表示をテスト
4. 異なるブラウザ/シークレットモードでデータ分離を確認

### 5.2 セキュリティテスト

```bash
# プロジェクトルートでセキュリティテスト実行
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
npm run security-full
```

期待される結果:
```
📊 Supabase Security Test Results
==================================
✅ Passed: 9
❌ Failed: 0
📈 Success Rate: 100%
```

### 5.3 パフォーマンステスト

1. **Lighthouse** でパフォーマンス測定
2. **Core Web Vitals** の確認
3. **Mobile Responsiveness** のテスト

---

## 📊 完了チェックリスト

### ✅ GitHub
- [ ] リポジトリ作成・プッシュ完了
- [ ] GitHub Actions テスト成功

### ✅ Supabase
- [ ] プロジェクト作成完了
- [ ] データベーステーブル作成完了
- [ ] RLSポリシー設定完了
- [ ] Google OAuth設定完了
- [ ] セキュリティ設定完了
- [ ] Storage bucket作成完了
- [ ] 静的サイトアップロード完了
- [ ] カスタムドメイン設定完了（オプション）

### ✅ 最終確認
- [ ] 基本機能テスト完了
- [ ] セキュリティテスト完了
- [ ] パフォーマンステスト完了
- [ ] 本番環境動作確認完了

---

## 💰 コスト概算（月額）

| サービス | 無料枠 | 有料プラン |
|---------|--------|-----------|
| **Supabase** | 無料（500MB DB、1GB Storage、50MB転送） | $25/月〜（8GB DB、100GB Storage、250GB転送） |
| **Google Cloud** | 無料（OAuth使用のみ） | 無料 |
| **合計** | **無料** | **$25/月〜** |

**推奨**: 初期は無料枠で開始し、トラフィック増加に応じて有料プランに移行

---

## ⏱️ 推定所要時間

- **初回（アカウント作成から）**: **15-20分**
- **アカウント準備済み**: **8-12分**
- **高速デプロイ（経験者）**: **3-5分**

---

## 🎉 公開完了！

すべての設定が完了すると、以下のURLでアクセス可能になります：

**Supabase静的ホスティング**:
- **WEBアプリ**: `https://abcdefghijklmnop.supabase.co/storage/v1/object/public/website/index.html`
- **API**: Supabaseクライアント経由でアクセス

**カスタムドメイン設定時**:
- **WEBアプリ**: `https://vow-app.com`

---

## 🔧 トラブルシューティング

### よくある問題と解決方法

**1. ビルドエラー**
```bash
# 依存関係の再インストール
cd frontend
rm -rf node_modules package-lock.json
npm install

# Next.js Static Export用ビルド
npm run build
```

**2. 認証エラー**
- Supabase OAuth設定を再確認
- Google Cloud Console のRedirect URIを確認
- ブラウザキャッシュをクリア

**3. データが表示されない**
- RLSポリシーが正しく設定されているか確認
- ユーザーがログインしているか確認
- ブラウザの開発者ツールでエラーを確認

**4. 静的サイトアップロードエラー**
```bash
# Supabase CLI再認証
supabase logout
supabase login

# プロジェクト再リンク
supabase link --project-ref abcdefghijklmnop

# Storage bucket確認
supabase storage ls
```

**5. Next.js Static Export問題**
- `next.config.ts`で`output: 'export'`が設定されているか確認
- `images.unoptimized: true`が設定されているか確認
- 動的ルーティングを使用していないか確認

**6. Supabase Storage公開設定**
- Storage bucketが公開設定になっているか確認
- 正しいPublic URLでアクセスしているか確認

---

**最終更新**: 2026年1月5日  
**対象バージョン**: v2.0.0 - Supabase統合版