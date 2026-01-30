# Implementation Plan: Backend Containerization

## Overview

FastAPIバックエンドをDockerコンテナ化し、AWS App Runnerにデプロイするための実装計画です。Amazon RDS PostgreSQLを構築し、Supabaseからの段階的な移行を準備します。また、Slack/OpenAI連携の基盤を整備します。

## Tasks

- [x] 1. FastAPIバックエンドの基盤構築
  - [x] 1.1 バックエンドプロジェクト構造の作成
    - `backend/` ディレクトリとサブディレクトリ（app, tests, migrations, scripts）を作成
    - `requirements.txt` と `requirements-dev.txt` を作成
    - Python 3.12, FastAPI, SQLAlchemy, Pydantic, uvicorn, alembic を依存関係に追加
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 FastAPIアプリケーションのエントリーポイント作成
    - `backend/app/main.py` を作成
    - FastAPIアプリインスタンスの初期化
    - CORSミドルウェアの設定
    - ライフスパンイベント（startup/shutdown）の実装
    - _Requirements: 1.1, 8.2_

  - [x] 1.3 設定管理モジュールの実装
    - `backend/app/config.py` を作成
    - Pydantic Settingsを使用した環境変数管理
    - データベース、JWT、CORS、外部サービスの設定項目を定義
    - 起動時の必須環境変数バリデーション
    - _Requirements: 13.1, 13.6_

  - [x] 1.4 ヘルスチェックエンドポイントの実装
    - `backend/app/routers/health.py` を作成
    - `/health` エンドポイントでステータス200とJSON応答を返す
    - サービスバージョンとステータス情報を含める
    - _Requirements: 1.4, 1.5_

  - [ ]* 1.5 ヘルスチェックのユニットテスト作成
    - `backend/tests/test_health.py` を作成
    - ステータスコード200の検証
    - レスポンスJSONフォーマットの検証
    - _Requirements: 1.4, 1.5_

- [x] 2. JWT認証ミドルウェアの実装
  - [x] 2.1 JWT認証ミドルウェアの作成
    - `backend/app/middleware/auth.py` を作成
    - Authorization headerからトークン抽出
    - JWTトークンの検証（署名、有効期限）
    - ユーザー情報のリクエストコンテキストへの付与
    - 除外パス（/health, /docs）の設定
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Supabase JWT形式のサポート
    - Supabase JWTのaudience、issuer設定
    - カスタムJWT issuerの設定可能化
    - _Requirements: 2.5, 2.6_

  - [ ]* 2.3 JWT認証のプロパティテスト作成
    - **Property 1: JWT Token Validation**
    - **Validates: Requirements 2.1, 2.3**
    - hypothesisを使用した有効/無効トークンのテスト

  - [ ]* 2.4 JWT User Extractionのプロパティテスト作成
    - **Property 2: JWT User Extraction Round-Trip**
    - **Validates: Requirements 2.2**
    - ユーザークレームのラウンドトリップ検証

- [ ] 3. Checkpoint - 基盤テスト
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Dockerコンテナ化
  - [x] 4.1 Dockerfileの作成
    - `backend/Dockerfile` を作成
    - Python 3.12-slimベースイメージ
    - マルチステージビルド（builder, runner）
    - 非rootユーザーでの実行
    - ポート8000の公開
    - ヘルスチェック設定
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.2 docker-compose.ymlの作成
    - ルートディレクトリに `docker-compose.yml` を作成
    - バックエンドサービス（ホットリロード対応）
    - PostgreSQLサービス（ローカル開発用）
    - ボリュームマウントとヘルスチェック
    - _Requirements: 3.6, 14.1, 14.2, 14.3_

  - [x] 4.3 ローカルPostgreSQL初期化スクリプト
    - `backend/scripts/init.sql` を作成
    - テスト用データベーススキーマ
    - シードデータの投入
    - _Requirements: 14.5_

  - [ ]* 4.4 コンテナビルドとサイズ検証
    - Dockerイメージのビルド
    - イメージサイズが500MB以下であることを確認
    - _Requirements: 3.7_

- [ ] 5. データベースモデルとスキーマ
  - [ ] 5.1 SQLAlchemyベースモデルの作成
    - `backend/app/models/base.py` を作成
    - 共通のBaseクラス定義
    - データベースセッション管理

  - [ ] 5.2 Habitモデルの実装
    - `backend/app/models/habit.py` を作成
    - Habit, HabitLogテーブル定義
    - リレーションシップの設定
    - _Requirements: 1.2_

  - [ ] 5.3 Pydanticスキーマの実装
    - `backend/app/schemas/habit.py` を作成
    - HabitCreate, HabitUpdate, HabitResponseスキーマ
    - バリデーションルールの設定
    - _Requirements: 1.3_

  - [ ] 5.4 Alembicマイグレーション設定
    - `backend/alembic.ini` と `migrations/` ディレクトリを作成
    - 初期マイグレーションの生成
    - _Requirements: 1.2_

- [ ] 6. APIエンドポイントの実装
  - [ ] 6.1 Habitルーターの実装
    - `backend/app/routers/habits.py` を作成
    - CRUD操作（GET, POST, PUT, DELETE）
    - ユーザーIDによるフィルタリング
    - _Requirements: 1.6, 8.5_

  - [ ] 6.2 サービス層の実装
    - `backend/app/services/habit_service.py` を作成
    - ビジネスロジックの分離
    - _Requirements: 1.6_

  - [ ] 6.3 リポジトリ層の実装
    - `backend/app/repositories/habit_repository.py` を作成
    - データアクセスロジックの分離
    - _Requirements: 1.6_

  - [ ]* 6.4 CORSプロパティテスト作成
    - **Property 5: CORS Header Presence**
    - **Validates: Requirements 8.2**
    - 許可されたオリジンからのリクエストでCORSヘッダーを検証

  - [ ]* 6.5 APIレスポンス互換性プロパティテスト作成
    - **Property 6: API Response Schema Compatibility**
    - **Validates: Requirements 8.5**
    - レスポンスJSONがフロントエンドスキーマに準拠することを検証

