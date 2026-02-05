# Section.MOC.tsx Refactoring Specification - Technical Design

## Overview
- **Purpose**: Section.MOC.tsx リファクタリングの技術設計書
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect

---

## Architecture Overview

### Current Structure (Before)

```
frontend/app/dashboard/components/
  Section.MOC.tsx (4,507 lines)
    ├── Type Definitions (29-176)
    ├── MOCSection Component (177-2016)
    │   ├── 30+ useState calls
    │   ├── 20+ useCallback calls
    │   ├── 8+ useEffect calls
    │   ├── 10+ useMemo calls
    │   └── Custom hooks usage
    ├── Helper Functions (2018-2680)
    │   ├── formatActivityContent
    │   ├── parseSuggestions
    │   ├── parseQuickReplies
    │   ├── parseFollowUpActions
    │   ├── parseUnifiedResponse
    │   ├── parseMultiAgentSuggestion
    │   └── generateManagerSummary
    └── Sub-Components (2682-4507)
        ├── GroupChatView
        ├── ChatMessageBubble
        ├── SuggestionCard
        ├── TaskListView
        ├── TaskSection
        ├── TaskDetailModal
        ├── AgentListView
        ├── RemoteAgentInstaller
        ├── RemoteAgentGuide
        ├── RemoteTaskExecutor
        └── HistoryView
```

### Target Structure (After)

```
frontend/app/dashboard/
├── components/
│   ├── Section.MOC.tsx (~1,500 lines) - Main orchestrator
│   ├── Chat.SuggestionCard.tsx (~200 lines)
│   ├── Chat.MessageBubble.tsx (~250 lines)
│   ├── Chat.GroupView.tsx (~150 lines)
│   ├── Task.ListView.tsx (~100 lines)
│   ├── Modal.TaskDetail.tsx (~250 lines)
│   ├── Agent.ListView.tsx (~500 lines)
│   ├── Agent.RemoteInstaller.tsx (~200 lines)
│   ├── Agent.RemoteGuide.tsx (~80 lines)
│   ├── Agent.RemoteExecutor.tsx (~280 lines)
│   └── History.View.tsx (~80 lines)
├── hooks/
│   ├── useMOCChat.ts (~180 lines)
│   ├── useSuggestionState.ts (~120 lines)
│   └── useMOCModals.ts (~100 lines)
├── types/
│   └── moc.types.ts (~180 lines)
└── utils/
    └── mocParsers.ts (~700 lines)
```

---

## File Specifications

### 1. types/moc.types.ts

**Purpose**: MOC Section で使用する全ての型定義

```typescript
// types/moc.types.ts

// Tab types
export type TabId = 'chat' | 'tasks' | 'agents' | 'history';

export interface TabConfig {
  id: TabId;
  label: string;
  labelJa: string;
  icon: string;
  badge?: number;
}

// Message types for group chat
export type SuggestionButtonType = 'habit' | 'goal' | 'stickyn' | 'reply';

export interface GroupChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'user' | 'agent' | 'coach' | 'system';
  senderRole?: string;
  senderIcon?: string;
  content: string;
  timestamp: Date;
  taskId?: string;
  taskTitle?: string;
  suggestion?: {
    type: 'habit' | 'goal';
    suggestionType?: SuggestionButtonType;
    data: Record<string, unknown>;
    actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  };
  suggestions?: Array<{
    type: 'habit' | 'goal';
    suggestionType?: SuggestionButtonType;
    data: Record<string, unknown>;
    actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  }>;
  quickReplies?: Array<{
    id: string;
    label: string;
    value: string;
    icon?: string;
  }>;
  selectionType?: 'habit_category' | 'goal_category' | 'difficulty';
  followUpActions?: Array<{
    id: string;
    label: string;
    action: 'more_specific' | 'easier' | 'harder' | 'different' | 'more_suggestions' | 'different_habit';
    category?: string;
  }>;
  unifiedButtons?: UnifiedButton[];
  extractedMessage?: string;
}

// Props for main section
export interface MOCSectionProps {
  goals?: Goal[];
  habits?: Habit[];
  stickies?: Sticky[];
  tags?: Tag[];
  onHabitCreated?: (habit: Habit) => void;
  onGoalCreated?: (goal: Goal) => void;
  onStickyCreated?: (sticky: Sticky) => void;
  locale?: 'ja' | 'en';
  authToken?: string;
}

// Suggestion state management
export type SuggestionStatus = 'pending' | 'accepted' | 'snoozed' | 'dismissed' | 'loading' | 'error';

export interface SuggestionState {
  status: SuggestionStatus;
  error?: string;
}

export interface SnoozedSuggestion {
  id: string;
  messageId: string;
  type: 'habit' | 'goal';
  data: Record<string, unknown>;
  snoozedAt: Date;
}

// Task types
export interface TaskWithDetail {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
  serverId?: string;
}

// History filter
export type HistoryFilter = 'all' | 'user' | 'coach' | 'agent' | 'system';

// Multi-agent types
export interface AgentResponse {
  agentId: string;
  agentName: string;
  agentRole: string;
  response: string;
  status: 'pending' | 'complete' | 'error';
  timestamp: Date;
}

export interface AggregationSession {
  id: string;
  userQuery: string;
  responses: AgentResponse[];
  status: 'collecting' | 'summarizing' | 'complete' | 'error';
  summary?: string;
  startedAt: Date;
}

// Selectable agent
export interface SelectableAgent {
  id: string;
  name: string;
  role: string;
  icon: string;
  type: 'coach' | 'mcp-agent';
  serverId?: string;
  status?: string;
}

// Constants
export const TABS: TabConfig[] = [
  { id: 'chat', label: 'Chat', labelJa: 'チャット', icon: '💬' },
  { id: 'tasks', label: 'Tasks', labelJa: 'タスク', icon: '📋' },
  { id: 'agents', label: 'Agents', labelJa: 'エージェント', icon: '🤖' },
  { id: 'history', label: 'History', labelJa: '履歴', icon: '📜' },
];

export const ROLE_ICONS: Record<string, string> = {
  manager: '👔',
  developer: '💻',
  reviewer: '🔍',
  tester: '🧪',
  architect: '🏗️',
  devops: '🔧',
  analyst: '📊',
  coach: '🤖',
  user: '👤',
  system: '⚙️',
};
```

