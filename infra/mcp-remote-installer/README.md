# VOW MCP Remote Agent Installer

リモートマシンでClaude Codeを実行し、VOWプロジェクトのMCPタスクサーバーに接続するためのインストーラーです。

## 概要

このインストーラーは、リモートマシンにMCPエージェントを設定し、中央のタスクサーバーに接続できるようにします。これにより、複数のマシンでClaude Codeエージェントを並列実行し、VOWプロジェクトの開発作業を分散できます。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│              Central Task Server (port 3456)                 │
│            http://192.168.2.126:3456                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Tasks  │  │ Agents  │  │  Auth   │  │   SSE   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
        ▲                           ▲
        │ HTTP                      │ HTTP
        │                           │
┌───────┴───────┐           ┌───────┴───────┐
│   Host Machine│           │ Remote Machine│
│ (192.168.2.126)│          │ (192.168.2.110)│
│ Task Server   │           │ MCP Agent     │
│ + Claude Code │           │ + Claude Code │
└───────────────┘           └───────────────┘
```

## 必要条件

- Node.js 18以上
- npm
- Claude Code CLI
- ネットワーク接続（タスクサーバーのポート3456へのアクセス）

## インストール方法

### 方法1: ワンライナーインストール

```bash
curl -sSL http://192.168.2.126:3001/api/mcp-installer/install.sh -o install.sh \
  && chmod +x install.sh \
  && ./install.sh --server-url http://192.168.2.126:3456 --token YOUR_TOKEN
```

### 方法2: 手動インストール

1. インストーラーをダウンロード：
```bash
curl -O http://192.168.2.126:3001/api/mcp-installer/install.sh
chmod +x install.sh
```

2. インストールを実行：
```bash
./install.sh \
  --server-url http://192.168.2.126:3456 \
  --token YOUR_TOKEN \
  --name "Remote-Agent-1" \
  --role developer
```

## オプション

| オプション | 説明 | デフォルト |
|-----------|------|----------|
| `--server-url` | タスクサーバーのURL（必須） | - |
| `--token` | 認証トークン（必須） | - |
| `--name` | エージェントの表示名 | `hostname-agent` |
| `--role` | エージェントの役割 | `developer` |
| `--install-dir` | インストール先ディレクトリ | `~/vow-mcp-agent` |
| `--machine-id` | マシン識別子 | 自動生成 |

## 利用可能な役割

- `manager` - タスク管理・統括
- `developer` - 開発・実装
- `reviewer` - コードレビュー
- `tester` - テスト実行
- `documenter` - ドキュメント作成
- `analyst` - 分析・データ処理
- `architect` - システム設計
- `devops` - インフラ・デプロイ
- `general` - 汎用

## インストール後

インストールが完了すると、Claude CodeのMCP設定が自動的に構成されます。

```bash
# Claude Codeを起動
claude

# エージェントを登録（初回のみ）
# MCPツール register_agent を使用
```

### 利用可能なMCPツール

- `register_agent` - サーバーにエージェントを登録
- `heartbeat` - ステータス更新
- `list_agents` - 全エージェント一覧
- `create_task` - タスク作成
- `list_tasks` - タスク一覧
- `get_my_tasks` - 自分のタスク取得
- `claim_task` - タスクを開始
- `submit_result` - 結果を送信
- `dashboard` - 統計ダッシュボード

## トラブルシューティング

### サーバーに接続できない

1. サーバーが起動しているか確認：
```bash
curl http://192.168.2.126:3456/health
```

2. ファイアウォール設定を確認：
```bash
# ポート3456が開いているか確認
nc -zv 192.168.2.126 3456
```

### 認証エラー

トークンが正しいか確認してください。MOCセクションの「リモートエージェント追加」から最新のトークンを取得できます。

### Node.jsバージョンエラー

Node.js 18以上が必要です：
```bash
node -v
# v18.x.x 以上が必要
```

## ファイル構成

インストール後のディレクトリ構成：

```
~/vow-mcp-agent/
├── build/              # コンパイル済みJS
│   └── mcp-bridge.js   # MCPブリッジ
├── src/                # TypeScriptソース
│   └── mcp-bridge.ts
├── package.json
├── tsconfig.json
├── .env                # 環境変数
├── start-agent.sh      # 手動起動スクリプト
└── check-status.sh     # ステータス確認スクリプト
```

## セキュリティ

- トークンは安全に保管してください
- `.env`ファイルには認証情報が含まれます
- ネットワーク経由の通信はHTTPSを推奨（本番環境）

## 関連ドキュメント

- [VOW CLAUDE.md](/home/ubuntu/Downloads/vow/CLAUDE.md) - プロジェクト概要
- [Multi-Agent Manual](/.claude/MULTI-AGENT-MANUAL.md) - マルチエージェント操作ガイド
