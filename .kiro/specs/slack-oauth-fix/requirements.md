# 要件ドキュメント

## はじめに

本ドキュメントは、VOWアプリのSlack OAuth連携機能の修正に関する要件を定義します。現在、ユーザーが設定ページから「Connect Slack」ボタンをクリックすると、Internal Server Errorが発生してSlack連携を完了できない問題があります。この修正により、フロントエンドとAWS Lambda（API Gateway）間のSlack OAuth認証フローを正しく動作させ、Slackチャンネルでの習慣情報の参照・編集・追加を可能にします。

## 用語集

- **Slack_OAuth_Handler**: Slack OAuth 2.0フローを管理するバックエンドコンポーネント
- **Frontend_Settings_Page**: ユーザーがSlack連携を管理する設定ページ
- **API_Gateway**: AWS API Gatewayエンドポイント（`https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development`）
- **Amplify_Frontend**: AWS Amplifyでホストされるフロントエンド（`https://main.do1k9oyyorn24.amplifyapp.com`）
- **Supabase_Auth**: ユーザー認証を提供するSupabaseの認証サービス
- **JWT_Token**: ユーザー認証に使用されるJSON Web Token
- **Lambda_Function**: AWS Lambda上で動作するFastAPIバックエンド
- **CORS**: Cross-Origin Resource Sharing（クロスオリジンリソース共有）
- **OAuth_State**: CSRF攻撃を防ぐためのOAuth認証フローで使用される一時的なトークン

## 要件

### 要件1: Internal Server Errorの解消

**ユーザーストーリー:** ユーザーとして、「Connect Slack」ボタンをクリックした時にエラーなくSlack認証ページにリダイレクトされたい。これにより、Slack連携を開始できる。

#### 受け入れ基準

1. WHEN ユーザーが「Connect Slack」ボタンをクリックする時、THE Lambda_Function SHALL 500エラーを返さずにSlack OAuth URLにリダイレクトする
2. WHEN Lambda_Functionが起動する時、THE Lambda_Function SHALL 必要な環境変数（`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`）が設定されていることを確認する
3. IF 必要な環境変数が設定されていない場合、THEN THE Lambda_Function SHALL 明確なエラーメッセージをログに記録する
4. WHEN Supabase_Authトークンが提供される時、THE Lambda_Function SHALL トークンを正しく検証してユーザーを識別する
5. IF 認証トークンが無効または期限切れの場合、THEN THE Lambda_Function SHALL 401エラーを返す（500エラーではなく）

### 要件2: フロントエンドAPI URL設定の修正

**ユーザーストーリー:** 開発者として、フロントエンドが正しいバックエンドAPIエンドポイントに接続できるようにしたい。これにより、Slack OAuth認証フローが正しく開始できる。

#### 受け入れ基準

1. WHEN フロントエンドアプリケーションが起動する時、THE Frontend_Settings_Page SHALL 環境変数 `NEXT_PUBLIC_SLACK_API_URL` から正しいAPI Gateway URL（`https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development`）を読み込む
2. WHEN `NEXT_PUBLIC_SLACK_API_URL` が設定されていない時、THE Frontend_Settings_Page SHALL 適切なエラーメッセージを表示し、Slack連携ボタンを無効化する
3. WHEN ユーザーが「Connect Slack」ボタンをクリックする時、THE Frontend_Settings_Page SHALL 認証トークンをAuthorizationヘッダーに含めてリクエストを送信する
4. THE Frontend_Settings_Page SHALL リダイレクト時に現在のページURL（`https://main.do1k9oyyorn24.amplifyapp.com/settings`）を `redirect_uri` パラメータとして含める

### 要件3: CORS設定の修正

**ユーザーストーリー:** 開発者として、フロントエンドからバックエンドAPIへのクロスオリジンリクエストが正しく動作するようにしたい。これにより、Slack連携のステータス確認や設定更新ができる。

#### 受け入れ基準

1. WHEN フロントエンドがAPI Gatewayにリクエストを送信する時、THE API_Gateway SHALL Amplifyドメイン（`https://main.do1k9oyyorn24.amplifyapp.com`）からのリクエストを許可する
2. THE Lambda_Function SHALL CORS設定に `https://main.do1k9oyyorn24.amplifyapp.com` を含める
3. WHEN プリフライトリクエスト（OPTIONS）が送信される時、THE API_Gateway SHALL 適切なCORSヘッダーを含む200レスポンスを返す
4. THE API_Gateway SHALL `credentials: 'include'` を使用したリクエストをサポートする

