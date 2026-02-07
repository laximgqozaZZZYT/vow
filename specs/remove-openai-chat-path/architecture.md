> **⚠️ OBSOLETE - この仕様書は廃止されました**
>
> **廃止日**: 2026-02-07
>
> **廃止理由**: 方針変更により、OpenAI APIを完全削除するのではなく、選択可能なプロバイダーの1つとして統合することになりました。
>
> **新方針**: 現在の仕様は `specs/ai-provider-unification/` を参照してください。
> - OpenAI APIはMCPと並行して選択可能なプロバイダーとして統合されます
> - ユーザーはMOCセクションでMCP、OpenAI API、その他のプロバイダーを選択できます
>
> **完了済み項目**:
> - Phase 1の一部（useMastraAgent削除など）は既に完了していますが、完全な削除ではなく統合方針に変更されました
>
> **注意**: このファイルは履歴として保持されていますが、実装の参考には使用しないでください。

---

# Spec: OpenAI/Mastra チャットパス完全削除

## 概要

MCP経由のチャット（Claude Code）のみを残し、OpenAI API経由のチャット処理を完全に削除する。
MCP利用時の挙動に一切影響を出さないこと。

## 背景

- MCP利用時は理想的な挙動（候補表示、JSON応答等すべて正常）
- OpenAI API利用時は候補表示不具合など問題が多い
- 2つのパスを維持するコストが高く、プロンプト一致検証も困難
- **決定**: OpenAI APIパスを完全削除し、MCPパスに一本化

## 削除対象

### Phase 1: Frontend（useMastraAgent削除 + MCP一本化）

| ファイル | 変更 | 詳細 |
|---------|------|------|
| `frontend/app/dashboard/hooks/useMastraAgent.ts` | **削除** | OpenAI APIフック全体 |
| `frontend/app/dashboard/hooks/useMOCChat.ts` | **修正** | mastraAgent初期化削除、常にmcpChat使用 |
| `frontend/app/dashboard/components/Section.MOC.tsx` | **修正** | useMastraAgentインポート削除、shouldUseMcpAgentロジック削除 |
| `frontend/app/dashboard/components/Section.Coach.tsx` | **修正** | useMastraAgentインポート・使用削除 |
| `frontend/app/dashboard/components/Section.AIHub.tsx` | **修正** | useMastraAgentインポート・使用削除 |
| `frontend/app/dashboard/components/View.CoachMode.tsx` | **修正** | useMastraAgentインポート・型参照削除 |

### Phase 2: Backend（/api/agents/chat + /multi-chat + VowCoachAgent削除）

| ファイル | 変更 | 詳細 |
|---------|------|------|
| `backend/src/agents/mastra/vow-coach-agent.ts` | **削除** | OpenAI CoachAgent全体（~1900行） |
| `backend/src/agents/mastra/config.ts` | **削除** | Mastra設定 |
| `backend/src/agents/mastra/agents/` | **削除** | Multi-agentシステム（manager, habit-coach, goal-planner, progress-tracker） |
| `backend/src/agents/mastra/drilldown/` | **削除** | Drilldown深堀りツール |
| `backend/src/agents/mastra/workflows/` | **削除** | Mastraワークフロー |
| `backend/src/agents/mastra/prompts/` | **削除** | Mastra用プロンプト |
| `backend/src/agents/mastra/index.ts` | **削除** | Mastraエクスポート |
| `backend/src/routers/agents.ts` | **修正** | `/chat`, `/multi-chat`, `/multi-agents`エンドポイント削除。`/cli/chat`のOpenAIフォールバック削除 |
| `backend/src/services/session-store.ts` | **修正** | CoachSession/CoachMessage型のインポートをローカル定義に変更 |
| `backend/src/services/aiCoachService.ts` | **修正** | VowCoachAgent依存を削除 |

### Phase 3: 依存クリーンアップ

| ファイル | 変更 | 詳細 |
|---------|------|------|
| `backend/package.json` | **修正** | `openai`, `@mastra/core`, `zod-to-json-schema`等の不要パッケージ削除 |
| `frontend/app/dashboard/types/sse-events.types.ts` | **修正** | Mastra関連コメント削除 |
| `frontend/app/dashboard/types/unified-message.types.ts` | **修正** | `'mastra'`ソースタイプ削除 |
| `frontend/lib/agent-tools/message-adapter.ts` | **修正** | MastraMessage参照削除 |

## 保護対象（変更禁止）

| ファイル/ディレクトリ | 理由 |
|---------------------|------|
| `frontend/app/dashboard/hooks/useMcpChat.ts` | MCPチャットフック（メインパス） |
| `frontend/app/dashboard/types/ai-candidate-response.ts` | 候補表示システム（MCP利用） |
| `frontend/app/dashboard/constants/role-prompts.ts` | ロール定義（MCP利用） |
| `frontend/app/dashboard/hooks/useRolePrompt.ts` | ロールプロンプト取得（MCP利用） |
| `backend/src/prompts/roles/coach.ts` | 正規プロンプト（APIエンドポイント経由でMCPも利用） |
| `backend/src/prompts/prompt-registry.ts` | プロンプト管理（APIエンドポイント経由でMCPも利用） |
| `backend/src/routers/prompts.ts` | プロンプトAPI（MCPフロントエンドから利用） |
| `backend/src/agents/shared-tools/` | 共有ツール（MCP/CLI経由でも利用可能性あり） |
| `backend/src/services/mcp-settings-service.ts` | MCP設定管理 |
| `backend/src/routers/mcpConnections.ts` | MCP接続API |
| `backend/src/services/session-store.ts` | セッション管理（型定義のみ変更） |
| `backend/src/services/rateLimitService.ts` | レート制限（CLI/他で利用） |
| `backend/src/routers/conversations.ts` | 会話履歴API |

## useMcpChat.ts の MastraMessage 型依存

`useMcpChat.ts` (line 16) が `useMastraAgent.ts` から `MastraMessage` と `UseMastraAgentReturn` 型をインポートしている。

**対処**: `MastraMessage` 型定義を `useMcpChat.ts` 内にローカル定義として移動、または共通型ファイルに移動する。

## /api/agents/cli/chat のフォールバック

現在 `/api/agents/cli/chat` はMCP失敗時にVowCoachAgent（OpenAI）へフォールバックしている。

**対処**: フォールバックを削除し、MCP失敗時はエラーを返す。MCPが設定されていない場合もエラー。

## 実装順序

1. **Phase 1**: Frontend修正（useMastraAgent削除、MCP一本化）
2. **Phase 2**: Backend修正（/chat, /multi-chatエンドポイント削除、VowCoachAgent削除）
3. **Phase 3**: 依存クリーンアップ（不要パッケージ削除、型参照整理）

## 検証

- `cd frontend && npx tsc --noEmit` - フロントエンドコンパイル通過
- `cd backend && npx tsc --noEmit` - バックエンドコンパイル通過
- MCP経由のチャットが正常動作すること
- 不要なOpenAI関連コードが残っていないこと
