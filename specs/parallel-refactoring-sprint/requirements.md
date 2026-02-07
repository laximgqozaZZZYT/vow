# Parallel Refactoring Sprint - Requirements

## Overview

- **Purpose**: プロジェクト全体の技術的負債を一括清掃する。Mastra残骸除去、型統一、デッドコード削除、プロジェクトルート整理を並列エージェントで同時実行する。
- **Status**: Active
- **Version**: 1.0.0
- **Last Updated**: 2026-02-07
- **Author**: orchestrator (Claude Opus)

---

## Pre-condition: Phase 1 完了済み（未コミット）

以下の3タスクは既に作業済み（未コミット状態で存在）:

| Task | 内容 | 変更ファイル |
|------|------|-------------|
| P1-1 | `aiCoachService.ts` Mastraデッドコード330行削除 | `backend/src/services/aiCoachService.ts` |
| P1-2 | `extractAICandidateResponse` 5パターン対応+フォールバック | `frontend/app/dashboard/types/ai-candidate-response.ts` |
| P1-3 | `remove-openai-chat-path` spec obsoleteマーク | `specs/remove-openai-chat-path/architecture.md` |

→ これらは本スプリントの最初のコミットとして確定する。

---

## Sprint Tasks

### Track A: Frontend Mastra/Dead Code Cleanup

**担当**: implementer agent A
**変更対象ファイル**: frontend/ 配下のみ

| ID | タスク | ファイル | 詳細 |
|----|--------|---------|------|
| A-1 | Mastra型参照の除去 | `frontend/lib/mastra/config.ts` | `ToolCallResult` 型の定義元を確認。もし `lib/mastra/` 全体が不要なら削除。型が他で使われている場合はローカル定義に移動 |
| A-2 | ToolCallResult参照の移行 | `frontend/app/dashboard/hooks/useMcpChat.ts` | `import { ToolCallResult } from '@/lib/mastra/config'` → ローカル型定義に変更 |
| A-3 | ToolCallResult参照の移行 | `frontend/app/dashboard/components/View.CoachMode.tsx` | 同上 |
| A-4 | MastraMessage型の除去 | 複数ファイル | `Section.Coach.tsx`, `Section.AIHub.tsx`, `Section.MOC.tsx` から MastraMessage 参照を確認・除去 |
| A-5 | 未使用コンポーネント確認 | `Section.AIHub.tsx`, `Section.AIAssistant.tsx` | `dashboard/page.tsx` で未使用。他で参照がなければ削除候補としてコメントのみ残す（削除はユーザー確認後） |

**制約**:
- `useMcpChat.ts` のMCP通信ロジック自体は変更禁止
- 型の移動のみ、ロジック変更なし
- コンパイルが通ること: `cd frontend && npx tsc --noEmit`

### Track B: Backend Mastra/Dead Code Cleanup

**担当**: implementer agent B
**変更対象ファイル**: backend/ 配下のみ

| ID | タスク | ファイル | 詳細 |
|----|--------|---------|------|
| B-1 | `@mastra/core` 依存削除 | `backend/package.json` | dependencies から `@mastra/core` を削除 |
| B-2 | Mastraコメント除去 | `backend/src/services/llm-config.ts` L5 | コメントのみ。`// Mastra configuration` 等を削除 |
| B-3 | Mastraコメント除去 | `backend/src/services/shared-tools/index.ts` L6 | 同上 |
| B-4 | Mastraコメント除去 | `backend/src/services/openai-tool-adapter.ts` L9-10 | 同上 |
| B-5 | Mastraコメント除去 | `backend/src/routers/agents.ts` L10-11 | 同上 |
| B-6 | Mastraコメント除去 | `backend/src/index.ts` L338 | 同上 |
| B-7 | `openai-tool-adapter.ts` 使用箇所確認 | `backend/src/services/openai-tool-adapter.ts` | aiCoachServiceのみが使用しているか確認。もし他に参照がなく、かつaiCoachServiceでも実質的に不使用なら削除候補としてレポート |

**制約**:
- `npm install` 後にビルドが通ること
- `cd backend && npx tsc --noEmit` が通ること
- `@mastra/core` 削除後に import エラーが出ないことを確認

### Track C: Project Root & Structure Cleanup

**担当**: implementer agent C
**変更対象ファイル**: プロジェクトルートのみ

| ID | タスク | ファイル | 詳細 |
|----|--------|---------|------|
| C-1 | 一時ファイル削除 | ルートの34個の .md/.txt | `INVESTIGATION_*`, `TOKEN_FLOW_*`, `MCP_*`, `RESEARCH_*`, `AGENT_CONFIG_*`, `HYPOTHESIS_*`, `START_HERE.txt`, `TECHNICAL_ANALYSIS_*`, `README_MCP_*` を全削除 |
| C-2 | .gitignore更新 | `.gitignore` | 以下を追加: `INVESTIGATION_*.md`, `RESEARCH_*.md`, `TOKEN_FLOW_*.md`, `MCP_*.md`, `test-results/`, `screenshots/`, `*.test-result.json` |
| C-3 | HANDOFF.md削除 | `HANDOFF.md` | Cursor引き継ぎは中止されたため不要 |

**制約**:
- `CLAUDE.md`, `REPORTS.md`, `README.md` は保護（削除禁止）
- `specs/` ディレクトリ配下は触らない
- `.kiro/specs/` は今回のスコープ外（別途判断）

### Track D: Frontend Type Unification

**担当**: implementer agent D
**変更対象ファイル**: frontend/app/dashboard/types/ と関連ファイル

| ID | タスク | ファイル | 詳細 |
|----|--------|---------|------|
| D-1 | ChatSession型統一 | `agent.types.ts` (L104-110) vs `chat-session.types.ts` (L15-45) | どちらがcanonicalかを判定。重複を解消し、片方を re-export に変更 |
| D-2 | GroupChatMessage型統一 | `moc.types.ts` (L42-55) vs `useMOCChat.ts` (L25-47) | 同上。canonical定義を1箇所にまとめ、他は import に変更 |

**制約**:
- 型の統合のみ、ロジック変更なし
- 全参照箇所の import パスを更新
- `cd frontend && npx tsc --noEmit` が通ること

---

## Acceptance Criteria

- [ ] `cd frontend && npx tsc --noEmit` エラーなし
- [ ] `cd backend && npx tsc --noEmit` エラーなし
- [ ] `grep -r "mastra\|Mastra" frontend/lib/mastra/` が空（ディレクトリ削除済み）またはローカル型のみ
- [ ] `grep -r "@mastra/core" backend/package.json` が空
- [ ] プロジェクトルートの一時ファイルが削除済み
- [ ] ChatSession, GroupChatMessage の重複定義が解消済み

---

## Parallelization Guide

```
Track A (Frontend Mastra)  ──┐
Track B (Backend Mastra)   ──┼── 全て並列実行可能（ファイル重複なし）
Track C (Project Root)     ──┤
Track D (Frontend Types)   ──┘
```

各Trackは完全に独立したファイルセットを対象とするため、同時実行可能。
