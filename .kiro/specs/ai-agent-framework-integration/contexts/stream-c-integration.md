# Stream C: Integration Agent - Initial Context

## Agent Role
Integration専門エージェント。RAG Pipeline構築、MCP連携、パフォーマンス最適化、セキュリティ実装を担当。

## Project Context

### Working Directory
`/home/ubuntu/Downloads/vow` (プロジェクトルート)

### Key Existing Files to Understand

1. **Supabase Migrations** (`supabase/migrations/`)
   - 最新: `20260205000000_add_cumulative_workload_to_activities.sql`
   - RLS (Row Level Security) パターンを確認
   - マイグレーション命名規則: `YYYYMMDDHHMMSS_description.sql`

2. **MCP Task Server** (`/home/ubuntu/.mcp-multi-agent/`)
   - VOW外部のMCPサーバー
   - HTTP REST API + SSE
   - 認証: Bearer Token

3. **CLAUDE.md** (プロジェクトルート)
   - MCP Multi-Agent Scale System セクション
   - サーバー設定、接続方法

4. **useMultiAgentServer.ts** (`frontend/app/dashboard/hooks/`)
   - MCP接続の参考実装
   - SSE処理パターン

### Technology Stack
- Supabase (PostgreSQL + pgvector)
- OpenAI Embeddings API
- MCP Protocol
- Express.js middleware

---

## Initial Tasks for Stream C

### C-001: pgvector拡張セットアップ
**Priority**: High (他ストリームと並行可能)
**Dependencies**: None

**Migration File**: `supabase/migrations/20260202000000_add_pgvector_embeddings.sql`

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'habit', 'goal', 'diary', 'activity'
  entity_id UUID NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  content_hash TEXT NOT NULL, -- For detecting content changes
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one embedding per entity
  UNIQUE(user_id, entity_type, entity_id)
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS embeddings_vector_idx
  ON embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for entity lookup
CREATE INDEX IF NOT EXISTS embeddings_entity_idx
  ON embeddings (user_id, entity_type);

-- RLS Policies
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own embeddings
CREATE POLICY embeddings_select_policy ON embeddings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY embeddings_insert_policy ON embeddings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY embeddings_update_policy ON embeddings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY embeddings_delete_policy ON embeddings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to search similar embeddings
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding vector(1536),
  target_user_id UUID,
  target_entity_types TEXT[] DEFAULT NULL,
  match_count INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  entity_id UUID,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.entity_type,
    e.entity_id,
    1 - (e.embedding <=> query_embedding) AS similarity,
    e.metadata
  FROM embeddings e
  WHERE
    e.user_id = target_user_id
    AND (target_entity_types IS NULL OR e.entity_type = ANY(target_entity_types))
    AND 1 - (e.embedding <=> query_embedding) > similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Output Files**:
- `supabase/migrations/20260202000000_add_pgvector_embeddings.sql`

**Verification**:
```bash
cd /home/ubuntu/Downloads/vow
npx supabase db push
```

---

### C-002: Embedding Service基盤作成
**Priority**: High
**Dependencies**: C-001

**`backend/src/services/embedding-service.ts`**:
```typescript
import OpenAI from 'openai';
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('embeddingService');

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10);

export interface EmbeddingEntity {
  type: 'habit' | 'goal' | 'diary' | 'activity';
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export class EmbeddingService {
  private openai: OpenAI;

  constructor(
    private supabase: SupabaseClient,
    openaiApiKey?: string
  ) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate embedding for a single entity
   */
  async generateEmbedding(userId: string, entity: EmbeddingEntity): Promise<void> {
    const contentHash = this.hashContent(entity.content);

    // Check if embedding already exists with same content
    const { data: existing } = await this.supabase
      .from('embeddings')
      .select('content_hash')
      .eq('user_id', userId)
      .eq('entity_type', entity.type)
      .eq('entity_id', entity.id)
      .single();

    if (existing?.content_hash === contentHash) {
      logger.debug('Embedding already up to date', { entityType: entity.type, entityId: entity.id });
      return;
    }

    // Generate embedding via OpenAI
    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: entity.content,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data[0].embedding;

    // Upsert embedding
    await this.supabase
      .from('embeddings')
      .upsert({
        user_id: userId,
        entity_type: entity.type,
        entity_id: entity.id,
        embedding: embedding,
        content_hash: contentHash,
        metadata: entity.metadata || {},
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,entity_type,entity_id',
      });

    logger.info('Embedding generated', { entityType: entity.type, entityId: entity.id });
  }

  /**
   * Search similar content using vector similarity
   */
  async searchSimilar(
    userId: string,
    query: string,
    options: {
      entityTypes?: ('habit' | 'goal' | 'diary' | 'activity')[];
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<Array<{
    entityType: string;
    entityId: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }>> {
    const { entityTypes, limit = 10, threshold = 0.7 } = options;

    // Generate query embedding
    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const queryEmbedding = response.data[0].embedding;

    // Call search function
    const { data, error } = await this.supabase.rpc('search_embeddings', {
      query_embedding: queryEmbedding,
      target_user_id: userId,
      target_entity_types: entityTypes || null,
      match_count: limit,
      similarity_threshold: threshold,
    });

    if (error) {
      logger.error('Search failed', { error });
      throw error;
    }

    return data.map((row: any) => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      similarity: row.similarity,
      metadata: row.metadata,
    }));
  }

  /**
   * Batch update embeddings for all user entities
   */
  async updateUserEmbeddings(userId: string): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;

    // Get habits
    const { data: habits } = await this.supabase
      .from('habits')
      .select('id, name, description')
      .eq('owner_id', userId)
      .eq('active', true);

    for (const habit of habits || []) {
      try {
        await this.generateEmbedding(userId, {
          type: 'habit',
          id: habit.id,
          content: `${habit.name}${habit.description ? ': ' + habit.description : ''}`,
        });
        updated++;
      } catch (e) {
        logger.error('Failed to update habit embedding', { habitId: habit.id, error: e });
        errors++;
      }
    }

    // Get goals
    const { data: goals } = await this.supabase
      .from('goals')
      .select('id, name, description')
      .eq('owner_id', userId);

    for (const goal of goals || []) {
      try {
        await this.generateEmbedding(userId, {
          type: 'goal',
          id: goal.id,
          content: `${goal.name}${goal.description ? ': ' + goal.description : ''}`,
        });
        updated++;
      } catch (e) {
        logger.error('Failed to update goal embedding', { goalId: goal.id, error: e });
        errors++;
      }
    }

    return { updated, errors };
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
```

