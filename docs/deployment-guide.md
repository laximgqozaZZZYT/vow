# 🚀 WEBサービス公開ガイド

外部プラットフォームを最大限活用した詳細デプロイ手順

## 📋 事前準備

### 必要なアカウント
- **GitHub**（コード管理）- https://github.com
- **Supabase**（データベース + 認証）- https://supabase.com
- **Vercel**（フロントエンド + API Routes）- https://vercel.com

### デプロイ構成
```
┌─────────────────┐    ┌─────────────────┐
│   Vercel        │    │   Supabase      │
│   (Frontend)    │───▶│   (Database)    │
│   Next.js       │    │   PostgreSQL    │
│   API Routes    │    │   Auth/OAuth    │
└─────────────────┘    └─────────────────┘
```

**注意**: 開発環境では Express API + MySQL を使用しますが、本番環境では Next.js API Routes + Supabase PostgreSQL を使用します。

---

## 1️⃣ GitHub設定（コード管理）

### 1.1 リポジトリ作成・プッシュ

```bash
# 現在のプロジェクトをGitHubにプッシュ
git init
git add .
git commit -m "Initial commit - Vow app ready for deployment"

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

## 2️⃣ Supabase設定（認証基盤）

### 2.1 プロジェクト作成

1. https://supabase.com にアクセス
2. **Start your project** → **Sign up**（GitHubアカウント推奨）
3. **New project** をクリック

**プロジェクト設定**:
```
Organization: Personal（または新規作成）
Project name: vow-auth
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
# 後で使用する重要な情報
Project URL: https://abcdefghijklmnop.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.3 認証設定

1. **Authentication** → **Settings** をクリック
2. **General settings**:

```
Site URL: http://localhost:3000
Additional Redirect URLs: 
  http://localhost:3000/dashboard
  (後でVercelドメインを追加)
```

### 2.4 Google OAuth設定

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

---

## 3️⃣ Railway設定（バックエンド + データベース）

### 3.1 アカウント作成・ログイン

1. https://railway.app にアクセス
2. **Login with GitHub** をクリック
3. GitHubアカウントで認証

### 3.2 プロジェクト作成

1. **New Project** をクリック
2. **Deploy from GitHub repo** を選択
3. 先ほど作成した `vow` リポジトリを選択
4. **Deploy Now** をクリック

### 3.3 PostgreSQLデータベース追加

1. プロジェクトダッシュボードで **+ New** をクリック
2. **Database** → **Add PostgreSQL** を選択
3. 自動的にデータベースが作成される

### 3.4 バックエンドサービス設定

#### Root Directory設定

1. バックエンドサービス（`vow`）をクリック
2. **Settings** → **Service**
3. **Root Directory**: `backend` を入力
4. **Save Changes**

#### 環境変数設定

**Settings** → **Variables** で以下を設定：

```bash
# 必須設定
NODE_ENV=production
VOW_COOKIE_SECURE=true

# Supabase設定（Supabaseの情報を使用）
SUPABASE_JWKS_URL=https://abcdefghijklmnop.supabase.co/.well-known/jwks.json
SUPABASE_JWT_AUD=authenticated
SUPABASE_JWT_ISS=https://abcdefghijklmnop.supabase.co/auth/v1

# CORS設定（後でVercelドメインに更新）
CORS_ORIGINS=https://localhost:3000

# OAuth設定（Google Cloud Consoleの情報）
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop

# レート制限設定
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3.5 カスタムドメイン設定

1. **Settings** → **Networking**
2. **Public Networking** → **Generate Domain**
3. 生成されたドメインをコピー（例：`vow-backend-production.up.railway.app`）

### 3.6 デプロイ確認

1. **Deployments** タブでビルド状況を確認
2. ログでエラーがないことを確認
3. 生成されたURLにアクセスして `/health` エンドポイントをテスト

```bash
# ヘルスチェック
curl https://vow-backend-production.up.railway.app/health
# 期待される応答: {"ok":true}
```

---

## 4️⃣ Vercel設定（フロントエンド）

### 4.1 アカウント作成・ログイン

1. https://vercel.com にアクセス
2. **Sign Up** → **Continue with GitHub**
3. GitHubアカウントで認証

### 4.2 プロジェクト作成

1. **Add New...** → **Project** をクリック
2. **Import Git Repository** で `vow` リポジトリを選択
3. **Import** をクリック

### 4.3 プロジェクト設定

**Configure Project**画面で：

```
Framework Preset: Next.js
Root Directory: frontend
Build Command: npm run build
Output Directory: (空白のまま)
Install Command: npm install
```

### 4.4 環境変数設定

**Environment Variables** セクションで以下を追加：

```bash
# Railway バックエンドURL
NEXT_PUBLIC_API_URL=https://vow-backend-production.up.railway.app

# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.5 デプロイ実行

1. **Deploy** をクリック
2. ビルド完了まで待機（3-5分）
3. 生成されたドメインをコピー（例：`vow-app.vercel.app`）

---

## 5️⃣ 最終設定更新

### 5.1 Supabase URL更新

1. Supabase → **Authentication** → **Settings**
2. **Site URL**: `https://vow-app.vercel.app`
3. **Additional Redirect URLs**に追加:
   ```
   https://vow-app.vercel.app/dashboard
   https://vow-app.vercel.app/login
   ```

### 5.2 Railway CORS更新

1. Railway → **Variables**
2. `CORS_ORIGINS` を更新:
   ```
   CORS_ORIGINS=https://vow-app.vercel.app
   ```
3. 自動的に再デプロイされる

### 5.3 Google OAuth Redirect URI更新

1. Google Cloud Console → **Credentials**
2. OAuth 2.0 Client IDを編集
3. **Authorized redirect URIs**に追加:
   ```
   https://abcdefghijklmnop.supabase.co/auth/v1/callback
   ```

---

## 6️⃣ 動作確認

### 6.1 基本機能テスト

1. `https://vow-app.vercel.app` にアクセス
2. **Login** ページでGoogleログインをテスト
3. ダッシュボードでデータ作成・表示をテスト

### 6.2 セキュリティテスト

```bash
# ローカルでセキュリティテスト実行
NEXT_PUBLIC_API_URL=https://vow-backend-production.up.railway.app \
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co \
npm run security-full
```

---

## 📊 完了チェックリスト

### ✅ Supabase
- [ ] プロジェクト作成完了
- [ ] Google OAuth設定完了
- [ ] Site URL・Redirect URL設定完了
- [ ] API情報取得・保存完了

### ✅ Railway
- [ ] GitHubリポジトリ接続完了
- [ ] PostgreSQL追加完了
- [ ] 環境変数設定完了
- [ ] カスタムドメイン生成完了
- [ ] デプロイ成功確認

### ✅ Vercel
- [ ] GitHubリポジトリ接続完了
- [ ] 環境変数設定完了
- [ ] デプロイ成功確認
- [ ] カスタムドメイン取得完了

### ✅ 最終設定
- [ ] Supabase URL更新完了
- [ ] Railway CORS更新完了
- [ ] Google OAuth URI更新完了
- [ ] 動作確認完了

---

## 💰 コスト概算（月額）

| サービス | 無料枠 | 有料プラン |
|---------|--------|-----------|
| Railway | $5/月 | $20/月〜 |
| Vercel | 無料 | $20/月〜 |
| Supabase | 無料 | $25/月〜 |
| **合計** | **$5/月** | **$65/月〜** |

---

## ⏱️ 推定所要時間

- **初回（アカウント作成から）**: 30-45分
- **アカウント準備済み**: 10-15分
- **高速デプロイ（経験者）**: 5-10分

---

## 🎉 公開完了！

すべての設定が完了すると、以下のURLでアクセス可能になります：

- **WEBアプリ**: `https://vow-app.vercel.app`
- **API**: `https://vow-backend-production.up.railway.app`

---

**最終更新**: 2026年1月3日  
**対象バージョン**: v1.0.0