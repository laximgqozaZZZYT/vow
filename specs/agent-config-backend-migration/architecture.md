# Agent Config Backend Migration - 技術設計

## Overview

- **Purpose**: DB/バックエンド/フロントエンド間で「AICoachのみビルトイン」の一貫性を実現するための技術設計
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect

---

## 1. Current State (現状の問題構造)

### 1.1 DB層の不整合

```
現状:
  20260208000001_agent_configs_role_capabilities.sql
    UPDATE agent_configs SET is_builtin = true WHERE agent_id = 'AICoach';
    UPDATE agent_configs SET is_builtin = true WHERE agent_id = 'habit-coach';      <- 問題
    UPDATE agent_configs SET is_builtin = true WHERE agent_id = 'goal-planner';     <- 問題
    UPDATE agent_configs SET is_builtin = true WHERE agent_id = 'progress-tracker'; <- 問題

  get_or_create_agent_config() 関数:
    CASE 'AICoach' -> is_builtin = true, instructions = ~80行のプロンプト
    CASE 'habit-coach' -> is_builtin = true, instructions = ~30行のプロンプト    <- 問題
    CASE 'goal-planner' -> is_builtin = true, instructions = ~30行のプロンプト   <- 問題
    CASE 'progress-tracker' -> is_builtin = true, instructions = ~30行のプロンプト <- 問題
    ELSE -> is_builtin = false

目標:
  get_or_create_agent_config() 関数:
    CASE 'AICoach' -> is_builtin = true, instructions = 簡潔なデフォルト
    ELSE -> is_builtin = false, instructions = ''
```

### 1.2 バックエンドサービス層の不整合

```
現状:
  agent-config-service.ts:
    DEFAULT_AGENT_IDS = ['AICoach', 'habit-coach', 'goal-planner', 'progress-tracker']
    getAllAgentConfigs() -> 4つのデフォルトagentを全て自動生成

目標:
  agent-config-service.ts:
    BUILTIN_AGENT_ID = 'AICoach'  (定数を1つに)
    getAllAgentConfigs() -> AICoachのみ自動生成 + カスタム役割をSELECT
```

### 1.3 フロントエンド (現状正しい)

```
現状 (正しい):
  Modal.AgentDetail.tsx:
    BUILTIN_AGENTS = { AICoach: { ... isBuiltIn: true } }  <- AICoachのみ OK

  useAgentConfigs.ts:
    builtInConfigs = configs.filter(c => c.isBuiltIn)  <- APIレスポンスに依存

  Agent.ListView.tsx:
    builtInRoles -> "組み込み" バッジ表示
    customAgents -> "カスタム" バッジ + 編集/削除ボタン表示
```

---

## 2. Architecture Changes (変更設計)

### 2.1 Phase 1: DB Migration Fix

**新規ファイル**: `supabase/migrations/20260208000002_fix_builtin_agents.sql`

このマイグレーションは以下を実行する:

#### 2.1.1 既存レコードの is_builtin 修正

```sql
-- habit-coach, goal-planner, progress-tracker の is_builtin を false に変更
UPDATE agent_configs
SET is_builtin = false
WHERE agent_id IN ('habit-coach', 'goal-planner', 'progress-tracker')
  AND is_builtin = true;
```

#### 2.1.2 get_or_create_agent_config 関数の簡素化

修正後の関数ロジック:

```
入力: p_user_id, p_agent_id
処理:
  1. SELECT * FROM agent_configs WHERE user_id = p_user_id AND agent_id = p_agent_id
  2. IF FOUND THEN RETURN (既存レコード)
  3. IF p_agent_id = 'AICoach' THEN
       INSERT (
         agent_id = 'AICoach',
         name = 'AI Coach',
         icon = '🎯',
         description = '習慣・目標のAIコーチ',
         role = 'Coach',
         capabilities = '["習慣提案", "目標提案", "パターン分析", "スモールステップ生成"]',
         is_builtin = true,
         instructions = 'あなたはVOW（習慣・目標トラッカー）のAIコーチです。'
       )
     ELSE
       INSERT (
         agent_id = p_agent_id,
         name = p_agent_id,
         icon = '🤖',
         description = 'カスタムエージェント',
         role = 'custom',
         capabilities = '[]',
         is_builtin = false,
         instructions = ''
       )
  4. RETURN 新規レコード
```

