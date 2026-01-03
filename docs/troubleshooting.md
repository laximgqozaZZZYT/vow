# 🔧 トラブルシューティングガイド

デプロイ時によくある問題と解決方法

## 🚨 よくある問題と解決方法

### 1. CORS エラー

#### 症状
```
Access to fetch at 'https://vow-backend-production.up.railway.app' 
from origin 'https://vow-app.vercel.app' has been blocked by CORS policy
```

#### 原因
- Railway環境変数の `CORS_ORIGINS` が正しく設定されていない
- フロントエンドとバックエンドのドメインが一致していない

#### 解決方法
1. **Railway環境変数確認**:
   ```bash
   # Railway Dashboard → Settings → Variables
   CORS_ORIGINS=https://vow-app.vercel.app
   ```

2. **複数ドメイン設定**:
   ```bash
   CORS_ORIGINS=https://vow-app.vercel.app,https://custom-domain.com
   ```

3. **再デプロイ**:
   - Railway環境変数更新後、自動的に再デプロイされる
   - 数分待ってから再テスト

#### 確認方法
```bash
# ブラウザ開発者ツールのNetworkタブで確認
# Response Headersに以下が含まれているか確認
Access-Control-Allow-Origin: https://vow-app.vercel.app
Access-Control-Allow-Credentials: true
```

---

### 2. Supabase認証エラー

#### 症状
```
Invalid JWT: signature verification failed
AuthError: Invalid JWT signature
```

#### 原因
- `SUPABASE_JWKS_URL` のプロジェクトIDが間違っている
- Supabase環境変数が正しく設定されていない

#### 解決方法
1. **Supabase情報再確認**:
   ```bash
   # Supabase Dashboard → Settings → API
   Project URL: https://abcdefghijklmnop.supabase.co
   
   # Railway環境変数
   SUPABASE_JWKS_URL=https://abcdefghijklmnop.supabase.co/.well-known/jwks.json
   SUPABASE_JWT_AUD=authenticated
   SUPABASE_JWT_ISS=https://abcdefghijklmnop.supabase.co/auth/v1
   ```

2. **JWKS URL動作確認**:
   ```bash
   curl https://abcdefghijklmnop.supabase.co/.well-known/jwks.json
   # 正常な場合、JSON形式の公開鍵情報が返される
   ```

3. **フロントエンド環境変数確認**:
   ```bash
   # Vercel Dashboard → Settings → Environment Variables
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

### 3. データベース接続エラー

#### 症状
```
Can't reach database server at `localhost:5432`
Error: P1001: Can't reach database server
```

#### 原因
- RailwayのPostgreSQLサービスが起動していない
- `DATABASE_URL` が正しく設定されていない

#### 解決方法
1. **PostgreSQLサービス確認**:
   - Railway Dashboard → PostgreSQL サービスをクリック
   - Status が "Running" になっているか確認

2. **DATABASE_URL確認**:
   ```bash
   # Railway Dashboard → PostgreSQL → Variables
   # DATABASE_URL が自動設定されているか確認
   DATABASE_URL=postgresql://postgres:password@host:port/database
   ```

3. **接続テスト**:
   ```bash
   # Railway Dashboard → PostgreSQL → Query
   # SQLクエリを実行してデータベースが応答するか確認
   SELECT 1;
   ```

4. **マイグレーション実行**:
   ```bash
   # Railway Dashboard → Deployments → View Logs
   # マイグレーションが正常に実行されているか確認
   ```

---

### 4. ビルドエラー

#### 症状
```
Module not found: Can't resolve 'module-name'
Build failed with exit code 1
```

#### 原因
- 依存関係が正しくインストールされていない
- package.json の設定に問題がある

#### 解決方法

**Railway（バックエンド）**:
1. **依存関係確認**:
   ```bash
   # backend/package.json の dependencies を確認
   # 必要なパッケージがすべて含まれているか確認
   ```

2. **キャッシュクリア**:
   - Railway Dashboard → Settings → Service
   - "Clear Build Cache" をクリック
   - 再デプロイ

3. **ビルドログ確認**:
   - Railway Dashboard → Deployments → View Logs
   - エラーの詳細を確認

**Vercel（フロントエンド）**:
1. **依存関係確認**:
   ```bash
   # frontend/package.json の dependencies を確認
   ```

2. **キャッシュクリア**:
   - Vercel Dashboard → Settings → Functions
   - "Clear Cache" をクリック
   - 再デプロイ

3. **ローカルビルドテスト**:
   ```bash
   cd frontend
   npm run build
   # ローカルでビルドが成功するか確認
   ```

---

### 5. OAuth認証エラー

#### 症状
```
OAuth error: redirect_uri_mismatch
Invalid redirect URI
```

#### 原因
- Google Cloud ConsoleのRedirect URIが正しく設定されていない
- SupabaseのSite URLが間違っている

#### 解決方法
1. **Google Cloud Console設定確認**:
   ```bash
   # Authorized redirect URIs に以下を設定
   https://abcdefghijklmnop.supabase.co/auth/v1/callback
   ```

2. **Supabase設定確認**:
   ```bash
   # Authentication → Settings
   Site URL: https://vow-app.vercel.app
   Additional Redirect URLs:
     https://vow-app.vercel.app/dashboard
     https://vow-app.vercel.app/login
   ```

3. **OAuth フロー確認**:
   - ブラウザ開発者ツールのNetworkタブでOAuthリクエストを確認
   - redirect_uri パラメータが正しいか確認

---

### 6. 環境変数エラー

#### 症状
```
Environment variable NEXT_PUBLIC_SUPABASE_URL is not defined
Missing required environment variables
```

#### 原因
- 環境変数が正しく設定されていない
- 環境変数名にタイポがある

#### 解決方法
1. **Railway環境変数確認**:
   ```bash
   # Settings → Variables で以下を確認
   NODE_ENV=production
   VOW_COOKIE_SECURE=true
   SUPABASE_JWKS_URL=https://...
   SUPABASE_JWT_AUD=authenticated
   SUPABASE_JWT_ISS=https://...
   CORS_ORIGINS=https://...
   ```

2. **Vercel環境変数確認**:
   ```bash
   # Settings → Environment Variables で以下を確認
   NEXT_PUBLIC_API_URL=https://...
   NEXT_PUBLIC_SUPABASE_URL=https://...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

