# API ドキュメント

## 概要

VowアプリケーションのAPI構成とエンドポイントについて説明します。

## API アーキテクチャ

### 統一API層 (`frontend/lib/api.ts`)

全てのデータ操作は統一されたAPI インターフェースを通じて行われます。

```typescript
// 使用例
import api from '../lib/api';

// Goals
const goals = await api.getGoals();
const newGoal = await api.createGoal({ name: "新しい目標" });

// Habits  
const habits = await api.getHabits();
const newHabit = await api.createHabit({ name: "新しい習慣", type: "count" });

// Activities
const activities = await api.getActivities();
```

### データフロー制御

環境変数 `NEXT_PUBLIC_USE_EDGE_FUNCTIONS` により動作モードを切り替え：

- `false` (現在): Supabase Direct Client使用
- `true`: Supabase Edge Functions使用（未実装）

## エンドポイント一覧

### Goals API

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/goals` | 目標一覧取得 |
| POST | `/goals` | 新規目標作成 |
| PATCH | `/goals/{id}` | 目標更新 |
| DELETE | `/goals/{id}` | 目標削除 |

#### Goal データ構造
```typescript
interface Goal {
  id: string;
  name: string;
  details?: string;
  dueDate?: string;
  parentId?: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Habits API

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/habits` | 習慣一覧取得 |
| POST | `/habits` | 新規習慣作成 |
| PATCH | `/habits/{id}` | 習慣更新 |
| DELETE | `/habits/{id}` | 習慣削除 |

#### Habit データ構造
```typescript
interface Habit {
  id: string;
  goalId?: string;
  name: string;
  active: boolean;
  type: string;
  count: number;
  must?: number;
  duration?: number;
  reminders?: any[];
  dueDate?: string;
  time?: string;
  endTime?: string;
  repeat?: string;
  timings?: any[];
  allDay?: boolean;
  notes?: string;
  workloadUnit?: string;
  workloadTotal?: number;
  workloadPerCount?: number;
  completed: boolean;
  lastCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Activities API

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/activities` | 活動履歴取得 |
| POST | `/activities` | 新規活動記録 |
| PATCH | `/activities/{id}` | 活動更新 |
| DELETE | `/activities/{id}` | 活動削除 |

#### Activity データ構造
```typescript
interface Activity {
  id: string;
  kind: 'start' | 'complete' | 'pause' | 'skip';
  habitId: string;
  habitName: string;
  timestamp: string;
  amount?: number;
  prevCount?: number;
  newCount?: number;
  durationSeconds?: number;
}
```

### Layout API

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/layout` | レイアウト設定取得 |
| POST | `/layout` | レイアウト設定保存 |

### Auth API

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/me` | 現在のユーザー情報 |
| POST | `/auth/claim` | ゲストデータの移行 |

## 認証とデータ分離

### ゲストユーザー
- LocalStorageにデータ保存
- 認証不要でフル機能利用
- データキー例：
  - `guest-goals`
  - `guest-habits` 
  - `guest-activities`

### 認証ユーザー
- Supabaseデータベースに保存
- Row Level Security (RLS)でデータ分離
- OAuth JWTトークンで認証

### データ移行
```typescript
// ゲストデータを認証ユーザーに移行
await api.claim();
```

## エラーハンドリング

### ApiError クラス
```typescript
class ApiError extends Error {
  url: string;
  status?: number;
  body?: string;
}
```

### 一般的なエラー
- `Not authenticated`: 認証が必要な操作
- `Supabase not configured`: 環境変数未設定
- `HTTP 4xx/5xx`: サーバーエラー

## 開発・デバッグ

### デバッグログ
ブラウザコンソールで以下の情報を確認可能：
```
=== API Configuration Debug (Supabase Integrated) ===
SUPABASE_URL: https://jamiyzsyclvlvstmeeir.supabase.co
USE_EDGE_FUNCTIONS: false
🚀 Using: Supabase Client Direct
```

### ローカル開発
```bash
# フロントエンド開発サーバー起動
cd frontend
npm run dev
```

## セキュリティ考慮事項

1. **環境変数**: 機密情報は適切に管理
2. **RLS**: データベースレベルでアクセス制御
3. **CORS**: 適切なオリジン設定
4. **JWT**: トークンの適切な検証

## パフォーマンス最適化

1. **キャッシュ**: SWRによるクライアントサイドキャッシュ
2. **バッチ処理**: 複数操作の最適化
3. **遅延読み込み**: 必要時のみデータ取得