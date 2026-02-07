# Agent Config Backend Migration - 実装タスク一覧

## Overview

- **Purpose**: 各実装タスクを独立した作業単位に分割し、複数エージェントが並行して作業可能にする
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect

---

## Task Summary

| ID | Phase | Task | 担当 | 依存 | 推定工数 |
|----|-------|------|------|------|---------|
| T-001 | 1 | DB Migration SQL 作成 | implementer | なし | 15min |
| T-002 | 2 | agent-config-service.ts 修正 | implementer | なし (T-001と並行可) | 20min |
| T-003 | 2 | TypeScript コンパイルチェック (backend) | tester | T-002 | 5min |
| T-004 | 3 | フロントエンド表示検証 | code-reviewer | T-002 | 10min |
| T-005 | 3 | TypeScript コンパイルチェック (frontend) | tester | なし | 5min |
| T-006 | 4 | 統合テスト計画作成 | tester | T-001, T-002 | 10min |

---

## Phase 1: DB Migration Fix

### T-001: DB Migration SQL 作成

**ファイル**: `supabase/migrations/20260208000002_fix_builtin_agents.sql` (新規作成)

**前提条件**: なし (独立して作業可能)

**作業内容**:

1. `supabase/migrations/20260208000002_fix_builtin_agents.sql` を新規作成する

2. Part 1 として、既存レコードの `is_builtin` フラグを修正する UPDATE 文を記述する:
   ```sql
   -- Fix: Only AICoach should be built-in
   -- habit-coach, goal-planner, progress-tracker are now custom agents
   UPDATE agent_configs
   SET is_builtin = false
   WHERE agent_id IN ('habit-coach', 'goal-planner', 'progress-tracker')
     AND is_builtin = true;
   ```

3. Part 2 として、`get_or_create_agent_config` 関数を `CREATE OR REPLACE` で置換する:
   - `CASE` 文を **2分岐のみ** に簡素化: `'AICoach'` と `ELSE`
   - `'AICoach'` の場合: `is_builtin = true`, `name = 'AI Coach'`, `icon = '🎯'`, `role = 'Coach'`, `capabilities = '["習慣提案", "目標提案", "パターン分析", "スモールステップ生成"]'`, `instructions = 'あなたはVOW（習慣・目標トラッカー）のAIコーチです。'` (簡潔な1行のみ)
   - `ELSE` の場合: `is_builtin = false`, `name = p_agent_id`, `icon = '🤖'`, `role = 'custom'`, `capabilities = '[]'`, `instructions = ''`
   - `habit-coach`, `goal-planner`, `progress-tracker` の CASE 文は **全て削除** する

4. 完全なSQL内容は `architecture.md` Section 5.2 を参照

**完了条件**:
- [x] ファイルが `supabase/migrations/20260208000002_fix_builtin_agents.sql` に作成されている
- [x] UPDATE 文が `habit-coach`, `goal-planner`, `progress-tracker` の `is_builtin` を `false` に更新する
- [x] `get_or_create_agent_config` 関数が AICoach と ELSE の2分岐のみ
- [x] AICoachの `instructions` に長大なプロンプト文字列が含まれていない (1行以内)
- [x] `SECURITY DEFINER` と `GRANT EXECUTE` が保持されている
- [x] SQLが文法的に正しい

**参考ファイル**:
- 現行マイグレーション: `supabase/migrations/20260208000001_agent_configs_role_capabilities.sql`
- ベーステーブル定義: `supabase/migrations/20260208000000_add_agent_configs.sql`

---

## Phase 2: Backend Service Adjustments

### T-002: agent-config-service.ts 修正

**ファイル**: `backend/src/services/agent-config-service.ts` (変更)

**前提条件**: なし (T-001と並行して作業可能。DB接続なしでコード変更のみ)

**作業内容**:

1. **`DEFAULT_AGENT_IDS` を `BUILTIN_AGENT_ID` に変更** (L59):

   Before:
   ```typescript
   export const DEFAULT_AGENT_IDS = ['AICoach', 'habit-coach', 'goal-planner', 'progress-tracker'] as const;
   export type DefaultAgentId = typeof DEFAULT_AGENT_IDS[number];
   ```

   After:
   ```typescript
   /**
    * The only built-in agent. All other agents are user-created custom agents.
    */
   export const BUILTIN_AGENT_ID = 'AICoach' as const;
   ```