3. **環境変数名確認**:
   - `NEXT_PUBLIC_` プレフィックスが正しいか確認
   - スペルミスがないか確認

---

## 🔍 デバッグ方法

### Railway ログ確認

1. **デプロイログ**:
   - Railway Dashboard → Deployments
   - 最新デプロイをクリック → View Logs
   - ビルドエラーやランタイムエラーを確認

2. **アプリケーションログ**:
   - Railway Dashboard → Service → Logs
   - リアルタイムログを確認

3. **メトリクス確認**:
   - Railway Dashboard → Service → Metrics
   - CPU、メモリ使用量を確認

### Vercel ログ確認

1. **ビルドログ**:
   - Vercel Dashboard → Deployments
   - 失敗したデプロイをクリック → View Function Logs

2. **ランタイムログ**:
   - Vercel Dashboard → Functions
   - エラーログとパフォーマンスを確認

3. **プレビューデプロイ**:
   - Pull Requestごとにプレビューデプロイが作成される
   - 本番前にテスト可能

### ローカルデバッグ

1. **バックエンドテスト**:
   ```bash
   cd backend
   npm run dev
   # http://localhost:4000/health でヘルスチェック
   ```

2. **フロントエンドテスト**:
   ```bash
   cd frontend
   npm run dev
   # http://localhost:3000 でアクセス
   ```

3. **セキュリティテスト**:
   ```bash
   npm run security-full
   ```

---

## 🛠️ 高度なトラブルシューティング

### データベースマイグレーション問題

#### 症状
```
Migration failed: Table already exists
Schema drift detected
```

#### 解決方法
1. **マイグレーション状態確認**:
   ```bash
   # Railway Dashboard → PostgreSQL → Query
   SELECT * FROM _prisma_migrations;
   ```

2. **手動マイグレーション**:
   ```bash
   # ローカルで実行
   cd backend
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

3. **スキーマリセット**（注意：データが削除される）:
   ```bash
   # Railway Dashboard → PostgreSQL → Query
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

### パフォーマンス問題

#### 症状
- ページ読み込みが遅い
- APIレスポンスが遅い

#### 解決方法
1. **Railway メトリクス確認**:
   - CPU使用率が高い場合：プランアップグレード検討
   - メモリ使用率が高い場合：メモリリーク調査

2. **Vercel Analytics確認**:
   - Core Web Vitals を確認
   - 遅いページを特定

3. **データベース最適化**:
   ```sql
   -- インデックス追加
   CREATE INDEX idx_user_id ON goals(owner_id);
   CREATE INDEX idx_created_at ON diary_cards(created_at);
   ```

### セキュリティ問題

#### 症状
- セキュリティテストが失敗する
- 不正なアクセスが検出される

#### 解決方法
1. **セキュリティテスト詳細確認**:
   ```bash
   npm run security-test
   npm run penetration-test
   ```

2. **ログ監視**:
   - 異常なアクセスパターンを確認
   - レート制限の動作を確認

3. **セキュリティ設定見直し**:
   - CORS設定の厳格化
   - JWT有効期限の短縮
   - レート制限の強化

---

## 📞 サポートリソース

### 公式サポート
- **Railway**: https://railway.app/help
- **Vercel**: https://vercel.com/support
- **Supabase**: https://supabase.com/support
- **Google Cloud**: https://cloud.google.com/support

### コミュニティ
- **Railway Discord**: https://discord.gg/railway
- **Vercel Discord**: https://discord.gg/vercel
- **Supabase Discord**: https://discord.supabase.com

### ドキュメント
- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs

---

## 🆘 緊急時対応

### サービス停止時
1. **ステータス確認**:
   - Railway Status: https://status.railway.app
   - Vercel Status: https://vercel-status.com
   - Supabase Status: https://status.supabase.com

2. **一時的な回避策**:
   - ローカル環境での動作確認
   - 別のデプロイ環境への切り替え

3. **ユーザー通知**:
   - メンテナンス情報の掲示
   - 復旧予定時刻の案内

### データ損失時
1. **バックアップ確認**:
   - Railway PostgreSQL自動バックアップ
   - 手動エクスポートデータ

2. **復旧手順**:
   - バックアップからの復元
   - データ整合性の確認

---

**最終更新**: 2026年1月3日  
**対象バージョン**: v1.0.0