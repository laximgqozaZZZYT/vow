# AI Coaching / Agents Integration - Technical Design Document

## 1. Component Architecture

### 1.1 Component Hierarchy

```
Section.AIAssistant
├── Header
│   ├── ModeToggle (Coach | Manager)
│   ├── ConnectionStatus
│   └── SettingsButton
│
├── ContentArea (conditional)
│   ├── [Coach Mode] View.CoachMode
│   │   ├── ChatArea
│   │   │   ├── MessageList
│   │   │   ├── StreamingIndicator
│   │   │   └── ToolCallVisualization
│   │   ├── SuggestionsView (conditional)
│   │   ├── GoalSuggestionsView (conditional)
│   │   ├── LevelAssessmentSliders (conditional)
│   │   └── QuickActions (when empty)
│   │
│   └── [Manager Mode] View.ManagerMode
│       ├── Widget.AgentStatusBar
│       │   └── AgentCard (mini) x N
│       ├── GroupChatTimeline
│       │   ├── MessageBubble x N
│       │   └── TaskFocusBanner (conditional)
│       └── Widget.TemplateSelector
│           └── TemplateCard x N
│
├── UnifiedInputArea
│   ├── AgentSelector (Manager mode only)
│   ├── TextInput (auto-expand)
│   └── SendButton
│
└── Modals
    ├── Modal.Habit (from coach suggestions)
    ├── Modal.Goal (from coach suggestions)
    └── Modal.MultiAgentConfig
```

### 1.2 State Management

```typescript
// Section.AIAssistant internal state
interface AIAssistantState {
  // Mode
  mode: 'coach' | 'manager';

  // Shared
  inputValue: string;
  processing: boolean;
  error: string | null;

  // Coach Mode
  coachMessages: Message[];
  suggestions: HabitSuggestion[];
  goalSuggestions: GoalSuggestion[];
  levelAssessmentHabit: { id: string; name: string } | null;

  // Manager Mode
  selectedAgentId: string | null;
  focusTaskId: string | null;
  chatMessages: ChatMessage[];
  selectedTemplate: TaskTemplate | null;
}

// From hooks
interface FromHooks {
  // useMultiAgentServer
  agents: Agent[];
  tasks: AgentTask[];
  activities: AgentActivity[];
  connectionState: ConnectionState;
  config: MultiAgentConfig;

  // useMastraAgent
  mastraMessages: MastraMessage[];
  isStreaming: boolean;
  connectionState: MastraConnectionState;
}
```

---

## 2. Interface Definitions

### 2.1 TaskTemplate Interface

```typescript
// frontend/app/dashboard/types/template.types.ts

import type { TaskPriority, AgentRole } from './agent.types';

/**
 * Task template categories
 */
export type TemplateCategory =
  | 'coaching'      // 習慣・目標関連
  | 'analysis'      // データ分析
  | 'development'   // 開発タスク
  | 'documentation'; // ドキュメント作成

/**
 * Variable that can be substituted in template
 */
export interface TemplateVariable {
  name: string;           // e.g., "{{habitName}}"
  type: 'string' | 'number' | 'date' | 'select';
  label: string;          // UI label
  labelJa: string;
  placeholder?: string;
  options?: string[];     // for select type
  required: boolean;
}

/**
 * Task template definition
 */
export interface TaskTemplate {
  id: string;

  // Display
  name: string;
  nameJa: string;
  description: string;
  descriptionJa: string;
  icon: string;
  category: TemplateCategory;

  // Task defaults
  defaultTitle: string;
  defaultDescription: string;
  defaultPriority: TaskPriority;
  defaultTags: string[];

  // Agent targeting
  requiredAgentRole?: AgentRole;   // Prefer this role
  fallbackToManager: boolean;       // If role not available

  // Variables
  variables: TemplateVariable[];

  // Metadata
  estimatedDuration?: number;       // minutes
  isSystemTemplate: boolean;        // User cannot edit
}

/**
 * Filled template ready for task creation
 */
export interface FilledTemplate {
  templateId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  tags: string[];
  targetAgentId?: string;
  variables: Record<string, string | number>;
}
```