- [ ] 7. Checkpoint - API機能テスト
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. AWS CDKインフラストラクチャ
  - [x] 8.1 CDKプロジェクト構造の更新
    - `infra/stacks/` ディレクトリを作成
    - `infra/requirements.txt` に必要なCDKパッケージを追加
    - _Requirements: 11.1, 11.5_

  - [x] 8.2 データベーススタックの実装
    - `infra/stacks/database_stack.py` を作成
    - VPC（Public/Private/Isolated サブネット）
    - RDS PostgreSQL（db.t3.micro）
    - セキュリティグループ
    - Secrets Manager（DB認証情報）
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 11.2, 11.4_

  - [x] 8.3 バックエンドスタックの実装
    - `infra/stacks/backend_stack.py` を作成
    - ECRリポジトリ
    - App Runnerサービス
    - VPCコネクター
    - SSM Parameter Store参照
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 11.2, 11.4_

  - [x] 8.4 CDKアプリエントリーポイントの更新
    - `infra/app.py` を更新
    - DatabaseStackとBackendStackの統合
    - スタック間の依存関係設定
    - _Requirements: 11.6_

- [ ] 9. 外部サービス連携基盤
  - [ ] 9.1 Slack通知サービスの実装
    - `backend/app/services/slack_service.py` を作成
    - Webhook URLによる通知送信
    - エラー時のログ記録（メイン処理継続）
    - 有効/無効の設定切り替え
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 9.2 OpenAIサービスの実装
    - `backend/app/services/openai_service.py` を作成
    - API呼び出しとエラーハンドリング
    - レート制限の実装
    - モデル選択の設定
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 9.3 外部サービスのユニットテスト作成
    - Slack通知失敗時の動作テスト
    - OpenAIレート制限テスト
    - _Requirements: 9.4, 10.4, 10.6_

- [ ] 10. データベース移行準備
  - [ ] 10.1 デュアルデータベース設定の実装
    - `backend/app/config.py` に移行モード設定を追加
    - Supabase接続設定
    - RDS接続設定
    - _Requirements: 7.4_

  - [ ] 10.2 デュアルライト機能の実装
    - 移行モード時の両データベースへの書き込み
    - トランザクション管理
    - _Requirements: 7.5_

  - [ ] 10.3 移行スクリプトの作成
    - `backend/scripts/migrate_from_supabase.py` を作成
    - データエクスポート機能
    - データインポート機能
    - ロールバック機能
    - _Requirements: 7.1, 7.2, 7.6_

  - [ ]* 10.4 データ移行整合性プロパティテスト作成
    - **Property 3: Data Migration Integrity**
    - **Validates: Requirements 7.3**
    - 移行前後のデータ整合性検証

  - [ ]* 10.5 デュアルライトプロパティテスト作成
    - **Property 4: Dual Database Write Consistency**
    - **Validates: Requirements 7.5**
    - 両データベースへの書き込み一貫性検証

- [ ] 11. Checkpoint - 移行機能テスト
  - Ensure all tests pass, ask the user if questions arise.

- [-] 12. CI/CDパイプライン
  - [x] 12.1 GitHub Actions ワークフローの作成
    - `.github/workflows/deploy-backend.yml` を作成
    - テスト実行ジョブ
    - Dockerビルド・プッシュジョブ
    - App Runnerデプロイトリガー
    - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6_

  - [ ] 12.2 OIDC認証の設定
    - AWS IAMロールの設定（CDKで定義）
    - GitHub ActionsのOIDC設定
    - _Requirements: 12.4_

- [ ] 13. フロントエンド連携
  - [ ] 13.1 API呼び出しユーティリティの作成
    - `frontend/lib/api.ts` を作成
    - FastAPI Backend呼び出し関数
    - 環境変数によるURL切り替え
    - _Requirements: 8.1, 8.3_

  - [ ] 13.2 フォールバック機能の実装
    - FastAPI Backend不可時のSupabaseフォールバック
    - エラーハンドリング
    - _Requirements: 8.4_

  - [ ] 13.3 環境変数の更新
    - `frontend/.env.example` に `NEXT_PUBLIC_API_URL` を追加
    - _Requirements: 8.1_

- [x] 14. ドキュメント作成
  - [x] 14.1 バックエンドセットアップガイドの作成
    - `docs/BACKEND_SETUP.md` を作成
    - FastAPIバックエンドのセットアップ手順
    - Docker開発ワークフロー
    - AWS CDKデプロイ手順
    - データベース移行ガイド
    - APIエンドポイントリファレンス
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [x] 14.2 環境変数ドキュメントの更新
    - `backend/.env.example` を作成
    - 必要な環境変数の説明
    - _Requirements: 13.5_

- [ ] 15. Final Checkpoint - 全体テスト
  - Ensure all tests pass, ask the user if questions arise.
  - ローカル環境での動作確認
  - CDK synthの成功確認

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 実装言語: Python 3.12 (FastAPI), TypeScript (Frontend)
- インフラ: AWS CDK (Python)
