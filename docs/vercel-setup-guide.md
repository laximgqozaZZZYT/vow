# 🚀 Vercel デプロイメント設定ガイド

**GitHub Actions を使用したVercel自動デプロイメント**

## 📋 概要

このガイドでは、GitHub Actions を使用してVercelに自動デプロイメントを設定する手順を説明します。`vercel link` コマンドを使用して正確なプロジェクトIDを取得し、GitHub Secretsを設定します。

## 🎯 前提条件

- GitHubリポジトリが作成済み
- Vercelアカウントが作成済み
- Node.js 18以上がインストール済み
- プロジェクトのfrontendディレクトリにNext.jsアプリケーションが配置済み

---

## 1️⃣ Vercel CLI のインストールとログイン

### 1.1 Vercel CLI インストール

```bash
# グローバルインストール
npm install -g vercel@latest

# インストール確認
vercel --version
```

### 1.2 Vercel にログイン

```bash
# Vercelにログイン（ブラウザが開きます）
vercel login
```

ブラウザでVercelアカウントにログインし、CLIの認証を完了します。

---

## 2️⃣ プロジェクトのリンク設定

### 2.1 フロントエンドディレクトリでプロジェクトをリンク

```bash
# フロントエンドディレクトリに移動
cd frontend

# プロジェクトをVercelにリンク
vercel link
```

### 2.2 対話式設定の回答例

```
? Set up "~/your-project/frontend"? 
→ yes

? Which scope should contain your project? 
→ [your-username]'s projects

? Link to existing project? 
→ yes (既存プロジェクトがある場合)
→ no (新規プロジェクトを作成する場合)

? Which existing project do you want to link? 
→ vow-app (既存プロジェクト名を選択)

? What's your project's name? 
→ vow-app (新規作成の場合)

? In which directory is your code located? 
→ ./ (現在のディレクトリを指定)

? Would you like to pull environment variables now? 
→ yes

? Found existing file ".env.local". Do you want to overwrite? 
→ yes (既存の.env.localを上書きする場合)
→ no (既存の設定を保持する場合)
```

### 2.3 成功時の出力例

```
✅  Linked to [username]/vow-app (created .vercel)
> Downloading `development` Environment Variables for [username]/vow-app

Changes:
+ NEXT_PUBLIC_SITE_URL (Updated)
+ NEXT_PUBLIC_API_URL
+ NEXT_PUBLIC_USE_SUPABASE_API
+ VERCEL_OIDC_TOKEN
- NEXT_PUBLIC_USE_EDGE_FUNCTIONS

✅  Updated .env.local file and added it to .gitignore [234ms]
```

---

## 3️⃣ プロジェクト情報の取得

### 3.1 生成されたproject.jsonファイルの確認

```bash
# プロジェクト設定ファイルを確認
cat frontend/.vercel/project.json
```

出力例:
```json
{
  "projectId": "prj_NiIeslhoMvnJxcOhjyperZBK0sL7",
  "orgId": "team_QmPnguvsyqEOme9EvPAhijpF",
  "projectName": "vow-app"
}
```

### 3.2 重要な情報の記録

以下の情報をメモしてください：

- **VERCEL_PROJECT_ID**: `prj_NiIeslhoMvnJxcOhjyperZBK0sL7`
- **VERCEL_ORG_ID**: `team_QmPnguvsyqEOme9EvPAhijpF`

---

## 4️⃣ Vercel トークンの生成

### 4.1 Vercel Dashboard でトークン作成

