# Tailscale MCP Server Setup Guide

192.168.2.110 のMCPサーバをTailscale Funnelで公開する手順。

## サーバ情報

- **IP**: 192.168.2.110
- **OS**: Ubuntu
- **MCPサーバポート**: 3456
- **目的**: AWS開発環境からMCPサーバへのアクセス

## 手順

### Step 1: Tailscaleインストール

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### Step 2: Tailscale認証

```bash
sudo tailscale up
```

表示されるURLをブラウザで開き、Tailscaleアカウントでログイン。

### Step 3: Funnel有効化（ポート3456を公開）

```bash
# Funnelでポート3456を公開
sudo tailscale funnel 3456
```

公開URLが表示される（例: `https://mcp-110.your-tailnet.ts.net`）

### Step 4: 永続化

```bash
# バックグラウンドで永続公開
sudo tailscale funnel --bg 3456

# 状態確認
tailscale funnel status
```

### Step 5: 動作確認

```bash
# 発行されたURLでアクセスできるか確認
curl https://<発行されたURL>/health
```

## 事前準備（Step 3の前に必要）

### 1. MCPサーバが起動していること

```bash
# MCPサーバの起動確認
curl http://localhost:3456/health

# 起動していない場合は起動
cd /path/to/mcp-server
./setup_multi_agent.sh start-server
# または
node server.js
```

### 2. ファイアウォール設定（UFW使用時）

```bash
# ローカルからのアクセスを許可（Tailscaleが内部でプロキシするため、外部公開は不要）
sudo ufw allow from 127.0.0.1 to any port 3456
```

### 3. MCPサーバの認証トークン確認

```bash
# トークンを確認（VOW登録時に必要）
cat /path/to/mcp-server/config.json
# または環境変数
echo $TASK_SERVER_TOKEN
```

### 4. HTTPS対応確認

Tailscale FunnelはHTTPSを自動で提供するため、MCPサーバ自体はHTTPで動作していればOK。

## VOWへの登録

1. VOW設定ページ > AI設定 > MCPサーバー
2. 「サーバーを追加」をクリック
3. 以下を入力:
   - **サーバー名**: MCP Server (Tailscale)
   - **サーバーURL**: `https://<発行されたFunnel URL>`
   - **認証トークン**: MCPサーバの認証トークン
4. 「追加」をクリック
5. 「接続」ボタンでテスト

## トラブルシューティング

### Funnelが有効にならない

```bash
# Tailscale管理画面でFunnel機能が有効か確認
# https://login.tailscale.com/admin/dns
# → Funnel を有効化する必要がある場合あり
```

### 接続できない

```bash
# MCPサーバのログ確認
journalctl -u mcp-server -f

# Tailscale状態確認
tailscale status
tailscale funnel status
```

### 認証エラー

- トークンが正しいか確認
- MCPサーバ側でCORS設定が必要な場合がある

## 参考

- Tailscale Funnel: https://tailscale.com/kb/1223/funnel
- MCP Multi-Agent: `/home/ubuntu/.mcp-multi-agent/`
