# AI Provider Unification - Implementation Tasks

## Overview

- **Purpose**: リファクタリング (Phase 1) と AIプロバイダー統合 (Phase 2) の実装タスク一覧
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect

---

## Phase 1: Refactoring (リファクタリング) -- 推定: 4-6h

> **注意**: Phase 1 は Phase 2 の前提条件。Phase 1 完了前に Phase 2 に着手しないこと。

### Task 1.1: aiCoachService.ts デッドコード削除

- **担当**: backend-implementer
- **前提条件**: なし
- **推定工数**: 2h
- **並行可能**: Task 1.2, Task 1.3 と並行可

#### 作業内容

1. `/home/ubuntu/Downloads/vow/backend/src/services/aiCoachService.ts` を開く
2. 以下のデッドコードを削除:
   - `CoachToolStub` インターフェース (行 45-51)
   - `CoachTool` 型エイリアス (行 52)
   - `vowCoachTools` 空配列 (行 53)
   - `getVowCoachAgent()` スタブ関数 (行 54-56)
   - `OpenAIToolRegistry` スタブクラス (行 57-61)
   - `convertCoachToolsToOpenAI()` スタブ関数 (行 62-64)
   - `shouldUseMastraCoach()` 関数 (行 76-78)
   - `getMigrationMode()` 関数 (行 83-85)
   - ファイル全体で `shouldUseMastraCoach()` を参照するすべての if 分岐と dead code paths
   - Mastra 関連のコメント (`=== MIGRATION NOTE ===` 等)
3. 不要になったインポートを削除
4. ファイル冒頭のドキュメントコメントを更新（Mastra関連の記述を除去）

#### 検証

```bash
cd /home/ubuntu/Downloads/vow/backend && npx tsc --noEmit
grep -r "mastra\|Mastra\|VowCoach\|shouldUseMastra\|CoachToolStub\|getMigrationMode" src/services/aiCoachService.ts
# 上記grepの結果が空であること
```

- [ ] TypeScript コンパイルが通過
- [ ] Mastra 関連のコードが残っていない
- [ ] 既存の `/api/ai/chat` エンドポイントが正常動作（OpenAI Function Calling）

---

### Task 1.2: extractAICandidateResponse 堅牢化

- **担当**: frontend-implementer
- **前提条件**: なし
- **推定工数**: 2h
- **並行可能**: Task 1.1, Task 1.3 と並行可

#### 作業内容

1. `/home/ubuntu/Downloads/vow/frontend/app/dashboard/types/ai-candidate-response.ts` を開く
2. `extractAICandidateResponse` 関数を以下のように改修:

```typescript
/**
 * JSONコードブロックからAICandidateResponseを抽出
 * 複数のパターンに対応し、パース失敗時はテキストフォールバックを返す
 */
export function extractAICandidateResponse(content: string): AICandidateResponse | null {
  if (!content || !content.trim()) return null;

  const trimmed = content.trim();

  // Pattern 1: ```json { ... } ``` コードブロック (最優先)
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonBlockMatch) {
    const result = tryParseCandidate(jsonBlockMatch[1]);
    if (result) return result;
  }

  // Pattern 2: コンテンツ全体が JSON オブジェクト
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const result = tryParseCandidate(trimmed);
    if (result) return result;
  }

  // Pattern 3: テキスト中に埋め込まれた JSON オブジェクトを検出
  // "message" フィールドを含むJSONオブジェクトを後方から探す
  const embeddedJsonMatch = trimmed.match(/(\{[\s\S]*"message"\s*:[\s\S]*\})\s*$/);
  if (embeddedJsonMatch) {
    const result = tryParseCandidate(embeddedJsonMatch[1]);
    if (result) return result;
  }

  // Pattern 4: パース失敗 -- テキスト応答としてフォールバック
  return createTextFallbackResponse(trimmed);
}

/**
 * JSON文字列をパースしてAICandidateResponseとして検証
 */
function tryParseCandidate(jsonStr: string): AICandidateResponse | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (isAICandidateResponse(parsed)) {
      return parsed;
    }
  } catch {
    // JSON parse failed - not a valid JSON string
  }
  return null;
}

/**
 * テキスト応答のフォールバックレスポンスを生成
 * AIがJSON形式を返さなかった場合に、テキストをmessageとして表示
 */
function createTextFallbackResponse(content: string): AICandidateResponse | null {
  // 不完全なJSON/コードブロックマーカーを除去
  const cleanContent = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  // 空または非常に短いコンテンツは無視
  if (!cleanContent || cleanContent.length < 2) return null;

  // 明らかにJSON断片（ストリーミング中の不完全データ）の場合はnullを返す
  // これにより呼び出し元でストリーミング完了後に再試行できる
  if (cleanContent.startsWith('{') && !cleanContent.endsWith('}')) {
    return null;
  }

  return {
    message: cleanContent,
    context: {
      aboutType: null,
      aboutOperation: null,
      categories: [],
    },
    gatheredRequirements: {
      explicit: {},
      inferred: {},
      completeness: 0,
    },
    candidateTypes: {
      showGoals: false,
      showHabits: false,
      showStickies: false,
      showReplies: false,
    },
    replies: [],
  };
}
```

