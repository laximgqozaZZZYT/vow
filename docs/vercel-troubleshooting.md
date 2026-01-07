# 🔧 Vercel デプロイメント トラブルシューティング

**GitHub Actions Vercel デプロイメントの問題解決ガイド**

## 📋 概要

このドキュメントでは、Vercelデプロイメントでよく発生する問題とその解決方法をまとめています。特に「Project not found」エラーの解決に焦点を当てています。

---

## 🚨 よくある問題と解決方法

### 1. "Project not found" エラー

#### 問題の症状
```bash
Vercel CLI 50.1.6
> NOTE: The Vercel CLI now collects telemetry regarding usage of the CLI.
> This information is used to shape the CLI roadmap and prioritize features.
> You can learn more, including how to opt-out if you'd not like to participate in this program, by visiting the following URL:
> https://vercel.com/docs/cli/about-telemetry
Retrieving project…
Error: Project not found ({"VERCEL_PROJECT_ID":"***","VERCEL_ORG_ID":"***"})
Error: Process completed with exit code 1.
```

#### 原因
1. **不正確なプロジェクトID**: GitHub SecretsのVERCEL_PROJECT_IDが間違っている
2. **不正確なオーガニゼーションID**: GitHub SecretsのVERCEL_ORG_IDが間違っている
3. **プロジェクトが存在しない**: Vercelにプロジェクトが作成されていない
4. **権限不足**: Vercelトークンに適切な権限がない

#### 解決方法

**Step 1: vercel link を使用して正確なIDを取得**

```bash
# 1. Vercel CLI をインストール
npm install -g vercel@latest

# 2. Vercelにログイン
vercel login

# 3. フロントエンドディレクトリでプロジェクトをリンク
cd frontend
vercel link
```

**Step 2: 生成されたproject.jsonを確認**

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

**Step 3: GitHub Secretsを更新**

GitHubリポジトリ → Settings → Secrets and variables → Actions で以下を更新：

```
VERCEL_PROJECT_ID = prj_NiIeslhoMvnJxcOhjyperZBK0sL7
VERCEL_ORG_ID = team_QmPnguvsyqEOme9EvPAhijpF
```

---

### 2. 認証エラー

#### 問題の症状
```bash
Error: Authentication failed
Error: Invalid token
```

#### 解決方法

**新しいVercelトークンを生成**

1. [Vercel Dashboard](https://vercel.com/account/tokens) → Account Settings → Tokens
2. **Create Token** をクリック
3. 適切な名前を設定（例：`GitHub Actions Deploy`）
4. 生成されたトークンをGitHub Secretsの`VERCEL_TOKEN`に設定

---

### 3. ビルドエラー

#### 問題の症状
```bash
Error: Command "npm run build" exited with 1
```

#### 解決方法

**ローカルでビルドテスト**

```bash
cd frontend

# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install

# ローカルビルドテスト
npm run build
```

**環境変数の確認**

GitHub Secretsで以下が正しく設定されているか確認：
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

### 4. 個人アカウント vs チームアカウントの混同

#### 個人アカウントの場合

- **VERCEL_ORG_ID**: ユーザー名と同じ値を使用
- **確認方法**: Vercel Dashboard → Account Settings → General → Username

#### チームアカウントの場合

- **VERCEL_ORG_ID**: チームIDを使用
- **確認方法**: Vercel Dashboard → Team Settings → General → Team ID

---

### 5. GitHub Actions ワークフローエラー

#### 問題の症状
```bash
Error: Cannot find module 'vercel'
```

#### 解決方法

**ワークフローファイルの確認**

`.github/workflows/deploy.yml` で以下が含まれているか確認：

```yaml
- name: Install Vercel CLI
  run: npm install -g vercel@latest

- name: Deploy to Vercel
  run: |
    vercel --prod --token=${{ secrets.VERCEL_TOKEN }} --yes
  env:
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 🔍 デバッグ手順

### 1. 基本情報の確認

```bash
# Vercel CLI バージョン確認
vercel --version

# ログイン状況確認
vercel whoami

# プロジェクト情報確認
vercel inspect
```

### 2. プロジェクト設定の確認

```bash
# .vercel ディレクトリの確認
ls -la frontend/.vercel/

# project.json の内容確認
cat frontend/.vercel/project.json
```

### 3. 手動デプロイメントテスト

```bash
# ローカルから手動デプロイ
cd frontend
vercel --prod

# 成功すると URL が表示される
# ✅  Production: https://vow-app.vercel.app [2s]
```

### 4. GitHub Secrets の確認

GitHub リポジトリで以下のSecretsが設定されているか確認：

- ✅ `VERCEL_TOKEN`
- ✅ `VERCEL_PROJECT_ID`
- ✅ `VERCEL_ORG_ID`
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 📝 完全な設定手順（まとめ）

### 1. Vercel CLI セットアップ
```bash
npm install -g vercel@latest
vercel login
```

### 2. プロジェクトリンク
```bash
cd frontend
vercel link
```

### 3. プロジェクト情報取得
```bash
cat frontend/.vercel/project.json
```

### 4. Vercelトークン生成
- [Vercel Dashboard](https://vercel.com/account/tokens) でトークン作成

### 5. GitHub Secrets設定
- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_ORG_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 6. デプロイメントテスト
```bash
git add .
git commit -m "Setup Vercel deployment"
git push origin main
```

---

## 🎯 成功の確認方法

### 1. GitHub Actions
- リポジトリ → Actions → ワークフローが緑色（成功）

### 2. Vercel Dashboard
- [Vercel Dashboard](https://vercel.com/dashboard) → プロジェクト → デプロイメント履歴

### 3. 本番サイト
- 生成されたURL（例：`https://vow-app.vercel.app`）にアクセス

---

## 📞 サポートリソース

### 公式ドキュメント
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [GitHub Actions with Vercel](https://vercel.com/guides/how-can-i-use-github-actions-with-vercel)

### コミュニティ
- [Vercel Community Discussions](https://github.com/vercel/community/discussions)
- [Next.js Discussions](https://github.com/vercel/next.js/discussions)

### エラーログの確認場所
1. **GitHub Actions**: リポジトリ → Actions → 失敗したワークフロー
2. **Vercel Dashboard**: プロジェクト → Functions → ログ
3. **ブラウザ**: 開発者ツール → Console

---

**最終更新**: 2026年1月7日  
**対象バージョン**: Vercel CLI 50.1.6+