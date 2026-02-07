# Agent Config Backend Migration - 要件定義

## Overview

- **Purpose**: AICoachのみを全ユーザー共通のビルトイン役割とし、それ以外はユーザーごとにCRUD可能なカスタム役割として管理する。現在のDBマイグレーションが4つのagentを `is_builtin=true` としている不整合を修正し、バックエンド/フロントエンド間の一貫性を確保する。
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect

---

## Core Principle (核心要件)

**「AICoachのみ全ユーザー共通かつデフォルトで使えるビルトイン役割。それ以外はユーザーごとに追加・編集・削除できるカスタム役割。」**

---

## Functional Requirements (機能要件)

### FR-001: ビルトイン役割はAICoachのみ

- `agent_configs` テーブルで `is_builtin=true` となるのは `agent_id='AICoach'` のレコードのみ
- `habit-coach`, `goal-planner`, `progress-tracker` は `is_builtin=true` であってはならない
- DBの `get_or_create_agent_config` 関数は、AICoach以外のagentに対して `is_builtin=true` を設定してはならない

### FR-002: AICoachのデフォルトプロンプトはprompt-registryから取得

- AICoachのデフォルトシステムプロンプトは `backend/src/prompts/roles/coach.ts` の `getCanonicalCoachPrompt()` から取得する
- DBマイグレーションSQL内に長大なプロンプト文字列をハードコードしない
- DB関数 `get_or_create_agent_config` でAICoachを自動生成する際、プロンプトは簡潔なデフォルト値 (例: "AIコーチのデフォルトプロンプト") とする。実際のプロンプト解決はバックエンドサービス層で行う

### FR-003: AICoachの自動生成

- `getAllAgentConfigs` がユーザーのagent一覧を取得する際、AICoachが存在しなければ自動生成する
- 自動生成されるAICoachの属性: `agent_id='AICoach'`, `name='AI Coach'`, `icon='🎯'`, `role='Coach'`, `is_builtin=true`

### FR-004: カスタム役割のCRUD

- ユーザーは任意の数のカスタム役割を作成・編集・削除できる
- カスタム役割の `is_builtin` は常に `false`
- カスタム役割の `agent_id` は `custom-{timestamp}` 形式で自動生成される
- カスタム役割には `name`, `description`, `icon`, `instructions` (システムプロンプト), `role`, `capabilities` を設定可能

### FR-005: AICoach削除の防止

- `DELETE /api/agent-configs/AICoach` は HTTP 403 を返す
- バックエンドサービスの `deleteCustomAgentConfig` は `is_builtin=true` のレコードを削除しない
- フロントエンドのUIでもAICoachに削除ボタンを表示しない (現状通り)

### FR-006: AICoach設定の編集

- ユーザーはAICoachの `instructions` (システムプロンプト) を編集可能
- 編集した場合、ユーザー固有のカスタムプロンプトがDBに保存される
- `prompt-registry.ts` の `getPromptForUser()` は、ユーザーがカスタムプロンプトを設定している場合はそれを返し、未設定の場合は `getCanonicalCoachPrompt()` のデフォルトを返す

### FR-007: フロントエンド表示の整合性

- `useAgentConfigs` hookの `builtInConfigs` にはAICoachのみが含まれる
- `Agent.ListView` でAICoachにのみ "Built-in" (組み込み) バッジを表示
- カスタム役割には "Custom" (カスタム) バッジと編集・削除ボタンを表示
- `BUILTIN_AGENTS` 定数 (Modal.AgentDetail.tsx) はAICoachのみを含む (現状通り)

### FR-008: DEFAULT_AGENT_IDS の修正

- `backend/src/services/agent-config-service.ts` の `DEFAULT_AGENT_IDS` を `['AICoach']` のみに変更
- `getAllAgentConfigs` がユーザー一覧取得時に、不要な `habit-coach`, `goal-planner`, `progress-tracker` の自動生成ループを削除
- AICoachのみを自動生成し、残りはユーザーが作成したカスタム役割のみを返す