### 2.2 useAIAssistantMode Hook

```typescript
// frontend/app/dashboard/hooks/useAIAssistantMode.ts

export type AIAssistantMode = 'coach' | 'manager';

export interface UseAIAssistantModeOptions {
  defaultMode?: AIAssistantMode;
  persistKey?: string;
}

export interface UseAIAssistantModeReturn {
  mode: AIAssistantMode;
  setMode: (mode: AIAssistantMode) => void;
  toggleMode: () => void;
  isCoachMode: boolean;
  isManagerMode: boolean;
}

export function useAIAssistantMode(
  options?: UseAIAssistantModeOptions
): UseAIAssistantModeReturn {
  const { defaultMode = 'coach', persistKey = 'vow-ai-assistant-mode' } = options || {};

  const [mode, setModeState] = useState<AIAssistantMode>(() => {
    if (typeof window === 'undefined') return defaultMode;
    const stored = localStorage.getItem(persistKey);
    return (stored === 'coach' || stored === 'manager') ? stored : defaultMode;
  });

  const setMode = useCallback((newMode: AIAssistantMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(persistKey, newMode);
    }
  }, [persistKey]);

  const toggleMode = useCallback(() => {
    setMode(mode === 'coach' ? 'manager' : 'coach');
  }, [mode, setMode]);

  return {
    mode,
    setMode,
    toggleMode,
    isCoachMode: mode === 'coach',
    isManagerMode: mode === 'manager',
  };
}
```

---

## 3. Predefined Templates

```typescript
// frontend/app/dashboard/data/taskTemplates.ts

import type { TaskTemplate } from '../types/template.types';

export const SYSTEM_TEMPLATES: TaskTemplate[] = [
  {
    id: 'habit-analysis',
    name: 'Habit Analysis',
    nameJa: '習慣分析',
    description: 'Analyze habit completion patterns and generate improvement suggestions',
    descriptionJa: '習慣の達成パターンを分析し、改善提案を生成します',
    icon: '📊',
    category: 'analysis',
    defaultTitle: '習慣分析: {{period}}',
    defaultDescription: `以下の習慣データを分析してください:
- 期間: {{period}}
- 対象: {{scope}}

分析項目:
1. 達成率の推移
2. 曜日別パターン
3. 相関関係
4. 改善提案`,
    defaultPriority: 'normal',
    defaultTags: ['analysis', 'habit', 'automated'],
    requiredAgentRole: 'analyst',
    fallbackToManager: true,
    variables: [
      {
        name: 'period',
        type: 'select',
        label: 'Period',
        labelJa: '期間',
        options: ['過去7日', '過去30日', '過去90日'],
        required: true,
      },
      {
        name: 'scope',
        type: 'select',
        label: 'Scope',
        labelJa: '対象',
        options: ['全ての習慣', 'Good習慣のみ', 'Bad習慣のみ'],
        required: true,
      },
    ],
    estimatedDuration: 5,
    isSystemTemplate: true,
  },

  {
    id: 'weekly-review',
    name: 'Weekly Review',
    nameJa: '週次レビュー',
    description: 'Generate a weekly summary of habit achievements',
    descriptionJa: '週次の習慣達成サマリーを生成します',
    icon: '📅',
    category: 'analysis',
    defaultTitle: '週次レビュー: {{weekStart}} - {{weekEnd}}',
    defaultDescription: `今週の習慣達成状況をレビューしてください:

期間: {{weekStart}} から {{weekEnd}}

