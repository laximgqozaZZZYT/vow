# Stream A: Frontend Agent - Initial Context

## Agent Role
Frontend専門エージェント。Mastra/Strands UIコンポーネント、React hooks、ストリーミングUI実装を担当。

## Project Context

### Working Directory
`/home/ubuntu/Downloads/vow/frontend`

### Key Existing Files to Understand

1. **Section.Coach.tsx** (`app/dashboard/components/Section.Coach.tsx`)
   - 現在のAI Coachセクション
   - 約1200行の大規模コンポーネント
   - 統合対象: Mastraエージェント呼び出し
   - Message型、UIComponentData型が定義済み
   - 既存のストリーミング風UI（タイピングアニメーション）あり

2. **Section.Agents.tsx** (`app/dashboard/components/Section.Agents.tsx`)
   - マルチエージェントダッシュボード
   - 約900行
   - useMultiAgentServer hookで MCP Task Serverと通信
   - Agent, AgentTask, AgentActivity型が定義済み
   - Grid/List/Kanban/Panels表示モード対応

3. **useMultiAgentServer.ts** (`app/dashboard/hooks/useMultiAgentServer.ts`)
   - MCP Task Serverとの通信hook
   - SSE (Server-Sent Events) 対応
   - 複数サーバー接続対応
   - 参考にしてMastra用hookを作成

### Technology Stack
- Next.js 16, React 19
- TypeScript (strict mode)
- Tailwind CSS 4
- Zod for validation

### Design System
- ファイル命名規則: `Widget.*.tsx`, `Modal.*.tsx`, `Section.*.tsx`
- デザイントークン: `.kiro/steering/design-system.md` 参照
- 既存Widgetパターンに従う

---

## Initial Tasks for Stream A

### A-001: useMastraAgent Hook作成
**Priority**: High
**Dependencies**: B-001, B-002 (Mastraパッケージインストール完了後)

**Requirements**:
- バックエンドの `/api/ai/agent` エンドポイントと通信
- ストリーミングレスポンス対応 (ReadableStream)
- Tool call イベントハンドリング
- エラーバウンダリ統合
- 会話履歴管理

**Interface Proposal**:
```typescript
interface UseMastraAgentOptions {
  onToolCall?: (toolName: string, args: unknown) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
  onError?: (error: Error) => void;
}

interface UseMastraAgentReturn {
  send: (message: string, context?: UserContext) => Promise<void>;
  messages: Message[];
  isStreaming: boolean;
  currentToolCall: string | null;
  error: Error | null;
  clearMessages: () => void;
}
```

**Output Files**:
- `app/dashboard/hooks/useMastraAgent.ts`
- `app/dashboard/types/mastra.types.ts`

---

### A-002: Widget.StreamingResponse.tsx 作成
**Priority**: High
**Dependencies**: A-001

**Requirements**:
- タイプライター効果（文字単位アニメーション）
- Markdown レンダリング (react-markdown)
- コードブロック シンタックスハイライト
- 思考プロセス表示 (`<thinking>` タグ対応)
- スクロール自動追従

**Props Interface**:
```typescript
interface StreamingResponseProps {
  content: string;
  isStreaming: boolean;
  thinkingContent?: string;
  onComplete?: () => void;
  className?: string;
}
```

**Output Files**:
- `app/dashboard/components/Widget.StreamingResponse.tsx`

---

### A-003: Widget.ToolCallDisplay.tsx 作成
**Priority**: Medium
**Dependencies**: A-001

**Requirements**:
- ツール名とアイコン表示
- 実行中インジケーター (スピナー)
- 引数の折りたたみ表示
- 結果のJSON/テキスト表示
- エラー状態表示

**Props Interface**:
```typescript
interface ToolCallDisplayProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: 'pending' | 'executing' | 'completed' | 'error';
}
```

**Output Files**:
- `app/dashboard/components/Widget.ToolCallDisplay.tsx`

---

## Coding Guidelines for Stream A

1. **コンポーネント分割**: 200行を超える場合は分割を検討
2. **型定義**: すべてのprops/stateに型を定義
3. **アクセシビリティ**: aria属性、キーボード操作対応
4. **レスポンシブ**: モバイルファースト、md/lg ブレークポイント
5. **テスト**: 各コンポーネントに `*.test.tsx` を作成

---

## Integration Points

### With Backend (Stream B)
- `/api/ai/agent` - Mastraエージェント呼び出し
- `/api/ai/workflow/{name}` - ワークフロー実行
- WebSocket/SSE でストリーミング

### With Section.Coach.tsx
- 段階的移行: 新hook追加 → 既存ロジック置き換え
- UIComponentData 型は維持
- 既存のQuickActions機能は保持

---

## File Conflict Prevention

以下のファイルを修正する場合は、他ストリームと調整:
- `app/dashboard/types/agent.types.ts` - Stream Bも使用
- `lib/supabase-direct.ts` - 全ストリームが使用

---

## Branch Naming
```
feat/ai-agent-framework-stream-a-{task-id}
```
Example: `feat/ai-agent-framework-stream-a-001`

---

## Success Criteria

- [ ] useMastraAgent hookが動作し、ストリーミングレスポンスを表示できる
- [ ] Widget.StreamingResponseがMarkdownを正しくレンダリングする
- [ ] Widget.ToolCallDisplayがツール実行状態を表示できる
- [ ] 既存のSection.Coachとの互換性が維持される
- [ ] モバイル/デスクトップで正しく表示される
