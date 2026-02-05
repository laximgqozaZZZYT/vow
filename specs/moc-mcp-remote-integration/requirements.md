# MOC Section MCP Remote Integration - Requirements

## Overview
- Purpose: VOW MOCセクションへのMCPリモート接続統合要件定義
- Status: Draft
- Version: 1.0.0
- Last Updated: 2026-02-03
- Author: vow-spec-architect

---

## Functional Requirements

### FR-001: Remote Task Creation
ユーザーはMOCセクションからリモートClaude Codeエージェントに対してタスクを作成・送信できる。

**Acceptance Criteria:**
- [ ] タスク入力フォームがMOCセクションに表示される
- [ ] タイトル、説明、優先度を指定できる
- [ ] 対象ファイル/ディレクトリを選択できる
- [ ] .kiro/specs/ からスペック参照を選択できる
- [ ] 送信後、タスクIDが発行される

### FR-002: Agent Selection and Assignment
タスクは利用可能なClaude Codeエージェントに自動または手動で割り当てられる。

**Acceptance Criteria:**
- [ ] 接続済みエージェント一覧が表示される
- [ ] 各エージェントの状態（idle/busy/offline）が分かる
- [ ] 自動割り当て（ロードバランシング）がデフォルト
- [ ] 手動でエージェント指定も可能

### FR-003: Real-time Execution Monitoring
タスク実行中の進捗をリアルタイムで監視できる。

**Acceptance Criteria:**
- [ ] 実行開始/終了がリアルタイム通知される
- [ ] Claude Codeの出力がストリーミング表示される
- [ ] ファイル変更がリアルタイムで通知される
- [ ] 実行をキャンセルできる

### FR-004: Code Review Interface
タスク完了後、変更されたコードをレビューできる。

**Acceptance Criteria:**
- [ ] 変更ファイル一覧が表示される
- [ ] 各ファイルの差分がdiff形式で表示される
- [ ] 承認/却下/修正リクエストのアクションが可能
- [ ] 修正リクエスト時に追加プロンプトを入力できる

### FR-005: Git Integration
タスク結果をGitリポジトリに反映できる。

**Acceptance Criteria:**
- [ ] タスク開始時に自動でブランチが作成される
- [ ] 承認後、変更が自動コミットされる
- [ ] オプションでPRが自動作成される
- [ ] コミットメッセージにタスクID参照が含まれる

### FR-006: Task History and Audit
過去のタスク実行履歴を参照できる。

**Acceptance Criteria:**
- [ ] 過去のタスク一覧が表示される
- [ ] 各タスクの実行結果、変更ファイルを参照可能
- [ ] フィルタ・検索機能
- [ ] 実行時間、成功率などの統計

---

## Non-Functional Requirements

### NFR-001: Performance
- タスク送信から実行開始まで5秒以内
- 出力ストリーミングの遅延は1秒以内
- 同時に10タスクまで実行可能

### NFR-002: Reliability
- MCPサーバ接続断時のリトライ（最大3回、exponential backoff）
- タスク失敗時の状態保全（部分結果の保存）
- エージェントオフライン時の自動再割り当て

### NFR-003: Security
- 認証: Supabase JWTトークン + MCPサーバトークン
- 実行環境: プロジェクトディレクトリ内に限定
- 監査: 全タスク実行をログ記録

### NFR-004: Usability
- タスク入力はマークダウン対応
- キーボードショートカット（Ctrl+Enter で送信）
- モバイル対応（タブレット以上）

### NFR-005: Scalability
- エージェント数: 最大20
- タスクキュー: 最大100保留タスク
- 履歴保持: 最新1000タスク

---

## Technical Constraints

### TC-001: Existing Infrastructure
- MCP Task Server (`/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/`)
- VOW Frontend (Next.js 16, React 19)
- VOW Backend (TypeScript Lambda)

### TC-002: Claude Code Requirements
- Claude Code CLI がエージェントマシンにインストール済み
- `claude --mcp-config` での起動が可能
- 環境変数 `TASK_SERVER_URL`, `TASK_SERVER_TOKEN` が設定済み

### TC-003: Network Requirements
- MCP Task Server: port 3456
- CORS: VOW Frontendからのアクセス許可
- SSE: 長時間接続をサポート

---

## Dependencies

| Component | Version | Purpose |
|-----------|---------|---------|
| @modelcontextprotocol/sdk | ^1.0.0 | MCP protocol implementation |
| express | ^4.18.0 | HTTP server |
| uuid | ^9.0.0 | ID generation |
| simple-git | ^3.20.0 | Git operations |
| chokidar | ^3.5.0 | File watching |

---

## Out of Scope

- VOWプロジェクト外のリポジトリへのアクセス
- 複数プロジェクト間のタスク連携
- エージェントのリモートプロビジョニング
- Kubernetes/Dockerでのエージェントスケーリング