レビュー項目:
1. 総合達成率
2. ベスト習慣 (最高達成率)
3. 改善が必要な習慣
4. 来週への提案
5. モチベーションコメント`,
    defaultPriority: 'normal',
    defaultTags: ['review', 'weekly', 'automated'],
    requiredAgentRole: 'manager',
    fallbackToManager: true,
    variables: [
      {
        name: 'weekStart',
        type: 'date',
        label: 'Week Start',
        labelJa: '週開始日',
        required: true,
      },
      {
        name: 'weekEnd',
        type: 'date',
        label: 'Week End',
        labelJa: '週終了日',
        required: true,
      },
    ],
    estimatedDuration: 3,
    isSystemTemplate: true,
  },

  {
    id: 'goal-planning',
    name: 'Goal Planning',
    nameJa: 'ゴール設計',
    description: 'Create milestones and habit suggestions for a goal',
    descriptionJa: '目標に対するマイルストーンと習慣提案を作成します',
    icon: '🎯',
    category: 'coaching',
    defaultTitle: 'ゴール設計: {{goalName}}',
    defaultDescription: `以下のゴールに対する達成計画を作成してください:

ゴール名: {{goalName}}
目標期限: {{deadline}}
現在の状況: {{currentStatus}}

作成してほしい内容:
1. マイルストーン (3-5個)
2. 各マイルストーンに紐づく習慣提案
3. 進捗確認ポイント
4. 想定されるリスクと対策`,
    defaultPriority: 'high',
    defaultTags: ['planning', 'goal', 'strategy'],
    requiredAgentRole: 'architect',
    fallbackToManager: true,
    variables: [
      {
        name: 'goalName',
        type: 'string',
        label: 'Goal Name',
        labelJa: 'ゴール名',
        placeholder: '例: TOEIC 800点',
        required: true,
      },
      {
        name: 'deadline',
        type: 'date',
        label: 'Deadline',
        labelJa: '目標期限',
        required: false,
      },
      {
        name: 'currentStatus',
        type: 'string',
        label: 'Current Status',
        labelJa: '現在の状況',
        placeholder: '例: 現在600点',
        required: false,
      },
    ],
    estimatedDuration: 10,
    isSystemTemplate: true,
  },

  {
    id: 'spec-draft',
    name: 'SPEC Draft',
    nameJa: 'SPEC作成',
    description: 'Create a specification document for a feature',
    descriptionJa: '機能の仕様書ドラフトを作成します',
    icon: '📝',
    category: 'documentation',
    defaultTitle: 'SPEC: {{featureName}}',
    defaultDescription: `以下の機能の仕様書を作成してください:

機能名: {{featureName}}
概要: {{overview}}

作成する仕様書の構成:
1. Overview (目的、背景)
2. Requirements (機能要件、非機能要件)
3. Technical Design (アーキテクチャ、データモデル)
4. UI/UX Design (画面遷移、主要UI)
5. Implementation Tasks (タスク分割)
6. Acceptance Criteria`,
    defaultPriority: 'normal',
    defaultTags: ['spec', 'documentation', 'development'],
    requiredAgentRole: 'architect',
    fallbackToManager: true,
    variables: [
      {
        name: 'featureName',
        type: 'string',
        label: 'Feature Name',
        labelJa: '機能名',
        placeholder: '例: ユーザープロファイル編集',
        required: true,
      },
      {
        name: 'overview',
        type: 'string',
        label: 'Overview',
        labelJa: '概要',
        placeholder: '機能の簡単な説明',
        required: false,
      },
    ],
    estimatedDuration: 15,
    isSystemTemplate: true,
  },

  {
    id: 'code-review',
    name: 'Code Review',
    nameJa: 'コードレビュー',
    description: 'Request a code review for changes',
    descriptionJa: '変更に対するコードレビューを依頼します',
    icon: '🔍',
    category: 'development',
    defaultTitle: 'レビュー依頼: {{branchName}}',
    defaultDescription: `以下の変更をレビューしてください:

ブランチ: {{branchName}}
変更概要: {{changeSummary}}

