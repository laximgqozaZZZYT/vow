# Remote CLI Role - Design Specification

## Overview

- **Purpose**: Remote CLIロール追加のアーキテクチャ設計、データフロー、コンポーネント設計を定義する
- **Status**: Draft
- **Version**: 1.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect
- **Prerequisites**: `requirements.md` の全FR/NFRに準拠

---

## 1. Architecture Overview (アーキテクチャ概要)

### 1.1 現在のアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                     Section.MOC.tsx                              │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │ ProviderSelector │  │ Chat Messages (GroupChatView)        │ │
│  │ (AI: MCP/API)    │  │                                      │ │
│  └──────────────────┘  │  ┌──────────────────────────────┐    │ │
│                         │  │ CandidateDisplay              │    │ │
│                         │  │ (Goal/Habit/Sticky/Reply)     │    │ │
│                         │  └──────────────────────────────┘    │ │
│                         └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ quickActions (候補ボタン) → handleQuickAction()              ││
│  └──────────────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ Text Input → handleSendMessage()                             ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         │                           │
         ▼ (isMcp)                   ▼ (isApiProvider)
  ┌──────────────┐            ┌─────────────────┐
  │ useMcpChat   │            │ useProviderChat  │
  │ (SSE stream) │            │ (SSE stream)     │
  └──────┬───────┘            └────────┬─────────┘
         │                             │
         ▼                             ▼
  ┌──────────────┐            ┌─────────────────┐
  │ MCP Server   │            │ Backend API      │
  │ (Claude CLI) │            │ /provider-chat   │
  └──────────────┘            └─────────────────┘
```

### 1.2 追加後のアーキテクチャ

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Section.MOC.tsx                                    │
│                                                                        │
│  ┌──────────────────┐  ┌────────────────┐                             │
│  │ ProviderSelector │  │ RoleSelector   │ ← NEW                      │
│  │ (AI: MCP/API)    │  │ (ロール選択)   │                             │
│  └──────────────────┘  └────────────────┘                             │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Chat Messages (GroupChatView)                                    │  │
│  │                                                                  │  │
│  │  ┌──────────────────────────────┐                                │  │
│  │  │ AICoachの場合:               │                                │  │
│  │  │   CandidateDisplay           │                                │  │
│  │  │   (Goal/Habit/Sticky/Reply)  │                                │  │
│  │  └──────────────────────────────┘                                │  │
│  │                                                                  │  │
│  │  ┌──────────────────────────────┐                                │  │
│  │  │ Remote CLIの場合:            │ ← NEW                         │  │
│  │  │   Markdown表示               │                                │  │
│  │  │   + McpSuggestionButtons     │ (MCPサーバからの選択肢)        │  │
│  │  └──────────────────────────────┘                                │  │
│  │                                                                  │  │
│  │  ┌──────────────────────────────┐                                │  │
│  │  │ MultiResponseIndicator      │ ← NEW (連投待機インジケーター) │  │
│  │  └──────────────────────────────┘                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ roleに応じた候補ボタン                                           │  │
│  │   AICoach: quickActions (習慣追加、ゴール設定、etc.)              │  │
│  │   Remote CLI: cliQuickActions (プロジェクト状態確認、etc.) ← NEW │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Text Input → handleSendMessage()                                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
         │
         ▼ (isMcp + selectedRole)
  ┌──────────────────────────┐
  │ useMcpChat               │
  │ (systemMessage =         │
  │   roleに応じたprompt)    │ ← systemMessage切り替え
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ MCP Server               │
  │ (Claude Code CLI)        │
  │                          │
  │ Remote CLI時:            │
  │  - プレーンテキスト応答  │
  │  - 選択肢データ付き      │
  │  - 複数回答連投          │
  └──────────────────────────┘
```

---

## 2. Component Design (コンポーネント設計)

### 2.1 新規コンポーネント: `Chat.RoleSelector.tsx`

