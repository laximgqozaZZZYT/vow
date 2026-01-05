# ~~🚀 Vercel環境変数設定ガイド~~

## ⚠️ **このドキュメントは部分的に廃止されました**

**理由**: Supabase統合アーキテクチャへの移行により、Vercelデプロイは不要になりました。現在はSupabase Storage静的ホスティングを使用します。

~~本番環境（Vercel）で設定が必要な環境変数一覧~~

**現在**: Supabase統合プラットフォームで環境変数は自動管理されます。

## 📋 **現在の環境変数設定**

~~Vercelダッシュボード → Settings → Environment Variables で以下を設定：~~

**現在の設定場所**: `frontend/.env.local`（開発・本番共通）

### **フロントエンド（Next.js）**

| 変数名 | 値 | 環境 | 説明 |
|--------|-----|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jamiyzsyclvlvstmeeir.supabase.co` | ~~Production~~ **All** | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm` | ~~Production~~ **All** | Supabase匿名キー |
| `NEXT_PUBLIC_USE_EDGE_FUNCTIONS` | `false` | **All** | Edge Functions使用フラグ（現在は直接クライアント使用） |

~~**注意**: `NEXT_PUBLIC_USE_SUPABASE_API` は設定不要です。本番環境では自動的にNext.js API Routesが使用されます。~~

**✅ 現在**: 開発・本番環境ともにSupabaseクライアント直接使用。Next.js API Routesは廃止済み。

## 🔧 **現在の設定手順**

~~### **1. Vercelダッシュボードにアクセス**~~
~~```~~
~~https://vercel.com/dashboard~~
~~```~~

### **1. ローカル環境設定**
```bash
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://jamiyzsyclvlvstmeeir.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
```

~~### **2. プロジェクト選択**~~
~~- `vow` プロジェクトをクリック~~

### **2. Supabase設定確認**
1. https://supabase.com/dashboard/project/jamiyzsyclvlvstmeeir にアクセス
2. **Settings** → **API** で環境変数を確認

~~### **3. 環境変数設定**~~
~~1. **Settings** タブをクリック~~
~~2. **Environment Variables** をクリック~~
~~3. **Add New** をクリック~~
~~4. 上記の変数を1つずつ追加~~

### **3. 本番デプロイ**
```bash
# フロントエンドビルド
cd frontend
npm run build

# Supabase Storageにデプロイ
supabase storage cp -r out/* supabase://website/
```

~~### **4. デプロイ**~~
~~環境変数設定後、自動的に再デプロイされます。~~

### **4. 動作確認**
本番URL: `https://jamiyzsyclvlvstmeeir.supabase.co`

## 🔍 **確認方法**

### **本番環境での動作確認**
1. ~~https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app/dashboard にアクセス~~ 
   **現在**: https://jamiyzsyclvlvstmeeir.supabase.co にアクセス
2. ブラウザのコンソールを開く
3. 以下のログが表示されることを確認：
   ```
   ✅ Using: Supabase Client Direct
   [dashboard] Successfully loaded X goals
   [dashboard] Successfully loaded X habits
   ```

### **Habit作成テスト**
1. Googleアカウントでログイン
2. Habitを作成
3. コンソールで `[createHabit] Successfully created habit` ログを確認
4. データが正常に保存されることを確認

## 🚨 **トラブルシューティング**

~~### **環境変数が反映されない場合**~~
~~1. Vercelダッシュボードで環境変数を再確認~~
~~2. **Deployments** タブで最新デプロイを確認~~
~~3. 必要に応じて手動で **Redeploy** を実行~~

### **環境変数が反映されない場合**
1. `frontend/.env.local` ファイルを確認
2. Next.js開発サーバーを再起動
3. ブラウザキャッシュをクリア

### **Supabaseエラーの場合**
1. Supabaseプロジェクトが有効か確認
2. ~~`scripts/supabase-schema.sql` でテーブルが作成されているか確認~~ 
   **現在**: Supabase SQL Editorでテーブル確認
3. RLS（Row Level Security）ポリシーが正しく設定されているか確認

### **認証エラーの場合**
1. Supabase → **Authentication** → **Settings** でURL設定確認
2. Google Cloud Console でOAuth設定確認
3. リダイレクトURLが正しく設定されているか確認

## 📝 **注意事項**

- ~~環境変数は **Production** 環境のみに設定~~ 
  **現在**: 開発・本番環境で同じ設定を使用
- `NEXT_PUBLIC_` プレフィックスが必要（クライアントサイドで使用するため）
- ~~変更後は自動的に再デプロイされる~~ 
  **現在**: 手動でビルド・デプロイが必要
- セキュリティ上、`.env` ファイルはGitHubにコミットしない（`.env.local`は除く）

---

**最終更新**: 2026年1月5日  
**対象バージョン**: v2.0.0 - Supabase統合版  
**デプロイ先**: ~~Vercel~~ **Supabase Storage静的ホスティング**