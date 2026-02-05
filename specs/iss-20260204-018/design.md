# Claude Executor Service - Technical Design

## Overview
- **Issue ID**: ISS-20260204-018
- **Purpose**: Claude Executor Serviceの技術設計書
- **Status**: Complete
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MCP Task Server                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Claude Executor Service                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │   execute()  │  │   cancel()   │  │  getStatus() │       │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │    │
│  │         │                 │                 │                │    │
│  │         ▼                 ▼                 ▼                │    │
│  │  ┌──────────────────────────────────────────────────────┐   │    │
│  │  │              Execution Manager                        │   │    │
│  │  │  - Map<executionId, ExecutionContext>                │   │    │
│  │  │  - spawn/kill child processes                        │   │    │
│  │  │  - timeout management                                │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   child_process.spawn                        │    │
│  │                      Claude CLI                              │    │
│  │                  (/home/ubuntu/.nvm/.../claude)              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### ExecutionOptions

```typescript
interface ExecutionOptions {
  /** 実行ID（指定しない場合は自動生成） */
  executionId?: string;

  /** 作業ディレクトリ（デフォルト: /home/ubuntu/Downloads/vow） */
  workingDirectory?: string;

  /** MCP設定ファイルパス */
  mcpConfigPath?: string;

  /** タイムアウト（ミリ秒、デフォルト: 1800000 = 30分） */
  timeout?: number;

  /** 追加の環境変数 */
  env?: Record<string, string>;

  /** stdout出力コールバック */
  onStdout?: (data: string) => void;

  /** stderr出力コールバック */
  onStderr?: (data: string) => void;

  /** 状態変更コールバック */
  onStateChange?: (state: ExecutionState) => void;
}
```

### ExecutionState

```typescript
type ExecutionStatus =
  | 'pending'    // 実行準備中
  | 'running'    // 実行中
  | 'completed'  // 正常完了
  | 'failed'     // エラー終了
  | 'cancelled'  // ユーザーキャンセル
  | 'timeout';   // タイムアウト

interface ExecutionState {
  executionId: string;
  status: ExecutionStatus;
  prompt: string;
  workingDirectory: string;

  /** stdout全出力 */
  stdout: string;

  /** stderr全出力 */
  stderr: string;

  /** 終了コード（プロセス終了後に設定） */
  exitCode?: number;

  /** エラーメッセージ */
  error?: string;

  /** 開始時刻 */
  startedAt?: Date;

  /** 終了時刻 */
  finishedAt?: Date;

  /** 実行時間（ミリ秒） */
  duration?: number;
}
```

### ExecutionContext (内部用)

```typescript
interface ExecutionContext {
  state: ExecutionState;
  process: ChildProcess | null;
  timeoutId: NodeJS.Timeout | null;
  options: ExecutionOptions;
}
```

---

## Class Design

### ClaudeExecutor

```typescript
class ClaudeExecutor {
  private executions: Map<string, ExecutionContext>;
  private readonly claudeCliPath: string;
  private readonly defaultWorkingDirectory: string;
  private readonly defaultTimeout: number;
  private readonly maxConcurrent: number;

  constructor(options?: ClaudeExecutorOptions);

  /**
   * Claude Codeを実行
   * @param prompt 実行するプロンプト
   * @param options 実行オプション
   * @returns 実行状態
   */
  async execute(prompt: string, options?: ExecutionOptions): Promise<ExecutionState>;

  /**
   * 実行をキャンセル
   * @param executionId 実行ID
   * @returns キャンセル成功/失敗
   */
  cancel(executionId: string): boolean;

  /**
   * 実行状態を取得
   * @param executionId 実行ID
   * @returns 実行状態（存在しない場合はundefined）
   */
  getStatus(executionId: string): ExecutionState | undefined;

  /**
   * 全実行の一覧を取得
   */
  listExecutions(): ExecutionState[];

  /**
   * アクティブな実行数を取得
   */
  getActiveCount(): number;
}
```

---

## Implementation Details

### 1. プロセス起動

