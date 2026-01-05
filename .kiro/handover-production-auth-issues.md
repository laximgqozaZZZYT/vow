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
フロントエンド → Next.js API Routes → Express API (Railway) → Supabase PostgreSQL
                ↓                      ↓
            OAuth認証（Google）    セッションCookie認証
```

### **実際の本番環境（問題発生中）**
```
フロントエンド → Next.js API Routes → Express API (Railway)
                ↓                      ↓
            OAuth認証（Google）    ❌ セッションCookie転送未実装
```

---

## 📁 **関連ファイル**

### **フロントエンド**
- `frontend/lib/api.ts` - API呼び出しロジック
- `frontend/lib/supabaseClient.ts` - Supabaseクライアント設定（本番環境でDB操作無効化）
- `frontend/app/dashboard/page.tsx` - メインダッシュボード
- `frontend/app/api/*.ts` - Next.js API Routes（セッションCookie処理要実装）

### **設定ファイル**
- `frontend/.env.local` - 開発環境変数
- `docs/vercel-environment-variables.md` - 本番環境変数設定

### **Supabase関連**
- `scripts/supabase-schema.sql` - テーブル作成スクリプト
- `scripts/fix-rls-policies.sql` - RLSポリシー修正

---

## 🔧 **実施済み修正**

### **1. Next.js API Routes作成**
- `frontend/app/api/goals.ts`
- `frontend/app/api/habits.ts`
- `frontend/app/api/activities.ts`
- `frontend/app/api/me.ts`
- `frontend/app/api/layout.ts`
- `frontend/app/api/diary.ts`
- `frontend/app/api/tags.ts`
- `frontend/app/api/claim.ts`

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

### **1. Next.js API Routesのセッション処理が未実装**
**原因**: 現在のNext.js API Routesは単純にバックエンドAPIにプロキシしているだけで、セッションCookieを適切に転送していない

**確認事項**:
- `frontend/app/api/*/route.ts`でセッションCookie（`vow_session`）の転送処理
- バックエンドAPIへのリクエスト時の`Cookie`ヘッダー設定
- 認証状態の適切な転送

### **2. React Error #418**
**原因**: `frontend/lib/supabaseClient.ts`で本番環境でデータベース操作をブロックしているが、エラーメッセージが長すぎてMinify時に#418に変換される

**調査方法**:
- 開発ビルドで詳細エラーを確認
- Supabaseクライアントのエラーハンドリングを改善
- 本番環境でのSupabaseクライアント使用箇所を特定

### **3. OAuth認証後のセッション処理**
**原因**: OAuth後にセッションCookieは設定されるが、Next.js API Routes経由でのデータ取得時にセッションが適切に転送されていない

**影響**: ログイン後にHabitやGoalが表示されない

---

## 🎯 **推奨解決策**

### **優先度1: Next.js API Routesのセッション処理実装**

#### **Option A: セッションCookie転送機能の実装**
```typescript
// frontend/app/api/*/route.ts
const sessionCookie = request.cookies.get('vow_session')
if (sessionCookie) {
  headers['Cookie'] = `vow_session=${sessionCookie.value}`
}
```

#### **Option B: 認証ヘッダーとセッションの統合処理**
セッションCookieとAuthorizationヘッダーの両方を適切に転送

#### **Option C: エラーハンドリングの改善**
バックエンドAPIからのエラーレスポンスを適切にフロントエンドに転送

### **優先度2: React Error #418調査**
1. Supabaseクライアントのエラーメッセージを短縮
2. 本番環境でのSupabaseクライアント使用箇所を特定・修正
3. エラーハンドリングの改善

### **優先度3: 認証フロー改善**
1. OAuth後のセッションCookie処理改善
2. Next.js API Routes経由でのデータ取得機能完成
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
// セッションCookieが適切に転送されているか確認
fetch('/api/goals', {
  credentials: 'include'
})
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

1. **Next.js API Routesのセッション処理実装**
2. **React Error #418の調査・修正**
3. **認証フローの安定化**
4. **本番環境でのHabit登録機能の復旧**

**期待する成果**: 本番環境でのHabit作成・表示が正常に動作すること