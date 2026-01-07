# GitHub Secrets設定ガイド

GitHub ActionsでVercelにデプロイするために必要なSecretsの設定手順です。

## 必要なSecrets

### 1. Vercel関連

#### VERCEL_TOKEN
- **取得方法**: Vercel Dashboard → Settings → Tokens → Create Token
- **値**: `vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **用途**: Vercel CLIの認証

#### VERCEL_PROJECT_ID  
- **取得方法**: Vercelプロジェクト → Settings → General → Project ID
- **値**: `prj_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **用途**: デプロイ対象プロジェクトの指定

#### VERCEL_ORG_ID
- **取得方法**: Vercel Account Settings → General → Team ID
- **値**: `team_xxxxxxxxxxxxxxxxxxxxxxxxxxxx` または `user_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **用途**: 組織/ユーザーの指定

### 2. Supabase関連（既存）

#### NEXT_PUBLIC_SUPABASE_URL
- **値**: `https://jamiyzsyclvlvstmeeir.supabase.co`
- **用途**: Supabaseプロジェクトへの接続

#### NEXT_PUBLIC_SUPABASE_ANON_KEY
- **値**: `sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm`
- **用途**: Supabase匿名認証キー

#### SUPABASE_ACCESS_TOKEN（既存、Supabase静的ホスティング用）
- **値**: Supabaseアクセストークン
- **用途**: Supabase CLIの認証（デュアルデプロイメント用）

## GitHub Secretsの設定手順

### 1. GitHubリポジトリでの設定

1. GitHubリポジトリページに移動
2. **Settings** タブをクリック
3. 左サイドバーの **Secrets and variables** → **Actions** をクリック
4. **New repository secret** をクリック

### 2. 各Secretの追加

以下の順序で追加：

```bash
# Vercel関連
Name: VERCEL_TOKEN
Secret: vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

Name: VERCEL_PROJECT_ID  
Secret: prj_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

Name: VERCEL_ORG_ID
Secret: team_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase関連（既存確認・更新）
Name: NEXT_PUBLIC_SUPABASE_URL
Secret: https://jamiyzsyclvlvstmeeir.supabase.co

Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Secret: sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm
```

### 3. 設定確認

設定完了後、以下で確認：
1. **Actions secrets** ページで全てのSecretsが表示されることを確認
2. 値は `***` で隠されていることを確認
3. 必要に応じて **Update** で値を更新可能

## セキュリティ注意事項

### ✅ 推奨事項
- Secretsは最小権限の原則に従って設定
- 定期的なトークンのローテーション
- 不要になったSecretsは削除
- プロダクション環境とステージング環境でSecretsを分離

### ❌ 避けるべき事項
- Secretsをコードにハードコーディング
- ログやコメントにSecrets値を記載
- 不必要に広いスコープのトークン使用
- Secretsの値をプルリクエストに含める

## トラブルシューティング

### Vercel認証エラー
```
Error: Invalid token
```
- VERCEL_TOKENが正しく設定されているか確認
- トークンの有効期限を確認
- 新しいトークンを生成して更新

### プロジェクト認証エラー
```
Error: Project not found
```
- VERCEL_PROJECT_IDが正しいか確認
- VERCEL_ORG_IDが正しいか確認
- プロジェクトへのアクセス権限を確認

### Supabase接続エラー
```
Error: Invalid API key
```
- NEXT_PUBLIC_SUPABASE_ANON_KEYが正しいか確認
- Supabaseプロジェクトが有効か確認
- APIキーの権限設定を確認