```typescript
private spawnClaude(prompt: string, options: ExecutionOptions): ChildProcess {
  const args = ['--print'];

  if (options.mcpConfigPath) {
    args.push('--mcp-config', options.mcpConfigPath);
  }

  const childProcess = spawn(this.claudeCliPath, args, {
    cwd: options.workingDirectory || this.defaultWorkingDirectory,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env: {
      ...process.env,
      ...options.env,
      PATH: process.env.PATH || '/home/ubuntu/.nvm/versions/node/v22.18.0/bin:/usr/local/bin:/usr/bin:/bin',
    },
  });

  // プロンプトをstdinに書き込み
  childProcess.stdin?.write(prompt);
  childProcess.stdin?.end();

  return childProcess;
}
```

### 2. タイムアウト処理

```typescript
private setupTimeout(ctx: ExecutionContext): void {
  const timeout = ctx.options.timeout || this.defaultTimeout;

  ctx.timeoutId = setTimeout(() => {
    if (ctx.state.status === 'running') {
      console.log(`[ClaudeExecutor] Execution ${ctx.state.executionId} timed out after ${timeout}ms`);

      // SIGTERM で優しく終了を試みる
      ctx.process?.kill('SIGTERM');

      // 5秒後にまだ生きていたらSIGKILL
      setTimeout(() => {
        if (ctx.process && !ctx.process.killed) {
          ctx.process.kill('SIGKILL');
        }
      }, 5000);

      this.updateState(ctx, {
        status: 'timeout',
        error: `Execution timed out after ${timeout}ms`,
        finishedAt: new Date(),
      });
    }
  }, timeout);
}
```

### 3. キャンセル処理

```typescript
cancel(executionId: string): boolean {
  const ctx = this.executions.get(executionId);

  if (!ctx || ctx.state.status !== 'running') {
    return false;
  }

  // タイムアウトをクリア
  if (ctx.timeoutId) {
    clearTimeout(ctx.timeoutId);
    ctx.timeoutId = null;
  }

  // プロセスを終了
  ctx.process?.kill('SIGTERM');

  this.updateState(ctx, {
    status: 'cancelled',
    finishedAt: new Date(),
  });

  return true;
}
```

### 4. 出力ストリーミング

```typescript
private setupStreaming(ctx: ExecutionContext): void {
  const { process, options, state } = ctx;

  process?.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    state.stdout += text;
    options.onStdout?.(text);
  });

  process?.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    state.stderr += text;
    options.onStderr?.(text);
  });

  process?.on('close', (code: number | null) => {
    this.handleProcessClose(ctx, code);
  });

  process?.on('error', (err: Error) => {
    this.handleProcessError(ctx, err);
  });
}
```

---

## File Structure

```
/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/
├── claude-executor.ts    # 新規作成: ClaudeExecutor クラス
├── types.ts              # 拡張: ExecutionOptions, ExecutionState 追加
├── server.ts             # 既存（将来的にTask 1.2で統合）
└── index.ts              # 既存
```

---

## Error Handling

| エラーケース | 対応 |
|-------------|------|
| Claude CLIが見つからない | ENOENT エラーをキャッチし、明確なエラーメッセージを返す |
| プロンプトが空 | execute() 開始時にバリデーションエラー |
| 同時実行数超過 | エラーを返すか、キューイング（将来拡張） |
| プロセス異常終了 | exit code と stderr を記録、status を 'failed' に |
| タイムアウト | SIGTERM -> SIGKILL の段階的終了 |

---

## Testing Strategy

### Unit Tests

1. **正常実行テスト**: 簡単なプロンプトで正常終了を確認
2. **タイムアウトテスト**: 短いタイムアウトで timeout 状態を確認
3. **キャンセルテスト**: 実行中のキャンセルを確認
4. **並列実行テスト**: 複数同時実行の動作確認

### Integration Tests

1. 実際のClaude CLIを使用した統合テスト（CI環境では Skip）

---

## Migration Notes

既存の `server.ts` 内のClaude CLI実行コードとは独立したモジュールとして実装。
将来的に Task 1.2 で server.ts から ClaudeExecutor を利用するように統合予定。
