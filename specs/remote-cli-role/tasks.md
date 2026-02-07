# Remote CLI Role - Implementation Tasks

## Overview

- **Purpose**: Remote CLIロール機能の実装タスク分解。サブエージェント並列実行を前提に設計。
- **Status**: Draft
- **Version**: 1.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect
- **Prerequisites**: `requirements.md`, `design.md` 参照

---

## Task Dependency Graph (依存関係図)

```
Phase 1 (並列実行可能)
├─ TASK-01: AgentRole型拡張 + remoteCliRole定義  [Agent B: Frontend Logic]
├─ TASK-02: prompt_templates DBマイグレーション    [Agent D: Backend/DB]
└─ TASK-03: MCPサーバ選択肢抽出ユーティリティ     [Agent B: Frontend Logic]

Phase 2 (TASK-01に依存)
├─ TASK-04: useRoleSelection Hook                  [Agent B: Frontend Logic]
├─ TASK-05: Chat.RoleSelector コンポーネント        [Agent A: Frontend Components]
└─ TASK-06: useMcpChat 複数回答連投サポート         [Agent C: Streaming] ← 独立

Phase 3 (TASK-04, TASK-05に依存)
└─ TASK-07: Section.MOC.tsx 統合                    [Agent A: Frontend Components]

Phase 4 (TASK-07に依存)
├─ TASK-08: Remote CLI用メッセージ表示分岐         [Agent A: Frontend Components]
└─ TASK-09: MCPサーバ選択肢のReply表示統合         [Agent A: Frontend Components]

Phase 5 (全タスク完了後)
└─ TASK-10: E2Eテスト + 手動検証                   [Agent Tester]
```

---

## Phase 1: 基盤作成 (並列実行可能)

### TASK-01: AgentRole型拡張 + remoteCliRole定義

**Assignable to**: implementer (Frontend Logic)
**Prerequisite**: なし
**Estimated effort**: Small
**Files to modify**:
- `frontend/app/dashboard/constants/role-prompts.ts`

**Description**:

`AgentRole` ユニオン型に `'remoteCli'` を追加し、`ROLE_CONFIGS` に `remoteCliRole` の `RoleConfig` を追加する。

**Steps**:

1. `AgentRole` 型に `'remoteCli'` を追加:
   ```typescript
   export type AgentRole =
     | 'AICoach'
     | 'coach'
     | 'manager'
     | 'developer'
     | 'reviewer'
     | 'tester'
     | 'analyst'
     | 'architect'
     | 'remoteCli'    // ADD
     | 'default';
   ```

2. `RoleConfig` インターフェースに新フィールドを追加:
   ```typescript
   export interface RoleConfig {
     // ... 既存フィールド ...
     /** MCP限定ロールかどうか (default: false) */
     mcpOnly?: boolean;
     /** レスポンス形式 (default: 'json') */
     responseFormat?: 'json' | 'markdown' | 'plain';
     /** このロール用の候補ボタン定義 */
     quickActions?: Array<{
       id: string;
       label: { ja: string; en: string; };
       command: { ja: string; en: string; };
     }>;
   }
   ```

3. `remoteCliRole` の `RoleConfig` を定義（`design.md` Section 2.3参照）

4. `ROLE_CONFIGS` に追加:
   ```typescript
   export const ROLE_CONFIGS: Record<AgentRole, RoleConfig> = {
     // ... 既存 ...
     remoteCli: remoteCliRole,
   };
   ```

5. 既存の `getAvailableRoles()` が自動的に `remoteCli` を含むことを確認

**Acceptance Criteria**:
- [ ] `ROLE_CONFIGS.remoteCli` が定義されている
- [ ] `getRoleConfig('remoteCli')` がRemote CLIのRoleConfigを返す
- [ ] `getRoleSystemPrompt('remoteCli', 'ja')` がMarkdown応答を指示するプロンプトを返す
- [ ] `getAvailableRoles()` のリストに `remoteCli` が含まれる
- [ ] 既存の型チェック (`tsc --noEmit`) がパスする
- [ ] `remoteCliRole.mcpOnly` が `true` である