**設計判断**: AICoachの `instructions` にはDB層では簡潔なデフォルト (1行) を設定する。実際のプロンプト解決は `prompt-registry.ts` の `getPromptForUser()` で行う。これにより:
- SQLマイグレーションにビジネスロジックが混入しない
- プロンプトの更新にDBマイグレーションが不要
- Single Source of Truth が `backend/src/prompts/roles/coach.ts` に維持される

### 2.2 Phase 2: Backend Service Adjustments

#### 2.2.1 agent-config-service.ts の変更

**変更ファイル**: `backend/src/services/agent-config-service.ts`

変更点:

| 項目 | Before | After |
|------|--------|-------|
| `DEFAULT_AGENT_IDS` | `['AICoach', 'habit-coach', 'goal-planner', 'progress-tracker']` | 削除 |
| `BUILTIN_AGENT_ID` | (なし) | `'AICoach'` (新規定数) |
| `DefaultAgentId` | union of 4 IDs | 削除 |
| `AGENT_AVAILABLE_TOOLS` | Record<DefaultAgentId, string[]> | `Record<string, string[]>` (キーは `'AICoach'` のみ残す、将来カスタム対応可能) |
| `getAllAgentConfigs()` | 4つのデフォルトagentを全てループで自動生成 | AICoachのみ `getAgentConfig` で自動生成保証 |

##### getAllAgentConfigs の修正後フロー

```
入力: supabase, userId
処理:
  1. await getAgentConfig(supabase, userId, 'AICoach')
     // AICoachが存在しなければ自動生成
  2. SELECT * FROM agent_configs WHERE user_id = userId ORDER BY created_at ASC
     // AICoach + ユーザーのカスタム役割全てを取得
  3. return results.map(rowToAgentConfig)
```

##### deleteCustomAgentConfig の変更

現状のロジックは既に正しい (`is_builtin` チェックあり)。変更不要。ただし `logger.warning` -> `logger.warn` の修正が必要な場合はここで対応する。

#### 2.2.2 agentConfigs.ts (Router) の変更

**変更ファイル**: `backend/src/routers/agentConfigs.ts`

変更は不要。Router層のロジックはサービス層に委譲しており、サービス層の変更で自動的に正しく動作する。

検証ポイント:
- `GET /api/agent-configs` -> AICoach + カスタム役割のみ返る
- `DELETE /api/agent-configs/AICoach` -> 403 (既存ロジックで対応済み)
- `POST /api/agent-configs` -> カスタム役割の作成 (変更不要)

### 2.3 Phase 3: Frontend Verification

**変更対象なし** (フロントエンドは現状正しい構造)

ただし、以下の動作検証が必要:

| コンポーネント | 期待動作 | 検証方法 |
|---------------|---------|---------|
| `useAgentConfigs` | `builtInConfigs` にAICoachのみ含まれる | APIレスポンスの `isBuiltIn` フラグ確認 |
| `Agent.ListView` | AICoachに "組み込み" バッジ | UIの目視確認 |
| `Agent.ListView` | カスタム役割に "カスタム" バッジ + 編集/削除ボタン | UIの目視確認 |
| `Modal.AgentDetail` | AICoachの詳細表示 | UIの目視確認 |
| `BUILTIN_AGENTS` | AICoachのみ定義 | コード確認 (既に正しい) |

---

## 3. File Change Matrix (変更ファイル一覧)

### 3.1 新規作成

| ファイルパス | 説明 |
|------------|------|
| `supabase/migrations/20260208000002_fix_builtin_agents.sql` | ビルトイン修正マイグレーション |

### 3.2 変更

| ファイルパス | 変更箇所 | 変更内容 |
|------------|---------|---------|
| `backend/src/services/agent-config-service.ts` | L59 `DEFAULT_AGENT_IDS` | `['AICoach']` に変更、または `BUILTIN_AGENT_ID = 'AICoach'` に置換 |
| `backend/src/services/agent-config-service.ts` | L60 `DefaultAgentId` | 型定義の更新 |
| `backend/src/services/agent-config-service.ts` | L65-70 `AGENT_AVAILABLE_TOOLS` | `habit-coach`, `goal-planner`, `progress-tracker` のエントリ削除。型を `Record<string, string[]>` に変更 |
| `backend/src/services/agent-config-service.ts` | L133-160 `getAllAgentConfigs()` | AICoachのみの自動生成に修正 |

