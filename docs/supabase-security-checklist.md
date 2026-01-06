# Supabaseセキュリティチェックリスト

## 🔴 緊急対処項目

### 1. パスワード保護の有効化
- [ ] Supabaseダッシュボード → Authentication → Settings
- [ ] "Enable password leak detection" を有効化
- [ ] パスワード強度要件を設定
- [ ] 参考: `scripts/enable-password-protection.md`

### 2. RLS（Row Level Security）の完全適用
- [ ] `scripts/fix-supabase-security-warnings.sql` を実行
- [ ] すべてのpublicテーブルでRLS有効化確認
- [ ] auth.usersテーブルのRLS設定確認

## 🟡 パフォーマンス最適化項目

### 3. 不要なインデックスの削除
- [ ] インデックス使用状況の確認
- [ ] 未使用インデックスの特定
- [ ] 安全な削除の実行

### 4. 必要なインデックスの追加
- [ ] RLSクエリ最適化用インデックス
- [ ] 日付範囲クエリ用インデックス
- [ ] 複合インデックスの検討

## 🟢 追加のセキュリティ強化

### 5. 認証設定の強化
- [ ] メール確認の有効化
- [ ] セッションタイムアウトの設定
- [ ] 多要素認証の検討

### 6. 監視とログ
- [ ] 異常なアクセスパターンの監視
- [ ] 定期的なセキュリティ監査
- [ ] ログの定期確認

## 実行順序

### Phase 1: 緊急対処（即座に実行）
1. パスワード保護の有効化
2. RLSの完全適用

### Phase 2: 最適化（1週間以内）
1. インデックスの最適化
2. パフォーマンス監視の設定

### Phase 3: 強化（1ヶ月以内）
1. 追加のセキュリティ機能
2. 監視システムの構築

## 確認方法

### セキュリティ状況の確認
```sql
-- RLS状況確認
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename;

-- ポリシー数確認
SELECT 
    schemaname,
    tablename,
    count(*) as policy_count
FROM pg_policies 
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;
```

### パフォーマンス状況の確認
```sql
-- インデックス使用状況
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

## 定期メンテナンス

### 週次
- [ ] Security Advisorの確認
- [ ] 異常なログの確認

### 月次
- [ ] インデックス使用状況の確認
- [ ] パフォーマンス指標の確認
- [ ] セキュリティポリシーの見直し

### 四半期
- [ ] 包括的なセキュリティ監査
- [ ] アクセスパターンの分析
- [ ] 設定の最適化