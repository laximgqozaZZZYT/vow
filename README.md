# VOWアプリ

Next.jsとSupabaseで構築された個人向け生産性アプリケーションです。目標管理、習慣管理、日記機能を提供します。

## 🚀 技術スタック

- **フロントエンド**: Next.js 16.1.1, React 19, TypeScript
- **バックエンド**: Supabase (PostgreSQL, 認証, リアルタイム)
- **スタイリング**: Tailwind CSS
- **デプロイメント**: Vercel (フロントエンド) + Supabase (バックエンド)
- **CI/CD**: GitHub Actions

## 📋 機能

- 🎯 目標管理と追跡
- 📅 カレンダー連携による習慣管理
- 📝 活動記録
- 📖 Markdownサポート付きデジタル日記
- 🔐 OAuth認証 (Google/GitHub)
- 📱 レスポンシブデザイン
- 🔒 データ分離のための行レベルセキュリティ

## 🛠️ 開発セットアップ

### 前提条件

- Node.js 20.x 以降
- npm または yarn
- Supabaseアカウント
- Vercelアカウント（デプロイメント用）

### ローカル開発

1. **リポジトリをクローンする**
   ```bash
   git clone <repository-url>
   cd vow-app
   ```

2. **依存関係をインストールする**
   ```bash
   cd frontend
   npm install
   ```

3. **環境設定**
   ```bash
   cp .env.local.example .env.local
   # .env.localファイルにSupabaseの認証情報を設定してください
   ```

4. **開発サーバーを起動する**
   ```bash
   npm run dev
   ```

5. **アプリケーションにアクセスする**
   - ブラウザで http://localhost:3000 を開いてください

### 環境変数

`frontend`ディレクトリに`.env.local`ファイルを作成してください：

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_STATIC_EXPORT=false
```

## 🚀 デプロイメント

### Vercelデプロイメント（推奨）

1. **このリポジトリをフォーク/クローンする**

2. **Vercelにインポートする**
   - [Vercel Dashboard](https://vercel.com/dashboard)にアクセス
   - "Add New..." → "Project"をクリック
   - GitHubリポジトリをインポート
   - Root Directoryを`frontend`に設定

3. **環境変数を設定する**
   - `.env.local`からすべての環境変数を追加
   - Vercelデプロイメント用に`NEXT_STATIC_EXPORT=false`を設定

4. **デプロイする**
   - Vercelはmainブランチへのプッシュ時に自動デプロイします
   - またはCI/CD制御にGitHub Actionsを使用

### Supabase静的ホスティング（代替案）

1. **静的エクスポート用にビルドする**
   ```bash
   cd frontend
   npm run build:static
   ```

2. **Supabase Storageにデプロイする**
   ```bash
   supabase storage cp -r out/* supabase://website/
   ```

## 🔧 CI/CDパイプライン

このプロジェクトは自動テストとデプロイメントにGitHub Actionsを使用しています：

- **テスト**: すべてのプッシュとPRで実行
- **デプロイメント**: mainブランチへのプッシュ時にVercelにデプロイ
- **セキュリティ**: Supabase統合による自動セキュリティテスト

### 必要なGitHubシークレット

CI/CDデプロイメントには、GitHubリポジトリに以下のシークレットを追加してください：

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
VERCEL_TOKEN
VERCEL_PROJECT_ID
VERCEL_ORG_ID
```

## 📁 プロジェクト構造

```
├── frontend/                 # Next.jsアプリケーション
│   ├── app/                 # App Routerページ
│   ├── lib/                 # ユーティリティと設定
│   ├── public/              # 静的アセット
│   └── package.json
├── docs/                    # ドキュメント
├── scripts/                 # ビルドとデプロイメントスクリプト
├── .github/workflows/       # GitHub Actions
└── vercel.json             # Vercel設定
```

## 🔒 セキュリティ

- すべてのデータベーステーブルで行レベルセキュリティ（RLS）を有効化
- GoogleとGitHubによるOAuth認証
- 本番環境でHTTPS強制
- セキュリティヘッダーを設定
- 環境変数の暗号化

## 📖 ドキュメント

- [デプロイメントガイド](docs/deployment-guide.md)
- [Vercelセットアップガイド](docs/vercel-setup-guide.md)
- [APIドキュメント](docs/api.md)
- [セキュリティガイド](docs/security.md)

## 🤝 貢献

1. リポジトリをフォークする
2. 機能ブランチを作成する
3. 変更を加える
4. 該当する場合はテストを追加する
5. プルリクエストを送信する

## 📄 ライセンス

このプロジェクトはMITライセンスの下でライセンスされています。詳細は[LICENSE](LICENSE)ファイルをご覧ください。

## 🆘 サポート

問題が発生した場合：

1. [トラブルシューティングガイド](docs/troubleshooting.md)を確認してください
2. 既存の[GitHubイシュー](https://github.com/your-username/vow-app/issues)を検索してください
3. 詳細な情報とともに新しいイシューを作成してください

## 🎯 ロードマップ

- [ ] モバイルアプリ（React Native）
- [ ] 高度な分析とインサイト
- [ ] チームコラボレーション機能
- [ ] API統合（カレンダー、フィットネストラッカー）
- [ ] 同期機能付きオフラインサポート