2. **`AGENT_AVAILABLE_TOOLS` の修正** (L65-70):

   Before:
   ```typescript
   export const AGENT_AVAILABLE_TOOLS: Record<DefaultAgentId, string[]> = {
     'AICoach': ['analyze_habits', 'suggest_habits', 'generate_baby_steps', 'suggest_goals', 'check_progress'],
     'habit-coach': ['analyze_habits', 'suggest_habits', 'generate_baby_steps'],
     'goal-planner': ['create_smart_goal', 'suggest_goals', 'breakdown_milestones', 'prioritize_goals'],
     'progress-tracker': ['check_progress', 'generate_report', 'analyze_trends'],
   };
   ```

   After:
   ```typescript
   /**
    * Available tools for the built-in AICoach agent.
    * Custom agents do not have predefined tools.
    */
   export const AGENT_AVAILABLE_TOOLS: Record<string, string[]> = {
     'AICoach': ['analyze_habits', 'suggest_habits', 'generate_baby_steps', 'suggest_goals', 'check_progress'],
   };
   ```

3. **`getAllAgentConfigs` の修正** (L133-160):

   Before:
   ```typescript
   export async function getAllAgentConfigs(
     supabase: SupabaseClient,
     userId: string
   ): Promise<AgentConfig[]> {
     try {
       // First ensure all default agents have configs
       for (const agentId of DEFAULT_AGENT_IDS) {
         await getAgentConfig(supabase, userId, agentId);
       }
       // Now fetch all configs
       // ...
   ```

   After:
   ```typescript
   export async function getAllAgentConfigs(
     supabase: SupabaseClient,
     userId: string
   ): Promise<AgentConfig[]> {
     try {
       // Ensure the built-in AICoach agent exists for this user
       await getAgentConfig(supabase, userId, BUILTIN_AGENT_ID);

       // Fetch all configs (AICoach + user's custom agents)
       const { data, error } = await supabase
         .from('agent_configs')
         .select('*')
         .eq('user_id', userId)
         .order('created_at', { ascending: true });

       if (error) {
         logger.error('Failed to get all agent configs', error, { userId });
         return [];
       }

       return (data || []).map(rowToAgentConfig);
     } catch (error) {
       logger.error('Error getting all agent configs', error as Error, { userId });
       return [];
     }
   }
   ```

4. **`getAvailableTools` の修正** (L382-387):

   Before:
   ```typescript
   export function getAvailableTools(agentId: string): string[] {
     if (agentId in AGENT_AVAILABLE_TOOLS) {
       return AGENT_AVAILABLE_TOOLS[agentId as DefaultAgentId];
     }
     return [];
   }
   ```

   After:
   ```typescript
   export function getAvailableTools(agentId: string): string[] {
     return AGENT_AVAILABLE_TOOLS[agentId] || [];
   }
   ```

5. **default export の修正** (L389-401):

   `DEFAULT_AGENT_IDS` を `BUILTIN_AGENT_ID` に変更:
   ```typescript
   export default {
     getAgentConfig,
     getAllAgentConfigs,
     updateAgentConfig,
     resetAgentConfig,
     isAgentEnabled,
     getAvailableTools,
     createCustomAgentConfig,
     bulkCreateCustomAgentConfigs,
     deleteCustomAgentConfig,
     BUILTIN_AGENT_ID,
     AGENT_AVAILABLE_TOOLS,
   };
   ```

6. **`DEFAULT_AGENT_IDS` を参照している他のファイルの確認**:
   `DEFAULT_AGENT_IDS` が他のファイルからimportされている場合は、そのファイルも更新する必要がある。以下のコマンドで確認:
   ```bash
   grep -r "DEFAULT_AGENT_IDS" backend/src/
   ```
   もし参照があれば、`BUILTIN_AGENT_ID` への参照に更新する。

**完了条件**:
- [x] `DEFAULT_AGENT_IDS` が削除され、`BUILTIN_AGENT_ID = 'AICoach'` が定義されている
- [x] `AGENT_AVAILABLE_TOOLS` が AICoach のみのエントリを持つ
- [x] `getAllAgentConfigs` が AICoach のみを自動生成し、他はSELECTで取得する
- [x] `getAvailableTools` が `DefaultAgentId` 型に依存しない
- [x] default export が更新されている
- [x] `DEFAULT_AGENT_IDS` への外部参照がない (全て `BUILTIN_AGENT_ID` に更新済み)

