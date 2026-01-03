# ✅ デプロイメント チェックリスト

WEBサービス公開時の設定確認用チェックリスト

## 📋 事前準備

### アカウント作成
- [ ] GitHub アカウント作成・ログイン
- [ ] Supabase アカウント作成・ログイン
- [ ] Railway アカウント作成・ログイン
- [ ] Vercel アカウント作成・ログイン
- [ ] Google Cloud Console アカウント作成・ログイン

### ローカル環境
- [ ] Node.js 18+ インストール確認
- [ ] npm インストール確認
- [ ] Git インストール確認
- [ ] プロジェクトのビルド成功確認

---

## 1️⃣ GitHub設定

### リポジトリ設定
- [ ] GitHubリポジトリ作成完了
- [ ] ローカルコードをプッシュ完了
- [ ] リポジトリがPublicまたは適切な権限設定
- [ ] README.md更新完了

---

## 2️⃣ Supabase設定

### プロジェクト作成
- [ ] Supabaseプロジェクト作成完了
- [ ] プロジェクト名設定: `vow-auth`
- [ ] リージョン設定: `Northeast Asia (Tokyo)`
- [ ] データベースパスワード設定・保存

### API情報取得
- [ ] Project URL取得・保存: `https://abcdefghijklmnop.supabase.co`
- [ ] anon public key取得・保存
- [ ] service_role key取得・保存（使用しないが念のため）

### 認証設定
- [ ] Site URL設定: `http://localhost:3000`（初期）
- [ ] Additional Redirect URLs設定: `http://localhost:3000/dashboard`（初期）

### Google OAuth設定
- [ ] Google Cloud Console OAuth 2.0 Client ID作成
- [ ] Authorized JavaScript origins設定
- [ ] Authorized redirect URIs設定
- [ ] Client ID・Client Secret取得
- [ ] Supabase Google Provider設定完了

---

## 3️⃣ Railway設定

### プロジェクト作成
- [ ] Railway プロジェクト作成完了
- [ ] GitHub リポジトリ接続完了
- [ ] 初回デプロイ完了

### PostgreSQL設定
- [ ] PostgreSQL データベース追加完了
- [ ] DATABASE_URL 自動設定確認

### バックエンドサービス設定
- [ ] Root Directory設定: `backend`
- [ ] Build Command確認: `npm run build`
- [ ] Start Command確認: `npm run start:prod`

### 環境変数設定
```bash
# 必須環境変数チェック
- [ ] NODE_ENV=production
- [ ] VOW_COOKIE_SECURE=true
- [ ] SUPABASE_JWKS_URL=https://abcdefghijklmnop.supabase.co/.well-known/jwks.json
- [ ] SUPABASE_JWT_AUD=authenticated
- [ ] SUPABASE_JWT_ISS=https://abcdefghijklmnop.supabase.co/auth/v1
- [ ] CORS_ORIGINS=https://localhost:3000（初期、後で更新）
- [ ] GOOGLE_CLIENT_ID=（Google Cloud Consoleから）
- [ ] GOOGLE_CLIENT_SECRET=（Google Cloud Consoleから）
- [ ] RATE_LIMIT_ENABLED=true
- [ ] RATE_LIMIT_WINDOW_MS=900000
- [ ] RATE_LIMIT_MAX_REQUESTS=100
```

### デプロイ確認
- [ ] カスタムドメイン生成完了
- [ ] デプロイ成功確認
- [ ] ヘルスチェック動作確認: `/health`
- [ ] Railway URL記録: `https://vow-backend-production.up.railway.app`

---

## 4️⃣ Vercel設定

### プロジェクト作成
- [ ] Vercel プロジェクト作成完了
- [ ] GitHub リポジトリ接続完了
- [ ] Framework Preset: `Next.js`
- [ ] Root Directory設定: `frontend`

### 環境変数設定
```bash
# 必須環境変数チェック
- [ ] NEXT_PUBLIC_API_URL=https://vow-backend-production.up.railway.app
- [ ] NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### デプロイ確認
- [ ] 初回デプロイ成功確認
- [ ] ビルドエラーなし確認
- [ ] Vercel URL記録: `https://vow-app.vercel.app`

