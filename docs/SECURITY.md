# セキュリティガイド

## 🔐 認証・認可

### OAuth 2.0認証
- **Google OAuth**: OpenID Connect準拠
- **GitHub OAuth**: OAuth 2.0準拠
- **JWT**: トークンベース認証
- **セッション管理**: Supabase Auth

### 認証フロー
```
1. ユーザーがOAuthプロバイダーを選択
2. プロバイダーの認証画面にリダイレクト
3. 認証成功後、Supabaseにコールバック
4. JWTトークン発行
5. ダッシュボードにリダイレクト
```

## 🗄️ データベースセキュリティ

### Row Level Security (RLS)
全テーブルでRLSが有効化され、ユーザー毎のデータ分離を実現：

```sql
-- Goals テーブル
CREATE POLICY "Users can only access their own goals" ON goals
  FOR ALL USING (owner_id = auth.uid()::text);

-- Habits テーブル  
CREATE POLICY "Users can only access their own habits" ON habits
  FOR ALL USING (owner_id = auth.uid()::text);

-- Activities テーブル
CREATE POLICY "Users can only access their own activities" ON activities
  FOR ALL USING (owner_id = auth.uid()::text);
```

### データ暗号化
- **転送時暗号化**: HTTPS/TLS 1.3
- **保存時暗号化**: Supabase標準暗号化
- **接続暗号化**: PostgreSQL SSL接続

## 🌐 ネットワークセキュリティ

### HTTPS設定
```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
      ],
    },
  ];
}
```

### CORS設定
- **Origin**: 許可されたドメインのみ
- **Methods**: GET, POST, PATCH, DELETE
- **Headers**: Authorization, Content-Type
- **Credentials**: 含む

## 🔑 環境変数管理

### 機密情報の分離
```bash
# 公開情報（フロントエンド）
NEXT_PUBLIC_SUPABASE_URL=https://jamiyzsyclvlvstmeeir.supabase.co
NEXT_PUBLIC_SITE_URL=https://vow-sigma.vercel.app

# 機密情報（サーバーサイド）
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=postgresql://...
```

### 本番環境
- **Vercel**: 環境変数で管理
- **Supabase**: ダッシュボードで管理
- **GitHub**: Secrets で管理

### 開発環境
- **`.env.local`**: ローカル環境変数
- **`.env.example`**: サンプルファイル
- **`.gitignore`**: 機密ファイル除外

## 🛡️ XSS・CSRF対策

### XSS対策
```typescript
// サニタイゼーション
import DOMPurify from 'dompurify';

const sanitizedContent = DOMPurify.sanitize(userInput);
```

### CSRF対策
- **SameSite Cookie**: Strict設定
- **Origin検証**: リクエスト元確認
- **CSRF Token**: 必要に応じて実装

## 🔍 監査・ログ

### Supabaseログ
- **認証ログ**: ログイン・ログアウト
- **データベースログ**: クエリ実行
- **API使用量**: リクエスト数・レスポンス時間

### Vercelログ
- **アクセスログ**: リクエスト・レスポンス
- **エラーログ**: アプリケーションエラー
- **パフォーマンス**: 読み込み時間

## 🚨 セキュリティチェックリスト

### デプロイ前チェック
- [ ] 全テーブルでRLS有効化
- [ ] 適切なポリシー設定
- [ ] 環境変数の機密情報確認
- [ ] HTTPS強制設定
- [ ] セキュリティヘッダー設定
- [ ] OAuth設定確認

### Supabaseセキュリティ
- [ ] RLS有効化確認
- [ ] ポリシーテスト実行
- [ ] 匿名アクセス制限
- [ ] API制限設定
- [ ] バックアップ設定

### 定期チェック
- [ ] 依存関係の脆弱性スキャン
- [ ] アクセスログ確認
- [ ] 異常なアクティビティ監視
- [ ] セキュリティアップデート適用

## 🔧 セキュリティテスト

### 自動テスト
```bash
# セキュリティテスト実行
npm run security-test

# 依存関係脆弱性チェック
npm audit

# TypeScript型チェック
npm run type-check
```

### 手動テスト
1. **認証テスト**: 未認証アクセス確認
2. **認可テスト**: 他ユーザーデータアクセス確認
3. **入力検証**: XSS・SQLインジェクション確認
4. **セッション管理**: トークン有効期限確認

## 🚨 インシデント対応

### 緊急時対応手順
1. **影響範囲確認**: ログ・監視データ確認
2. **一時対応**: 問題機能の無効化
3. **根本対応**: 脆弱性修正・パッチ適用
4. **事後対応**: インシデント報告・改善策実施

### 連絡先
- **開発チーム**: GitHub Issues
- **Supabase**: サポートチケット
- **Vercel**: サポートチケット

## 📚 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Vercel Security](https://vercel.com/docs/security)