---

### 2. utils/mocParsers.ts

**Purpose**: メッセージパース関連の純粋関数群

```typescript
// utils/mocParsers.ts

import type { MastraMessage } from '../hooks/useMastraAgent';
import type {
  GroupChatMessage,
  SuggestionButtonType,
  AgentResponse,
} from '../types/moc.types';
import type { UnifiedButton } from '../types/candidate-button.types';

/**
 * Parse ALL suggestions from ALL tool calls
 */
export function parseSuggestions(
  msg: MastraMessage
): GroupChatMessage['suggestions'] | undefined {
  // Implementation from Section.MOC.tsx lines 2041-2300
}

/**
 * Legacy function for backward compatibility
 */
export function parseSuggestion(
  msg: MastraMessage
): GroupChatMessage['suggestion'] | undefined {
  const suggestions = parseSuggestions(msg);
  return suggestions?.[0];
}

/**
 * Parse quick replies from selection tools
 */
export function parseQuickReplies(
  msg: MastraMessage
): { quickReplies: GroupChatMessage['quickReplies']; selectionType?: GroupChatMessage['selectionType'] } | undefined {
  // Implementation from Section.MOC.tsx lines 2313-2434
}

/**
 * Parse follow-up actions from refine tools
 */
export function parseFollowUpActions(
  msg: MastraMessage
): GroupChatMessage['followUpActions'] | undefined {
  // Implementation from Section.MOC.tsx lines 2439-2465
}

/**
 * Parse UnifiedChatResponse JSON from message content
 */
export function parseUnifiedResponse(
  content: string
): { message: string; buttons: UnifiedButton[] } | undefined {
  // Implementation from Section.MOC.tsx lines 2471-2526
}

/**
 * Parse suggestions from multi-agent tool calls
 */
export function parseMultiAgentSuggestion(
  toolCalls: Array<{
    toolName: string;
    toolCallId?: string;
    args?: unknown;
    result?: unknown;
  }>
): GroupChatMessage['suggestion'] | undefined {
  // Implementation from Section.MOC.tsx lines 2532-2638
}

/**
 * Generate a Manager summary from multiple agent responses
 */
export function generateManagerSummary(
  userQuery: string,
  responses: AgentResponse[],
  locale: 'ja' | 'en'
): string {
  // Implementation from Section.MOC.tsx lines 2643-2680
}

/**
 * Format activity content for display
 */
export function formatActivityContent(
  activity: { eventType: string; details?: Record<string, unknown> }
): string {
  // Implementation from Section.MOC.tsx lines 2019-2035
}

/**
 * Format time for display
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}
```

---

### 3. components/Chat.SuggestionCard.tsx

