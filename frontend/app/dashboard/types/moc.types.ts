/**
 * MOC (Multi-agent Orchestration Center) Type Definitions
 *
 * This file contains all type definitions used in the MOC section.
 * Extracted from Section.MOC.tsx for better organization and reusability.
 *
 * @module types/moc.types
 */

import type { Goal, Habit, Sticky, Tag } from '.';
import type { CandidateLabel } from './candidate-label.types';

// ============================================================================
// Tab Types
// ============================================================================

/** Tab identifier for MOC section */
export type TabId = 'chat' | 'tasks' | 'agents' | 'history';

/** Tab configuration with localized labels */
export interface TabConfig {
  id: TabId;
  label: string;
  labelJa: string;
  icon: string;
  badge?: number;
}

/** Available tabs in MOC section */
export const TABS: TabConfig[] = [
  { id: 'chat', label: 'Chat', labelJa: 'チャット', icon: '💬' },
  { id: 'tasks', label: 'Tasks', labelJa: 'タスク', icon: '📋' },
  { id: 'agents', label: 'Agents', labelJa: 'エージェント', icon: '🤖' },
  { id: 'history', label: 'History', labelJa: '履歴', icon: '📜' },
];

// ============================================================================
// Message Types for Group Chat
// ============================================================================

/** Group chat message structure (canonical definition) */
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
  /** 候補ラベル配列 (エージェントからのJSON出力) */
  candidates?: CandidateLabel[];
  /** Single suggestion (first from suggestions array) */
  suggestion?: {
    type: 'habit' | 'goal';
    suggestionType?: 'habit' | 'goal' | 'stickyn' | 'reply';
    data: Record<string, unknown>;
    actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  };
  /** Multiple suggestions */
  suggestions?: Array<{
    type: 'habit' | 'goal';
    suggestionType?: 'habit' | 'goal' | 'stickyn' | 'reply';
    data: Record<string, unknown>;
    actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  }>;
  /** Quick reply options */
  quickReplies?: Array<{
    id: string;
    label: string;
    value: string;
    icon?: string;
  }>;
  /** Selection type for quick replies */
  selectionType?: 'habit_category' | 'goal_category' | 'difficulty';
  /** Follow-up action buttons */
  followUpActions?: Array<{
    id: string;
    label: string;
    action: 'more_specific' | 'easier' | 'harder' | 'different' | 'more_suggestions' | 'different_habit';
    category?: string;
  }>;
  /** Unified response buttons */
  unifiedButtons?: Array<{
    type: string;
    [key: string]: unknown;
  }>;
  /** Extracted message from unified response */
  extractedMessage?: string;
}

// ============================================================================
// MOC Section Props
// ============================================================================

/** Props for MOCSection component */
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
  /** ユーザーID - セッション分離のために必須 */
  userId?: string;
}

// ============================================================================
// Task Types
// ============================================================================

/** Task with extended info for detail view */
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

// ============================================================================
// History Types
// ============================================================================

/** History filter options */
export type HistoryFilter = 'all' | 'user' | 'coach' | 'agent' | 'system';

// ============================================================================
// Multi-agent Types
// ============================================================================

/** Individual agent response in aggregation session */
export interface AgentResponse {
  agentId: string;
  agentName: string;
  agentRole: string;
  response: string;
  status: 'pending' | 'complete' | 'error';
  timestamp: Date;
}

/** Multi-agent response aggregation session */
export interface AggregationSession {
  id: string;
  userQuery: string;
  responses: AgentResponse[];
  status: 'collecting' | 'summarizing' | 'complete' | 'error';
  summary?: string;
  startedAt: Date;
}

/** Selectable agent for chat */
export interface SelectableAgent {
  id: string;
  name: string;
  role: string;
  icon: string;
  type: 'coach' | 'mcp-agent';
  serverId?: string;
  status?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Agent role icons */
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
