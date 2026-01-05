# ~~🔧 Next.js API Routes修正ガイド~~

## ⚠️ **このドキュメントは廃止されました**

**理由**: Supabase統合アーキテクチャへの移行により、Next.js API Routesは不要になりました。

## 📋 ~~**修正対象ファイル**~~

~~以下の8つのNext.js API RoutesファイルでセッションCookie転送処理を実装する必要があります：~~

~~1. `frontend/app/api/goals/route.ts`~~
~~2. `frontend/app/api/habits/route.ts`~~
~~3. `frontend/app/api/activities/route.ts`~~
~~4. `frontend/app/api/me/route.ts`~~
~~5. `frontend/app/api/layout/route.ts`~~
~~6. `frontend/app/api/diary/route.ts`~~
~~7. `frontend/app/api/tags/route.ts`~~
~~8. `frontend/app/api/claim/route.ts`~~

**✅ 現在の実装**: `frontend/lib/api.ts`
- 全てのAPI関数がSupabaseクライアント直接使用に統合
- Next.js API Routesは削除済み
- セッションCookie認証からSupabase Auth JWTに移行

## 🚨 ~~**現在の問題**~~

~~### **問題のあるコード例**~~
~~```typescript~~
~~// 現在の実装（セッションCookie転送なし）~~
~~export async function GET(request: NextRequest) {~~
~~  try {~~
~~    const authHeader = request.headers.get('authorization')~~
~~    ~~
~~    const response = await fetch(`${BACKEND_URL}/goals`, {~~
~~      headers: {~~
~~        'Content-Type': 'application/json',~~
~~        ...(authHeader && { 'Authorization': authHeader })~~
~~      }~~
~~    })~~
~~    // ...~~
~~  }~~
~~}~~
~~```~~

~~### **問題点**~~
~~- ❌ セッションCookie（`vow_session`）が転送されない~~
~~- ❌ バックエンドで認証失敗~~
~~- ❌ データ取得ができない~~

**✅ 解決済み**: Supabase統合により以下の問題は解消されました：
- ✅ セッションCookie不要（Supabase Auth JWT使用）
- ✅ バックエンドサーバー不要（Supabaseクライアント直接使用）
- ✅ データ取得正常動作（Row Level Security使用）

## ✅ **現在のアーキテクチャ**

### **新しいAPI実装**
```typescript
// frontend/lib/api.ts - Supabase統合版
export async function getGoals() { 
  const { supabase } = await import('./supabaseClient');
  if (!supabase) throw new Error('Supabase client not available');
  
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (error) throw new Error(error.message);
  
  // Transform snake_case to camelCase
  const transformedData = (data || []).map((goal: any) => ({
    ...goal,
    parentId: goal.parent_id,
    isCompleted: goal.is_completed,
    dueDate: goal.due_date,
    createdAt: goal.created_at,
    updatedAt: goal.updated_at,
  }));
  
  return transformedData;
}
```

### **認証システム**
```typescript
// Supabase Auth統合
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Not authenticated');

// Row Level Security自動適用
// owner_type = 'user' AND owner_id = auth.uid()::text
```

## ~~📁 **ファイル別修正内容**~~

~~### **1. `/api/goals/route.ts`**~~
~~- **エンドポイント**: `/goals`~~
~~- **メソッド**: GET, POST~~
~~- **機能**: Goal一覧取得、Goal作成~~

**✅ 現在の実装**: `frontend/lib/api.ts`
- `getGoals()`, `createGoal()`, `updateGoal()`, `deleteGoal()`
- Supabaseクライアント直接使用
- 自動認証・認可（RLS）

~~### **2. `/api/habits/route.ts`**~~
~~- **エンドポイント**: `/habits`~~
~~- **メソッド**: GET, POST~~
~~- **機能**: Habit一覧取得、Habit作成~~

**✅ 現在の実装**: `frontend/lib/api.ts`
- `getHabits()`, `createHabit()`, `updateHabit()`, `deleteHabit()`
- snake_case ↔ camelCase変換対応

~~### **3. `/api/activities/route.ts`**~~
~~- **エンドポイント**: `/activities`~~
~~- **メソッド**: GET, POST~~
~~- **機能**: Activity一覧取得、Activity作成~~

