# AI Provider Unification - Architecture Specification

## Overview

- **Purpose**: MCPサーバーとOpenAI API等のAIプロバイダーを統一的に扱える抽象化レイヤーの設計。役割・プロンプトとは完全に分離した「利用可能な生成AI」の選択・切り替え機構
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect

---

## 1. Current State Summary (現状サマリ)

### 1.1 既に完了している基盤

```
[完了] useMastraAgent.ts      -- 削除済み
[完了] vow-coach-agent.ts     -- 削除済み
[完了] /api/agents/chat        -- OpenAI チャットエンドポイント削除済み
[完了] prompt-registry.ts      -- バックエンドにプロンプト統一管理
[完了] /api/prompts/:role      -- プロンプト取得API
[完了] useRolePrompt.ts        -- SWR対応のプロンプト取得hook
[完了] credentials.ts router   -- ユーザー別APIキーCRUD
[完了] credentials-store.ts    -- 暗号化APIキーストレージ
[完了] AIProviderSettings.tsx   -- Settings画面のAPIキー管理UI
[完了] useCredentials.ts        -- Credential管理hook
```

### 1.2 残存する問題

```
[要修正] aiCoachService.ts     -- 3,573行、Mastraデッドコード残存、OpenAI直接結合
[要修正] extractAICandidateResponse -- JSONパース脆弱性
[要廃止] remove-openai-chat-path spec -- 方針矛盾
[未実装] プロバイダー抽象化レイヤー
[未実装] MOCセクションのプロバイダー選択UI
[未実装] /api/ai/provider-chat エンドポイント
```

### 1.3 現在の設計の分離状況

