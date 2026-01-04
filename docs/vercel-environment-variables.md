# 🚀 Vercel環境変数設定ガイド

本番環境（Vercel）で設定が必要な環境変数一覧

## 📋 **必須環境変数**

Vercelダッシュボード → Settings → Environment Variables で以下を設定：

### **フロントエンド（Next.js）**

| 変数名 | 値 | 環境 | 説明 |
|--------|-----|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jamiyzsyclvlvstmeeir.supabase.co` | Production | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm` | Production | Supabase匿名キー |

**注意**: `NEXT_PUBLIC_USE_SUPABASE_API` は設定不要です。本番環境では自動的にNext.js API Routesが使用されます。

## 🔧 **設定手順**

### **1. Vercelダッシュボードにアクセス**
```
https://vercel.com/dashboard
```

### **2. プロジェクト選択**
- `vow` プロジェクトをクリック

### **3. 環境変数設定**
1. **Settings** タブをクリック
2. **Environment Variables** をクリック
3. **Add New** をクリック
4. 上記の変数を1つずつ追加

### **4. デプロイ**
環境変数設定後、自動的に再デプロイされます。

## 🔍 **確認方法**

### **本番環境での動作確認**
1. https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app/dashboard にアクセス
2. ブラウザのコンソールを開く
3. 以下のログが表示されることを確認：
   ```
   ✅ Using Supabase Direct API
   [supabase] Client created and attached to window.supabase
   ```

### **Habit作成テスト**
1. Googleアカウントでログイン
2. Habitを作成
3. コンソールで `[createHabit]` ログを確認
4. データが正常に保存されることを確認

## 🚨 **トラブルシューティング**

### **環境変数が反映されない場合**
1. Vercelダッシュボードで環境変数を再確認
2. **Deployments** タブで最新デプロイを確認
3. 必要に応じて手動で **Redeploy** を実行

### **Supabaseエラーの場合**
1. Supabaseプロジェクトが有効か確認
2. `scripts/supabase-schema.sql` でテーブルが作成されているか確認
3. RLS（Row Level Security）ポリシーが正しく設定されているか確認

## 📝 **注意事項**

- 環境変数は **Production** 環境のみに設定
- `NEXT_PUBLIC_` プレフィックスが必要（クライアントサイドで使用するため）
- 変更後は自動的に再デプロイされる
- セキュリティ上、`.env` ファイルはGitHubにコミットしない