**Purpose**: 提案カード表示コンポーネント

```typescript
// components/Chat.SuggestionCard.tsx

'use client';

import React from 'react';
import type {
  SuggestionButtonType,
  SuggestionState,
  GroupChatMessage,
} from '../types/moc.types';

export interface SuggestionCardProps {
  messageId: string;
  suggestion: NonNullable<GroupChatMessage['suggestion']>;
  locale: 'ja' | 'en';
  state?: SuggestionState;
  onAction?: (
    messageId: string,
    actionId: string,
    suggestion: NonNullable<GroupChatMessage['suggestion']>
  ) => void;
}

const typeConfig: Record<
  SuggestionButtonType,
  { icon: string; label: { ja: string; en: string }; color: string }
> = {
  habit: {
    icon: '📝',
    label: { ja: 'Habit', en: 'Habit' },
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  },
  goal: {
    icon: '🎯',
    label: { ja: 'Goal', en: 'Goal' },
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  },
  stickyn: {
    icon: '📌',
    label: { ja: "Sticky'n", en: "Sticky'n" },
    color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  },
  reply: {
    icon: '💬',
    label: { ja: '回答', en: 'Reply' },
    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  },
};

export function SuggestionCard({
  messageId,
  suggestion,
  locale,
  state,
  onAction,
}: SuggestionCardProps) {
  // Implementation from Section.MOC.tsx lines 3034-3201
}

export default SuggestionCard;
```

---

### 4. components/Chat.MessageBubble.tsx

**Purpose**: チャットメッセージバブル表示コンポーネント

```typescript
// components/Chat.MessageBubble.tsx

'use client';

import React from 'react';
import type {
  GroupChatMessage,
  SuggestionState,
} from '../types/moc.types';
import type { UnifiedButton } from '../types/candidate-button.types';
import { SuggestionCard } from './Chat.SuggestionCard';
import { CandidateButtonCard } from './CandidateButtonCard';
import { RefineActionButtons } from './RefineActionButtons';
import { formatTime } from '../utils/mocParsers';

export interface ChatMessageBubbleProps {
  message: GroupChatMessage;
  locale: 'ja' | 'en';
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  suggestionState?: SuggestionState;
  suggestionStates?: Record<string, SuggestionState>;
  onSuggestionAction?: (
    messageId: string,
    actionId: string,
    suggestion: NonNullable<GroupChatMessage['suggestion']>
  ) => void;
  onQuickReplyClick?: (value: string, label: string) => void;
  onFollowUpActionClick?: (action: string, category?: string) => void;
  onUnifiedButtonClick?: (
    button: UnifiedButton,
    action: 'accept' | 'reject' | 'detail'
  ) => void;
  onRefineAction?: (direction: 'more_specific' | 'more_general') => void;
}

// Sender type specific styling
const senderStyles = {
  user: {
    avatar: 'bg-gradient-to-br from-blue-500 to-blue-600',
    bubble: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
    name: 'text-blue-600 dark:text-blue-400',
  },
  coach: {
    avatar: 'bg-gradient-to-br from-purple-500 to-indigo-600',
    bubble: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-700',
    name: 'text-purple-600 dark:text-purple-400',
  },
  agent: {
    avatar: 'bg-gradient-to-br from-amber-500 to-orange-500',
    bubble: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-700',
    name: 'text-amber-600 dark:text-amber-400',
  },
  system: {
    avatar: 'bg-gray-400',
    bubble: 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-center italic',
    name: 'text-gray-500 dark:text-gray-400',
  },
};

const roleBadgeColors: Record<string, string> = {
  manager: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  developer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  reviewer: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  tester: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  architect: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  devops: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  analyst: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  coach: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

export function ChatMessageBubble({
  message,
  locale,
  isFirstInGroup = true,
  isLastInGroup = true,
  suggestionState,
  suggestionStates,
  onSuggestionAction,
  onQuickReplyClick,
  onFollowUpActionClick,
  onUnifiedButtonClick,
  onRefineAction,
}: ChatMessageBubbleProps) {
  // Implementation from Section.MOC.tsx lines 2834-3023
}

export default ChatMessageBubble;
```

---

### 5. hooks/useMOCChat.ts

**Purpose**: MOC Section のチャット関連ロジックを集約

