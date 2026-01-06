# 🔧 トラブルシューティングガイド

デプロイ時によくある問題と解決方法

## 🚨 よくある問題と解決方法

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
   # Supabase統合版設定
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

### 3. データベース接続エラー

#### 症状
```
Can't reach database server
Error: P1001: Can't reach database server
```

#### 原因
- Supabaseデータベースサービスが起動していない
- `DATABASE_URL` が正しく設定されていない

#### 解決方法
1. **Supabaseサービス確認**:
   - Supabase Dashboard → Settings → Database
   - Status が "Healthy" になっているか確認

2. **DATABASE_URL確認**:
   ```bash
   # Supabase Dashboard → Settings → Database
   # Connection string が正しく設定されているか確認
   ```

3. **接続テスト**:
   ```bash
   # Supabase Dashboard → SQL Editor
   # SQLクエリを実行してデータベースが応答するか確認
   SELECT 1;
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

**Supabase統合版**:
1. **依存関係確認**:
   ```bash
   # frontend/package.json の dependencies を確認
   ```

2. **キャッシュクリア**:
   - GitHub Actions でキャッシュクリア
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
   Site URL: https://jamiyzsyclvlvstmeeir.supabase.co
   Additional Redirect URLs:
     https://jamiyzsyclvlvstmeeir.supabase.co/dashboard
     https://jamiyzsyclvlvstmeeir.supabase.co/login
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
1. **Supabase環境変数確認**:
   ```bash
   # Settings → Environment Variables で以下を確認
   NODE_ENV=production
   NEXT_PUBLIC_SUPABASE_URL=https://...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

3. **環境変数名確認**:
   - `NEXT_PUBLIC_` プレフィックスが正しいか確認
   - スペルミスがないか確認

---

## 🔍 デバッグ方法

### GitHub Actions ログ確認

1. **デプロイログ**:
   - GitHub → Actions タブ
   - 最新ワークフローをクリック → ログ確認
   - ビルドエラーやデプロイエラーを確認

2. **Supabase ログ確認**:
   - Supabase Dashboard → Logs
   - リアルタイムログを確認

### ローカルデバッグ

1. **フロントエンドテスト**:
   ```bash
   cd frontend
   npm run dev
   # http://localhost:3000 でアクセス
   ```

2. **セキュリティテスト**:
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
   # Supabase Dashboard → SQL Editor
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
   # Supabase Dashboard → SQL Editor
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

### パフォーマンス問題

#### 症状
- ページ読み込みが遅い
- APIレスポンスが遅い

#### 解決方法
1. **Supabase メトリクス確認**:
   - リソース使用率が高い場合：プランアップグレード検討
   - データベース負荷が高い場合：クエリ最適化

2. **パフォーマンス分析**:
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
- **GitHub**: https://support.github.com
- **Supabase**: https://supabase.com/support

### コミュニティ
- **Supabase Discord**: https://discord.supabase.com

### ドキュメント
- **GitHub Docs**: https://docs.github.com
- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs

---

## 🆘 緊急時対応

### サービス停止時
1. **ステータス確認**:
   - GitHub Status: https://www.githubstatus.com
   - Supabase Status: https://status.supabase.com

2. **一時的な回避策**:
   - ローカル環境での動作確認
   - 別のデプロイ環境への切り替え

3. **ユーザー通知**:
   - メンテナンス情報の掲示
   - 復旧予定時刻の案内

### データ損失時
1. **バックアップ確認**:
   - Supabase自動バックアップ
   - 手動エクスポートデータ

2. **復旧手順**:
   - バックアップからの復元
   - データ整合性の確認

---

**最終更新**: 2026年1月6日  
**対象バージョン**: v2.0.0 - Supabase統合版