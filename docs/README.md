# Vow - ドキュメント

## 概要

Vowは個人の目標・習慣管理アプリケーションです。このディレクトリには、システムの構成、API、デプロイメント、セキュリティに関する包括的なドキュメントが含まれています。

## ドキュメント一覧

### 📋 システム構成
- **[current-architecture.md](./current-architecture.md)** - 現在のシステム構成とアーキテクチャ
- **[api-documentation.md](./api-documentation.md)** - API仕様とエンドポイント詳細
- **[schema.md](./schema.md)** - データベーススキーマ定義

### 🚀 デプロイメント
- **[deployment-status.md](./deployment-status.md)** - 現在のデプロイメント状況
- **[deployment-guide.md](./deployment-guide.md)** - デプロイメント手順
- **[vercel-setup-guide.md](./vercel-setup-guide.md)** - Vercel設定ガイド
- **[vercel-troubleshooting.md](./vercel-troubleshooting.md)** - Vercelトラブルシューティング

### 🔧 セットアップ
- **[supabase-setup-instructions.md](./supabase-setup-instructions.md)** - Supabase初期設定
- **[local-oauth-setup.md](./local-oauth-setup.md)** - ローカル開発でのOAuth設定
- **[github-secrets-setup.md](./github-secrets-setup.md)** - GitHub Secrets設定

### 🔒 セキュリティ
- **[security.md](./security.md)** - セキュリティ対策
- **[supabase-security-checklist.md](./supabase-security-checklist.md)** - Supabaseセキュリティチェックリスト
- **[deployment-security-checklist.md](./deployment-security-checklist.md)** - デプロイメントセキュリティ

### 🛠️ 開発・保守
- **[requirements.md](./requirements.md)** - システム要件
- **[design.md](./design.md)** - 設計思想
- **[tasks.md](./tasks.md)** - 開発タスク
- **[issues.md](./issues.md)** - 既知の問題
- **[troubleshooting.md](./troubleshooting.md)** - 一般的なトラブルシューティング

### 📝 実装ガイド
- **[fix-data-isolation-guide.md](./fix-data-isolation-guide.md)** - データ分離実装
- **[supabase-migration-guide.md](./supabase-migration-guide.md)** - Supabase移行ガイド
- **[nextjs-api-routes-fix.md](./nextjs-api-routes-fix.md)** - Next.js API Routes修正
- **[supabase-cors-fix.md](./supabase-cors-fix.md)** - CORS問題解決

### 📊 ステータス・完了報告
- **[current-implementation-status.md](./current-implementation-status.md)** - 実装状況
- **[fix-completion-summary.md](./fix-completion-summary.md)** - 修正完了サマリー
- **[github-actions-vercel-fix.md](./github-actions-vercel-fix.md)** - GitHub Actions修正記録

## クイックスタート

### 1. 開発環境セットアップ
```bash
# リポジトリクローン
git clone <repository-url>
cd vow

# フロントエンド依存関係インストール
cd frontend
npm install

# 環境変数設定
cp .env.example .env.local
# .env.localを編集

# 開発サーバー起動
npm run dev
```

### 2. 本番デプロイ
1. [deployment-guide.md](./deployment-guide.md) を参照
2. Vercel設定: [vercel-setup-guide.md](./vercel-setup-guide.md)
3. Supabase設定: [supabase-setup-instructions.md](./supabase-setup-instructions.md)

### 3. OAuth設定
1. Google OAuth: [local-oauth-setup.md](./local-oauth-setup.md)
2. GitHub OAuth: 同上
3. Supabase Auth設定: [supabase-setup-instructions.md](./supabase-setup-instructions.md)

## 現在の状況（2026年1月7日）

### ✅ 完了済み
- フロントエンド・バックエンド実装
- Vercelデプロイメント設定
- OAuth認証（Google, GitHub）
- ゲストユーザー対応
- データ永続化（Supabase + LocalStorage）
- セキュリティ対策（RLS, CORS等）

### 🔄 進行中
- ドキュメント整備
- パフォーマンス最適化
- 監視・ログ設定

### 📋 今後の予定
- モバイル対応
- チーム機能
- AI機能統合
- 国際化対応

## サポート・問い合わせ

### トラブルシューティング
1. [troubleshooting.md](./troubleshooting.md) を確認
2. 該当する専門ドキュメントを参照
3. GitHub Issuesで報告

### 開発者向け
- API仕様: [api-documentation.md](./api-documentation.md)
- アーキテクチャ: [current-architecture.md](./current-architecture.md)
- セキュリティ: [security.md](./security.md)

## 更新履歴

- **2026-01-07**: 初版作成、現状構成ドキュメント化
- **2026-01-07**: OAuth認証問題解決、デプロイメント安定化
- **2026-01-07**: ゲストユーザー機能実装完了