---

## Non-Functional Requirements (非機能要件)

### NFR-001: 後方互換性

- 既にDBに `is_builtin=true` で作成された `habit-coach`, `goal-planner`, `progress-tracker` のレコードは、マイグレーションで `is_builtin=false` に更新する
- これらのレコードは削除せず、カスタム役割として残す (ユーザーが手動で削除可能)

### NFR-002: TypeScriptコンパイル

- バックエンド (`backend/`) とフロントエンド (`frontend/`) の両方でTypeScriptコンパイルエラーが発生しないこと
- `DEFAULT_AGENT_IDS` の型変更に伴い、`AGENT_AVAILABLE_TOOLS` の型定義も更新すること

### NFR-003: マイグレーションの冪等性

- 新しいマイグレーション `20260208000002_fix_builtin_agents.sql` は繰り返し実行しても安全であること
- `IF EXISTS` / `IF NOT EXISTS` ガードを適切に使用すること

### NFR-004: プロンプトの分離

- SQLマイグレーション内にビジネスロジック (長大なプロンプト文字列) を含めない
- DBの `get_or_create_agent_config` 関数はスキーマ管理のみを担当し、プロンプト解決はアプリケーション層で行う

---

## Acceptance Criteria (受け入れ基準)

### AC-001: ビルトインagentの限定

DBの `agent_configs` テーブルで `is_builtin=true` のレコードは `agent_id='AICoach'` のもののみであること。

**検証方法**: `SELECT agent_id, is_builtin FROM agent_configs WHERE is_builtin = true;` の結果が `AICoach` のみ。

### AC-002: 不要なビルトインの解除

`habit-coach`, `goal-planner`, `progress-tracker` のレコードが `is_builtin=false` に更新されていること。

**検証方法**: `SELECT agent_id, is_builtin FROM agent_configs WHERE agent_id IN ('habit-coach', 'goal-planner', 'progress-tracker');` で全て `is_builtin=false`。

### AC-003: getAllAgentConfigs の動作

`getAllAgentConfigs(supabase, userId)` の呼び出しで:
1. AICoachが存在しない場合は自動生成される
2. `habit-coach`, `goal-planner`, `progress-tracker` は自動生成されない
3. ユーザーが作成したカスタム役割は全て返される

### AC-004: 削除防止

`DELETE /api/agent-configs/AICoach` が HTTP 403 を返し、AICoachレコードが削除されないこと。

### AC-005: フロントエンド表示

`Agent.ListView` において:
1. AICoachに "組み込み" バッジが表示される
2. カスタム役割に "カスタム" バッジが表示される
3. AICoachに編集・削除ボタンが表示されない
4. カスタム役割に編集・削除ボタンが表示される

### AC-006: TypeScriptコンパイル

`cd backend && npx tsc --noEmit` と `cd frontend && npx next build` (または `npx tsc --noEmit`) がエラーなく完了すること。

### AC-007: プロンプト解決

AICoachのシステムプロンプトが以下の優先順位で解決されること:
1. ユーザーがカスタム設定したプロンプト (DBの `instructions` カラム、空でない場合)
2. `getCanonicalCoachPrompt()` のデフォルトプロンプト (coach.ts)

### AC-008: マイグレーションの安全性

`20260208000002_fix_builtin_agents.sql` を2回以上実行してもエラーが発生しないこと。

---

## Out of Scope (スコープ外)

- role-based-prompt-system の完全統合 (別仕様: `specs/role-based-prompt-system/`)
- `prompt-registry.ts` の `buildFullPrompt()` のenhancement layers変更
- MCP経由のプロンプト取得フロー変更
- `Section.Coach.tsx` / `Section.AIHub.tsx` のインラインプロンプト修正
- ユーザーレベルのプロンプトカスタマイズUI (将来機能)
- AGENT_AVAILABLE_TOOLS のカスタム役割への拡張