```typescript
// hooks/useMOCChat.ts

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMultiAgentServer } from './useMultiAgentServer';
import { useMastraAgent, type MastraMessage } from './useMastraAgent';
import { useMcpChat } from './useMcpChat';
import type {
  GroupChatMessage,
  SelectableAgent,
} from '../types/moc.types';
import {
  parseSuggestions,
  parseQuickReplies,
  parseFollowUpActions,
  parseUnifiedResponse,
  formatActivityContent,
} from '../utils/mocParsers';
import { ROLE_ICONS } from '../types/moc.types';

export interface UseMOCChatOptions {
  authToken?: string;
  locale?: 'ja' | 'en';
}

export interface UseMOCChatReturn {
  // Messages
  messages: GroupChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<GroupChatMessage[]>>;

  // Input
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;

  // Actions
  handleSendMessage: () => Promise<void>;
  handleQuickAction: (command: string) => void;
  handleQuickReplyClick: (value: string, label: string) => void;
  handleFollowUpActionClick: (action: string, category?: string) => void;
  handleRetry: () => void;

  // State
  isLoading: boolean;
  error: Error | null;
  activeAgent: ReturnType<typeof useMastraAgent> | ReturnType<typeof useMcpChat>;
  shouldUseMcpAgent: boolean;

  // Server info
  isConnected: boolean;
  connectedAgentCount: number;
  availableAgents: SelectableAgent[];

  // Quick actions
  quickActions: Array<{ id: string; label: string; command: string }>;

  // Server access for other hooks
  server: ReturnType<typeof useMultiAgentServer>;
}

export function useMOCChat({
  authToken,
  locale = 'ja',
}: UseMOCChatOptions): UseMOCChatReturn {
  // State
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Server hook
  const server = useMultiAgentServer({ authToken });

  // Agent hooks
  const mastraAgent = useMastraAgent({ authToken, enableStreaming: true });
  const selectedMcpServer = useMemo(() => {
    // MCP server selection logic
  }, [server.chatAgentSettings, server.config.servers, server.connections]);

  const mcpChat = useMcpChat({
    server: selectedMcpServer,
    // ... other options
  });

  // Determine which agent to use
  const shouldUseMcpAgent = useMemo(() => {
    return server.chatAgentSettings.useMcpAgent && selectedMcpServer !== null;
  }, [server.chatAgentSettings, selectedMcpServer]);

  const activeAgent = shouldUseMcpAgent ? mcpChat : mastraAgent;

  // Message handling
  const handleSendMessage = useCallback(async () => {
    // Implementation from Section.MOC.tsx lines 486-524
  }, [inputValue, activeAgent, shouldUseMcpAgent, locale]);

  // Convert agent messages to chat format
  useEffect(() => {
    // Implementation from Section.MOC.tsx lines 528-659
  }, [activeAgent.messages, shouldUseMcpAgent]);

  // ... other callbacks and effects

  return {
    messages,
    setMessages,
    inputValue,
    setInputValue,
    textareaRef,
    handleSendMessage,
    handleQuickAction,
    handleQuickReplyClick,
    handleFollowUpActionClick,
    handleRetry,
    isLoading: activeAgent.isStreaming,
    error: activeAgent.error,
    activeAgent,
    shouldUseMcpAgent,
    isConnected,
    connectedAgentCount,
    availableAgents,
    quickActions,
    server,
  };
}
```

---

## Interface Contracts

### Component Props Interfaces

| Component | Props Interface | Required Props | Optional Props |
|-----------|-----------------|----------------|----------------|
| SuggestionCard | SuggestionCardProps | messageId, suggestion, locale | state, onAction |
| ChatMessageBubble | ChatMessageBubbleProps | message, locale | isFirstInGroup, isLastInGroup, suggestionState, suggestionStates, onSuggestionAction, onQuickReplyClick, onFollowUpActionClick, onUnifiedButtonClick, onRefineAction |
| TaskListView | TaskListViewProps | connections, locale | onTaskClick, onStatusChange |
| TaskSection | TaskSectionProps | title, tasks, locale | onTaskClick |
| TaskDetailModal | TaskDetailModalProps | task, locale, onClose | onStatusChange |
| AgentListView | AgentListViewProps | connections, locale | customAgents, onSelectAgent, onAddAgent, onEditAgent, onDeleteAgent |
| RemoteAgentInstaller | { locale } | locale | - |
| RemoteAgentGuide | { locale } | locale | - |
| RemoteTaskExecutor | { locale } | locale | - |
| HistoryView | HistoryViewProps | messages, locale | - |

### Hook Return Types

