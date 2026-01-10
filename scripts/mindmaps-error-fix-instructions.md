# Mindmaps エラー修正手順

## 問題の概要
ページ読み込み時に以下のエラーが発生：
1. `[getMindmaps] Supabase query error: {}`
2. `Failed to load data {}`

## 原因
`mindmaps`関連テーブルのRow Level Security (RLS) ポリシーが不完全または欠落している。

## 修正手順

### 1. 即座の修正（Supabaseダッシュボードで実行）

1. Supabaseダッシュボードにログイン
2. SQL Editorを開く
3. `scripts/fix-mindmaps-rls.sql` の内容を実行

### 2. 確認手順

1. `scripts/check-mindmaps-tables.sql` を実行してテーブル状態を確認
2. ブラウザでページをリロードしてエラーが解消されているか確認

### 3. マイグレーション適用（推奨）

```bash
# Supabase CLIを使用している場合
supabase db push

# または手動でマイグレーションファイルを適用
# supabase/migrations/20260110000000_fix_mindmaps_rls_policies.sql
```

## 修正内容

以下のテーブルにRLSポリシーを追加：
- `mindmaps`
- `mindmap_nodes` 
- `mindmap_connections`

各テーブルに対して認証済みユーザーが自分のデータにアクセスできるポリシーを設定。

## 確認方法

修正後、以下を確認：
1. コンソールエラーが消えている
2. `api.getMindmaps()` が正常に動作する
3. ダッシュボードが正常に読み込まれる

## 注意事項

- この修正は既存のデータに影響しません
- ゲストユーザーの機能も引き続き動作します
- 認証済みユーザーのみが自分のmindmapデータにアクセス可能になります