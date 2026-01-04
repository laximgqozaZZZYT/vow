# 🔧 Supabase CORS設定修正ガイド

## 🚨 **問題**

```
Access to fetch at 'https://jamiyzsyclvlvstmeeir.supabase.co/rest/v1/habits' 
from origin 'https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' 
when the request's credentials mode is 'include'.
```

## 🔧 **解決方法**

### **1. Supabaseダッシュボードでの設定**

1. **Supabaseダッシュボード**にアクセス
   - https://supabase.com/dashboard/projects/jamiyzsyclvlvstmeeir

2. **Settings** → **API** をクリック

3. **CORS Origins** セクションで以下を設定：
   ```
   https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app
   http://localhost:3000
   ```

4. **Save** をクリック

### **2. Authentication設定の確認**

1. **Authentication** → **Settings** をクリック

2. **Site URL** を確認：
   ```
   https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app
   ```

3. **Additional Redirect URLs** に以下を追加：
   ```
   https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app/dashboard
   https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app/auth/callback
   http://localhost:3000/dashboard
   http://localhost:3000/auth/callback
   ```

### **3. コード修正（既に実施済み）**

- `frontend/lib/supabaseClient.ts` でCORS設定を調整
- カスタムfetch関数でcredentialsを制御

## 📋 **確認手順**

### **設定後の確認**

1. **Supabase設定を保存後、5-10分待機**（設定反映のため）

2. **ブラウザキャッシュをクリア**
   - Chrome: Ctrl+Shift+R (強制リロード)
   - または開発者ツール → Network → Disable cache

3. **本番環境でテスト**
   - https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app/dashboard
   - ブラウザコンソールでCORSエラーが消えているか確認

### **デバッグ用コマンド**

ブラウザコンソールで実行：

```javascript
// CORS テスト
fetch('https://jamiyzsyclvlvstmeeir.supabase.co/rest/v1/goals', {
  method: 'GET',
  headers: {
    'apikey': 'sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm',
    'Authorization': 'Bearer sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm'
  }
})
.then(response => console.log('✅ CORS OK:', response.status))
.catch(error => console.error('❌ CORS Error:', error));
```

## 🔄 **代替案**

### **Option A: Supabase Edge Functions使用**

CORSの問題を完全に回避するため、Supabase Edge Functionsを使用。

### **Option B: Next.js API Routes使用**

```typescript
// pages/api/habits.ts
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // サーバーサイド用キー
  )
  
  // サーバーサイドでSupabaseにアクセス（CORS回避）
  const { data, error } = await supabase.from('habits').select('*')
  
  if (error) return res.status(500).json({ error })
  return res.json(data)
}
```

## ⚠️ **注意事項**

- CORS設定変更後、反映まで5-10分かかる場合があります
- ブラウザキャッシュが原因で古い設定が残る場合があります
- 開発環境と本番環境の両方のURLを設定してください