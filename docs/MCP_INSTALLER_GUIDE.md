# MCP Installer Guide - VOW Project

VOWプロジェクトのマルチエージェント開発環境を構築するための、MCPサーバーおよびリモートエージェントのインストールガイドです。

**Version:** 1.1.0
**Last Updated:** 2026-02-05

---

## Table of Contents

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [MCPサーバーインストール](#mcpサーバーインストール)
4. [リモートエージェントインストール](#リモートエージェントインストール)
5. [サーバー管理コマンド](#サーバー管理コマンド)
6. [設定ファイル](#設定ファイル)
7. [トラブルシューティング](#トラブルシューティング)
8. [アーキテクチャ](#アーキテクチャ)
9. [セキュリティ考慮事項](#セキュリティ考慮事項)

---

## 概要

### MCPサーバーとは

**MCP (Model Context Protocol) サーバー**は、複数のClaude Codeエージェントを調整し、タスクの配分・進捗管理を行う中央集約型サーバーです。VOWプロジェクトにおいて、以下の機能を提供します。

- **エージェント管理**: 複数マシンのClaude Codeエージェントを登録・管理
- **タスク配分**: 開発タスクを自動的に適切なエージェントに割り当て
- **リアルタイム同期**: SSE (Server-Sent Events) による状態変更の即時通知
- **チャット統合**: Claude Code CLIとの直接対話機能
- **セッション記憶**: 会話履歴の保持による文脈理解の向上

### VOWプロジェクトとの関係

```
┌──────────────────────────────────────────────────────────┐
│          VOW Frontend (Amplify/Next.js)                  │
│  ┌───────────────────────────────────────────────┐       │
│  │ MOC (Multi-agent Orchestration Center)        │       │
│  │  - Agent Dashboard                            │       │
│  │  - Task Creation UI                           │       │
│  │  - Real-time Status Monitor                   │       │
│  └───────────────────────────────────────────────┘       │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTP/SSE
                   ▼
┌──────────────────────────────────────────────────────────┐
│        MCP Task Distribution Server (port 3456)          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │  Tasks  │  │ Agents  │  │  Auth   │  │   SSE   │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTP
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Agent 1 │  │ Agent 2 │  │ Agent 3 │
│(Host)   │  │(Remote) │  │(Remote) │
│Claude   │  │Claude   │  │Claude   │
│Code     │  │Code     │  │Code     │
└─────────┘  └─────────┘  └─────────┘
```

---

## 前提条件

### 必須要件

| 要件 | 最小バージョン | 推奨バージョン | 確認方法 |
|------|---------------|---------------|----------|
| **Node.js** | 16.0+ | 18.0+ or 20.0+ | `node -v` |
| **npm** | 8.0+ | 9.0+ | `npm -v` |
| **bash** | 4.0+ | 5.0+ | `bash --version` |
| **openssl** | 任意 | 最新 | `openssl version` |

### オプション要件

| ツール | 用途 | 確認方法 |
|--------|------|----------|
| **git** | ソースコード取得（代替手段あり） | `git --version` |
| **curl** | インストーラー取得・接続テスト | `curl --version` |
| **systemd** | サーバー自動起動設定 | `systemctl --version` |

### Node.jsのインストール

#### 方法1: nvm（推奨）

```bash
# nvm インストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Node.js 18 インストール
nvm install 18
nvm use 18
node -v  # v18.x.x が表示されることを確認
```

#### 方法2: パッケージマネージャ（Ubuntu/Debian）

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # v18.x.x が表示されることを確認
```

---

## MCPサーバーインストール

### インストール方法

#### 方法1: ワンライナーインストール（GitHub経由）

```bash
curl -fsSL https://raw.githubusercontent.com/laximgqozaZZZYT/vow/main/infra/mcp-installer/install.sh | bash
```

#### 方法2: ワンライナーインストール（AWS Lambda経由）

```bash
curl -fsSL https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/mcp-installer/install.sh | bash
```

#### 方法3: ローカルネットワーク経由

```bash
# サーバーでインストーラーを配信している場合
curl -fsSL http://SERVER_IP:8080/install.sh | bash
```

### インストールオプション

環境変数でインストール動作をカスタマイズできます。

| 環境変数 | デフォルト値 | 説明 |
|---------|------------|------|
| `INSTALL_DIR` | `~/.mcp-multi-agent` | インストール先ディレクトリ |
| `SERVER_PORT` | `3456` | サーバーのポート番号 |
| `AUTO_START` | `false` | インストール後の自動起動 |
| `SKIP_BUILD` | `false` | TypeScriptビルドのスキップ |

#### オプション使用例

```bash
# カスタムディレクトリにインストール
curl -fsSL http://SERVER/install.sh | INSTALL_DIR=/opt/mcp-server bash

# インストール後自動起動
curl -fsSL http://SERVER/install.sh | AUTO_START=true bash

# カスタムポートで起動
curl -fsSL http://SERVER/install.sh | SERVER_PORT=4000 bash

# 複数オプションの組み合わせ
curl -fsSL http://SERVER/install.sh | \
  INSTALL_DIR=/opt/mcp \
  SERVER_PORT=4000 \
  AUTO_START=true \
  bash
```

### インストール完了後の確認

```bash
# サーバー起動
~/.mcp-multi-agent/setup_multi_agent.sh start-server

# ヘルスチェック
curl http://localhost:3456/health

# 期待される応答
# {"success":true,"data":{"status":"running","timestamp":"2026-02-05T..."}}
```

### Claude Codeでの使用

```bash
# MCP設定を指定してClaude Code起動
claude --mcp-config ~/.mcp-multi-agent/mcp-config.json
```

### VOWフロントエンドからの接続

1. VOWフロントエンド（`https://main.do1k9oyyorn24.amplifyapp.com/`）にアクセス
2. MOC（Multi-agent Orchestration Center）セクションを開く
3. 「Chat Agent Settings」を選択
4. 「Connect to Local Claude Code」をクリック
5. または手動で入力：
   - **URL**: `http://localhost:3456`
   - **Token**: インストール時に表示されたトークン

---

## リモートエージェントインストール

リモートマシン（ホストマシン以外）でClaude Codeエージェントを起動し、中央サーバーに接続する手順です。

### 前提条件

1. **ホストマシンでMCPサーバーが起動していること**
2. **ネットワーク接続**が可能であること（同一LAN内推奨）
3. **ポート3456への接続**が許可されていること

### インストーラー取得

#### 方法1: 直接ダウンロード

```bash
curl -O https://raw.githubusercontent.com/laximgqozaZZZYT/vow/main/infra/mcp-remote-installer/install.sh
chmod +x install.sh
```

#### 方法2: GitHubからクローン

```bash
git clone https://github.com/laximgqozaZZZYT/vow.git
cd vow/infra/mcp-remote-installer
chmod +x install.sh
```

### インストール実行

```bash
./install.sh \
  --server-url http://192.168.2.200:3456 \
  --token mcp-dca3c407f66c5b62840b06c3d624c857 \
  --name "Developer-01" \
  --role developer
```

### コマンドラインオプション

| オプション | 説明 | 必須 | デフォルト値 |
|-----------|------|------|-------------|
| `--server-url` | MCPサーバーのURL | **必須** | - |
| `--token` | 認証トークン | **必須** | - |
| `--name` | エージェント表示名 | 任意 | `hostname-agent` |
| `--role` | エージェント役割 | 任意 | `developer` |
| `--install-dir` | インストール先 | 任意 | `~/vow-mcp-agent` |
| `--machine-id` | マシン識別子 | 任意 | 自動生成 |

### 利用可能な役割（Role）

| 役割 | 説明 | 推奨用途 |
|------|------|---------|
| `manager` | タスク管理・調整 | プロジェクト統括、タスク割り当て |
| `developer` | 開発・実装 | コード作成、機能実装 |
| `reviewer` | コードレビュー | PR査読、品質チェック |
| `tester` | テスト実行 | 自動テスト、QA検証 |
| `documenter` | ドキュメント作成 | 仕様書、READMEの執筆 |
| `analyst` | 分析・調査 | コードベース分析、データ処理 |
| `architect` | システム設計 | アーキテクチャ設計、技術選定 |
| `devops` | インフラ・デプロイ | CI/CD、サーバー管理 |
| `general` | 汎用 | 特定の役割を持たない一般作業 |

### サーバーURL・トークンの取得方法

#### 方法1: `export-config`コマンドを使用

ホストマシンで実行：

```bash
~/.mcp-multi-agent/setup_multi_agent.sh export-config
```

出力例：

```
==========================================
  MCP Server Configuration Exported
==========================================

Configuration file: /home/ubuntu/.mcp-multi-agent/remote-config.json

Connection details:
  Server URL:  http://192.168.2.200:3456
  Token:       mcp-dca3c407f66c5b62840b06c3d624c857

Remote installation command:
  curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash -s -- \
    --mode client \
    --server-url http://192.168.2.200:3456 \
    --token mcp-dca3c407f66c5b62840b06c3d624c857
```

#### 方法2: 設定ファイルから直接確認

```bash
cat ~/.mcp-multi-agent/config/server.env
```

出力例：

```bash
TASK_SERVER_HOST=0.0.0.0
TASK_SERVER_PORT=3456
TASK_SERVER_TOKEN=mcp-dca3c407f66c5b62840b06c3d624c857
TASK_SERVER_URL=http://192.168.2.200:3456
```

### インストール後の確認

```bash
# 接続テスト
~/vow-mcp-agent/check-status.sh

# Claude Code起動（MCP設定は自動適用される）
claude

# エージェント登録（Claude Code内で実行）
# MCPツール「register_agent」を使用
```

---

## サーバー管理コマンド

MCPサーバーの管理は、`setup_multi_agent.sh`スクリプトで行います。

### 基本コマンド

| コマンド | 短縮形 | 説明 |
|---------|--------|------|
| `start-server` | `start` | サーバーを起動 |
| `stop-server` | `stop` | サーバーを停止 |
| `server-status` | `status` | サーバー状態確認 |
| `show-config` | `config` | 設定情報表示 |
| `generate-token` | - | 新しいトークン生成 |
| - | `restart` | サーバー再起動 |
| - | `logs` | ログをリアルタイム表示 |

### 新規追加コマンド（v1.1.0）

| コマンド | 短縮形 | 説明 |
|---------|--------|------|
| `export-config` | `export` | リモート接続情報を出力 |
| `verify-connection` | `verify` | 接続テスト実行 |

### 使用例

#### サーバー起動

```bash
~/.mcp-multi-agent/setup_multi_agent.sh start-server
```

出力例：

```
Starting MCP Task Server...
Server started successfully (PID: 12345)
URL: http://localhost:3456
Token: mcp-dca3c407f66c5b62840b06c3d624c857
```

#### サーバー状態確認

```bash
~/.mcp-multi-agent/setup_multi_agent.sh server-status
```

#### 設定情報表示

```bash
~/.mcp-multi-agent/setup_multi_agent.sh show-config
```

#### 新しいトークン生成

```bash
~/.mcp-multi-agent/setup_multi_agent.sh generate-token
```

#### リモート接続情報の出力

```bash
~/.mcp-multi-agent/setup_multi_agent.sh export-config
```

JSONファイル（`remote-config.json`）の内容：

```json
{
  "serverUrl": "http://192.168.2.200:3456",
  "token": "mcp-dca3c407f66c5b62840b06c3d624c857",
  "serverName": "hostname",
  "localIp": "192.168.2.200",
  "port": 3456,
  "exportedAt": "2026-02-05T10:30:00+09:00",
  "version": "1.1.0"
}
```

#### 接続テスト

```bash
~/.mcp-multi-agent/setup_multi_agent.sh verify-connection
```

出力例：

```
==========================================
  MCP Server Connection Verification
==========================================

[1/3] Local health check...
  ✓ Local connection OK

[2/3] LAN health check...
  ✓ LAN connection OK (192.168.2.200)

[3/3] Authentication check...
  ✓ Authentication OK

==========================================
  All checks passed!
==========================================
```

#### ログのリアルタイム表示

```bash
~/.mcp-multi-agent/setup_multi_agent.sh logs
```

---

## 設定ファイル

### ディレクトリ構造

```
~/.mcp-multi-agent/
├── setup_multi_agent.sh        # 管理スクリプト
├── mcp-server                   # シンボリックリンク（互換性用）
├── mcp-config.json              # Claude Code MCP設定
├── remote-config.json           # リモート接続情報（export-config実行時生成）
├── config/
│   └── server.env               # サーバー設定
├── logs/
│   ├── server.log               # サーバーログ
│   └── server.pid               # プロセスIDファイル
├── prompts/                     # プロンプトテンプレート
├── projects/                    # プロジェクトデータ
└── mcp-task-distributor/        # サーバーアプリケーション
    ├── src/                     # TypeScriptソース
    ├── build/                   # コンパイル済みJavaScript
    ├── package.json
    └── tsconfig.json
```

### server.env（サーバー設定）

**場所**: `~/.mcp-multi-agent/config/server.env`

```bash
# MCP Task Server Configuration
# Generated: 2026-02-05

TASK_SERVER_HOST=0.0.0.0
TASK_SERVER_PORT=3456
TASK_SERVER_TOKEN=mcp-dca3c407f66c5b62840b06c3d624c857
TASK_SERVER_URL=http://192.168.2.200:3456
```

| 変数 | 説明 | デフォルト値 |
|------|------|-------------|
| `TASK_SERVER_HOST` | バインドアドレス（0.0.0.0でLANアクセス可） | `0.0.0.0` |
| `TASK_SERVER_PORT` | リスニングポート | `3456` |
| `TASK_SERVER_TOKEN` | Bearer認証トークン | 自動生成（32文字hex） |
| `TASK_SERVER_URL` | 公開URL（リモート接続用） | 自動検出IP+ポート |

### mcp-config.json（Claude Code設定）

**場所**: `~/.mcp-multi-agent/mcp-config.json`

```json
{
  "mcpServers": {
    "task-distributor": {
      "command": "node",
      "args": ["/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/build/index.js"],
      "env": {
        "TASK_SERVER_URL": "http://localhost:3456",
        "TASK_SERVER_TOKEN": "mcp-dca3c407f66c5b62840b06c3d624c857",
        "AGENT_NAME": "${AGENT_NAME:-Agent}",
        "AGENT_ROLE": "${AGENT_ROLE:-worker}"
      }
    }
  }
}
```

---

## トラブルシューティング

### 1. サーバーが起動しない

#### 確認手順

**ステップ1: ポートの競合確認**

```bash
lsof -i :3456
```

既に使用中の場合：

```bash
# 既存プロセスを停止
kill <PID>

# または別ポートを使用
SERVER_PORT=4000 curl -fsSL ... | bash
```

**ステップ2: ログ確認**

```bash
cat ~/.mcp-multi-agent/logs/server.log
```

**ステップ3: Node.jsバージョン確認**

```bash
node -v
# v16.0.0 以上が必要
```

### 2. リモートエージェントが接続できない

#### 確認手順

**ステップ1: サーバーの起動確認**

ホストマシンで：

```bash
~/.mcp-multi-agent/setup_multi_agent.sh server-status
```

**ステップ2: ネットワーク接続確認**

リモートマシンで：

```bash
ping 192.168.2.200
curl -v http://192.168.2.200:3456/health
```

**ステップ3: ファイアウォール確認（ホスト側）**

```bash
sudo ufw status
sudo ufw allow 3456/tcp
```

### 3. 認証エラー（401 Unauthorized）

#### 解決方法

**Bearer認証ヘッダーを追加**：

```bash
# 正しい方法
curl -H "Authorization: Bearer YOUR_TOKEN" http://192.168.2.200:3456/agents

# または
curl "http://192.168.2.200:3456/agents?token=YOUR_TOKEN"
```

### 4. Node.jsバージョンエラー

#### 解決方法

**nvmでNode.js 18をインストール**：

```bash
# nvmがない場合はインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Node.js 18インストール
nvm install 18
nvm use 18
node -v  # v18.x.x 確認
```

---

## アーキテクチャ

### システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                   VOW Frontend (Amplify)                        │
│          https://main.do1k9oyyorn24.amplifyapp.com/             │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │   MOC (Multi-agent Orchestration Center)           │         │
│  │   - Agent Status Dashboard                         │         │
│  │   - Task Creation & Assignment UI                  │         │
│  │   - Real-time SSE Event Monitor                    │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP REST API + SSE
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│           MCP Task Distribution Server (Node.js)                │
│                     Port: 3456 (TCP)                            │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Tasks     │  │   Agents    │  │    Auth     │            │
│  │   Manager   │  │   Registry  │  │   Bearer    │            │
│  │             │  │             │  │   Token     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │     SSE     │  │    Chat     │  │  Dashboard  │            │
│  │  Broadcast  │  │ Integration │  │   Stats     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP (Bearer Auth)
          ┌───────────────┼───────────────┬───────────────┐
          ▼               ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Agent 1     │ │  Agent 2     │ │  Agent 3     │ │  Agent N     │
│  (Host)      │ │ (Remote A)   │ │ (Remote B)   │ │ (Remote X)   │
│              │ │              │ │              │ │              │
│  Claude Code │ │  Claude Code │ │  Claude Code │ │  Claude Code │
│  + MCP SDK   │ │  + MCP SDK   │ │  + MCP SDK   │ │  + MCP SDK   │
│              │ │              │ │              │ │              │
│  Role:       │ │  Role:       │ │  Role:       │ │  Role:       │
│  manager     │ │  developer   │ │  reviewer    │ │  tester      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### API エンドポイント

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/health` | GET | 不要 | ヘルスチェック |
| `/events` | GET | 必要 | SSEイベントストリーム |
| `/dashboard` | GET | 必要 | サーバー統計情報 |
| `/agents` | GET | 必要 | エージェント一覧 |
| `/agents/register` | POST | 必要 | エージェント登録 |
| `/agents/:id/heartbeat` | POST | 必要 | ハートビート送信 |
| `/agents/:id/chat` | GET/POST | 必要 | Claude Codeチャット |
| `/tasks` | GET | 必要 | タスク一覧 |
| `/tasks` | POST | 必要 | タスク作成 |
| `/tasks/:id/claim` | POST | 必要 | タスククレーム |
| `/tasks/:id/submit` | POST | 必要 | 結果送信 |

---

## セキュリティ考慮事項

### 1. 認証トークンの管理

#### ベストプラクティス

- **トークンは生成時のみ表示** → インストール完了時の画面に表示されるため、必ず記録する
- **設定ファイルのパーミッション**: `chmod 600 ~/.mcp-multi-agent/config/server.env`
- **定期的なトークンローテーション**: 月1回推奨

#### トークンの再生成

```bash
# 新しいトークン生成
~/.mcp-multi-agent/setup_multi_agent.sh generate-token

# 設定ファイル編集
vim ~/.mcp-multi-agent/config/server.env

# サーバー再起動
~/.mcp-multi-agent/setup_multi_agent.sh restart
```

### 2. ネットワークセキュリティ

#### LAN内限定アクセスの推奨

- **信頼できるネットワーク内でのみ使用**（オフィスLAN、自宅LAN）
- **公開インターネットへの露出は避ける**（現バージョンはHTTPのみ、TLSなし）

#### ファイアウォール設定

```bash
# 特定IPのみ許可（例: 192.168.2.0/24）
sudo ufw allow from 192.168.2.0/24 to any port 3456 proto tcp
```

### 3. 設定ファイルの保護

#### パーミッション設定

```bash
chmod 700 ~/.mcp-multi-agent
chmod 600 ~/.mcp-multi-agent/config/server.env
chmod 600 ~/.claude/mcp.json
```

---

## 関連ドキュメント

| ドキュメント | 場所 | 説明 |
|--------------|------|------|
| **プロジェクトガイド** | `/home/ubuntu/Downloads/vow/CLAUDE.md` | VOWプロジェクト全体のガイド |
| **サーバーREADME** | `/home/ubuntu/Downloads/vow/infra/mcp-installer/README.md` | サーバーインストーラー詳細 |
| **リモートREADME** | `/home/ubuntu/Downloads/vow/infra/mcp-remote-installer/README.md` | リモートエージェント詳細 |
| **エージェント運用** | `/home/ubuntu/Downloads/vow/docs/agent-operations.md` | QA/Issue巡回エージェント起動手順 |
| **仕様書** | `/home/ubuntu/Downloads/vow/specs/mcp-installer-enhancement/` | MCPインストーラー拡張仕様 |

---

## サポート

### Issue報告

バグ報告や機能要望は、GitHubリポジトリで受け付けています。

- **VOWプロジェクト**: [https://github.com/laximgqozaZZZYT/vow/issues](https://github.com/laximgqozaZZZYT/vow/issues)

---

## バージョン履歴

| バージョン | リリース日 | 主な変更 |
|-----------|-----------|---------|
| **1.1.0** | 2026-02-05 | `export-config`, `verify-connection`コマンド追加 |
| **1.0.0** | 2026-02-04 | 初回リリース（サーバー+リモートインストーラー） |
