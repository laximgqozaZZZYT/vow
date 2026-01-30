# Requirements Document

## Introduction

本ドキュメントは、AWS Lambda環境でのSlack連携機能の接続安定性を改善するための要件を定義します。

現在、Lambda更新直後は正常に動作するものの、時間経過後に接続が切断され「Failed to fetch」エラーが発生する問題、およびSlackコマンド実行時にHabit/Activity情報が表示されない問題が報告されています。

根本原因は、Supabaseクライアントのシングルトンパターンがウォームスタート時に古い接続を再利用し、タイムアウトした接続でリクエストを処理しようとすることにあります。

## Glossary

- **Supabase_Client**: Supabaseデータベースへの接続を管理するPythonクライアントインスタンス
- **Lambda_Handler**: AWS Lambdaのエントリーポイントとなる関数
- **Connection_Pool**: HTTPクライアントが管理する接続のプール
- **Warm_Start**: Lambdaコンテナが再利用される起動パターン
- **Cold_Start**: 新しいLambdaコンテナが作成される起動パターン
- **Slack_Command_Handler**: Slackスラッシュコマンドを処理するルーター
- **Health_Check**: 接続の有効性を確認する検証処理
- **Retry_Logic**: 失敗した操作を再試行する処理ロジック
- **CloudWatch_Logger**: AWS CloudWatchにログを出力するロガー

## Requirements

### Requirement 1: Supabaseクライアント接続管理の改善

**User Story:** 開発者として、Lambda環境でSupabaseクライアントの接続が安定して動作することを望みます。これにより、ウォームスタート時でも確実にデータベース操作が成功します。

#### Acceptance Criteria

1. WHEN Lambda関数がウォームスタートで呼び出される THEN Supabase_Client SHALL 接続の有効性を検証してから使用する
2. WHEN Supabase_Clientの接続が無効または期限切れである THEN Supabase_Client SHALL 新しいクライアントインスタンスを作成する
3. WHEN 新しいSupabase_Clientインスタンスが作成される THEN Supabase_Client SHALL 古いインスタンスのリソースを適切に解放する
4. THE Supabase_Client SHALL リクエストごとに接続の健全性を確認する軽量なヘルスチェックを実行する

### Requirement 2: リトライ処理の実装

**User Story:** システム管理者として、一時的な接続エラーが発生しても自動的にリトライされることを望みます。これにより、ユーザーへの影響を最小限に抑えられます。

#### Acceptance Criteria

1. WHEN Supabaseへのリクエストが接続エラーで失敗する THEN Retry_Logic SHALL 指数バックオフで最大3回リトライする
2. WHEN リトライ間隔を計算する THEN Retry_Logic SHALL 100ms、200ms、400msの指数バックオフを適用する
3. WHEN 全てのリトライが失敗する THEN Retry_Logic SHALL 最終エラーを適切にログ出力して例外を発生させる
4. WHEN リトライ可能なエラーを判定する THEN Retry_Logic SHALL 接続タイムアウト、接続リセット、一時的なネットワークエラーをリトライ対象とする
5. WHEN リトライ不可能なエラーが発生する THEN Retry_Logic SHALL 即座にエラーを返却する

### Requirement 3: エラーハンドリングとユーザーフィードバックの改善

**User Story:** ユーザーとして、Slackコマンドが失敗した場合に何が起きたのか理解できるメッセージを受け取りたいです。これにより、適切な対処ができます。

#### Acceptance Criteria

1. WHEN データベース接続エラーが発生する THEN Slack_Command_Handler SHALL ユーザーに「一時的な接続エラーが発生しました。しばらくしてから再度お試しください。」と表示する
2. WHEN Habit/Activity情報の取得に失敗する THEN Slack_Command_Handler SHALL 「習慣がありません」ではなく「データの取得に失敗しました」と表示する
3. WHEN エラーが発生する THEN Slack_Command_Handler SHALL エラーの種類に応じた適切なSlackブロックメッセージを返却する
4. IF 接続エラーが発生する THEN Slack_Command_Handler SHALL エラー詳細をログに記録しつつユーザーには技術的詳細を隠す

### Requirement 4: CloudWatchログの診断機能強化

**User Story:** 開発者として、接続問題が発生した際に原因を特定できる詳細なログを確認したいです。これにより、問題の迅速な解決が可能になります。

#### Acceptance Criteria

1. WHEN Supabase_Clientが初期化される THEN CloudWatch_Logger SHALL クライアント作成のタイムスタンプとインスタンスIDをログ出力する
2. WHEN 接続エラーが発生する THEN CloudWatch_Logger SHALL エラータイプ、リトライ回数、経過時間を構造化ログで出力する
3. WHEN リトライが実行される THEN CloudWatch_Logger SHALL 各リトライの試行番号と待機時間をログ出力する
4. WHEN Slackコマンドが処理される THEN CloudWatch_Logger SHALL リクエストID、処理時間、結果ステータスを含む構造化ログを出力する
5. THE CloudWatch_Logger SHALL Lambda実行コンテキスト（リクエストID、残り実行時間）をログに含める

### Requirement 5: 接続プール管理の最適化

**User Story:** システム管理者として、Lambda環境に最適化された接続プール設定を望みます。これにより、リソースの効率的な利用と安定した接続が実現します。

#### Acceptance Criteria

1. THE Connection_Pool SHALL 接続タイムアウトを5秒に設定する
2. THE Connection_Pool SHALL 読み取りタイムアウトを10秒に設定する
3. THE Connection_Pool SHALL キープアライブを無効化してLambda環境に最適化する
4. WHEN Lambda関数が終了する THEN Connection_Pool SHALL 未使用の接続を適切にクローズする
5. THE Connection_Pool SHALL 最大接続数を10に制限してリソース枯渇を防ぐ

### Requirement 6: ヘルスチェックエンドポイントの実装

**User Story:** 運用担当者として、Supabase接続の状態を確認できるヘルスチェックエンドポイントを望みます。これにより、問題の早期発見が可能になります。

#### Acceptance Criteria

1. WHEN ヘルスチェックエンドポイントが呼び出される THEN Health_Check SHALL Supabaseへの接続テストを実行する
2. WHEN 接続テストが成功する THEN Health_Check SHALL ステータス「healthy」とレイテンシを返却する
3. WHEN 接続テストが失敗する THEN Health_Check SHALL ステータス「unhealthy」とエラー詳細を返却する
4. THE Health_Check SHALL 接続テストのタイムアウトを3秒に設定する