### 3.3 変更不要 (検証のみ)

| ファイルパス | 理由 |
|------------|------|
| `backend/src/routers/agentConfigs.ts` | サービス層に委譲、変更不要 |
| `backend/src/prompts/prompt-registry.ts` | 既にAICoachのプロンプト解決を正しく実装 |
| `backend/src/prompts/roles/coach.ts` | AICoachの正規プロンプトの Single Source of Truth。変更不要 |
| `frontend/app/dashboard/hooks/useAgentConfigs.ts` | APIレスポンスに依存、変更不要 |
| `frontend/app/dashboard/components/Agent.ListView.tsx` | `isBuiltIn` フラグで表示分岐、変更不要 |
| `frontend/app/dashboard/components/Modal.AgentDetail.tsx` | `BUILTIN_AGENTS` にAICoachのみ定義済み、変更不要 |
| `frontend/app/dashboard/components/Section.MOC.tsx` | `useAgentConfigs` 経由で取得、変更不要 |

---

## 4. Data Flow (修正後のデータフロー)

### 4.1 初回ユーザーアクセス時

```
Frontend: GET /api/agent-configs
  |
  v
Backend: agentConfigs.ts (GET /)
  |
  v
Backend: agent-config-service.ts getAllAgentConfigs(supabase, userId)
  |
  +-- getAgentConfig(supabase, userId, 'AICoach')
  |     |
  |     v
  |   DB: get_or_create_agent_config('AICoach')
  |     -> AICoach レコードが存在しなければ INSERT (is_builtin=true)
  |     -> 既存なら SELECT して返す
  |
  +-- SELECT * FROM agent_configs WHERE user_id = userId
  |     -> AICoach (1件) のみ
  |
  v
Backend -> Frontend: { configs: [{ id: 'AICoach', isBuiltIn: true, ... }] }
  |
  v
Frontend: useAgentConfigs
  builtInConfigs = [AICoach]
  customConfigs = []
```

### 4.2 カスタム役割追加後

```
Frontend: POST /api/agent-configs { name: 'My Custom Coach', role: 'custom', ... }
  |
  v
Backend: createCustomAgentConfig(supabase, userId, { ... })
  -> INSERT (agent_id='custom-1738960000000', is_builtin=false)
  |
  v
Frontend: GET /api/agent-configs (refresh)
  |
  v
Backend -> Frontend: {
  configs: [
    { id: 'AICoach', isBuiltIn: true, ... },
    { id: 'custom-1738960000000', isBuiltIn: false, ... }
  ]
}
  |
  v
Frontend: useAgentConfigs
  builtInConfigs = [AICoach]
  customConfigs = [My Custom Coach]
```

### 4.3 AICoachのプロンプト解決

```
チャット時のプロンプト解決:
  |
  v
prompt-registry.ts: getPromptForUser('AICoach', 'ja', supabase, userId)
  |
  +-- DB: SELECT instructions FROM agent_configs
  |        WHERE user_id = userId AND agent_id = 'AICoach'
  |
  +-- IF instructions が空でない
  |     -> ユーザーカスタムプロンプトを返す
  |
  +-- ELSE
        -> getCanonicalCoachPrompt('ja') を返す
           (backend/src/prompts/roles/coach.ts の正規プロンプト)
```

---

## 5. Migration SQL Design (マイグレーション詳細)

### 5.1 ファイル名

`supabase/migrations/20260208000002_fix_builtin_agents.sql`

### 5.2 構成