```
┌─────────────────────────────────────────────────────────────────┐
│                     関心事の分離（現状）                          │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │ 役割・プロンプト管理   │  │ AI利用手段                        │ │
│  │                      │  │                                  │ │
│  │ prompt-registry.ts   │  │ useMcpChat.ts (MCPサーバー直接)  │ │
│  │ /api/prompts/:role   │  │ /api/ai/chat (OpenAI直接, legacy)│ │
│  │ useRolePrompt.ts     │  │                                  │ │
│  │ agent_configs table  │  │ ★ 分離はされているが、             │ │
│  │                      │  │   切り替え機構が存在しない         │ │
│  │ ★ 完全に分離済み     │  │                                  │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────┐                                       │
│  │ APIキー管理           │                                       │
│  │                      │                                       │
│  │ credentials-store.ts │                                       │
│  │ /api/credentials     │                                       │
│  │ AIProviderSettings   │                                       │
│  │                      │                                       │
│  │ ★ 保存はできるが、   │                                       │
│  │   MOCから利用不可     │                                       │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Target Architecture (目標アーキテクチャ)

### 2.1 全体設計

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend                                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ Section.MOC.tsx                                                  ││
│  │                                                                  ││
│  │  ┌───────────────────┐  ┌──────────────────────────────────────┐││
│  │  │ useRolePrompt     │  │ useAIProvider (新規)                 │││
│  │  │ ('AICoach', 'ja') │  │                                      │││
│  │  │                   │  │ selectedProvider: 'mcp-xxx' | 'openai'│││
│  │  │ -> systemPrompt   │  │ availableProviders: Provider[]       │││
│  │  │                   │  │ switchProvider(id): void              │││
│  │  │  [独立]           │  │ sendMessage(msg, prompt): Promise     │││
│  │  └───────────────────┘  └──────────────┬───────────────────────┘││
│  │                                        │                        ││
│  │                               ┌────────┴────────┐               ││
│  │                               │ Provider Router  │               ││
│  │                               │ (条件分岐)       │               ││
│  │                               └───┬─────────┬───┘               ││
│  │                                   │         │                    ││
│  │                          ┌────────┘         └──────────┐        ││
│  │                          ▼                              ▼        ││
│  │               ┌─────────────────┐         ┌───────────────────┐ ││
│  │               │ useMcpChat      │         │ useProviderChat   │ ││
│  │               │ (既存、変更なし) │         │ (新規)            │ ││
│  │               │                 │         │                   │ ││
│  │               │ POST -> MCP     │         │ POST -> Backend   │ ││
│  │               │ Server 直接     │         │ /api/ai/provider  │ ││
│  │               │                 │         │ -chat             │ ││
│  │               └─────────────────┘         └─────────┬─────────┘ ││
│  └─────────────────────────────────────────────────────┼───────────┘│
│                                                        │            │
└────────────────────────────────────────────────────────┼────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend                                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ POST /api/ai/provider-chat                                      ││
│  │                                                                  ││
│  │ Request: { message, systemPrompt, provider, model?, sessionId } ││
│  │ Response: SSE stream (同形式: event:token/complete)              ││
│  │                                                                  ││
│  │  ┌──────────────────────────────────────────────────────────┐   ││
│  │  │ AIChatProviderFactory                                    │   ││
│  │  │                                                          │   ││
│  │  │ createProvider(userId, providerType, model?)             │   ││
│  │  │   ├─ 'openai'    -> OpenAIChatProvider                   │   ││
│  │  │   ├─ 'anthropic' -> AnthropicChatProvider (将来)         │   ││
│  │  │   ├─ 'gemini'    -> GeminiChatProvider (将来)            │   ││
│  │  │   └─ 'codex'     -> CodexChatProvider (将来)             │   ││
│  │  │                                                          │   ││
│  │  │ 各プロバイダーは:                                        │   ││
│  │  │   1. credentials-store からユーザーAPIキーを取得          │   ││
│  │  │   2. systemPrompt をプロバイダー固有のAPIに送信           │   ││
│  │  │   3. SSE形式でストリーミング応答を返却                   │   ││
│  │  └──────────────────────────────────────────────────────────┘   ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ prompt-registry.ts   │  │ credentials-store.ts                 │ │
│  │ (変更なし)           │  │ (変更なし)                           │ │
│  │                      │  │                                      │ │
│  │ GET /api/prompts/:r  │  │ GET /api/credentials/:type           │ │
│  └──────────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 設計原則

| 原則 | 説明 |
|------|------|
| **プロンプトとプロバイダーの分離** | `useRolePrompt` はプロバイダー選択と無関係に動作する。同じ `systemPrompt` がどのプロバイダーにも渡される |
| **MCPパスの保護** | `useMcpChat.ts` は変更しない。MCP経由のチャットは引き続きフロントエンドからMCPサーバーに直接POSTする |
| **APIキーの安全性** | APIプロバイダー呼び出しはバックエンド経由。フロントエンドにAPIキーは露出しない |
| **SSEフォーマット統一** | バックエンドの `/api/ai/provider-chat` はMCPサーバーと同じSSEフォーマットでストリームする。フロントエンドのパーサーを再利用可能にする |
| **段階的拡張** | `AIChatProvider` インターフェースを満たす実装を追加するだけで新プロバイダーに対応 |

---

## 3. Phase 1: Refactoring (リファクタリング設計)

### 3.1 aiCoachService.ts クリーンアップ

**現在の状態 (3,573行)**:
```
行 1-65:    Mastra関連スタブとデッドコード定義
行 66-78:   shouldUseMastraCoach() (常にfalse)
行 80-85:   getMigrationMode() (常に'legacy')
行 90-700:  COACH_TOOLS (OpenAI Function Calling ツール定義)
行 700-3573: AICoachService class (OpenAI直接呼び出し)
```

**リファクタリング後**:
```
aiCoachService.ts (クリーン版):
  行 1-15:    インポート (OpenAI, 型定義)
  行 15-600:  COACH_TOOLS 定義 (変更なし)
  行 600-:    AICoachService class (Mastra分岐削除、OpenAI直接呼び出しのみ)
