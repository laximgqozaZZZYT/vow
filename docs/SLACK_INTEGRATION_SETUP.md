# Slack Integration Setup Guide

このガイドでは、VOWアプリにSlack連携機能をセットアップする手順を説明します。

## 前提条件

- Supabaseプロジェクトがセットアップ済み
- バックエンドが動作している
- Slackワークスペースの管理者権限

## クイックスタート

### 必要な手順の概要

1. Slack Appの作成（Slack API Dashboard）
2. OAuth & Permissionsの設定
3. Slash Commandsの設定
4. Interactivityの設定
5. 環境変数の設定
6. データベースマイグレーション
7. 動作確認

---

## 1. Slack Appの作成

### 1.1 Slack APIでアプリを作成

1. [Slack API](https://api.slack.com/apps) にアクセス
2. 「Create New App」をクリック
3. 「From scratch」を選択
4. アプリ名（例: VOW Habit Tracker）とワークスペースを選択
5. 「Create App」をクリック

### 1.2 OAuth & Permissions の設定

**場所**: 左メニュー → 「OAuth & Permissions」

#### Redirect URLs の追加

「Redirect URLs」セクションで「Add New Redirect URL」をクリック：

| 環境 | URL |
|------|-----|
| 開発環境 | `http://localhost:8000/api/slack/callback` |
| 本番環境 | `https://your-api-domain.com/api/slack/callback` |

#### Bot Token Scopes の追加

「Scopes」セクションの「Bot Token Scopes」で以下を追加：

| Scope | 説明 |
|-------|------|
| `chat:write` | メッセージ送信 |
| `commands` | スラッシュコマンド |
| `users:read` | ユーザー情報取得 |
| `im:write` | DMチャンネル作成 |

### 1.3 Slash Commands の設定

**場所**: 左メニュー → 「Slash Commands」

「Create New Command」をクリックして以下のコマンドを作成：

| Command | Request URL | Short Description | Usage Hint |
|---------|-------------|-------------------|------------|
| `/habit-dashboard` | `http://localhost:8000/api/slack/commands` | 今日の習慣進捗を表示します | 習慣の進捗を確認 |
| `/habit-done` | `http://localhost:8000/api/slack/commands` | Mark a habit as complete | [習慣名] |
| `/habit-status` | `http://localhost:8000/api/slack/commands` | View today's progress | - |
| `/habit-list` | `http://localhost:8000/api/slack/commands` | List all habits | - |

> **推奨**: `/habit-dashboard` は `/habit-status` と `/habit-list` の機能を統合した新しいコマンドです。ワークロードベースの進捗表示とインクリメントボタンが含まれています。

> **注意**: 開発環境ではngrokなどのトンネリングツールを使用してローカルサーバーを公開する必要があります。

### 1.4 Interactivity の設定

**場所**: 左メニュー → 「Interactivity & Shortcuts」

1. 「Interactivity」を **ON** にする
2. Request URLを設定: `http://localhost:8000/api/slack/interactions`
3. 「Save Changes」をクリック

### 1.5 認証情報の取得

**場所**: 左メニュー → 「Basic Information」

「App Credentials」セクションから以下の情報をコピー：

- **Client ID** - OAuth認証に使用
- **Client Secret** - OAuth認証に使用
- **Signing Secret** - Webhook署名検証に使用

---

## 2. 環境変数の設定

### 2.1 暗号化キーの生成

トークン暗号化用のFernetキーを生成：

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 2.2 バックエンド環境変数

`backend/.env` ファイルに以下を追加：

```env
# Slack OAuth Integration
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_CALLBACK_URI=http://localhost:8000/api/slack/callback

# Token Encryption
TOKEN_ENCRYPTION_KEY=your-generated-fernet-key

# Supabase (if not already set)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

---

## 3. データベースマイグレーション

### 3.1 Supabase CLIでマイグレーション適用

```bash
cd supabase
supabase db push
```

### 3.2 または、Supabaseダッシュボードで直接実行

1. [Supabase Dashboard](https://supabase.com/dashboard) にアクセス
2. プロジェクトを選択
3. 「SQL Editor」を開く
4. 以下のマイグレーションファイルを順番に実行：

```
supabase/migrations/20260120000000_add_slack_connections.sql
supabase/migrations/20260120000001_add_slack_notification_preferences.sql
supabase/migrations/20260120000002_add_slack_follow_up_status.sql
```

---

## 4. Slack Appのインストール

1. Slack APIダッシュボードで「Install to Workspace」をクリック
2. 権限を確認して「Allow」をクリック
3. ワークスペースにアプリがインストールされます

---

## 5. 開発環境でのテスト

### 5.1 ngrokのセットアップ（ローカル開発用）

Slackからのwebhookを受け取るには、ローカルサーバーを公開する必要があります：

```bash
# ngrokをインストール
brew install ngrok  # macOS
# または https://ngrok.com/download からダウンロード

# ローカルサーバーを公開
ngrok http 8000
```

ngrokが生成したURLをSlack Appの設定に反映：
- Redirect URL: `https://xxxx.ngrok.io/api/slack/callback`
- Slash Commands Request URL: `https://xxxx.ngrok.io/api/slack/commands`
- Interactivity Request URL: `https://xxxx.ngrok.io/api/slack/interactions`

### 5.2 バックエンドの起動

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 5.3 フロントエンドの起動

```bash
cd frontend
npm run dev
```

### 5.4 Slack連携のテスト

1. ブラウザで `http://localhost:3000/settings` にアクセス
2. 「Integrations」タブを選択
3. 「Connect Slack」をクリック
4. Slackの認証画面で「Allow」をクリック
5. 接続成功後、「Test Connection」をクリック
6. SlackのDMにテストメッセージが届くことを確認

### 5.5 スラッシュコマンドのテスト

Slackで以下のコマンドを試す：

```
/habit-dashboard
/habit-status
/habit-list
/habit-done "習慣名"
```

> **推奨**: `/habit-dashboard` を使用すると、習慣一覧と進捗状況を統合したビューが表示されます。各習慣にはインクリメントボタンが付いており、ワンクリックで進捗を記録できます。

---

## 6. APIテスト（Postman）

Postmanコレクションが用意されています。

### コレクション情報

- **Workspace**: 白城祐真's Workspace
- **Collection**: VOW Slack Integration API
- **Environment**: VOW Local Development

### エンドポイント一覧

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/slack/connect` | OAuth開始 |
| GET | `/api/slack/callback` | OAuthコールバック |
| POST | `/api/slack/disconnect` | 接続解除 |
| GET | `/api/slack/status` | 接続状態取得 |
| GET | `/api/slack/preferences` | 設定取得 |
| PUT | `/api/slack/preferences` | 設定更新 |
| POST | `/api/slack/test` | テストメッセージ送信 |
| POST | `/api/slack/commands` | Slashコマンド処理 |
| POST | `/api/slack/interactions` | ボタンクリック処理 |
| POST | `/api/slack/events` | イベント処理 |

### 環境変数

| 変数 | 説明 | デフォルト値 |
|------|------|-------------|
| `base_url` | APIベースURL | `http://localhost:8000` |
| `user_id` | テストユーザーID | `test-user-id` |
| `timestamp` | Slack署名用タイムスタンプ | - |
| `signature` | Slack署名 | - |

---

## トラブルシューティング

### OAuth認証エラー

| 症状 | 原因 | 解決策 |
|------|------|--------|
| `invalid_redirect_uri` | Redirect URLが一致しない | Slack App設定のRedirect URLを確認 |
| `invalid_client_id` | Client IDが間違っている | 環境変数を確認 |
| `access_denied` | ユーザーが拒否した | 再度認証を試行 |

### Webhook署名エラー

| 症状 | 原因 | 解決策 |
|------|------|--------|
| `401 Invalid signature` | Signing Secretが間違っている | 環境変数を確認 |
| タイムスタンプエラー | リクエストが古い（5分以上） | サーバー時刻を確認 |

### メッセージ送信エラー

| 症状 | 原因 | 解決策 |
|------|------|--------|
| `channel_not_found` | DMチャンネルが開けない | `im:write` スコープを確認 |
| `not_authed` | トークンが無効 | 再接続を試行 |

---

## 本番環境へのデプロイ

### チェックリスト

- [ ] 環境変数を本番用に更新
- [ ] Slack AppのRedirect URLを本番URLに変更
- [ ] Slash CommandsのRequest URLを本番URLに変更
- [ ] Interactivity URLを本番URLに変更
- [ ] SSL証明書が有効であることを確認
- [ ] データベースマイグレーションを適用

### AWS Lambda環境のURL

現在のAPI Gateway URL: `https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development`

```
Redirect URL: https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/slack/callback
Commands URL: https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/slack/commands
Interactions URL: https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/slack/interactions
Events URL: https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/api/slack/events
```

### 本番環境のURL例（カスタムドメイン使用時）

```
Redirect URL: https://api.your-domain.com/api/slack/callback
Commands URL: https://api.your-domain.com/api/slack/commands
Interactions URL: https://api.your-domain.com/api/slack/interactions
Events URL: https://api.your-domain.com/api/slack/events
```

---

## 参考リンク

- [Slack API Documentation](https://api.slack.com/)
- [OAuth 2.0 V2](https://api.slack.com/authentication/oauth-v2)
- [Slash Commands](https://api.slack.com/interactivity/slash-commands)
- [Block Kit Builder](https://app.slack.com/block-kit-builder)
