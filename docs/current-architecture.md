# Vow - 現在のアーキテクチャ構成

## 概要

Vowは個人の目標・習慣管理アプリケーションで、Next.js + Supabaseで構築されています。
ゲストユーザーとOAuth認証ユーザーの両方をサポートし、Vercelでホストされています。

## システム構成

### フロントエンド
- **フレームワーク**: Next.js 16.1.1 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **デプロイ**: Vercel
- **URL**: https://vow-sigma.vercel.app/

### バックエンド
- **データベース**: Supabase PostgreSQL
- **認証**: Supabase Auth (Google OAuth, GitHub OAuth)
- **API**: Supabase REST API + Direct Client
- **URL**: https://jamiyzsyclvlvstmeeir.supabase.co

## アーキテクチャ図

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Supabase      │    │   OAuth         │
│   (Next.js)     │◄──►│   PostgreSQL     │    │   Providers     │
│                 │    │   + Auth         │    │                 │
│   Vercel        │    │                 │◄──►│   Google        │
│                 │    │                 │    │   GitHub        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Local Storage  │
│  (Guest Data)   │
└─────────────────┘
```

## データフロー

### 1. ゲストユーザー
- データはブラウザのLocalStorageに保存
- 認証不要でフル機能利用可能
- Goals, Habits, Activities全て対応

### 2. 認証ユーザー
- OAuth認証後、Supabaseデータベースに保存
- ゲストデータの移行機能あり
- 複数デバイス間でのデータ同期

## 主要コンポーネント

### API層
- **`frontend/lib/api.ts`**: 統一API インターフェース
- **`frontend/lib/supabase-direct.ts`**: Supabase直接クライアント
- **`frontend/lib/supabaseClient.ts`**: Supabase設定

### データモデル
- **Goals**: 目標管理
- **Habits**: 習慣管理  
- **Activities**: 活動記録
- **Layout**: ダッシュボード設定

### UI コンポーネント
- **Dashboard**: メインダッシュボード
- **Widgets**: 各種ウィジェット（カレンダー、統計など）
- **Login**: OAuth認証画面

## 環境設定

### 必要な環境変数
```bash
NEXT_PUBLIC_SUPABASE_URL=https://jamiyzsyclvlvstmeeir.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
NEXT_PUBLIC_USE_SUPABASE_API=true
NEXT_PUBLIC_SITE_URL=https://vow-sigma.vercel.app
```

### OAuth設定
- **Google OAuth**: Google Cloud Console設定済み
- **GitHub OAuth**: GitHub Apps設定済み
- **Supabase**: 両プロバイダー有効化済み

## デプロイメント

### 自動デプロイ
- GitHub Actions経由でVercelに自動デプロイ
- `main`ブランチへのpush時に実行
- ビルド・テスト・デプロイの完全自動化

### 手動デプロイ
```bash
# Vercel CLI使用
vercel --prod
```

## セキュリティ

### Row Level Security (RLS)
- Supabaseで全テーブルにRLS適用
- ユーザー毎のデータ分離
- 適切なポリシー設定

### 認証
- OAuth 2.0準拠
- JWTトークンベース認証
- セッション管理

## 開発環境

### ローカル開発
```bash
cd frontend
npm run dev
```

### ビルド
```bash
cd frontend
npm run build
```

### テスト
```bash
npm run security-test
```

## 今後の拡張予定

1. **モバイルアプリ**: React Native対応
2. **チーム機能**: 複数ユーザー協調
3. **AI機能**: 習慣分析・推奨
4. **通知機能**: リマインダー・プッシュ通知

## トラブルシューティング

一般的な問題と解決方法については以下を参照：
- [deployment-guide.md](./deployment-guide.md)
- [troubleshooting.md](./troubleshooting.md)
- [vercel-troubleshooting.md](./vercel-troubleshooting.md)