```

削除対象:
- `CoachToolStub`, `CoachTool` 型
- `vowCoachTools` 空配列
- `getVowCoachAgent()` スタブ関数
- `OpenAIToolRegistry` スタブクラス
- `convertCoachToolsToOpenAI()` スタブ関数
- `shouldUseMastraCoach()` 関数
- `getMigrationMode()` 関数
- Mastra分岐を含むすべての `if (shouldUseMastraCoach())` ブロック

### 3.2 extractAICandidateResponse 堅牢化

**現在の実装**:
```typescript
export function extractAICandidateResponse(content: string): AICandidateResponse | null {
  // Pattern 1: ```json ... ``` コードブロック
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    // Pattern 2: 直接JSON
    try {
      const parsed = JSON.parse(content);
      if (isAICandidateResponse(parsed)) return parsed;
    } catch { return null; }
    return null;
  }
  // Parse from code block
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (isAICandidateResponse(parsed)) return parsed;
  } catch { return null; }
  return null;
}
```

**改善後の実装方針**:
```typescript
export function extractAICandidateResponse(content: string): AICandidateResponse | null {
  if (!content || !content.trim()) return null;

  // Pattern 1: ```json ... ``` コードブロック (最優先)
  const jsonBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonBlockMatch) {
    const result = tryParseCandidate(jsonBlockMatch[1]);
    if (result) return result;
  }

  // Pattern 2: コンテンツ全体が JSON
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const result = tryParseCandidate(trimmed);
    if (result) return result;
  }

  // Pattern 3: テキスト中に埋め込まれた JSON オブジェクトを検出
  const jsonObjectMatch = content.match(/(\{[\s\S]*"message"\s*:\s*"[\s\S]*?\})\s*$/);
  if (jsonObjectMatch) {
    const result = tryParseCandidate(jsonObjectMatch[1]);
    if (result) return result;
  }

  // Pattern 4: JSON パース失敗 -- テキスト応答としてフォールバック
  // AIがJSON形式を返さなかった場合、メッセージのみの最小レスポンスを生成
  return createFallbackResponse(content);
}

function tryParseCandidate(jsonStr: string): AICandidateResponse | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (isAICandidateResponse(parsed)) return parsed;
  } catch {
    // JSON parse failed
  }
  return null;
}

function createFallbackResponse(content: string): AICandidateResponse | null {
  // テキストからJSONマーカーや不完全なコードブロックを除去
  const cleanContent = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  if (!cleanContent) return null;

  return {
    message: cleanContent,
    context: { aboutType: null, aboutOperation: null, categories: [] },
    gatheredRequirements: { explicit: {}, inferred: {}, completeness: 0 },
    candidateTypes: { showGoals: false, showHabits: false, showStickies: false, showReplies: false },
    replies: [],
  };
}
```

### 3.3 remove-openai-chat-path spec の obsolete 化

`/home/ubuntu/Downloads/vow/specs/remove-openai-chat-path/architecture.md` の冒頭に以下を追加:

```markdown
> **OBSOLETE**: この仕様は 2026-02-07 に廃止されました。
> Phase 1 (OpenAIチャットパスの削除) は完了済みです。
> ただし Phase 2 (OpenAI APIの完全排除) は方針変更により撤回されました。
> 新しい方針: `specs/ai-provider-unification/` を参照してください。
> OpenAI API は「削除」ではなく「選択可能なプロバイダー」として統合されます。
```

---

## 4. Phase 2: Provider Abstraction Layer (プロバイダー抽象化レイヤー)

### 4.1 インターフェース定義

```typescript
// backend/src/providers/types.ts

/**
 * ストリーミングチャットのチャンク
 * MCPサーバーのSSEフォーマットと互換
 */
export interface ChatChunk {
  type: 'token' | 'complete' | 'error' | 'session';
  token?: string;           // type='token' の場合のテキスト断片
  content?: string;         // type='complete' の場合の全文
  error?: string;           // type='error' の場合のエラーメッセージ
  sessionId?: string;       // type='session' の場合のセッションID
  toolCalls?: ToolCallResult[]; // type='complete' の場合のツール呼び出し結果
}