```sql
-- Part 1: 既存レコードの is_builtin 修正
UPDATE agent_configs SET is_builtin = false
WHERE agent_id IN ('habit-coach', 'goal-planner', 'progress-tracker')
  AND is_builtin = true;

-- Part 2: get_or_create_agent_config 関数の置換
CREATE OR REPLACE FUNCTION get_or_create_agent_config(
  p_user_id UUID,
  p_agent_id TEXT
) RETURNS agent_configs AS $$
DECLARE
  v_config agent_configs;
BEGIN
  -- 既存レコードを検索
  SELECT * INTO v_config FROM agent_configs
  WHERE user_id = p_user_id AND agent_id = p_agent_id;

  IF FOUND THEN
    RETURN v_config;
  END IF;

  -- AICoachのみビルトインとして新規作成
  IF p_agent_id = 'AICoach' THEN
    INSERT INTO agent_configs (
      user_id, agent_id, name, description, icon, instructions,
      role, capabilities, is_builtin
    ) VALUES (
      p_user_id, 'AICoach', 'AI Coach', '習慣・目標のAIコーチ', '🎯',
      'あなたはVOW（習慣・目標トラッカー）のAIコーチです。',
      'Coach',
      '["習慣提案", "目標提案", "パターン分析", "スモールステップ生成"]'::jsonb,
      true
    ) RETURNING * INTO v_config;
  ELSE
    -- カスタムagentとして新規作成
    INSERT INTO agent_configs (
      user_id, agent_id, name, description, icon, instructions,
      role, capabilities, is_builtin
    ) VALUES (
      p_user_id, p_agent_id, p_agent_id, 'カスタムエージェント', '🤖',
      '',
      'custom',
      '[]'::jsonb,
      false
    ) RETURNING * INTO v_config;
  END IF;

  RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.3 冪等性の保証

- `UPDATE ... WHERE ... AND is_builtin = true`: 既に `false` であれば更新なし (安全)
- `CREATE OR REPLACE FUNCTION`: 関数が存在する場合は置換、存在しない場合は新規作成 (安全)
- データ削除なし: 既存のユーザーデータは保持される

---

## 6. Risk Assessment (リスク分析)

### 6.1 低リスク

| リスク | 対策 |
|--------|------|
| 既にDBに作成された habit-coach 等のレコードが is_builtin=false になる | ユーザーのカスタム役割として残り続けるため、データ損失なし |
| `DEFAULT_AGENT_IDS` 変更による型エラー | `AGENT_AVAILABLE_TOOLS` の型も合わせて更新 |

### 6.2 中リスク

| リスク | 対策 |
|--------|------|
| AICoachの instructions が簡潔なデフォルトのみだと、DB直接参照時に不十分 | `prompt-registry.ts` の `getPromptForUser()` がフォールバックとして正規プロンプトを返す |
| 既存ユーザーの habit-coach 等の設定が is_builtin=false になることで、ユーザーに影響 | 機能面では変わらない (削除可能になるだけ)。ユーザーの設定データは保持される |

### 6.3 対策不要

| リスク | 理由 |
|--------|------|
| フロントエンドの `BUILTIN_AGENTS` 定数に影響 | 現状AICoachのみ定義済みのため変更不要 |
| `useAgentConfigs` hookの動作に影響 | APIレスポンスの `isBuiltIn` フラグに依存しており、バックエンド修正で自動的に正しく動作 |

---

## 7. Agent Coordination Notes (エージェント調整)

### 7.1 並行作業の可能性

| Phase | 並行可否 | 依存関係 |
|-------|---------|---------|
| Phase 1 (DB Migration) | 独立して実施可能 | なし |
| Phase 2 (Backend Service) | Phase 1 と並行可能 | Phase 1 完了後にテスト可能 |
| Phase 3 (Frontend Verification) | Phase 2 完了後 | Phase 2 のAPI動作確認が前提 |
| Phase 4 (Integration Test) | Phase 1-3 完了後 | 全体の統合テスト |

### 7.2 担当分離の推奨

| タスク | 推奨担当 |
|--------|---------|
| DB Migration SQL作成 | implementer (backend) |
| agent-config-service.ts 修正 | implementer (backend) |
| TypeScript コンパイルチェック | tester |
| フロントエンド動作確認 | code-reviewer or tester |

### 7.3 注意事項

- `20260208000001_agent_configs_role_capabilities.sql` は既存マイグレーションとして残す。削除や修正はしない
- 新しいマイグレーション `20260208000002_fix_builtin_agents.sql` で上書き修正する
- `prompt-registry.ts` と `coach.ts` は変更しない。これらは role-based-prompt-system 仕様の管轄
- フロントエンドのコード変更は不要だが、表示の正確性を検証する必要がある
