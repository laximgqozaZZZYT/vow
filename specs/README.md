# VOW Specs - Claude Code 並列開発用仕様書

このディレクトリには、Claude Codeエージェントが並列開発を行うための仕様書を格納します。

## Single Entry Point Architecture

**ユーザーは1つの窓口（親エージェント）のみと対話します。**

```
ユーザー
   │
   ▼
┌─────────────────────────┐
│  親エージェント (Opus)   │  ← ユーザー窓口
│  cd ~/Downloads/vow     │
│  claude --model opus    │
└─────────────────────────┘
   │ Task tool で委譲
   ├──────────────────────┬──────────────────────┐
   ▼                      ▼                      ▼
Frontend             Backend               MCP Server
Implementer          Implementer           Implementer
(Opus)               (Opus)                (Opus)
```

詳細: `specs/AGENT_WORKFLOW.md`

## ディレクトリ構造

```
specs/
├── README.md                    # このファイル
├── AGENT_WORKFLOW.md            # 親エージェントワークフロー
├── COORDINATION.md              # アクティブなスプリント調整
├── templates/                   # 仕様書テンプレート
│   └── feature-spec.md
└── {feature-name}/              # 各機能の仕様書
    ├── requirements.md          # 要件定義
    ├── design.md                # 設計・アーキテクチャ
    └── tasks.md                 # タスク分解（エージェント割り当て）
```

## 親エージェントの起動方法

```bash
cd ~/Downloads/vow
claude --model opus
```

これだけでOK。ユーザーはこの1つのエージェントに全ての指示を出します。

## ワークフロー

### 1. ユーザーがリクエストを送信

```
ユーザー: "MOCセクションのチャットが遅いので改善してほしい"
```

### 2. 親エージェントが分析・仕様作成

親エージェントは:
- リクエストを分析
- 必要に応じて仕様書を作成
- タスクを分解

### 3. 親エージェントが専門エージェントに委譲

```
Task tool:
  subagent_type: "implementer"
  model: "opus"
  prompt: "specs/moc-chat-performance/tasks.md のTask 1を実装..."
  run_in_background: true  # 並列実行
```

### 4. 親エージェントが結果を統合・報告

```
親エージェント: "以下の改善を完了しました:
1. Frontend: コンポーネント最適化
2. MCP Server: レスポンス改善
変更されたファイル: ..."
```

## エージェント役割定義

| 役割 | モデル | 作業ディレクトリ | 責任 |
|------|--------|------------------|------|
| vow-spec-architect | Opus | vow/ | 仕様策定、アーキテクチャ、調整 |
| frontend-implementer | Opus | vow/frontend/ | Reactコンポーネント実装 |
| backend-implementer | Opus | vow/backend/ | Lambda/Express実装 |
| mcp-implementer | Opus | ~/.mcp-multi-agent/ | MCPサーバー実装 |
| tester | Opus | vow/ | テスト実行・分析 |
| code-reviewer | Opus | vow/ | コードレビュー |

## 仕様書ステータス

| ステータス | 説明 |
|------------|------|
| `draft` | 作成中 |
| `ready` | 実装待ち |
| `in-progress` | 実装中 |
| `review` | レビュー待ち |
| `done` | 完了 |

## 既存の.kiro/specs/との関係

- `.kiro/specs/`: KIROツール用の仕様書（従来形式）
- `specs/`: Claude Code並列開発用の仕様書（新形式）

両方を並行使用可能。新機能は `specs/` に作成を推奨。
