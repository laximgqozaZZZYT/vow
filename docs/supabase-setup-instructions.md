# 🚀 Supabase統合セットアップ手順

## 📋 **事前準備**

### 必要なツール
- Node.js 18以上
- npm または yarn
- Git
- Supabase CLI

### Supabase CLIインストール
```bash
# macOS
brew install supabase/tap/supabase

# Windows/Linux
npm install -g supabase

# インストール確認
supabase --version
```

## 🔧 **Step 1: Supabaseプロジェクト作成**

### 1.1 Supabaseアカウント作成
1. https://supabase.com にアクセス
2. **Start your project** → **Sign up**
3. GitHubアカウントで認証（推奨）

### 1.2 新しいプロジェクト作成
1. **New project** をクリック
2. 以下の設定で作成：
   ```
   Organization: Personal
   Project name: vow-app
   Database Password: [強力なパスワードを生成・保存]
   Region: Northeast Asia (Tokyo)
   Pricing Plan: Free
   ```
3. **Create new project** をクリック（2-3分待機）

### 1.3 プロジェクト情報取得
1. **Settings** → **API** をクリック
2. 以下の情報をコピー・保存：
   - Project URL: `https://abcdefghijklmnop.supabase.co`
   - anon public key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 🔧 **Step 2: ローカル環境設定**

### 2.1 環境変数設定
```bash
# frontend/.env.local を作成
cd frontend
cp .env.local.example .env.local

# 以下の値を設定
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
```

### 2.2 Supabaseプロジェクトとの接続
```bash
# プロジェクトルートで実行
supabase login
supabase link --project-ref your-project-id
```

### 2.3 データベースマイグレーション実行
```bash
# マイグレーションを本番環境に適用
supabase db push
```

## 🔧 **Step 3: OAuth設定**

### 3.1 Google Cloud Console設定
1. https://console.cloud.google.com にアクセス
2. プロジェクト選択（または新規作成）
3. **APIs & Services** → **Credentials**
4. **+ CREATE CREDENTIALS** → **OAuth 2.0 Client IDs**
5. 以下の設定：
   ```
   Application type: Web application
   Name: Vow App
   Authorized JavaScript origins:
     https://your-project-id.supabase.co
   Authorized redirect URIs:
     https://your-project-id.supabase.co/auth/v1/callback
   ```
6. **Client ID** と **Client Secret** をコピー

### 3.2 Supabase OAuth設定
1. Supabase → **Authentication** → **Providers**
2. **Google** をクリック
3. **Enable Google provider** をON
4. Google Cloud ConsoleからコピーしたClient IDとClient Secretを設定
5. **Save** をクリック

### 3.3 認証設定
1. **Authentication** → **Settings**
2. 以下を設定：
   ```
   Site URL: http://localhost:3000
   Additional Redirect URLs:
     http://localhost:3000/dashboard
   ```

## 🔧 **Step 4: Edge Functions デプロイ（オプション）**

Edge Functionsを使用する場合のみ実行：

```bash
# 環境変数を更新
echo "NEXT_PUBLIC_USE_EDGE_FUNCTIONS=true" >> frontend/.env.local

# Edge Functionsをデプロイ
supabase functions deploy goals
supabase functions deploy habits
supabase functions deploy activities
supabase functions deploy me
supabase functions deploy layout
```

## 🔧 **Step 5: ローカル開発環境での確認**

### 5.1 依存関係インストール
```bash
cd frontend
npm install
```

### 5.2 開発サーバー起動
```bash
npm run dev
```

### 5.3 動作確認
1. http://localhost:3000 にアクセス
2. **Login** ボタンをクリック
3. Googleアカウントでログイン
4. ダッシュボードでGoal/Habitの作成・表示を確認

### 5.4 コンソールログ確認
ブラウザの開発者ツールで以下のログを確認：
```
=== API Configuration Debug (Supabase Integrated) ===
SUPABASE_URL: https://your-project-id.supabase.co
USE_EDGE_FUNCTIONS: false
🚀 Using: Supabase Client Direct
[supabase] Initializing full Supabase client for integrated architecture
[auth] Setting up Supabase auth listener
```

## 🔧 **Step 6: 本番環境デプロイ**

### 6.1 静的サイトビルド
```bash
cd frontend
npm run build
```

### 6.2 Supabase Storageにデプロイ
```bash
# Storageバケット作成
supabase storage create-bucket website --public

# 静的ファイルをアップロード
supabase storage cp -r out/* supabase://website/
```

### 6.3 認証設定更新
1. Supabase → **Authentication** → **Settings**
2. Site URLを本番URLに更新：
   ```
   Site URL: https://your-project-id.supabase.co
   Additional Redirect URLs:
     https://your-project-id.supabase.co/dashboard
   ```

## 🔧 **Step 7: 動作確認**

### 7.1 本番環境アクセス
1. `https://your-project-id.supabase.co` にアクセス
2. Googleログインを実行
3. ダッシュボードでデータ操作を確認

### 7.2 トラブルシューティング
問題が発生した場合：
1. ブラウザの開発者ツールでエラーを確認
2. Supabase → **Logs** でサーバーログを確認
3. 認証設定（OAuth、Site URL）を再確認

## 📊 **完了チェックリスト**

- [ ] Supabaseプロジェクト作成完了
- [ ] 環境変数設定完了
- [ ] データベースマイグレーション完了
- [ ] Google OAuth設定完了
- [ ] ローカル開発環境動作確認完了
- [ ] 本番環境デプロイ完了
- [ ] 本番環境動作確認完了

## 🆘 **サポート**

問題が発生した場合：
- Supabase公式ドキュメント: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- プロジェクトのIssues: GitHub Issues

---

**最終更新**: 2026年1月5日  
**対象バージョン**: v2.0.0 - Supabase統合版