3. テストファイルを作成: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/types/__tests__/ai-candidate-response.test.ts`

```typescript
import {
  extractAICandidateResponse,
  isAICandidateResponse,
} from '../ai-candidate-response';

describe('extractAICandidateResponse', () => {
  const validJson = JSON.stringify({
    message: 'テスト応答',
    context: { aboutType: null, aboutOperation: null, categories: [] },
    gatheredRequirements: { explicit: {}, inferred: {}, completeness: 0 },
    candidateTypes: { showGoals: false, showHabits: false, showStickies: false, showReplies: true },
    replies: [{ type: 'reply', label: 'OK', detail: { action: 'confirm' } }],
  });

  it('should parse ```json code block', () => {
    const content = '```json\n' + validJson + '\n```';
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result?.message).toBe('テスト応答');
  });

  it('should parse direct JSON', () => {
    const result = extractAICandidateResponse(validJson);
    expect(result).not.toBeNull();
    expect(result?.message).toBe('テスト応答');
  });

  it('should parse JSON embedded in text', () => {
    const content = 'Here is my response:\n' + validJson;
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result?.message).toBe('テスト応答');
  });

  it('should create fallback for plain text', () => {
    const content = 'こんにちは、何かお手伝いできることはありますか？';
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result?.message).toBe(content);
    expect(result?.candidateTypes.showGoals).toBe(false);
  });

  it('should return null for incomplete JSON (streaming)', () => {
    const content = '{"message": "テスト';
    const result = extractAICandidateResponse(content);
    expect(result).toBeNull();
  });

  it('should return null for empty content', () => {
    expect(extractAICandidateResponse('')).toBeNull();
    expect(extractAICandidateResponse('  ')).toBeNull();
  });

  it('should strip code block markers in fallback', () => {
    const content = '```json\nこれはJSONではない\n```';
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result?.message).toBe('これはJSONではない');
  });
});
```

#### 検証

```bash
cd /home/ubuntu/Downloads/vow/frontend && npx tsc --noEmit
cd /home/ubuntu/Downloads/vow/frontend && npx jest --testPathPattern="ai-candidate-response" --no-coverage
```

- [ ] TypeScript コンパイルが通過
- [ ] 全テストケースが通過
- [ ] 既存の MOC チャットで JSON 応答が正常に候補表示されること

---

### Task 1.3: remove-openai-chat-path spec を obsolete 化

- **担当**: any
- **前提条件**: なし
- **推定工数**: 15min
- **並行可能**: Task 1.1, Task 1.2 と並行可

#### 作業内容

1. `/home/ubuntu/Downloads/vow/specs/remove-openai-chat-path/architecture.md` の先頭に以下を追加:

```markdown
> **OBSOLETE (2026-02-07)**: この仕様は廃止されました。
>
> - Phase 1 (OpenAIチャットパスの削除) は完了済みです (`useMastraAgent.ts`, `vow-coach-agent.ts`, `/api/agents/chat` OpenAIエンドポイントの削除)。
> - Phase 2 (OpenAI APIの完全排除) は方針変更により撤回されました。
> - **新方針**: OpenAI API は「削除」ではなく「選択可能なプロバイダーの1つ」として統合されます。
> - **後続仕様**: `specs/ai-provider-unification/` を参照してください。
```

#### 検証

- [ ] `architecture.md` の先頭に OBSOLETE マークが存在すること

---

## Phase 2: AI Provider Integration (AIプロバイダー統合) -- 推定: 12-16h

> **前提条件**: Phase 1 の全タスクが完了していること。

### Task 2.1: AIChatProvider インターフェース定義

- **担当**: backend-implementer
- **前提条件**: Phase 1 完了
- **推定工数**: 1h
- **並行可能**: Task 2.5 と並行可

#### 作業内容

1. `/home/ubuntu/Downloads/vow/backend/src/providers/` ディレクトリを作成
2. `types.ts` を作成 -- `architecture.md` Section 4.1 のインターフェース定義を実装
3. `index.ts` を作成 -- エクスポート

#### ファイル構成

```
backend/src/providers/
  types.ts          -- ChatChunk, ChatMessage, ChatOptions, ProviderInfo, AIChatProvider
  index.ts          -- re-exports