/**
 * チャットメッセージ
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * チャットオプション
 */
export interface ChatOptions {
  model?: string;           // 使用するモデル (指定なしの場合はデフォルト)
  temperature?: number;     // 0-2
  maxTokens?: number;
  sessionId?: string;
  userId?: string;
}

/**
 * プロバイダー情報
 */
export interface ProviderInfo {
  id: string;               // 'openai', 'anthropic', 'gemini', 'codex'
  name: string;             // 表示名
  nameJa: string;           // 日本語表示名
  isAvailable: boolean;     // 利用可能か
  currentModel: string;     // 使用中のモデル
  supportedModels: string[];// サポートモデル一覧
}

/**
 * AIチャットプロバイダーインターフェース
 */
export interface AIChatProvider {
  /** プロバイダー情報を返す */
  getProviderInfo(): ProviderInfo;

  /** プロバイダーが利用可能かチェック */
  isAvailable(): Promise<boolean>;

  /**
   * ストリーミングチャット
   * AsyncGeneratorでチャンクを返す
   */
  chat(
    messages: ChatMessage[],
    systemPrompt: string,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown>;
}
```

### 4.2 OpenAI プロバイダー実装

```typescript
// backend/src/providers/openai-provider.ts

import OpenAI from 'openai';
import { getCredentialsStore } from '../services/credentials-store.js';
import type { AIChatProvider, ChatChunk, ChatMessage, ChatOptions, ProviderInfo } from './types.js';

export class OpenAIChatProvider implements AIChatProvider {
  private userId: string;
  private model: string;

  constructor(userId: string, model?: string) {
    this.userId = userId;
    this.model = model || 'gpt-4o';
  }

  getProviderInfo(): ProviderInfo {
    return {
      id: 'openai',
      name: 'OpenAI',
      nameJa: 'OpenAI',
      isAvailable: false, // Will be checked by isAvailable()
      currentModel: this.model,
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    };
  }

  async isAvailable(): Promise<boolean> {
    const store = getCredentialsStore();
    const apiKey = await store.getApiKey(this.userId, 'openai');
    return apiKey !== null;
  }

  async *chat(
    messages: ChatMessage[],
    systemPrompt: string,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    const store = getCredentialsStore();
    const apiKey = await store.getApiKey(this.userId, 'openai');
    if (!apiKey) {
      yield { type: 'error', error: 'OpenAI APIキーが設定されていません' };
      return;
    }

    const client = new OpenAI({ apiKey });

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // セッション開始
    const sessionId = options?.sessionId || `openai-${Date.now()}`;
    yield { type: 'session', sessionId };

    const stream = await client.chat.completions.create({
      model: options?.model || this.model,
      messages: openaiMessages,
      stream: true,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
    });

    let fullContent = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        fullContent += delta.content;
        yield { type: 'token', token: delta.content };
      }
    }

    yield {
      type: 'complete',
      content: fullContent,
      sessionId,
    };
  }
}
```

### 4.3 プロバイダーファクトリー

```typescript
// backend/src/providers/provider-factory.ts

import type { AIChatProvider } from './types.js';
import { OpenAIChatProvider } from './openai-provider.js';

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'codex';

export function createProvider(
  userId: string,
  providerType: ProviderType,
  model?: string,
): AIChatProvider {
  switch (providerType) {
    case 'openai':
      return new OpenAIChatProvider(userId, model);
    // 将来追加:
    // case 'anthropic':
    //   return new AnthropicChatProvider(userId, model);
    // case 'gemini':
    //   return new GeminiChatProvider(userId, model);
    default:
      throw new Error(`Unsupported provider: ${providerType}`);
  }
}
```

### 4.4 Provider Chat API エンドポイント

```typescript
// backend/src/routers/providerChat.ts

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AuthContext } from '../middleware/auth.js';
import { createProvider, type ProviderType } from '../providers/provider-factory.js';
import { getTokenManager } from '../services/tokenManager.js';