---

### TASK-02: prompt_templates DBマイグレーション

**Assignable to**: implementer (Backend/DB)
**Prerequisite**: なし
**Estimated effort**: Small
**Files to create/modify**:
- `supabase/migrations/YYYYMMDD_add_remote_cli_prompt.sql` (新規)

**Description**:

Supabaseの `prompt_templates` テーブルに Remote CLI 用のプロンプトテンプレートを追加する。日本語と英語の2レコード。

**Steps**:

1. マイグレーションファイルを作成:
   ```sql
   -- Add Remote CLI prompt template (Japanese)
   INSERT INTO prompt_templates (template_key, locale, content, description, version)
   VALUES (
     'remote-cli',
     'ja',
     '(design.md Section 5.1のプロンプト内容)',
     'Remote CLI role system prompt',
     '1.0'
   )
   ON CONFLICT (template_key, locale) DO UPDATE SET
     content = EXCLUDED.content,
     version = EXCLUDED.version;

   -- Add Remote CLI prompt template (English)
   INSERT INTO prompt_templates (template_key, locale, content, description, version)
   VALUES (
     'remote-cli',
     'en',
     '(design.md Section 2.3の英語プロンプト内容)',
     'Remote CLI role system prompt',
     '1.0'
   )
   ON CONFLICT (template_key, locale) DO UPDATE SET
     content = EXCLUDED.content,
     version = EXCLUDED.version;
   ```

2. マイグレーションを適用して動作確認

**Acceptance Criteria**:
- [ ] `prompt_templates` テーブルに `template_key='remote-cli'` のレコードが ja/en 両方存在する
- [ ] `GET /api/prompt-templates/remote-cli?locale=ja` が正常レスポンスを返す
- [ ] `GET /api/prompt-templates/remote-cli?locale=en` が正常レスポンスを返す

---

### TASK-03: MCPサーバ選択肢抽出ユーティリティ

**Assignable to**: implementer (Frontend Logic)
**Prerequisite**: なし
**Estimated effort**: Small
**Files to create**:
- `frontend/app/dashboard/utils/mcpSuggestions.ts` (新規)

**Description**:

MCPサーバの `toolCalls` 出力から選択肢データを抽出するユーティリティ関数を作成する。

**Steps**:

1. `McpSuggestion` インターフェースを定義
2. `extractMcpSuggestions(toolCalls)` 関数を実装（`design.md` Section 4.3参照）
3. 3つの入力パターン対応:
   - `output.suggestions: McpSuggestion[]`
   - `output.options: {label, value}[]`
   - `output.choices: string[]`
4. ユニットテストを作成

**Acceptance Criteria**:
- [ ] `extractMcpSuggestions([])` が `[]` を返す
- [ ] `extractMcpSuggestions(undefined)` が `[]` を返す
- [ ] `suggestions` パターンが正しく抽出される
- [ ] `options` パターンが正しく抽出される
- [ ] `choices` パターンが正しく抽出される
- [ ] 不正な入力データでクラッシュしない

---

## Phase 2: Hooks & Components (TASK-01完了後)

### TASK-04: useRoleSelection Hook

**Assignable to**: implementer (Frontend Logic)
**Prerequisite**: TASK-01
**Estimated effort**: Medium
**Files to create**:
- `frontend/app/dashboard/hooks/useRoleSelection.ts` (新規)

**Description**:

ロール選択状態を管理するカスタムHookを作成する。localStorage永続化、MCP制約フォールバックを含む。

**Steps**:

1. `UseRoleSelectionOptions` と `UseRoleSelectionReturn` インターフェースを定義（`design.md` Section 2.2参照）
2. `useRoleSelection` Hook本体を実装:
   - `localStorage` からの初期値復元
   - `switchRole()` でのlocalStorage保存
   - MCPフォールバック Effect
   - `availableRoles` の構築（`getAvailableRoles()` + `mcpOnly` フラグ）
3. `RoleOption` 型をエクスポート