**ファイル**: `frontend/app/dashboard/components/Chat.RoleSelector.tsx`

```typescript
/**
 * Chat.RoleSelector - Role Selection Dropdown
 *
 * チャットタブ内のロール選択プルダウン。
 * AIプルダウン（ProviderSelector）の隣に配置される。
 *
 * @module components/Chat.RoleSelector
 */

export interface RoleSelectorProps {
  /** 選択可能なロール一覧 */
  availableRoles: RoleOption[];
  /** 現在選択中のロールID */
  selectedRoleId: AgentRole;
  /** ロール選択時のコールバック */
  onSelect: (roleId: AgentRole) => void;
  /** MCPサーバが選択中かどうか（false時、MCP限定ロールがdisabled） */
  isMcpSelected: boolean;
  /** ロケール */
  locale: 'ja' | 'en';
}

export interface RoleOption {
  id: AgentRole;
  name: string;
  icon: string;
  description: string;
  /** MCP限定フラグ: trueの場合、MCP非選択時にdisabledになる */
  mcpOnly: boolean;
}
```

**UIデザイン**:

```
┌──────────────────────────────────────────────────────────────┐
│  AI: [MCP Server ▼]     ロール: [AIコーチ ▼]                │
│  └─ ProviderSelector     └─ RoleSelector (NEW)               │
└──────────────────────────────────────────────────────────────┘
```

- `ProviderSelector` と同じ行に横並びで配置
- CSSクラス名のパターンも `ProviderSelector` に合わせる
- AIプルダウンの `<select>` と同様の見た目

**配置場所**: `Section.MOC.tsx` 内、 `<ProviderSelector>` の直後

### 2.2 新規Hook: `useRoleSelection.ts`

**ファイル**: `frontend/app/dashboard/hooks/useRoleSelection.ts`

```typescript
/**
 * useRoleSelection - Manages role selection state
 *
 * ロール選択状態を管理するHook。
 * localStorageへの永続化、MCPプロバイダー制約の適用を含む。
 *
 * @module hooks/useRoleSelection
 */

export interface UseRoleSelectionOptions {
  /** MCPプロバイダーが選択中かどうか */
  isMcpSelected: boolean;
  /** ロケール */
  locale: 'ja' | 'en';
}

export interface UseRoleSelectionReturn {
  /** 現在選択中のロールID */
  selectedRole: AgentRole;
  /** ロールを切り替える */
  switchRole: (roleId: AgentRole) => void;
  /** 選択可能なロールの一覧 */
  availableRoles: RoleOption[];
  /** 現在のロールのRoleConfig */
  roleConfig: RoleConfig;
  /** Remote CLIロールが有効かどうか */
  isRemoteCliEnabled: boolean;
  /** 現在のロールがRemote CLIかどうか */
  isRemoteCli: boolean;
}
```

**ロジック**:

1. `localStorage` キー `vow_selected_role` から前回の選択を復元
2. `isMcpSelected` が `false` で `selectedRole === 'remoteCli'` の場合、自動フォールバック → `'AICoach'`
3. `getAvailableRoles()` の結果にMCP限定フラグを付与して返却
4. `switchRole` 時に `localStorage` に保存

### 2.3 変更: `constants/role-prompts.ts`

**追加内容**:

```typescript
// AgentRole型に追加
export type AgentRole =
  | 'AICoach'
  | 'coach'
  | 'manager'
  | 'developer'
  | 'reviewer'
  | 'tester'
  | 'analyst'
  | 'architect'
  | 'remoteCli'    // ← NEW
  | 'default';

// RoleConfig インターフェースに mcpOnly フラグを追加
export interface RoleConfig {
  id: AgentRole;
  name: { ja: string; en: string; };
  icon: string;
  description: { ja: string; en: string; };
  capabilities: string[];
  restrictions: string[];
  getSystemPrompt: (locale: 'ja' | 'en') => string;
  /** MCP限定ロールかどうか（default: false） */
  mcpOnly?: boolean;
  /** このロールのレスポンス形式 */
  responseFormat?: 'json' | 'markdown' | 'plain';
  /** このロール用の候補ボタン定義 */
  quickActions?: Array<{
    id: string;
    label: { ja: string; en: string; };
    command: { ja: string; en: string; };
  }>;
}
```