**✅ 現在の実装**: `frontend/lib/api.ts`
- `getActivities()`, `createActivity()`, `updateActivity()`, `deleteActivity()`

~~### **4. `/api/me/route.ts`**~~
~~- **エンドポイント**: `/me`~~
~~- **メソッド**: GET~~
~~- **機能**: ユーザー情報取得（認証確認）~~

**✅ 現在の実装**: `frontend/lib/api.ts`
- `me()` - Supabase Auth統合

~~### **5. `/api/layout/route.ts`**~~
~~- **エンドポイント**: `/layout`~~
~~- **メソッド**: GET, POST~~
~~- **機能**: レイアウト設定取得・更新~~

**✅ 現在の実装**: `frontend/lib/api.ts`
- `getLayout()`, `saveLayout()` - preferences テーブル使用

~~### **6. `/api/diary/route.ts`**~~
~~- **エンドポイント**: `/diary`~~
~~- **メソッド**: GET, POST~~
~~- **機能**: 日記データ取得・作成~~

**✅ 現在の実装**: `frontend/lib/api.ts`
- `getDiaryCards()`, `createDiaryCard()`, `updateDiaryCard()`, `deleteDiaryCard()`

~~### **7. `/api/tags/route.ts`**~~
~~- **エンドポイント**: `/tags`~~
~~- **メソッド**: GET~~
~~- **機能**: タグ一覧取得~~

**✅ 現在の実装**: `frontend/lib/api.ts`
- `getDiaryTags()`, `createDiaryTag()`, `updateDiaryTag()`, `deleteDiaryTag()`

~~### **8. `/api/claim/route.ts`**~~
~~- **エンドポイント**: `/claim`~~
~~- **メソッド**: POST~~
~~- **機能**: ゲストデータのクレーム処理~~

**✅ 現在の実装**: `frontend/lib/api.ts`
- `claim()` - Supabase統合版では不要（自動的にユーザーIDでデータ分離）

## 🔧 ~~**共通修正パターン**~~

~~### **ヘッダー処理の統一**~~
~~### **エラーハンドリングの統一**~~

**✅ 現在の統一パターン**:
```typescript
// 共通のエラーハンドリング
try {
  const { data, error } = await supabase.from('table').select('*');
  if (error) {
    console.error('[API] Database error:', error.message);
    throw new Error(error.message);
  }
  return transformData(data);
} catch (error) {
  console.error('[API] Failed to load data:', error);
  throw error;
}
```

## 🧪 **現在のテスト方法**

### **1. API関数テスト**
```javascript
// ブラウザコンソールで各API関数をテスト
import api from './lib/api';

// 認証確認
api.me().then(console.log).catch(console.error);

// データ取得
api.getGoals().then(console.log).catch(console.error);
api.getHabits().then(console.log).catch(console.error);
```

### **2. 認証状態確認**
```javascript
// Supabase Auth状態確認
const { data: { session } } = await supabase.auth.getSession();
console.log('Auth session:', session);
```

### **3. データベース直接確認**
```javascript
// RLS動作確認
const { data, error } = await supabase.from('goals').select('*');
console.log('Goals (with RLS):', data, error);
```

## 📊 **移行前後の比較**

| 項目 | 移行前（Next.js API Routes） | 移行後（Supabase統合） |
|------|------------------------------|------------------------|
| アーキテクチャ | 3層構成 | 統合構成 |
| 認証方式 | セッションCookie | Supabase Auth JWT |
| API層 | Next.js API Routes | Supabaseクライアント直接 |
| データベース | Express API経由 | 直接アクセス（RLS） |
| セキュリティ | セッション管理 | Row Level Security |
| 複雑性 | 高い | 低い |
| 保守性 | 困難 | 容易 |

## 🚀 **現在の状況**

1. **✅ 全機能正常動作** - OAuth認証、CRUD操作、UI表示
2. **✅ セキュリティ確保** - RLSによる適切なデータ分離
3. **✅ パフォーマンス向上** - 中間層削除による高速化
4. **✅ 保守性向上** - シンプルなアーキテクチャ
5. **✅ デプロイ準備完了** - 本番環境展開可能

---

**最終更新**: 2026年1月5日  
**状況**: ✅ Supabase統合完了 - Next.js API Routes廃止  
**新しい実装**: `frontend/lib/api.ts` - Supabaseクライアント直接使用