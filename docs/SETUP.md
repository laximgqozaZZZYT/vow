# セットアップガイド

## 🚀 デプロイメント

### 現在の状況
- **本番URL**: https://vow-sigma.vercel.app/
- **ステータス**: ✅ 稼働中
- **デプロイ方法**: GitHub Actions + Vercel自動デプロイ

### 自動デプロイ（推奨）
1. `main`ブランチにpush
2. GitHub Actionsが自動実行
3. Vercelに自動デプロイ

### 手動デプロイ
```bash
cd frontend
vercel --prod
```

## ⚙️ Vercel設定

### 環境変数設定
Vercelダッシュボードで以下を設定：
```bash
NEXT_PUBLIC_SUPABASE_URL=https://jamiyzsyclvlvstmeeir.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
NEXT_PUBLIC_USE_SUPABASE_API=true
NEXT_PUBLIC_SITE_URL=https://vow-sigma.vercel.app
```

### プロジェクト設定
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

## 🗄️ Supabase設定

### 1. プロジェクト作成
1. [Supabase](https://supabase.com)でプロジェクト作成
2. データベースパスワード設定
3. プロジェクトURL・ANON KEYを取得

### 2. データベーススキーマ
```sql
-- scripts/supabase-schema.sql を実行
-- または Supabase Dashboard > SQL Editor で実行
```

### 3. Row Level Security (RLS)
```sql
-- scripts/fix-rls-policies.sql を実行
-- 全テーブルでRLSを有効化
```

### 4. Auth設定
**Site URL**: `https://vow-sigma.vercel.app`

**Redirect URLs**:
- `https://vow-sigma.vercel.app/**`
- `https://vow-sigma.vercel.app/dashboard`
- `http://localhost:3000/**` (開発用)

## 🔐 OAuth設定

### Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com/)
2. プロジェクト作成 → APIs & Services → Credentials
3. OAuth 2.0 Client ID作成

**承認済みJavaScript生成元**:
- `https://jamiyzsyclvlvstmeeir.supabase.co`
- `https://vow-sigma.vercel.app`

**承認済みリダイレクトURI**:
- `https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback`

4. Client IDをSupabaseに設定

### GitHub OAuth
1. GitHub Settings → Developer settings → OAuth Apps
2. New OAuth App作成

**Application name**: Vow App
**Homepage URL**: `https://vow-sigma.vercel.app`
**Authorization callback URL**: `https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback`

3. Client ID・Client SecretをSupabaseに設定

### Supabase Auth Provider設定
1. Supabase Dashboard → Authentication → Providers
2. Google・GitHub有効化
3. Client ID・Client Secret設定

## 🔧 GitHub Secrets設定

GitHub リポジトリ Settings → Secrets and variables → Actions:

```bash
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id
VERCEL_TOKEN=your_vercel_token
```

取得方法：
```bash
# Vercel CLI でログイン
vercel login

# プロジェクト情報取得
vercel project ls
```

## 🏠 ローカル開発設定

### 1. 環境変数
```bash
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://jamiyzsyclvlvstmeeir.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
NEXT_PUBLIC_USE_SUPABASE_API=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. OAuth設定（開発用）
**Supabase Redirect URLs**に追加:
- `http://localhost:3000/**`
- `http://localhost:3000/dashboard`

**Google OAuth**に追加:
- JavaScript生成元: `http://localhost:3000`

### 3. 開発サーバー起動
```bash
cd frontend
npm install
npm run dev
```

## ✅ 動作確認

### 機能テスト
- [ ] ダッシュボードアクセス (`/dashboard`)
- [ ] ログインページアクセス (`/login`)
- [ ] Google OAuth認証
- [ ] GitHub OAuth認証
- [ ] ゲストユーザー機能
- [ ] Goals作成・編集・削除
- [ ] Habits作成・編集・削除
- [ ] Activities記録

### パフォーマンス
- **ビルド時間**: ~30秒
- **デプロイ時間**: ~2分
- **初回読み込み**: ~2秒
- **キャッシュ後**: ~500ms

## 🚨 トラブルシューティング

### OAuth失敗
1. URL設定確認（Supabase・OAuth Provider）
2. Client ID・Secret確認
3. Redirect URL確認

### ビルドエラー
1. 依存関係確認: `npm install`
2. 環境変数確認
3. TypeScriptエラー確認

### データ同期失敗
1. ネットワーク接続確認
2. Supabase接続確認
3. 認証状態確認

### 緊急時対応
1. Vercelダッシュボードでロールバック
2. GitHub Actionsで再デプロイ
3. Supabaseダッシュボードでデータ確認