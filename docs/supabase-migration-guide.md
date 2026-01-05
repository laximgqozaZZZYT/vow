# 🔄 Supabase統合移行ガイド

## 📋 **移行概要**

### **移行前（3層構造）**
```
Vercel (Frontend) → Railway (Express API) → Supabase (Database)
```

### **移行後（統合構造）**
```
Supabase (Frontend + Edge Functions + Database + Auth)
```

## 🎯 **移行の利点**

- **コスト削減**: $5-65/月 → 無料-$25/月
- **運用簡素化**: 3つのプラットフォーム → 1つのプラットフォーム
- **CORS問題解決**: 同一オリジンでの統合
- **パフォーマンス向上**: エッジ配信、低レイテンシ

## 📁 **移行対象ファイル**

### **削除対象**
- `frontend/app/api/` - Next.js API Routes（不要）
- `backend/` - Express API（Edge Functionsに移行）

### **新規作成**
- `supabase/functions/` - Edge Functions
- `supabase/migrations/` - データベースマイグレーション
- `frontend/.env.local` - 新しい環境変数

### **修正対象**
- `frontend/lib/api.ts` - Supabaseクライアント直接使用
- `frontend/lib/supabaseClient.ts` - 制限解除
- `frontend/app/dashboard/page.tsx` - 認証フロー簡素化

## 🔧 **移行手順**

### **Phase 1: Supabaseプロジェクト準備**
1. Supabaseプロジェクト作成
2. データベーススキーマ移行
3. RLSポリシー設定
4. OAuth設定

### **Phase 2: Edge Functions実装**
1. Express APIロジックをEdge Functionsに移植
2. 認証処理の統合
3. データベースアクセスの最適化

### **Phase 3: フロントエンド統合**
1. Supabaseクライアント制限解除
2. API呼び出しの直接化
3. 認証フローの簡素化

### **Phase 4: 静的ホスティング**
1. フロントエンドビルド
2. Supabase Storageにデプロイ
3. カスタムドメイン設定

## 📊 **移行チェックリスト**

### ✅ **準備段階**
- [ ] Supabaseプロジェクト作成
- [ ] データベーススキーマ確認
- [ ] OAuth設定確認
- [ ] Supabase CLI インストール

### ✅ **開発段階**
- [ ] Edge Functions実装
- [ ] フロントエンド修正
- [ ] ローカルテスト実行
- [ ] 機能確認完了

### ✅ **デプロイ段階**
- [ ] Edge Functions デプロイ
- [ ] 静的サイトデプロイ
- [ ] 本番環境テスト
- [ ] 旧環境停止

## 🚨 **注意事項**

### **データ移行**
- 既存のデータベースデータは手動移行が必要
- ユーザーセッションはリセットされる
- OAuth設定の再設定が必要

### **機能制限**
- Edge Functionsは一部Node.js機能が制限される
- ファイルアップロードはSupabase Storageを使用
- セッション管理はSupabase Authに統一

### **パフォーマンス**
- 初回デプロイ時はコールドスタートが発生する可能性
- Edge Functionsは最大25秒の実行時間制限
- データベース接続プールの最適化が必要

---

**最終更新**: 2026年1月5日  
**対象バージョン**: v2.0.0 - Supabase統合版