**Remote CLI RoleConfig**:

```typescript
const remoteCliRole: RoleConfig = {
  id: 'remoteCli',
  name: { ja: 'Remote CLI', en: 'Remote CLI' },
  icon: '>_',    // ターミナルアイコン（絵文字なし）
  description: {
    ja: 'リモートClaude Code CLIを操作',
    en: 'Operate remote Claude Code CLI',
  },
  capabilities: [
    'ファイル操作（読み書き）',
    'コマンド実行',
    'プロジェクト管理',
    'コードレビュー',
    'テスト実行',
  ],
  restrictions: [
    'MCPサーバ接続が必要',
    'サーバ側のパーミッションに依存',
  ],
  mcpOnly: true,
  responseFormat: 'markdown',
  quickActions: [
    {
      id: 'project-status',
      label: { ja: '>_ プロジェクト状態確認', en: '>_ Project Status' },
      command: { ja: 'プロジェクトの状態を確認して（git status, ブランチ情報, 未コミットの変更）', en: 'Check project status (git status, branch info, uncommitted changes)' },
    },
    {
      id: 'file-list',
      label: { ja: '>_ ファイル一覧', en: '>_ File List' },
      command: { ja: 'プロジェクトのファイル構造を見せて', en: 'Show project file structure' },
    },
    {
      id: 'run-tests',
      label: { ja: '>_ テスト実行', en: '>_ Run Tests' },
      command: { ja: 'テストを実行して結果を報告して', en: 'Run tests and report results' },
    },
    {
      id: 'build-check',
      label: { ja: '>_ ビルド確認', en: '>_ Build Check' },
      command: { ja: 'ビルドが通るか確認して', en: 'Check if build passes' },
    },
    {
      id: 'recent-changes',
      label: { ja: '>_ 最近の変更', en: '>_ Recent Changes' },
      command: { ja: '最近のgitコミット履歴を見せて', en: 'Show recent git commit history' },
    },
    {
      id: 'code-review',
      label: { ja: '>_ コードレビュー', en: '>_ Code Review' },
      command: { ja: '現在の差分をレビューして', en: 'Review current diff' },
    },
  ],
  getSystemPrompt: (locale: 'ja' | 'en') => {
    if (locale === 'ja') {
      return `あなたはリモートClaude Code CLIエージェントです。
ユーザーからの指示に基づいて、ファイル操作、コマンド実行、プロジェクト管理を行います。

## 応答形式
- Markdown形式で応答してください
- コードブロックを活用してください
- JSON形式の応答は不要です
- コマンド実行結果は\`\`\`で囲んで表示してください

## ツール使用
- 利用可能なツールを積極的に使用してください
- ファイルの読み書き、ディレクトリ操作が可能です
- gitコマンド、npm/yarn コマンドが実行可能です

## 安全性
- 破壊的な操作（rm -rf, git push -f等）の前にユーザーに確認してください
- 機密ファイル（.env, credentials等）の内容は表示しないでください

## 応答スタイル
- 簡潔に、結果を先に報告してください
- エラーが発生した場合は原因と対処法を提示してください
- 複数のステップがある場合は進捗を逐次報告してください`;
    }
    return `You are a remote Claude Code CLI agent.
You perform file operations, command execution, and project management based on user instructions.

## Response Format
- Respond in Markdown format
- Use code blocks actively
- JSON format responses are not required
- Display command execution results wrapped in \`\`\`

## Tool Usage
- Actively use available tools
- File read/write and directory operations are available
- git commands and npm/yarn commands can be executed

## Safety
- Confirm with user before destructive operations (rm -rf, git push -f, etc.)
- Do not display contents of sensitive files (.env, credentials, etc.)

## Response Style
- Be concise, report results first
- If errors occur, provide cause and solution
- Report progress incrementally for multi-step operations`;
  },
};
```

### 2.4 変更: `Section.MOC.tsx` の統合

#### 2.4.1 ロール選択状態の管理

```typescript
// 既存のuseAIProviderの隣に追加
const { selectedRole, switchRole, availableRoles, isRemoteCli, isRemoteCliEnabled } =
  useRoleSelection({ isMcpSelected: isMcp, locale });