**Output Files**:
- `backend/src/services/embedding-service.ts`

---

### C-003: Strands MCP Client作成
**Priority**: High
**Dependencies**: B-002

**`backend/src/agents/strands/mcp-client.ts`**:
```typescript
import { getLogger } from '../../utils/logger.js';
import { withRetry } from '../../../lib/agent-tools/error-handler.js';

const logger = getLogger('strandsMcpClient');

export interface McpTask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

export interface McpAgent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'offline';
  machineId: string;
}

export class StrandsMcpClient {
  private baseUrl: string;
  private token: string;
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(serverUrl: string, authToken: string) {
    this.baseUrl = serverUrl.replace(/\/$/, '');
    this.token = authToken;
  }

  /**
   * Connect to SSE for real-time updates
   */
  connectSSE(handlers: {
    onAgent?: (agent: McpAgent) => void;
    onTask?: (task: McpTask) => void;
    onError?: (error: Error) => void;
  }): void {
    const url = `${this.baseUrl}/events`;

    this.eventSource = new EventSource(url, {
      headers: { Authorization: `Bearer ${this.token}` },
    } as any);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'agent_update' && handlers.onAgent) {
          handlers.onAgent(data.agent);
        } else if (data.type === 'task_update' && handlers.onTask) {
          handlers.onTask(data.task);
        }
      } catch (e) {
        logger.error('Failed to parse SSE message', { error: e });
      }
    };

    this.eventSource.onerror = () => {
      this.reconnect(handlers);
    };

    this.reconnectAttempts = 0;
  }

  private reconnect(handlers: Parameters<typeof this.connectSSE>[0]): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      handlers.onError?.(new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    setTimeout(() => {
      this.connectSSE(handlers);
    }, delay);
  }

  /**
   * Get dashboard statistics
   */
  async getDashboard(): Promise<{
    agents: { total: number; idle: number; busy: number; offline: number };
    tasks: { total: number; inProgress: number; completed: number };
  }> {
    return withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) {
        throw new Error(`Dashboard request failed: ${response.status}`);
      }

      return response.json();
    });
  }

  /**
   * Create a new task
   */
  async createTask(task: Omit<McpTask, 'id' | 'status'>): Promise<McpTask> {
    return withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(task),
      });

      if (!response.ok) {
        throw new Error(`Create task failed: ${response.status}`);
      }

      return response.json();
    });
  }

  /**
   * Assign task to agent
   */
  async assignTask(taskId: string, agentId: string): Promise<void> {
    return withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId }),
      });

      if (!response.ok) {
        throw new Error(`Assign task failed: ${response.status}`);
      }
    });
  }

  /**
   * Disconnect SSE
   */
  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}
```

**Output Files**:
- `backend/src/agents/strands/mcp-client.ts`

---

## Coding Guidelines for Stream C

1. **マイグレーション**: 必ずバックアップ可能なSQLを書く
2. **RLS**: すべてのテーブルにRow Level Securityを適用
3. **パフォーマンス**: N+1クエリを避け、バッチ処理を使用
4. **エラーハンドリング**: Stream Bの error-handler を使用

---

## Integration Points

### With Supabase
- pgvector拡張の有効化
- embeddingsテーブル作成
- search_embeddings関数

### With OpenAI
- text-embedding-3-small モデル
- 1536次元ベクトル

### With MCP Task Server
- 既存サーバー: `http://192.168.2.126:3456`
- トークン: `.env.local` から取得

---

## File Conflict Prevention

以下のファイルを修正する場合は注意:
- `supabase/migrations/` - 番号が重複しないように
- `backend/src/routers/ai.ts` - Stream Bも修正予定

---

## Branch Naming
```
feat/ai-agent-framework-stream-c-{task-id}
```
Example: `feat/ai-agent-framework-stream-c-001`

---

## Success Criteria

- [ ] pgvector拡張がSupabaseで有効になる
- [ ] embeddingsテーブルにRLSポリシーが適用されている
- [ ] EmbeddingServiceが埋め込みを生成・検索できる
- [ ] StrandsMcpClientがMCP Task Serverに接続できる
- [ ] SSE再接続が正しく動作する
