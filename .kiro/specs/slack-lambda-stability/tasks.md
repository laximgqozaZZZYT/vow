# Implementation Plan: Slack Lambda Connection Stability Fix

## Overview

Lambda環境でのSupabase接続安定性を改善するための実装計画です。接続ファクトリパターン、リトライロジック、構造化ログ、エラーハンドリングを段階的に実装します。

## Tasks

- [x] 1. 接続ファクトリとヘルスチェックの実装
  - [x] 1.1 SupabaseConnectionFactoryクラスを作成
    - `backend/app/services/supabase_connection_factory.py` を新規作成
    - 接続の作成、検証、再作成ロジックを実装
    - インスタンスID生成とタイムスタンプ管理を実装
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 1.2 接続ファクトリのプロパティテストを作成
    - **Property 1: Connection Validation Before Use**
    - **Property 2: Invalid Connection Triggers Recreation**
    - **Property 3: Resource Cleanup on Recreation**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
  - [x] 1.3 config.pyのget_supabase_client関数を更新
    - シングルトンパターンからConnectionFactory使用に変更
    - タイムアウト設定（接続5秒、読み取り10秒）を適用
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 2. リトライロジックの実装
  - [x] 2.1 RetryConfigとwith_retryデコレータを作成
    - `backend/app/utils/retry.py` を新規作成
    - 指数バックオフ（100ms, 200ms, 400ms）を実装
    - リトライ可能エラーの分類ロジックを実装
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
  - [ ]* 2.2 リトライロジックのプロパティテストを作成
    - **Property 4: Exponential Backoff Retry Behavior**
    - **Property 5: Final Retry Failure Handling**
    - **Property 6: Error Classification Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
  - [x] 2.3 HabitCompletionReporterにリトライデコレータを適用
    - データベースクエリメソッドにデコレータを追加
    - _Requirements: 2.1, 2.3_

- [x] 3. Checkpoint - 接続管理とリトライのテスト
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 構造化ログの実装
  - [x] 4.1 StructuredLoggerクラスを作成
    - `backend/app/utils/structured_logger.py` を新規作成
    - JSON形式の構造化ログ出力を実装
    - Lambdaコンテキスト（リクエストID、残り時間）の取得を実装
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 4.2 構造化ログのプロパティテストを作成
    - **Property 9: Structured Log Content**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
  - [x] 4.3 既存のロガーをStructuredLoggerに置き換え
    - slack_webhook.pyのログ出力を更新
    - connection_factoryのログ出力を更新
    - _Requirements: 4.4_

- [x] 5. エラーハンドリングの改善
  - [x] 5.1 SlackErrorHandlerクラスを作成
    - `backend/app/services/slack_error_handler.py` を新規作成
    - エラータイプの分類ロジックを実装
    - ユーザーフレンドリーメッセージのマッピングを実装
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 5.2 エラーハンドリングのプロパティテストを作成
    - **Property 7: User-Friendly Error Messages**
    - **Property 8: Error Detail Separation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  - [x] 5.3 slack_webhook.pyにエラーハンドリングを統合
    - try-exceptブロックでSlackErrorHandlerを使用
    - 接続エラー時の適切なレスポンス返却を実装
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 6. Checkpoint - ログとエラーハンドリングのテスト
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. ヘルスチェックエンドポイントの実装
  - [x] 7.1 ヘルスチェックルーターを作成
    - `backend/app/routers/health.py` を新規作成または更新
    - `/health/supabase` エンドポイントを実装
    - タイムアウト3秒の接続テストを実装
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 7.2 ヘルスチェックのプロパティテストを作成
    - **Property 11: Health Check Response Correctness**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [x] 7.3 main.pyにヘルスチェックルーターを登録
    - _Requirements: 6.1_

- [x] 8. Lambda終了時のクリーンアップ
  - [x] 8.1 接続クリーンアップ処理を実装
    - lambda_handler.pyに終了時フックを追加
    - ConnectionFactoryのクリーンアップメソッドを呼び出し
    - _Requirements: 5.4_
  - [ ]* 8.2 クリーンアップのプロパティテストを作成
    - **Property 10: Connection Cleanup on Termination**
    - **Validates: Requirements 5.4**

- [x] 9. Final Checkpoint - 全体統合テスト
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- タスクに `*` マークがあるものはオプションで、MVPでは省略可能
- 各プロパティテストはHypothesisライブラリを使用
- 最小100回の実行でプロパティを検証
- 既存のslack_webhook.pyとconfig.pyを段階的に更新
