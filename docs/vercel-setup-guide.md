# Vercelプロジェクトセットアップガイド

## 1. Vercelアカウント作成・ログイン

1. https://vercel.com にアクセス
2. **Sign Up** または **Login** をクリック
3. **Continue with GitHub** を選択（推奨）
4. GitHubアカウントでの認証を完了

## 2. プロジェクトインポート

### 2.1 新規プロジェクト作成
1. Vercelダッシュボードで **Add New...** → **Project** をクリック
2. **Import Git Repository** セクションでGitHubリポジトリを選択
3. リポジトリ名を検索または一覧から選択
4. **Import** をクリック

### 2.2 プロジェクト設定
**Configure Project** 画面で以下を設定：

```
Project Name: vow-app (または任意の名前)
Framework Preset: Next.js
Root Directory: frontend
Build and Output Settings:
  Build Command: npm run build
  Output Directory: .next
  Install Command: npm install
```

### 2.3 環境変数設定
**Environment Variables** セクションで以下を追加：

```
NEXT_PUBLIC_SUPABASE_URL=https://jamiyzsyclvlvstmeeir.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
NEXT_STATIC_EXPORT=false
```

**重要**: 最初のデプロイは **Deploy** ボタンを押さずに、**Skip** または後で設定します。

## 3. GitHub Actions CI/CD用設定

### 3.1 自動デプロイメント無効化
1. プロジェクト作成後、**Settings** → **Git** に移動
2. **Auto-deploy** セクションで以下を無効化：
   - **Production Branch**: `main` のチェックを外す
   - **Preview Branches**: 無効化
   - **Automatic deployments from Git**: 無効化

### 3.2 Vercel CLI用トークン取得
1. **Settings** → **Tokens** に移動
2. **Create Token** をクリック
3. Token名: `GitHub Actions CI/CD`
4. Scope: **Full Account**
5. Expiration: **No Expiration** または適切な期間
6. **Create** をクリック
7. 生成されたトークンをコピー・保存（後でGitHub Secretsに設定）

### 3.3 プロジェクト情報取得
以下の情報を取得・記録：

1. **Project ID**: プロジェクト設定の **General** タブで確認
2. **Team ID (Org ID)**: アカウント設定で確認
3. **Project URL**: デプロイ後のURL（例：https://vow-app.vercel.app）

## 4. 設定確認

### 4.1 ビルド設定確認
**Settings** → **Functions** で以下を確認：
- **Node.js Version**: 20.x
- **Region**: Washington, D.C., USA (iad1) または Tokyo, Japan (nrt1)

### 4.2 ドメイン設定（オプション）
**Settings** → **Domains** でカスタムドメインを設定可能

## 5. 次のステップ

1. GitHub SecretsにVercel情報を設定
2. GitHub ActionsワークフローをVercel対応に更新
3. CI/CDパイプラインでのデプロイメントテスト

## トラブルシューティング

### ビルドエラーが発生する場合
1. **Root Directory** が `frontend` に設定されているか確認
2. **Build Command** が `npm run build` になっているか確認
3. 環境変数が正しく設定されているか確認

### 環境変数が反映されない場合
1. 環境変数の **Environment** 設定を確認（Production, Preview, Development）
2. プロジェクトを再デプロイ
3. Vercelキャッシュをクリア