```

#### 検証

```bash
cd /home/ubuntu/Downloads/vow/backend && npx tsc --noEmit
```

- [ ] TypeScript コンパイルが通過
- [ ] すべてのインターフェースがエクスポートされている

---

### Task 2.2: OpenAIChatProvider 実装

- **担当**: backend-implementer
- **前提条件**: Task 2.1
- **推定工数**: 3h

#### 作業内容

1. `backend/src/providers/openai-provider.ts` を作成
2. `AIChatProvider` インターフェースを実装
3. `credentials-store.ts` から APIキーを取得
4. OpenAI SDK の `stream: true` でストリーミングチャット
5. `ChatChunk` 形式で結果を yield

#### 重要な実装ポイント

- `systemPrompt` をそのまま `system` ロールのメッセージとして送信
- ストリーミング中のエラーハンドリング（API呼び出し失敗、レート制限、etc.）
- `tokenManager` でトークン使用量を記録（オプション: provider-chat エンドポイント側で行う）

#### 検証

```bash
cd /home/ubuntu/Downloads/vow/backend && npx tsc --noEmit
```

- [ ] TypeScript コンパイルが通過
- [ ] ユニットテスト通過（モック使用）

---

### Task 2.3: Provider Factory 実装

- **担当**: backend-implementer
- **前提条件**: Task 2.2
- **推定工数**: 30min

#### 作業内容

1. `backend/src/providers/provider-factory.ts` を作成
2. `createProvider(userId, providerType, model?)` 関数を実装
3. 現時点では `openai` のみサポート、他は `throw new Error('Unsupported provider')`

#### 検証

- [ ] TypeScript コンパイルが通過

---

### Task 2.4: /api/ai/provider-chat エンドポイント実装

- **担当**: backend-implementer
- **前提条件**: Task 2.3
- **推定工数**: 3h

#### 作業内容

1. `backend/src/routers/providerChat.ts` を作成
2. `architecture.md` Section 4.4 に基づき実装
3. SSE ストリーミングレスポンス
4. 認証ミドルウェア適用
5. `tokenManager` でトークン使用量を記録
6. `backend/src/routers/ai.ts` に providerChatRouter をマウント:

```typescript
// ai.ts に追加
import { providerChatRouter } from './providerChat.js';
// ... 既存のaiRouter定義後に
// aiRouter.route('/', providerChatRouter); は避け、
// メインの app.ts / index.ts でマウントする
```

または `backend/src/index.ts` (メインアプリ) に直接マウント:
```typescript
app.route('/api/ai', providerChatRouter);
```

#### 検証

```bash
cd /home/ubuntu/Downloads/vow/backend && npx tsc --noEmit
# curl テスト（要: 有効なOpenAI APIキーがSettingsに登録済み）
curl -X POST http://localhost:3001/api/ai/provider-chat \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message":"こんにちは","systemPrompt":"あなたはAIアシスタントです。","provider":"openai"}'
```

- [ ] TypeScript コンパイルが通過
- [ ] SSE ストリーミングレスポンスが正しいフォーマットで返る
- [ ] 認証なしでアクセスすると 401 が返る
- [ ] APIキー未登録時に適切なエラーメッセージが返る

---

### Task 2.5: useAIProvider hook 実装

- **担当**: frontend-implementer
- **前提条件**: なし（バックエンドAPIと並行作業可）
- **推定工数**: 2h
- **並行可能**: Task 2.1-2.4 と並行可

#### 作業内容

1. `frontend/app/dashboard/hooks/useAIProvider.ts` を作成
2. `architecture.md` Section 4.5 に基づき実装
3. MCP接続済みサーバーとAPI登録済みプロバイダーを統合した一覧を提供
4. `localStorage` でプロバイダー選択を永続化

#### 検証

```bash
cd /home/ubuntu/Downloads/vow/frontend && npx tsc --noEmit
```

- [ ] TypeScript コンパイルが通過

---

### Task 2.6: useProviderChat hook 実装

- **担当**: frontend-implementer
- **前提条件**: Task 2.4 (provider-chat API が必要)
- **推定工数**: 3h

#### 作業内容

1. `frontend/app/dashboard/hooks/useProviderChat.ts` を作成
2. `UseMastraAgentReturn` インターフェースに準拠（`useMcpChat` と互換）
3. SSE パーサーは `useMcpChat.ts` のストリーミング処理ロジックと同じパターンを使用
4. `sendMessage` が `/api/ai/provider-chat` に POST し、SSE ストリームを処理

#### 実装のポイント

- `useMcpChat.ts` の行 338-517 の SSE パーサーロジックを参考にする
- `event: token`, `event: complete`, `event: error` の処理
- `abortController` による中断対応
- `retry` 機能

#### 検証

```bash
cd /home/ubuntu/Downloads/vow/frontend && npx tsc --noEmit
```

- [ ] TypeScript コンパイルが通過
- [ ] `useMcpChat` と同じインターフェース (`UseMastraAgentReturn`) を返す

---

### Task 2.7: Chat.ProviderSelector.tsx 実装

- **担当**: frontend-implementer
- **前提条件**: Task 2.5 (useAIProvider)
- **推定工数**: 1.5h

#### 作業内容

1. `frontend/app/dashboard/components/Chat.ProviderSelector.tsx` を作成
2. プロバイダー一覧をドロップダウンまたはピルボタンとして表示
3. MCP プロバイダーには接続状態アイコンを表示
4. API プロバイダーにはモデル名を表示

```tsx
interface ProviderSelectorProps {
  providers: AIProviderOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ProviderSelector({ providers, selectedId, onSelect }: ProviderSelectorProps) {
  if (providers.length <= 1) return null; // 1つ以下なら表示不要

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border">
      <span className="text-xs text-muted-foreground mr-1">AI:</span>
      {providers.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`px-2 py-0.5 rounded text-xs transition-colors ${
            p.id === selectedId
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 hover:bg-muted text-foreground'
          }`}
        >
          {p.source === 'mcp' ? '(MCP) ' : ''}{p.nameJa}
          {p.model && <span className="ml-1 opacity-60">{p.model}</span>}
        </button>
      ))}
    </div>
  );
}
```

#### 検証

```bash
cd /home/ubuntu/Downloads/vow/frontend && npx tsc --noEmit
```

- [ ] TypeScript コンパイルが通過
- [ ] デザインがVOWのデザインシステムに準拠

---

### Task 2.8: Section.MOC.tsx 統合

- **担当**: frontend-implementer
- **前提条件**: Task 2.5, Task 2.6, Task 2.7 すべて完了
- **推定工数**: 2h

#### 作業内容

1. `Section.MOC.tsx` に以下を追加:
   - `useAIProvider` hook の呼び出し
   - `useProviderChat` hook の呼び出し（APIプロバイダー選択時のみ）
   - `activeAgent` の条件分岐: `isMcp ? mcpChat : providerChat`
   - チャット入力エリア上部に `ProviderSelector` コンポーネントを配置
2. 既存の `mcpChat` 関連コードは一切変更しない
3. プロバイダー切替時にメッセージ履歴をクリアするか保持するかを決定（推奨: クリア）

#### 変更箇所の概要

```tsx
// 追加 import
import { useAIProvider } from '../hooks/useAIProvider';
import { useProviderChat } from '../hooks/useProviderChat';
import { ProviderSelector } from './Chat.ProviderSelector';

