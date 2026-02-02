/**
 * Multi-Agent Dashboard Types
 */

export type AgentRole =
  | 'manager'
  | 'developer'
  | 'reviewer'
  | 'tester'
  | 'documenter'
  | 'analyst'
  | 'architect'
  | 'devops'
  | 'general';

export type AgentStatus = 'idle' | 'busy' | 'offline';

export type AgentType = 'mastra' | 'strands' | 'claude' | 'custom';

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageTaskDuration: number; // in seconds
  successRate: number; // 0-100
  uptime: number; // in seconds
  lastActiveAt: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: unknown;
}

export interface WorkflowExecution {
  id: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps: WorkflowStep[];
  startedAt: string;
  completedAt?: string;
  progress: number; // 0-100
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  agentType?: AgentType;
  capabilities: string[];
  machineId: string;
  machineName: string;
  currentTaskId: string | null;
  currentTaskTitle?: string;
  lastHeartbeat: string;
  registeredAt: string;
  metrics?: AgentMetrics;
  currentWorkflow?: WorkflowExecution;
}

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string | null;
  assignedAgentName?: string;
  result: string | null;
  tags: string[];
  parentTaskId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
}

export type TrustLevel = 'none' | 'basic' | 'elevated' | 'full';
export type AuthMethod = 'token' | 'ldap' | 'certificate';

export interface TrustedMachine {
  id: string;
  hostname: string;
  ipAddress: string;
  trustLevel: TrustLevel;
  authMethod: AuthMethod;
  maxAgents: number;
  currentAgents: number;
  isOnline: boolean;
  addedBy: string;
  addedAt: string;
  lastSeen: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAction {
  id: string;
  label: string;
  type: 'approve' | 'reject' | 'execute' | 'navigate';
  payload: unknown;
}

export type ChatMessageRole = 'user' | 'manager' | 'agent' | 'system';
export type ChatMessageType =
  | 'message'           // 通常のメッセージ
  | 'task_assignment'   // タスク割当通知
  | 'progress_report'   // 進捗報告
  | 'completion_report' // 完了報告
  | 'error_report'      // エラー報告
  | 'spec_draft'        // SPEC作成
  | 'instruction';      // 指示

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  /** エージェントからのメッセージの場合 */
  agentId?: string;
  agentName?: string;
  agentRole?: AgentRole;
  /** メッセージタイプ */
  messageType?: ChatMessageType;
  /** 関連タスクID */
  taskId?: string;
  taskTitle?: string;
  metadata?: Record<string, unknown>;
  actions?: ChatAction[];
  createdAt: string;
}

export type SSEEventType =
  | 'agent_registered'
  | 'agent_status_changed'
  | 'task_created'
  | 'task_assigned'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'heartbeat';

export interface SSEEvent {
  type: SSEEventType;
  timestamp: string;
  data: unknown;
}