```

#### 2.4.2 systemMessage のロール依存切り替え

```typescript
// 現在: aiCoachSystemPrompt を固定で使用
// 変更後: selectedRole に応じて切り替え
const { prompt: currentSystemPrompt, source: promptSource } = useRolePrompt(
  selectedRole,   // ← 'AICoach' or 'remoteCli' or etc.
  locale,
  { authToken }
);
```

#### 2.4.3 候補ボタンの差し替え

```typescript
const quickActions = useMemo(() => {
  // Remote CLIロール選択時はCLI用候補ボタンを使用
  if (isRemoteCli) {
    const roleConfig = getRoleConfig('remoteCli');
    return (roleConfig.quickActions || []).map(action => ({
      id: action.id,
      label: locale === 'ja' ? action.label.ja : action.label.en,
      command: locale === 'ja' ? action.command.ja : action.command.en,
    }));
  }

  // AICoach（従来の候補ボタン）
  const baseActions = [ /* 既存のbaseActions */ ];
  // ... 既存ロジック
}, [locale, habits, goals, isRemoteCli]);
```

#### 2.4.4 メッセージ表示の分岐

```typescript
// AICoachの場合: AICandidateResponse パース + CandidateDisplay
// Remote CLIの場合: Markdown表示 + McpSuggestionButtons
useEffect(() => {
  // Remote CLIモードではAICandidateResponseのパースをスキップ
  if (isRemoteCli) {
    // Markdownとして直接表示（パース不要）
    return;
  }
  // 既存のAICandidateResponseパースロジック
  // ...
}, [messages, isRemoteCli]);
```

---

## 3. Data Flow (データフロー)

### 3.1 ロール切り替え時のフロー

```
ユーザー → RoleSelector → switchRole('remoteCli')
                              │
                              ▼
                    localStorage に保存
                              │
                              ▼
                    useRoleSelection が更新
                              │
                              ├─→ useRolePrompt(selectedRole) でプロンプト取得
                              │     → API → cache → local フォールバック
                              │
                              ├─→ quickActions が CLI用に差し替わる
                              │
                              ├─→ AICandidateResponse パースが無効化
                              │
                              └─→ 次の sendMessage から新プロンプトが適用
```

### 3.2 Remote CLIモードのメッセージフロー

```
ユーザー入力 → handleSendMessage()
                    │
                    ▼
              useMcpChat.sendMessage(message)
                    │
                    ▼ POST (SSE)
              MCPサーバ (Claude Code CLI)
                    │
                    ├─ event: session → sessionId保存
                    │
                    ├─ event: token → リアルタイム表示（Markdown）
                    │     ├─ setMessages() 更新（バッチ: 50ms）
                    │     └─ ChatMessageBubble でMarkdownレンダリング
                    │
                    ├─ event: complete (1回目)
                    │     ├─ content → 最終テキスト表示
                    │     ├─ toolCalls?.suggestions → McpSuggestionButtons
                    │     └─ multiResponseIndicator: 「追加応答を待っています...」
                    │
                    ├─ event: token (2回目の応答) ← 複数回答連投
                    │     └─ 新しいアシスタントメッセージとして追加
                    │
                    ├─ event: complete (2回目)
                    │     └─ 2つ目の応答完了
                    │
                    └─ data: [DONE] → ストリーム終了