const ProviderChatSchema = z.object({
  message: z.string().min(1).max(10000),
  systemPrompt: z.string().min(1),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'codex']),
  model: z.string().optional(),
  sessionId: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

const providerChatRouter = new Hono<{ Variables: AuthContext }>();

/**
 * POST /api/ai/provider-chat
 *
 * SSE ストリーミングチャット。
 * フロントエンドから systemPrompt を受け取り、
 * 指定されたプロバイダーでチャットを実行する。
 *
 * SSEフォーマットは MCP サーバーと同一:
 *   event: session  data: {"sessionId": "..."}
 *   event: token    data: {"token": "..."}
 *   event: complete data: {"content": "...", "sessionId": "..."}
 */
providerChatRouter.post(
  '/provider-chat',
  zValidator('json', ProviderChatSchema),
  async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = c.req.valid('json' as never) as z.infer<typeof ProviderChatSchema>;
    const userId = user.sub;

    // Create provider
    const provider = createProvider(
      userId,
      body.provider as ProviderType,
      body.model,
    );

    // Check availability
    const available = await provider.isAvailable();
    if (!available) {
      return c.json({
        error: 'PROVIDER_NOT_AVAILABLE',
        message: `${body.provider} のAPIキーが設定されていません。Settings > AI設定で登録してください。`,
      }, 400);
    }

    // Build messages
    const messages = [
      ...(body.conversationHistory || []),
      { role: 'user' as const, content: body.message },
    ];

    // Stream response as SSE
    return streamSSE(c, async (stream) => {
      try {
        const chatStream = provider.chat(messages, body.systemPrompt, {
          model: body.model,
          sessionId: body.sessionId,
          userId,
        });

        for await (const chunk of chatStream) {
          await stream.writeSSE({
            event: chunk.type,
            data: JSON.stringify(chunk),
          });
        }

        await stream.writeSSE({ data: '[DONE]' });
      } catch (error) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        });
      }
    });
  },
);

export { providerChatRouter };
```

### 4.5 フロントエンド: useAIProvider hook

```typescript
// frontend/app/dashboard/hooks/useAIProvider.ts