**Key Logic**:
```typescript
const ROLE_STORAGE_KEY = 'vow_selected_role';

// MCPフォールバック
useEffect(() => {
  if (!isMcpSelected && selectedRole === 'remoteCli') {
    setSelectedRole('AICoach');
    if (typeof window !== 'undefined') {
      localStorage.setItem(ROLE_STORAGE_KEY, 'AICoach');
    }
  }
}, [isMcpSelected, selectedRole]);
```

**Acceptance Criteria**:
- [ ] デフォルトロールが `'AICoach'` である
- [ ] `switchRole('remoteCli')` 後に `selectedRole` が `'remoteCli'` になる
- [ ] localStorage に保存される
- [ ] MCP非選択時にremoteCliからAICoachへフォールバックする
- [ ] `isRemoteCli` が正しくtrueを返す
- [ ] `isRemoteCliEnabled` が isMcpSelected と連動する

---

### TASK-05: Chat.RoleSelector コンポーネント

**Assignable to**: implementer (Frontend Components)
**Prerequisite**: TASK-01, TASK-04
**Estimated effort**: Small
**Files to create**:
- `frontend/app/dashboard/components/Chat.RoleSelector.tsx` (新規)

**Description**:

ロール選択ドロップダウンUIコンポーネントを作成する。ProviderSelectorと同じデザインパターンを踏襲する。

**Steps**:

1. `RoleSelectorProps` インターフェースを定義（`design.md` Section 4.1参照）
2. `<select>` ベースのドロップダウンを実装
3. MCP限定ロールのdisabled制御を実装
4. CSSクラスを `ProviderSelector` と統一
5. `aria-label` を設定

**参考ファイル**: `Chat.ProviderSelector.tsx` のコード構造をそのまま踏襲すること

**UI仕様**:
- ラベル: `ロール:` (ja) / `Role:` (en)
- MCP限定ロールは disabled 時に `(MCP限定)` のサフィックスを表示
- `ProviderSelector` と同じ `text-xs`, `bg-background`, `border-border` のCSSクラス

**Acceptance Criteria**:
- [ ] ドロップダウンが表示される
- [ ] AICoachがデフォルト選択されている
- [ ] MCPサーバ選択時にRemote CLIが有効になる
- [ ] APIプロバイダー選択時にRemote CLIがdisabledになる
- [ ] ロール選択変更で `onSelect` が呼ばれる
- [ ] `aria-label` が設定されている

---

### TASK-06: useMcpChat 複数回答連投サポート

**Assignable to**: implementer (Streaming)
**Prerequisite**: なし (Phase 1と並列可能、ただしテスト時にTASK-01が必要)
**Estimated effort**: Medium
**Files to modify**:
- `frontend/app/dashboard/hooks/useMcpChat.ts`

**Description**:

`useMcpChat` を修正して、1つのユーザーメッセージに対する複数の `complete` イベントを、それぞれ別のアシスタントメッセージとして表示できるようにする。

**Steps**:

1. `sendMessage` 内のストリーミング処理に `responseCount` カウンターを追加
2. `complete` イベント受信時:
   - 現在のメッセージを `complete` にマーク
   - `responseCount` をインクリメント
   - 新しい `assistantMessageId` を生成 (`${baseId}-${responseCount}`)
   - `fullContent` をリセット
   - 新しいプレースホルダーメッセージを追加
3. `[DONE]` 受信時:
   - 空のプレースホルダーメッセージを削除
4. `token` イベントが新しい `assistantMessageId` に対応するよう更新

**Design Reference**: `design.md` Section 4.4

**注意事項**:
- 既存の単一応答動作を壊さないこと（`responseCount === 0` の場合は現在と同じ動作）
- `isStreaming` は全応答が完了するまで `true` を維持
- `[DONE]` が来なかった場合のタイムアウト（30秒）を設定

**Acceptance Criteria**:
- [ ] 単一応答の場合、現在と同じ動作をする（回帰なし）
- [ ] 複数 `complete` イベント受信時、別々のメッセージバブルとして表示される
- [ ] `[DONE]` 後に空プレースホルダーが残らない
- [ ] `isStreaming` が全応答完了後に `false` になる
- [ ] 30秒タイムアウトで自動完了する

---

