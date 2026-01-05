# データ分離問題修正ガイド

## 問題の概要

2つの主要な問題が特定されました：

1. **GitHub Actions失敗**: 古いアーキテクチャ（Express API）を前提としたワークフロー
2. **データ分離問題**: 異なるOAuthプロバイダーでログインしても同じデータが表示される

## 修正手順

### 1. GitHub Actions修正（完了）

- ✅ `.github/workflows/deploy.yml` をSupabase統合版に更新
- ✅ `scripts/security-test-supabase.js` を作成
- ✅ `package.json` にSupabase版セキュリティテストスクリプトを追加

### 2. RLSポリシー修正（要実行）

Supabase SQL Editorで以下のスクリプトを実行：

```sql
-- scripts/fix-rls-policies.sql の内容を実行
```

**重要な変更点:**
- `OR owner_id IS NULL` 条件を削除
- 厳密なデータ分離ポリシーに変更
- 各ユーザーは自分のデータのみアクセス可能

### 3. データクリーンアップ（要実行）

```sql
-- scripts/cleanup-null-data.sql の内容を実行
```

**手順:**
1. 現在のNULLデータ状況を確認
2. バックアップを作成
3. NULLデータを削除または特定ユーザーに割り当て

### 4. テスト実行

```bash
# ローカルでSupabase版セキュリティテストを実行
npm run security-test-supabase

# 全セキュリティテストを実行
npm run security-full
```

## 修正後の期待される動作

### GitHub Actions
- ✅ backendビルドエラーが解消
- ✅ Supabase統合版のセキュリティテストが実行
- ✅ CI/CDパイプラインが正常動作

### データ分離
- ✅ 各ユーザーは自分のデータのみ表示
- ✅ GoogleとGitHubで異なるアカウントは異なるデータ
- ✅ RLSによる厳密なアクセス制御

## 確認方法

### 1. データ分離の確認
1. Googleアカウントでログイン → データA作成
2. ログアウト
3. GitHubアカウントでログイン → データAが表示されないことを確認
4. データB作成
5. Googleアカウントに戻る → データBが表示されないことを確認

### 2. RLSポリシーの確認
```sql
-- Supabase SQL Editorで実行
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('goals', 'habits', 'activities', 'preferences', 'diary_cards', 'diary_tags')
ORDER BY tablename, policyname;
```

### 3. GitHub Actions確認
- プルリクエスト作成時にテストが成功することを確認
- mainブランチへのマージ時にデプロイが成功することを確認

## トラブルシューティング

### RLS適用後にデータが表示されない場合
1. ユーザーが正しく認証されているか確認
2. `auth.uid()` が正しく取得できているか確認
3. 一時的にRLSを無効化してデータが存在するか確認

```sql
-- 一時的にRLSを無効化（デバッグ用）
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;
-- 確認後、必ず再有効化
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
```

### GitHub Actions失敗の場合
1. Supabase環境変数が正しく設定されているか確認
2. `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` の設定
3. セキュリティテストスクリプトの実行権限確認

## 次のステップ

1. **即座に実行**: RLSポリシー修正とデータクリーンアップ
2. **テスト**: 複数アカウントでのデータ分離確認
3. **監視**: GitHub Actionsの動作確認
4. **ドキュメント更新**: 新しいアーキテクチャに合わせた更新

この修正により、セキュアで適切に分離されたマルチユーザー環境が実現されます。