### 要件4: 認証トークンの受け渡し

**ユーザーストーリー:** ユーザーとして、Slack連携を開始する際に自動的に認証されたい。これにより、追加のログイン操作なしでSlack連携を完了できる。

#### 受け入れ基準

1. WHEN ユーザーが「Connect Slack」ボタンをクリックする時、THE Frontend_Settings_Page SHALL Supabase認証トークンをAuthorizationヘッダーに含める
2. WHEN OAuth開始リクエストを受信する時、THE Slack_OAuth_Handler SHALL JWTトークンを検証してユーザーを識別する
3. IF 認証トークンが無効または期限切れの場合、THEN THE Slack_OAuth_Handler SHALL 401エラーを返し、ユーザーに再ログインを促す
4. WHEN OAuth stateを生成する時、THE Slack_OAuth_Handler SHALL ユーザーIDをstateに関連付けて保存する

### 要件5: OAuth コールバック処理の修正

**ユーザーストーリー:** ユーザーとして、Slack認証を完了した後、自動的に設定ページに戻りたい。これにより、連携が成功したことを確認できる。

#### 受け入れ基準

1. WHEN Slackからコールバックを受信する時、THE Slack_OAuth_Handler SHALL 認証コードをアクセストークンに交換する
2. WHEN トークン交換が成功する時、THE Slack_OAuth_Handler SHALL ユーザーのSlack接続情報をデータベースに保存する
3. WHEN 接続が保存される時、THE Slack_OAuth_Handler SHALL ユーザーをフロントエンドの設定ページ（`https://main.do1k9oyyorn24.amplifyapp.com/settings?slack_connected=true`）にリダイレクトする
4. IF OAuth認証が失敗する時、THEN THE Slack_OAuth_Handler SHALL ユーザーを設定ページにリダイレクトし、エラーパラメータを含める
5. THE Slack_OAuth_Handler SHALL コールバックURLとして正しいAPI Gateway URL（`https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/slack/callback`）を使用する

### 要件6: Lambda環境変数の設定

**ユーザーストーリー:** 開発者として、必要な環境変数が正しく設定されていることを確認したい。これにより、本番環境でSlack連携が正しく動作する。

#### 受け入れ基準

1. THE Lambda_Function SHALL 以下の環境変数を必要とする: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `TOKEN_ENCRYPTION_KEY`
2. THE Lambda_Function SHALL `SLACK_CALLBACK_URI` を `https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/slack/callback` として設定する
3. THE Lambda_Function SHALL `CORS_ORIGINS` に `https://main.do1k9oyyorn24.amplifyapp.com` を含める
4. THE Lambda_Function SHALL Supabase接続用の `SUPABASE_URL` と `SUPABASE_ANON_KEY` を設定する
5. WHEN 必須環境変数が設定されていない時、THE Lambda_Function SHALL 起動時にエラーをログに記録し、明確なエラーメッセージを返す

### 要件7: 接続ステータスの表示

**ユーザーストーリー:** ユーザーとして、Slack連携のステータスを設定ページで確認したい。これにより、連携が正しく設定されているかを把握できる。

#### 受け入れ基準

1. WHEN 設定ページが読み込まれる時、THE Frontend_Settings_Page SHALL `/api/slack/status` エンドポイントを呼び出して接続ステータスを取得する
2. WHEN Slackが接続されている時、THE Frontend_Settings_Page SHALL 「Connected」ステータスとワークスペース名を表示する
3. WHEN Slackが接続されていない時、THE Frontend_Settings_Page SHALL 「Connect Slack」ボタンを表示する
4. IF ステータス取得に失敗する時、THEN THE Frontend_Settings_Page SHALL エラーメッセージを表示し、再試行オプションを提供する

### 要件8: 接続解除機能

**ユーザーストーリー:** ユーザーとして、Slack連携を解除できるようにしたい。これにより、不要になった連携を削除できる。

#### 受け入れ基準

1. WHEN ユーザーが「Disconnect」ボタンをクリックする時、THE Frontend_Settings_Page SHALL 確認ダイアログを表示する
2. WHEN ユーザーが確認する時、THE Frontend_Settings_Page SHALL `/api/slack/disconnect` エンドポイントにPOSTリクエストを送信する
3. WHEN 接続解除が成功する時、THE Frontend_Settings_Page SHALL UIを更新して「Connect Slack」ボタンを表示する
4. IF 接続解除に失敗する時、THEN THE Frontend_Settings_Page SHALL エラーメッセージを表示する