```

### 3.3 MCPサーバ選択肢 → Reply型ボタン変換フロー

```
MCPサーバ complete イベント
    │
    ▼
toolCalls[].output.suggestions  (or choices / options)
    │
    ▼
extractMcpSuggestions(toolCalls) → McpSuggestion[]
    │
    ▼
GroupChatMessage.quickReplies に設定
    │
    ▼
McpSuggestionButtons コンポーネントで表示
    │
    ▼ (ユーザーがクリック)
handleMcpSuggestionClick(suggestion)
    │
    ▼
activeAgent.sendMessage(suggestion.value || suggestion.label)
```

---

## 4. Detailed Component Specifications (詳細コンポーネント仕様)

### 4.1 `Chat.RoleSelector.tsx`

**Responsibility**: ロール選択UIの表示とイベント発火

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `availableRoles` | `RoleOption[]` | Yes | 選択肢 |
| `selectedRoleId` | `AgentRole` | Yes | 選択中のロール |
| `onSelect` | `(id: AgentRole) => void` | Yes | 選択変更コールバック |
| `isMcpSelected` | `boolean` | Yes | MCP選択状態 |
| `locale` | `'ja' \| 'en'` | Yes | 表示言語 |

**Render**:
```html
<div class="flex items-center gap-2 px-2 py-1">
  <label class="text-xs text-muted-foreground whitespace-nowrap">
    ロール:
  </label>
  <select ...>
    <option value="AICoach">AIコーチ</option>
    <option value="remoteCli" disabled={!isMcpSelected}>
      Remote CLI {isMcpSelected ? '' : '(MCP限定)'}
    </option>
    <!-- 他のロール -->
  </select>
</div>
```

**注意事項**:
- `ProviderSelector` と完全に同じCSSパターンを使用する
- `<div>` ではなく `ProviderSelector` の親 `<div>` と一体の行として描画する

### 4.2 `useRoleSelection.ts`

**State**:
| State | Type | Initial | Persistence |
|-------|------|---------|-------------|
| `selectedRole` | `AgentRole` | `localStorage` or `'AICoach'` | `localStorage('vow_selected_role')` |

**Effect: MCPフォールバック**:
```typescript
useEffect(() => {
  if (!isMcpSelected && selectedRole === 'remoteCli') {
    setSelectedRole('AICoach');
    localStorage.setItem(ROLE_STORAGE_KEY, 'AICoach');
  }
}, [isMcpSelected, selectedRole]);
```

**Exposed API**:
| Method/Property | Description |
|---|---|
| `selectedRole` | 現在のロールID |
| `switchRole(id)` | ロール切り替え + localStorage保存 |
| `availableRoles` | RoleOption[] (mcpOnlyフラグ付き) |
| `roleConfig` | 現在のRoleConfig |
| `isRemoteCliEnabled` | Remote CLIが選択可能か |
| `isRemoteCli` | 現在がRemote CLIモードか |

### 4.3 MCPサーバ選択肢抽出: `extractMcpSuggestions`

**ファイル**: `frontend/app/dashboard/utils/mcpSuggestions.ts` (新規)

```typescript
/**
 * MCPサーバのtoolCalls出力から選択肢(suggestions)を抽出する
 *
 * MCPサーバがtoolCallsのoutput内に返す選択肢データを
 * McpSuggestion[] に正規化する。
 *
 * 対応する入力形式:
 * 1. toolCalls[].output.suggestions: McpSuggestion[]
 * 2. toolCalls[].output.options: {label, value}[]
 * 3. toolCalls[].output.choices: string[]
 */

export interface McpSuggestion {
  label: string;
  value: string;
  icon?: string;
  description?: string;
}

