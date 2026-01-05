# データ分離テスト手順

## 目的
異なるOAuthプロバイダー（Google/GitHub）でログインした際に、データが適切に分離されているかを確認する。

## テスト手順

### 1. 準備
1. ブラウザのキャッシュとCookieをクリア
2. アプリケーション（http://localhost:3000）にアクセス

### 2. Googleアカウントでのテスト
1. **ログイン**: Googleアカウントでログイン
2. **データ作成**: 
   - Goal: "Google Test Goal"
   - Habit: "Google Test Habit"
   - Activity: 何かアクティビティを実行
3. **確認**: データが表示されることを確認
4. **ログアウト**: 完全にログアウト

### 3. GitHubアカウントでのテスト
1. **ログイン**: GitHubアカウントでログイン
2. **データ確認**: 
   - ✅ **期待結果**: Googleで作成したデータが表示されない
   - ❌ **問題**: Googleのデータが表示される場合、データ分離が失敗
3. **データ作成**:
   - Goal: "GitHub Test Goal"
   - Habit: "GitHub Test Habit"
   - Activity: 何かアクティビティを実行
4. **確認**: GitHubのデータのみ表示されることを確認
5. **ログアウト**: 完全にログアウト

### 4. 再度Googleアカウントでのテスト
1. **ログイン**: 再度Googleアカウントでログイン
2. **データ確認**:
   - ✅ **期待結果**: Googleで作成したデータのみ表示される
   - ❌ **問題**: GitHubのデータが表示される場合、データ分離が失敗

## 確認ポイント

### ✅ 成功の場合
- 各アカウントで作成したデータが、そのアカウントでのみ表示される
- 他のアカウントのデータは一切表示されない
- ダッシュボードが空の状態から始まる（初回ログイン時）

### ❌ 失敗の場合
- 異なるアカウントのデータが表示される
- 全てのデータが全ユーザーに表示される
- データが混在している

## トラブルシューティング

### データ分離が失敗している場合

1. **RLSポリシーの確認**:
   ```sql
   SELECT schemaname, tablename, policyname, qual, with_check
   FROM pg_policies 
   WHERE tablename IN ('goals', 'habits', 'activities')
   ORDER BY tablename, policyname;
   ```

2. **ユーザーIDの確認**:
   ```sql
   SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;
   ```

3. **データのowner_id確認**:
   ```sql
   SELECT 'goals' as table_name, id, name, owner_type, owner_id FROM goals
   UNION ALL
   SELECT 'habits' as table_name, id, name, owner_type, owner_id FROM habits
   ORDER BY table_name, id;
   ```

4. **ブラウザの開発者ツールでネットワークタブを確認**:
   - API呼び出し時のAuthorizationヘッダー
   - レスポンスデータの内容

## 期待される結果

修正後は以下のような動作になるはずです：

1. **完全なデータ分離**: 各ユーザーは自分のデータのみアクセス可能
2. **セキュアな認証**: JWTトークンベースの認証
3. **RLS保護**: データベースレベルでのアクセス制御
4. **マルチプロバイダー対応**: Google、GitHub等で異なるユーザーとして認識

## 注意事項

- テスト中は必ず異なるメールアドレスのアカウントを使用してください
- 同じメールアドレスの場合、Supabaseが同一ユーザーとして認識する可能性があります
- ブラウザのプライベートモードを使用することを推奨します