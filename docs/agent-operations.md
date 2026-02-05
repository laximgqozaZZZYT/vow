# VOW エージェント運用ガイド

## 概要

本ドキュメントでは、VOWプロジェクトで使用するQA巡回エージェントとIssue巡回エージェントの起動・停止手順を説明します。

---

## 前提条件

### 1. バックエンドサーバーの起動

```bash
cd /home/ubuntu/Downloads/vow/backend
nohup npx tsx watch src/index.ts > /tmp/backend-dev.log 2>&1 &
```

### 2. 有効なAPIキーの取得

Web UI (`http://localhost:3000/dashboard/settings/api-keys`) でAPIキーを発行するか、既存の有効なキーを使用します。

```bash
# APIキーの有効性確認
curl -s http://localhost:4000/health
curl -s -H "Authorization: Bearer YOUR_API_KEY" http://localhost:4000/api/issues/cli
```

### 3. 環境変数ファイルの作成（オプション）

```bash
cat > /tmp/vow_agent_env.sh << 'EOF'
export VOW_API_KEY="YOUR_API_KEY_HERE"
export VOW_API_URL="http://localhost:4000"
export QA_PATROL_USE_CLI_API="true"
export QA_PATROL_ALWAYS_REPORT="true"
EOF
```

---

## QA巡回エージェント

### 概要
AIコーチの会話品質を自動テストし、問題があればIssueとして報告します。

### ファイル
- **テストスペック**: `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol.spec.ts`
- **設定**: `/home/ubuntu/Downloads/vow/frontend/playwright.config.ts`

### ペルソナ一覧

| PERSONA_INDEX | ID | 説明 |
|---------------|-----|------|
| 0 | health-oriented | 健康志向ユーザー（運動・ダイエット） |
| 1 | stressed-user | ストレスを感じているユーザー |
| 2 | beginner | 初心者ユーザー |

### 起動コマンド

```bash
cd /home/ubuntu/Downloads/vow/frontend

# 特定のペルソナでテスト実行
VOW_API_KEY="YOUR_API_KEY" \
VOW_API_URL="http://localhost:4000" \
QA_PATROL_USE_CLI_API="true" \
QA_PATROL_ALWAYS_REPORT="true" \
PERSONA_INDEX=0 \
npx playwright test qa-patrol.spec.ts --project=chromium --reporter=line

# または環境変数ファイルを使用
source /tmp/vow_agent_env.sh
PERSONA_INDEX=0 npx playwright test qa-patrol.spec.ts --project=chromium --reporter=line
```

### 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `VOW_API_KEY` | CLI認証用APIキー | 必須 |
| `VOW_API_URL` | バックエンドURL | `http://localhost:4000` |
| `QA_PATROL_USE_CLI_API` | CLI APIモードを使用 | `false` |
| `QA_PATROL_ALWAYS_REPORT` | 成功時もIssue作成 | `false` |
| `PERSONA_INDEX` | テストするペルソナ | 全ペルソナ |

### Claude Code からの起動

```
QA巡回エージェントを実行して、AIコーチの会話品質をテストしてください。
ペルソナは「健康志向ユーザー」(PERSONA_INDEX=0)を使用してください。
```

---

## Issue巡回エージェント

### 概要
未解決のIssueを巡回し、分析・分類・重複検出・自動クローズを行います。

### 機能
1. **Pass Report自動クローズ**: QA巡回の成功レポート（タイトルに✓含む）を自動クローズ
2. **バグ分析**: 高優先度バグの根本原因を分析
3. **重複検出**: 類似Issueを特定しグループ化
4. **ステータス更新**: 分析結果をresolutionNotesに記録

### 起動コマンド（Claude Code）

```
Issue巡回エージェントを起動してください。以下の作業を実行してください：
1. 未解決Issueの一覧を取得
2. QA巡回のPass Reportを自動クローズ
3. 高優先度バグを分析し、根本原因をresolutionNotesに記録
4. 重複Issueを特定し、マスターIssueにリンク
```

### API エンドポイント

```bash
# Issue一覧取得
curl -s -H "Authorization: Bearer $VOW_API_KEY" \
  "$VOW_API_URL/api/issues/cli?status=open"

# Issue更新
curl -s -X PATCH "$VOW_API_URL/api/issues/cli/{issue_id}" \
  -H "Authorization: Bearer $VOW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved", "resolutionNotes": "自動クローズ"}'

# Issue作成
curl -s -X POST "$VOW_API_URL/api/issues/cli" \
  -H "Authorization: Bearer $VOW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Issue Title", "description": "Description", "category": "bug", "priority": "high"}'
```

---

## エージェント停止

### 方法1: Claude Code タスク停止

```
/tasks コマンドで実行中のタスクを確認し、TaskStop ツールで停止できます。
```

### 方法2: プロセス停止

```bash
# Playwright テストプロセスを停止
pkill -f "playwright"

# 特定のNode.jsプロセスを停止
ps aux | grep -E "playwright|qa-patrol" | grep -v grep
kill <PID>
```

---

## トラブルシューティング

### APIキーエラー

```json
{"error":"API_KEY_NOT_FOUND","message":"API key not found or revoked"}
```

**解決方法**: 新しいAPIキーを発行し、環境変数を更新

### バックエンド接続エラー

```
Error: connect ECONNREFUSED 127.0.0.1:4000
```

**解決方法**: バックエンドサーバーを起動

```bash
cd /home/ubuntu/Downloads/vow/backend
nohup npx tsx watch src/index.ts > /tmp/backend-dev.log 2>&1 &
tail -f /tmp/backend-dev.log
```

### Playwright ブラウザエラー

```
Error: browserType.launch: Executable doesn't exist
```

**解決方法**: ブラウザをインストール

```bash
cd /home/ubuntu/Downloads/vow/frontend
npx playwright install chromium
```

---

## 定期実行（Cron）

### QA巡回を毎時実行

```bash
# crontab -e
0 * * * * cd /home/ubuntu/Downloads/vow/frontend && source /tmp/vow_agent_env.sh && npx playwright test qa-patrol.spec.ts --project=chromium >> /tmp/qa-patrol-cron.log 2>&1
```

### 注意事項
- APIキーの有効期限を確認（デフォルト30日〜1年）
- ログファイルの肥大化に注意
- バックエンドサーバーが起動していることを確認

---

## 結果格納先

**重要**: 巡回エージェントの結果は以下に格納されます。

| ファイル | 説明 |
|----------|------|
| `/home/ubuntu/Downloads/vow/.result/ISSUES.md` | **メイン結果ファイル**（QA巡回・Issue巡回共通） |
| `/tmp/vow-patrol-state/patrol-config.json` | 巡回エージェント設定 |

### 結果ファイルの読み込み

```bash
# 最新の結果を確認
cat /home/ubuntu/Downloads/vow/.result/ISSUES.md

# ターミナルで文字化けする場合
LANG=ja_JP.UTF-8 cat /home/ubuntu/Downloads/vow/.result/ISSUES.md
```

---

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| `.result/ISSUES.md` | **巡回結果ファイル（メイン）** |
| `frontend/e2e/qa-patrol.spec.ts` | QA巡回テストスペック |
| `frontend/playwright.config.ts` | Playwright設定 |
| `backend/src/routers/issues.ts` | Issue APIルーター |
| `backend/src/routers/agents.ts` | CLI Agent APIルーター |
| `backend/src/middleware/cliAuth.ts` | CLI認証ミドルウェア |
