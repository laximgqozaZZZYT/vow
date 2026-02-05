# Stream B: Backend Agent - Initial Context

## Agent Role
Backend専門エージェント。Mastra/Strands SDKの統合、エージェント実装、ワークフロー作成、共通ツールライブラリを担当。

## Project Context

### Working Directory
`/home/ubuntu/Downloads/vow/backend`

### Key Existing Files to Understand

1. **aiCoachService.ts** (`src/services/aiCoachService.ts`)
   - 現在のAI Coachサービス (約118KB, 大規模ファイル)
   - OpenAI GPT-4ベースの実装
   - Tool calling 対応済み
   - 移行対象: Mastraエージェントに段階移行

2. **personalizationEngine.ts** (`src/services/personalizationEngine.ts`)
   - ユーザーコンテキスト分析エンジン
   - UserContext型: activeHabits, completionRates, userLevel等
   - Mastraエージェントのコンテキストソースとして使用

3. **guardrailChecker.ts** (`src/services/guardrailChecker.ts`)
   - AIレスポンスのガードレール
   - 有害出力防止
   - Mastraエージェントにも適用必要

4. **usageQuotaService.ts** (`src/services/usageQuotaService.ts`)
   - AI使用量クォータ管理
   - Free: 10回/月, Premium: 無制限
   - Mastraエージェントにも適用必要

5. **ai.ts** (`src/routers/ai.ts`)
   - AI関連APIエンドポイント
   - `/api/ai/chat`, `/api/ai/parse-habit` 等
   - 新エンドポイント追加先

### Technology Stack
- Express.js on AWS Lambda
- TypeScript (strict mode)
- Supabase Client
- Zod for validation

---

## Initial Tasks for Stream B

### B-001: Mastraパッケージインストールと設定
**Priority**: Critical (最初に着手)
**Dependencies**: None

**Steps**:
1. バックエンドにインストール:
   ```bash
   cd /home/ubuntu/Downloads/vow/backend
   npm install @mastra/core
   ```

2. フロントエンドにインストール:
   ```bash
   cd /home/ubuntu/Downloads/vow/frontend
   npm install @mastra/core
   ```

3. `backend/src/agents/mastra/config.ts` 作成:
   ```typescript
   import { Mastra } from '@mastra/core';

   export const mastra = new Mastra({
     providers: {
       openai: {
         apiKey: process.env.MASTRA_OPENAI_API_KEY,
       },
       anthropic: {
         apiKey: process.env.MASTRA_ANTHROPIC_API_KEY,
       },
     },
     defaultModel: process.env.MASTRA_DEFAULT_MODEL || 'gpt-4o',
   });
   ```

4. 環境変数を `.env.local` に追加 (テンプレート):
   ```
   MASTRA_OPENAI_API_KEY=sk-...
   MASTRA_ANTHROPIC_API_KEY=sk-ant-...
   MASTRA_DEFAULT_MODEL=gpt-4o
   ```

**Output Files**:
- `backend/src/agents/mastra/config.ts`
- `backend/src/agents/mastra/index.ts`
- `frontend/lib/mastra/config.ts`
- `frontend/lib/mastra/index.ts`

---

### B-002: Strands Agentsパッケージインストールと設定
**Priority**: Critical (B-001と並行可能)
**Dependencies**: None

**Steps**:
1. バックエンドにインストール:
   ```bash
   cd /home/ubuntu/Downloads/vow/backend
   npm install @strands-agents/sdk
   ```

2. `backend/src/agents/strands/config.ts` 作成:
   ```typescript
   import { Agent } from '@strands-agents/sdk';

   export const strandsConfig = {
     modelProvider: process.env.STRANDS_MODEL_PROVIDER || 'bedrock',
     region: process.env.AWS_REGION || 'ap-northeast-1',
     defaultModel: process.env.STRANDS_DEFAULT_MODEL || 'claude-3-5-sonnet',
   };
   ```

3. TypeScript interfaces (`backend/src/agents/strands/types.ts`):
   ```typescript
   export interface StrandsAgentConfig {
     name: string;
     role: string;
     tools: StrandsTool[];
     systemPrompt: string;
   }

   export interface StrandsTool {
     name: string;
     description: string;
     inputSchema: z.ZodSchema;
     execute: (input: unknown) => Promise<unknown>;
   }
   ```