export interface AgentActivity {
  id: string;
  eventType: SSEEventType;
  agentId: string;
  agentName: string;
  taskId?: string;
  taskTitle?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Individual MCP Server configuration
 */
export interface McpServer {
  id: string;                    // UUID
  name: string;                  // Display name (e.g., "Local Server", "Remote Dev")
  serverUrl: string;             // e.g., "https://ubuntu.tailddc354.ts.net"
  serverToken: string;           // Auth token
  enabled: boolean;              // Enable/disable without deleting
  autoConnect: boolean;          // Auto-connect on page load
}

/**
 * Multi-Agent configuration with multiple server support
 */
export interface MultiAgentConfig {
  servers: McpServer[];          // Array of server configs
  showInDashboard: boolean;      // Global setting
  notifyOnTaskComplete: boolean; // Global setting
  notifyOnAgentOffline: boolean; // Global setting
}

/**
 * Legacy single-server config (for migration)
 * @deprecated Use MultiAgentConfig with servers array
 */
export interface LegacyMultiAgentConfig {
  enabled: boolean;
  serverUrl: string;
  serverToken: string;
  autoConnect: boolean;
  showInDashboard: boolean;
  notifyOnTaskComplete: boolean;
  notifyOnAgentOffline: boolean;
}

// Role icons and labels
export const ROLE_CONFIG: Record<AgentRole, { icon: string; label: string; labelJa: string; color: string }> = {
  manager: { icon: '👔', label: 'Manager', labelJa: 'マネージャー', color: 'text-purple-600 dark:text-purple-400' },
  developer: { icon: '💻', label: 'Developer', labelJa: '開発者', color: 'text-blue-600 dark:text-blue-400' },
  reviewer: { icon: '🔍', label: 'Reviewer', labelJa: 'レビュアー', color: 'text-orange-600 dark:text-orange-400' },
  tester: { icon: '🧪', label: 'Tester', labelJa: 'テスター', color: 'text-green-600 dark:text-green-400' },
  documenter: { icon: '📝', label: 'Documenter', labelJa: 'ドキュメンター', color: 'text-yellow-600 dark:text-yellow-400' },
  analyst: { icon: '📊', label: 'Analyst', labelJa: 'アナリスト', color: 'text-cyan-600 dark:text-cyan-400' },
  architect: { icon: '🏗️', label: 'Architect', labelJa: 'アーキテクト', color: 'text-indigo-600 dark:text-indigo-400' },
  devops: { icon: '🔧', label: 'DevOps', labelJa: 'DevOps', color: 'text-red-600 dark:text-red-400' },
  general: { icon: '🤖', label: 'General', labelJa: '汎用', color: 'text-gray-600 dark:text-gray-400' },
};

export const STATUS_CONFIG: Record<AgentStatus, { label: string; labelJa: string; color: string; bgColor: string }> = {
  idle: { label: 'Idle', labelJa: '待機中', color: 'text-green-600', bgColor: 'bg-green-500' },
  busy: { label: 'Busy', labelJa: '作業中', color: 'text-yellow-600', bgColor: 'bg-yellow-500' },
  offline: { label: 'Offline', labelJa: 'オフライン', color: 'text-gray-400', bgColor: 'bg-gray-400' },
};

export const AGENT_TYPE_CONFIG: Record<AgentType, { label: string; labelJa: string; color: string; bgColor: string; icon: string }> = {
  mastra: { label: 'Mastra', labelJa: 'Mastra', color: 'text-purple-600', bgColor: 'bg-purple-500/10 border-purple-500/30', icon: 'M' },
  strands: { label: 'Strands', labelJa: 'Strands', color: 'text-cyan-600', bgColor: 'bg-cyan-500/10 border-cyan-500/30', icon: 'S' },
  claude: { label: 'Claude', labelJa: 'Claude', color: 'text-orange-600', bgColor: 'bg-orange-500/10 border-orange-500/30', icon: 'C' },
  custom: { label: 'Custom', labelJa: 'カスタム', color: 'text-gray-600', bgColor: 'bg-gray-500/10 border-gray-500/30', icon: '?' },
};

export const WORKFLOW_STEP_STATUS_CONFIG: Record<WorkflowStep['status'], { label: string; labelJa: string; color: string; bgColor: string; icon: string }> = {
  pending: { label: 'Pending', labelJa: '待機中', color: 'text-gray-500', bgColor: 'bg-gray-500/10', icon: 'o' },
  running: { label: 'Running', labelJa: '実行中', color: 'text-blue-500', bgColor: 'bg-blue-500/10', icon: '>' },
  completed: { label: 'Completed', labelJa: '完了', color: 'text-green-500', bgColor: 'bg-green-500/10', icon: '+' },
  failed: { label: 'Failed', labelJa: '失敗', color: 'text-red-500', bgColor: 'bg-red-500/10', icon: 'x' },
  skipped: { label: 'Skipped', labelJa: 'スキップ', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', icon: '-' },
};

export const TRUST_LEVEL_CONFIG: Record<TrustLevel, { label: string; labelJa: string; color: string; maxAgents: number }> = {
  none: { label: 'None', labelJa: 'なし', color: 'text-gray-400', maxAgents: 0 },
  basic: { label: 'Basic', labelJa: '基本', color: 'text-blue-500', maxAgents: 5 },
  elevated: { label: 'Elevated', labelJa: '拡張', color: 'text-yellow-500', maxAgents: 10 },
  full: { label: 'Full', labelJa: '完全', color: 'text-green-500', maxAgents: 20 },
};

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; labelJa: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', labelJa: '待機中', color: 'text-gray-600', bgColor: 'bg-gray-200 dark:bg-gray-700' },
  assigned: { label: 'Assigned', labelJa: '割当済', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900' },
  in_progress: { label: 'In Progress', labelJa: '進行中', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900' },
  completed: { label: 'Completed', labelJa: '完了', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900' },
  failed: { label: 'Failed', labelJa: '失敗', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900' },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; labelJa: string; color: string }> = {
  low: { label: 'Low', labelJa: '低', color: 'text-gray-500' },
  normal: { label: 'Normal', labelJa: '通常', color: 'text-blue-500' },
  high: { label: 'High', labelJa: '高', color: 'text-orange-500' },
  urgent: { label: 'Urgent', labelJa: '緊急', color: 'text-red-500' },
};

// Panel Layout types for tmux-style view
export type PanelLayout = '2x2' | '2x4' | '3x3' | '1x4' | '4x2';

export interface PaneConfig {
  id: string;
  agentId: string | null;
  isMaximized: boolean;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export interface AgentLog {
  id: string;
  agentId: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
}

export const LOG_LEVEL_CONFIG: Record<LogLevel, { color: string; bgColor: string; icon: string }> = {
  info: { color: 'text-blue-400', bgColor: 'bg-blue-400/10', icon: 'i' },
  warn: { color: 'text-yellow-400', bgColor: 'bg-yellow-400/10', icon: '!' },
  error: { color: 'text-red-400', bgColor: 'bg-red-400/10', icon: 'x' },
  debug: { color: 'text-gray-400', bgColor: 'bg-gray-400/10', icon: '#' },
  success: { color: 'text-green-400', bgColor: 'bg-green-400/10', icon: '+' },
};

export const PANEL_LAYOUT_CONFIG: Record<PanelLayout, { cols: number; rows: number; label: string }> = {
  '2x2': { cols: 2, rows: 2, label: '2x2' },
  '2x4': { cols: 2, rows: 4, label: '2x4' },
  '3x3': { cols: 3, rows: 3, label: '3x3' },
  '1x4': { cols: 1, rows: 4, label: '1x4' },
  '4x2': { cols: 4, rows: 2, label: '4x2' },
};

// Instruction Flow Types
export type InstructionStatus = 'pending' | 'delivered' | 'acknowledged' | 'completed' | 'failed';

export interface AgentInstruction {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  status: InstructionStatus;
  timestamp: string;
  taskId?: string;
}

export interface InstructionFlowNode {
  id: string;
  agentId: string;
  x: number;
  y: number;
  level: number; // 0 = manager, 1 = workers, 2 = reviewers, etc.
}

export interface InstructionFlowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  instructionId: string;
  status: InstructionStatus;
}

export const INSTRUCTION_STATUS_CONFIG: Record<InstructionStatus, { label: string; labelJa: string; color: string; strokeColor: string }> = {
  pending: { label: 'Pending', labelJa: '保留中', color: 'text-gray-500', strokeColor: '#9ca3af' },
  delivered: { label: 'Delivered', labelJa: '配信済', color: 'text-blue-500', strokeColor: '#3b82f6' },
  acknowledged: { label: 'Acknowledged', labelJa: '確認済', color: 'text-yellow-500', strokeColor: '#eab308' },
  completed: { label: 'Completed', labelJa: '完了', color: 'text-green-500', strokeColor: '#22c55e' },
  failed: { label: 'Failed', labelJa: '失敗', color: 'text-red-500', strokeColor: '#ef4444' },
};

// Agent Interaction Types (for Activity Panel)
export type InteractionType = 'instruction' | 'report' | 'question' | 'response';

export interface AgentInteraction {
  id: string;
  fromAgent: string;
  fromAgentName: string;
  toAgent: string | null; // null for broadcast/self messages
  toAgentName: string | null;
  type: InteractionType;
  content: string;
  timestamp: string;
}

export const INTERACTION_TYPE_CONFIG: Record<InteractionType, { label: string; labelJa: string; icon: string; color: string; bgColor: string }> = {
  instruction: { label: 'Instruction', labelJa: '指示', icon: '>', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  report: { label: 'Report', labelJa: '報告', icon: '<', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  question: { label: 'Question', labelJa: '質問', icon: '?', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  response: { label: 'Response', labelJa: '回答', icon: '!', color: 'text-green-500', bgColor: 'bg-green-500/10' },
};
