# VOW - 習慣・目標トラッカー

シンプルで使いやすい個人向け習慣管理・目標設定アプリケーションです。

🌐 **本番URL**: https://main.do1k9oyyorn24.amplifyapp.com/

[![VOW Demo](https://img.shields.io/badge/🚀_Live_Demo-Try_Now-blue?style=for-the-badge)](https://main.do1k9oyyorn24.amplifyapp.com/)
[![Dashboard](https://img.shields.io/badge/📊_Dashboard-Open-green?style=for-the-badge)](https://main.do1k9oyyorn24.amplifyapp.com/dashboard)

## 🎬 デモプレビュー

<p align="center">
  <a href="https://main.do1k9oyyorn24.amplifyapp.com/">
    <img src="docs/images/demo-preview.png" alt="VOW Dashboard Demo" width="800" />
  </a>
</p>

> 👆 クリックしてインタラクティブデモを体験！登録不要・完全無料で今すぐ始められます。

## ✨ 主な機能

- 🎯 **目標管理** - 階層構造で目標を整理、進捗を可視化
- 📅 **習慣トラッキング** - カレンダー連携、繰り返し設定、継続記録
- 🗺️ **マインドマップ** - 目標と習慣の関係を視覚的に管理
- 🏷️ **タグシステム** - 目標・習慣・日記を横断的に分類
- 📝 **日記機能** - Markdownサポート付きの振り返り
- 📊 **統計・分析** - ヒートマップ、進捗チャート
- 🔐 **認証** - Google/GitHub OAuth、ゲストモード対応
- 📱 **レスポンシブ** - PC・タブレット・スマートフォン対応

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js 16.1.1, React 19, TypeScript |
| スタイリング | Tailwind CSS 4 |
| バックエンド | Supabase (PostgreSQL, Auth, RLS) |
| カレンダー | FullCalendar |
| マインドマップ | React Flow |
| テスト | Jest, fast-check (Property-Based Testing) |
| デプロイ | Vercel + Supabase |

## 🚀 クイックスタート

### 前提条件

- Node.js 20.x 以降
- npm
- Supabaseアカウント（認証ユーザー機能を使う場合）

### セットアップ

```bash
# リポジトリをクローン
git clone <repository-url>
cd vow

# 依存関係をインストール
cd frontend
npm install

# 環境変数を設定
cp .env.example .env.local
```

`.env.local` を編集:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
# 開発サーバーを起動
npm run dev
```

http://localhost:3000 でアプリにアクセスできます。

## 📁 プロジェクト構造

```
vow/
├── frontend/                 # Next.js アプリケーション
│   ├── app/
│   │   ├── dashboard/       # メインダッシュボード
│   │   │   ├── components/  # UI コンポーネント
│   │   │   ├── hooks/       # カスタムフック
│   │   │   └── types/       # 型定義
│   │   ├── login/           # 認証ページ
│   │   └── contexts/        # React Context
│   ├── lib/                 # API・ユーティリティ
│   │   ├── api.ts           # 統一API（ゲスト/認証自動切替）
│   │   └── mindmap/         # マインドマップユーティリティ
│   └── __tests__/           # テストファイル
├── docs/                    # ドキュメント
├── scripts/                 # SQLスクリプト・ユーティリティ
├── supabase/
│   └── migrations/          # DBマイグレーション
└── .kiro/specs/             # 機能仕様書
```

## 🔧 開発コマンド

```bash
cd frontend

npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run lint         # ESLint実行
npm run test         # テスト実行
npm run test:watch   # テスト（ウォッチモード）
```

## 🗄️ データ管理

### ゲストモード
- LocalStorageにデータを保存
- アカウント不要ですぐに利用可能
- ログイン時にデータを自動移行

### 認証ユーザー
- Supabase PostgreSQLにデータを保存
- デバイス間でデータ同期
- Row Level Security (RLS) でデータ保護

## 📖 ドキュメント

- [セットアップガイド](docs/SETUP.md)
- [セキュリティガイド](docs/SECURITY.md)
- [タグ機能](docs/TAGS_FEATURE.md)
- [マインドマップ](docs/UNIFIED_RELATION_MAP.md)
- [トラブルシューティング](docs/troubleshooting.md)

## 🚀 デプロイ

### Vercel（推奨）

1. GitHubリポジトリをVercelにインポート
2. Root Directoryを `frontend` に設定
3. 環境変数を設定
4. デプロイ

mainブランチへのプッシュで自動デプロイされます。

## 📄 ライセンス

MIT License - [LICENSE](LICENSE) を参照