**Output Files**:
- `backend/src/agents/strands/config.ts`
- `backend/src/agents/strands/types.ts`
- `backend/src/agents/strands/index.ts`

---

### B-003: 共通ツールライブラリ作成
**Priority**: High
**Dependencies**: None (B-001/B-002と並行可能)

**Scope**: habit-tools.ts のみ初期実装

**`frontend/lib/agent-tools/habit-tools.ts`**:
```typescript
import { z } from 'zod';

// Schemas
export const CreateHabitSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['do', 'avoid']),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  goalId: z.string().uuid().optional(),
  triggerTime: z.string().optional(),
  targetCount: z.number().int().positive().default(1),
  workloadUnit: z.string().optional(),
});

// Tools
export const habitTools = {
  createHabit: {
    name: 'create_habit',
    description: 'Create a new habit for the user',
    inputSchema: CreateHabitSchema,
    execute: async (input: z.infer<typeof CreateHabitSchema>, context: ToolContext) => {
      // Implementation using Supabase
    },
  },
  getHabits: {
    name: 'get_habits',
    description: 'Get all habits for the current user',
    inputSchema: z.object({ activeOnly: z.boolean().default(true) }),
    execute: async (input, context) => {
      // Implementation
    },
  },
  analyzeHabits: {
    name: 'analyze_habits',
    description: 'Analyze habit completion patterns for insights',
    inputSchema: z.object({
      period: z.enum(['week', 'month', 'quarter']).default('month')
    }),
    execute: async (input, context) => {
      // Implementation using PersonalizationEngine
    },
  },
};
```

**Output Files**:
- `frontend/lib/agent-tools/index.ts`
- `frontend/lib/agent-tools/habit-tools.ts`
- `frontend/lib/agent-tools/types.ts`

---

### B-004: エラーハンドリング基盤作成
**Priority**: High
**Dependencies**: None

**`frontend/lib/agent-tools/error-handler.ts`**:
```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 16000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: Error;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError!;
}

// Circuit Breaker
export class CircuitBreaker {
  private failures = 0;
  private lastFailure: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeMs: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailure?.getTime() ?? 0) > this.resetTimeMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = new Date();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

**Output Files**:
- `frontend/lib/agent-tools/error-handler.ts`

---

## Coding Guidelines for Stream B

1. **サービスパターン**: 既存の `*Service.ts` パターンに従う
2. **Repository使用**: データアクセスは `repositories/` 経由
3. **ログ出力**: `getLogger()` を使用
4. **エラーハンドリング**: 適切なHTTPステータスコードを返す
5. **Zodバリデーション**: すべての入力をZodでバリデート

---

## Integration Points

### With Existing Services
- `personalizationEngine.ts` - ユーザーコンテキスト取得
- `usageQuotaService.ts` - クォータチェック
- `guardrailChecker.ts` - 出力フィルタリング

### With MCP Task Server
- 既存のMCP Task Server (`/home/ubuntu/.mcp-multi-agent/`)
- Strands MCPClientで接続
- 既存のトークン認証を使用

### With Frontend (Stream A)
- RESTエンドポイント: `/api/ai/agent`
- ストリーミング: Server-Sent Events
- WebSocket (将来的)

---

## File Conflict Prevention

以下のファイルを修正する場合は注意:
- `src/services/aiCoachService.ts` - 段階移行のため直接編集は避ける
- `src/routers/ai.ts` - 新エンドポイントのみ追加

---

## Branch Naming
```
feat/ai-agent-framework-stream-b-{task-id}
```
Example: `feat/ai-agent-framework-stream-b-001`

---

## Success Criteria

- [ ] `@mastra/core` がインポートでき、Mastraインスタンスが作成できる
- [ ] `@strands-agents/sdk` がインポートでき、設定が読み込める
- [ ] habit-tools が Zod バリデーションで動作する
- [ ] withRetry が指数バックオフで正しくリトライする
- [ ] CircuitBreaker が閾値で正しくオープンする
