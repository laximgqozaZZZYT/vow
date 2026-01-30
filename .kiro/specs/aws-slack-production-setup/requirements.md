# 要件定義書

## はじめに

本ドキュメントは、VOWアプリのAWS本番環境セットアップとSlack連携修正を統合した要件を定義します。現在、開発環境（AWS Amplify + Lambda + Aurora）は構築済みですが、Slack OAuth連携が500エラーで失敗しており、本番環境も未構築の状態です。

### 現在の環境構成

**開発環境（AWS）:**
- フロントエンド: `main.do1k9oyyorn24.amplifyapp.com`（Amplify）
- バックエンドAPI: `lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development`（Lambda + API Gateway）
- データベース: Aurora Serverless v2（`vow-development-aurora`）
- 認証: Cognito（`ap-northeast-1_69kS6Me8O`）

**本番環境（Vercel + Supabase）:**
- フロントエンド: `vow-sigma.vercel.app`（Amplifyにリダイレクト中）
- データベース・認証: Supabase

### 主な問題点

1. **Slack OAuth 500エラー**: Lambda環境変数の不足（`SUPABASE_URL`、`SUPABASE_ANON_KEY`）
2. **SLACK_CALLBACK_URI設定ミス**: `/api/slack/oauth/callback`が設定されているが、実際のルートは`/api/slack/callback`
3. **認証ミドルウェアのパス問題**: API Gatewayのステージプレフィックス（`/development`）が考慮されていない
4. **本番環境未構築**: AWS本番環境のTerraformワークスペースが未作成

### 目標

1. Slack OAuth連携を修正し、ユーザーがSlackを接続できるようにする
2. AWS本番環境を構築し、公開リリースに備える
3. Slack連携機能（習慣の表示・編集・追加）を完全に動作させる

## 用語集

- **Lambda_Function**: AWS Lambda上で動作するFastAPIバックエンド
- **API_Gateway**: AWS API Gatewayエンドポイント（ステージプレフィックス付き）
- **Amplify_Frontend**: AWS Amplifyでホストされるフロントエンド
- **Aurora_Serverless_v2**: AWSのサーバレスPostgreSQL互換データベース
- **Cognito**: AWSの認証・認可サービス
- **Slack_OAuth_Handler**: Slack OAuth 2.0フローを管理するバックエンドコンポーネント
- **Terraform_Workspace**: 環境ごとに分離されたTerraform状態管理
- **Stage_Prefix**: API Gatewayのステージ名（`/development`、`/production`）
- **Supabase_Client**: Slack接続情報を保存するためのSupabaseクライアント

## 要件

### 要件 1: Lambda環境変数の修正

**ユーザーストーリー:** 開発者として、Lambda関数に必要な環境変数を正しく設定したい。これにより、Slack OAuth連携が正常に動作する。

#### 受け入れ基準

1. THE Lambda_Function SHALL have `SUPABASE_URL` environment variable set to the Supabase project URL
2. THE Lambda_Function SHALL have `SUPABASE_ANON_KEY` environment variable set to the Supabase anonymous key
3. THE Lambda_Function SHALL have `SLACK_CALLBACK_URI` set to `https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/slack/callback`
4. THE Lambda_Function SHALL have `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` environment variables set
5. THE Lambda_Function SHALL have `TOKEN_ENCRYPTION_KEY` environment variable set for token encryption
6. WHEN any required environment variable is missing, THE Lambda_Function SHALL log a clear error message at startup
7. THE Terraform configuration (`lambda.tf`) SHALL be updated to include all Slack and Supabase environment variables

### 要件 2: 認証ミドルウェアのパス修正

**ユーザーストーリー:** 開発者として、認証ミドルウェアがAPI Gatewayのステージプレフィックスを正しく処理するようにしたい。これにより、Slack OAuthコールバックが認証をバイパスできる。

#### 受け入れ基準