レビュー観点:
1. コードスタイル・可読性
2. ロジックの正しさ
3. エラーハンドリング
4. パフォーマンス
5. セキュリティ
6. テストカバレッジ`,
    defaultPriority: 'high',
    defaultTags: ['review', 'code', 'development'],
    requiredAgentRole: 'reviewer',
    fallbackToManager: true,
    variables: [
      {
        name: 'branchName',
        type: 'string',
        label: 'Branch Name',
        labelJa: 'ブランチ名',
        placeholder: '例: feat/user-profile',
        required: true,
      },
      {
        name: 'changeSummary',
        type: 'string',
        label: 'Change Summary',
        labelJa: '変更概要',
        placeholder: '変更内容の簡単な説明',
        required: false,
      },
    ],
    estimatedDuration: 20,
    isSystemTemplate: true,
  },
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: TemplateCategory
): TaskTemplate[] {
  return SYSTEM_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): TaskTemplate | undefined {
  return SYSTEM_TEMPLATES.find(t => t.id === id);
}

/**
 * Fill template with variables
 */
export function fillTemplate(
  template: TaskTemplate,
  variables: Record<string, string | number>
): { title: string; description: string } {
  let title = template.defaultTitle;
  let description = template.defaultDescription;

  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    title = title.replace(pattern, String(value));
    description = description.replace(pattern, String(value));
  }

  return { title, description };
}
```

---

## 4. Component Implementations

### 4.1 Widget.TemplateSelector

```tsx
// frontend/app/dashboard/components/Widget.TemplateSelector.tsx

'use client';

import { useState } from 'react';
import type { TaskTemplate, TemplateCategory, TemplateVariable } from '../types/template.types';
import { SYSTEM_TEMPLATES, fillTemplate } from '../data/taskTemplates';

interface TemplateSelectorProps {
  onSelect: (template: TaskTemplate, variables: Record<string, string | number>) => void;
  category?: TemplateCategory;
  className?: string;
}

export function TemplateSelector({
  onSelect,
  category,
  className = '',
}: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string | number>>({});
  const [showVariableForm, setShowVariableForm] = useState(false);

  const templates = category
    ? SYSTEM_TEMPLATES.filter(t => t.category === category)
    : SYSTEM_TEMPLATES;

  const handleTemplateClick = (template: TaskTemplate) => {
    if (template.variables.length === 0) {
      // No variables, submit immediately
      onSelect(template, {});
    } else {
      setSelectedTemplate(template);
      setVariables({});
      setShowVariableForm(true);
    }
  };

  const handleVariableChange = (name: string, value: string | number) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!selectedTemplate) return;

    // Validate required variables
    const missingRequired = selectedTemplate.variables
      .filter(v => v.required && !variables[v.name])
      .map(v => v.labelJa);

    if (missingRequired.length > 0) {
      alert(`必須項目を入力してください: ${missingRequired.join(', ')}`);
      return;
    }

    onSelect(selectedTemplate, variables);
    setShowVariableForm(false);
    setSelectedTemplate(null);
    setVariables({});
  };

  const handleCancel = () => {
    setShowVariableForm(false);
    setSelectedTemplate(null);
    setVariables({});
  };

  // Variable form modal
  if (showVariableForm && selectedTemplate) {
    return (
      <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{selectedTemplate.icon}</span>
          <div>
            <h3 className="font-semibold">{selectedTemplate.nameJa}</h3>
            <p className="text-sm text-muted-foreground">{selectedTemplate.descriptionJa}</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {selectedTemplate.variables.map((variable) => (
            <VariableInput
              key={variable.name}
              variable={variable}
              value={variables[variable.name]}
              onChange={(value) => handleVariableChange(variable.name, value)}
            />
          ))}
        </div>

        {/* Preview */}
        <div className="mb-4 p-3 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">プレビュー</div>
          <div className="text-sm font-medium">
            {fillTemplate(selectedTemplate, variables).title}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-muted"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            タスク作成
          </button>
        </div>
      </div>
    );
  }

  // Template grid
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-sm font-medium text-muted-foreground">
        クイックテンプレート
      </div>
      <div className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => handleTemplateClick(template)}
            className="
              flex items-center gap-1.5 px-3 py-2
              bg-muted/50 hover:bg-muted
              border border-border rounded-lg
              text-sm transition-colors
            "
            title={template.descriptionJa}
          >
            <span>{template.icon}</span>
            <span>{template.nameJa}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Variable input component
function VariableInput({
  variable,
  value,
  onChange,
}: {
  variable: TemplateVariable;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
}) {
  const inputClasses = "w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {variable.labelJa}
        {variable.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {variable.type === 'select' && variable.options ? (
        <select
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        >
          <option value="">選択してください</option>
          {variable.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : variable.type === 'date' ? (
        <input
          type="date"
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      ) : variable.type === 'number' ? (
        <input
          type="number"
          value={value as number || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={variable.placeholder}
          className={inputClasses}
        />
      ) : (
        <input
          type="text"
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={variable.placeholder}
          className={inputClasses}
        />
      )}
    </div>
  );
}

export default TemplateSelector;
```