| Hook | Return Type | Description |
|------|-------------|-------------|
| useMOCChat | UseMOCChatReturn | Chat state and handlers |
| useSuggestionState | UseSuggestionStateReturn | Suggestion management |
| useMOCModals | UseMOCModalsReturn | Modal state management |

---

## Migration Strategy

### Phase-by-Phase Migration

#### Phase 1: Type Definitions (FR-009)
1. Create `types/moc.types.ts`
2. Move all type definitions
3. Update imports in Section.MOC.tsx
4. Verify build

#### Phase 2: Parser Functions (FR-008)
1. Create `utils/mocParsers.ts`
2. Move all parser functions
3. Add exports
4. Update imports in Section.MOC.tsx
5. Run unit tests for parsers

#### Phase 3-4: Chat Components (FR-001, FR-002)
1. Create `components/Chat.SuggestionCard.tsx`
2. Create `components/Chat.MessageBubble.tsx`
3. Move components with their styles
4. Update Section.MOC.tsx to import
5. Manual test chat functionality

#### Phase 5-6: Task Components (FR-003, FR-004)
1. Create `components/Modal.TaskDetail.tsx` (includes TaskSection)
2. Create `components/Task.ListView.tsx`
3. Move components
4. Update imports
5. Manual test task list

#### Phase 7-8: Agent Components (FR-005, FR-006)
1. Create `components/Agent.RemoteInstaller.tsx`
2. Create `components/Agent.RemoteGuide.tsx`
3. Create `components/Agent.RemoteExecutor.tsx`
4. Create `components/Agent.ListView.tsx`
5. Move components
6. Update imports
7. Manual test agent tree and remote execution

#### Phase 9: Custom Hooks (FR-007)
1. Create `hooks/useMOCChat.ts`
2. Create `hooks/useSuggestionState.ts`
3. Create `hooks/useMOCModals.ts`
4. Refactor MOCSection to use new hooks
5. Full E2E test

---

## Testing Requirements

### Unit Tests

| Target | Test File | Coverage |
|--------|-----------|----------|
| mocParsers.ts | mocParsers.test.ts | All functions |
| moc.types.ts | (type-only, no tests needed) | N/A |
| SuggestionCard | SuggestionCard.test.tsx | Render, actions |
| ChatMessageBubble | ChatMessageBubble.test.tsx | Render, variants |

### Integration Tests

| Scenario | Description |
|----------|-------------|
| Chat Flow | Send message -> receive response -> display |
| Suggestion Flow | Display card -> action -> update |
| Task Flow | List -> select -> modal -> status change |

### E2E Tests (Existing)

- All existing E2E tests in `frontend/e2e/` should pass
- No new E2E tests required for refactoring

---

## Performance Considerations

### Memoization

```typescript
// Example: Memoized component
export const SuggestionCard = React.memo(function SuggestionCard({
  messageId,
  suggestion,
  locale,
  state,
  onAction,
}: SuggestionCardProps) {
  // Component implementation
});

// Example: Memoized callback in hook
const handleSendMessage = useCallback(async () => {
  // Implementation
}, [inputValue, activeAgent, shouldUseMcpAgent, locale]);
```

### Code Splitting

```typescript
// Dynamic import for heavy components
const RemoteTaskExecutor = React.lazy(() =>
  import('./Agent.RemoteExecutor').then(m => ({ default: m.RemoteTaskExecutor }))
);

// Usage with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <RemoteTaskExecutor locale={locale} />
</Suspense>
```

---

## File Size Targets

| File | Target Size | Current (in MOC) |
|------|-------------|------------------|
| Section.MOC.tsx | ~1,500 lines | 4,507 lines |
| types/moc.types.ts | ~180 lines | ~148 lines |
| utils/mocParsers.ts | ~700 lines | ~660 lines |
| Chat.SuggestionCard.tsx | ~200 lines | ~177 lines |
| Chat.MessageBubble.tsx | ~250 lines | ~205 lines |
| Task.ListView.tsx | ~100 lines | ~93 lines |
| Modal.TaskDetail.tsx | ~250 lines | ~210 lines |
| Agent.ListView.tsx | ~500 lines | ~434 lines |
| Agent.RemoteInstaller.tsx | ~200 lines | ~183 lines |
| Agent.RemoteGuide.tsx | ~80 lines | ~65 lines |
| Agent.RemoteExecutor.tsx | ~280 lines | ~248 lines |
| hooks/useMOCChat.ts | ~180 lines | (new) |
| hooks/useSuggestionState.ts | ~120 lines | (new) |
| hooks/useMOCModals.ts | ~100 lines | (new) |