**参考ファイル**:
- 現行サービス: `backend/src/services/agent-config-service.ts`
- Router (変更不要だが動作確認用): `backend/src/routers/agentConfigs.ts`

---

### T-003: TypeScript コンパイルチェック (backend)

**前提条件**: T-002 完了

**作業内容**:

1. バックエンドのTypeScriptコンパイルを実行する:
   ```bash
   cd /home/ubuntu/Downloads/vow/backend && npx tsc --noEmit
   ```

2. エラーがある場合は以下を確認:
   - `DEFAULT_AGENT_IDS` への残存参照 (`BUILTIN_AGENT_ID` に更新が必要)
   - `DefaultAgentId` 型への残存参照 (削除または `string` に置換)
   - `AGENT_AVAILABLE_TOOLS` の型不整合

3. 全てのコンパイルエラーを解消する

**完了条件**:
- [x] `npx tsc --noEmit` がエラーなしで完了する

---

## Phase 3: Frontend Verification

### T-004: フロントエンド表示検証

**前提条件**: T-002 完了 (バックエンドAPIが正しいレスポンスを返す状態)

**作業内容**:

以下の各コンポーネントについて、コードレビューで正しい動作を確認する:

1. **`useAgentConfigs` hook** (`frontend/app/dashboard/hooks/useAgentConfigs.ts`):
   - L251: `customConfigs = configs.filter(c => !c.isBuiltIn)` -- APIレスポンスの `isBuiltIn` に依存 (正しい)
   - L252: `builtInConfigs = configs.filter(c => c.isBuiltIn)` -- AICoachのみが `isBuiltIn=true` で返る (正しい)
   - **変更不要**

2. **`Agent.ListView`** (`frontend/app/dashboard/components/Agent.ListView.tsx`):
   - L45-65: `builtInRoles` の生成 -- `builtInAgents` prop から生成 (正しい)
   - L120-129: "組み込み" / "カスタム" バッジ表示 -- `role.isBuiltIn` で分岐 (正しい)
   - L135-176: 編集・削除ボタン -- `!role.isBuiltIn` の場合のみ表示 (正しい)
   - **変更不要**

3. **`Modal.AgentDetail`** (`frontend/app/dashboard/components/Modal.AgentDetail.tsx`):
   - L60-71: `BUILTIN_AGENTS` 定数 -- AICoachのみ定義済み (正しい)
   - **変更不要**

4. **`Section.MOC`** (`frontend/app/dashboard/components/Section.MOC.tsx`):
   - L117-125: `useAgentConfigs` から `customConfigs`, `builtInConfigs` を取得 (正しい)
   - L1378-1379: `AgentListView` に `customAgents`, `builtInAgents` を渡す (正しい)
   - **変更不要**

**完了条件**:
- [x] 上記4コンポーネントのコードレビュー完了
- [x] フロントエンドに変更が不要であることを確認
- [x] (オプション) APIが接続可能な場合、実際のUI表示を確認

---

### T-005: TypeScript コンパイルチェック (frontend)

**前提条件**: なし (フロントエンドに変更がないため、現状のコンパイル可能性を確認するだけ)

**作業内容**:

1. フロントエンドのTypeScriptコンパイルを実行する:
   ```bash
   cd /home/ubuntu/Downloads/vow/frontend && npx tsc --noEmit
   ```
   注意: Next.js プロジェクトでは `npx next build` の方が正確な場合がある。ただしビルド全体を実行するため時間がかかる。

2. エラーがある場合は、本仕様の変更とは無関係の既存エラーかどうかを切り分ける

**完了条件**:
- [x] TypeScript コンパイルが成功、または既存エラーのみであることを確認

---

## Phase 4: Integration Testing

### T-006: 統合テスト計画作成

**前提条件**: T-001, T-002 完了

**作業内容**:

以下のテストシナリオを実行計画として文書化する。実際の実行はDBが接続可能な環境で行う。

#### テストシナリオ 1: マイグレーション適用

```bash
# Supabase CLI でマイグレーション適用
cd /home/ubuntu/Downloads/vow
npx supabase db push
# or
npx supabase migration up
```