### 4.2 Widget.AgentStatusBar

```tsx
// frontend/app/dashboard/components/Widget.AgentStatusBar.tsx

'use client';

import type { Agent } from '../types/agent.types';
import { ROLE_CONFIG, STATUS_CONFIG } from '../types/agent.types';

interface AgentStatusBarProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  className?: string;
}

export function AgentStatusBar({
  agents,
  selectedAgentId,
  onSelectAgent,
  className = '',
}: AgentStatusBarProps) {
  const idleAgents = agents.filter(a => a.status === 'idle');
  const busyAgents = agents.filter(a => a.status === 'busy');
  const offlineAgents = agents.filter(a => a.status === 'offline');

  return (
    <div className={`bg-muted/30 rounded-lg p-3 ${className}`}>
      {/* Summary */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">
          Agents ({agents.length})
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {idleAgents.length} idle
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            {busyAgents.length} busy
          </span>
          {offlineAgents.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              {offlineAgents.length} offline
            </span>
          )}
        </div>
      </div>

      {/* Agent Cards */}
      <div className="flex flex-wrap gap-2">
        {/* Auto (Manager) option */}
        <button
          onClick={() => onSelectAgent(null)}
          className={`
            flex items-center gap-1.5 px-2 py-1.5
            rounded-lg border text-xs
            transition-colors
            ${!selectedAgentId
              ? 'bg-primary/10 border-primary/50 text-primary'
              : 'bg-muted border-border hover:bg-muted/80'
            }
          `}
        >
          <span>👔</span>
          <span>Auto</span>
        </button>

        {/* Individual agents */}
        {agents.filter(a => a.status !== 'offline').map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className={`
              flex items-center gap-1.5 px-2 py-1.5
              rounded-lg border text-xs
              transition-colors
              ${selectedAgentId === agent.id
                ? 'bg-primary/10 border-primary/50 text-primary'
                : 'bg-muted border-border hover:bg-muted/80'
              }
              ${agent.status === 'busy' ? 'opacity-60' : ''}
            `}
            title={`${agent.name} (${agent.role}) - ${agent.status}`}
          >
            <span>{ROLE_CONFIG[agent.role]?.icon || '🤖'}</span>
            <span className="truncate max-w-[60px]">{agent.name}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[agent.status].bgColor}`} />
          </button>
        ))}
      </div>

      {/* Empty state */}
      {agents.length === 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          エージェントが接続されていません
        </div>
      )}
    </div>
  );
}