export function extractMcpSuggestions(
  toolCalls?: ToolCallResult[]
): McpSuggestion[] {
  if (!toolCalls || toolCalls.length === 0) return [];

  const suggestions: McpSuggestion[] = [];

  for (const tc of toolCalls) {
    const output = tc.output as Record<string, unknown> | null;
    if (!output || typeof output !== 'object') continue;

    // Pattern 1: output.suggestions
    if (Array.isArray(output.suggestions)) {
      for (const s of output.suggestions) {
        if (typeof s === 'string') {
          suggestions.push({ label: s, value: s });
        } else if (typeof s === 'object' && s !== null) {
          const obj = s as Record<string, unknown>;
          if (typeof obj.label === 'string') {
            suggestions.push({
              label: obj.label,
              value: (typeof obj.value === 'string' ? obj.value : obj.label),
              icon: typeof obj.icon === 'string' ? obj.icon : undefined,
              description: typeof obj.description === 'string' ? obj.description : undefined,
            });
          }
        }
      }
    }

    // Pattern 2: output.options
    if (Array.isArray(output.options)) {
      for (const o of output.options) {
        if (typeof o === 'object' && o !== null) {
          const obj = o as Record<string, unknown>;
          if (typeof obj.label === 'string') {
            suggestions.push({
              label: obj.label,
              value: typeof obj.value === 'string' ? obj.value : obj.label,
            });
          }
        }
      }
    }

    // Pattern 3: output.choices (simple string array)
    if (Array.isArray(output.choices)) {
      for (const c of output.choices) {
        if (typeof c === 'string') {
          suggestions.push({ label: c, value: c });
        }
      }
    }
  }

  return suggestions;
}
```

### 4.4 複数回答連投の処理

**変更対象**: `useMcpChat.ts`

**現在の問題**: 現在は1つのユーザーメッセージに対して1つの `assistantMessageId` を生成し、`complete` イベントで最終化している。MCPサーバが複数の `complete` イベントを送信した場合、最初の回答が上書きされてしまう。

**設計変更**:

```typescript
// 変更前（現在）:
// 1つのassistantMessageId + complete時に上書き

// 変更後:
// completeイベント受信時に新しいassistantMessageIdを生成し、
// 次のtokenが来たら新しいメッセージとして追加

// 状態管理
let currentAssistantMessageId = assistantMessageId;
let responseCount = 0;
let fullContent = '';

// completeイベント受信時
if (effectiveType === 'complete' || effectiveType === 'done') {
  // 現在のメッセージをcompleteに
  setMessages(prev => prev.map(msg =>
    msg.id === currentAssistantMessageId
      ? { ...msg, content: fullContent, status: 'complete' as const, toolCalls }
      : msg
  ));

  // 次の応答に備えてリセット
  responseCount++;
  fullContent = '';
  currentAssistantMessageId = `${assistantMessageId}-${responseCount}`;

  // 新しいメッセージプレースホルダーを追加（次のtokenが来たら表示される）
  // ただしDONEが来たらこのプレースホルダーは削除
}

// [DONE]受信時
if (jsonStr === '[DONE]') {
  // 空のプレースホルダーがあれば削除
  setMessages(prev =>
    prev.filter(msg =>
      !(msg.id === currentAssistantMessageId && !msg.content)
    )
  );
}
```

### 4.5 ProviderSelector + RoleSelector の統合配置

**変更対象**: `Section.MOC.tsx` L1519-1524

```tsx
{/* Provider Selector + Role Selector - 横並び配置 */}
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

**注意**: `ProviderSelector` から `border-b` を削除し、親 `<div>` に移動する。

---

## 5. Database Changes (データベース変更)

### 5.1 prompt_templates テーブルへの追加

