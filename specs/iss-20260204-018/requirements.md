# Claude Executor Service - Requirements

## Overview
- **Issue ID**: ISS-20260204-018
- **Purpose**: Claude Codeを子プロセスとして実行し、出力をストリーミングで返却するExecutorサービスを実装する。MOCセクションからのリモートタスク実行の基盤となる。
- **Status**: Complete
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect
- **Parent Spec**: MOC MCP Remote Integration (Phase 1, Task 1.1)

---

## Background

MOCセクションへのMCPリモート接続統合の第一歩として、Claude Codeを子プロセスとして実行し、その出力をリアルタイムでストリーミングする機能が必要である。

現在のサーバー（`/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts`）には既にClaude CLI実行機能があるが、これはチャット用途に限定されており、以下の機能が不足している：

1. 長時間実行のタスク対応（30分以上）
2. キャンセル機能
3. ファイル変更の追跡
4. 実行状態の管理
5. 複数タスクの並列実行

---

## Functional Requirements

### FR-001: Claude Code子プロセス実行
Claude Code CLIを子プロセスとして起動し、指定されたプロンプトを実行する。

**Acceptance Criteria:**
- [x] `execute(prompt, options)` メソッドでClaude Codeを起動できる
- [x] 作業ディレクトリを指定できる
- [x] MCP設定ファイルを指定できる
- [x] 環境変数を渡せる

### FR-002: リアルタイム出力ストリーミング
実行中のClaude Codeからの出力（stdout/stderr）をリアルタイムでコールバック経由で受け取れる。

**Acceptance Criteria:**
- [x] stdout出力をリアルタイムでコールバックに渡せる
- [x] stderr出力を分離してコールバックに渡せる
- [x] バッファリングなしで即座にストリーミングされる

### FR-003: タイムアウト処理
長時間実行するタスクに対してタイムアウトを設定できる。

**Acceptance Criteria:**
- [x] デフォルトタイムアウト30分
- [x] タスク単位でタイムアウトをオーバーライド可能
- [x] タイムアウト時にプロセスを適切に終了（SIGTERM -> SIGKILL）

### FR-004: キャンセル機能
実行中のタスクをユーザーの操作でキャンセルできる。

**Acceptance Criteria:**
- [x] `cancel()` メソッドで実行中のプロセスを終了できる
- [x] キャンセル時の状態が `cancelled` に遷移する
- [x] 部分的な出力が保持される

### FR-005: 実行状態管理
各実行の状態を追跡し、問い合わせ可能にする。

**Acceptance Criteria:**
- [x] 状態: pending, running, completed, failed, cancelled, timeout
- [x] 実行開始時刻、終了時刻を記録
- [x] 終了コードを記録
- [x] エラーメッセージを記録

---

## Non-Functional Requirements

### NFR-001: パフォーマンス
- 出力ストリーミングのレイテンシ: 100ms以内
- 同時実行可能タスク数: 最大5

### NFR-002: 信頼性
- プロセス異常終了時の適切なクリーンアップ
- メモリリークなし（長時間稼働対応）

### NFR-003: 可観測性
- 実行開始/終了のログ出力
- エラー時の詳細ログ

---

## Out of Scope

- ファイル変更追跡（Task 3.1で実装）
- Git統合（Phase 2で実装）
- Web UIからの実行トリガー（Task 1.2で実装）

---

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| child_process (Node.js built-in) | - | プロセス生成 |
| uuid | ^11.0.5 | 実行ID生成 |

---

## Agent Coordination Notes

このタスクは単独で完結可能。完了後、以下のタスクが依存：
- Task 1.2: Remote Task API Endpoint
- Task 1.3: Output Streaming Endpoint