export default AgentStatusBar;
```

---

## 5. Data Flow Diagrams

### 5.1 Coach Mode: Habit Suggestion Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                    │
│                   "運動の習慣を追加したい"                              │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     useMastraAgent.sendMessage()                      │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Backend: Mastra Agent                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 1. Parse user intent                                           │  │
│  │ 2. Call suggest_habits tool                                    │  │
│  │ 3. Generate response with UI components                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Streaming Response                                 │
│  {                                                                    │
│    response: "運動習慣を提案します...",                                │
│    data: {                                                            │
│      habitSuggestions: [                                              │
│        { name: "朝のストレッチ", type: "do", ... },                   │
│        { name: "30分ウォーキング", type: "do", ... },                 │
│      ]                                                                │
│    },                                                                 │
│    toolCalls: [{ toolName: "suggest_habits", success: true }]        │
│  }                                                                    │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    UI Update                                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ addMessage('assistant', response)                              │  │
│  │ setSuggestions(habitSuggestions)                               │  │
│  │ render SuggestionsView                                         │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    USER CLICKS SUGGESTION                             │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ openHabitModal(selectedSuggestion)                             │  │
│  │ → Modal.Habit opens with pre-filled data                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Manager Mode: Template Task Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    USER SELECTS TEMPLATE                              │
│                   "週次レビュー"                                       │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Show Variable Form                                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ weekStart: [2025-01-27]                                        │  │
│  │ weekEnd:   [2025-02-02]                                        │  │
│  │                                                     [作成]     │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    fillTemplate() + createTask()                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ const { title, description } = fillTemplate(template, vars);   │  │
│  │ await server.createTask(serverId, {                            │  │
│  │   title, description, priority, tags, assignTo                 │  │
│  │ });                                                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    MCP Task Server                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 1. Create task record                                          │  │
│  │ 2. Assign to target agent (Manager)                            │  │
│  │ 3. Broadcast SSE: task_created, task_assigned                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    SSE Events → Chat Messages                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ activities.forEach(activity => {                               │  │
│  │   const chatMessage = convertActivityToMessage(activity);      │  │
│  │   setMessages(prev => [...prev, chatMessage]);                 │  │
│  │ });                                                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Agent Claims & Executes                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ SSE: task_started                                              │  │
│  │ → "👔 Manager が作業を開始しました"                             │  │
│  │                                                                 │  │
│  │ ... Agent working ...                                          │  │
│  │                                                                 │  │
│  │ SSE: task_completed                                            │  │
│  │ → "✅ 完了: 週次レビュー"                                       │  │
│  │ → Display result in chat bubble                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Error Handling

### 6.1 Connection Errors

```typescript
// Error scenarios and handling

// 1. MCP Server Unreachable
if (connectionState === 'error') {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">🔌</div>
      <h3 className="font-medium mb-2">サーバーに接続できません</h3>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      <button onClick={() => server.connectAllEnabled()}>
        再接続
      </button>
    </div>
  );
}

// 2. No Agents Available
if (agents.length === 0 && isConnected) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">🤖</div>
      <h3 className="font-medium mb-2">エージェントが登録されていません</h3>
      <p className="text-sm text-muted-foreground">
        Claude Code から MCP サーバーにエージェントを登録してください
      </p>
    </div>
  );
}

// 3. Mastra Agent Error (Coach Mode)
if (mastraAgent.error) {
  return (
    <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
      <div className="flex items-center justify-between">
        <span>エラー: {mastraAgent.error}</span>
        <button onClick={mastraAgent.retry}>再試行</button>
      </div>
    </div>
  );
}

// 4. Task Creation Failed
try {
  const task = await server.createTask(serverId, taskData);
  if (!task) {
    throw new Error('タスクの作成に失敗しました');
  }
} catch (err) {
  addChatMessage({
    role: 'system',
    content: `❌ エラー: ${err.message}`,
    messageType: 'error_report',
  });
}
```

### 6.2 Graceful Degradation

```typescript
// When MCP is unavailable, show coach-only mode
if (mode === 'manager' && connectionState === 'disconnected') {
  return (
    <div className="p-4">
      <div className="bg-yellow-500/10 text-yellow-600 p-3 rounded-lg mb-4">
        <p className="text-sm">
          MCPサーバーに接続されていません。コーチモードのみ利用可能です。
        </p>
        <button
          onClick={() => setMode('coach')}
          className="text-sm underline mt-1"
        >
          コーチモードに切り替え
        </button>
      </div>
    </div>
  );
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// __tests__/hooks/useAIAssistantMode.test.ts

describe('useAIAssistantMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should default to coach mode', () => {
    const { result } = renderHook(() => useAIAssistantMode());
    expect(result.current.mode).toBe('coach');
    expect(result.current.isCoachMode).toBe(true);
  });

  it('should toggle mode', () => {
    const { result } = renderHook(() => useAIAssistantMode());
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe('manager');
    expect(result.current.isManagerMode).toBe(true);
  });

  it('should persist to localStorage', () => {
    const { result } = renderHook(() => useAIAssistantMode());
    act(() => result.current.setMode('manager'));
    expect(localStorage.getItem('vow-ai-assistant-mode')).toBe('manager');
  });

  it('should restore from localStorage', () => {
    localStorage.setItem('vow-ai-assistant-mode', 'manager');
    const { result } = renderHook(() => useAIAssistantMode());
    expect(result.current.mode).toBe('manager');
  });
});
```

### 7.2 Integration Tests

```typescript
// __tests__/components/Section.AIAssistant.test.tsx