1. [Vercel Dashboard](https://vercel.com/account/tokens) にアクセス
2. **Account Settings** → **Tokens** をクリック
3. **Create Token** をクリック

### 4.2 トークン設定

```
Token Name: GitHub Actions Deploy
Scope: [your-username] (個人アカウントの場合)
Expiration: No Expiration (推奨) または 1 year
```

### 4.3 トークンのコピー

生成されたトークンをコピーして安全な場所に保存します：
```
vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **重要**: このトークンは一度しか表示されません。必ずコピーして保存してください。

---

## 5️⃣ GitHub Secrets の設定

### 5.1 GitHub リポジトリでSecrets設定

1. GitHubリポジトリにアクセス
2. **Settings** → **Secrets and variables** → **Actions** をクリック
3. **New repository secret** をクリック

### 5.2 必須Secretsの追加

以下のSecretsを順番に追加します：

#### VERCEL_TOKEN
```
Name: VERCEL_TOKEN
Secret: vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### VERCEL_PROJECT_ID
```
Name: VERCEL_PROJECT_ID
Secret: prj_NiIeslhoMvnJxcOhjyperZBK0sL7
```

#### VERCEL_ORG_ID
```
Name: VERCEL_ORG_ID
Secret: team_QmPnguvsyqEOme9EvPAhijpF
```

### 5.3 Supabase環境変数の追加

Supabaseを使用している場合、以下も追加：

#### NEXT_PUBLIC_SUPABASE_URL
```
Name: NEXT_PUBLIC_SUPABASE_URL
Secret: https://abcdefghijklmnop.supabase.co
```

#### NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Secret: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 6️⃣ GitHub Actions ワークフローの確認

### 6.1 ワークフローファイルの確認

`.github/workflows/deploy.yml` ファイルが存在し、正しく設定されていることを確認：

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 'frontend/package-lock.json'
      
      - name: Install frontend dependencies
        run: cd frontend && npm install
      
      - name: Build frontend (Vercel)
        run: cd frontend && npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_USE_EDGE_FUNCTIONS: false
          NEXT_STATIC_EXPORT: false

  deploy-vercel:
    needs: frontend-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 'frontend/package-lock.json'
      
      - name: Install dependencies
        run: cd frontend && npm install
      
      - name: Install Vercel CLI
        run: npm install -g vercel@latest
      
      - name: Deploy to Vercel
        run: |
          vercel --prod --token=${{ secrets.VERCEL_TOKEN }} --yes
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_USE_EDGE_FUNCTIONS: false
          NEXT_STATIC_EXPORT: false
```

---

## 7️⃣ デプロイメントのテスト

### 7.1 手動デプロイメントテスト

```bash
# ローカルでVercelデプロイメントをテスト
cd frontend
vercel --prod
```

成功すると、デプロイメントURLが表示されます：
```
✅  Production: https://vow-app.vercel.app [2s]
```

### 7.2 GitHub Actions デプロイメントテスト

```bash
# 変更をコミット・プッシュ
git add .
git commit -m "Setup Vercel deployment configuration"
git push origin main
```

### 7.3 デプロイメント確認

1. **GitHub Actions**: リポジトリ → **Actions** タブでワークフローの実行を確認
2. **Vercel Dashboard**: [Vercel Dashboard](https://vercel.com/dashboard) でデプロイメント状況を確認
3. **本番サイト**: 生成されたURLにアクセスして動作確認

---

## 8️⃣ トラブルシューティング

### 8.1 よくあるエラーと解決方法

#### "Project not found" エラー
```bash
Error: Project not found ({"VERCEL_PROJECT_ID":"***","VERCEL_ORG_ID":"***"})
```

**解決方法**:
1. `frontend/.vercel/project.json` の内容を再確認
2. GitHub SecretsのVERCEL_PROJECT_IDとVERCEL_ORG_IDを更新
3. `vercel link` を再実行

#### "Authentication failed" エラー
```bash
Error: Authentication failed
```

**解決方法**:
1. Vercelトークンが正しいか確認
2. トークンの有効期限を確認
3. 新しいトークンを生成してGitHub Secretsを更新

#### ビルドエラー
```bash
Error: Command "npm run build" exited with 1
```

**解決方法**:
1. ローカルで `npm run build` を実行してエラーを確認
2. 環境変数が正しく設定されているか確認
3. 依存関係を再インストール: `rm -rf node_modules package-lock.json && npm install`

### 8.2 デバッグ用コマンド

```bash
# Vercel CLI の認証状況確認
vercel whoami

# プロジェクトの詳細情報確認
vercel inspect

# 環境変数の確認
vercel env ls

# ローカルでの本番ビルドテスト
cd frontend
npm run build
npm start
```

---

## 9️⃣ 高度な設定

### 9.1 カスタムドメインの設定

1. **Vercel Dashboard** → プロジェクト → **Settings** → **Domains**
2. **Add Domain** をクリック
3. ドメイン名を入力（例：`vow-app.com`）
4. DNS設定でCNAMEレコードを追加：
   ```
   Type: CNAME
   Name: @ (または www)
   Value: cname.vercel-dns.com
   ```

### 9.2 環境変数の管理

**Vercel Dashboard での設定**:
1. プロジェクト → **Settings** → **Environment Variables**
2. 環境ごとに変数を設定（Production, Preview, Development）

**CLI での設定**:
```bash
# 環境変数の追加
vercel env add NEXT_PUBLIC_API_URL production

# 環境変数の一覧表示
vercel env ls

# 環境変数の削除
vercel env rm NEXT_PUBLIC_API_URL production
```

### 9.3 プレビューデプロイメント

プルリクエスト作成時に自動でプレビュー環境が作成されます：

```yaml
# .github/workflows/preview.yml
name: Preview Deployment

on:
  pull_request:
    branches: [main]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel (Preview)
        run: |
          vercel --token=${{ secrets.VERCEL_TOKEN }} --yes
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## ✅ 完了チェックリスト

- [ ] Vercel CLI インストール・ログイン完了
- [ ] `vercel link` でプロジェクトリンク完了
- [ ] プロジェクトID・オーガニゼーションID取得完了
- [ ] Vercelトークン生成完了
- [ ] GitHub Secrets設定完了（5つのSecret）
- [ ] GitHub Actions ワークフロー確認完了
- [ ] 手動デプロイメントテスト成功
- [ ] GitHub Actions デプロイメントテスト成功
- [ ] 本番サイト動作確認完了
- [ ] カスタムドメイン設定完了（オプション）

---

## 📚 参考リンク

- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [GitHub Actions with Vercel](https://vercel.com/guides/how-can-i-use-github-actions-with-vercel)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**最終更新**: 2026年1月7日  
**対象バージョン**: Vercel CLI 50.1.6+