## Phase 3: MOCセクション統合 (Phase 2完了後)

### TASK-07: Section.MOC.tsx 統合

**Assignable to**: implementer (Frontend Components)
**Prerequisite**: TASK-04, TASK-05
**Estimated effort**: Large
**Files to modify**:
- `frontend/app/dashboard/components/Section.MOC.tsx`
- `frontend/app/dashboard/components/Chat.ProviderSelector.tsx` (微修正)

**Description**:

Section.MOC.tsx に RoleSelector を統合し、ロール選択に応じた候補ボタンの切り替え、システムプロンプトの切り替えを実装する。

**Steps**:

1. **Import追加**:
   ```typescript
   import { RoleSelector } from './Chat.RoleSelector';
   import { useRoleSelection } from '../hooks/useRoleSelection';
   ```

2. **useRoleSelection Hook呼び出し** (L339付近、useAIProviderの後):
   ```typescript
   const {
     selectedRole,
     switchRole,
     availableRoles,
     isRemoteCli,
     isRemoteCliEnabled,
     roleConfig,
   } = useRoleSelection({ isMcpSelected: isMcp, locale });
   ```

3. **useRolePrompt のロール切り替え** (L310付近):
   ```typescript
   // 変更前:
   // const { prompt: aiCoachSystemPrompt } = useRolePrompt('AICoach', locale, { authToken });
   // 変更後:
   const { prompt: currentSystemPrompt, source: promptSource } = useRolePrompt(
     selectedRole, locale, { authToken }
   );
   ```

4. **useMcpChat の systemMessage 切り替え** (L324付近):
   ```typescript
   const mcpChat = useMcpChat({
     server: selectedMcpServer,
     agentId: selectedMcpAgentId,
     settings: server.chatAgentSettings,
     enableStreaming: true,
     systemMessage: currentSystemPrompt,  // ← 変更: selectedRoleに応じたプロンプト
     userId: userId,
     onError: (error) => {
       console.error('[MOCSection] Chat error:', error);
     },
   });
   ```

5. **ProviderSelector + RoleSelector の配置** (L1519付近):
   ```tsx
   <div className="flex items-center gap-0 border-b border-border">
     <ProviderSelector
       providers={availableProviders}
       selectedId={selectedProvider?.id || ''}
       onSelect={switchProvider}
     />
     <RoleSelector
       availableRoles={availableRoles}
       selectedRoleId={selectedRole}
       onSelect={switchRole}
       isMcpSelected={isMcp}
       locale={locale}
     />
   </div>
   ```

6. **ProviderSelector の border-b 削除** (`Chat.ProviderSelector.tsx`):
   ```typescript
   // 変更前:
   <div className="flex items-center gap-2 px-2 py-1 border-b border-border">
   // 変更後:
   <div className="flex items-center gap-2 px-2 py-1">
   ```

7. **quickActions のロール分岐** (L932付近):
   ```typescript
   const quickActions = useMemo(() => {
     if (isRemoteCli && roleConfig.quickActions) {
       return roleConfig.quickActions.map(action => ({
         id: action.id,
         label: locale === 'ja' ? action.label.ja : action.label.en,
         command: locale === 'ja' ? action.command.ja : action.command.en,
       }));
     }
     // 既存のAICoach用quickActions
     const baseActions = [ ... ];
     // ...
   }, [locale, habits, goals, isRemoteCli, roleConfig]);
   ```

8. **ウェルカムメッセージのロール分岐** (L1601付近):
   ```tsx
   <p className="text-sm font-medium text-foreground">
     {isRemoteCli
       ? (locale === 'ja' ? 'Remote CLI - 何を実行しますか？' : 'Remote CLI - What would you like to run?')
       : (locale === 'ja' ? 'ようこそ！何をお手伝いしましょうか？' : 'Welcome! How can I help you?')}
   </p>
   ```

**Acceptance Criteria**:
- [ ] AIプルダウンの横にロールプルダウンが表示される
- [ ] ロール切替でシステムプロンプトが変わる
- [ ] Remote CLI選択時にCLI用候補ボタンが表示される
- [ ] AICoach選択時に従来の候補ボタンが表示される
- [ ] AIプロバイダー切替時のRemote CLIフォールバックが動作する
- [ ] 既存のAICoachチャット動作に回帰がない