検証:
```sql
-- is_builtin=true は AICoach のみ
SELECT agent_id, is_builtin FROM agent_configs WHERE is_builtin = true;
-- 期待: AICoach のみ

-- habit-coach 等は is_builtin=false
SELECT agent_id, is_builtin FROM agent_configs
WHERE agent_id IN ('habit-coach', 'goal-planner', 'progress-tracker');
-- 期待: 全て is_builtin = false
```

#### テストシナリオ 2: GET /api/agent-configs

```bash
curl -H "Authorization: Bearer <token>" \
  https://<backend-url>/api/agent-configs
```

期待レスポンス:
```json
{
  "configs": [
    {
      "id": "AICoach",
      "name": "AI Coach",
      "role": "Coach",
      "isBuiltIn": true,
      "capabilities": ["習慣提案", "目標提案", "パターン分析", "スモールステップ生成"]
    }
  ]
}
```
- `isBuiltIn: true` は AICoach のみ
- `habit-coach`, `goal-planner`, `progress-tracker` が含まれる場合は `isBuiltIn: false`

#### テストシナリオ 3: POST /api/agent-configs (カスタム作成)

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Custom Role","description":"テスト用","icon":"🚀","systemPrompt":"テストプロンプト","role":"custom"}' \
  https://<backend-url>/api/agent-configs
```

期待: HTTP 201, `isBuiltIn: false` のカスタム役割が作成される

#### テストシナリオ 4: DELETE /api/agent-configs/AICoach (削除防止)

```bash
curl -X DELETE -H "Authorization: Bearer <token>" \
  https://<backend-url>/api/agent-configs/AICoach
```

期待: HTTP 403, `{ "error": "Cannot delete built-in agent" }`

#### テストシナリオ 5: DELETE /api/agent-configs/<custom-id> (カスタム削除)

```bash
curl -X DELETE -H "Authorization: Bearer <token>" \
  https://<backend-url>/api/agent-configs/custom-1738960000000
```

期待: HTTP 200, `{ "success": true }`

#### テストシナリオ 6: AICoachプロンプト解決

1. AICoachの `instructions` がDBで簡潔なデフォルト ('あなたはVOW...') の場合:
   - `getPromptForUser('AICoach', 'ja', supabase, userId)` が `getCanonicalCoachPrompt('ja')` の内容を返す

2. ユーザーがAICoachの `instructions` をカスタマイズした場合:
   - `PUT /api/agent-configs/AICoach` で `instructions` を更新
   - `getPromptForUser()` がカスタムプロンプトを返す

**完了条件**:
- [x] 全テストシナリオが文書化されている
- [x] 各シナリオの期待結果が明確に定義されている

---

## Dependency Graph (依存関係図)

```
T-001 (DB Migration)  ─────────────────────────┐
  |                                              |
  | (並行可能)                                   |
  v                                              v
T-002 (Backend Service) ──> T-003 (TS check BE) ──> T-006 (Integration Test)
                                                       ^
T-005 (TS check FE) ──────────────────────────────────┘
                                                       ^
T-004 (Frontend Verify) ──────────────────────────────┘
```

- T-001 と T-002 は並行作業可能 (T-001はSQL、T-002はTypeScript)
- T-003 は T-002 の完了が必要
- T-004 は T-002 の完了が必要 (APIレスポンスの確認)
- T-005 は独立して実行可能
- T-006 は T-001, T-002 の完了が必要

---

## Quick Reference: 変更対象ファイル

| ファイル | 操作 | タスク |
|---------|------|--------|
| `supabase/migrations/20260208000002_fix_builtin_agents.sql` | 新規作成 | T-001 |
| `backend/src/services/agent-config-service.ts` | 変更 | T-002 |
| `backend/src/routers/agentConfigs.ts` | 変更不要 | (検証のみ) |
| `backend/src/prompts/prompt-registry.ts` | 変更不要 | (検証のみ) |
| `backend/src/prompts/roles/coach.ts` | 変更不要 | (検証のみ) |
| `frontend/app/dashboard/hooks/useAgentConfigs.ts` | 変更不要 | T-004 |
| `frontend/app/dashboard/components/Agent.ListView.tsx` | 変更不要 | T-004 |
| `frontend/app/dashboard/components/Modal.AgentDetail.tsx` | 変更不要 | T-004 |
| `frontend/app/dashboard/components/Section.MOC.tsx` | 変更不要 | T-004 |