/**
 * useAIProvider - AIプロバイダーの選択と管理
 *
 * - 利用可能なプロバイダー一覧を構築（MCP接続 + 登録済みAPIキー）
 * - プロバイダー選択状態を管理（localStorageで永続化）
 * - プロバイダー経由のチャット送信を提供
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMultiAgentServerContext } from '../contexts/MultiAgentServerContext';
import type { McpServer } from '../types/agent.types';

export type ProviderSource = 'mcp' | 'api';

export interface AIProviderOption {
  id: string;               // 'mcp-{serverId}' or 'api-openai'
  source: ProviderSource;
  name: string;
  nameJa: string;
  isAvailable: boolean;
  model?: string;
  mcpServer?: McpServer;    // MCP の場合のみ
  apiProvider?: string;     // API の場合: 'openai', 'anthropic' 等
}

const STORAGE_KEY = 'vow_selected_provider';

export function useAIProvider(authToken: string | null) {
  const { server } = useMultiAgentServerContext();
  const [selectedProviderId, setSelectedProviderId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEY) || '';
  });

  // API プロバイダーの登録状況を取得
  const [apiProviders, setApiProviders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authToken) return;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
    const providers = ['openai', 'anthropic', 'gemini', 'codex'];

    Promise.all(
      providers.map(async (p) => {
        try {
          const res = await fetch(`${backendUrl}/api/credentials/${p}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            return [p, data.exists] as [string, boolean];
          }
        } catch { /* ignore */ }
        return [p, false] as [string, boolean];
      })
    ).then(results => {
      setApiProviders(Object.fromEntries(results));
    });
  }, [authToken]);

  // 利用可能なプロバイダー一覧を構築
  const availableProviders: AIProviderOption[] = useMemo(() => {
    const options: AIProviderOption[] = [];

    // MCP 接続済みサーバー
    const connections = Array.from(server.connections.values());
    connections.forEach(conn => {
      if (conn.connectionState === 'connected') {
        options.push({
          id: `mcp-${conn.id}`,
          source: 'mcp',
          name: conn.name || 'MCP Server',
          nameJa: conn.name || 'MCPサーバー',
          isAvailable: true,
          mcpServer: conn as unknown as McpServer,
        });
      }
    });

    // API プロバイダー
    const providerNames: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic Claude',
      gemini: 'Google Gemini',
      codex: 'OpenAI Codex/o',
    };

    Object.entries(apiProviders).forEach(([provider, exists]) => {
      if (exists) {
        options.push({
          id: `api-${provider}`,
          source: 'api',
          name: providerNames[provider] || provider,
          nameJa: providerNames[provider] || provider,
          isAvailable: true,
          apiProvider: provider,
        });
      }
    });

    return options;
  }, [server.connections, apiProviders]);

  // 選択中のプロバイダー
  const selectedProvider = useMemo(() => {
    return availableProviders.find(p => p.id === selectedProviderId) || availableProviders[0] || null;
  }, [availableProviders, selectedProviderId]);

  const switchProvider = useCallback((id: string) => {
    setSelectedProviderId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  return {
    availableProviders,
    selectedProvider,
    switchProvider,
    isMcp: selectedProvider?.source === 'mcp',
    isApiProvider: selectedProvider?.source === 'api',
  };
}
```

### 4.6 フロントエンド: useProviderChat hook

```typescript
// frontend/app/dashboard/hooks/useProviderChat.ts

/**
 * useProviderChat - APIプロバイダー経由のチャットhook
 *
 * バックエンドの /api/ai/provider-chat エンドポイントに対して
 * SSEストリーミングリクエストを送信する。
 *
 * SSEパーサーは useMcpChat と同じフォーマットを期待するため、
 * パーサーロジックを共有可能。
 *
 * インターフェースは UseMastraAgentReturn に準拠し、
 * useMcpChat と同じ形式で利用できる。
 */

import { useState, useCallback, useRef } from 'react';
import type { MastraMessage, UseMastraAgentReturn } from './useMcpChat';

export interface UseProviderChatOptions {
  authToken: string | null;
  provider: string;        // 'openai', 'anthropic', etc.
  model?: string;
  systemMessage?: string;
  userId?: string;
  onMessage?: (message: MastraMessage) => void;
  onError?: (error: Error) => void;
}

export function useProviderChat(options: UseProviderChatOptions): UseMastraAgentReturn {
  // ... SSEストリーミング実装
  // useMcpChat の sendMessage と同じSSEパーサーを使用
  // バックエンドURL: /api/ai/provider-chat
}
```

### 4.7 Section.MOC.tsx の変更 (最小限)

```tsx
// Section.MOC.tsx の変更箇所

// 新規import
import { useAIProvider } from '../hooks/useAIProvider';
import { useProviderChat } from '../hooks/useProviderChat';

// hook 使用箇所
const {
  availableProviders,
  selectedProvider,
  switchProvider,
  isMcp,
} = useAIProvider(authToken);

// MCP チャット (既存、変更なし)
const mcpChat = useMcpChat({
  server: selectedProvider?.mcpServer || selectedMcpServer,
  agentId: selectedMcpAgentId,
  settings: server.chatAgentSettings,
  enableStreaming: true,
  systemMessage: aiCoachSystemPrompt,
  userId: userId,
});

// API プロバイダーチャット (新規)
const providerChat = useProviderChat({
  authToken,
  provider: selectedProvider?.apiProvider || 'openai',
  model: selectedProvider?.model,
  systemMessage: aiCoachSystemPrompt, // 同じプロンプトを使用
  userId,
});

// アクティブなチャットエージェント (プロバイダーに応じて切替)
const activeAgent = isMcp ? mcpChat : providerChat;

// UI にプロバイダーセレクターを追加 (チャット入力エリア上部)
// {availableProviders.map(p => (
//   <button onClick={() => switchProvider(p.id)}>
//     {p.nameJa}
//   </button>
// ))}
```

---

## 5. Data Flow Diagrams (データフロー図)

### 5.1 MCP経由チャット (変更なし)

```
User Input
  │
  ▼
Section.MOC.tsx
  │
  ├─ useRolePrompt('AICoach') ──────────────────────► Backend
  │   (SWR cached)                                    GET /api/prompts/AICoach
  │   <- systemPrompt                                 <- { systemPrompt, hash }
  │
  └─ useMcpChat({ server, systemMessage }) ─────────► MCP Server
      POST /agents/{agentId}/chat                     (Claude CLI 等)
      body: { message, sessionId, systemPrompt }
      <- SSE: event:token data:{token:"..."}
      <- SSE: event:complete data:{content:"..."}
      │
      ▼
  extractAICandidateResponse(content) ──► AICandidateResponse
  │                                        │
  ▼                                        ▼
  ChatMessageBubble                    CandidateDisplay
```

### 5.2 APIプロバイダー経由チャット (Phase 2 新規)

```
User Input
  │
  ▼
Section.MOC.tsx
  │
  ├─ useRolePrompt('AICoach') ──────────────────────► Backend
  │   (SWR cached, 同じ)                              GET /api/prompts/AICoach
  │   <- systemPrompt                                 <- { systemPrompt, hash }
  │
  └─ useProviderChat({ provider:'openai', systemMessage })
      │
      ▼
  POST /api/ai/provider-chat ──────────────────────► Backend
  body: { message, systemPrompt, provider:'openai',   │
          sessionId, conversationHistory }             ├─ credentials-store.getApiKey(userId,'openai')
                                                       │   <- apiKey
  <- SSE: event:session data:{sessionId:"..."}         │
  <- SSE: event:token   data:{token:"..."}             ├─ OpenAIChatProvider.chat(messages, systemPrompt)
  <- SSE: event:complete data:{content:"..."}          │   <- OpenAI API (ストリーミング)
                                                       │
      │                                                └─ tokenManager.recordUsage(userId)
      ▼
  extractAICandidateResponse(content) ──► AICandidateResponse
  │                                        │
  ▼                                        ▼
  ChatMessageBubble                    CandidateDisplay
```

---

## 6. File Structure (ファイル構成)

### Phase 1 変更ファイル

```
backend/src/
  services/
    aiCoachService.ts                    [修正] Mastraデッドコード削除

frontend/app/dashboard/
  types/
    ai-candidate-response.ts            [修正] extractAICandidateResponse 堅牢化

specs/
  remove-openai-chat-path/
    architecture.md                     [修正] OBSOLETE マーク追加
```

### Phase 2 新規・変更ファイル

```
backend/src/
  providers/                            [新規ディレクトリ]
    types.ts                            [新規] AIChatProvider インターフェース
    openai-provider.ts                  [新規] OpenAI プロバイダー実装
    provider-factory.ts                 [新規] プロバイダーファクトリー
    index.ts                            [新規] エクスポート
  routers/
    providerChat.ts                     [新規] /api/ai/provider-chat エンドポイント
    ai.ts                               [修正] providerChatRouter をマウント

frontend/app/dashboard/
  hooks/
    useAIProvider.ts                    [新規] プロバイダー選択管理
    useProviderChat.ts                  [新規] APIプロバイダーチャットhook
  components/
    Section.MOC.tsx                     [修正] プロバイダーセレクター追加
    Chat.ProviderSelector.tsx           [新規] プロバイダー選択UIコンポーネント
```

---

## 7. SSE Format Specification (SSEフォーマット仕様)

### 7.1 統一SSEフォーマット

MCP サーバーとバックエンドの `/api/ai/provider-chat` は同じフォーマットを使用する。

```
// セッション開始
event: session
data: {"type":"session","sessionId":"openai-1707300000000"}

// テキスト断片 (ストリーミング中に複数回)
event: token
data: {"type":"token","token":"こんにちは"}

event: token
data: {"type":"token","token":"、習慣"}

event: token
data: {"type":"token","token":"のお手伝いをします。"}

// 完了
event: complete
data: {"type":"complete","content":"こんにちは、習慣のお手伝いをします。","sessionId":"openai-1707300000000"}

// 終了マーカー
data: [DONE]
```

### 7.2 エラー時

```
event: error
data: {"type":"error","error":"OpenAI APIキーが設定されていません"}
```

---

## 8. Security Considerations (セキュリティ考慮)

| 項目 | 対策 |
|------|------|
| APIキー保護 | フロントエンドにAPIキーは一切露出しない。`/api/ai/provider-chat` でバックエンドが仲介 |
| systemPrompt 送信 | フロントエンドからバックエンドにsystemPromptを送信する形（MCPと同様）。バックエンド内のPrompt Registryから取得する方式にもできるが、`useRolePrompt`の既存パターンに合わせてフロントエンドから送信する |
| 入力バリデーション | `zValidator` による入力スキーマ検証。`message` は最大10,000文字 |
| 認証 | `/api/ai/provider-chat` は Bearer token 必須。`user.sub` でユーザー識別 |
| トークン計測 | `tokenManager` でAPI利用量を記録（課金・クォータ管理） |

---

## 9. Agent Coordination Notes (エージェント調整ノート)

### 担当分離

| タスク | Phase | 推奨担当 | 依存 |
|--------|-------|---------|------|
| aiCoachService.ts デッドコード削除 | 1 | backend-implementer | なし |
| extractAICandidateResponse 堅牢化 | 1 | frontend-implementer | なし |
| remove-openai-chat-path obsolete化 | 1 | any | なし |
| `AIChatProvider` インターフェース定義 | 2 | backend-implementer | Phase 1 完了 |
| OpenAIChatProvider 実装 | 2 | backend-implementer | インターフェース |
| provider-factory.ts | 2 | backend-implementer | OpenAIChatProvider |
| /api/ai/provider-chat エンドポイント | 2 | backend-implementer | provider-factory |
| useAIProvider hook | 2 | frontend-implementer | なし (並行可) |
| useProviderChat hook | 2 | frontend-implementer | provider-chat API |
| Chat.ProviderSelector.tsx | 2 | frontend-implementer | useAIProvider |
| Section.MOC.tsx 統合 | 2 | frontend-implementer | 全hook完了 |
| テスト作成 | 1,2 | tester | 各タスク完了後 |

### 並行作業ガイド

- Phase 1 の2つのタスク (aiCoachService と extractAICandidateResponse) は並行実施可能
- Phase 2 のバックエンド (providers/ + router) とフロントエンド (hooks/) は一部並行実施可能
  - `useAIProvider` は Credential API のみに依存するため先行して作成可能
  - `useProviderChat` は `/api/ai/provider-chat` が必要
- `Section.MOC.tsx` の統合は最後に実施

### 注意事項

- `useMcpChat.ts` への変更は一切行わない。MCP経由のチャットパスは保護する
- `useRolePrompt.ts` への変更は不要。プロンプトはプロバイダー非依存
- `credentials-store.ts` への変更は不要。既存の API で十分
- `prompt-registry.ts` への変更は不要。既存の API で十分
- `aiCoachService.ts` の `/api/ai/chat` エンドポイントは Phase 2 でも残す（Function Calling ベースの別経路として）。ただし将来的にはプロバイダー抽象化に統合を検討