1. WHEN a request path includes the API Gateway stage prefix (e.g., `/development/api/slack/callback`), THE JWTAuthMiddleware SHALL correctly match excluded paths
2. THE JWTAuthMiddleware SHALL strip the stage prefix before matching excluded paths
3. THE JWTAuthMiddleware SHALL support both prefixed and non-prefixed paths for local development
4. WHEN the path `/development/api/slack/callback` is requested, THE JWTAuthMiddleware SHALL exclude it from authentication
5. THE excluded paths list SHALL include: `/api/slack/callback`, `/api/slack/commands`, `/api/slack/interactions`, `/api/slack/events`, `/api/slack/connect`

### 要件 3: Slack OAuthフローの修正

**ユーザーストーリー:** ユーザーとして、「Connect Slack」ボタンをクリックした時にエラーなくSlack認証ページにリダイレクトされたい。これにより、Slack連携を開始できる。

#### 受け入れ基準

1. WHEN a user clicks "Connect Slack", THE Slack_OAuth_Handler SHALL redirect to Slack OAuth page without 500 error
2. WHEN Slack authorization is successful, THE Slack_OAuth_Handler SHALL exchange the code for tokens
3. WHEN tokens are received, THE Slack_OAuth_Handler SHALL store the connection in Supabase database
4. WHEN OAuth callback is received, THE Slack_OAuth_Handler SHALL redirect user to frontend settings page with success parameter
5. IF OAuth fails, THEN THE Slack_OAuth_Handler SHALL redirect user to frontend settings page with error parameter
6. THE Slack_OAuth_Handler SHALL use the correct callback URI: `https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/slack/callback`

### 要件 4: Terraform本番ワークスペースの作成

**ユーザーストーリー:** 運用者として、本番環境用のTerraformワークスペースを作成したい。これにより、開発環境と分離された本番インフラを管理できる。

#### 受け入れ基準

1. THE Terraform configuration SHALL support a `production` workspace separate from `development`
2. THE production workspace SHALL use a separate state file from development
3. THE production environment SHALL use `terraform.production.tfvars` for configuration
4. THE production Aurora_Serverless_v2 SHALL have `deletion_protection = true`
5. THE production Aurora_Serverless_v2 SHALL have `skip_final_snapshot = false`
6. THE production Lambda_Function SHALL have all required environment variables including Slack and Supabase settings
7. THE production API_Gateway SHALL use `/production` as the stage prefix

### 要件 5: 本番Lambda環境変数の設定

**ユーザーストーリー:** 運用者として、本番Lambda関数に必要な環境変数を設定したい。これにより、本番環境でSlack連携が動作する。

#### 受け入れ基準

1. THE production Lambda_Function SHALL have `ENV = production` environment variable
2. THE production Lambda_Function SHALL have `SLACK_CALLBACK_URI` set to the production API Gateway URL
3. THE production Lambda_Function SHALL have `CORS_ORIGINS` including the production Amplify domain
4. THE production Lambda_Function SHALL have `SUPABASE_URL` and `SUPABASE_ANON_KEY` for Slack connection storage
5. THE production Lambda_Function SHALL have all Cognito-related environment variables
6. THE Terraform `lambda.tf` SHALL be parameterized to support both development and production configurations

### 要件 6: 本番Amplifyアプリの設定

**ユーザーストーリー:** 運用者として、本番Amplifyアプリを正しく設定したい。これにより、本番フロントエンドが正しいバックエンドAPIに接続できる。

#### 受け入れ基準

1. THE production Amplify_Frontend SHALL have `NEXT_PUBLIC_API_URL` pointing to production API Gateway
2. THE production Amplify_Frontend SHALL have `NEXT_PUBLIC_SLACK_API_URL` pointing to production API Gateway
3. THE production Amplify_Frontend SHALL have Cognito configuration environment variables
4. THE production Amplify_Frontend SHALL connect to the `main` branch for deployments
5. WHEN deployment fails, THE Amplify_Frontend SHALL automatically rollback to previous version

### 要件 7: Slackコマンドの動作確認

**ユーザーストーリー:** ユーザーとして、Slackコマンドで習慣情報を確認したい。これにより、アプリを開かずに習慣を管理できる。

