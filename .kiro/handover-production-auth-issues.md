# 🚨 本番環境認証問題 - 引き継ぎドキュメント

## 📋 **現在の状況**

### **問題概要**
本番環境（https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app/dashboard）で以下の問題が発生：

1. **CORSエラー** - Supabaseへの直接アクセスがブロックされている
2. **React Error #418** - Minified Reactエラー（テキスト関連）
3. **認証フロー不具合** - OAuth後のデータ取得に失敗

### **エラー詳細**

#### **1. CORSエラー**
```
Access to fetch at 'https://jamiyzsyclvlvstmeeir.supabase.co/rest/v1/*' 
from origin 'https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' 
when the request's credentials mode is 'include'.
```

**影響範囲**:
- `/rest/v1/diary`
- `/rest/v1/diary/tags`
- `/rest/v1/auth/claim`
- `/rest/v1/me`
- `/rest/v1/goals`

#### **2. React Error #418**
```
Uncaught Error: Minified React error #418; 
visit https://react.dev/errors/418?args[]=text&args[]= for the full message
```

**推定原因**: テキストノードの不正な使用またはSSR/CSRの不一致

---

## 🏗️ **現在のアーキテクチャ**

### **開発環境**
```
フロントエンド → Express API (localhost:4000) → MySQL
                ↓
            Supabase認証
```

### **本番環境（意図した設計）**
```
フロントエンド → Next.js API Routes → Supabase PostgreSQL
                ↓
            OAuth認証（Google）
```

### **実際の本番環境（問題発生中）**
```
フロントエンド → Supabase Direct API ❌ CORS Error
                ↓
            OAuth認証（Google）
```

---

## 📁 **関連ファイル**

### **フロントエンド**
- `frontend/lib/api.ts` - API呼び出しロジック
- `frontend/lib/supabaseClient.ts` - Supabaseクライアント設定
- `frontend/app/dashboard/page.tsx` - メインダッシュボード
- `frontend/pages/api/*.ts` - Next.js API Routes

### **設定ファイル**
- `frontend/.env.local` - 開発環境変数
- `docs/vercel-environment-variables.md` - 本番環境変数設定

### **Supabase関連**
- `scripts/supabase-schema.sql` - テーブル作成スクリプト
- `scripts/fix-rls-policies.sql` - RLSポリシー修正

---

## 🔧 **実施済み修正**

### **1. Next.js API Routes作成**
- `frontend/pages/api/goals.ts`
- `frontend/pages/api/habits.ts`
- `frontend/pages/api/activities.ts`
- `frontend/pages/api/me.ts`
- `frontend/pages/api/layout.ts`

### **2. 環境別設定**
```typescript
// frontend/lib/api.ts
const USE_NEXTJS_API = process.env.NODE_ENV === 'production';
```

### **3. Supabaseクライアント制御**
```typescript
// frontend/lib/supabaseClient.ts
if (process.env.NODE_ENV === 'production') {
  console.log('[supabase] Disabled in production to avoid CORS issues');
  return null as any;
}
```

---

## 🚨 **未解決の問題**

### **1. 本番環境でSupabase Direct APIが呼び出される**
**原因**: 環境変数またはビルド時の設定が正しく反映されていない

**確認事項**:
- Vercel環境変数が正しく設定されているか
- ビルド時に環境変数が適用されているか
- キャッシュが古い設定を保持していないか

### **2. React Error #418**
**原因**: 不明（Minifiedエラーのため詳細不明）

**調査方法**:
- 開発ビルドで詳細エラーを確認
- SSR/CSRの不一致を調査
- テキストノードの使用箇所を確認

### **3. OAuth認証後のデータ取得失敗**
**原因**: CORSエラーによりAPI呼び出しが失敗

**影響**: ログイン後にHabitやGoalが表示されない

---

## 🎯 **推奨解決策**

### **優先度1: CORS問題の根本解決**

#### **Option A: Next.js API Routes強制使用**
```typescript
// frontend/lib/api.ts
const USE_NEXTJS_API = true; // 強制的に有効化
```

#### **Option B: Supabase CORS設定修正**
1. Supabaseダッシュボード → Settings → API
2. CORS Origins に具体的なドメインを設定:
   ```
   https://vow-bas68dkhj-laximgqozazzzyts-projects.vercel.app
   ```

#### **Option C: Supabase Edge Functions使用**
CORSを完全に回避するためのサーバーサイド処理

### **優先度2: React Error #418調査**
1. 開発ビルドでエラー詳細を確認
2. SSR/CSR不一致の調査
3. テキストレンダリング箇所の修正

### **優先度3: 認証フロー改善**
1. OAuth後のトークン処理改善
2. セッション管理の統一
3. エラーハンドリングの強化

---

## 🔍 **デバッグ手順**

### **1. 本番環境での設定確認**
ブラウザコンソールで実行:
```javascript
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('USE_NEXTJS_API:', /* 実際の値を確認 */);
```

### **2. Next.js API Routes動作確認**
```javascript
fetch('/api/goals')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

### **3. Supabase接続テスト**
```javascript
// scripts/debug-production.js の内容を実行
```

---

## 📚 **参考資料**

- `docs/supabase-cors-fix.md` - CORS修正ガイド
- `docs/vercel-environment-variables.md` - 環境変数設定
- `scripts/debug-production.js` - デバッグスクリプト
- React Error #418: https://react.dev/errors/418

---

## ⚠️ **注意事項**

1. **環境変数変更後は必ず再デプロイが必要**
2. **ブラウザキャッシュクリアが必要な場合がある**
3. **Supabase設定変更は反映に5-10分かかる**
4. **開発環境は正常動作中（変更時は注意）**

---

## 🤝 **引き継ぎ先への依頼**

1. **CORS問題の根本解決**
2. **React Error #418の調査・修正**
3. **認証フローの安定化**
4. **本番環境でのHabit登録機能の復旧**

**期待する成果**: 本番環境でのHabit作成・表示が正常に動作すること