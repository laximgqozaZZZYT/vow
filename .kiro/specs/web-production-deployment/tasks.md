# Implementation Plan: WEB Production Deployment (Vercel + GitHub Actions CI/CD)

## Overview

既存のSupabase統合環境をVercel + Supabase構成に移行し、GitHub ActionsによるCI/CDパイプラインでデプロイメントを自動化する実装アプローチ。現在のSupabase静的ホスティング設定をVercelフロントエンドホスティングに変更し、バックエンドはSupabaseを継続使用する。

## 現在の実装状況

### ✅ 完了済み
- Supabaseプロジェクトセットアップ（プロジェクトID: jamiyzsyclvlvstmeeir）
- データベーススキーマとRLSポリシー設定
- OAuth認証設定（Google/GitHub）
- Next.js設定のVercel最適化（環境対応の設定切り替え）
- 開発環境用環境変数設定
- GitHub Actions CI/CDパイプライン（Supabase静的ホスティング用）
- セキュリティテスト実装

### ❌ GitHub Actions CI/CD + Vercel対応で必要な作業
- Vercelプロジェクトセットアップ
- GitHub ActionsワークフローのVercel対応更新
- Vercel環境変数設定（GitHub Secrets経由）
- CI/CDパイプラインでのVercelデプロイメント自動化

## Tasks

- [x] 1. Next.js設定のVercel最適化
  - next.config.tsをVercel用に変更する（環境対応の設定切り替え）
  - 画像最適化をVercel用に有効化する
  - セキュリティヘッダー設定を維持・強化する
  - 環境変数設定を整理する
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 1.1 Write unit tests for Next.js configuration
  - Vercel最適化設定の検証テスト
  - 環境変数の設定確認テスト
  - _Requirements: 5.4, 6.1, 6.2_

- [x] 2. Vercelプロジェクトセットアップ
  - VercelでGitHubリポジトリをインポートする
  - プロジェクト設定を行う（フレームワーク: Next.js）
  - ビルド設定を最適化する
  - 自動デプロイメントを一時的に無効化する（GitHub Actions制御のため）
  - _Requirements: 4.1, 4.6_

- [x] 3. GitHub Secrets設定
  - VercelのAccess TokenをGitHub Secretsに追加する
  - Vercel Project IDをGitHub Secretsに追加する
  - Vercel Org IDをGitHub Secretsに追加する
  - 既存のSupabase環境変数を確認・更新する
  - _Requirements: 4.2, 6.2, 6.3, 6.4_

- [x] 4. GitHub ActionsワークフローのVercel対応
  - 既存のワークフローをVercel対応に更新する
  - Vercel CLIを使用したデプロイメント設定を追加する
  - 環境変数の設定を更新する
  - テストジョブとデプロイジョブの分離を維持する
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ]* 4.1 Write unit tests for CI/CD pipeline
  - Vercelデプロイメント設定の検証テスト
  - デプロイメント成功・失敗シナリオのテスト
  - _Requirements: 8.2, 8.4_

- [ ] 5. デュアルデプロイメント設定（オプション）
  - Vercel本番環境とSupabase静的ホスティングの両方をサポート
  - 環境変数でデプロイ先を切り替え可能にする
  - ブランチベースのデプロイメント戦略を設定する
  - _Requirements: 1.4, 8.5_

- [ ]* 5.1 Write property test for secure communication
  - **Property 1: Secure Communication**
  - **Validates: Requirements 1.3, 7.3**

- [ ] 6. Checkpoint - GitHub Actions CI/CDデプロイメント確認
  - GitHub ActionsでのVercelデプロイメントが成功することを確認し、ユーザーに質問があれば聞く

- [ ] 7. カスタムドメイン設定（オプション）
  - Vercelでカスタムドメインを設定する
  - DNS設定を行う
  - SSL証明書の自動発行を確認する
  - リダイレクト設定を行う
  - _Requirements: 4.5_

- [ ] 8. 既存セキュリティ設定の検証
  - HTTPS通信の確認
  - セキュリティヘッダーの動作確認
  - RLSポリシーの動作確認
  - OAuth認証の動作確認
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 8.1 Write security validation tests
  - Vercel環境でのセキュリティテスト
  - データ分離テスト
  - **Property 2: Data Isolation by User**
  - **Property 5: Row Level Security Enforcement**
  - **Validates: Requirements 2.3, 7.1, 7.2**

- [ ] 9. 動作確認とテスト
  - Vercel環境での基本機能テスト
  - OAuth認証フローテスト
  - データCRUD操作テスト
  - パフォーマンステスト
  - GitHub Actions CI/CDパイプラインの動作確認
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]* 9.1 Write integration tests
  - E2E認証フローテスト（Vercel環境）
  - データCRUD操作テスト（Vercel + Supabase）
  - CI/CDパイプライン統合テスト
  - _Requirements: 9.1, 9.2_

- [ ] 10. ドキュメント更新
  - Vercel + Supabase + GitHub Actions構成のデプロイメント手順を作成する
  - 既存のSupabase静的ホスティング手順との比較を作成する
  - CI/CDパイプラインのトラブルシューティングガイドを更新する
  - コスト・時間見積もりを更新する
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 11. 最終チェックポイント - Vercel + GitHub Actions CI/CD本番公開完了
  - すべてのテストが通ることを確認し、Vercel + GitHub Actions CI/CDによる本番公開の完了をユーザーに報告する

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- セキュリティテストは本番環境での安全性確保のため重要
- GitHub Actions CI/CDパイプラインにより継続的なデプロイメントを実現
- Vercel CLIを使用してGitHub ActionsからVercelへのデプロイメントを制御