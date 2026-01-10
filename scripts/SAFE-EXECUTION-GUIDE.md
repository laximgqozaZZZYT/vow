# 安全なMindmapsエラー修正手順

Supabaseの「destructive operation」警告を避けるため、段階的に修正を行います。

## 実行順序

### 1. テーブル存在確認
```sql
-- scripts/step1-check-mindmaps-existence.sql を実行
```
**結果**: mindmaps関連テーブルが存在するかを確認

### 2. RLS状態確認
```sql
-- scripts/step2-check-rls-status.sql を実行
```
**結果**: RLSが有効か、既存のポリシーがあるかを確認

### 3. テーブル作成（必要な場合のみ）
```sql
-- テーブルが存在しない場合のみ
-- scripts/step3-create-mindmaps-table.sql を実行
```

### 4. RLS有効化
```sql
-- scripts/step4-enable-rls.sql を実行
```

### 5. ポリシー作成（安全版）
```sql
-- scripts/step5-create-policies-safe.sql を実行
```
**注意**: DROP文を使わず、新しいポリシー名で作成

### 6. 最終確認
```sql
-- scripts/step6-final-verification.sql を実行
```

## 各ステップの説明

- **Step 1-2**: 現状確認（安全）
- **Step 3**: テーブル作成（IF NOT EXISTS使用で安全）
- **Step 4**: RLS有効化（既に有効でもエラーにならない）
- **Step 5**: ポリシー作成（DROP文なしで安全）
- **Step 6**: 最終確認

## 実行後の確認

修正完了後、ブラウザでアプリケーションをリロードして以下を確認：
1. コンソールエラーが消えている
2. ダッシュボードが正常に読み込まれる

## トラブルシューティング

もしポリシー名の重複エラーが出た場合：
1. Step 2で既存のポリシー名を確認
2. Step 5のポリシー名を変更して再実行