#### 受け入れ基準

1. WHEN a user types `/habit-status`, THE Slack_Bot SHALL respond with today's habit completion summary
2. WHEN a user types `/habit-list`, THE Slack_Bot SHALL respond with all active habits and streaks
3. WHEN a user types `/habit-done [habit-name]`, THE Slack_Bot SHALL mark the habit as completed
4. THE Slack_Bot SHALL respond within 3 seconds to meet Slack's timeout requirements
5. IF the Slack connection is invalid, THEN THE Slack_Bot SHALL return an appropriate error message

### 要件 8: Slackインタラクションの動作確認

**ユーザーストーリー:** ユーザーとして、Slackのボタンやメニューで習慣を操作したい。これにより、直感的に習慣を管理できる。

#### 受け入れ基準

1. WHEN a user clicks a habit completion button, THE Habit_Completion_Reporter SHALL mark the habit as completed
2. WHEN a habit is completed via Slack, THE system SHALL update the database and respond with confirmation
3. WHEN displaying interactive messages, THE Slack_Bot SHALL use Block_Kit for rich formatting
4. THE Slack_Webhook_Handler SHALL verify request signatures using the signing secret
5. IF signature verification fails, THEN THE Slack_Webhook_Handler SHALL return 401 Unauthorized

### 要件 9: 週次レポートの動作確認

**ユーザーストーリー:** ユーザーとして、週次サマリーレポートをSlackで受け取りたい。これにより、アプリを開かずに進捗を確認できる。

#### 受け入れ基準

1. WHEN the weekly report schedule time arrives, THE Weekly_Report_Generator SHALL send a summary to connected Slack users
2. THE weekly report SHALL include: total habits completed, completion rate, best streak, and habits needing attention
3. THE weekly report SHALL use Block_Kit for visually appealing formatting
4. IF weekly_slack_report_enabled is false, THEN THE Weekly_Report_Generator SHALL not send the report
5. THE user SHALL be able to configure the report day and time in preferences

### 要件 10: エラーハンドリングとログ

**ユーザーストーリー:** 運用者として、Slack連携のエラーを適切にログに記録したい。これにより、問題を迅速に特定・解決できる。

#### 受け入れ基準

1. WHEN Slack API returns an error, THE Slack_Integration_Service SHALL log the error with context
2. WHEN OAuth fails, THE Slack_OAuth_Handler SHALL log the failure reason and user context
3. WHEN environment variables are missing, THE Lambda_Function SHALL log which variables are missing
4. THE CloudWatch Logs SHALL retain logs for 30 days
5. THE error logs SHALL include request ID, user ID (if available), and timestamp

### 要件 11: CORS設定の確認

**ユーザーストーリー:** 開発者として、CORS設定が正しく構成されていることを確認したい。これにより、フロントエンドからバックエンドへのリクエストが正常に動作する。

#### 受け入れ基準

1. THE Lambda_Function SHALL allow CORS requests from `https://main.do1k9oyyorn24.amplifyapp.com`
2. THE Lambda_Function SHALL allow CORS requests from the production Amplify domain
3. THE Lambda_Function SHALL allow CORS requests from `http://localhost:3000` for local development
4. THE CORS configuration SHALL allow credentials (`credentials: 'include'`)
5. THE CORS configuration SHALL allow necessary headers including `Authorization`

### 要件 12: 接続テスト機能

**ユーザーストーリー:** ユーザーとして、Slack接続が正常に動作しているかテストしたい。これにより、連携が正しく設定されていることを確認できる。

#### 受け入れ基準

1. WHEN a user clicks "Test Connection", THE Slack_Integration_Service SHALL send a test message to the user's Slack DM
2. WHEN the test message is sent successfully, THE Settings_Page SHALL display a success message
3. IF the test message fails, THEN THE Settings_Page SHALL display an error message with details
4. THE test message SHALL include a confirmation that the integration is working
5. THE test endpoint SHALL verify the stored tokens are still valid