// hook 追加 (MOCSection関数内)
const { availableProviders, selectedProvider, switchProvider, isMcp } = useAIProvider(authToken);

// 既存の mcpChat は変更なし
const mcpChat = useMcpChat({ ... }); // そのまま

// API プロバイダー用チャット (新規)
const providerChat = useProviderChat({
  authToken,
  provider: selectedProvider?.apiProvider || 'openai',
  model: selectedProvider?.model,
  systemMessage: aiCoachSystemPrompt, // 同じプロンプト
  userId,
});

// activeAgent の切替
const activeAgent = isMcp ? mcpChat : providerChat;

// JSX にセレクターを追加
// チャットタブのヘッダー部分に:
{activeTab === 'chat' && availableProviders.length > 1 && (
  <ProviderSelector
    providers={availableProviders}
    selectedId={selectedProvider?.id || ''}
    onSelect={switchProvider}
  />
)}
```

#### 検証

```bash
cd /home/ubuntu/Downloads/vow/frontend && npx tsc --noEmit
```

- [ ] TypeScript コンパイルが通過
- [ ] MCP プロバイダー選択時に従来どおり MCP チャットが動作
- [ ] OpenAI プロバイダー選択時にバックエンド経由でチャットが動作
- [ ] プロバイダー選択がページリロード後も維持される
- [ ] 候補ボタン (AICandidateResponse) が両プロバイダーで表示される

---

## Phase 2 後の検証チェックリスト

### 全体検証

- [ ] `cd /home/ubuntu/Downloads/vow/frontend && npx tsc --noEmit`
- [ ] `cd /home/ubuntu/Downloads/vow/backend && npx tsc --noEmit`
- [ ] MCP 経由チャットの正常動作
- [ ] OpenAI API 経由チャットの正常動作
- [ ] `AICandidateResponse` JSON の候補表示 (MCP)
- [ ] `AICandidateResponse` JSON の候補表示 (OpenAI API)
- [ ] テキストフォールバック表示 (JSON 非準拠の応答)
- [ ] ストリーミング表示 (インクリメンタルなテキスト表示)
- [ ] プロバイダー切替UI
- [ ] Settings でAPIキー未登録のプロバイダーが選択リストに表示されない
- [ ] APIキーがフロントエンドに露出していない

---

## Summary (サマリ)

| Phase | タスク数 | 推定合計工数 | 並行可能ペア |
|-------|---------|-------------|-------------|
| Phase 1 | 3 | 4-6h | Task 1.1 + 1.2 + 1.3 すべて並行可 |
| Phase 2 | 8 | 12-16h | Task 2.1-2.4 (BE) と Task 2.5 (FE) 並行可 |
| **合計** | **11** | **16-22h** | |

### 優先順位

1. **最優先**: Phase 1 全タスク (リファクタリング)
2. **次**: Phase 2 Task 2.1-2.4 (バックエンド) + Task 2.5 (フロントエンド並行)
3. **最後**: Phase 2 Task 2.6-2.8 (フロントエンド統合)
