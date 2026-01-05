# 🔧 ローカル開発環境でのOAuth設定ガイド

## 📋 **現在の状況**

- **Supabaseプロジェクト**: `jamiyzsyclvlvstmeeir`
- **本番URL**: `https://jamiyzsyclvlvstmeeir.supabase.co`
- **開発URL**: `http://localhost:3000`

## 🔧 **設定手順**

### **1. Supabase Authentication設定**

1. **Supabaseダッシュボード**にアクセス
   ```
   https://supabase.com/dashboard/project/jamiyzsyclvlvstmeeir
   ```

2. **Authentication** → **Settings** をクリック

3. **Site URL**（変更不要）:
   ```
   https://jamiyzsyclvlvstmeeir.supabase.co
   ```

4. **Additional Redirect URLs**に以下を追加:
   ```
   http://localhost:3000
   http://localhost:3000/dashboard
   http://localhost:3000/auth/callback
   https://jamiyzsyclvlvstmeeir.supabase.co/dashboard
   https://jamiyzsyclvlvstmeeir.supabase.co/auth/callback
   ```

5. **Save** をクリック

### **2. Google OAuth設定**

1. **Google Cloud Console**にアクセス
   ```
   https://console.cloud.google.com/apis/credentials
   ```

2. 既存のOAuth 2.0 Client IDを編集

3. **Authorized JavaScript origins**に以下を追加:
   ```
   http://localhost:3000
   https://jamiyzsyclvlvstmeeir.supabase.co
   ```

4. **Authorized redirect URIs**に以下を追加:
   ```
   https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback
   ```

   **注意**: ローカル開発環境用のredirect URIは不要です。SupabaseがProxy経由で処理します。

5. **Save** をクリック

### **3. GitHub OAuth設定**

1. **GitHub Settings**にアクセス
   ```
   https://github.com/settings/developers
   ```

2. OAuth Appを編集

3. **Authorization callback URL**:
   ```
   https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback
   ```

   **注意**: GitHubは1つのcallback URLのみサポート。Supabaseが自動的にローカル開発環境にリダイレクトします。

4. **Save** をクリック

## 🧪 **動作確認**

### **1. ローカル開発サーバー起動**
```bash
cd frontend
npm run dev
```

### **2. OAuth認証テスト**

#### **Google認証テスト**
1. `http://localhost:3000/login` にアクセス
2. **Google**ボタンをクリック
3. Google認証画面が表示されることを確認
4. 認証後、`http://localhost:3000/dashboard` にリダイレクトされることを確認

#### **GitHub認証テスト**
1. `http://localhost:3000/login` にアクセス
2. **GitHub**ボタンをクリック
3. GitHub認証画面が表示されることを確認
4. 認証後、`http://localhost:3000/dashboard` にリダイレクトされることを確認

### **3. 認証状態確認**

ブラウザの開発者ツールコンソールで実行：

```javascript
// 1. Supabaseクライアント確認
console.log('Supabase client:', window.supabase ? '利用可能' : '未初期化');

// 2. 現在のセッション確認
supabase.auth.getSession().then(({ data: { session }, error }) => {
  if (error) {
    console.error('セッション取得エラー:', error);
  } else {
    console.log('現在のセッション:', session ? 'ログイン中' : 'ログアウト中');
    if (session) {
      console.log('ユーザー情報:', session.user);
    }
  }
});

// 3. API動作確認
fetch('/api/me', { credentials: 'include' })
  .then(r => r.json())
  .then(data => console.log('API /me 結果:', data))
  .catch(err => console.error('API エラー:', err));
```

## 🚨 **トラブルシューティング**

### **問題1: 認証後にエラーが発生する**

**症状**: OAuth認証は成功するが、ダッシュボードでエラーが表示される

**解決方法**:
1. ブラウザのキャッシュをクリア
2. `frontend/.env.local` の設定を確認
3. Supabase RLSポリシーが正しく設定されているか確認

### **問題2: リダイレクトURLエラー**

**症状**: `redirect_uri_mismatch` エラーが表示される

**解決方法**:
1. Google Cloud Console / GitHub設定でredirect URIを再確認
2. Supabase Authentication設定でAdditional Redirect URLsを再確認
3. 設定変更後、5-10分待機してから再テスト

### **問題3: CORS エラー**

**症状**: `CORS policy` エラーが表示される

**解決方法**:
1. Supabase → Settings → API → CORS Origins に `http://localhost:3000` を追加
2. ブラウザを完全に再起動
3. 開発サーバーを再起動

## 📝 **設定確認チェックリスト**

### **Supabase設定**
- [ ] Site URL: `https://jamiyzsyclvlvstmeeir.supabase.co`
- [ ] Additional Redirect URLs に `http://localhost:3000` を追加
- [ ] Additional Redirect URLs に `http://localhost:3000/dashboard` を追加
- [ ] CORS Origins に `http://localhost:3000` を追加

### **Google OAuth設定**
- [ ] Authorized JavaScript origins に `http://localhost:3000` を追加
- [ ] Authorized JavaScript origins に `https://jamiyzsyclvlvstmeeir.supabase.co` を追加
- [ ] Authorized redirect URIs に `https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback` を設定

### **GitHub OAuth設定**
- [ ] Authorization callback URL: `https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback`

### **ローカル環境設定**
- [ ] `frontend/.env.local` に正しいSupabase URLとキーを設定
- [ ] 開発サーバーが `http://localhost:3000` で起動
- [ ] ブラウザキャッシュをクリア

## 💡 **重要なポイント**

1. **プロジェクト分離は不要**: 1つのSupabaseプロジェクトで開発・本番両方をサポート可能
2. **Redirect URL**: Supabaseが自動的にローカル開発環境を検出してリダイレクト
3. **セキュリティ**: 本番環境とローカル環境で同じRLSポリシーが適用される
4. **データ分離**: 認証ユーザーごとにデータが自動分離される

---

**最終更新**: 2026年1月5日  
**対象バージョン**: v2.0.0 - Supabase統合版  
**テスト環境**: ローカル開発環境 + 本番環境