---

## 5️⃣ 最終設定更新

### Supabase URL更新
- [ ] Site URL更新: `https://vow-app.vercel.app`
- [ ] Additional Redirect URLs追加:
  - [ ] `https://vow-app.vercel.app/dashboard`
  - [ ] `https://vow-app.vercel.app/login`

### Railway CORS更新
- [ ] CORS_ORIGINS更新: `https://vow-app.vercel.app`
- [ ] 自動再デプロイ完了確認

### Google OAuth URI更新
- [ ] Google Cloud Console Authorized redirect URIs追加:
  - [ ] `https://abcdefghijklmnop.supabase.co/auth/v1/callback`

---

## 6️⃣ 動作確認

### 基本機能テスト
- [ ] フロントエンドアクセス確認: `https://vow-app.vercel.app`
- [ ] ログインページ表示確認
- [ ] Googleログイン動作確認
- [ ] ダッシュボードアクセス確認
- [ ] データ作成・表示確認
- [ ] ログアウト動作確認

### API動作確認
- [ ] バックエンドヘルスチェック: `https://vow-backend-production.up.railway.app/health`
- [ ] 認証API動作確認
- [ ] データAPI動作確認
- [ ] CORS動作確認

### セキュリティテスト
```bash
# ローカルでテスト実行
- [ ] 基本セキュリティテスト実行・合格
- [ ] ペネトレーションテスト実行・合格
- [ ] レート制限動作確認
- [ ] XSS対策動作確認
```

---

## 🔧 トラブルシューティング

### よくある問題チェック
- [ ] CORS エラーなし
- [ ] Supabase認証エラーなし
- [ ] データベース接続エラーなし
- [ ] ビルドエラーなし
- [ ] OAuth認証エラーなし
- [ ] 環境変数エラーなし

### ログ確認
- [ ] Railway デプロイログ確認
- [ ] Railway アプリケーションログ確認
- [ ] Vercel ビルドログ確認
- [ ] Vercel ランタイムログ確認
- [ ] ブラウザ開発者ツール確認

---

## 📊 パフォーマンス確認

### メトリクス確認
- [ ] Railway CPU使用率確認
- [ ] Railway メモリ使用率確認
- [ ] Vercel Core Web Vitals確認
- [ ] ページ読み込み速度確認
- [ ] API レスポンス時間確認

### 最適化
- [ ] 不要なログ出力削除
- [ ] データベースクエリ最適化
- [ ] 画像最適化確認
- [ ] キャッシュ設定確認

---

## 🚀 公開完了

### 最終確認
- [ ] 全機能正常動作確認
- [ ] セキュリティテスト全合格
- [ ] パフォーマンス問題なし
- [ ] エラーログなし
- [ ] ユーザビリティ確認

### ドキュメント更新
- [ ] README.md 本番URL更新
- [ ] 環境変数設定例更新
- [ ] デプロイ手順書確認
- [ ] トラブルシューティングガイド確認

### 運用準備
- [ ] 監視設定（オプション）
- [ ] バックアップ設定確認
- [ ] アラート設定（オプション）
- [ ] ドメイン設定（オプション）

---

## 📝 設定情報記録

### URL情報
```
フロントエンド: https://vow-app.vercel.app
バックエンド: https://vow-backend-production.up.railway.app
Supabase: https://abcdefghijklmnop.supabase.co
```

### 重要な設定値
```
Supabase Project ID: abcdefghijklmnop
Railway Project ID: [Railway Dashboard で確認]
Vercel Project ID: [Vercel Dashboard で確認]
Google OAuth Client ID: 123456789-abcdefg.apps.googleusercontent.com
```

### 完了日時
```
デプロイ開始: ____年__月__日 __:__
デプロイ完了: ____年__月__日 __:__
所要時間: ____分
```

---

## 🎉 公開成功！

すべてのチェック項目が完了したら、WEBサービスの公開が完了です！

**アクセスURL**: `https://vow-app.vercel.app`

---

**最終更新**: 2026年1月3日  
**対象バージョン**: v1.0.0