describe('Section.AIAssistant', () => {
  const mockGoals = [{ id: '1', name: 'Test Goal' }];
  const mockHabits = [{ id: '1', goalId: '1', name: 'Test Habit' }];

  it('should render coach mode by default', () => {
    render(<Section.AIAssistant goals={mockGoals} habits={mockHabits} />);
    expect(screen.getByText('Coach')).toHaveClass('active');
  });

  it('should switch to manager mode on toggle', async () => {
    render(<Section.AIAssistant goals={mockGoals} habits={mockHabits} />);
    await userEvent.click(screen.getByText('Manager'));
    expect(screen.getByText('Manager')).toHaveClass('active');
  });

  it('should show templates in manager mode', async () => {
    render(<Section.AIAssistant goals={mockGoals} habits={mockHabits} />);
    await userEvent.click(screen.getByText('Manager'));
    expect(screen.getByText('習慣分析')).toBeInTheDocument();
    expect(screen.getByText('週次レビュー')).toBeInTheDocument();
  });
});
```

---

## 8. Performance Considerations

### 8.1 Message Limiting

```typescript
// Limit chat messages to prevent memory issues
const MAX_MESSAGES = 100;

const addMessage = useCallback((message: ChatMessage) => {
  setMessages(prev => {
    const newMessages = [...prev, message];
    if (newMessages.length > MAX_MESSAGES) {
      return newMessages.slice(-MAX_MESSAGES);
    }
    return newMessages;
  });
}, []);
```

### 8.2 SSE Event Debouncing

```typescript
// Debounce rapid SSE updates
const debouncedActivities = useDebouncedValue(activities, 100);

useEffect(() => {
  debouncedActivities.forEach(activity => {
    if (!processedIds.has(activity.id)) {
      processedIds.add(activity.id);
      convertAndAddMessage(activity);
    }
  });
}, [debouncedActivities]);
```

### 8.3 Lazy Loading

```typescript
// Lazy load mode-specific views
const CoachModeView = dynamic(
  () => import('./View.CoachMode'),
  { loading: () => <Skeleton /> }
);

const ManagerModeView = dynamic(
  () => import('./View.ManagerMode'),
  { loading: () => <Skeleton /> }
);
```

---

## Appendix: File Structure

```
frontend/app/dashboard/
├── components/
│   ├── Section.AIAssistant.tsx       # Main integrated section
│   ├── View.CoachMode.tsx            # Coach mode view (extracted from Section.Coach)
│   ├── View.ManagerMode.tsx          # Manager mode view
│   ├── Widget.TemplateSelector.tsx   # Template selection UI
│   ├── Widget.AgentStatusBar.tsx     # Agent status display
│   ├── Widget.GroupChatTimeline.tsx  # Chat timeline (extracted)
│   └── ... (existing components)
│
├── hooks/
│   ├── useAIAssistantMode.ts         # Mode management hook
│   ├── useMultiAgentServer.ts        # Existing MCP hook
│   ├── useMastraAgent.ts             # Existing Mastra hook
│   └── ...
│
├── types/
│   ├── template.types.ts             # Template type definitions
│   ├── agent.types.ts                # Existing agent types
│   └── ...
│
└── data/
    └── taskTemplates.ts              # Predefined templates
```