---

## Phase 4: Remote CLI固有機能 (Phase 3完了後)

### TASK-08: Remote CLI用メッセージ表示分岐

**Assignable to**: implementer (Frontend Components)
**Prerequisite**: TASK-07
**Estimated effort**: Medium
**Files to modify**:
- `frontend/app/dashboard/components/Section.MOC.tsx` (メッセージ表示部分)

**Description**:

Remote CLIモードでは `AICandidateResponse` パースをスキップし、応答をMarkdownとしてそのまま表示する。

**Steps**:

1. `useEffect` (L462付近, AI候補レスポンスパース) に `isRemoteCli` ガードを追加:
   ```typescript
   useEffect(() => {
     // Remote CLIモードではAICandidateResponseのパースをスキップ
     if (isRemoteCli) return;

     // 既存のパースロジック...
   }, [messages, isRemoteCli]);
   ```

2. `GroupChatView` のメッセージレンダリングで分岐:
   - AICoach: `extractAICandidateResponse()` → `CandidateDisplay`
   - Remote CLI: `ReactMarkdown` でそのまま表示

3. Remote CLIモード時、`candidateResponses` mapをクリア

**Acceptance Criteria**:
- [ ] Remote CLIモードでMarkdown応答が正しく表示される
- [ ] Remote CLIモードでAICandidateResponseパースが行われない
- [ ] AICoachモードに戻した場合、AIコーチの候補表示が正常に動作する

---

### TASK-09: MCPサーバ選択肢のReply表示統合

**Assignable to**: implementer (Frontend Components)
**Prerequisite**: TASK-03, TASK-07
**Estimated effort**: Medium
**Files to modify**:
- `frontend/app/dashboard/components/Section.MOC.tsx`
- `frontend/app/dashboard/hooks/useMcpChat.ts`

**Description**:

MCPサーバの `complete` イベント内の選択肢データを抽出し、Reply型候補ボタンとして表示する。

**Steps**:

1. `useMcpChat.ts` の `complete` イベント処理で `extractMcpSuggestions` を呼び出し:
   ```typescript
   import { extractMcpSuggestions } from '../utils/mcpSuggestions';

   // complete イベント内:
   const suggestions = extractMcpSuggestions(toolCalls);
   ```

2. `MastraMessage` に `mcpSuggestions` フィールドを追加（オプショナル）:
   ```typescript
   export interface MastraMessage {
     // ... 既存 ...
     mcpSuggestions?: McpSuggestion[];
   }
   ```

3. `Section.MOC.tsx` の `useEffect` (activeAgent.messages → GroupChatMessage変換) で `mcpSuggestions` を `quickReplies` にマッピング:
   ```typescript
   quickReplies: msg.mcpSuggestions?.map(s => ({
     id: `mcp-${s.label}`,
     label: s.label,
     value: s.value,
     icon: s.icon,
   })),
   ```

4. `GroupChatView` で `quickReplies` 付きメッセージの後にReplyボタンを表示

5. Reply型ボタンクリック時に `handleQuickAction(suggestion.value)` を呼び出し

**Acceptance Criteria**:
- [ ] MCPサーバが `suggestions` を返した場合、Reply型ボタンが表示される
- [ ] MCPサーバが `options` を返した場合、Reply型ボタンが表示される
- [ ] MCPサーバが `choices` を返した場合、Reply型ボタンが表示される
- [ ] Reply型ボタンクリックでメッセージが送信される
- [ ] 選択肢がない場合、Reply型ボタンは表示されない

---

## Phase 5: 検証

### TASK-10: E2Eテスト + 手動検証

**Assignable to**: tester
**Prerequisite**: TASK-07, TASK-08, TASK-09, TASK-06
**Estimated effort**: Medium

**Description**:

全機能の統合テストと手動検証を実施する。

**Test Scenarios**:

1. **ロール選択テスト**:
   - [ ] 初回アクセス時にAICoachがデフォルト選択されている
   - [ ] ロールプルダウンの選択肢が表示される
   - [ ] Remote CLIを選択できる（MCP選択時）
   - [ ] Remote CLIを選択できない（APIプロバイダー選択時）
   - [ ] MCPからAPIに切替時にRemote CLIからAICoachにフォールバック
   - [ ] ロール選択がページリロード後も維持される

2. **候補ボタン差し替えテスト**:
   - [ ] AICoach時に従来の候補ボタン（習慣追加、ゴール設定等）が表示
   - [ ] Remote CLI時にCLI用候補ボタン（プロジェクト状態確認等）が表示
   - [ ] ロール切替時に候補ボタンが即座に切り替わる

3. **Remote CLIチャットテスト**:
   - [ ] Remote CLIモードでメッセージを送信できる
   - [ ] 応答がMarkdown形式で表示される
   - [ ] コードブロックが正しくレンダリングされる
   - [ ] ストリーミング表示がリアルタイムに近い

4. **複数回答連投テスト**:
   - [ ] MCPサーバが複数の `complete` イベントを送った場合、別々のメッセージとして表示
   - [ ] 単一応答の場合は従来通り動作

5. **MCPサーバ選択肢テスト**:
   - [ ] MCPサーバからのsuggestionsがReply型ボタンで表示される
   - [ ] ボタンクリックでメッセージが送信される

6. **回帰テスト**:
   - [ ] AICoachモードで習慣追加フローが正常動作
   - [ ] AICoachモードでゴール設定フローが正常動作
   - [ ] 候補ボタンの一括登録機能が正常動作
   - [ ] 既存のMCPチャット（AICoachモード）が正常動作
   - [ ] 既存のAPIプロバイダーチャットが正常動作

---

## Parallel Execution Plan (並列実行計画)

### Wave 1 (同時開始)

| Task | Agent | Files | Est. Time |
|------|-------|-------|-----------|
| TASK-01 | implementer | `role-prompts.ts` | 20min |
| TASK-02 | implementer (別) | `supabase/migrations/` | 15min |
| TASK-03 | implementer | `utils/mcpSuggestions.ts` | 25min |
| TASK-06 | implementer (別) | `useMcpChat.ts` | 45min |

**ファイル競合**: なし（全て別ファイル）

### Wave 2 (Wave 1のTASK-01完了後)

| Task | Agent | Files | Est. Time |
|------|-------|-------|-----------|
| TASK-04 | implementer | `hooks/useRoleSelection.ts` | 30min |
| TASK-05 | implementer (別) | `components/Chat.RoleSelector.tsx` | 25min |

**ファイル競合**: なし

### Wave 3 (Wave 2完了後)

| Task | Agent | Files | Est. Time |
|------|-------|-------|-----------|
| TASK-07 | implementer | `Section.MOC.tsx`, `Chat.ProviderSelector.tsx` | 60min |

**注意**: Section.MOC.tsx は大ファイルのため、1エージェントで作業する

### Wave 4 (Wave 3完了後)

| Task | Agent | Files | Est. Time |
|------|-------|-------|-----------|
| TASK-08 | implementer | `Section.MOC.tsx` (メッセージ表示部分) | 30min |
| TASK-09 | implementer (別) | `Section.MOC.tsx` (Reply表示), `useMcpChat.ts` | 40min |

**注意**: TASK-08とTASK-09はSection.MOC.tsxの異なる箇所を編集するが、同一ファイルのため逐次実行を推奨。並列の場合はgit merge conflict解決が必要。

### Wave 5 (全完了後)

| Task | Agent | Files | Est. Time |
|------|-------|-------|-----------|
| TASK-10 | tester | テストファイル | 60min |

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 10 |
| New Files | 3 |
| Modified Files | 5 |
| DB Migration | 1 |
| Max Parallel Agents (Wave 1) | 4 |
| Estimated Total Time (Sequential) | ~5.5 hours |
| Estimated Total Time (Parallel) | ~3.5 hours |
| Critical Path | TASK-01 → TASK-04/05 → TASK-07 → TASK-08/09 → TASK-10 |
