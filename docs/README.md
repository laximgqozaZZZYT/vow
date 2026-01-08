# Vow - Personal Goal & Habit Tracker

## 概要

Vowは個人の目標・習慣管理アプリケーションです。Next.js + Supabaseで構築され、ゲストユーザーとOAuth認証ユーザーの両方をサポートしています。

- **本番URL**: https://vow-sigma.vercel.app/
- **技術スタック**: Next.js 16.1.1, TypeScript, Tailwind CSS, Supabase
- **認証**: Google OAuth, GitHub OAuth, ゲストモード

## 🚀 クイックスタート

### 開発環境セットアップ
```bash
# リポジトリクローン
git clone <repository-url>
cd vow

# 依存関係インストール
cd frontend
npm install

# 環境変数設定
cp .env.example .env.local
# .env.localを編集（下記参照）

# 開発サーバー起動
npm run dev
```

### 環境変数設定
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://jamiyzsyclvlvstmeeir.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
NEXT_PUBLIC_USE_SUPABASE_API=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 🏗️ アーキテクチャ

### システム構成
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Supabase      │    │   OAuth         │
│   (Next.js)     │◄──►│   PostgreSQL     │    │   Providers     │
│   Vercel        │    │   + Auth         │◄──►│   Google/GitHub │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Local Storage  │
│  (Guest Data)   │
└─────────────────┘
```

### プロジェクト構造
```
vow/
├── frontend/             # メインアプリケーション
│   ├── app/             # Next.js App Router
│   │   ├── dashboard/   # ダッシュボード
│   │   └── login/       # 認証ページ
│   ├── lib/             # API・ユーティリティ
│   └── package.json     # 依存関係
├── docs/                # ドキュメント
├── scripts/             # ユーティリティスクリプト
├── supabase/            # データベース設定
└── .github/workflows/   # CI/CD
```

### データフロー
- **ゲストユーザー**: LocalStorageに保存、認証不要
- **認証ユーザー**: Supabaseデータベースに保存、デバイス間同期

## 📡 API仕様

### 統一API (`frontend/lib/api.ts`)
```typescript
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

### データ構造
```typescript
interface Goal {
  id: string;
  name: string;
  details?: string;
  dueDate?: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Habit {
  id: string;
  name: string;
  type: string;
  count: number;
  must?: number;
  completed: boolean;
  // ... その他のフィールド
}

interface Activity {
  id: string;
  kind: 'start' | 'complete' | 'pause' | 'skip';
  habitId: string;
  timestamp: string;
  amount?: number;
  durationSeconds?: number;
}
```

## 🗄️ データベーススキーマ

### 主要テーブル
```sql
-- Goals（目標）
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  details TEXT,
  due_date TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,
  owner_type TEXT NOT NULL DEFAULT 'user',
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habits（習慣）
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  must INTEGER,
  completed BOOLEAN DEFAULT false,
  owner_type TEXT NOT NULL DEFAULT 'user',
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activities（活動記録）
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  habit_id UUID REFERENCES habits(id),
  habit_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  amount INTEGER,
  duration_seconds INTEGER,
  owner_type TEXT NOT NULL DEFAULT 'user',
  owner_id TEXT NOT NULL
);
```

### Row Level Security (RLS)
全テーブルでRLSが有効化され、ユーザー毎のデータ分離を実現：
```sql
-- 例: Goals テーブルのポリシー
CREATE POLICY "Users can only access their own goals" ON goals
  FOR ALL USING (owner_id = auth.uid()::text);
```

## 🔐 セキュリティ

### 認証
- **OAuth 2.0**: Google, GitHub
- **JWT**: トークンベース認証
- **セッション管理**: Supabase Auth

### データ保護
- **RLS**: データベースレベルでのアクセス制御
- **HTTPS**: 全通信暗号化
- **CORS**: 適切なオリジン設定
- **XSS対策**: サニタイゼーション実装

### 環境変数管理
- 機密情報は環境変数で管理
- 本番環境ではVercel環境変数使用
- 開発環境では`.env.local`使用

## 🚀 デプロイメント

### 自動デプロイ（推奨）
1. GitHubにpush
2. GitHub Actionsが自動実行
3. Vercelに自動デプロイ

### 手動デプロイ
```bash
cd frontend
vercel --prod
```

### 環境設定
- **Vercel**: 環境変数設定必須
- **Supabase**: OAuth設定必須
- **Google/GitHub**: OAuth App設定必須

## 🛠️ 開発

### ローカル開発
```bash
cd frontend
npm run dev          # 開発サーバー
npm run build        # ビルド
npm run lint         # リント
```

### テスト
```bash
npm run security-test  # セキュリティテスト
```

## 📚 詳細ドキュメント

- **[SETUP.md](./docs/SETUP.md)** - 詳細セットアップガイド
- **[SECURITY.md](./docs/SECURITY.md)** - セキュリティガイド
- **[troubleshooting.md](./docs/troubleshooting.md)** - トラブルシューティング

## 🔄 今後の予定

1. **モバイル対応**: React Native
2. **チーム機能**: 複数ユーザー協調
3. **AI機能**: 習慣分析・推奨
4. **国際化**: 多言語対応

## 📞 サポート

問題が発生した場合：
1. [troubleshooting.md](./docs/troubleshooting.md) を確認
2. GitHub Issuesで報告
3. ドキュメントを参照