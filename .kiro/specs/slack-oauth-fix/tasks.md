# 実装計画: Slack OAuth連携修正

## 概要

VOWアプリのSlack OAuth連携で発生しているInternal Server Error（500エラー）を解消し、フロントエンド（AWS Amplify）とバックエンド（AWS Lambda + API Gateway）間のSlack OAuth認証フローを正しく動作させます。

## タスク

- [x] 0. 現状の設定・構成確認
  - [x] 0.1 Lambda環境変数の確認
    - AWS Lambdaコンソールで `vow-development-api` 関数の環境変数を確認
    - 必須: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, TOKEN_ENCRYPTION_KEY
    - 必須: SUPABASE_URL, SUPABASE_ANON_KEY
    - 必須: SLACK_CALLBACK_URI, CORS_ORIGINS
  - [x] 0.2 Amplify環境変数の確認
    - AWS Amplifyコンソールで環境変数を確認
    - 必須: NEXT_PUBLIC_SLACK_API_URL
  - [x] 0.3 Slack App設定の確認
    - Slack API Dashboard (https://api.slack.com/apps) で設定を確認
    - OAuth Redirect URL: `https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/slack/callback`
    - Bot Token Scopes: chat:write, commands, users:read, im:write
  - [x] 0.4 API Gatewayエンドポイントの動作確認
    - ヘルスチェック: `curl https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/health`
    - Slack connect: `curl -I https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/slack/connect`
  - [x] 0.5 フロントエンドコードの確認
    - `frontend/hooks/useSlackIntegration.ts` の SLACK_API_URL 変数
    - `frontend/app/settings/page.tsx` の Connect Slack ボタン動作

- [ ] 1. バックエンド環境変数検証の追加
  - [ ] 1.1 config.pyにSlack関連環境変数の検証メソッドを追加
    - `validate_slack_settings()` メソッドを実装
    - 必須環境変数: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, TOKEN_ENCRYPTION_KEY
    - _Requirements: 1.2, 6.1_
  - [ ] 1.2 main.pyで起動時に環境変数を検証
    - 環境変数が不足している場合は明確なエラーログを出力
    - _Requirements: 1.3, 6.5_
  - [ ]* 1.3 環境変数検証のプロパティテストを作成
    - **Property 2: 環境変数検証の完全性**
    - **Validates: Requirements 1.2, 1.3, 6.1, 6.5**

- [x] 2. CORS設定の修正
  - [x] 2.1 main.pyのCORS設定にAmplifyドメインを追加
    - `https://main.do1k9oyyorn24.amplifyapp.com` を許可オリジンに追加
    - _Requirements: 3.1, 3.2, 6.3_
  - [x] 2.2 config.pyのデフォルトCORS設定を更新
    - 本番環境用のデフォルト値を設定
    - _Requirements: 3.3, 3.4_

- [x] 3. 認証トークン処理の修正
  - [x] 3.1 slack_oauth.pyのconnectエンドポイントを修正
    - クエリパラメータからトークンを受け取る機能を追加
    - トークン検証とユーザーID抽出を実装
    - _Requirements: 4.2, 4.3_
  - [x] 3.2 エラーハンドリングを改善
    - 500エラーではなく適切なHTTPステータスコードを返す
    - エラーログを追加
    - _Requirements: 1.1, 1.5_
  - [ ]* 3.3 JWT検証のプロパティテストを作成
    - **Property 1: JWT検証の正確性**
    - **Validates: Requirements 1.4, 1.5, 4.2, 4.3**

- [ ] 4. OAuth State管理の改善
  - [ ] 4.1 OAuth state生成ロジックを改善
    - 一意性を保証するstate生成
    - ユーザーIDとの関連付けを確実に
    - _Requirements: 4.4_
  - [ ]* 4.2 OAuth State生成のプロパティテストを作成
    - **Property 3: OAuth State生成の一意性**
    - **Validates: Requirements 4.4**

- [x] 5. OAuthコールバック処理の修正
  - [x] 5.1 callbackエンドポイントのリダイレクトURLを修正
    - フロントエンドURL（Amplify）へのリダイレクトを設定
    - 成功時: `?slack_connected=true`
    - 失敗時: `?error=xxx&message=xxx`
    - _Requirements: 5.3, 5.4_
  - [x] 5.2 SLACK_CALLBACK_URI環境変数の使用を確認
    - API Gateway URLを正しく設定
    - _Requirements: 5.5, 6.2_

- [ ] 6. チェックポイント - バックエンド修正の確認
  - すべてのテストが通ることを確認
  - 質問があればユーザーに確認

- [-] 7. フロントエンド修正
  - [x] 7.1 useSlackIntegration.tsの修正
    - connectSlack関数で認証トークンをクエリパラメータに含める
    - Supabaseセッションからトークンを取得
    - _Requirements: 2.3, 4.1_
  - [ ] 7.2 API URL検証の追加
    - NEXT_PUBLIC_SLACK_API_URLが未設定の場合のエラーハンドリング
    - _Requirements: 2.1, 2.2_
  - [ ] 7.3 redirect_uri構築の修正
    - 現在のページURLを正しくエンコード
    - _Requirements: 2.4_
  - [ ]* 7.4 Redirect URI構築のテストを作成
    - **Property 4: Redirect URI構築の正確性**
    - **Validates: Requirements 2.4**

- [ ] 8. ステータス表示とエラーハンドリング
  - [ ] 8.1 refreshStatus関数の修正
    - 認証ヘッダーを含める
    - エラー時の適切なメッセージ表示
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ] 8.2 disconnectSlack関数の修正
    - 認証ヘッダーを含める
    - 確認ダイアログの動作確認
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 9. チェックポイント - フロントエンド修正の確認
  - すべてのテストが通ることを確認
  - 質問があればユーザーに確認

- [ ] 10. 環境変数設定ドキュメントの更新
  - [ ] 10.1 Lambda環境変数設定手順を文書化
    - 必要な環境変数一覧
    - AWS Lambdaコンソールでの設定手順
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ] 10.2 Amplify環境変数設定手順を文書化
    - NEXT_PUBLIC_SLACK_API_URLの設定
    - _Requirements: 2.1_

- [ ] 11. 最終チェックポイント
  - すべてのテストが通ることを確認
  - 質問があればユーザーに確認

## 備考

- タスクに `*` マークが付いているものはオプション（テスト関連）
- 各タスクは要件との対応を明記
- プロパティテストは `hypothesis` ライブラリを使用