```sql
INSERT INTO prompt_templates (template_key, locale, content, description, version)
VALUES (
  'remote-cli',
  'ja',
  E'あなたはリモートClaude Code CLIエージェントです。\nユーザーからの指示に基づいて、ファイル操作、コマンド実行、プロジェクト管理を行います。\n\n## 応答形式\n- Markdown形式で応答してください\n- コードブロックを活用してください\n- JSON形式の応答は不要です\n- コマンド実行結果は```で囲んで表示してください\n\n## ツール使用\n- 利用可能なツールを積極的に使用してください\n- ファイルの読み書き、ディレクトリ操作が可能です\n- gitコマンド、npm/yarn コマンドが実行可能です\n\n## 安全性\n- 破壊的な操作（rm -rf, git push -f等）の前にユーザーに確認してください\n- 機密ファイル（.env, credentials等）の内容は表示しないでください\n\n## 応答スタイル\n- 簡潔に、結果を先に報告してください\n- エラーが発生した場合は原因と対処法を提示してください\n- 複数のステップがある場合は進捗を逐次報告してください',
  'Remote CLI role system prompt - リモートClaude Code CLIエージェント用',
  '1.0'
);
```

---

## 6. File Change Summary (変更ファイル一覧)

### 新規ファイル

| ファイル | 種類 | 説明 |
|----------|------|------|
| `frontend/app/dashboard/components/Chat.RoleSelector.tsx` | Component | ロール選択ドロップダウン |
| `frontend/app/dashboard/hooks/useRoleSelection.ts` | Hook | ロール選択状態管理 |
| `frontend/app/dashboard/utils/mcpSuggestions.ts` | Utility | MCPサーバ選択肢抽出 |

### 変更ファイル

| ファイル | 変更内容 |
|----------|----------|
| `frontend/app/dashboard/constants/role-prompts.ts` | `AgentRole`型拡張、`RoleConfig`インターフェース拡張、`remoteCliRole`追加 |
| `frontend/app/dashboard/components/Section.MOC.tsx` | RoleSelector統合、quickActions分岐、メッセージ表示分岐 |
| `frontend/app/dashboard/components/Chat.ProviderSelector.tsx` | `border-b` の削除（親要素に移動） |
| `frontend/app/dashboard/hooks/useMcpChat.ts` | 複数回答連投サポート、McpSuggestion抽出 |
| `frontend/app/dashboard/hooks/useRolePrompt.ts` | `remoteCli` ロールへの対応（変更不要の可能性高い - AgentRole型拡張で自動対応） |

### データベース変更

| テーブル | 変更内容 |
|----------|----------|
| `prompt_templates` | `remote-cli` キーのレコード追加（ja/en） |

---

## 7. Risk Assessment (リスク評価)

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|----------|------|
| AICoach候補表示の破壊 | 高 | 低 | `isRemoteCli` フラグで分岐、既存パスに影響なし |
| MCPサーバとの複数回答プロトコル不一致 | 中 | 中 | [DONE]マーカーの存在を前提とし、タイムアウトフォールバックも設ける |
| `AgentRole` 型変更による型エラー | 中 | 低 | ユニオン型拡張のため後方互換性あり |
| ProviderSelector配置変更のレイアウト崩れ | 低 | 中 | Storybook/目視テストで事前確認 |

---

## 8. Agent Coordination Notes (エージェント協調メモ)

### ファイル担当分割

この仕様の実装は以下のように分割可能:

- **Agent A (Frontend Components)**: `Chat.RoleSelector.tsx`, `Section.MOC.tsx` の UI変更
- **Agent B (Frontend Logic)**: `useRoleSelection.ts`, `mcpSuggestions.ts`, `role-prompts.ts` の変更
- **Agent C (Streaming)**: `useMcpChat.ts` の複数回答連投サポート
- **Agent D (Backend/DB)**: `prompt_templates` のINSERT、`useRolePrompt` の確認

### 依存関係

```
Agent B (role-prompts.ts, useRoleSelection.ts)
  ↓ (型定義が先に必要)
Agent A (Chat.RoleSelector.tsx, Section.MOC.tsx)

Agent C (useMcpChat.ts) ← 独立して並列作業可能
Agent D (prompt_templates) ← 独立して並列作業可能
```
